import subprocess
import sys
from pathlib import Path

# Add backend to sys.path
sys.path.insert(0, str(Path(__file__).parent))

from app.core.config import settings

def test_motions():
    ffmpeg = settings.get_ffmpeg_path()
    input_img = Path("workspace_data/projects/b8c4a056-57a5-4810-8a7e-6879de171dbd/visuals/scene_01.jpg")
    fps = 25
    duration = 3.0
    frames = int(fps * duration)
    
    motions = [
        # 1. Pan Left to Right
        f"zoompan=z='1.15':x='(on/{frames})*(iw-iw/zoom)':y='ih/2-(ih/zoom/2)':d={frames}:s=1920x1080:fps={fps},vignette=PI/5,eq=contrast=1.08:saturation=1.12",
        # 2. Pan Right to Left
        f"zoompan=z='1.15':x='(1-(on/{frames}))*(iw-iw/zoom)':y='ih/2-(ih/zoom/2)':d={frames}:s=1920x1080:fps={fps},vignette=PI/5,eq=contrast=1.08:saturation=1.12",
        # 3. Dramatic Push In
        f"zoompan=z='min(zoom+0.002,1.25)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={frames}:s=1920x1080:fps={fps},vignette=PI/5,eq=contrast=1.08:saturation=1.12",
        # 4. Cinematic Pull Back
        f"zoompan=z='max(1.25-0.002*on,1.0)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={frames}:s=1920x1080:fps={fps},vignette=PI/5,eq=contrast=1.08:saturation=1.12"
    ]
    
    for i, vf in enumerate(motions):
        out = Path(f"workspace_data/test_motion_{i+1}.mp4")
        cmd = [
            ffmpeg, "-y",
            "-loop", "1", "-i", str(input_img),
            "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo",
            "-vf", vf,
            "-c:v", "libx264", "-preset", "ultrafast", "-crf", "22",
            "-c:a", "aac",
            "-pix_fmt", "yuv420p",
            "-t", f"{duration}",
            str(out)
        ]
        res = subprocess.run(cmd, capture_output=True, text=True)
        if res.returncode != 0:
            print(f"Motion {i+1} failed: {res.stderr[-300:]}")
            sys.exit(1)
        print(f"Motion {i+1} OK! Output size: {out.stat().st_size} bytes")

if __name__ == "__main__":
    test_motions()
