import re
import os
from dataclasses import dataclass
from dotenv import load_dotenv

load_dotenv()

# ── Budget ranges (configurable via .env) ────────────────────────────────────
BUDGET_LOW_MAX    = int(os.getenv("BUDGET_LOW_MAX", 500))
BUDGET_MEDIUM_MAX = int(os.getenv("BUDGET_MEDIUM_MAX", 1500))

BUDGET_MAP = {
    "low":    (0, BUDGET_LOW_MAX),
    "medium": (BUDGET_LOW_MAX + 1, BUDGET_MEDIUM_MAX),
    "high":   (BUDGET_MEDIUM_MAX + 1, 999999),
}

# ── Sanitization constants ────────────────────────────────────────────────────
MAX_EXTRAS_LEN   = 200   # EC-U5: prompt injection guard
MAX_FIELD_LEN    = 50    # EC-U6: location / cuisine truncation


@dataclass
class UserPreferences:
    location:   str
    budget:     str     # "low" | "medium" | "high"
    cuisine:    str
    min_rating: float
    extras:     str = ""

    # ── Validation ────────────────────────────────────────────────────────────

    def validate(self) -> None:
        """
        Raise AssertionError with a human-readable message on bad input.
        EC-U1: empty location
        EC-U4: min_rating out of range
        """
        if not self.location.strip():
            raise ValueError("Location cannot be empty.")
        if self.budget not in BUDGET_MAP:
            raise ValueError(f"Budget must be one of {list(BUDGET_MAP.keys())}.")
        if not (1.0 <= self.min_rating <= 5.0):
            raise ValueError("Min rating must be between 1.0 and 5.0.")

    # ── Sanitized accessors ───────────────────────────────────────────────────

    def sanitized_location(self) -> str:
        """
        EC-U2: Strip non-alpha characters from location.
        EC-U6: Truncate to MAX_FIELD_LEN.
        """
        clean = re.sub(r"[^a-zA-Z\s]", "", self.location).strip()
        return clean[:MAX_FIELD_LEN]

    def sanitized_cuisine(self) -> str:
        """EC-U6: Truncate cuisine to MAX_FIELD_LEN."""
        return self.cuisine.strip()[:MAX_FIELD_LEN]

    def sanitized_extras(self) -> str:
        """
        EC-U5: Sanitize free-text extras to prevent prompt injection.
        Removes template delimiters and code fences; truncates to MAX_EXTRAS_LEN.
        """
        safe = self.extras[:MAX_EXTRAS_LEN]
        # Strip characters that can break prompt templating or inject instructions
        safe = safe.replace("{", "").replace("}", "").replace("```", "")
        safe = re.sub(r"(ignore|disregard|forget).{0,30}(instruction|prompt|above)",
                      "[filtered]", safe, flags=re.IGNORECASE)
        return safe.strip()

    def cost_range(self) -> tuple[int, int]:
        return BUDGET_MAP[self.budget]
