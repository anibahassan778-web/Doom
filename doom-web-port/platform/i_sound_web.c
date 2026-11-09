/*
 * Web Audio backend. The 1997 Linux port already contains a software
 * sound-effect mixer; this file keeps that mixer and streams its PCM output
 * to the browser's Web Audio API. Background music remains a no-op, as it
 * was in the original Linux backend.
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <emscripten.h>
#ifdef false
#undef false
#endif
#ifdef true
#undef true
#endif

#include "doomdef.h"
#include "doomstat.h"
#include "sounds.h"
#include "z_zone.h"
#include "i_system.h"
#include "i_sound.h"
#include "m_argv.h"
#include "m_misc.h"
#include "w_wad.h"

#define SAMPLECOUNT 320
#define NUM_CHANNELS 8
#define BUFMUL 4
#define MIXBUFFERSIZE (SAMPLECOUNT * BUFMUL)
#define SAMPLERATE 11025

int lengths[NUMSFX];
static signed short mixbuffer[MIXBUFFERSIZE];
static unsigned int channelstep[NUM_CHANNELS];
static unsigned int channelstepremainder[NUM_CHANNELS];
static unsigned char *channels[NUM_CHANNELS];
static unsigned char *channelsend[NUM_CHANNELS];
static int channelstart[NUM_CHANNELS];
static int channelhandles[NUM_CHANNELS];
static int channelids[NUM_CHANNELS];
static int steptable[256];
static int vol_lookup[128 * 256];
static int *channelleftvol_lookup[NUM_CHANNELS];
static int *channelrightvol_lookup[NUM_CHANNELS];
static int sound_initialized = 0;
char *sndserver_filename = "./sndserver ";

static void *Web_GetSfx(char *sfxname, int *len)
{
    unsigned char *sfx;
    unsigned char *padded;
    int i, size, paddedsize, lump;
    char name[20];

    sprintf(name, "ds%s", sfxname);
    lump = (W_CheckNumForName(name) == -1)
         ? W_GetNumForName("dspistol") : W_GetNumForName(name);
    size = W_LumpLength(lump);
    sfx = (unsigned char *)W_CacheLumpNum(lump, PU_STATIC);
    paddedsize = ((size - 8 + (SAMPLECOUNT - 1)) / SAMPLECOUNT) * SAMPLECOUNT;
    if (paddedsize < SAMPLECOUNT) paddedsize = SAMPLECOUNT;
    padded = (unsigned char *)Z_Malloc((size_t)paddedsize + 8, PU_STATIC, 0);
    memcpy(padded, sfx, (size_t)size);
    for (i = size; i < paddedsize + 8; ++i) padded[i] = 128;
    Z_Free(sfx);
    *len = paddedsize;
    return (void *)(padded + 8);
}

void I_SetChannels(void)
{
    int i, j;
    int *mid = steptable + 128;
    for (i = -128; i < 128; ++i)
        mid[i] = (int)(pow(2.0, i / 64.0) * 65536.0);
    for (i = 0; i < 128; ++i)
        for (j = 0; j < 256; ++j)
            vol_lookup[i * 256 + j] = (i * (j - 128) * 256) / 127;
}

void I_SetSfxVolume(int volume) { snd_SfxVolume = volume; EM_ASM(({ if (window.onDoomSetSfxVolume) window.onDoomSetSfxVolume($0); }), volume); }
void I_SetMusicVolume(int volume) { snd_MusicVolume = volume; EM_ASM(({ if (window.onDoomSetMusicVolume) window.onDoomSetMusicVolume($0); }), volume); }

int I_GetSfxLumpNum(sfxinfo_t *sfx)
{
    char namebuf[9];
    sprintf(namebuf, "ds%s", sfx->name);
    return W_GetNumForName(namebuf);
}

static int Web_AddSfx(int sfxid, int volume, int step, int separation)
{
    static unsigned short handles = 100;
    int i, slot = 0, oldest = gametic, oldestslot = 0;
    int leftvol, rightvol;

    if (sfxid == sfx_sawup || sfxid == sfx_sawidl || sfxid == sfx_sawful ||
        sfxid == sfx_sawhit || sfxid == sfx_stnmov || sfxid == sfx_pistol)
    {
        for (i = 0; i < NUM_CHANNELS; ++i)
            if (channels[i] && channelids[i] == sfxid)
            {
                channels[i] = NULL;
                break;
            }
    }

    for (i = 0; i < NUM_CHANNELS && channels[i]; ++i)
    {
        if (channelstart[i] < oldest)
        {
            oldestslot = i;
            oldest = channelstart[i];
        }
    }
    slot = (i == NUM_CHANNELS) ? oldestslot : i;

    channels[slot] = (unsigned char *)S_sfx[sfxid].data;
    channelsend[slot] = channels[slot] + lengths[sfxid];
    if (++handles == 0) handles = 100;
    channelhandles[slot] = handles;
    channelstep[slot] = (unsigned int)step;
    channelstepremainder[slot] = 0;
    channelstart[slot] = gametic;

    separation += 1;
    leftvol = volume - ((volume * separation * separation) >> 16);
    separation -= 257;
    rightvol = volume - ((volume * separation * separation) >> 16);
    if (rightvol < 0) rightvol = 0;
    if (rightvol > 127) rightvol = 127;
    if (leftvol < 0) leftvol = 0;
    if (leftvol > 127) leftvol = 127;
    channelleftvol_lookup[slot] = &vol_lookup[leftvol * 256];
    channelrightvol_lookup[slot] = &vol_lookup[rightvol * 256];
    channelids[slot] = sfxid;
    return channelhandles[slot];
}

int I_StartSound(int id, int vol, int sep, int pitch, int priority)
{
    (void)priority;
    if (!sound_initialized || id <= 0 || id >= NUMSFX || !S_sfx[id].data) return -1;
    return Web_AddSfx(id, vol, steptable[pitch & 255], sep);
}

void I_StopSound(int handle)
{
    int i;
    for (i = 0; i < NUM_CHANNELS; ++i)
        if (channels[i] && channelhandles[i] == handle) channels[i] = NULL;
}

int I_SoundIsPlaying(int handle)
{
    int i;
    for (i = 0; i < NUM_CHANNELS; ++i)
        if (channels[i] && channelhandles[i] == handle) return 1;
    return 0;
}

void I_UpdateSound(void)
{
    int n, ch;
    for (n = 0; n < SAMPLECOUNT; ++n)
    {
        int left = 0, right = 0;
        for (ch = 0; ch < NUM_CHANNELS; ++ch)
        {
            if (channels[ch])
            {
                unsigned int sample = *channels[ch];
                left += channelleftvol_lookup[ch][sample];
                right += channelrightvol_lookup[ch][sample];
                channelstepremainder[ch] += channelstep[ch];
                channels[ch] += channelstepremainder[ch] >> 16;
                channelstepremainder[ch] &= 65535;
                if (channels[ch] >= channelsend[ch]) channels[ch] = NULL;
            }
        }
        if (left > 32767) left = 32767;
        if (left < -32768) left = -32768;
        if (right > 32767) right = 32767;
        if (right < -32768) right = -32768;
        mixbuffer[n * 2] = (short)left;
        mixbuffer[n * 2 + 1] = (short)right;
    }
}

void I_SubmitSound(void)
{
    EM_ASM(({
        var ctx = window.__doomAudioContext;
        if (!ctx) return;
        var now = ctx.currentTime;
        if (window.__doomAudioNextTime == null || window.__doomAudioNextTime < now)
            window.__doomAudioNextTime = now;
        /* Keep the queue bounded if the tab was backgrounded. */
        if (window.__doomAudioNextTime > now + 0.12)
            window.__doomAudioNextTime = now;
        var count = $1;
        var pcm = HEAP16.subarray($0 >> 1, ($0 >> 1) + count * 2);
        var buffer = ctx.createBuffer(2, count, $2);
        var l = buffer.getChannelData(0);
        var r = buffer.getChannelData(1);
        for (var i = 0; i < count; ++i) {
            l[i] = pcm[i * 2] / 32768;
            r[i] = pcm[i * 2 + 1] / 32768;
        }
        var source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        source.start(window.__doomAudioNextTime);
        window.__doomAudioNextTime += buffer.duration;
    }), mixbuffer, SAMPLECOUNT, SAMPLERATE);
}

