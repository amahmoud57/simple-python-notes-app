# Smart Notes — AI-Powered Notes App

A template app ready to deploy on [Embr](https://portal.embrdev.io). FastAPI backend serves a plain HTML/JS frontend on a single port — no frontend build step needed.

## Deploy to Embr

This repo includes a [`builder.yaml`](builder.yaml) component manifest:

```yaml
name: smart-notes
components:
  - name: web
    role: web
    platform: python
    platformVersion: "3.14"
    run:
      port: 8080
      healthCheckPath: /api/health
    path: /
```

Connect this repo to a Builder app, and Embr will install dependencies from `requirements.txt`, start the server, and verify `/api/health` before shifting traffic.

## Run Locally

```bash
pip install -r requirements.txt
gunicorn --bind 0.0.0.0:8008 --reload application:app
```

Open http://localhost:8008

## Features

- **CRUD notes** — create, edit, delete
- **AI actions** — summarize, extract action items, sentiment analysis (mock by default)
- **Optional AI** — set `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_API_KEY`, and `AZURE_OPENAI_DEPLOYMENT` env vars, then uncomment the real implementation in `backend/ai_service.py`
- **Optional DB** — in-memory storage by default; swap `backend/store.py` for SQLite/Postgres
