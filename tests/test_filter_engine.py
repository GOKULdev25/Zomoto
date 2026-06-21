from src.data_loader import get_dataframe
from src.user_input import UserPreferences
from src.filter_engine import filter_restaurants

def _prefs(**kwargs):
    defaults = dict(location="Bangalore", budget="medium",
                    cuisine="North Indian", min_rating=3.5, extras="")
    defaults.update(kwargs)
    return UserPreferences(**defaults)

def test_filter_returns_results():
    df = get_dataframe()
    result, notice = filter_restaurants(df, _prefs())
    assert len(result) > 0

def test_filter_max_15():
    df = get_dataframe()
    result, _ = filter_restaurants(df, _prefs())
    assert len(result) <= 15

def test_invalid_location_returns_empty():
    df = get_dataframe()
    result, notice = filter_restaurants(df, _prefs(location="ZZZInvalidCity"))
    assert len(result) == 0

def test_relaxation_triggers():
    df = get_dataframe()
    result, notice = filter_restaurants(df, _prefs(cuisine="Peruvian", min_rating=4.9))
    assert isinstance(notice, str)
