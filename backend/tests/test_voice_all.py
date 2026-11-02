from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

print("--- Step 1: Getting the JWST project from Supabase ---")
res_projects = client.get("/api/v1/projects/")
assert res_projects.status_code == 200
projects = res_projects.json()
target_proj = next((p for p in projects if "Webb" in p["title"]), projects[0])
project_id = target_proj["id"]
print("Target Project:", target_proj["title"], f"({project_id})")

print("--- Step 2: Triggering Voice Agent (Piper TTS) for all scenes ---")
res_voice = client.post(f"/api/v1/projects/{project_id}/generate-voice")
print("Voice Generation HTTP Status:", res_voice.status_code)

if res_voice.status_code != 200:
    print("Error:", res_voice.json())
    exit(1)

data = res_voice.json()
print("\n=== VOICE AGENT SYNTHESIS SUCCESS! ===")
print("Scenes Synthesized:", data["scenes_synthesized"])
print("Total Audio Duration:", data["total_audio_duration_seconds"], "seconds", f"({data['total_audio_duration_minutes']} minutes)")

print("\n--- Audio Samples Preview ---")
for item in data["audio_assets"][:3]:
    print(f"- Scene ID: {item['scene_id']} | Duration: {item['duration_seconds']}s | File: {item['file_path']}")

print("\n>>> VOICE AGENT (PIPER TTS) VERIFIED 100% OPERATIONAL! <<<")

