# Architecture: AI-Powered Restaurant Recommendation System
### Zomoto Project | Groq LLM (Free Tier) | v1.0

---

## 1. Architecture Overview

This system follows a **RAG-lite (Retrieval-Augmented Generation)** pattern — structured restaurant data is retrieved and filtered locally, then injected into a Groq LLM prompt for reasoning and ranked output. No vector database is required.

```
┌──────────────────────────────────────────────────────────────────────┐
│                        ZOMOTO SYSTEM                                  │
│                                                                        │
│  ┌─────────────┐    ┌──────────────┐    ┌──────────────────────────┐  │
│  │  HuggingFace│───▶│  Data Layer  │    │      Presentation Layer  │  │
│  │   Dataset   │    │  (Pandas)    │    │   (Streamlit / CLI)      │  │
│  └─────────────┘    └──────┬───────┘    └────────────▲─────────────┘  │
│                             │                         │                │
│                      ┌──────▼───────┐    ┌───────────┴──────────────┐  │
│                      │ Filter Engine│───▶│    Output Formatter      │  │
│                      └──────┬───────┘    └───────────▲──────────────┘  │
│                             │                         │                │
│                      ┌──────▼───────┐    ┌───────────┴──────────────┐  │
│                      │   Prompt     │───▶│   Groq LLM API           │  │
│                      │   Builder    │    │  (llama-3.3-70b-versatile)│  │
│                      └──────────────┘    └──────────────────────────┘  │
│                                                                        │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │                     User Input Layer                             │  │
│  │         location | budget | cuisine | min_rating | extras        │  │
│  └─────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 2. Architecture Style

| Attribute | Decision |
|-----------|----------|
| Pattern | RAG-lite (Filter → Prompt → LLM) |
| LLM Provider | **Groq Cloud (Free Tier)** |
| LLM Model | `llama-3.3-70b-versatile` (recommended) |
| Data Store | In-memory Pandas DataFrame (no DB) |
| API Layer | Direct Groq SDK calls (`groq` Python package) |
| UI | Streamlit (Web) or CLI |
| Language | Python 3.10+ |

---

## 3. Component Architecture

### 3.1 Data Layer

```
HuggingFace Dataset
        │
        ▼
┌─────────────────────────┐
│      data_loader.py      │
│                          │
│  load_dataset()          │  ← loads from HuggingFace hub
│  normalize_columns()     │  ← snake_case, strip whitespace
│  clean_ratings()         │  ← "4.1/5" → 4.1, "NEW"/"-" → NaN
│  map_budget_tier()       │  ← "Low"→₹0-500, "Med"→₹500-1500
│  cache_dataframe()       │  ← stored in memory for session
└─────────────────────────┘
        │
        ▼
   In-Memory DataFrame (Pandas)
   [name | location | cuisines | cost | rating | votes | type]
```

**Key transformations:**
- Rating normalization: `"4.1/5"` → `4.1` | `"NEW"` / `"-"` → `NaN` → dropped or treated as unrated
- Cost normalization: remove commas, cast to int → map to budget tier
- Cuisine explosion: `"North Indian, Chinese"` → treated as multi-label (filter with `str.contains`)
- Location: case-insensitive match

---

### 3.2 User Input Layer

```
┌──────────────────────────────────────────────────┐
│                user_input.py                      │
│                                                   │
│  UserPreferences(dataclass)                       │
│  ├── location:   str       (e.g., "Bangalore")    │
│  ├── budget:     str       ("low"/"medium"/"high")│
│  ├── cuisine:    str       (e.g., "Italian")      │
│  ├── min_rating: float     (e.g., 4.0)            │
│  └── extras:     str       (e.g., "rooftop seating")│
│                                                   │
│  validate_input()   ← checks non-empty, valid range│
└──────────────────────────────────────────────────┘
```

**Budget → Cost Range Mapping:**

| Budget Tier | Cost Range (₹ for two) |
|-------------|------------------------|
| `low` | ₹0 – ₹500 |
| `medium` | ₹501 – ₹1,500 |
| `high` | ₹1,501+ |

---

### 3.3 Filter Engine

```
┌──────────────────────────────────────────────────┐
│               filter_engine.py                    │
│                                                   │
│  filter_restaurants(df, prefs) → filtered_df      │
│                                                   │
│  Step 1: Filter by location  (case-insensitive)   │
│  Step 2: Filter by cuisine   (str.contains)       │
│  Step 3: Filter by cost range (budget mapping)    │
│  Step 4: Filter by min_rating                     │
│  Step 5: Sort by rating DESC, votes DESC          │
│  Step 6: Return top N=15 candidates               │
│                                                   │
│  fallback_relax():                                │
│    if results < 3 → drop cuisine filter           │
│    if results < 3 → drop budget filter            │
│    if results < 3 → notify user, show best effort │
└──────────────────────────────────────────────────┘
```

**Filter Priority Order (strict → relaxed):**
```
location (always required)
    ↓
