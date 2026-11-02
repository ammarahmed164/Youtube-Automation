# AI YouTube Documentary Studio

> **Human-in-the-Loop AI Video/Documentary Creation and YouTube Publishing Platform**

This studio assists creators in researching, scripting, synthesizing scene voiceovers, sourcing visual footage, and rendering 1080p documentaries. 

### Core Non-Negotiable Rules
1. **Mandatory Human Approval Gate:** AI may generate and modify videos, but **NEVER** publishes to YouTube without explicit user button confirmation tied to the exact video version and SHA-256 file checksum.
2. **Strict 20-Minute Duration Limit:** Projects are strictly capped at **20 minutes maximum** to guarantee local hardware stability and avoid API rate limits.
3. **No Large Binaries in Database:** Only relative storage keys and metadata are stored in PostgreSQL; raw MP4 and audio files remain in the media workspace.

---

## Project Structure

```text
AI_YouTube_Documentary_Studio/
├── backend/                       # Python + FastAPI Backend
│   ├── app/
│   │   ├── api/v1/endpoints/      # API endpoints (health, projects, scripts)
│   │   ├── core/                  # Configuration & database session
│   │   ├── models/                # SQLAlchemy database models
│   │   ├── schemas/               # Pydantic validation schemas
│   │   ├── services/              # Modular adapters (AI, TTS, Visuals, Rendering, QC, YouTube)
│   │   └── main.py                # FastAPI application entrypoint
│   ├── venv/                      # Local Python Virtual Environment (gitignored)
│   ├── requirements.txt           # Python backend dependencies
│   └── .env.example               # Template environment configuration
├── frontend/                      # Next.js 16 (App Router) + TypeScript + Tailwind CSS
│   ├── src/app/                   # Next.js pages & dashboard
│   ├── package.json
│   └── tsconfig.json
├── workspace_data/                # Local storage for generated video/audio (gitignored)
├── .gitignore                     # Protection for secrets, node_modules, and media binaries
└── README.md
```

---

## Quickstart: Running Locally on Windows

### 1. Backend (FastAPI)
Open a terminal in the project root:

```powershell
# Set PYTHONPATH and run Uvicorn server
$env:PYTHONPATH="backend"
.\backend\venv\Scripts\uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

* **Interactive API Docs:** [http://localhost:8000/api/v1/docs](http://localhost:8000/api/v1/docs)
* **Health Check:** [http://localhost:8000/api/v1/health](http://localhost:8000/api/v1/health)

### 2. Frontend (Next.js)
Open a second terminal in the project root:

```powershell
cd frontend
npm run dev
```

* **Studio Dashboard:** [http://localhost:3000](http://localhost:3000)

---

## Roadmap & Status

- [x] **Phase 1: Environment Inspection, Setup & Architecture** (COMPLETED)
- [ ] **Phase 2: Database, Backend Foundation & Project Management** (NEXT)
- [ ] **Phase 3: Dashboard UX & Documentary Creation Wizard**
- [ ] **Phase 4: Gemini Research, Scripting & Scene Planning**
- [ ] **Phase 5: Voiceover (Piper TTS) & Visual Assets**
- [ ] **Phase 6: FFmpeg Rendering & Subtitle Synchronization**
- [ ] **Phase 7: Quality Checks & Natural Language AI Revisions**
- [ ] **Phase 8: YouTube OAuth & Mandatory Approval Gate**
- [ ] **Phase 9: Cloud Deployment & Worker Separation**
- [ ] **Phase 10: Enhancements & Scaling**

