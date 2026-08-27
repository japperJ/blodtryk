# Ollama Setup Guide for Blodtryk

This guide covers installing, configuring, and optimizing Ollama for the blood pressure OCR scanning feature.

## Quick Start

1. Install Ollama from [ollama.com](https://ollama.com)
2. Pull the OCR model: `ollama pull glm-ocr`
3. Start Ollama: `ollama serve`
4. The app connects to `http://localhost:11434` by default

## Models

The app uses **`glm-ocr`** — a 1.1B parameter vision model optimized for reading text/numbers from images.

| Model | Size | Purpose | Speed (CPU) | Speed (GPU) |
|-------|------|---------|-------------|-------------|
| `glm-ocr` | 2.2 GB | **OCR — recommended** | ~15s/image | ~8s/image |
| `bakllava` | 4.7 GB | Vision (general) | ~30s/image | ~15s/image |
| `llava` | 4.7 GB | Vision (general) | ~30s/image | ~15s/image |
| `LightOnOCR-2` | 1.5 GB | OCR (smaller) | ~10s/image | ~5s/image |

> **Note:** Client-side compression (1024px max, Q0.82 JPEG) is applied before upload. Images are ~80-150 KB instead of ~1.5-3 MB, which dramatically speeds up the CLIP vision encoder (~4× faster). The timings below reflect compressed input.
>
> **Measured improvement (glm-ocr, Intel Arc GPU):**
> - Full-size image (1529 KB base64): **114s** (CLIP: 102s + generation: 6s)
> - Compressed (1024px): estimated **~32s** (CLIP: ~26s + generation: 6s)
> - Speedup: **3.6× faster**

To change the model, update the `OLLAMA_MODEL` environment variable or the default in `src/lib/ollama.ts`:

```bash
# Option A: environment variable
set OLLAMA_MODEL=LightOnOCR-2   # Windows
export OLLAMA_MODEL=LightOnOCR-2  # Linux/Mac

# Option B: hardcoded in src/lib/ollama.ts
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "LightOnOCR-2";
```

## GPU Acceleration

Ollama supports GPU acceleration via CUDA (NVIDIA), ROCm (AMD), and Vulkan (Intel). GPU significantly speeds up model inference.

### Check if Ollama detects your GPU

Look at the Ollama server log after starting:

```bash
# Log location (Windows)
type "%LOCALAPPDATA%\Ollama\server.log" | findstr /i "GPU Vulkan dropping"

# Log location (Linux)
cat ~/.ollama/logs/server.log | grep -i "gpu\|vulkan\|dropping"
```

**What to look for:**
- ✅ `Vulkan0 compute buffer size` → GPU is being used
- ❌ `dropping integrated GPU; to enable, set OLLAMA_IGPU_ENABLE=1` → GPU detected but disabled

### Enable Intel Integrated GPU

Intel integrated GPUs (Iris Xe, Arc Graphics in CPUs) are dropped by default. To enable:

**Windows:**
```powershell
# Set permanently (User level)
[System.Environment]::SetEnvironmentVariable("OLLAMA_IGPU_ENABLE", "1", "User")

# Then restart Ollama
```

**Linux:**
```bash
# Add to ~/.bashrc or ~/.profile
export OLLAMA_IGPU_ENABLE=1

# Or pass when starting Ollama
OLLAMA_IGPU_ENABLE=1 ollama serve
```

**macOS:** Not applicable — macOS uses Metal by default.

### NVIDIA GPU (CUDA)

CUDA is auto-detected. No extra config needed if drivers are installed. To verify:

```bash
# Check CUDA is available
nvidia-smi

# Check Ollama uses it
ollama ps
# Look for GPU column showing your NVIDIA GPU name
```

### AMD GPU (ROCm)

ROCm is auto-detected on supported GPUs. Ensure ROCm drivers are installed.

```bash
# Verify ROCm
rocm-smi

# If not detected, try:
HSA_OVERRIDE_GFX_VERSION=10.3.0 ollama serve
```

## Verify GPU is Working

### Method 1: Check VRAM usage

```bash
# Load a model, then check
ollama run glm-ocr
# In another terminal:
curl http://localhost:11434/api/ps
```

Look for `size_vram` in the response:
- `size_vram: 0` → CPU only ❌
- `size_vram: > 0` → GPU active ✅

### Method 2: Check server log

```bash
# After loading a model, check for GPU buffer allocations
grep "Vulkan\|CUDA\|compute buffer" ~/.ollama/logs/server.log | tail -5
```

Expected output:
```
Vulkan0 KV buffer size = 512.00 MiB
Vulkan0 compute buffer size = 90.03 MiB
CLIP using Vulkan0 backend
```

### Method 3: Benchmark

```bash
# Quick timing test
time curl -s http://localhost:11434/api/chat -d '{
  "model": "glm-ocr",
  "messages": [{"role":"user","content":"Say hi","images":["BASE64_IMAGE"]}],
  "stream": false
}'
```

Compare warm-up vs second run:
- **Warm-up (first run):** Model loading — slower, ~60-80s
- **Second run:** Model in memory — actual speed, ~5-8s

## Performance Tips

| Tip | Impact |
|-----|--------|
| Client-side resize (1024px, Q0.82) | **Biggest win** — images 20-50× smaller, CLIP ~3-4× faster |
| Keep model loaded (don't unload) | Avoids 60-80s warm-up penalty |
| Use GPU | ~25-50% faster inference |
| Smaller model (`LightOnOCR-2`) | Faster but less accurate |

## Ollama Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `OLLAMA_HOST` | `http://localhost:11434` | API bind address |
| `OLLAMA_MODEL` | `glm-ocr` | Model for OCR scanning |
| `OLLAMA_IGPU_ENABLE` | `0` | Set to `1` to enable Intel integrated GPU |
| `OLLAMA_VULKAN` | `true` | Enable Vulkan GPU backend |
| `OLLAMA_NUM_PARALLEL` | `1` | Concurrent requests (keep at 1 for stability) |
| `OLLAMA_KEEP_ALIVE` | `5m` | How long to keep model loaded after last request |
| `OLLAMA_CONTEXT_LENGTH` | `8192` | Max context window |

## Troubleshooting

### "Ollama offline" / "fetch failed" in the app

```bash
# Check Ollama is running
curl http://localhost:11434/api/tags

# If not running
ollama serve
```

### Model not found

```bash
# List installed models
ollama list

# Pull the required model
ollama pull glm-ocr
```

### GPU not detected

1. Check GPU drivers are up to date
2. Check Ollama log for errors: `type %LOCALAPPDATA%\Ollama\server.log`
3. For Intel: ensure `OLLAMA_IGPU_ENABLE=1` is set and Ollama is restarted
4. For NVIDIA: ensure CUDA toolkit is installed (`nvidia-smi` works)

### Slow first scan (~70s)

This is normal — the model loads from disk into GPU/CPU memory on first use. Subsequent scans are fast. The app keeps the model alive for 5 minutes by default (`OLLAMA_KEEP_ALIVE`).

With client-side compression, subsequent scans are ~15-30s depending on GPU availability and image content.
