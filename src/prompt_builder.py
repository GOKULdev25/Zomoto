import os
import pandas as pd
from dotenv import load_dotenv
from src.user_input import UserPreferences, BUDGET_MAP

load_dotenv()
TOP_K_RECOMMENDATIONS = int(os.getenv("TOP_K_RECOMMENDATIONS", 3))

SYSTEM_PROMPT = f"""You are an expert restaurant recommendation assistant.
You will receive a list of real restaurants with their actual data.
Your ONLY job is to pick the TOP {TOP_K_RECOMMENDATIONS} restaurants from the provided list.
Rules:
- Do NOT invent or assume any detail not present in the data.
- Rank by best match to user's preferences.
- For each restaurant, give a 2-3 sentence explanation.
- Use this exact format for each recommendation:

RANK {{n}}
Name      : <restaurant name>
Cuisine   : <cuisine>
Rating    : <rating> / 5
Cost      : ₹<cost> for two
Why       : <explanation>
"""


def build_candidates_table(candidates: pd.DataFrame) -> str:
    rows = []
    for i, row in candidates.iterrows():
        rows.append(
            f"{i+1}. {row['name']} | Cuisine: {row['cuisines']} | "
            f"Rating: {row['rating']} | Cost: ₹{row['cost']} | "
            f"Votes: {row.get('votes', 'N/A')} | Type: {row.get('dining_type', 'N/A')}"
        )
    return "\n".join(rows)

def build_user_prompt(prefs: UserPreferences, candidates: pd.DataFrame) -> str:
    low, high = BUDGET_MAP[prefs.budget]
    table = build_candidates_table(candidates)
    return f"""USER PREFERENCES:
- Location    : {prefs.location}
- Budget      : {prefs.budget.capitalize()} (₹{low}–₹{high} for two)
- Cuisine     : {prefs.cuisine}
- Min Rating  : {prefs.min_rating} / 5
- Extra Needs : {prefs.extras or "None"}

CANDIDATE RESTAURANTS:
{table}

TASK: Rank the top {TOP_K_RECOMMENDATIONS} restaurants from the list above that best match this user.
"""
