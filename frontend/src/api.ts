import axios from 'axios';

// ─── Request Types ─────────────────────────────────────────────────────────────
export interface RecommendRequest {
  location: string;
  budget: string;           // "low" | "medium" | "high" — required by backend
  cuisine: string;
  min_rating: number;       // backend field name is min_rating, not rating
  extras: string;
  top_n?: number;
}

// ─── Backend Response Types ────────────────────────────────────────────────────
// Maps to RecommendationCard in app.py
export interface RecommendationCard {
  rank: string;
  name: string;
  display_name: string;
  cuisine: string;
  rating: string;
  cost: string;
  why: string;
  hallucinated: boolean;
  image_prompt: string;
  image_b64: string;  // Base64-encoded PNG from FLUX.1-schnell ("" if unavailable)
}

// Maps to RecommendResponse in app.py
export interface RecommendResponse {
  notice: string;
  recommendations: RecommendationCard[];
  candidates_count: number;
  raw_llm: string;
  fallback_mode: boolean;
}

// ─── Axios instance ───────────────────────────────────────────────────────────
// Production: VITE_API_URL is set on Vercel (e.g. https://your-app.up.railway.app)
// Development: falls back to /api which Vite proxies to localhost:8000
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 120000, // 120s — LLM call + parallel FLUX image generation
});

// ─── API call ─────────────────────────────────────────────────────────────────
export const getRecommendations = async (
  request: RecommendRequest
): Promise<RecommendResponse> => {
  const response = await api.post<RecommendResponse>('/recommend', request);
  return response.data;
};

// ─── Image Lazy Loading ───────────────────────────────────────────────────────
export const generateImage = async (image_prompt: string): Promise<string> => {
  try {
    const response = await api.post<{ image_b64: string }>('/recommend/image', { image_prompt });
    return response.data.image_b64;
  } catch (error) {
    console.error("Failed to generate image:", error);
    return "";
  }
};

// ─── SSE Streaming API call ───────────────────────────────────────────────────
export async function* getRecommendationsStream(
  request: RecommendRequest
): AsyncGenerator<any, void, unknown> {
  const baseURL = import.meta.env.VITE_API_URL || '/api';
  const response = await fetch(`${baseURL}/recommend/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    let errorDetail = 'Server Error';
    try {
      const errBody = await response.json();
      if (errBody && errBody.detail) errorDetail = errBody.detail;
    } catch (e) {
      errorDetail = response.statusText || String(response.status);
    }
    const err = new Error(errorDetail) as any;
    err.status = response.status;
    throw err;
  }

  if (!response.body) {
    throw new Error('ReadableStream not supported.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n\n');
    
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const dataStr = line.slice(6);
        if (!dataStr) continue;
        try {
          const data = JSON.parse(dataStr);
          yield data;
        } catch (e) {
          console.error("Failed to parse SSE data:", dataStr);
        }
      }
    }
  }
}

