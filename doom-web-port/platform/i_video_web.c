/*
 * Browser video/input backend for the original Linux DOOM 1.10 engine.
 * Added for this web port. The game renderer still produces the original
 * 320x200 8-bit paletted frame; this backend expands it to RGBA for Canvas.
 */
#include <stdlib.h>
#include <string.h>
#include <stdio.h>
#include <emscripten.h>
#include <emscripten/html5.h>
#ifdef false
#undef false
#endif
#ifdef true
#undef true
#endif

#include "doomdef.h"
#include "doomstat.h"
#include "d_event.h"
#include "i_system.h"
#include "i_video.h"
#include "v_video.h"

extern void D_PostEvent(event_t *ev);

static unsigned char *rgba_frame = NULL;
static unsigned char web_palette[256][4];
static unsigned int web_palette32[256];
static int graphics_ready = 0;
static int mouse_buttons = 0;
static int web_modern_controls = 1;
static int web_mouse_sensitivity = 4;
static int web_vertical_mouse_movement = 0;

static int Web_TranslateKey(int code)
{
    switch (code)
    {
        case 37: return KEY_LEFTARROW;
        case 38: return KEY_UPARROW;
        case 39: return KEY_RIGHTARROW;
        case 40: return KEY_DOWNARROW;
        case 27: return KEY_ESCAPE;
        case 13: return KEY_ENTER;
        case 9:  return KEY_TAB;
        case 8:  return KEY_BACKSPACE;
        case 19: return KEY_PAUSE;
        case 16: return KEY_RSHIFT;
        case 17: return KEY_RCTRL;
        case 18: return KEY_RALT;
        case 32: return ' '; /* Space: use / open */
        case 112: return KEY_F1;
        case 113: return KEY_F2;
        case 114: return KEY_F3;
        case 115: return KEY_F4;
        case 116: return KEY_F5;
        case 117: return KEY_F6;
        case 118: return KEY_F7;
        case 119: return KEY_F8;
        case 120: return KEY_F9;
        case 121: return KEY_F10;
        case 122: return KEY_F11;
        case 123: return KEY_F12;

        /* WASD and modern FPS mapping */
        case 87: return KEY_UPARROW;
        case 83: return KEY_DOWNARROW;
        case 65: return web_modern_controls ? ',' : KEY_LEFTARROW;
        case 68: return web_modern_controls ? '.' : KEY_RIGHTARROW;
        case 81: return KEY_LEFTARROW;  /* Q turns left in modern mode */
        case 69: return web_modern_controls ? ' ' : 'e'; /* E uses/opens in modern mode */

        default:
            if (code >= 'A' && code <= 'Z') return code - 'A' + 'a';
            if (code >= 32 && code <= 126) return code;
            return -1;
    }
}

static void Web_PostKey(int key, int down)
{
    event_t ev;
    if (key < 0) return;
    ev.type = down ? ev_keydown : ev_keyup;
    ev.data1 = key;
    ev.data2 = 0;
    ev.data3 = 0;
    D_PostEvent(&ev);
}

static EM_BOOL Web_KeyDown(int eventType, const EmscriptenKeyboardEvent *e, void *userData)
{
    int key = Web_TranslateKey(e->keyCode);
    (void)eventType;
    (void)userData;
    if (key < 0) return EM_FALSE;
    if (!e->repeat) Web_PostKey(key, 1);
    return EM_TRUE;
}

static EM_BOOL Web_KeyUp(int eventType, const EmscriptenKeyboardEvent *e, void *userData)
{
    int key = Web_TranslateKey(e->keyCode);
    (void)eventType;
    (void)userData;
    if (key < 0) return EM_FALSE;
    Web_PostKey(key, 0);
    return EM_TRUE;
}

static EM_BOOL Web_MouseDown(int eventType, const EmscriptenMouseEvent *e, void *userData)
{
    event_t ev;
    (void)eventType;
    (void)userData;
    if (e->button == 0) mouse_buttons |= 1;
    else if (e->button == 1) mouse_buttons |= 2;
    else if (e->button == 2) mouse_buttons |= 4;
    ev.type = ev_mouse;
    ev.data1 = mouse_buttons;
    ev.data2 = ev.data3 = 0;
    D_PostEvent(&ev);
    return EM_TRUE;
}

static EM_BOOL Web_MouseUp(int eventType, const EmscriptenMouseEvent *e, void *userData)
{
    event_t ev;
    (void)eventType;
    (void)userData;
    if (e->button == 0) mouse_buttons &= ~1;
    else if (e->button == 1) mouse_buttons &= ~2;
    else if (e->button == 2) mouse_buttons &= ~4;
    ev.type = ev_mouse;
    ev.data1 = mouse_buttons;
    ev.data2 = ev.data3 = 0;
    D_PostEvent(&ev);
    return EM_TRUE;
}

static EM_BOOL Web_MouseMove(int eventType, const EmscriptenMouseEvent *e, void *userData)
{
    event_t ev;
    (void)eventType;
    (void)userData;
    if (!e->movementX && !e->movementY) return EM_FALSE;
    ev.type = ev_mouse;
    ev.data1 = mouse_buttons;
    ev.data2 = e->movementX * web_mouse_sensitivity;
    if (web_modern_controls && !web_vertical_mouse_movement) {
        ev.data3 = 0;
    } else {
        ev.data3 = -e->movementY * web_mouse_sensitivity;
    }
    D_PostEvent(&ev);
    return EM_TRUE;
}

