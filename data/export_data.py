"""
data/export_data.py
-------------------
Utility script to export the cleaned & normalized Zomato dataset
(produced by Phase 2 — data_loader.py) into the data/ folder as CSV files
for easy inspection.

Usage:
    python data/export_data.py
"""

import sys
import os

# Ensure the project root is on the path so src imports work
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pandas as pd
from datasets import load_dataset
import numpy as np


# ── Replicate data_loader logic without @st.cache_data (no Streamlit needed) ──

def load_zomato_data() -> pd.DataFrame:
    dataset = load_dataset("ManikaSaini/zomato-restaurant-recommendation", split="train")
    return dataset.to_pandas()


def normalize_columns(df: pd.DataFrame) -> pd.DataFrame:
    df.columns = df.columns.str.strip().str.lower().str.replace(" ", "_")
    rename_map = {
        "name": "name",
        "location": "location",
        "cuisines": "cuisines",
        "approx_cost(for_two_people)": "cost",
        "rate": "rating",
        "votes": "votes",
        "online_order": "online_order",
        "book_table": "book_table",
        "listed_in(type)": "dining_type",
    }
    return df.rename(columns={k: v for k, v in rename_map.items() if k in df.columns})


def clean_ratings(df: pd.DataFrame) -> pd.DataFrame:
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

    df["rating"] = df["rating"].apply(parse_rating)
    return df.dropna(subset=["rating"])


def clean_cost(df: pd.DataFrame) -> pd.DataFrame:
    def parse_cost(val):
        if pd.isna(val):
            return np.nan
        return int(str(val).replace(",", "").strip())

    df["cost"] = df["cost"].apply(parse_cost)
    return df.dropna(subset=["cost"])


def get_dataframe() -> pd.DataFrame:
    df = load_zomato_data()
    df = normalize_columns(df)
    df = clean_ratings(df)
    df = clean_cost(df)
    return df


if __name__ == "__main__":
    DATA_DIR = os.path.dirname(os.path.abspath(__file__))

    print("[*] Loading dataset from HuggingFace...")
    df_raw = load_zomato_data()
    raw_path = os.path.join(DATA_DIR, "zomato_raw.csv")
    df_raw.to_csv(raw_path, index=False)
    print(f"   [OK] Raw data saved  -> {raw_path}  ({len(df_raw):,} rows)")

    print("[*] Cleaning & normalizing...")
    df_clean = get_dataframe()
    clean_path = os.path.join(DATA_DIR, "zomato_clean.csv")
    df_clean.to_csv(clean_path, index=False)
    print(f"   [OK] Clean data saved -> {clean_path}  ({len(df_clean):,} rows)")

    # ── Summary stats ──────────────────────────────────────────────────────────
    print("\n--- Dataset Summary ---")
    print(f"   Total rows (raw)     : {len(df_raw):,}")
    print(f"   Total rows (clean)   : {len(df_clean):,}")
    print(f"   Rows dropped         : {len(df_raw) - len(df_clean):,}")
    print(f"\n   Columns (clean)      : {df_clean.columns.tolist()}")
    print(f"\n   Rating range         : {df_clean['rating'].min():.1f} - {df_clean['rating'].max():.1f}")
    print(f"   Cost range           : Rs{int(df_clean['cost'].min())} - Rs{int(df_clean['cost'].max())}")
    print(f"   Unique locations     : {df_clean['location'].nunique()}")
    print(f"   Null ratings         : {df_clean['rating'].isna().sum()}")
    print(f"   Null costs           : {df_clean['cost'].isna().sum()}")

    # Top 10 locations
    top_locs = df_clean["location"].value_counts().head(10)
    print(f"\n   Top 10 Locations:")
    for loc, count in top_locs.items():
        print(f"      {loc:<30} {count:>5} restaurants")

    print("\n[DONE] Export complete. Check the data/ folder.")
