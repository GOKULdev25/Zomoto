from src.prompt_builder import SYSTEM_PROMPT, build_user_prompt
from src.groq_client import get_recommendation
from src.data_loader import get_dataframe
from src.user_input import UserPreferences
from src.filter_engine import filter_restaurants

prefs = UserPreferences(location="Bangalore", budget="medium",
                        cuisine="North Indian", min_rating=4.0, extras="family-friendly")
df = get_dataframe()
candidates, notice = filter_restaurants(df, prefs)
user_prompt = build_user_prompt(prefs, candidates)
result = get_recommendation(SYSTEM_PROMPT, user_prompt)
print(result)
