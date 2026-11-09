/* Browser entry point and explicit launcher for the original game engine. */
#include <stdlib.h>
#include <emscripten.h>
#ifdef false
#undef false
#endif
#ifdef true
#undef true
#endif
#include "doomdef.h"
#include "m_argv.h"
#include "d_main.h"

int main(int argc, char **argv)
{
    /* The browser UI starts the engine explicitly after the user chooses an IWAD. */
    (void)argc;
    (void)argv;
    return 0;
}

EMSCRIPTEN_KEEPALIVE
void Web_StartGameWithArgs(const char *cmd_line)
{
    static char app_name[] = "doom";
    static char *web_argv[32];
    static char buffer[1024];
    int count = 0;
    char *token;

    setenv("DOOMWADDIR", "/doom", 1);
    setenv("HOME", "/home/web_user", 1);

    web_argv[count++] = app_name;

    if (cmd_line && *cmd_line)
    {
        strncpy(buffer, cmd_line, sizeof(buffer) - 1);
        buffer[sizeof(buffer) - 1] = '\0';
        token = strtok(buffer, " ");
        while (token && count < 30)
        {
            web_argv[count++] = token;
            token = strtok(NULL, " ");
        }
    }
    web_argv[count] = NULL;
    myargc = count;
    myargv = web_argv;
    D_DoomMain();
}

EMSCRIPTEN_KEEPALIVE
void Web_StartGame(void)
{
    Web_StartGameWithArgs("");
}
