import os
import sys
import logging
import pandas as pd
import numpy as np
from dotenv import load_dotenv

load_dotenv()

# ── Logging ─────────────────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO, format="%(levelname)s | %(message)s")
logger = logging.getLogger(__name__)

# ── Config from env ──────────────────────────────────────────────────────────
HF_DATASET_NAME = os.getenv("HF_DATASET_NAME", "ManikaSaini/zomato-restaurant-recommendation")
COST_MIN        = int(os.getenv("COST_MIN", 50))
COST_MAX        = int(os.getenv("COST_MAX", 10000))

# ── Required columns after normalization ─────────────────────────────────────
REQUIRED_COLUMNS = ["name", "location", "cuisines", "cost", "rating"]

# ── Module-level cache (replaces @st.cache_data for FastAPI) ─────────────────
_cached_df: pd.DataFrame | None = None


# ── Required columns to extract from raw CSV ──────────────────────────────────
RAW_USE_COLS = [
    "name", "location", "cuisines", "approx_cost(for two people)", 
    "rate", "votes", "listed_in(type)"
]

# ─────────────────────────────────────────────────────────────────────────────
# Internal helpers
# ─────────────────────────────────────────────────────────────────────────────

def load_zomato_data() -> pd.DataFrame:
    """Load raw dataset locally or fallback to HuggingFace via streaming CSV."""
    import os
    mock_path = "data/zomato_mock.csv"
    if os.path.exists(mock_path):
        logger.info("Loading dataset from local file: %s", mock_path)
        df = pd.read_csv(mock_path, usecols=RAW_USE_COLS)
        logger.info("Local dataset loaded: %d rows, %d cols", len(df), len(df.columns))
        return df

    logger.info("Loading dataset from HuggingFace directly via CSV url: %s", HF_DATASET_NAME)
    url = f"https://huggingface.co/datasets/{HF_DATASET_NAME}/resolve/main/zomato.csv"
    df = pd.read_csv(url, usecols=RAW_USE_COLS)
    logger.info("Raw dataset loaded directly: %d rows, %d cols", len(df), len(df.columns))
    return df


def normalize_columns(df: pd.DataFrame) -> pd.DataFrame:
    """Normalize all column names to snake_case and apply rename map."""
    df = df.copy()
    df.columns = df.columns.str.strip().str.lower().str.replace(" ", "_")
    logger.info("Columns after normalization: %s", df.columns.tolist())

    rename_map = {
        "name":                        "name",
        "location":                    "location",
        "cuisines":                    "cuisines",
        "approx_cost(for_two_people)": "cost",
        "rate":                        "rating",
        "aggregate_rating":            "rating",
        "votes":                       "votes",
        "online_order":                "online_order",
        "book_table":                  "book_table",
        "listed_in(type)":             "dining_type",
    }
    df = df.rename(columns={k: v for k, v in rename_map.items() if k in df.columns})
    return df


def validate_columns(df: pd.DataFrame) -> None:
    """EC-D2: Raise if required columns are missing after normalization."""
    missing = [c for c in REQUIRED_COLUMNS if c not in df.columns]
    if missing:
        raise ValueError(
            f"Missing columns after normalization: {missing}.\n"
            f"Found columns: {df.columns.tolist()}"
        )


def validate_non_empty(df: pd.DataFrame) -> None:
    """EC-D6: Raise if dataset is empty."""
    if len(df) == 0:
        raise ValueError("Loaded dataset is empty. Cannot proceed.")


def clean_ratings(df: pd.DataFrame) -> pd.DataFrame:
    """
    Normalize rating column to float.
    Handles: '4.1/5', 'NEW', '-', NaN, plain floats.
    """
    def parse_rating(val):
        if pd.isna(val):
            return np.nan
        val = str(val).strip()
        if val in ["-", "NEW", "nan", ""]:
            return np.nan
        val = val.replace("/5", "").strip()
        try:
            return float(val)
        except ValueError:
            return np.nan

    df = df.copy()
    df["rating"] = df["rating"].apply(parse_rating)
    before = len(df)
    df = df.dropna(subset=["rating"])
    logger.info("clean_ratings: dropped %d rows with no valid rating", before - len(df))
    return df


def clean_cost(df: pd.DataFrame) -> pd.DataFrame:
    """
    Normalize cost column to int.
    Removes commas, handles non-numeric gracefully (EC-D4).
    Clamps outliers to COST_MIN–COST_MAX (EC-F5).
    """
    def parse_cost(val):
        if pd.isna(val):
            return np.nan
        try:
            return int(str(val).replace(",", "").strip())
        except (ValueError, TypeError):
            return np.nan

    df = df.copy()
    df["cost"] = df["cost"].apply(parse_cost)
    before = len(df)
    df = df.dropna(subset=["cost"])
    # EC-F5: Clamp extreme outliers
    df = df[(df["cost"] >= COST_MIN) & (df["cost"] <= COST_MAX)]
    logger.info("clean_cost: dropped %d rows (null/outlier costs)", before - len(df))
    return df


def deduplicate(df: pd.DataFrame) -> pd.DataFrame:
    """EC-D5: Remove duplicate (name, location) pairs, keep first."""
    before = len(df)
    df = df.drop_duplicates(subset=["name", "location"], keep="first")
    logger.info("deduplicate: removed %d duplicate entries", before - len(df))
    return df


# ─────────────────────────────────────────────────────────────────────────────
# Public API
# ─────────────────────────────────────────────────────────────────────────────

def get_dataframe() -> pd.DataFrame:
    """
    Load, clean and return the Zomato DataFrame.
    Uses a module-level in-memory cache — safe for both FastAPI and CLI use.
    Raises RuntimeError if loading fails (EC-D1).
    """
    global _cached_df
    if _cached_df is not None:
        return _cached_df

    try:
        df = load_zomato_data()
    except Exception as e:
        raise RuntimeError(f"Failed to load dataset: {e}") from e

    df = normalize_columns(df)
    validate_columns(df)
    df = clean_ratings(df)
    df = clean_cost(df)
    df = deduplicate(df)
    validate_non_empty(df)

    logger.info("Dataset ready: %d clean restaurants loaded.", len(df))
    _cached_df = df
    return df


def reset_cache() -> None:
    """Clear the in-memory cache. Useful for testing."""
    global _cached_df
    _cached_df = None
