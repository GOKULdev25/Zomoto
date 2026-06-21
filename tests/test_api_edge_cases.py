"""Edge case tests for the /recommend and /health endpoints."""
import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

import urllib.request
import urllib.error
import json

BASE = "http://localhost:8000"

def post(payload: dict) -> tuple[int, dict]:
    data = json.dumps(payload).encode()
    req = urllib.request.Request(
        f"{BASE}/recommend",
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, json.load(resp)
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read())


def run(label: str, payload: dict, expect_status: int):
    status, body = post(payload)
    ok = "PASS" if status == expect_status else "FAIL"
    detail = body.get("detail", body.get("notice", ""))
    recs   = len(body.get("recommendations", []))
    fb     = body.get("fallback_mode", "-")
    print(f"[{ok}] {label}")
    print(f"      status={status}  recs={recs}  fallback={fb}")
    if detail:
        print(f"      detail: {str(detail)[:100]}")
    print()


print("=" * 60)
print("Phase 5A Edge Case Tests")
print("=" * 60)
print()

# EC-U1: Empty location → 400
run("EC-U1  Empty location",
    {"location": "  ", "budget": "medium", "cuisine": "", "min_rating": 3.5},
    expect_status=400)

# EC-F1: Unknown city → 404
run("EC-F1  Unknown city",
    {"location": "ZZZInvalidCity", "budget": "low", "cuisine": "", "min_rating": 3.0},
    expect_status=404)

# Pydantic: invalid budget → 422
run("EC-422 Invalid budget value",
    {"location": "Bangalore", "budget": "luxury", "cuisine": "", "min_rating": 3.0},
    expect_status=422)

# Pydantic: min_rating out of range → 422
run("EC-422 min_rating out of range",
    {"location": "Bangalore", "budget": "medium", "cuisine": "", "min_rating": 6.5},
    expect_status=422)

# EC-U3: Empty cuisine — should still return results
run("EC-U3  Empty cuisine (any cuisine)",
    {"location": "Bangalore", "budget": "medium", "cuisine": "", "min_rating": 3.5},
    expect_status=200)

# Happy path
run("HAPPY  Normal Bangalore request",
    {"location": "Bangalore", "budget": "medium", "cuisine": "North Indian", "min_rating": 4.0, "extras": "family"},
    expect_status=200)

# EC-U4: Min rating 5.0 (near impossible — triggers relaxation)
run("EC-U4  min_rating=5.0 (near impossible)",
    {"location": "Bangalore", "budget": "high", "cuisine": "Japanese", "min_rating": 5.0},
    expect_status=200)

print("Done.")
