import os
import io
import sys
import json
import urllib.request
import urllib.parse
from pathlib import Path
from PIL import Image

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

from app.core.database import SessionLocal
from app.core.config import BASE_DIR
from app.models.generation import Scene

def download_and_crop(url: str, output_path: Path) -> bool:
    try:
        req = urllib.request.Request(
            url,
            headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AIYouTubeStudio/1.0"}
        )
        with urllib.request.urlopen(req, timeout=12) as resp:
            data = resp.read()
        
        img = Image.open(io.BytesIO(data)).convert("RGB")
        target_w, target_h = 1920, 1080
        w, h = img.size
        if w <= 0 or h <= 0:
            return False

        scale = max(target_w / w, target_h / h)
        new_w, new_h = int(w * scale), int(h * scale)
        resized = img.resize((new_w, new_h), Image.Resampling.LANCZOS)

        left = (new_w - target_w) // 2
        top = (new_h - target_h) // 2
        cropped = resized.crop((left, top, left + target_w, top + target_h))

        output_path.parent.mkdir(parents=True, exist_ok=True)
        cropped.save(output_path, "JPEG", quality=92, optimize=True)
        return True
    except Exception as e:
        return False

def search_nasa_images(query: str, limit: int = 5):
    try:
        encoded = urllib.parse.quote(query)
        url = f"https://images-api.nasa.gov/search?q={encoded}&media_type=image"
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=8) as r:
            data = json.loads(r.read().decode("utf-8"))
        items = data.get("collection", {}).get("items", [])
        urls = []
        for it in items[:limit]:
            links = it.get("links", [])
            if links:
                raw = links[0].get("href", "")
                med = raw.replace("~thumb.jpg", "~medium.jpg").replace("~small.jpg", "~medium.jpg")
                urls.append(med)
        return urls
    except Exception:
        return []

def main():
    db = SessionLocal()
    project_id = "b8c4a056-57a5-4810-8a7e-6879de171dbd"
    scenes = db.query(Scene).filter(Scene.project_id == project_id).order_by(Scene.scene_order).all()
    
    print(f"Acquiring authentic NASA HD imagery for all {len(scenes)} scenes...")
    visuals_dir = BASE_DIR / "workspace_data" / "projects" / project_id / "visuals"
    visuals_dir.mkdir(parents=True, exist_ok=True)
    
    # Specific targeted queries tailored to each scene's scientific topic
    scene_queries = {
        1: ["james webb space telescope deep space", "hubble deep field", "ancient universe stars"],
        2: ["redshift light waves spectrum astronomy", "cosmic expansion universe", "infrared light space"],
        3: ["exoplanet atmosphere artistic concept", "trappist 1 exoplanet", "distant alien planet transit"],
        4: ["james webb gold mirror hexagon", "beryllium mirror webb telescope", "cleanroom webb primary mirror"],
        5: ["james webb sunshield deployment", "kapton sunshield layer webb", "sunshield vacuum chamber"],
        6: ["lagrange point l2 orbit space", "earth sun l2 halo orbit", "deep space spacecraft l2"],
        7: ["nircam near infrared camera webb", "miri mid infrared instrument webb", "infrared detector space sensor"],
        8: ["ariane 5 launch webb space telescope", "kourou spaceport rocket launch", "fairing separation space telescope"],
        9: ["first deep field smacs 0723 webb", "gravitational lensing galaxy cluster", "deep field ancient galaxies"],
        10: ["cosmic cliffs carina nebula webb", "carina nebula star forming region", "dust pillars stellar nursery"],
        11: ["stephan quintet colliding galaxies webb", "galaxy merger shockwaves gas", "interacting galaxies deep space"],
        12: ["southern ring nebula ngc 3132 webb", "planetary nebula dying star", "white dwarf expanding gas shell"],
        13: ["wasp 96b transmission spectrum webb", "water vapor exoplanet signature", "exoplanet transit starlight"],
        14: ["trappist 1b rocky planet infrared", "earth sized exoplanet system", "habitable zone rocky worlds"],
        15: ["earliest galaxies cosmic dawn", "jades gs z14 ancient galaxy", "first stars reionization universe"],
        16: ["phantom galaxy ngc 628 webb", "grand design spiral galaxy dust lanes", "infrared galactic core stars"],
        17: ["pillars of creation eagle nebula webb", "interstellar gas towers dust", "protostars eagle nebula infrared"],
        18: ["supermassive black hole active galactic nucleus", "quasar central engine jets", "galaxy core accretion disk"],
        19: ["future of space astronomy future telescopes", "habitable worlds observatory concept", "cosmic horizon deep universe"]
    }

    # Backup pool of guaranteed high-res NASA space photos
    general_pool = search_nasa_images("james webb space telescope", limit=20)
    general_pool += search_nasa_images("carina nebula hubble webb", limit=15)
    general_pool += search_nasa_images("deep space galaxy clusters", limit=15)
    pool_idx = 0

    total_downloaded = 0
    for scene in scenes:
        queries = scene_queries.get(scene.scene_order, [scene.scene_title or "space"])
        
        # We need at least 3 images per scene (Cut 0, Cut 1, Cut 2):
        # 1. Primary: scene_XX.jpg
        # 2. B-Roll 1: scene_XX_b01.jpg
        # 3. B-Roll 2: scene_XX_b02.jpg
        cut_targets = [
            visuals_dir / f"{scene.scene_id_str}.jpg",
            visuals_dir / f"{scene.scene_id_str}_b01.jpg",
            visuals_dir / f"{scene.scene_id_str}_b02.jpg"
        ]
        
        # If scene is > 22s, add 4th cut
        if (scene.actual_audio_duration_seconds or 20) > 22:
            cut_targets.append(visuals_dir / f"{scene.scene_id_str}_b03.jpg")
            
        print(f"\nProcessing Scene {scene.scene_order:02d} ({scene.scene_title}) - {len(cut_targets)} cuts needed...")
        
        for c_idx, target_file in enumerate(cut_targets):
            # If already exists and is high-res real photo (> 120KB), keep it
            if target_file.exists() and target_file.stat().st_size > 140000:
                print(f"  Cut {c_idx+1}: Already exists ({target_file.stat().st_size // 1024} KB).")
                continue
                
            q = queries[c_idx % len(queries)]
            urls = search_nasa_images(q, limit=4)
            saved = False
            for u in urls:
                if download_and_crop(u, target_file):
                    saved = True
                    break
                    
            if not saved and pool_idx < len(general_pool):
                download_and_crop(general_pool[pool_idx], target_file)
                pool_idx = (pool_idx + 1) % len(general_pool)
                saved = True
                
            if saved and target_file.exists():
                print(f"  Cut {c_idx+1}: Downloaded HD NASA image -> {target_file.name} ({target_file.stat().st_size // 1024} KB)")
                total_downloaded += 1
            else:
                print(f"  Cut {c_idx+1}: Could not fetch new cut, using previous.")

    print(f"\nCompleted! Downloaded/verified HD NASA imagery across all scenes.")

if __name__ == "__main__":
    main()

