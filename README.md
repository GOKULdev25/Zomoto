# Zomoto — AI Restaurant Recommendation System

An AI-powered restaurant recommendation app built with a modern React frontend and a FastAPI Python backend.

### Tech Stack
- **Dataset**: [Zomato HuggingFace Dataset](https://huggingface.co/datasets/ManikaSaini/zomato-restaurant-recommendation)
- **LLM**: Groq Free Tier (`llama-3.3-70b-versatile`)
- **Backend**: FastAPI (Python 3.10+)
- **Frontend**: React 19 + Vite + TailwindCSS + Framer Motion

---

## Features
- **Intelligent Filtering**: Automatically relaxes strict search filters (like cuisine or budget) if no exact matches are found, always ensuring you get the best possible options nearby.
- **AI-Powered Ranking**: Groq LLM evaluates the candidates against your exact preferences and provides personalized reasons for its top 3 picks.
- **Premium UI/UX**: Fully custom glassmorphism dark mode interface with native-feeling searchable dropdown filters and staggered animations.

---

## Setup Instructions

### 1. Clone the repository
```bash
git clone <your-repo-url>
cd zomoto
```

### 2. Configure Backend
```bash
# Create a virtual environment
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # Mac/Linux

# Install Python dependencies
pip install -r requirements.txt
```

### 3. Configure your Groq API key
Get a free API key from [console.groq.com](https://console.groq.com).
Create a `.env` file in the project root:
```
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### 4. Configure Frontend
```bash
# In a new terminal, install Node dependencies
cd frontend
npm install
```

---

## Running the App

You can run both the frontend and backend with a single command from the root directory:

```bash
npm run dev
```

Alternatively, you can run them in separate terminals:
- **Backend**: `npm run backend` (starts FastAPI on port 8000)
- **Frontend**: `cd frontend && npm run dev` (starts Vite on port 5173)

The application will be available at `http://localhost:5173`.

---

## Running Tests

The backend logic is fully tested with `pytest`.
```bash
python -m pytest tests/ -v
```

---

## Project Structure

```
zomoto/
├── app.py                  # FastAPI server entry point
├── .env                    # Your API key (never commit)
├── requirements.txt        # Python backend dependencies
├── package.json            # Root script runner
├── frontend/               # React + Vite application
│   ├── src/components/     # Custom UI elements (Dropdown, Cards)
│   ├── src/index.css       # Global design tokens
│   └── vite.config.ts      # API proxy configuration
├── src/                    # Core Python Backend Logic
│   ├── data_loader.py      # HuggingFace dataset loading
│   ├── filter_engine.py    # Dataset filtering + fallback logic
│   ├── prompt_builder.py   # LLM prompt construction
│   ├── groq_client.py      # Groq API + rate limit handling
│   └── output_formatter.py # Parse + display LLM response
└── tests/                  # Pytest unit tests
```
