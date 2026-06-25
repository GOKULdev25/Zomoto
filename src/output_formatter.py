import re
import logging
from typing import Optional

logger = logging.getLogger(__name__)

# Max character length for display_name in UI cards (EC-S5)
MAX_DISPLAY_NAME_LEN = 40


def _strip_code_fences(text: str) -> str:
    """EC-G8: Strip any residual markdown code fences before parsing."""
    text = re.sub(r"```[a-z]*\n?", "", text)
    return text.strip("`").strip()


def parse_llm_response(
    response: str,
    candidate_names: Optional[list[str]] = None,
) -> list[dict]:
    """
    Parse the structured LLM output into a list of recommendation dicts.

    Expected LLM format (one block per recommendation):
        RANK 1
        Name      : <restaurant name>
        Cuisine   : <cuisine>
        Rating    : <rating> / 5
        Cost      : ₹<cost> for two
        Why       : <explanation>

    Edge cases handled:
    - EC-G8: Strips code fences before parsing.
    - EC-G5: Returns empty list if format is not recognised → caller shows raw text.
    - EC-O1: Handles 1 or 2 RANK blocks gracefully (partial output).
    - EC-O2: All dict accesses use .get() — missing fields default to "—".
    - EC-G6: Cross-checks name against candidate list; flags invented names.
    """
    if not response:
        return []

    # EC-G8: Strip any leftover fences
    response = _strip_code_fences(response)

    recommendations: list[dict] = []
    blocks = response.strip().split("RANK")

    for block in blocks[1:]:   # skip any preamble before first RANK
        lines = block.strip().splitlines()
        if not lines:
            continue

        rec: dict = {"rank": lines[0].strip()}

        for line in lines[1:]:
            if ":" in line:
                key, _, val = line.partition(":")
                rec[key.strip().lower()] = val.strip()

        # EC-G6: Hallucination detection — flag names not in candidate list
        if candidate_names and rec.get("name"):
            rec_name_lower = rec["name"].lower()
            matched = any(
                rec_name_lower in cn.lower() or cn.lower() in rec_name_lower
                for cn in candidate_names
            )
            if not matched:
                logger.warning(
                    "Possible LLM hallucination — '%s' not in candidate list.", rec["name"]
                )
                rec["name"] += " ⚠️"
                rec["hallucinated"] = True
            else:
                rec["hallucinated"] = False

        recommendations.append(rec)

    logger.info("parse_llm_response: parsed %d recommendation block(s).", len(recommendations))
    return recommendations


def format_recommendation_card(rec: dict) -> dict:
    """
    Normalize a parsed recommendation dict into a clean, API-ready dict.

    - EC-O2: All fields use .get() with "—" fallback.
    - EC-S5: Truncates display_name to MAX_DISPLAY_NAME_LEN chars.
    """
    name = rec.get("name", "Unknown Restaurant")
    display_name = (
        name[:MAX_DISPLAY_NAME_LEN] + "…"
        if len(name) > MAX_DISPLAY_NAME_LEN
        else name
    )

    return {
        "rank":          rec.get("rank", "—"),
        "name":          name,
        "display_name":  display_name,
        "cuisine":       rec.get("cuisine", "—"),
        "rating":        rec.get("rating", "—"),
        "cost":          rec.get("cost", "—"),
        "why":           rec.get("why", "—"),
        "hallucinated":  rec.get("hallucinated", False),
        "image_prompt":  rec.get("image prompt", f"A delicious {rec.get('cuisine', 'gourmet')} dish beautifully plated in an upscale restaurant setting"),
    }
