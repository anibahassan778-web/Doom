/* Single-player browser network shim. Multiplayer is intentionally disabled. */
#include <stdlib.h>
#include <string.h>
#include "doomdef.h"
#include "doomstat.h"
#include "d_net.h"
#include "i_system.h"

extern doomcom_t *doomcom;

void I_InitNetwork(void)
{
    doomcom = (doomcom_t *)malloc(sizeof(*doomcom));
    if (!doomcom) I_Error("Not enough memory for network state");
    memset(doomcom, 0, sizeof(*doomcom));
    doomcom->id = DOOMCOM_ID;
    doomcom->numnodes = 1;
    doomcom->ticdup = 1;
    doomcom->extratics = 0;
    doomcom->consoleplayer = 0;
    doomcom->numplayers = 1;
    doomcom->remotenode = -1;
    netgame = false;
}

void I_NetCmd(void)
{
    if (!doomcom) return;
    doomcom->remotenode = -1;
}
