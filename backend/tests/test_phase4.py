import json
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

print("--- Step 1: Getting an existing project from Supabase ---")
res_projects = client.get("/api/v1/projects/")
assert res_projects.status_code == 200
projects = res_projects.json()
assert len(projects) >= 1
test_project = projects[0]
project_id = test_project["id"]
print("Testing Project:", test_project["title"], f"({project_id})")

print("--- Step 2: Triggering Gemini Script Generation & Scene Breakdown ---")
res_gen = client.post(f"/api/v1/projects/{project_id}/generate-script")
print("Generation HTTP Status:", res_gen.status_code)

if res_gen.status_code != 201:
    print("Error Detail:", res_gen.json())
    exit(1)

script_data = res_gen.json()
print("\n=== GEMINI SCRIPT GENERATION SUCCESS! ===")
print("Revision Number:", script_data["revision_number"])
print("Opening Hook:", script_data["title_hook"])
print("Total Scenes Planned:", len(script_data["scenes"]))
print("Research Sources Count:", len(script_data.get("research_sources") or []))

print("\n--- First 3 Generated Scenes Preview ---")
for sc in script_data["scenes"][:3]:
    print(f"Scene {sc['scene_order']} [{sc['scene_id_str']}]: {sc['scene_title']}")
    print(f"  Duration: ~{sc['estimated_duration_seconds']}s")
    print(f"  Visual Type: {sc['preferred_visual_type']}")
    print(f"  Narration: {sc['narration_text'][:120]}...")
    print(f"  Stock Keywords: {sc['stock_keywords']}")

print("\n--- Step 3: Fetching persisted script from Supabase GET endpoint ---")
res_fetch = client.get(f"/api/v1/projects/{project_id}/script")
assert res_fetch.status_code == 200
print("Persisted Script Verified from Supabase! Scene count:", len(res_fetch.json()["scenes"]))

print("\n>>> PHASE 4 EXIT GATE 100% PASSED! <<<")

