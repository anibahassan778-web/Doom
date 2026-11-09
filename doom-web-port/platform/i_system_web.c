/* Browser system backend for DOOM 1.10. */
#include <stdlib.h>
#include <stdio.h>
#include <string.h>
#include <stdarg.h>
#include <emscripten.h>
#ifdef false
#undef false
#endif
#ifdef true
#undef true
#endif

#include "doomdef.h"
#include "doomstat.h"
#include "d_net.h"
#include "g_game.h"
#include "m_misc.h"
#include "i_sound.h"
#include "i_video.h"
#include "i_system.h"

int mb_used = 32;
static double web_time_base = -1.0;

ticcmd_t emptycmd;

ticcmd_t *I_BaseTiccmd(void) { return &emptycmd; }
int I_GetHeapSize(void) {
    if (mb_used < 32) mb_used = 32;
    return mb_used * 1024 * 1024;
}

byte *I_ZoneBase(int *size)
{
    if (mb_used < 32) mb_used = 32;
    *size = mb_used * 1024 * 1024;
    return (byte *)malloc((size_t)*size);
}


int I_GetTime(void)
{
    double now = emscripten_get_now();
    if (web_time_base < 0.0) web_time_base = now;
    return (int)(((now - web_time_base) * TICRATE) / 1000.0);
}

void I_Init(void)
{
    I_InitSound();
}

void I_Quit(void)
{
    D_QuitNetGame();
    I_ShutdownSound();
    I_ShutdownMusic();
    M_SaveDefaults();
    I_ShutdownGraphics();
    emscripten_cancel_main_loop();
    EM_ASM(({
        var s = document.getElementById('runtime-status');
        if (s) s.textContent = 'Game stopped.';
        if (window.onDoomStopped) window.onDoomStopped();
    }));
    exit(0);
}

void I_Tactile(int on, int off, int total) { (void)on; (void)off; (void)total; }

byte *I_AllocLow(int length)
{
    byte *mem = (byte *)malloc((size_t)length);
    if (mem) memset(mem, 0, (size_t)length);
    return mem;
}

extern boolean demorecording;
void I_Error(char *error, ...)
{
    va_list ap;
    char message[2048];
    va_start(ap, error);
    vsnprintf(message, sizeof(message), error, ap);
    va_end(ap);
    fprintf(stderr, "DOOM error: %s\n", message);
    fflush(stderr);
    EM_ASM(({
        var msg = UTF8ToString($0);
        var s = document.getElementById('runtime-status');
        if (s) s.textContent = 'DOOM error: ' + msg;
        var e = document.getElementById('error-panel');
        if (e) {
            e.textContent = msg;
            e.hidden = false;
        }
        if (window.onDoomError) window.onDoomError(msg);
    }), message);
    if (demorecording) G_CheckDemoStatus();
    D_QuitNetGame();
    I_ShutdownGraphics();
    emscripten_cancel_main_loop();
    exit(1);
}