cuisine (relaxed first if sparse)
    ↓
budget tier (relaxed second)
    ↓
min_rating (clamped down to 3.0 minimum)
```

---

### 3.4 Prompt Builder

```
┌──────────────────────────────────────────────────┐
│              prompt_builder.py                    │
│                                                   │
│  build_prompt(prefs, candidates) → str            │
│                                                   │
│  Structure:                                       │
│  ├── SYSTEM message  → role + strict instructions │
│  └── USER message    → preferences + candidates   │
└──────────────────────────────────────────────────┘
```

**System Prompt Template:**
```
You are an expert restaurant recommendation assistant.
You will receive a list of real restaurants with their actual data.
Your task is to rank the TOP 3 restaurants from the provided list ONLY.
Do NOT invent, add, or assume any restaurant details not given to you.
Always explain WHY each restaurant matches the user's preferences.
Format your response exactly as specified.
```

**User Prompt Template:**
```
USER PREFERENCES:
- Location    : {location}
- Budget      : {budget} (approx ₹{cost_range} for two)
- Cuisine     : {cuisine}
- Min Rating  : {min_rating} / 5
- Extra Needs : {extras}

CANDIDATE RESTAURANTS (filtered from dataset):
{candidate_table}

TASK:
Rank the top 3 restaurants from the list above.
For each, provide:
  - Rank, Name, Cuisine, Rating, Est. Cost
  - A 2-3 sentence explanation of why it suits this user.
```

**Candidate Table Format (passed to LLM):**
```
#  | Name              | Cuisine       | Rating | Cost(₹) | Votes | Type
---|-------------------|---------------|--------|---------|-------|--------
1  | Truffles          | American      | 4.7    | 600     | 14234 | Dine-out
2  | Meghana Foods     | Biryani       | 4.5    | 300     | 10982 | Dine-out
...
```

**Token Budget Control:**
- Max 15 candidates passed → approx ~600 tokens for candidate table
- System prompt → ~120 tokens
- User preferences → ~80 tokens
- Total input ≈ ~800 tokens (well within Groq free tier 6,000 TPM limit)

---

### 3.5 Groq LLM Integration Layer

```
┌──────────────────────────────────────────────────┐
│               groq_client.py                      │
│                                                   │
│  Model     : llama-3.3-70b-versatile              │
│  Fallback  : llama3-8b-8192 (if rate limited)     │
│                                                   │
│  get_recommendation(prompt) → str                 │
│  ├── groq.Groq(api_key=GROQ_API_KEY)              │
│  ├── chat.completions.create(...)                 │
│  ├── temperature=0.3  (consistent output)         │
│  ├── max_tokens=1024                              │
│  └── retry on 429 with exponential backoff        │
│                                                   │
│  Rate Limit Handling:                             │
│  ├── RPM: 30 req/min → max 1 req per 2s           │
│  ├── TPM: 6,000 tok/min → capped by prompt design │
│  └── RPD: 14,400 req/day                          │
└──────────────────────────────────────────────────┘
```

**Groq Free Tier Limits:**

| Limit | Value | Our Strategy |
|-------|-------|--------------|
| Requests/min | 30 | 1 call per user query — well within limit |
| Tokens/min | 6,000 | Prompt capped at ~800 in + ~400 out = ~1,200 |
| Requests/day | 14,400 | No concern for prototype/dev use |

**Retry Strategy:**
```python
# Exponential backoff on 429
for attempt in range(3):
    try:
        response = client.chat.completions.create(...)
        break
    except groq.RateLimitError:
        time.sleep(2 ** attempt)  # 1s, 2s, 4s
```

---

### 3.6 Output Formatter

```
┌──────────────────────────────────────────────────┐
│             output_formatter.py                   │
│                                                   │
│  format_output(llm_response, prefs) → display     │
│                                                   │
│  Parses LLM response and renders:                 │
│  ┌─────────────────────────────────────────────┐  │
│  │  🏆 #1 — Truffles                           │  │
│  │  Cuisine : American, Continental             │  │
│  │  Rating  : ⭐ 4.7 / 5                       │  │
│  │  Cost    : ₹600 for two                     │  │
│  │  💬 Why? Perfect match for your medium      │  │
│  │     budget with top ratings in Koramangala. │  │
│  └─────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────┘
```

---

### 3.7 Presentation Layer (Streamlit UI)

```
┌──────────────────────────────────────────────────┐
│                   app.py (Streamlit)              │
│                                                   │
│  Page: "🍽️ Zomoto — AI Restaurant Finder"        │
│  ├── Sidebar: User Preference Form                │
│  │   ├── Location    (text input)                 │
│  │   ├── Cuisine     (dropdown / text)            │
│  │   ├── Budget      (selectbox: Low/Med/High)    │
│  │   ├── Min Rating  (slider: 1.0 – 5.0)          │
│  │   └── Extras      (text area)                  │
│  │                                                │
│  ├── Main Panel: Results                          │
│  │   ├── Spinner: "Finding best restaurants..."   │
│  │   ├── Recommendation Cards (×3)               │
│  │   └── Raw candidates table (expandable)       │
│  └── Footer: powered by Groq + HuggingFace        │
└──────────────────────────────────────────────────┘
```

---

## 4. Project File Structure

```
zomoto/
│
├── app.py                   # Streamlit entry point
├── .env                     # GROQ_API_KEY (never commit)
├── requirements.txt
│
├── src/
│   ├── __init__.py
│   ├── data_loader.py       # HuggingFace dataset loading + preprocessing
│   ├── user_input.py        # UserPreferences dataclass + validation
│   ├── filter_engine.py     # Dataset filtering + fallback relaxation
│   ├── prompt_builder.py    # LLM system + user prompt construction
│   ├── groq_client.py       # Groq API calls + rate limit handling
│   └── output_formatter.py  # Parse + display LLM response
│
├── Docs/
│   ├── Problem Statement.md
│   ├── context.md
│   └── architecture.md      ← this file
│
└── tests/
    ├── test_data_loader.py
    ├── test_filter_engine.py
    └── test_prompt_builder.py