/* Called by the mobile touch controls or JavaScript event system. */
EMSCRIPTEN_KEEPALIVE
void Web_KeyEvent(int key, int down)
{
    Web_PostKey(key, down);
}

EMSCRIPTEN_KEEPALIVE
void Web_MouseEvent(int buttons, int dx, int dy)
{
    event_t ev;
    ev.type = ev_mouse;
    ev.data1 = buttons;
    ev.data2 = dx;
    ev.data3 = dy;
    D_PostEvent(&ev);
}

EMSCRIPTEN_KEEPALIVE
void Web_SetModernControls(int enable)
{
    web_modern_controls = enable ? 1 : 0;
}

EMSCRIPTEN_KEEPALIVE
void Web_SetVerticalMouse(int enable)
{
    web_vertical_mouse_movement = enable ? 1 : 0;
}

EMSCRIPTEN_KEEPALIVE
void Web_SetMouseSensitivity(int sens)
{
    if (sens < 1) sens = 1;
    if (sens > 30) sens = 30;
    web_mouse_sensitivity = sens;
}

void I_InitGraphics(void)
{
    int i;
    if (graphics_ready) return;

    rgba_frame = (unsigned char *)malloc(SCREENWIDTH * SCREENHEIGHT * 4);
    if (!rgba_frame) I_Error("Not enough memory for web video buffer");

    for (i = 0; i < 256; ++i)
    {
        web_palette[i][0] = (unsigned char)i;
        web_palette[i][1] = (unsigned char)i;
        web_palette[i][2] = (unsigned char)i;
        web_palette[i][3] = 255;
    }

    emscripten_set_keydown_callback(EMSCRIPTEN_EVENT_TARGET_DOCUMENT, NULL, EM_FALSE, Web_KeyDown);
    emscripten_set_keyup_callback(EMSCRIPTEN_EVENT_TARGET_DOCUMENT, NULL, EM_FALSE, Web_KeyUp);
    emscripten_set_mousedown_callback("#canvas", NULL, EM_FALSE, Web_MouseDown);
    emscripten_set_mouseup_callback("#canvas", NULL, EM_FALSE, Web_MouseUp);
    emscripten_set_mousemove_callback("#canvas", NULL, EM_FALSE, Web_MouseMove);
    graphics_ready = 1;
}

void I_ShutdownGraphics(void)
{
    if (!graphics_ready) return;
    emscripten_set_keydown_callback(EMSCRIPTEN_EVENT_TARGET_DOCUMENT, NULL, EM_FALSE, NULL);
    emscripten_set_keyup_callback(EMSCRIPTEN_EVENT_TARGET_DOCUMENT, NULL, EM_FALSE, NULL);
    emscripten_set_mousedown_callback("#canvas", NULL, EM_FALSE, NULL);
    emscripten_set_mouseup_callback("#canvas", NULL, EM_FALSE, NULL);
    emscripten_set_mousemove_callback("#canvas", NULL, EM_FALSE, NULL);
    free(rgba_frame);
    rgba_frame = NULL;
    graphics_ready = 0;
}

void I_StartFrame(void) { }
void I_StartTic(void) { }
void I_UpdateNoBlit(void) { }
void I_BeginRead(void) { }
void I_EndRead(void) { }
void I_WaitVBL(int count) { (void)count; }

void I_SetPalette(byte *palette)
{
    int i;
    if (!palette) return;
    for (i = 0; i < 256; ++i)
    {
        int r = gammatable[usegamma][*palette++];
        int g = gammatable[usegamma][*palette++];
        int b = gammatable[usegamma][*palette++];
        web_palette[i][0] = (unsigned char)r;
        web_palette[i][1] = (unsigned char)g;
        web_palette[i][2] = (unsigned char)b;
        web_palette[i][3] = 255;
        web_palette32[i] = (unsigned int)(0xFF000000U | ((unsigned int)b << 16) | ((unsigned int)g << 8) | (unsigned int)r);
    }
}

void I_FinishUpdate(void)
{
    int i;
    unsigned char *src;
    unsigned int *dst32;
    if (!graphics_ready || !screens[0]) return;

    src = screens[0];
    dst32 = (unsigned int *)rgba_frame;
    for (i = 0; i < SCREENWIDTH * SCREENHEIGHT; ++i)
    {
        dst32[i] = web_palette32[src[i]];
    }

    EM_ASM(({
        var canvas = Module.canvas;
        if (!canvas) return;
        var ctx = Module.__doomCtx;
        if (!ctx) {
            ctx = Module.__doomCtx = canvas.getContext('2d', { alpha: false });
        }
        if (!ctx) return;
        var w = $1;
        var h = $2;
        var frame = Module.__doomFrame;
        if (!frame || frame.width !== w || frame.height !== h) {
            frame = Module.__doomFrame = ctx.createImageData(w, h);
        }
        frame.data.set(HEAPU8.subarray($0, $0 + w * h * 4));
        ctx.putImageData(frame, 0, 0);
    }), rgba_frame, SCREENWIDTH, SCREENHEIGHT);
}

void I_ReadScreen(byte *scr)
{
    if (scr && screens[0]) memcpy(scr, screens[0], SCREENWIDTH * SCREENHEIGHT);
}
