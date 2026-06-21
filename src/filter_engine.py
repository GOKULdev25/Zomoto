import os
import logging
import pandas as pd
from dotenv import load_dotenv
from src.user_input import UserPreferences

load_dotenv()
logger = logging.getLogger(__name__)

TOP_N = int(os.getenv("MAX_CANDIDATES_FOR_LLM", 15))


def filter_restaurants(df: pd.DataFrame, prefs: UserPreferences) -> tuple[pd.DataFrame, str]:
    """
    Apply a 4-stage filter with progressive relaxation.

    Returns:
        (filtered_df, notice_message)
        notice_message is "" when strict filter applied,
        or a descriptive string when filters were relaxed.
    """
    notice = ""
    low, high = prefs.cost_range()

    # ── Stage 1: Location (always required) ──────────────────────────────────
    location_key = prefs.sanitized_location()
    result = df[df["location"].str.contains(location_key, case=False, na=False)]

    if len(result) == 0:
        return pd.DataFrame(), f"No restaurants found in '{prefs.location}'."

    # Capture max available rating in this location for EC-F4 warning later
    max_available_rating = float(result["rating"].max())

    cuisine_key = prefs.sanitized_cuisine()

    # ── Helper: apply cuisine filter (EC-U3) ─────────────────────────────────
    def apply_cuisine(frame: pd.DataFrame) -> pd.DataFrame:
        """Skip cuisine filter entirely when field is blank (EC-U3)."""
        if not cuisine_key:
            return frame
        return frame[frame["cuisines"].str.contains(cuisine_key, case=False, na=False)]

    # ── Stage 2: Cuisine + Budget + Rating (strict) ───────────────────────────
    strict = apply_cuisine(result)
    strict = strict[
        strict["cost"].between(low, high) &
        (strict["rating"] >= prefs.min_rating)
    ]

    if len(strict) >= 3:
        return _top_n(strict), _low_rating_notice(strict, prefs)

    # ── Relaxation 1: Drop cuisine filter ────────────────────────────────────
    no_cuisine = result[
        result["cost"].between(low, high) &
        (result["rating"] >= prefs.min_rating)
    ]
    if len(no_cuisine) >= 3:
        notice = f"⚠️ No '{prefs.cuisine}' restaurants matched — showing other cuisines."
        return _top_n(no_cuisine), notice

    # ── Relaxation 2: Drop budget filter ─────────────────────────────────────
    no_budget = result[result["rating"] >= prefs.min_rating]
    if len(no_budget) >= 3:
        notice = "⚠️ Cuisine & budget filters relaxed — showing best-rated restaurants in your area."
        return _top_n(no_budget), notice

    # ── Relaxation 3: Show everything in location ─────────────────────────────
    notice = "⚠️ Showing all available restaurants in your area (limited matches)."

    # EC-F4: warn if every restaurant is below the requested min rating
    if max_available_rating < prefs.min_rating:
        notice += (
            f" Best available rating in this area is "
            f"{max_available_rating:.1f} / 5."
        )

    return _top_n(result), notice


# ─────────────────────────────────────────────────────────────────────────────
# Internal helpers
# ─────────────────────────────────────────────────────────────────────────────

def _top_n(df: pd.DataFrame) -> pd.DataFrame:
    """
    Sort by rating DESC, then votes DESC (EC-F3 tie-break),
    then cost ASC (best value), return top TOP_N rows.
    Handles missing votes column gracefully (EC-D7).
    """
    sort_cols   = ["rating"]
    sort_orders = [False]

    if "votes" in df.columns and df["votes"].sum() > 0:
        sort_cols.append("votes")
        sort_orders.append(False)

    sort_cols.append("cost")
    sort_orders.append(True)

    return (
        df.sort_values(by=sort_cols, ascending=sort_orders)
          .head(TOP_N)
          .reset_index(drop=True)
    )


def _low_rating_notice(df: pd.DataFrame, prefs: UserPreferences) -> str:
    """EC-F4: Return a warning string if no candidate meets the min rating."""
    if df["rating"].max() < prefs.min_rating:
        return (
            f"⚠️ Best available rating in this area is "
            f"{df['rating'].max():.1f} / 5."
        )
    return ""
