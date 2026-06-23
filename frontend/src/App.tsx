import React, { useState } from 'react';
import { ShaderBackground } from './ShaderBackground';
import axios from 'axios';
import { getRecommendations } from './api';
import type { RecommendRequest, RecommendResponse, RecommendationCard } from './api';
import { CustomDropdown } from './components/CustomDropdown';

// ─── Medal colours ─────────────────────────────────────────────────────────────
const MEDAL_STYLES: Record<string, { bg: string; border: string; text: string }> = {
  '1': { bg: 'bg-[#FFD700]/10', border: 'border-[#FFD700]/30', text: 'text-[#FFD700]' },
  '2': { bg: 'bg-[#C0C0C0]/10', border: 'border-[#C0C0C0]/30', text: 'text-[#C0C0C0]' },
  '3': { bg: 'bg-[#CD7F32]/10', border: 'border-[#CD7F32]/30', text: 'text-[#CD7F32]' },
};

// ─── Form Options ────────────────────────────────────────────────────────────
const LOCATION_OPTIONS = [
  'Bangalore', 'Indiranagar', 'Koramangala', 'Whitefield', 
  'Jayanagar', 'Marathahalli', 'BTM', 'HSR', 'Malleshwaram', 'JP Nagar'
].map(loc => ({ value: loc, label: loc }));

const CUISINE_OPTIONS = [
  'Any', 'North Indian', 'South Indian', 'Chinese', 'Italian', 
  'Continental', 'Fast Food', 'Desserts', 'Beverages', 'Japanese', 'Mexican'
].map(c => ({ value: c, label: c }));

const RATING_OPTIONS = [
  { value: 1.0, label: 'Any Rating' },
  { value: 3.0, label: '3.0+ ★' },
  { value: 3.5, label: '3.5+ ★' },
  { value: 4.0, label: '4.0+ ★' },
  { value: 4.5, label: '4.5+ ★' },
  { value: 4.8, label: '4.8+ ★' },
];

// ─── Budget options ────────────────────────────────────────────────────────────
const BUDGET_OPTIONS = [
  { value: 'low',    label: '₹ Budget (< ₹500)' },
  { value: 'medium', label: '₹₹ Mid-range (₹500–1500)' },
  { value: 'high',   label: '₹₹₹ Premium (> ₹1500)' },
];

