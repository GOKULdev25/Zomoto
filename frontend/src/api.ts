import axios from 'axios';

// ─── Request Types ─────────────────────────────────────────────────────────────
export interface RecommendRequest {
  location: string;
  budget: string;           // "low" | "medium" | "high" — required by backend
  cuisine: string;
  min_rating: number;       // backend field name is min_rating, not rating
  extras: string;
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
  timeout: 60000, // 60s — LLM calls can be slow
});

// ─── API call ─────────────────────────────────────────────────────────────────
export const getRecommendations = async (
  request: RecommendRequest
): Promise<RecommendResponse> => {
  const response = await api.post<RecommendResponse>('/recommend', request);
  return response.data;
};