void I_UpdateSoundParams(int handle, int vol, int sep, int pitch)
{
    (void)handle; (void)vol; (void)sep; (void)pitch;
}

void I_InitSound(void)
{
    int i;
    memset(channels, 0, sizeof(channels));
    memset(mixbuffer, 0, sizeof(mixbuffer));
    memset(channelids, 0, sizeof(channelids));
    memset(channelhandles, 0, sizeof(channelhandles));
    for (i = 1; i < NUMSFX; ++i)
    {
        if (!S_sfx[i].link)
            S_sfx[i].data = Web_GetSfx(S_sfx[i].name, &lengths[i]);
        else
        {
            S_sfx[i].data = S_sfx[i].link->data;
            lengths[i] = lengths[(S_sfx[i].link - S_sfx) / sizeof(sfxinfo_t)];
        }
    }
    sound_initialized = 1;
}

void I_ShutdownSound(void) { sound_initialized = 0; }

void I_InitMusic(void) {
    EM_ASM(({
        if (window.onDoomInitMusic) window.onDoomInitMusic();
    }));
}

void I_ShutdownMusic(void) {
    EM_ASM(({
        if (window.onDoomShutdownMusic) window.onDoomShutdownMusic();
    }));
}

static int song_playing_handle = 0;

void I_PlaySong(int handle, int looping) {
    song_playing_handle = handle;
    EM_ASM(({
        if (window.onDoomPlaySong) window.onDoomPlaySong($0, $1);
    }), handle, looping);
}

void I_PauseSong(int handle) {
    (void)handle;
    EM_ASM(({
        if (window.onDoomPauseSong) window.onDoomPauseSong($0);
    }), handle);
}

void I_ResumeSong(int handle) {
    (void)handle;
    EM_ASM(({
        if (window.onDoomResumeSong) window.onDoomResumeSong($0);
    }), handle);
}

void I_StopSong(int handle) {
    song_playing_handle = 0;
    EM_ASM(({
        if (window.onDoomStopSong) window.onDoomStopSong($0);
    }), handle);
}

void I_UnRegisterSong(int handle) {
    EM_ASM(({
        if (window.onDoomUnregisterSong) window.onDoomUnregisterSong($0);
    }), handle);
}

int I_RegisterSong(void *data) {
    int i;
    for (i = 0; i < NUMMUSIC; ++i) {
        if (S_music[i].data == data) {
            int len = (S_music[i].lumpnum >= 0) ? W_LumpLength(S_music[i].lumpnum) : 0;
            int handle = i + 1;
            EM_ASM(({
                var songName = UTF8ToString($0);
                var ptr = $1;
                var len = $2;
                var h = $3;
                if (window.onDoomRegisterSong) {
                    window.onDoomRegisterSong(h, songName, ptr, len);
                }
            }), S_music[i].name, (int)data, len, handle);
            return handle;
        }
    }
    static int fallback_handle = 1000;
    return fallback_handle++;
}

int I_QrySongPlaying(int handle) {
    return (song_playing_handle == handle && handle != 0);
}

