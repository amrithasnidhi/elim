<div align="center">

<img src="https://img.shields.io/badge/ELIM-Explain%20Like%20I'm%20Me-7C6EF0?style=for-the-badge&labelColor=0B0C1E" alt="ELIM" />

# Explain Like I'm Me

**Adaptive AI learning system that explains any topic in your style — and gets smarter about how to teach you over time.**

[![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React_18-20232A?style=flat-square&logo=react&logoColor=61DAFB)](https://react.dev/)
[![MongoDB](https://img.shields.io/badge/MongoDB-4EA94B?style=flat-square&logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![Python](https://img.shields.io/badge/Python_3.11-3776AB?style=flat-square&logo=python&logoColor=white)](https://python.org/)
[![Claude](https://img.shields.io/badge/Claude_API-D97757?style=flat-square&logo=anthropic&logoColor=white)](https://anthropic.com/)
[![LangChain](https://img.shields.io/badge/LangChain-1C3C3C?style=flat-square&logo=langchain&logoColor=white)](https://langchain.com/)
[![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat-square&logo=docker&logoColor=white)](https://docker.com/)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](CONTRIBUTING.md)

</div>

---

## 📖 What is ELIM?

Most AI tools give every user the **same generic answer**. ELIM is different.

ELIM builds a model of *how you personally learn* — tracking whether you prefer **analogies**, **step-by-step breakdowns**, or **code examples** — and adapts automatically based on your feedback. Every explanation is grounded in your own study material (lecture notes, Notion pages, GitHub repos) via live MCP integrations.

Rate an explanation 👍 or 👎, and the system updates your preference weights. Over time, it stops asking what you prefer — **it already knows**.

> _"Built an adaptive AI learning system using prompt engineering, user modeling, and a feedback-driven personalization loop."_

---

## ✨ Features

### Core System
- 🧠 **Dynamic Prompt Engineering** — every prompt is constructed at runtime from your live user profile. No two users ever get the same prompt.
- 👤 **User Modeling** — stores your preferred style, difficulty level, topic history, and `style_weights` — a live map that evolves with every session.
- 🔁 **Feedback Adaptation Loop** — thumbs up/down updates your `style_weights` using a weighted moving average. The system auto-selects your best style over time.

### Explanation Modes
- 💡 **Analogy Style** — real-world comparisons that make abstract concepts click
- 📋 **Step-by-Step Style** — numbered walkthroughs with no assumed knowledge
- 💻 **Code-First Style** — working code examples with inline explanations
- 🎭 **Multi-Style Output** — generate all 3 simultaneously and compare side-by-side
- 🤔 **Socratic Mode** — AI asks you guiding questions instead of explaining directly

### Knowledge Integration (MCP)
- 📁 **Google Drive** — indexes your lecture notes, PDFs, and slides
- 📝 **Notion** — pulls your personal study notes and knowledge bases
- 🐙 **GitHub** — retrieves code examples from your repos and READMEs
- 🌐 **Web Search** — fallback to trusted educational sources (Wikipedia, MDN, ArXiv)

### Multi-Modal Output
- 🔊 **Voice Explanations** — text-to-speech with adjustable playback speed
- 📊 **Auto Diagrams** — LLM generates Mermaid.js flowcharts for every topic
- 🎤 **Voice Input** — speak your topic instead of typing (Whisper API)
- 💬 **Chat Mode** — ask follow-up questions with full conversation memory

### Unique AI Features
| Feature | Description |
|---|---|
| **Learning Pace Detector** | Tracks time-to-rate and auto-adjusts your difficulty level |
| **Concept Dependency Graph** | Shows prerequisite topics to learn before your current one |
| **Confusion Detector** | Detects confusion in follow-up questions and auto-regenerates |
| **Spaced Repetition** | SM-2 algorithm schedules re-explanations at optimal intervals |
| **Explanation Diff View** | See how the same topic's explanation changed as you evolved |
| **Topic Recommendations** | "What to learn next" based on your topic history embeddings |
| **Peer Style Matching** | Anonymously borrows winning styles from similar learners |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      React Frontend                      │
│        (Vite · Tailwind · Zustand · React Query)        │
└────────────────────────┬────────────────────────────────┘
                         │ REST API (JWT)
┌────────────────────────▼────────────────────────────────┐
│                    FastAPI Backend                       │
│                                                         │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │ MCPManager  │  │ RAG Pipeline │  │ Prompt Builder│  │
│  │             │  │              │  │               │  │
│  │ Google Drive│  │ Chunk (500t) │  │ LangChain     │  │
│  │ Notion      │  │ Embed (768d)│  │ PromptTemplate│  │
│  │ GitHub      │  │ ChromaDB     │  │ Style inject  │  │
│  │ Image Search│  │ Top-k search │  │ RAG context   │  │
│  │ Web Search  │  │ Trust weight │  │               │  │
│  └──────┬──────┘  └──────┬───────┘  └───────┬───────┘  │
│         └────────────────┴──────────────────┘          │
│                          │                              │
│  ┌───────────────────────▼─────────────────────────┐   │
│  │              LLM Service (Claude)                │   │
│  │     Claude/Groq · LangSmith traced  │   │
│  └──────────────────────────────────────────────────┘   │
│                                                         │
│  ┌──────────────┐  ┌────────────┐  ┌───────────────┐   │
│  │ User Profile │  │  Feedback  │  │ Celery Workers│   │
│  │   Engine     │  │   Engine   │  │ (Background)  │   │
│  │              │  │            │  │               │   │
│  │ style_weights│  │ Weight     │  │ MCP Indexing  │   │
│  │ MongoDB CRUD │  │ update +   │  │ TTS Queue     │   │
│  │              │  │ normalise  │  │ Spaced Rep    │   │
│  └──────────────┘  └────────────┘  └───────────────┘   │
└─────────────────────────────────────────────────────────┘
          │                │                │
    ┌─────▼────┐    ┌──────▼─────┐   ┌─────▼──────┐
    │ MongoDB  │    │  ChromaDB  │   │   Redis    │
    │  Atlas   │    │  Pinecone  │   │  (Upstash) │
    └──────────┘    └────────────┘   └────────────┘
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18, Vite, Tailwind CSS, Zustand, React Query, Framer Motion |
| **Backend** | Python 3.11, FastAPI, Pydantic v2, Motor (async MongoDB) |
| **AI / LLM** | Anthropic Claude API (Primary), Groq API (Fallback), LangChain, LangSmith |
| **Embeddings** | OpenAI Gemini Embeddings (768d) |
| **Vector Store** | ChromaDB (dev) / Pinecone (prod) |
| **MCP** | Anthropic MCP SDK — Google Drive, Notion, GitHub |
| **Voice** | ElevenLabs (Primary TTS), Gemini (Fallback STT/TTS) |
| **Database** | MongoDB (Docker / Atlas) |
| **Cache / Queue** | Redis (Docker / Upstash), Celery |
| **Storage** | AWS S3 / Cloudflare R2 (audio files) |
| **Deployment** | Vercel (frontend), Railway (backend + workers) |
| **Monitoring** | Sentry, LangSmith |

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- Python 3.10+
- Docker & Docker Compose
- Git
- API Keys: Anthropic (or Groq for free fallback), Gemini (free), etc.

### 1. Clone the repository

```bash
git clone https://github.com/amrithasnidhi/elim.git
cd elim
```

### 2. Set up environment variables

```bash
cp .env.example .env
```

Open `.env` and fill in your keys. At minimum you need:
- `GROQ_API_KEY` (free at https://console.groq.com)
- `GEMINI_API_KEY` (free at https://aistudio.google.com)

> See `.env.example` for generating local secrets (JWT, Fernet).

### 3. Start Docker Services (MongoDB & Redis)

Make sure Docker Desktop is running, then run:

```bash
docker compose up -d mongodb redis
```

### 4. Backend Setup (Terminal 1)

Open a NEW terminal and run:
```bash
cd backend
python -m venv .venv
# Activate:
# Windows: .venv\Scripts\Activate.ps1
# Mac/Linux: source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```
Keep this terminal running.

### 5. Frontend Setup (Terminal 2)

Open a NEW terminal and run:
```bash
cd frontend
npm install
npm run dev
```
Frontend runs at **`http://localhost:5173`**

### 6. Celery Worker (Terminal 3)

Open a NEW terminal and run:
```bash
cd backend
# Activate venv first
celery -A workers.celery_app worker --loglevel=info --pool=solo
```

### 7. Verify Setup

Frontend: `http://localhost:5173`
Backend API: `http://localhost:8000`
API Docs: `http://localhost:8000/docs`

---

## 📁 Project Structure

```
elim/
├── frontend/                   # React 18 + Vite
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Home.jsx        # Topic input + explanation display
│   │   │   ├── Profile.jsx     # style_weights chart + preferences
│   │   │   ├── History.jsx     # Past explanations dashboard
│   │   │   ├── Settings.jsx    # MCP source connections
│   │   │   └── Auth/           # Login + Register
│   │   ├── components/
│   │   │   ├── ExplainCard.jsx # Explanation display + ratings
│   │   │   ├── StyleTabs.jsx   # Multi-style tab switcher
│   │   │   ├── AudioPlayer.jsx # TTS audio player
│   │   │   ├── DiagramView.jsx # Mermaid.js renderer
│   │   │   ├── ChatThread.jsx  # Follow-up chat UI
│   │   │   └── SourceCard.jsx  # MCP connect/disconnect
│   │   ├── hooks/              # useExplain, useFeedback, useMCP
│   │   └── store/              # Zustand: auth + explain state
│   └── package.json
│
├── backend/                    # FastAPI
│   ├── routers/
│   │   ├── auth.py             # Register, login, refresh, logout
│   │   ├── explain.py          # Generate, multi-style, followup, audio, diagram
│   │   ├── feedback.py         # Rate, summary
│   │   ├── profile.py          # Get profile, history, preferences
│   │   └── mcp.py              # Connect, disconnect, index, status
│   ├── services/
│   │   ├── mcp_manager.py      # MCPManager: parallel MCP queries
│   │   ├── rag_pipeline.py     # Chunk → embed → store → retrieve
│   │   ├── prompt_builder.py   # LangChain prompt templates per mode
│   │   ├── llm_service.py      # Claude API calls + quality scorer
│   │   └── feedback_engine.py  # style_weights update + normalise
│   ├── workers/
│   │   ├── indexer.py          # Celery: daily MCP re-indexing
│   │   ├── tts_worker.py       # Celery: TTS generation + S3 upload
│   │   └── spaced_rep.py       # Celery: SM-2 spaced repetition
│   ├── models/                 # Pydantic schemas: User, History, Embedding
│   ├── middleware/             # JWT auth, logging, rate limiting
│   └── main.py
│
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## 🔌 MCP Knowledge Sources

Connect your own study material so explanations cite **your actual notes** — not generic web content.

| Source | What it indexes | Trust Weight |
|---|---|---|
| 📁 Google Drive | Lecture PDFs, slides, textbooks | 1.0 (highest) |
| 📝 Notion | Personal notes, study databases | 1.0 |
| 🐙 GitHub | Code files, READMEs, wikis | 0.85 |
| 🌐 Web Search | Wikipedia, MDN, ArXiv (fallback) | 0.60 |

Connect a source in **Settings → Knowledge Sources**. Once connected, ELIM indexes your content and cites it inline:

> *"From your CS3450 lecture notes (Week 4, page 12): Binary search works by..."*

---

## 🧠 How the Adaptation Works

Every user has a `style_weights` map that starts equal:

```json
{ "analogy": 0.33, "step-by-step": 0.33, "code": 0.34 }
```

After each rating, the weight for the style used is updated:

```
new_weight = (0.8 × old_weight) + (0.2 × feedback_signal)
```

Where `feedback_signal` is `+1` (👍), `0` (no rating), or `-1` (👎). All weights are then normalised to sum to `1.0`.

After a few sessions of preferring step-by-step explanations:

```json
{ "analogy": 0.15, "step-by-step": 0.60, "code": 0.25 }
```

From now on, step-by-step is auto-selected — no preference setting needed.

---

## 📡 API Reference

Base URL: `http://localhost:8000` · Full docs: `http://localhost:8000/docs`

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/auth/register` | Create account |
| `POST` | `/auth/login` | Login, get JWT |
| `POST` | `/explain/generate` | Generate personalised explanation |
| `POST` | `/explain/multi-style` | Generate all 3 styles in parallel |
| `POST` | `/explain/followup` | Chat follow-up with context memory |
| `POST` | `/explain/audio` | Queue TTS audio generation |
| `POST` | `/explain/diagram` | Generate Mermaid.js diagram |
| `POST` | `/feedback/rate` | Rate an explanation (updates weights) |
| `GET` | `/profile` | Get user profile + style_weights |
| `GET` | `/profile/history` | Paginated explanation history |
| `GET` | `/mcp/sources` | List MCP connections + status |
| `POST` | `/mcp/connect/:source` | Connect a knowledge source |
| `POST` | `/mcp/index` | Trigger manual re-indexing |
| `GET` | `/health` | Service health check |

---

## 🗄️ Database Schema (Key Collections)

<details>
<summary><b>users</b> — click to expand</summary>

```js
{
  _id: ObjectId,
  email: String,              // unique, indexed
  password_hash: String,      // bcrypt, never stored plain
  name: String,
  preferred_style: String,    // "analogy" | "step-by-step" | "code" | "auto"
  difficulty_level: Number,   // 1 (beginner) → 5 (expert), auto-adjusted
  style_weights: {            // live preference map, normalised to sum=1
    analogy: Float,
    "step-by-step": Float,
    code: Float
  },
  enabled_mcp_sources: [String],       // ["gdrive", "notion", "github", "web"]
  mcp_tokens: { source: encryptedStr },// Fernet-encrypted OAuth tokens
  topic_history: [String],             // last 50 topics → seeds RAG queries
  spaced_rep_queue: [{                 // SM-2 spaced repetition schedule
    topic: String,
    next_review_at: Date,
    interval_days: Number,
    ease_factor: Float
  }],
  created_at: Date,
  last_active: Date
}
```
</details>

<details>
<summary><b>history</b> — click to expand</summary>

```js
{
  _id: ObjectId,
  user_id: ObjectId,           // ref: users._id
  topic: String,
  style_used: String,
  difficulty_used: Number,
  prompt_snapshot: String,     // full prompt sent to LLM (for debugging)
  explanation: String,
  diagram_code: String,        // Mermaid.js source (if generated)
  audio_url: String,           // S3/R2 URL (if generated)
  mcp_sources_used: [String],  // which sources contributed
  rag_chunks: [{               // top-5 retrieved chunks
    text: String, source: String, score: Float, file: String
  }],
  feedback_score: Number,      // -1 | 0 | +1
  star_rating: Number,         // 1–5, optional
  time_to_rate_sec: Number,    // pace signal for difficulty adjustment
  created_at: Date
}
```
</details>

---

## 🧪 Running Tests

```bash
# Backend unit + integration tests
cd backend
pytest tests/ -v --cov=. --cov-report=term-missing

# Frontend component tests
cd frontend
npm run test

# E2E tests (requires running stack)
npm run test:e2e
```

Key test cases:
- `style_weights` normalise to `1.0` after any update
- Thumbs up rating shifts the rated style's weight upward
- MCP deduplication removes duplicate chunks from overlapping sources
- RAG retrieval respects trust weighting (personal docs beat web)
- JWT expiry returns `401`, valid token returns `user_id`

---

## 🚢 Deployment

### Backend → Railway

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and deploy
railway login
railway up
```

Set all environment variables in the Railway dashboard. Add a second service for the Celery worker using the same repo with start command:

```bash
celery -A backend.workers.celery_app worker --loglevel=info
```

### Frontend → Vercel

```bash
npm install -g vercel
cd frontend
vercel --prod
```

Set `VITE_API_URL` to your Railway backend URL in Vercel environment variables.

### Vector Store → Pinecone (production)

1. Create a Pinecone index: **768 dimensions (Gemini)**, **cosine** metric
2. Add `PINECONE_API_KEY` and `PINECONE_INDEX_NAME` to your `.env`
3. Set `VECTOR_STORE=pinecone` in environment variables

---

## 🗺️ Roadmap

- [x] Phase 1 — MVP: topic input + LLM explanation
- [x] Phase 2 — User auth + profile system
- [x] Phase 3 — Feedback loop + style_weights adaptation
- [x] Phase 4 — Multi-style parallel output + Compare page
- [x] Phase 5 — MCP knowledge integration (Google Drive, Notion, GitHub, Web, Images)
- [x] Phase 6 — Full RAG pipeline (ChromaDB, embeddings, Celery indexing)
- [x] Phase 7 — Multi-modal output (TTS, Mermaid diagrams, voice input, follow-up chat)
- [x] Phase 8 — Advanced features (Pace Detector, Quality Scorer, Confusion Detector, Socratic Mode, Spaced Repetition SM-2, Concept Dependency Graph, Explanation Diff, Topic Recommendations, Peer Matching, Sentry)

---

## 🤝 Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) first.

```bash
# Fork the repo, then:
git checkout -b feature/your-feature-name
git commit -m "feat: add your feature"
git push origin feature/your-feature-name
# Open a Pull Request
```

**Good first issues:** look for the `good first issue` label in Issues.

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

## 🙏 Acknowledgements

- [Anthropic](https://anthropic.com/) — Claude API and Model Context Protocol
- [LangChain](https://langchain.com/) — Prompt orchestration and memory
- [ChromaDB](https://trychroma.com/) — Local vector store
- [FastAPI](https://fastapi.tiangolo.com/) — Async Python web framework
- [Mermaid.js](https://mermaid.js.org/) — Diagram rendering

---

<div align="center">

**Built with ❤️ — because everyone deserves explanations that actually make sense to them.**

⭐ Star this repo if ELIM helped you learn something new

</div>
