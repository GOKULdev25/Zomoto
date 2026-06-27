import pandas as pd
import random

# Generate a mock Zomato dataset with required columns
locations = ["Koramangala", "Indiranagar", "BTM", "Jayanagar", "Whitefield", "Marathahalli", "HSR"]
cuisines = ["North Indian", "South Indian", "Chinese", "Italian", "American, Continental", "Cafe", "Desserts", "Biryani"]
dining_types = ["Casual Dining", "Cafe", "Quick Bites", "Delivery", "Dessert Parlor", "Microbrewery"]

data = []
for i in range(1, 201):
    name = f"Restaurant {i}"
    location = random.choice(locations)
    cuisine = ", ".join(random.sample(cuisines, k=random.randint(1, 3)))
    cost = random.randint(200, 2500)
    rating = round(random.uniform(2.5, 4.9), 1)
    votes = random.randint(10, 5000)
    dtype = random.choice(dining_types)
    
    data.append([name, location, cuisine, str(cost), str(rating)+"/5", votes, dtype])

df = pd.DataFrame(data, columns=[
    "name", "location", "cuisines", "approx_cost(for two people)", 
    "rate", "votes", "listed_in(type)"
])
df.to_csv("data/zomato_mock.csv", index=False)
print("Mock dataset created with 200 rows at data/zomato_mock.csv")
