import os
import sys
import subprocess
from pathlib import Path

# Add backend to sys.path
sys.path.insert(0, str(Path(__file__).parent))

from app.core.config import settings

def test_multi_cut_scene():
    ffmpeg = settings.get_ffmpeg_path()
    project_id = "b8c4a056-57a5-4810-8a7e-6879de171dbd"
    proj_dir = Path("workspace_data/projects") / project_id
    
    # We will test Scene 1:
    audio_path = proj_dir / "audio" / "scene_01.wav"
    primary_img = proj_dir / "visuals" / "scene_01.jpg"
    img2 = proj_dir / "visuals" / "scene_04.jpg" # Another real NASA/space photo
    img3 = proj_dir / "visuals" / "scene_07.jpg" # Another real NASA/space photo
    
    # Get audio duration
    probe_cmd = [
        ffmpeg, "-i", str(audio_path),
        "-show_entries", "format=duration",
        "-v", "quiet", "-of", "csv=p=0"
    ]
    res = subprocess.run(probe_cmd, capture_output=True, text=True)
    try:
        duration = float(res.stdout.strip())
    except Exception:
        duration = 24.5
        
    print(f"Testing Scene 1: Audio Duration = {duration:.2f}s")
    
    # We will split into 3 visual cuts:
    cuts = [primary_img, img2, img3]
    num_cuts = len(cuts)
    cut_duration = duration / num_cuts
    fps = 25
    cut_frames = int(fps * cut_duration)
    
    temp_dir = Path("workspace_data/temp_test_cuts")
    temp_dir.mkdir(parents=True, exist_ok=True)
    
    motions = [
        # Cut 1: Dramatic Push-in
        f"zoompan=z='min(zoom+0.002,1.25)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={cut_frames}:s=1920x1080:fps={fps},vignette=PI/5,eq=contrast=1.08:saturation=1.12",
        # Cut 2: Pan Left to Right
        f"zoompan=z='1.15':x='(on/{cut_frames})*(iw-iw/zoom)':y='ih/2-(ih/zoom/2)':d={cut_frames}:s=1920x1080:fps={fps},vignette=PI/5,eq=contrast=1.08:saturation=1.12",
        # Cut 3: Slow Pull Back
        f"zoompan=z='max(1.25-0.002*on,1.0)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={cut_frames}:s=1920x1080:fps={fps},vignette=PI/5,eq=contrast=1.08:saturation=1.12"
    ]
    
    sub_clips = []
    concat_lines = []
    
    for idx, (img_path, vf) in enumerate(zip(cuts, motions)):
        sub_clip_file = temp_dir / f"cut_{idx+1}.mp4"
        cmd = [
            ffmpeg, "-y",
            "-loop", "1", "-i", str(img_path),
            "-vf", vf,
            "-c:v", "libx264", "-preset", "ultrafast", "-crf", "22",
            "-pix_fmt", "yuv420p",
            "-t", f"{cut_duration:.3f}",
            str(sub_clip_file)
        ]
        r = subprocess.run(cmd, capture_output=True, text=True)
        if r.returncode != 0:
            print(f"Error rendering cut {idx+1}: {r.stderr[-300:]}")
            return
        sub_clips.append(sub_clip_file)
        concat_lines.append(f"file '{sub_clip_file.resolve().as_posix()}'")
        print(f"Rendered Cut {idx+1}/{num_cuts} ({cut_duration:.2f}s)")
        
    concat_list = temp_dir / "cuts_manifest.txt"
    with open(concat_list, "w", encoding="utf-8") as f:
        f.write("\n".join(concat_lines) + "\n")
        
    # Stitch cuts together with narration audio and subtle ambient drone
    output_scene = Path("workspace_data/test_multicut_scene1.mp4")
    
    # Filter complex to mix narration with subtle cosmic ambient sound
    # Drone sound: 0.02 volume
    # Narration: 1.0 volume
    filter_complex = (
        "[1:a]volume=1.0[narration];"
        "[2:a]volume=0.15[ambient];"
        "[narration][ambient]amix=inputs=2:duration=first:dropout_transition=2[aout]"
    )
    
    stitch_cmd = [
        ffmpeg, "-y",
        "-f", "concat", "-safe", "0", "-i", str(concat_list),
        "-i", str(audio_path),
        "-f", "lavfi", "-i", f"aevalsrc=0.03*sin(2*PI*55*t)+0.02*sin(2*PI*110*t)+0.01*sin(2*PI*165*t):s=44100",
        "-filter_complex", filter_complex,
        "-map", "0:v", "-map", "[aout]",
        "-c:v", "copy",
        "-c:a", "aac", "-b:a", "192k",
        "-t", f"{duration:.3f}",
        str(output_scene)
    ]
    
    r_stitch = subprocess.run(stitch_cmd, capture_output=True, text=True)
    if r_stitch.returncode != 0:
        print(f"Stitch failed: {r_stitch.stderr[-400:]}")
        return
        
    print(f"\nSUCCESS! Multi-cut scene rendered: {output_scene}")
    print(f"Size: {output_scene.stat().st_size / (1024*1024):.2f} MB")
    print(f"3 dynamic camera cuts, subtle cosmic soundscape, vignette and color grading applied!")

if __name__ == "__main__":
    test_multi_cut_scene()