const App: React.FC = () => {
  // ── Form state ──────────────────────────────────────────────────────────────
  const [location,  setLocation]  = useState('Bangalore');
  const [cuisine,   setCuisine]   = useState('Any');
  const [budget,    setBudget]    = useState('medium');
  const [minRating, setMinRating] = useState(3.5);
  const [extras,    setExtras]    = useState('');

  // ── UI state ─────────────────────────────────────────────────────────────────
  const [loading,   setLoading]   = useState(false);
  const [results,   setResults]   = useState<RecommendResponse | null>(null);
  const [error,     setError]     = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // ── Submit handler ───────────────────────────────────────────────────────────
  const handleSearch = async () => {
    if (!location.trim()) {
      setError('Location is required.');
      return;
    }
    if (minRating < 1 || minRating > 5) {
      setError('Min rating must be between 1.0 and 5.0.');
      return;
    }

    setLoading(true);
    setError(null);
    setResults(null);

    const req: RecommendRequest = {
      location: location,
      budget,
      cuisine: cuisine === 'Any' ? '' : cuisine,
      min_rating: minRating,
      extras: extras.trim(),
    };

    try {
      const data = await getRecommendations(req);
      setResults(data);
      setShowFilters(false);
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        if (!err.response) {
          // EC-S3: network / backend not started
          setError('Cannot connect to the recommendation service. Is the backend running?');
        } else if (err.response.status === 422) {
          // EC-S7: Pydantic validation error
          const detail = err.response.data?.detail;
          const msg = Array.isArray(detail)
            ? detail.map((d: { msg: string }) => d.msg).join(', ')
            : String(detail ?? 'Invalid input.');
          setError(`Validation error: ${msg}`);
        } else if (err.response.status === 404) {
          // EC-F1: no restaurants found
          setError(err.response.data?.detail ?? 'No restaurants found for that location.');
        } else if (err.response.status === 503) {
          // EC-D1 / EC-G1: dataset or API key not available
          setError(err.response.data?.detail ?? 'Server is not ready. Check backend logs.');
        } else {
          setError(err.response.data?.detail ?? `Unexpected error (${err.response.status}).`);
        }
      } else {
        setError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Enter-key support ────────────────────────────────────────────────────────
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !loading && location.trim()) handleSearch();
  };

  // ── Render card ──────────────────────────────────────────────────────────────
  const renderCard = (rec: RecommendationCard, idx: number) => {
    const medal = MEDAL_STYLES[rec.rank] ?? MEDAL_STYLES['3'];
    const stagger = Math.min(idx + 1, 4);

    return (
      <div
        key={idx}
        className={`glass-panel rounded-xl overflow-hidden card-hover transition-all duration-300 animate-stagger-${stagger} relative flex flex-col`}
      >
        {/* Medal badge */}
        <div className={`absolute top-4 left-4 z-20 flex items-center gap-1.5 px-3 py-1 rounded-full border backdrop-blur-md ${medal.bg} ${medal.border}`}>
          <span className={`material-symbols-outlined text-sm ${medal.text}`} style={{ fontVariationSettings: "'FILL' 1" }}>emoji_events</span>
          <span className={`font-label-sm text-label-sm font-bold tracking-wider ${medal.text}`}>RANK {rec.rank}</span>
        </div>

        {/* Image placeholder (gradient) */}
        <div className="h-48 w-full relative overflow-hidden bg-surface-container-highest flex-shrink-0">
          <div className="absolute inset-0 bg-gradient-to-tr from-surface to-surface-variant opacity-50" />
          <div className="absolute inset-0 bg-gradient-to-t from-surface-container to-transparent z-10" />
          {/* Decorative food icon in placeholder */}
          <div className="absolute inset-0 flex items-center justify-center opacity-20 z-0">
            <span className="material-symbols-outlined text-8xl text-primary">restaurant</span>
          </div>
        </div>

        {/* Card content */}
        <div className="p-md flex-grow flex flex-col relative z-20 -mt-8">
          {/* Hallucination warning */}
          {rec.hallucinated && (
            <div className="mb-2 px-2 py-1 rounded bg-error/10 border border-error/30 flex items-center gap-1">
              <span className="material-symbols-outlined text-error text-sm">warning</span>
              <span className="text-xs text-error">Result may need verification</span>
            </div>
          )}

          <h2 className="font-headline-lg text-headline-lg text-on-surface mb-1 drop-shadow-md tracking-tight" title={rec.name}>
            {rec.display_name}
          </h2>
          <p className="font-label-md text-label-md text-primary mb-3">{rec.cuisine}</p>

          {/* Metrics row */}
          <div className="flex flex-wrap gap-2 mb-4">
            <span className="px-2 py-1 bg-surface-container rounded-md font-label-sm text-xs text-on-surface-variant flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">star</span> {rec.rating}
            </span>
            <span className="px-2 py-1 bg-surface-container rounded-md font-label-sm text-xs text-on-surface-variant flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">payments</span> {rec.cost}
            </span>
          </div>

          {/* AI reasoning */}
          <div className="mt-auto p-4 rounded-lg bg-surface-container-low/50 border border-white/5">
            <div className="flex gap-2 items-start">
              <span className="material-symbols-outlined text-secondary mt-0.5 text-[18px]">psychology</span>
              <p className="font-body-md text-sm text-on-surface-variant italic">"{rec.why}"</p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <ShaderBackground />

      {/* ── Top Navbar ─────────────────────────────────────────────────────────── */}
      <header className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-lg border-b border-white/10 shadow-xl">
        <div className="flex justify-between items-center px-gutter h-16 w-full max-w-[1280px] mx-auto">
          <span
            className="font-hero-display text-headline-lg font-extrabold text-primary tracking-tighter cursor-pointer select-none"
            onClick={() => { setResults(null); setError(null); }}
          >
            Zomoto
          </span>
          <div className="flex items-center gap-4">
            {/* API health indicator */}
            <div className="flex items-center gap-1 text-tertiary text-xs">
              <span className="w-2 h-2 rounded-full bg-tertiary inline-block animate-pulse" />
              <span className="hidden md:inline">AI Active</span>
            </div>
          </div>
        </div>
      </header>

      {/* ── Main layout ────────────────────────────────────────────────────────── */}
      <div className="flex pt-16 min-h-screen relative z-10 flex-col md:flex-row">

        {/* Mobile Filter Toggle */}
        <div className="md:hidden sticky top-16 z-30 w-full px-5 py-3 bg-surface/80 backdrop-blur-xl border-b border-white/5 flex justify-between items-center shadow-lg">
          <span className="font-headline-md text-sm font-bold text-on-surface">Find your next meal</span>
          <button 
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-full text-sm font-medium border border-primary/20 transition-all active:scale-95"
          >
            <span className="material-symbols-outlined text-[18px]">tune</span>
            Filters
          </button>
        </div>

        {/* Mobile Overlay */}
        {showFilters && (
          <div 
            className="md:hidden fixed inset-0 bg-black/60 z-30 backdrop-blur-sm transition-opacity"
            onClick={() => setShowFilters(false)}
          />
        )}

        {/* ── Sidebar / Search Form ───────────────────────────────────────────── */}
        <aside className={`flex flex-col p-5 md:p-md gap-xs bg-surface-container-low/95 md:bg-surface-container-low/60 backdrop-blur-xl border-t md:border-b-0 md:border-r border-white/10 w-full md:w-80 md:h-[calc(100vh-64px)] fixed md:sticky bottom-0 md:top-16 z-40 shrink-0 overflow-y-auto transition-transform duration-300 ease-in-out ${showFilters ? 'translate-y-0 h-[85vh] rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.5)]' : 'translate-y-full md:translate-y-0 h-0 md:h-auto'}`}>
          <div className="flex justify-between items-start mb-4 mt-2">
            <div>
              <h2 className="font-headline-md text-headline-md text-primary">Fine Dining Filter</h2>
              <p className="text-on-surface-variant mt-1 flex items-center gap-1 text-sm font-body-md">
                <span className="material-symbols-outlined text-secondary text-sm">auto_awesome</span>
                AI-Powered Discovery
              </p>
            </div>
            <button className="md:hidden p-2 -mr-2 text-on-surface-variant hover:text-on-surface rounded-full bg-white/5" onClick={() => setShowFilters(false)}>
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>

          <div className="flex flex-col gap-md flex-1" onKeyDown={handleKeyDown}>
            {/* Location dropdown */}
            <div className="relative z-40">
              <CustomDropdown
                value={location}
                onChange={(val) => setLocation(val as string)}
                options={LOCATION_OPTIONS}
                placeholder="Search or select location..."
                icon="location_on"
                searchable
              />
            </div>

            {/* Cuisine dropdown */}
            <div className="relative z-30">
              <CustomDropdown
                value={cuisine}
                onChange={(val) => setCuisine(val as string)}
                options={CUISINE_OPTIONS}
                placeholder="Search or select cuisine..."
                icon="restaurant"
                searchable
              />
            </div>

            {/* Budget dropdown */}
            <div className="relative z-20">
              <CustomDropdown
                value={budget}
                onChange={(val) => setBudget(val as string)}
                options={BUDGET_OPTIONS}
                placeholder="Select budget"
                icon="payments"
              />
            </div>

            {/* Min Rating dropdown */}
            <div className="relative z-10 flex flex-col gap-1">
              <div className="flex justify-between items-center px-1">
                <label className="text-sm text-on-surface-variant flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">star</span>
                  Min Rating
                </label>
                <span className="font-label-md text-label-md text-primary font-bold">{minRating.toFixed(1)} ★</span>
              </div>
              <CustomDropdown
                value={minRating}
                onChange={(val) => setMinRating(val as number)}
                options={RATING_OPTIONS}
                placeholder="Select rating"
                icon="star"
              />
              {/* EC-S10: warn when rating is very high */}
              {minRating >= 4.8 && (
                <p className="text-xs text-secondary/80 italic mt-1 ml-1">
                  ⚠️ Very few restaurants have such a high rating.
                </p>
              )}
            </div>

            {/* Extras */}
            <div>
              <textarea
                id="input-extras"
                className="w-full h-24 bg-surface/50 border border-white/10 rounded-xl py-sm px-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all shadow-inner backdrop-blur-md resize-none text-sm"
                placeholder="Extra preferences (romantic, outdoor seating, family-friendly…)"
                value={extras}
                onChange={(e) => setExtras(e.target.value)}
                maxLength={200}
              />
              <p className="text-xs text-on-surface-variant/50 text-right">{extras.length}/200</p>
            </div>
          </div>

          {/* CTA */}
          <button
            id="search-btn"
            onClick={handleSearch}
            disabled={loading || !location.trim()}
            className="w-full bg-[#E23744] hover:bg-[#c02d3a] text-white py-sm rounded-xl font-label-md text-label-md transition-all mt-2 shadow-lg disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]"
          >
            {loading
              ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Finding Tables…</span>
              : '🍽 Find Tables'
            }
          </button>
        </aside>

        {/* ── Main Panel ─────────────────────────────────────────────────────────── */}
        <main className="flex-1 flex flex-col p-5 md:p-lg overflow-y-auto min-h-[calc(100vh-64px)] pb-24 md:pb-lg">

          {/* Loading */}
          {loading && (
            <div className="flex-1 flex flex-col items-center justify-center gap-6 animate-stagger-1">
              <div className="w-20 h-20 relative">
                <div className="absolute inset-0 border-4 border-surface-variant rounded-full" />
                <div className="absolute inset-0 border-4 border-transparent border-t-primary rounded-full animate-spin" />
                <div className="absolute inset-2 border-4 border-transparent border-t-secondary rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '0.8s' }} />
              </div>
              <div className="text-center">
                <h2 className="font-headline-lg text-headline-lg text-on-surface">AI is crafting your recommendations…</h2>
                <p className="text-on-surface-variant text-sm mt-1">Analysing {location} restaurants with Groq LLM</p>
              </div>
            </div>
          )}

          {/* Error state */}
          {!loading && error && (
            <div className="flex-1 flex flex-col items-center justify-center animate-stagger-1">
              <div className="glass-panel rounded-xl p-8 max-w-lg w-full text-center">
                <span className="material-symbols-outlined text-error text-5xl mb-4 block">error_outline</span>
                <h2 className="font-headline-md text-headline-md text-error mb-3">Something went wrong</h2>
                <p className="text-on-surface-variant mb-6">{error}</p>
                <button
                  onClick={() => setError(null)}
                  className="px-6 py-2 bg-surface-container rounded-xl text-on-surface hover:bg-surface-container-high transition-colors text-sm"
                >
                  Try Again
                </button>
              </div>
            </div>
          )}

          {/* Idle / Hero state */}
          {!loading && !results && !error && (
            <div className="flex-1 flex flex-col justify-center items-center gap-8 animate-stagger-1">
              <div className="text-center max-w-2xl">
                <h1 className="font-hero-display text-hero-display-mobile md:text-hero-display text-on-surface mb-sm leading-tight">
                  Your next <span className="gradient-text">great meal</span> is one search away.
                </h1>
                <p className="font-body-lg text-body-lg text-on-surface-variant max-w-lg mx-auto">
                  Discover curated culinary experiences, tailored to your tastes by AI.
                </p>
              </div>

              {/* Preview cards — static fanned display */}
              <div className="relative w-full max-w-2xl h-64 hidden md:flex justify-center items-center">
                <div className="absolute glass-panel rounded-xl w-52 h-64 p-md -rotate-12 -translate-x-40 translate-y-6 shadow-2xl opacity-60 overflow-hidden flex flex-col transition-all duration-500 hover:-translate-x-48 hover:-rotate-6 hover:opacity-100 hover:z-30">
                  <div className="w-full h-24 rounded-lg bg-surface-container-highest mb-sm relative overflow-hidden">
                    <span className="material-symbols-outlined text-5xl text-primary absolute inset-0 flex items-center justify-center opacity-30">restaurant</span>
                  </div>
                  <p className="font-headline-md text-sm font-bold text-on-surface truncate">Toit Brewpub</p>
                  <p className="text-xs text-on-surface-variant truncate">Microbrewery · ⭐ 4.8</p>
                </div>
                
                <div className="absolute glass-panel bg-surface/80 rounded-xl w-60 h-72 p-md z-20 shadow-2xl overflow-hidden flex flex-col border border-primary/30 transition-transform duration-500 hover:-translate-y-2">
                  <div className="absolute top-3 right-3 bg-secondary/20 border border-secondary/50 px-2 py-0.5 rounded-full text-secondary text-[10px] uppercase tracking-wider">Top Match</div>
                  <div className="w-full h-28 rounded-lg bg-surface-container-highest mb-sm relative overflow-hidden">
                    <span className="material-symbols-outlined text-5xl text-secondary absolute inset-0 flex items-center justify-center opacity-30">local_dining</span>
                  </div>
                  <p className="font-headline-md text-lg font-bold text-on-surface truncate mt-1">Truffles</p>
                  <p className="text-xs text-on-surface-variant truncate">American · ⭐ 4.9</p>
                </div>
                
                <div className="absolute glass-panel rounded-xl w-52 h-64 p-md rotate-12 translate-x-40 translate-y-6 shadow-2xl opacity-60 overflow-hidden flex flex-col transition-all duration-500 hover:translate-x-48 hover:rotate-6 hover:opacity-100 hover:z-30">
                  <div className="w-full h-24 rounded-lg bg-surface-container-highest mb-sm relative overflow-hidden">
                    <span className="material-symbols-outlined text-5xl text-primary absolute inset-0 flex items-center justify-center opacity-30">set_meal</span>
                  </div>
                  <p className="font-headline-md text-sm font-bold text-on-surface truncate">Meghana Foods</p>
                  <p className="text-xs text-on-surface-variant truncate">Biryani · ⭐ 4.7</p>
                </div>
              </div>
            </div>
          )}

          {/* Results */}
          {!loading && results && (
            <div className="w-full">
              {/* Header */}
              <div className="mb-lg animate-stagger-1">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-container-low border border-white/5 mb-4">
                  <span className="material-symbols-outlined text-secondary text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
                  <span className="font-label-sm text-label-sm text-secondary tracking-wide uppercase">AI Recommendations Complete</span>
                </div>
                <h1 className="font-hero-display text-hero-display text-on-surface mb-2">Top Selections</h1>

                {/* Filter relaxation notice */}
                {results.notice && (
                  <div className="flex items-start gap-2 mt-2 p-3 rounded-lg bg-secondary/10 border border-secondary/20">
                    <span className="material-symbols-outlined text-secondary text-sm mt-0.5">info</span>
                    <p className="text-sm text-on-surface-variant">{results.notice}</p>
                  </div>
                )}

                {/* Fallback mode — raw LLM text */}
                {results.fallback_mode && (
                  <div className="mt-4 p-4 glass-panel rounded-xl border border-error/20">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="material-symbols-outlined text-error text-sm">warning</span>
                      <span className="text-sm font-semibold text-error">AI output could not be parsed — raw response shown</span>
                    </div>
                    <pre className="text-sm text-on-surface-variant whitespace-pre-wrap font-mono overflow-x-auto">{results.raw_llm}</pre>
                  </div>
                )}
              </div>

              {/* Top 3 recommendation cards */}
              {results.recommendations.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-md mb-xl">
                  {results.recommendations.slice(0, 3).map((rec, idx) => renderCard(rec, idx))}
                </div>
              )}

              {/* No results with non-fallback */}
              {!results.fallback_mode && results.recommendations.length === 0 && (
                <div className="glass-panel rounded-xl p-8 text-center mb-xl">
                  <span className="material-symbols-outlined text-on-surface-variant text-5xl mb-4 block">search_off</span>
                  <h2 className="font-headline-md text-headline-md text-on-surface mb-2">No restaurants found</h2>
                  <p className="text-on-surface-variant">Try relaxing your filters or searching a different area.</p>
                </div>
              )}

              {/* Candidate table accordion */}
              {results.recommendations.length > 3 && (
                <div className="animate-stagger-4 w-full max-w-3xl mb-xl">
                  <details className="group glass-panel rounded-xl overflow-hidden [&_summary::-webkit-details-marker]:hidden">
                    <summary className="flex items-center justify-between p-md cursor-pointer list-none hover:bg-surface-container-highest/30 transition-colors">
                      <div className="flex items-center gap-3">
                        <span className="material-symbols-outlined text-on-surface-variant">format_list_bulleted</span>
                        <span className="font-headline-md text-headline-md text-on-surface">
                          View {results.recommendations.length - 3} more candidates
                        </span>
                      </div>
                      <span className="material-symbols-outlined text-on-surface-variant transition-transform duration-300 group-open:rotate-180">expand_more</span>
                    </summary>
                    <div className="p-md border-t border-white/5 bg-surface-container-lowest/50">
                      <div className="space-y-2">
                        {results.recommendations.slice(3).map((rec, idx) => (
                          <div key={idx} className="flex justify-between items-center py-2 border-b border-white/5 last:border-0">
                            <div>
                              <p className="font-label-md text-label-md text-on-surface">{idx + 4}. {rec.display_name}</p>
                              <p className="font-label-sm text-label-sm text-on-surface-variant mt-0.5">{rec.cuisine}</p>
                            </div>
                            <div className="text-right">
                              <span className="font-label-md text-label-md text-secondary flex items-center justify-end gap-1">
                                <span className="material-symbols-outlined text-[14px]">star</span> {rec.rating}
                              </span>
                              <span className="font-label-sm text-xs text-on-surface-variant">{rec.cost}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </details>
                </div>
              )}

              {/* Debug info (candidates count) */}
              <p className="text-xs text-on-surface-variant/40 text-center mt-4">
                {results.candidates_count} candidates evaluated by AI
              </p>
            </div>
          )}
        </main>
      </div>
    </>
  );
};

export default App;
