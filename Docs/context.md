# Context: AI-Powered Restaurant Recommendation System (Zomato Use Case)

---

## 1. Problem Overview

The task is to build an **AI-powered restaurant recommendation service** inspired by Zomato. The core challenge is to bridge structured tabular data (a real-world restaurant dataset) with the natural language reasoning capability of a Large Language Model (LLM) to produce **personalized, human-readable restaurant recommendations**.

This is fundamentally a **Retrieval-Augmented Generation (RAG)-lite system** — structured data is filtered/retrieved based on user preferences, then passed as context into an LLM prompt to generate ranked, explained recommendations.

---

## 2. Core Objective

> Design and implement a full-stack AI application that takes user preferences, processes a real-world restaurant dataset, leverages an LLM for reasoning, and presents recommendations in a clear, user-friendly format.

### Success Criteria
| Criterion | Description |
|-----------|-------------|
| Input Handling | Correctly captures user preferences (location, budget, cuisine, rating, etc.) |
| Data Utilization | Loads and filters the Zomato HuggingFace dataset accurately |
| LLM Integration | Passes structured context to an LLM and receives ranked, explained output |
| Output Quality | Recommendations are clear, formatted, and contain AI-generated explanations |

---

## 3. System Architecture Breakdown

The system is composed of **5 distinct layers**, each with a specific responsibility:

