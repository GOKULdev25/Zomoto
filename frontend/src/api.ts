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
}

// Maps to RecommendResponse in app.py
export interface RecommendResponse {
  notice: string;
  recommendations: RecommendationCard[];
  candidates_count: number;
  raw_llm: string;
  fallback_mode: boolean;
}

// ─── Image Generation Helper ──────────────────────────────────────────────────
// Uses Pollinations.ai — 100% free, no API key, no signup required.
// Keeps prompts short to avoid URL length issues that cause failures.
const hashCode = (str: string): number => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
};

export const getRestaurantImageUrl = (imagePrompt: string, attempt = 0): string => {
  // Keep prompt short — long URLs cause Pollinations to fail
  const shortPrompt = imagePrompt.slice(0, 120);
  const encoded = encodeURIComponent(shortPrompt);
  const seed = hashCode(imagePrompt) + attempt; // unique seed, changes on retry
  return `https://image.pollinations.ai/prompt/${encoded}?width=600&height=400&seed=${seed}&nologo=true`;
};

// ─── Axios instance ───────────────────────────────────────────────────────────
// Production: VITE_API_URL is set on Vercel (e.g. https://your-app.up.railway.app)
// Development: falls back to /api which Vite proxies to localhost:8000
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 60000, // 60s — LLM calls can be slow
});

// ─── API call ─────────────────────────────────────────────────────────────────
export const getRecommendations = async (
  request: RecommendRequest
): Promise<RecommendResponse> => {
  const response = await api.post<RecommendResponse>('/recommend', request);
  return response.data;
};
