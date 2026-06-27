"""
src/image_gen.py — HuggingFace FLUX.1-schnell Image Generator
==============================================================
Wraps the HuggingFace InferenceClient to generate restaurant
images using the FLUX.1-schnell model via the nscale provider.

Two public functions:
  generate_image_bytes(prompt) → bytes | None   — raw PNG bytes
  generate_image_b64(prompt)   → str            — base64-encoded PNG string
                                                   (empty string on failure)

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

logger = logging.getLogger("zomoto.image_gen")

# Lazy import — only load huggingface_hub if it's installed
try:
    from huggingface_hub import InferenceClient
    _HF_AVAILABLE = True
except ImportError:
    _HF_AVAILABLE = False
    logger.warning("huggingface_hub not installed — image generation disabled.")


# ── Module-level client (created once, reused across requests) ─────────────────
_client: "InferenceClient | None" = None

def _get_client() -> "InferenceClient | None":
    """Return a cached InferenceClient, or None if HF_TOKEN is not set."""
    global _client
    if not _HF_AVAILABLE:
        return None
    token = os.getenv("HF_TOKEN")
    if not token:
        logger.warning("HF_TOKEN not set — skipping image generation.")
        return None
    if _client is None:
        _client = InferenceClient(
            provider="nscale",
            api_key=token,
        )
        logger.info("HuggingFace InferenceClient initialised (nscale / FLUX.1-schnell).")
    return _client


def generate_image_bytes(image_prompt: str) -> bytes | None:
    """
    Generate a restaurant image using FLUX.1-schnell.

    Args:
        image_prompt: A vivid, appetizing description of the dish or restaurant.

    Returns:
        PNG image as bytes, or None if generation fails / is unavailable.
    """
    client = _get_client()
    if client is None:
        return None

    # Keep prompt concise — FLUX works best under 200 tokens
    prompt = image_prompt[:400].strip()
    if not prompt:
        return None

    try:
        logger.info("Generating image for prompt: %.80s…", prompt)
        # text_to_image returns a PIL.Image.Image object
        pil_image = client.text_to_image(
            prompt,
            model="black-forest-labs/FLUX.1-schnell",
        )
        # Convert PIL image → PNG bytes
        buf = io.BytesIO()
        pil_image.save(buf, format="PNG")
        buf.seek(0)
        png_bytes = buf.read()
        logger.info("Image generated successfully (%d bytes).", len(png_bytes))
        return png_bytes

    except Exception as exc:
        logger.error("Image generation failed: %s", exc)
        return None


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
    png_bytes = generate_image_bytes(image_prompt)
    if png_bytes is None:
        return ""
    return base64.b64encode(png_bytes).decode("utf-8")

