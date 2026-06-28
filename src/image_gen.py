"""
src/image_gen.py — HuggingFace FLUX.1-schnell Image Generator
==============================================================
Wraps the HuggingFace InferenceClient to generate restaurant
images using the FLUX.1-schnell model.

Tries multiple providers in order: nscale → fal-ai → default (HF serverless).
Falls back gracefully — cards appear without images if all providers fail.

Two public functions:
  generate_image_bytes(prompt) → bytes | None   — raw PNG bytes
  generate_image_b64(prompt)   → str            — base64-encoded PNG string
                                                   (empty string on failure)

Diagnostic function:
  test_image_generation()      → dict           — detailed debug info

Usage inside /recommend (parallel):
    import asyncio
    b64_list = await asyncio.gather(*[
        loop.run_in_executor(None, generate_image_b64, card.image_prompt)
        for card in cards
    ])
"""

import io
import os
import base64
import logging
import traceback
import json

logger = logging.getLogger("zomoto.image_gen")

# Lazy import — only load huggingface_hub if it's installed
try:
    from huggingface_hub import InferenceClient
    _HF_AVAILABLE = True
except ImportError:
    _HF_AVAILABLE = False
    logger.warning("huggingface_hub not installed — image generation disabled.")

# Model to use for text-to-image
FLUX_MODEL = "black-forest-labs/FLUX.1-schnell"

# Providers to try in order (nscale is fastest, then fal-ai, then HF default)
PROVIDERS_TO_TRY = ["nscale", "fal-ai", None]

# ── Module-level client (created once, reused across requests) ─────────────────
_client: "InferenceClient | None" = None
_working_provider: str | None = "nscale"  # tracks which provider works

# ── Image Caching ─────────────────────────────────────────────────────────────
CACHE_FILE = ".image_cache.json"

def _load_cache() -> dict:
    if os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE, "r") as f:
                return json.load(f)
        except Exception:
            return {}
    return {}

def _save_cache(cache: dict):
    try:
        with open(CACHE_FILE, "w") as f:
            json.dump(cache, f)
    except Exception as e:
        logger.warning("Failed to save image cache: %s", e)

_image_cache = _load_cache()


def _get_token() -> str | None:
    """Return HF_TOKEN from environment, or None."""
    token = os.getenv("HF_TOKEN")
    if not token:
        logger.warning("HF_TOKEN not set — skipping image generation.")
    return token


def _create_client(provider: str | None, token: str) -> "InferenceClient":
    """Create an InferenceClient with the given provider."""
    if provider:
        return InferenceClient(provider=provider, api_key=token)
    else:
        return InferenceClient(api_key=token)


def _get_client() -> "InferenceClient | None":
    """Return a cached InferenceClient, or None if HF_TOKEN is not set."""
    global _client, _working_provider
    if not _HF_AVAILABLE:
        return None
    token = _get_token()
    if not token:
        return None
    if _client is None:
        _client = _create_client(_working_provider, token)
        provider_name = _working_provider or "default (HF serverless)"
        logger.info("HuggingFace InferenceClient initialised (provider=%s, model=%s).",
                     provider_name, FLUX_MODEL)
    return _client


import time

def _try_generate_with_provider(provider: str | None, token: str, prompt: str):
    """Try generating an image with a specific provider. Returns PIL Image or raises."""
    client = _create_client(provider, token)
    last_exc = None
    
    # Try up to 3 times per provider to handle rate limits (429) and temporary 503s
    for attempt in range(3):
        try:
            return client.text_to_image(prompt, model=FLUX_MODEL)
        except Exception as e:
            last_exc = e
            error_str = str(e).lower()
            if "429" in error_str or "too many requests" in error_str or "rate limit" in error_str or "503" in error_str:
                if attempt < 2:
                    logger.info("Provider=%s rate limited or unavailable, sleeping 2s (attempt %d/3)...", provider or "default", attempt + 1)
                    time.sleep(2)
                    continue
            raise e
            
    raise last_exc