```

---

## 5. Data Flow (Sequence Diagram)

```
User          Streamlit       FilterEngine    PromptBuilder    Groq API
 │                │                │                │              │
 │──preferences──▶│                │                │              │
 │                │──filter(df)───▶│                │              │
 │                │                │──top_15_df────▶│              │
 │                │                │                │──prompt─────▶│
 │                │                │                │              │──LLM reasoning
 │                │                │                │◀─response────│
 │                │◀───────────────formatted output──│              │
 │◀──display cards│                │                │              │
```

---

## 6. Tech Stack Summary

| Component | Technology | Reason |
|-----------|-----------|--------|
| Language | Python 3.10+ | Ecosystem for ML/AI |
| Dataset | HuggingFace `datasets` + `pandas` | Easy load + fast filtering |
| LLM | **Groq Free Tier** (`llama-3.3-70b-versatile`) | Free, ultra-fast inference |
| LLM SDK | `groq` Python package | Official, simple API |
| UI | Streamlit | Rapid prototyping, no frontend needed |
| Config | `python-dotenv` | Secure API key management |
| Testing | `pytest` | Unit tests for each module |

**`requirements.txt`:**
```
datasets
pandas
groq
streamlit
python-dotenv
pytest
```

---

## 7. Environment Configuration

```bash
# .env file (never commit to git)
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Recommended model IDs (Groq Free Tier)
# Primary   : llama-3.3-70b-versatile
# Fallback  : llama3-8b-8192
# Alternative: mixtral-8x7b-32768
```

---

## 8. Key Architectural Decisions

### Decision 1 — No Vector DB
> **Why**: The dataset is small enough (tens of thousands of rows) to filter in-memory with Pandas in milliseconds. Adding a vector DB (Pinecone, Chroma) would over-engineer the solution.

### Decision 2 — Groq over OpenAI
> **Why**: Groq's free tier provides **LPU-powered inference** (extremely low latency ~200ms), access to Llama 3.3 70B, and no credit card required — ideal for prototyping.

### Decision 3 — Filter BEFORE LLM
> **Why**: Passing the full dataset (~50k rows) to the LLM is impossible within token limits. Pre-filtering to top 15 candidates reduces tokens, cost, latency, and hallucination risk.

### Decision 4 — temperature=0.3
> **Why**: Low temperature ensures consistent, structured ranking output. Higher temperature risks creative but inaccurate restaurant descriptions.

### Decision 5 — Progressive Filter Relaxation
> **Why**: Strict 4-filter chains often return zero results. Relaxing cuisine → budget progressively ensures the user always gets some useful output with a transparency message.

---

## 9. Risk & Mitigation

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Groq 429 Rate Limit | Medium | Exponential backoff retry (max 3 attempts) |
| LLM Hallucination | High | Strict system prompt + structured candidate table |
| Sparse filter results | Medium | Progressive filter relaxation + user notification |
| Dirty dataset ratings | Medium | Normalize all ratings at load time, drop nulls |
| API key exposure | High | `.env` + `.gitignore` GROQ_API_KEY |
| Streamlit session state loss | Low | Re-load DataFrame once at startup, cache with `@st.cache_data` |

---

## 10. Future Architecture Enhancements

| Enhancement | How to Add |
|-------------|-----------|
| Semantic search | Add `sentence-transformers` + FAISS for embedding-based retrieval |
| Conversational mode | Add Groq multi-turn chat history in Streamlit `session_state` |
| User feedback | Store ratings in SQLite, feed back as re-ranking signal |
| Map view | Integrate `folium` or `pydeck` with geocoded restaurant locations |
| Batch queries | Use Groq Batch API (Developer Tier) for bulk recommendation jobs |

---

*Architecture designed for Zomoto Project — Groq Free LLM (llama-3.3-70b-versatile) | 2026-06-15*
