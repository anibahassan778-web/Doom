# Port notes

- Source baseline: `DOOM-master/linuxdoom-1.10` from the user-provided archive.
- Original Linux platform backends remain in the source tree unchanged; the web build excludes them.
- New browser backends: `platform/i_video_web.c`, `platform/i_sound_web.c`, `platform/i_system_web.c`, `platform/i_net_web.c`, and `platform/i_main_web.c`.
- `d_main.c` was modified to schedule the original game loop through the browser animation loop under `__EMSCRIPTEN__`.
- The browser accepts one IWAD file and maps its selected variant to the canonical filename expected by `IdentifyVersion()`.
- No commercial WAD data is included.