def generate_image_bytes(image_prompt: str) -> bytes | None:
    """
    Generate a restaurant image using FLUX.1-schnell.

    Tries the cached provider first. If it fails, tries all providers in order
    and caches the first one that works.

    Args:
        image_prompt: A vivid, appetizing description of the dish or restaurant.

    Returns:
        PNG image as bytes, or None if generation fails / is unavailable.
    """
    global _client, _working_provider

    if not _HF_AVAILABLE:
        return None

    token = _get_token()
    if not token:
        return None

    # Keep prompt concise — FLUX works best under 200 tokens
    prompt = image_prompt[:400].strip()
    if not prompt:
        return None

    # First, try with the cached client/provider
    client = _get_client()
    if client is not None:
        try:
            logger.info("Generating image (provider=%s): %.80s…",
                         _working_provider or "default", prompt)
            pil_image = _try_generate_with_provider(_working_provider, token, prompt)
            return _pil_to_bytes(pil_image)
        except Exception as exc:
            logger.warning("Image gen failed with provider=%s: %s: %s",
                            _working_provider or "default",
                            type(exc).__name__, exc)
            # Reset cached client — will try fallback
            _client = None

    # Fallback: try all providers in order
    errors = []
    for provider in PROVIDERS_TO_TRY:
        provider_name = provider or "default"
        try:
            logger.info("Trying provider=%s for image generation…", provider_name)
            pil_image = _try_generate_with_provider(provider, token, prompt)
            # Success! Cache this provider for future requests
            _working_provider = provider
            _client = _create_client(provider, token)
            logger.info("✅ Provider=%s works! Caching for future requests.", provider_name)
            return _pil_to_bytes(pil_image)
        except Exception as exc:
            error_detail = f"{type(exc).__name__}: {exc}"
            errors.append(f"provider={provider_name}: {error_detail}")
            logger.warning("Provider=%s failed: %s", provider_name, error_detail)

    # All providers failed
    logger.error(
        "All image generation providers failed.\n  %s",
        "\n  ".join(errors)
    )
    return None


def _pil_to_bytes(pil_image) -> bytes:
    """Convert a PIL Image to PNG bytes."""
    buf = io.BytesIO()
    pil_image.save(buf, format="PNG")
    buf.seek(0)
    png_bytes = buf.read()
    logger.info("Image generated successfully (%d bytes).", len(png_bytes))
    return png_bytes


def generate_image_b64(image_prompt: str) -> str:
    """
    Generate a restaurant image and return it as a base64-encoded PNG string.

    This is the function called inside /recommend so images can be embedded
    directly in the JSON response as `data:image/png;base64,...`.

    Args:
        image_prompt: A vivid description of the dish / restaurant atmosphere.

    Returns:
        Base64 string (no data-URI prefix) on success, or "" on failure.
        The frontend prepends "data:image/png;base64," itself.
    """
    prompt_key = image_prompt[:400].strip()
    if not prompt_key:
        return ""

    if prompt_key in _image_cache:
        logger.info("Image found in cache for prompt: %.80s…", prompt_key)
        return _image_cache[prompt_key]

    png_bytes = generate_image_bytes(image_prompt)
    if png_bytes is None:
        return ""
    
    b64_str = base64.b64encode(png_bytes).decode("utf-8")
    _image_cache[prompt_key] = b64_str
    _save_cache(_image_cache)
    return b64_str


def test_image_generation() -> dict:
    """
    Diagnostic function — tests each provider and returns detailed results.
    Called by the /debug/test-image endpoint.
    """
    result = {
        "hf_available": _HF_AVAILABLE,
        "hf_token_set": bool(os.getenv("HF_TOKEN")),
        "hf_token_prefix": "",
        "model": FLUX_MODEL,
        "providers_tested": [],
        "working_provider": None,
        "image_generated": False,
        "image_b64_length": 0,
    }

    token = os.getenv("HF_TOKEN")
    if token:
        result["hf_token_prefix"] = token[:10] + "..."

    if not _HF_AVAILABLE:
        result["error"] = "huggingface_hub not installed"
        return result

    if not token:
        result["error"] = "HF_TOKEN not set in environment"
        return result

    test_prompt = "A delicious plate of butter chicken with naan bread in a warm restaurant"

    for provider in PROVIDERS_TO_TRY:
        provider_name = provider or "default"
        test_result = {"provider": provider_name, "success": False, "error": None}

        try:
            client = _create_client(provider, token)
            pil_image = client.text_to_image(test_prompt, model=FLUX_MODEL)
            buf = io.BytesIO()
            pil_image.save(buf, format="PNG")
            b64 = base64.b64encode(buf.getvalue()).decode("utf-8")

            test_result["success"] = True
            test_result["image_size"] = pil_image.size
            test_result["b64_length"] = len(b64)

            result["working_provider"] = provider_name
            result["image_generated"] = True
            result["image_b64_length"] = len(b64)

        except Exception as exc:
            test_result["error"] = f"{type(exc).__name__}: {str(exc)[:300]}"
            test_result["traceback"] = traceback.format_exc()[-500:]

        result["providers_tested"].append(test_result)

        # Stop after first success
        if test_result["success"]:
            break

    return result