### Layer 1 — Data Ingestion
- **Source**: [Zomato Restaurant Recommendation Dataset](https://huggingface.co/datasets/ManikaSaini/zomato-restaurant-recommendation) on HuggingFace
- **Action**: Load and preprocess the dataset
- **Key Fields to Extract**:
  - `Restaurant Name`
  - `Location / City`
  - `Cuisine Type`
  - `Approximate Cost` (for two people)
  - `Aggregate Rating`
  - Additional metadata (e.g., online delivery, table booking, votes)

### Layer 2 — User Input Collection
Users provide the following preferences:

| Preference | Type | Example Values |
|------------|------|----------------|
| Location | String | Delhi, Bangalore, Mumbai |
| Budget | Category | Low / Medium / High |
| Cuisine | String | Italian, Chinese, Indian, etc. |
| Minimum Rating | Float | 3.5, 4.0, 4.5 |
| Additional Preferences | Free text | "family-friendly", "quick service", "rooftop" |

### Layer 3 — Integration / Filtering Layer
- **Filter** the dataset based on: location → cuisine → budget range → minimum rating
- **Prepare a structured summary** of filtered results (top N candidates)
- **Construct an LLM prompt** that:
  - Describes user preferences
  - Provides the filtered restaurant data as structured context
  - Instructs the LLM to rank and explain recommendations

### Layer 4 — Recommendation Engine (LLM Core)
- **LLM Tasks**:
  1. Rank filtered restaurants based on how well they match user preferences
  2. Provide a **reason/explanation** for each recommended restaurant
  3. Optionally produce a brief **summary** of the overall recommendation set
- **Design Consideration**: The prompt must be carefully engineered so the LLM reasons over structured data, not hallucinate restaurant details

### Layer 5 — Output Display
Present recommendations in a structured, user-friendly format:

```
Restaurant Name   : <name>
Cuisine           : <cuisine>
Rating            : <X.X / 5>
Estimated Cost    : ₹<cost> for two
AI Explanation    : <why this restaurant fits the user's preferences>
```

---

## 4. Technical Components Required

### 4.1 Data Pipeline
- **Library**: `datasets` (HuggingFace) or `pandas` for loading CSV/parquet
- **Steps**:
  - Load dataset
  - Normalize column names
  - Handle missing values
  - Map budget strings (Low/Medium/High) to cost ranges
  - Build a filter function accepting user parameters

### 4.2 LLM Integration
- **Options**: OpenAI GPT-4/3.5, Google Gemini, Anthropic Claude, or open-source via HuggingFace
- **Approach**: Prompt Engineering (not fine-tuning)
- **Prompt Structure**:
  ```
  System: You are a restaurant recommendation assistant...
  User: 
    Preferences: {location}, {budget}, {cuisine}, {min_rating}, {additional}
    Candidate Restaurants:
    1. {name} | {cuisine} | Rating: {rating} | Cost: {cost}
    2. ...
    Task: Rank and explain the top 3 restaurants for this user.
  ```

### 4.3 User Interface
- **Options**:
  - CLI (simple input/output in terminal)
  - Web UI (Streamlit, Gradio, or custom HTML/JS)
  - API (FastAPI with JSON I/O)

### 4.4 Budget Mapping Logic
| Budget Tier | Approximate Cost Range (₹ for two) |
|-------------|-------------------------------------|
| Low | ₹0 – ₹500 |
| Medium | ₹500 – ₹1500 |
| High | ₹1500+ |

---

## 5. Data Understanding

### Dataset: `ManikaSaini/zomato-restaurant-recommendation` (HuggingFace)
- This is derived from the well-known **Zomato Bangalore/India restaurant dataset**
- Expected columns include:
  - `name` — Restaurant name
  - `location` or `city` — Geographic location
  - `cuisines` — Comma-separated cuisine types
  - `approx_cost(for two people)` — Cost estimate
  - `aggregate rating` or `rate` — Star rating (out of 5)
  - `votes` — Number of user votes
  - `online_order` / `book_table` — Service flags
  - `listed_in(type)` — Dining type (Buffet, Delivery, Dine-out, etc.)

---

## 6. Key Design Decisions & Considerations

### 6.1 Prompt Engineering (Critical)
The quality of recommendations depends heavily on the prompt. Key points:
- Pass **only filtered, relevant data** to the LLM (avoid token bloat)
- Clearly define the ranking task in the prompt
- Instruct the LLM to **not invent** restaurant details — only reason over provided data
- Include user's additional free-text preferences for personalization

### 6.2 Filtering Before LLM
Do **NOT** pass the entire dataset to the LLM. The flow should be:
```
Full Dataset → Filter (location, cuisine, budget, rating) → Top N → LLM → Ranked Output
```
This reduces cost, latency, and hallucination risk.

### 6.3 Handling Sparse Data
- Some location/cuisine combinations may have few or no results after filtering
- Handle gracefully: relax filters progressively (e.g., drop cuisine → drop budget tier) and inform the user

### 6.4 Rating Normalization
- The dataset may have ratings as strings like `"4.1/5"` or `"NEW"` or `"-"`
- Must clean and normalize ratings to floats before filtering

---

## 7. System Workflow (End-to-End)

```
[START]
   │
   ▼
[Data Ingestion]
   Load Zomato dataset from HuggingFace
   Clean & normalize fields
   │
   ▼
[User Input]
   Collect: location, budget, cuisine, min_rating, extras
   │
   ▼
[Filtering Layer]
   Apply filters to dataset
   Select Top N candidate restaurants
   │
   ▼
[Prompt Construction]
   Format user prefs + candidate data into LLM prompt
   │
   ▼
[LLM Call]
   Send prompt to LLM API
   Receive ranked recommendations with explanations
   │
   ▼
[Output Display]
   Format and present results to user
   │
   ▼
[END]
```

---

## 8. Potential Challenges & Mitigations

| Challenge | Mitigation |
|-----------|-----------|
| Dataset inconsistencies (nulls, mixed formats) | Thorough preprocessing + data validation step |
| LLM hallucination of restaurant details | Strict prompt instruction + only pass structured data |
| Too few results after filtering | Progressive filter relaxation logic |
| High LLM API cost for large datasets | Pre-filter aggressively before sending to LLM |
| Budget tier ambiguity | Clearly define cost ranges and map them explicitly |
| Slow response time | Cache dataset in memory; only make one LLM call per query |

---

## 9. Deliverables Expected

Based on the problem statement, the expected deliverables are:

1. **Data Loading & Preprocessing Script** — Loads and cleans the HuggingFace dataset
2. **User Input Module** — Collects and validates user preferences
3. **Filtering Engine** — Filters restaurants based on user inputs
4. **Prompt Template** — Well-engineered LLM prompt for ranking + explanation
5. **LLM Integration** — API call to chosen LLM with response parsing
6. **Output Formatter** — Displays top recommendations in a clean, readable format
7. **(Optional)** Web UI — Streamlit/Gradio interface for non-technical users

---

## 10. Suggested Tech Stack

| Component | Recommended Tool |
|-----------|-----------------|
| Language | Python 3.10+ |
| Dataset Loading | `datasets` (HuggingFace) or `pandas` |
| LLM API | OpenAI / Google Gemini / Anthropic Claude |
| LLM SDK | `openai`, `google-generativeai`, or `anthropic` |
| Prompt Management | LangChain (optional) or raw string templates |
| UI (optional) | Streamlit or Gradio |
| Environment Management | `python-dotenv` for API keys |

---

## 11. Scope Boundaries

### In Scope
- Filtering restaurants from the HuggingFace dataset
- LLM-based ranking and explanation generation
- User preference collection (location, budget, cuisine, rating, extras)
- Formatted output display

### Out of Scope (unless extended)
- Real-time restaurant data (live APIs like Google Places)
- User authentication / session management
- Booking / ordering integration
- Fine-tuning an LLM on restaurant data
- Vector similarity search / embeddings (unless added as enhancement)

---

## 12. Enhancement Opportunities (Future Scope)

- **Embeddings + Vector Search**: Use sentence embeddings to semantically match user preferences to restaurant descriptions (true RAG)
- **Conversational Interface**: Multi-turn chat to refine preferences iteratively
- **Feedback Loop**: Let users rate recommendations to improve future suggestions
- **Map Integration**: Display recommended restaurants on an interactive map
- **Multi-city Support**: Extend filtering to handle all cities in the dataset
- **Comparison Mode**: Let users compare two restaurants side-by-side

---

*Context generated from deep analysis of `Problem Statement.md` — Zomoto Project | 2026-06-15*
