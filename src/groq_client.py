import re
import time
import os
import logging
from groq import Groq, RateLimitError
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

# ── Config ────────────────────────────────────────────────────────────────────
PRIMARY_MODEL    = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
FALLBACK_MODEL   = "llama3-8b-8192"
GROQ_TEMPERATURE = float(os.getenv("GROQ_TEMPERATURE", 0.3))
MAX_RETRIES      = 3


def _strip_code_fences(text: str) -> str:
    """
    EC-G8: Remove markdown code fences LLMs sometimes wrap output in.
    e.g. ```text ... ``` or ```json ... ```
    """
    text = re.sub(r"```[a-z]*\n?", "", text)
    text = text.strip("`").strip()
    return text


def get_recommendation(system_prompt: str, user_prompt: str) -> str:
    """
    Call the Groq LLM and return the recommendation text.

    - EC-G1: Validates API key before any network call.
    - EC-G2: Retries up to MAX_RETRIES times on RateLimitError (429) with
             exponential backoff; falls back to smaller model on last attempt.
    - EC-G3: Catches all other exceptions and returns a user-friendly error string.
    - EC-G8: Strips markdown code fences from the raw response.
    """
    # EC-G1: Fail fast if API key is not configured
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        logger.error("GROQ_API_KEY is not set.")
        return "❌ GROQ_API_KEY is not configured. Add it to your .env file."

    client = Groq(api_key=api_key)

    for attempt in range(MAX_RETRIES):
        model = PRIMARY_MODEL if attempt < (MAX_RETRIES - 1) else FALLBACK_MODEL
        logger.info("Groq request attempt %d/%d using model: %s",
                    attempt + 1, MAX_RETRIES, model)
        try:
            response = client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user",   "content": user_prompt},
                ],
                temperature=GROQ_TEMPERATURE,
                max_tokens=1024,
            )
            raw = response.choices[0].message.content or ""
            return _strip_code_fences(raw)   # EC-G8

        except RateLimitError:
            wait = 2 ** attempt   # 1 s, 2 s, 4 s
            logger.warning("Groq rate limit hit (attempt %d). Waiting %ds…", attempt + 1, wait)
            time.sleep(wait)

        except Exception as exc:
            # EC-G3: Any other Groq/network error
            logger.exception("Groq API error on attempt %d: %s", attempt + 1, exc)
            return f"❌ LLM service error: {exc}. Please try again later."

    # All retries exhausted
    return "❌ Groq API rate limit reached. Please wait a moment and try again."
