"""
app.py — Zomoto FastAPI Backend (Phase 5A)
==========================================
Exposes two endpoints:
  GET  /health    → readiness / dataset status
  POST /recommend → full recommendation pipeline

Run:
    python app.py
    # or
    uvicorn app:app --reload --port 8000

API docs:
    http://localhost:8000/docs
"""

import sys
import os
import logging

# ── EC-X2: Python version guard ───────────────────────────────────────────────
if sys.version_info < (3, 10):
    raise RuntimeError("Python 3.10+ is required. Please upgrade.")

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, field_validator
from dotenv import load_dotenv
import uvicorn

from src.data_loader import get_dataframe
from src.user_input import UserPreferences, BUDGET_MAP
from src.filter_engine import filter_restaurants
from src.prompt_builder import SYSTEM_PROMPT, build_user_prompt
from src.groq_client import get_recommendation
from src.output_formatter import parse_llm_response, format_recommendation_card

load_dotenv()

# ── Logging ────────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("zomoto.app")

# ── FastAPI app ────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Zomoto API",
    description=(
        "AI-powered restaurant recommendation system. "
        "Powered by Groq LLM (Llama 3.3 70B) and the HuggingFace Zomato dataset."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── CORS — allow React dev server + production (EC-S6) ────────────────────────
CORS_ORIGINS = [
    # Local development
    "http://localhost:5173",   # Vite default
    "http://localhost:3000",   # CRA default
    "http://127.0.0.1:5173",
]

# Production: add Vercel deployment URL from env (set on Railway)
_vercel_url = os.getenv("FRONTEND_URL")
if _vercel_url:
    CORS_ORIGINS.append(_vercel_url.rstrip("/"))

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Pre-load dataset at startup ───────────────────────────────────────────────
_df = None
_df_load_error: str | None = None

@app.on_event("startup")
async def startup_load_dataset():
    global _df, _df_load_error
    logger.info("Loading Zomato dataset at startup…")
    try:
        _df = get_dataframe()
        logger.info("Dataset loaded: %d rows ready.", len(_df))
    except Exception as exc:
        _df_load_error = str(exc)
        logger.error("Dataset load FAILED: %s", exc)


# ── Global exception handler ──────────────────────────────────────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled exception: %s", exc)
    return JSONResponse(
        status_code=500,
        content={"detail": f"Unexpected server error: {exc}"},
    )


# ═══════════════════════════════════════════════════════════════════════════════
# Request / Response Models
# ═══════════════════════════════════════════════════════════════════════════════

class RecommendRequest(BaseModel):
    """
    User preference payload for the /recommend endpoint.
    Pydantic validates types and ranges before the handler runs.
    """
    location:   str   = Field(...,  min_length=1, max_length=100,
                               description="City or area (e.g. 'Bangalore', 'Koramangala')")
    budget:     str   = Field(...,  description="Budget tier: low | medium | high",
                               pattern=r"^(low|medium|high)$")
    cuisine:    str   = Field("",   max_length=100,
                               description="Preferred cuisine (leave blank for any)")
    min_rating: float = Field(...,  ge=1.0, le=5.0,
                               description="Minimum star rating (1.0 – 5.0)")
    extras:     str   = Field("",   max_length=500,
                               description="Free-text extra preferences (family-friendly, rooftop, etc.)")

    model_config = {"json_schema_extra": {
        "example": {
            "location":   "Bangalore",
            "budget":     "medium",
            "cuisine":    "North Indian",
            "min_rating": 4.0,
            "extras":     "family-friendly",
        }
    }}


class RecommendationCard(BaseModel):
    """A single formatted restaurant recommendation."""
    rank:         str
    name:         str
    display_name: str
    cuisine:      str
    rating:       str
    cost:         str
    why:          str
    hallucinated: bool = False


class RecommendResponse(BaseModel):
    """Full response from the /recommend endpoint."""
    notice:           str                   = Field("", description="Filter relaxation notice, if any")
    recommendations:  list[RecommendationCard]
    candidates_count: int                   = Field(..., description="Number of candidates sent to LLM")
    raw_llm:          str                   = Field(..., description="Raw LLM text (for fallback display)")
    fallback_mode:    bool                  = Field(False,
                                                    description="True when LLM output could not be parsed")


class HealthResponse(BaseModel):
    status:         str
    dataset_loaded: bool
    dataset_rows:   int
    groq_key_set:   bool
    model:          str


# ═══════════════════════════════════════════════════════════════════════════════
# Endpoints
# ═══════════════════════════════════════════════════════════════════════════════

@app.get(
    "/health",
    response_model=HealthResponse,
    summary="Health & readiness check",
    tags=["System"],
)
def health() -> HealthResponse:
    """
    Returns the current status of the API:
    - Whether the dataset was loaded successfully
    - Whether GROQ_API_KEY is configured
    """
    return HealthResponse(
        status       = "ok" if _df is not None else "degraded",
        dataset_loaded = _df is not None,
        dataset_rows   = len(_df) if _df is not None else 0,
        groq_key_set   = bool(os.getenv("GROQ_API_KEY")),
        model          = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile"),
    )


@app.post(
    "/recommend",
    response_model=RecommendResponse,
    summary="Get AI restaurant recommendations",
    tags=["Recommendations"],
)
def recommend(req: RecommendRequest) -> RecommendResponse:
    """
    Full recommendation pipeline:

    1. Validate user preferences
    2. Filter the Zomato dataset (with progressive relaxation)
    3. Build a structured prompt
    4. Call Groq LLM
    5. Parse & return formatted recommendation cards

    **Edge cases handled:**
    - EC-D1 / EC-D6 : Dataset not loaded → 503
    - EC-G1          : API key missing → 503
    - EC-U1          : Empty location → 422 (Pydantic) + 400
    - EC-F1          : No restaurants in city → 404
    - EC-G4          : Empty / error LLM response → fallback_mode=True
    - EC-G5          : Unparseable LLM format → fallback_mode=True
    - EC-G6          : Hallucinated names flagged with ⚠️
    - EC-G7          : Prompt token overrun → reduce candidate count
    - EC-U5          : Extras sanitized before injecting into prompt
    """

    # ── EC-D1: Dataset not available ─────────────────────────────────────────
    if _df is None:
        detail = (
            f"Dataset is not loaded: {_df_load_error}"
            if _df_load_error
            else "Dataset is not loaded. Check server logs."
        )
        raise HTTPException(status_code=503, detail=detail)

    # ── EC-G1: API key not set ────────────────────────────────────────────────
    if not os.getenv("GROQ_API_KEY"):
        raise HTTPException(
            status_code=503,
            detail="GROQ_API_KEY is not configured on the server. Add it to .env.",
        )

    # ── Build & validate UserPreferences ─────────────────────────────────────
    try:
        prefs = UserPreferences(
            location   = req.location,
            budget     = req.budget,
            cuisine    = req.cuisine,
            min_rating = req.min_rating,
            extras     = req.extras,
        )
        prefs.validate()
    except (ValueError, AssertionError) as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    logger.info(
        "Recommend request | location=%s | budget=%s | cuisine=%s | "
        "min_rating=%.1f | extras=%s",
        prefs.sanitized_location(),
        prefs.budget,
        prefs.sanitized_cuisine() or "(any)",
        prefs.min_rating,
        repr(prefs.sanitized_extras()),
    )

    # ── Filter dataset ────────────────────────────────────────────────────────
    candidates, notice = filter_restaurants(_df, prefs)

    if candidates.empty:
        raise HTTPException(
            status_code=404,
            detail=f"No restaurants found in '{prefs.sanitized_location()}'. Try a different city.",
        )

    logger.info("Filter complete: %d candidates, notice=%r", len(candidates), notice)

    # ── EC-G7: Adaptive candidate count to stay under token limit ─────────────
    selected = candidates
    user_prompt = build_user_prompt(prefs, selected)
    for n in [15, 10, 5]:
        selected     = candidates.head(n)
        user_prompt  = build_user_prompt(prefs, selected)
        word_count   = len(user_prompt.split())
        if word_count < 1500:
            break
    logger.info(
        "Sending %d candidates to LLM (~%d words in prompt).",
        len(selected), len(user_prompt.split()),
    )

    # ── Call Groq LLM ─────────────────────────────────────────────────────────
    llm_output = get_recommendation(SYSTEM_PROMPT, user_prompt)

    # ── EC-G4: Empty or error LLM response → fallback ─────────────────────────
    if not llm_output.strip() or llm_output.startswith("❌"):
        logger.warning("LLM returned error or empty output — entering fallback mode.")
        return RecommendResponse(
            notice           = notice,
            recommendations  = [],
            candidates_count = len(selected),
            raw_llm          = llm_output,
            fallback_mode    = True,
        )

    # ── Parse LLM output ──────────────────────────────────────────────────────
    candidate_names = selected["name"].tolist()
    parsed_recs     = parse_llm_response(llm_output, candidate_names)

    # ── EC-G5: Unparseable format → fallback ─────────────────────────────────
    if not parsed_recs:
        logger.warning("parse_llm_response returned 0 blocks — entering fallback mode.")
        return RecommendResponse(
            notice           = notice,
            recommendations  = [],
            candidates_count = len(selected),
            raw_llm          = llm_output,
            fallback_mode    = True,
        )

    # ── Format cards & return ─────────────────────────────────────────────────
    cards = [
        RecommendationCard(**format_recommendation_card(r))
        for r in parsed_recs[:3]
    ]

    logger.info("Returning %d recommendation card(s).", len(cards))
    return RecommendResponse(
        notice           = notice,
        recommendations  = cards,
        candidates_count = len(selected),
        raw_llm          = llm_output,
        fallback_mode    = False,
    )


# ═══════════════════════════════════════════════════════════════════════════════
# Entry point
# ═══════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(
        "app:app",
        host="0.0.0.0",
        port=port,
        reload=True,
        log_level="info",
    )
