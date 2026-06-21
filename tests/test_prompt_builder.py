import pandas as pd
from src.user_input import UserPreferences
from src.prompt_builder import build_user_prompt, build_candidates_table

def _sample_candidates():
    return pd.DataFrame([{
        "name": "Test Restaurant", "cuisines": "Italian",
        "rating": 4.5, "cost": 800, "votes": 1000, "dining_type": "Dine-out"
    }])

def test_user_prompt_contains_preferences():
    prefs = UserPreferences("Bangalore", "medium", "Italian", 4.0, "rooftop")
    prompt = build_user_prompt(prefs, _sample_candidates())
    assert "Bangalore" in prompt
    assert "Italian" in prompt
    assert "rooftop" in prompt

def test_candidates_table_not_empty():
    table = build_candidates_table(_sample_candidates())
    assert "Test Restaurant" in table
