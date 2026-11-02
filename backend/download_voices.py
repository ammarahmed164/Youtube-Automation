import urllib.request
from pathlib import Path

models_dir = Path("backend/models_tts")
models_dir.mkdir(parents=True, exist_ok=True)

models = {
    "deep_male_cinematic": {
        "onnx": "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/bryce/medium/en_US-bryce-medium.onnx",
        "json": "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/bryce/medium/en_US-bryce-medium.onnx.json",
        "name": "en_US-bryce-medium"
    },
    "natural_male": {
        "onnx": "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/ryan/medium/en_US-ryan-medium.onnx",
        "json": "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/ryan/medium/en_US-ryan-medium.onnx.json",
        "name": "en_US-ryan-medium"
    }
}

for preset, data in models.items():
    onnx_dest = models_dir / f"{data['name']}.onnx"
    json_dest = models_dir / f"{data['name']}.onnx.json"
    
    if not onnx_dest.exists():
        print(f"Downloading {preset} ONNX model ({data['name']})...")
        urllib.request.urlretrieve(data['onnx'], onnx_dest)
        print(f"Downloaded {data['name']}.onnx ({onnx_dest.stat().st_size / (1024*1024):.1f} MB)")
        
    if not json_dest.exists():
        print(f"Downloading {preset} JSON config...")
        urllib.request.urlretrieve(data['json'], json_dest)

print("ALL VOICE MODELS DOWNLOADED & VERIFIED IN backend/models_tts!")

