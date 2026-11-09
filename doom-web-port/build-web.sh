#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC="$ROOT/source/DOOM-master/linuxdoom-1.10"
OUT="$ROOT/web"

if ! command -v emcc >/dev/null 2>&1; then
  echo "Error: emcc was not found. Install and activate the Emscripten SDK first." >&2
  echo "See: https://emscripten.org/docs/getting_started/downloads.html" >&2
  exit 1
fi

mkdir -p "$OUT"
mapfile -t ENGINE_SOURCES < <(
  find "$SRC" -maxdepth 1 -type f -name '*.c' \
    ! -name 'i_main.c' \
    ! -name 'i_system.c' \
    ! -name 'i_video.c' \
    ! -name 'i_sound.c' \
    ! -name 'i_net.c' \
    | sort
)

emcc \
  "${ENGINE_SOURCES[@]}" \
  "$ROOT/platform/i_main_web.c" \
  "$ROOT/platform/i_system_web.c" \
  "$ROOT/platform/i_video_web.c" \
  "$ROOT/platform/i_sound_web.c" \
  "$ROOT/platform/i_net_web.c" \
  -I"$SRC" \
  -DNORMALUNIX -D__EMSCRIPTEN__ \
  -O2 -std=gnu89 \
  -Wno-implicit-function-declaration -Wno-int-conversion \
  -sALLOW_MEMORY_GROWTH=1 \
  -sINITIAL_MEMORY=67108864 \
  -sMAXIMUM_MEMORY=536870912 \
  -sTOTAL_STACK=2097152 \
  -sFORCE_FILESYSTEM=1 \
  -sEXIT_RUNTIME=0 \
  -sENVIRONMENT=web \
  -sEXPORTED_FUNCTIONS='["_main","_Web_StartGame","_Web_StartGameWithArgs","_Web_KeyEvent","_Web_MouseEvent","_Web_SetModernControls","_Web_SetMouseSensitivity","_Web_SetVerticalMouse"]' \
  -sEXPORTED_RUNTIME_METHODS='["FS","ccall","cwrap","UTF8ToString"]' \
  -sASSERTIONS=1 \
  -o "$OUT/doom.js"

echo
echo "Build complete: $OUT/doom.js and $OUT/doom.wasm"
echo "Serve the web folder over HTTP; do not open index.html as file://."
