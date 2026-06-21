from src.data_loader import get_dataframe

def test_dataframe_loads():
    df = get_dataframe()
    assert df is not None
    assert len(df) > 0

def test_required_columns_exist():
    df = get_dataframe()
    for col in ["name", "location", "cuisines", "cost", "rating"]:
        assert col in df.columns, f"Missing column: {col}"

def test_rating_is_numeric():
    df = get_dataframe()
    assert df["rating"].dtype == float

def test_no_null_ratings():
    df = get_dataframe()
    assert df["rating"].isna().sum() == 0
