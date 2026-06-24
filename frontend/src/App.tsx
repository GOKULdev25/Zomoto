import React, { useState, useCallback, useEffect } from 'react';
import { ShaderBackground } from './ShaderBackground';
import axios from 'axios';
import { getRecommendations } from './api';
import type { RecommendRequest, RecommendResponse, RecommendationCard } from './api';
import { CustomDropdown } from './components/CustomDropdown';
import { MultiSelectDropdown } from './components/MultiSelectDropdown';
import { motion, AnimatePresence } from 'framer-motion';

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
  'North Indian', 'South Indian', 'Chinese', 'Italian',
  'Continental', 'Fast Food', 'Desserts', 'Beverages',
  'Japanese', 'Mexican', 'Biryani', 'Cafe', 'Street Food'
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
  { value: 'low',    label: 'Under 150rs' },
  { value: 'medium', label: '150 to 300rs' },
  { value: 'high',   label: 'Above 300rs' },
];

const App: React.FC = () => {
  const [isDarkMode, setIsDarkMode] = useState(true);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // ── Form state ──────────────────────────────────────────────────────────────
  const [locations,      setLocations]      = useState<string[]>(['Bangalore']);
  const [cuisines,       setCuisines]       = useState<string[]>([]);
  const [foodPreference, setFoodPreference] = useState('');
  const [budget,         setBudget]         = useState('medium');
  const [minRating,      setMinRating]      = useState(3.5);
  const [topN,           setTopN]           = useState(3);

  // ── UI state ─────────────────────────────────────────────────────────────────
  const [loading,        setLoading]        = useState(false);
  const [results,        setResults]        = useState<RecommendResponse | null>(null);
  const [error,          setError]          = useState<string | null>(null);
  const [mobileDrawer,   setMobileDrawer]   = useState(false);

  // ── Search execution ─────────────────────────────────────────────────────────
  const executeSearch = useCallback(async (req: RecommendRequest) => {
    setLoading(true);
    setError(null);
    setResults(null);
    setMobileDrawer(false);

    try {
      const data = await getRecommendations(req);
      setResults(data);
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        if (!err.response) {
          setError('Cannot connect to the recommendation service. Is the backend running?');
        } else if (err.response.status === 422) {
          const detail = err.response.data?.detail;
          const msg = Array.isArray(detail)
            ? detail.map((d: { msg: string }) => d.msg).join(', ')
            : String(detail ?? 'Invalid input.');
          setError(`Validation error: ${msg}`);
        } else if (err.response.status === 404) {
          setError(err.response.data?.detail ?? 'No restaurants found for that location.');
        } else if (err.response.status === 503) {
          setError(err.response.data?.detail ?? 'Server is not ready. Check backend logs.');
        } else {
          setError(`Server error: ${err.response.status}`);
        }
      } else {
        setError(`Unexpected error: ${String(err)}`);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Submit handlers ──────────────────────────────────────────────────────────
  const handleSearch = useCallback(() => {
    if (locations.length === 0) {
      setError('At least one location is required.');
      return;
    }

    const locationStr = locations.join(', ');
    const cuisineStr = cuisines.join(', ');

    const req: RecommendRequest = {
      location: locationStr,
      budget,
      cuisine: cuisineStr,
      min_rating: minRating,
      extras: foodPreference.trim(),
      top_n: topN,
    };

    executeSearch(req);
  }, [locations, cuisines, budget, foodPreference, minRating, topN, executeSearch]);

  const handleSurpriseMe = useCallback(() => {
    if (locations.length === 0) {
      setError('At least one location is required.');
      return;
    }

    const locationStr = locations.join(', ');
    const cuisineStr = cuisines.join(', ');
    const thought = foodPreference.trim();

    const req: RecommendRequest = {
      location: locationStr,
      budget,
      cuisine: cuisineStr,
      min_rating: 1.0, // relax rating for surprise
      extras: thought
        ? `surprise me with diverse options, user wants: ${thought}`
        : 'surprise me with diverse and unique restaurant picks',
      top_n: topN,
    };

    executeSearch(req);
  }, [locations, cuisines, budget, foodPreference, topN, executeSearch]);



  // ── Enter-key support ────────────────────────────────────────────────────────
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !loading && locations.length > 0) handleSearch();
  };

  // ── Render card ──────────────────────────────────────────────────────────────
  const renderCard = (rec: RecommendationCard, idx: number) => {
    const medal = MEDAL_STYLES[rec.rank] ?? MEDAL_STYLES['3'];

    return (
      <motion.div
        key={idx}
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: idx * 0.1, ease: [0.16, 1, 0.3, 1] }}
        className={`glass-panel rounded-xl overflow-hidden card-hover transition-all duration-300 relative flex flex-col`}
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
          <div className="mt-auto p-4 rounded-lg bg-surface-container-low border border-outline-variant/20">
            <div className="flex gap-2 items-start">
              <span className="material-symbols-outlined text-secondary mt-0.5 text-[18px]">psychology</span>
              <p className="font-body-md text-sm text-on-surface-variant italic">"{rec.why}"</p>
            </div>
          </div>
        </div>
      </motion.div>
    );
  };

  // ═══════════════════════════════════════════════════════════════════════════════
  // FILTER SIDEBAR CONTENT (shared between desktop sidebar and mobile drawer)
  // ═══════════════════════════════════════════════════════════════════════════════
  const filterContent = (
    <div className="flex flex-col h-full" onKeyDown={handleKeyDown}>
      {/* ── Sidebar header ─────────────────────────────────────────────── */}
      <div className="px-5 pt-6 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <span
              className="font-hero-display text-headline-lg font-extrabold text-primary tracking-tighter cursor-pointer select-none"
              onClick={() => { setResults(null); setError(null); }}
            >
              Zomoto
            </span>
            <p className="text-on-surface-variant mt-0.5 flex items-center gap-1 text-xs font-body-md">
              <span className="material-symbols-outlined text-secondary text-xs">auto_awesome</span>
              AI-Powered Discovery
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Theme Toggle Button */}
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="flex items-center justify-center w-8 h-8 rounded-lg bg-surface-container hover:bg-surface-container-high transition-colors cursor-pointer text-on-surface-variant"
              aria-label="Toggle theme"
            >
              <span className="material-symbols-outlined text-lg">
                {isDarkMode ? 'light_mode' : 'dark_mode'}
              </span>
            </button>
            {/* Mobile close button */}
            <button
              className="lg:hidden flex items-center justify-center w-8 h-8 rounded-lg bg-surface-container hover:bg-surface-container-high transition-colors cursor-pointer"
              onClick={() => setMobileDrawer(false)}
              aria-label="Close filters"
            >
              <span className="material-symbols-outlined text-on-surface-variant text-lg">close</span>
            </button>
          </div>
        </div>

      </div>

      <div className="filter-divider mx-5" />

      {/* ── Scrollable filter body ─────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

        {/* ── What do you feel like eating? ───────────────────────────── */}
        <div>
          <label className="text-sm text-on-surface-variant flex items-center gap-1.5 mb-2 font-medium">
            <span className="material-symbols-outlined text-sm text-primary">restaurant_menu</span>
            What do you feel like eating?
          </label>
          <textarea
            id="input-food-preference"
            className="w-full h-24 bg-surface-container border border-outline-variant/30 rounded-xl py-sm px-sm text-on-surface placeholder:text-[rgba(var(--color-on-surface-rgb),0.5)] focus:outline-none focus:border-primary focus:ring-1 focus:ring-[rgba(var(--color-primary-rgb),0.3)] transition-all shadow-inner backdrop-blur-md resize-none text-sm"
            placeholder="Tell us your thoughts... e.g. I want something spicy and cheesy, maybe with outdoor seating, family-friendly place..."
            value={foodPreference}
            onChange={(e) => setFoodPreference(e.target.value)}
            maxLength={300}
          />
          <p className="text-xs text-[rgba(var(--color-on-surface-rgb),0.5)] text-right mt-0.5">{foodPreference.length}/300</p>
        </div>

        <div className="filter-divider" />

        {/* ── Location (multi-select) ─────────────────────────────────── */}
        <div>
          <label className="text-sm text-on-surface-variant flex items-center gap-1.5 mb-2 font-medium">
            <span className="material-symbols-outlined text-sm text-primary">location_on</span>
            Location
          </label>
          <div className="relative z-40">
            <MultiSelectDropdown
              values={locations}
              onChange={setLocations}
              options={LOCATION_OPTIONS}
              placeholder="Select locations..."
              searchable
            />
          </div>
        </div>

        {/* ── Cuisine (multi-select) ──────────────────────────────────── */}
        <div>
          <label className="text-sm text-on-surface-variant flex items-center gap-1.5 mb-2 font-medium">
            <span className="material-symbols-outlined text-sm text-primary">restaurant</span>
            Cuisine
          </label>
          <div className="relative z-30">
            <MultiSelectDropdown
              values={cuisines}
              onChange={setCuisines}
              options={CUISINE_OPTIONS}
              placeholder="Select cuisines..."
              searchable
            />
          </div>
        </div>

        {/* ── Budget & Rating — side by side ───────────────────────────── */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm text-on-surface-variant flex items-center gap-1.5 mb-2 font-medium">
              <span className="material-symbols-outlined text-sm text-primary">payments</span>
              Budget
            </label>
            <div className="relative z-20">
              <CustomDropdown
                value={budget}
                onChange={(val) => setBudget(val as string)}
                options={BUDGET_OPTIONS}
                placeholder="Select budget"
              />
            </div>
          </div>
          <div>
            <label className="text-sm text-on-surface-variant flex items-center gap-1.5 mb-2 font-medium">
              <span className="material-symbols-outlined text-sm text-primary">star</span>
              Min Rating
            </label>
            <div className="relative z-10">
              <CustomDropdown
                value={minRating}
                onChange={(val) => setMinRating(val as number)}
                options={RATING_OPTIONS}
                placeholder="Select rating"
              />
            </div>
            {minRating >= 4.8 && (
              <p className="text-xs text-secondary/80 italic mt-1">
                Very few restaurants have 4.8+ rating.
              </p>
            )}
          </div>
        </div>

        <div className="filter-divider" />

        {/* ── How many restaurants? ────────────────────────────────────── */}
        <div>
          <label className="text-sm text-on-surface-variant flex items-center gap-1.5 mb-3 font-medium">
            <span className="material-symbols-outlined text-sm text-primary">format_list_numbered</span>
            How many restaurants?
          </label>
          <div className="flex items-center justify-center gap-4">
            <button
              type="button"
              className="stepper-btn"
              onClick={() => setTopN(n => Math.max(1, n - 1))}
              disabled={topN <= 1}
              aria-label="Decrease count"
            >
              <span className="material-symbols-outlined text-lg">remove</span>
            </button>
            <div className="stepper-value">{topN}</div>
            <button
              type="button"
              className="stepper-btn"
              onClick={() => setTopN(n => Math.min(10, n + 1))}
              disabled={topN >= 10}
              aria-label="Increase count"
            >
              <span className="material-symbols-outlined text-lg">add</span>
            </button>
          </div>
          <p className="text-xs text-[rgba(var(--color-on-surface-rgb),0.5)] text-center mt-2">
            {topN === 1 ? '1 restaurant' : `${topN} restaurants`} will be recommended
          </p>
        </div>

      </div>

      {/* ── Sticky CTA buttons ─────────────────────────────────────────── */}
      <div className="px-5 pb-5 pt-3 space-y-2 border-t border-outline-variant/20 bg-surface-container-lowest backdrop-blur-md">
        <button
          id="search-btn"
          onClick={handleSearch}
          disabled={loading || locations.length === 0}
          className="w-full bg-[#E23744] hover:bg-[#c02d3a] text-white py-3 rounded-xl font-label-md text-label-md transition-all shadow-lg disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
        >
          {loading ? (
            <span className="material-symbols-outlined animate-spin">sync</span>
          ) : (
            <span className="material-symbols-outlined">search</span>
          )}
          Find {topN} {topN === 1 ? 'Restaurant' : 'Restaurants'}
        </button>

        <button
          id="surprise-btn"
          onClick={handleSurpriseMe}
          disabled={loading || locations.length === 0}
          className="surprise-btn w-full bg-gradient-to-r from-[#B83900] to-[#E23744] hover:from-[#a03200] hover:to-[#c02d3a] text-white py-3 rounded-xl font-label-md text-label-md transition-all shadow-lg disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
        >
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
          Surprise Me
        </button>
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════════
  return (
    <>
      <ShaderBackground />

      {/* ── Mobile top bar (only on small screens) ─────────────────────────── */}
      <header className="lg:hidden fixed top-0 w-full z-50 bg-background backdrop-blur-lg border-b border-outline-variant/30 shadow-xl">
        <div className="flex justify-between items-center px-gutter h-14 w-full">
          <span
            className="font-hero-display text-headline-lg font-extrabold text-primary tracking-tighter cursor-pointer select-none text-xl"
            onClick={() => { setResults(null); setError(null); }}
          >
            Zomoto
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="flex items-center justify-center w-8 h-8 rounded-lg bg-surface-container hover:bg-surface-container-high transition-colors cursor-pointer text-on-surface-variant"
              aria-label="Toggle theme"
            >
              <span className="material-symbols-outlined text-lg">
                {isDarkMode ? 'light_mode' : 'dark_mode'}
              </span>
            </button>
            <button
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high transition-colors cursor-pointer"
              onClick={() => setMobileDrawer(true)}
              aria-label="Open filters"
            >
              <span className="material-symbols-outlined text-primary text-lg">tune</span>
              <span className="text-xs text-on-surface-variant font-medium">Filters</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── Split-panel layout ─────────────────────────────────────────────── */}
      <div className="flex min-h-screen relative z-10">

        {/* ── Left sidebar (desktop) ───────────────────────────────────────── */}
        <aside className="hidden lg:flex lg:flex-col lg:w-[380px] lg:flex-shrink-0 filter-sidebar fixed top-0 left-0 h-screen z-30">
          {filterContent}
        </aside>

        {/* ── Mobile drawer ────────────────────────────────────────────────── */}
        <AnimatePresence>
          {mobileDrawer && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="drawer-overlay lg:hidden"
                onClick={() => setMobileDrawer(false)}
              />
              <motion.aside
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                className="fixed top-0 left-0 w-[340px] max-w-[85vw] h-screen filter-sidebar z-50 shadow-2xl lg:hidden"
              >
                {filterContent}
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        {/* ── Right main panel ─────────────────────────────────────────────── */}
        <main className="flex-1 lg:ml-[380px] pt-14 lg:pt-0 min-h-screen flex flex-col">

          {/* ── Idle state — Hero ───────────────────────────────────────────── */}
          {!loading && !results && !error && (
            <div className="flex-1 flex flex-col justify-center items-center gap-8 animate-stagger-1 px-5 py-12">
              {/* Hero text */}
              <div className="text-center max-w-2xl">
                <h1 className="font-hero-display text-hero-display-mobile md:text-hero-display text-on-surface mb-sm leading-tight">
                  Your next <span className="gradient-text">great meal</span> is one search away.
                </h1>
                <p className="font-body-lg text-body-lg text-on-surface-variant max-w-lg mx-auto">
                  Discover curated culinary experiences, tailored to your tastes by AI.
                </p>
              </div>

              {/* Preview cards — fanned display */}
              <div className="relative w-full max-w-2xl h-64 hidden md:flex justify-center items-center">
                <div className="absolute glass-panel rounded-xl w-52 h-64 p-md -rotate-12 -translate-x-40 translate-y-6 shadow-2xl opacity-60 overflow-hidden flex flex-col transition-all duration-500 hover:-translate-x-48 hover:-rotate-6 hover:opacity-100 hover:z-30">
                  <div className="w-full h-24 rounded-lg bg-surface-container-highest mb-sm relative overflow-hidden">
                    <span className="material-symbols-outlined text-5xl text-primary absolute inset-0 flex items-center justify-center opacity-30">restaurant</span>
                  </div>
                  <p className="font-headline-md text-sm font-bold text-on-surface truncate">Toit Brewpub</p>
                  <p className="text-xs text-on-surface-variant truncate">Microbrewery · 4.8 ★</p>
                </div>
                
                <div className="absolute glass-panel bg-surface-container rounded-xl w-60 h-72 p-md z-20 shadow-2xl overflow-hidden flex flex-col border border-primary/30 transition-transform duration-500 hover:-translate-y-2">
                  <div className="absolute top-3 right-3 bg-secondary/20 border border-secondary/50 px-2 py-0.5 rounded-full text-secondary text-[10px] uppercase tracking-wider">Top Match</div>
                  <div className="w-full h-28 rounded-lg bg-surface-container-highest mb-sm relative overflow-hidden">
                    <span className="material-symbols-outlined text-5xl text-secondary absolute inset-0 flex items-center justify-center opacity-30">local_dining</span>
                  </div>
                  <p className="font-headline-md text-lg font-bold text-on-surface truncate mt-1">Truffles</p>
                  <p className="text-xs text-on-surface-variant truncate">American · 4.9 ★</p>
                </div>
                
                <div className="absolute glass-panel rounded-xl w-52 h-64 p-md rotate-12 translate-x-40 translate-y-6 shadow-2xl opacity-60 overflow-hidden flex flex-col transition-all duration-500 hover:translate-x-48 hover:rotate-6 hover:opacity-100 hover:z-30">
                  <div className="w-full h-24 rounded-lg bg-surface-container-highest mb-sm relative overflow-hidden">
                    <span className="material-symbols-outlined text-5xl text-primary absolute inset-0 flex items-center justify-center opacity-30">set_meal</span>
                  </div>
                  <p className="font-headline-md text-sm font-bold text-on-surface truncate">Meghana Foods</p>
                  <p className="text-xs text-on-surface-variant truncate">Biryani · 4.7 ★</p>
                </div>
              </div>

              {/* Mobile hint to open filter */}
              <div className="lg:hidden flex items-center gap-2 text-on-surface-variant text-sm">
                <span className="material-symbols-outlined text-primary">touch_app</span>
                Tap <strong className="text-primary">Filters</strong> to start your search
              </div>
            </div>
          )}

          {/* ── Loading ────────────────────────────────────────────────────── */}
          {loading && (
            <div className="flex-1 flex flex-col items-center justify-center gap-6 animate-stagger-1 px-5">
              <div className="w-20 h-20 relative">
                <div className="absolute inset-0 border-4 border-surface-variant rounded-full" />
                <div className="absolute inset-0 border-4 border-transparent border-t-primary rounded-full animate-spin" />
                <div className="absolute inset-2 border-4 border-transparent border-t-secondary rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '0.8s' }} />
              </div>
              <div className="text-center">
                <h2 className="font-headline-lg text-headline-lg text-on-surface">AI is crafting your recommendations…</h2>
                <p className="text-on-surface-variant text-sm mt-1">Analysing {locations.join(', ')} restaurants with Zot AI</p>
              </div>
            </div>
          )}

          {/* ── Error state ────────────────────────────────────────────────── */}
          {!loading && error && (
            <div className="flex-1 flex flex-col items-center justify-center animate-stagger-1 px-5">
              <div className="glass-panel rounded-xl p-8 max-w-lg w-full text-center">
                <span className="material-symbols-outlined text-error text-5xl mb-4 block">error_outline</span>
                <h2 className="font-headline-md text-headline-md text-error mb-3">Something went wrong</h2>
                <p className="text-on-surface-variant mb-6">{error}</p>
                <button
                  onClick={() => { setError(null); }}
                  className="px-6 py-2 bg-surface-container rounded-xl text-on-surface hover:bg-surface-container-high transition-colors text-sm cursor-pointer"
                >
                  Try Again
                </button>
              </div>
            </div>
          )}

          {/* ── Results ────────────────────────────────────────────────────── */}
          {!loading && results && (
            <div className="w-full max-w-6xl mx-auto px-5 md:px-8 py-8">

              {/* Results header */}
              <div className="mb-lg animate-stagger-1">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-container-low border border-outline-variant/20 mb-4">
                  <span className="material-symbols-outlined text-secondary text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
                  <span className="font-label-sm text-label-sm text-secondary tracking-wide uppercase">AI Recommendations Complete</span>
                </div>
                <h1 className="font-hero-display text-hero-display-mobile md:text-hero-display text-on-surface mb-2">
                  Top {results.recommendations.length} Selections
                </h1>

                {results.notice && (
                  <div className="flex items-start gap-2 mt-2 p-3 rounded-lg bg-secondary/10 border border-secondary/20">
                    <span className="material-symbols-outlined text-secondary text-sm mt-0.5">info</span>
                    <p className="text-sm text-on-surface-variant">{results.notice}</p>
                  </div>
                )}

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

              {/* Recommendation cards — dynamic grid based on topN */}
              {results.recommendations.length > 0 && (
                <div className={`grid gap-md mb-xl ${
                  results.recommendations.length === 1
                    ? 'grid-cols-1 max-w-md mx-auto'
                    : results.recommendations.length === 2
                    ? 'grid-cols-1 md:grid-cols-2 max-w-3xl mx-auto'
                    : results.recommendations.length <= 3
                    ? 'grid-cols-1 md:grid-cols-3'
                    : results.recommendations.length === 4
                    ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'
                    : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
                }`}>
                  {results.recommendations.map((rec, idx) => renderCard(rec, idx))}
                </div>
              )}

              {/* No results */}
              {!results.fallback_mode && results.recommendations.length === 0 && (
                <div className="glass-panel rounded-xl p-8 text-center mb-xl">
                  <span className="material-symbols-outlined text-on-surface-variant text-5xl mb-4 block">search_off</span>
                  <h2 className="font-headline-md text-headline-md text-on-surface mb-2">No restaurants found</h2>
                  <p className="text-on-surface-variant">Try relaxing your filters or searching a different area.</p>
                </div>
              )}



              {/* Back to search button */}
              <div className="flex justify-center mt-8">
                <button
                  onClick={() => { setResults(null); }}
                  className="px-6 py-2.5 bg-surface-container hover:bg-surface-container-high rounded-xl text-on-surface transition-colors text-sm flex items-center gap-2 border border-outline-variant/20 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                  New Search
                </button>
              </div>
            </div>
          )}
        </main>
      </div>
    </>
  );
};

export default App;
