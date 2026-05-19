"""FastAPI application — serves the REST API and static HTML frontend."""

from __future__ import annotations

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from pathlib import Path

from backend.models import NoteCreate, NoteUpdate, NoteOut, AIResult
from backend.store import note_store
from backend.ai_service import AIAction, run_ai_action, is_ai_enabled
from backend.broken_module import something_that_doesnt_exist

app = FastAPI(title="Smart Notes", version="0.1.0")

STATIC_DIR = Path(__file__).resolve().parent.parent / "static"

# ── API routes ───────────────────────────────────────────────────────────────

@app.get("/api/health")
async def health():
    return {"status": "ok", "ai_enabled": is_ai_enabled()}


@app.post("/api/notes", response_model=NoteOut, status_code=201)
async def create_note(data: NoteCreate):
    return note_store.create(data).to_out()


@app.get("/api/notes", response_model=list[NoteOut])
async def list_notes():
    return [n.to_out() for n in note_store.list_all()]


@app.get("/api/notes/{note_id}", response_model=NoteOut)
async def get_note(note_id: str):
    rec = note_store.get(note_id)
    if rec is None:
        raise HTTPException(404, "Note not found")
    return rec.to_out()


@app.put("/api/notes/{note_id}", response_model=NoteOut)
async def update_note(note_id: str, data: NoteUpdate):
    rec = note_store.update(note_id, data)
    if rec is None:
        raise HTTPException(404, "Note not found")
    return rec.to_out()


@app.delete("/api/notes/{note_id}", status_code=204)
async def delete_note(note_id: str):
    if not note_store.delete(note_id):
        raise HTTPException(404, "Note not found")


@app.post("/api/notes/{note_id}/ai/{action}", response_model=AIResult)
async def ai_action(note_id: str, action: AIAction):
    rec = note_store.get(note_id)
    if rec is None:
        raise HTTPException(404, "Note not found")
    result = await run_ai_action(action, rec.content)
    return AIResult(note_id=note_id, action=action.value, result=result)


# ── Serve static HTML frontend ───────────────────────────────────────────────

@app.get("/favicon.svg")
async def serve_favicon():
    return FileResponse(STATIC_DIR / "favicon.svg", media_type="image/svg+xml")


@app.get("/")
async def serve_index():
    return FileResponse(STATIC_DIR / "index.html")
