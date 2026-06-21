"""Quick smoke test for POST /recommend"""
import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
import urllib.request
import json


payload = json.dumps({
    "location":   "Bangalore",
    "budget":     "medium",
    "cuisine":    "North Indian",
    "min_rating": 4.0,
    "extras":     "family-friendly"
}).encode()

req = urllib.request.Request(
    "http://localhost:8000/recommend",
    data=payload,
    headers={"Content-Type": "application/json"},
    method="POST",
)

with urllib.request.urlopen(req) as resp:
    data = json.load(resp)

print("=== RECOMMEND RESPONSE ===")
print(f"notice          : {data['notice'] if data['notice'] else '(none)'}")
print(f"candidates_count: {data['candidates_count']}")
print(f"fallback_mode   : {data['fallback_mode']}")
print(f"recommendations : {len(data['recommendations'])} cards")
print()

for card in data["recommendations"]:
    print(f"  Rank    : {card['rank']}")
    print(f"  Name    : {card['name']}")
    print(f"  Display : {card['display_name']}")
    print(f"  Cuisine : {card['cuisine']}")
    print(f"  Rating  : {card['rating']}")
    print(f"  Cost    : {card['cost']}")
    print(f"  Why     : {card['why'][:100]}...")
    print(f"  Halluc? : {card['hallucinated']}")
    print()
