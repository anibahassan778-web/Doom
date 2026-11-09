# Original DOOM 1.10 — WebAssembly Port

A fully functional, native browser port of the original **Linux DOOM 1.10** engine compiled directly to WebAssembly using Emscripten. The original C game simulation, physics, monster AI, BSP traversal, and 8-bit software renderer run inside WebAssembly at 35 Hz, with video presented via HTML5 Canvas (320×200), sound mixed in C and streamed to the Web Audio API, and input handled via Pointer Lock mouse aiming, keyboard, and virtual mobile touchscreen controls.

---

## Technical Architecture

```
+--------------------------------------------------------------+
|                     Browser Client                            |
|                                                              |
|   +-----------------------+     +------------------------+   |
|   |   HTML5 Canvas (2D)   |     |     Web Audio API      |   |
|   |  320x200 pixelated    |     | 11,025 Hz Stereo PCM   |   |
|   +-----------^-----------+     +-----------^------------+   |
|               |                             |                |
|               | putImageData()              | AudioBuffer    |
|   +-----------+-----------------------------+------------+   |
|   |         Emscripten JavaScript Glue Layer (doom.js)    |   |
|   +-----------------------^------------------------------+   |
|                           |                                  |
|   +-----------------------v------------------------------+   |
|   |              WebAssembly Engine (doom.wasm)           |   |
|   |                                                      |   |
|   |  • i_main_web.c     : Web entry point & argv loader  |   |
|   |  • i_video_web.c    : 32-bit RGBA blitter & inputs   |   |
|   |  • i_sound_web.c    : 8-channel PCM mixer backend    |   |
|   |  • i_system_web.c   : High-res timer & memory heap   |   |
|   |  • i_net_web.c      : Single-player network shim     |   |
|   |  • linuxdoom-1.10/* : Original DOOM 1.10 C codebase  |   |
|   +------------------------------------------------------+   |
+--------------------------------------------------------------+
```

---

## Features

- **Genuine Original Engine**: Uses the real 1997 `linuxdoom-1.10` source code released by id Software.
- **Pixel-Accurate Software Rendering**: Computes columns and spans in C, expanded to 320×200 32-bit RGBA and blitted to Canvas.
- **Desktop Controls**:
  - Modern WASD + Mouse Strafing (A/D strafes, mouse look turns player).
  - Classic Arrow keys + Turn mode option.
  - Left Mouse Click / Ctrl shooting.
  - Space / E for doors, switches, and elevators.
  - Shift for running / sprinting.
  - 1–7 direct weapon switching.
  - Tab for automap and Esc for in-game menu.
  - HTML5 Pointer Lock API for smooth mouse look without cursor drift.
- **Mobile Touchscreen Controls**:
  - Virtual analog movement joystick with configurable deadzone.
  - Dedicated tactile FIRE button.
  - USE and RUN toggle buttons.
  - Quick weapon belt bar (1–7) with next/previous buttons.
  - Multi-touch support with haptic feedback (`navigator.vibrate`).
- **Sound Effects**:
  - Authentic 8-channel C sound mixer outputting 11,025 Hz 16-bit stereo PCM.
  - Dynamic volume control synced with DOOM's Options menu.
  - Seamless Web Audio API buffer streaming.
- **WAD Support**:
  - Supports user-supplied IWADs: `DOOM1.WAD`, `DOOM.WAD`, `DOOM2.WAD`, `DOOMU.WAD`, `TNT.WAD`, `PLUTONIA.WAD`.
  - Automatic binary header validator (magic detection, lump count, directory offset check).
  - 1-Click download for public shareware Episode 1 (`DOOM1.WAD`).
  - No copyrighted commercial game assets bundled.
- **Save / Load Persistence**:
  - Engine saves to `doomsav*.dsg` inside Emscripten virtual filesystem (`MEMFS`).
  - Automatic synchronization to browser `localStorage`.
  - Export and Import `.dsg` save files directly via the UI.

---

## Modifications from Original linuxdoom-1.10

1. **Replaced Platform Backends**:
   - `i_video.c` (X11) replaced by `platform/i_video_web.c` (Canvas 2D + HTML5 keyboard/mouse).
   - `i_sound.c` (Linux OSS sound server IPC) replaced by `platform/i_sound_web.c` (Web Audio API buffer streamer).
   - `i_system.c` replaced by `platform/i_system_web.c` (`emscripten_get_now()` timing at 35Hz).
   - `i_net.c` (BSD sockets) replaced by `platform/i_net_web.c` (single-player local network shim).
   - `i_main.c` replaced by `platform/i_main_web.c` (`Web_StartGameWithArgs` entry point).
2. **Game Loop Scheduling**:
   - `d_main.c` modified under `#ifdef __EMSCRIPTEN__` to run via `emscripten_set_main_loop(D_DoomLoopFrame, 0, 0)` rather than blocking in `while(1)`.
3. **C Compatibility Fixes**:
   - `w_wad.c`: `strupr()` updated from `void` to `char *` to match Emscripten libc header declaration.
   - `i_video_web.c` / `i_sound_web.c`: `EM_ASM(({ ... }), ...)` macro calls wrapped in parentheses to prevent C preprocessor macro comma splitting in GNU C mode.
   - Removed duplicated `I_StartFrame`, `I_WaitVBL`, `I_BeginRead`, `I_EndRead` stubs from `i_system_web.c` to prevent wasm-ld link collisions.
   - Added `sndserver_filename` symbol in `i_sound_web.c` to resolve reference from `m_misc.c`.

---

## Building the WebAssembly Binary

### Prerequisites
- Emscripten SDK (`emcc` 3.1+)
- Linux / macOS / WSL environment

### Compilation
From the repository root:

```bash
cd doom-web-port
./build-web.sh
```

This compiles all engine C files and produces:
- `doom-web-port/web/doom.js` (~132 KB)
- `doom-web-port/web/doom.wasm` (~349 KB)

---

## Running the Application

### Option 1: AI Studio / Vite Dev Server (Port 3000)
Run the full React application with industrial HUD and mobile overlay:

```bash
npm run dev
```
Open `http://localhost:3000`.

### Option 2: Standalone Static Server (Port 8000)
Run the standalone HTML interface:

```bash
cd doom-web-port
./serve.sh
```
Open `http://localhost:8000`.

*Note: WebAssembly cannot be loaded via `file://` due to browser CORS policies; always serve over HTTP/HTTPS.*

---

## Known Limitations

- **Multiplayer Network Play**: Multiplayer over TCP/IP or IPX is disabled in this web build; all game sessions run in single-player local mode.
- **Native OPL MIDI**: The original Linux DOOM port did not include a software MIDI synthesizer; music events are tracked and dispatched to JavaScript, while sound effects use the full C software mixer.

---

## License

Original DOOM source code is copyright (C) 1993-1996 id Software, Inc., licensed under the id Software DOOM Source Code License (see `source/DOOM-master/LICENSE.TXT`). Web port adaptations and platform backends are open source.
