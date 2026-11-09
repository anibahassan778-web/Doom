export type EngineStatus =
  | 'idle'
  | 'loading-wasm'
  | 'wasm-ready'
  | 'starting'
  | 'running'
  | 'paused'
  | 'stopped'
  | 'error';

export interface GameSettings {
  mouseSensitivity: number; // 1 - 20 (default 4)
  verticalMouseMovement: boolean; // Classic forward/backward walk on vertical mouse (default false)
  modernControls: boolean; // WASD + mouse strafe (default true)
  soundVolume: number; // 0 - 100 (default 80)
  musicVolume: number; // 0 - 100 (default 80)
  muted: boolean;
  aspectRatio: '4:3' | 'fill' | 'stretch';
  crtScanlines: boolean;
  showTelemetry: boolean;
  touchControlsEnabled: boolean;
  touchOpacity: number; // 0.2 - 1.0 (default 0.75)
  touchScale: 'small' | 'medium' | 'large';
  haptics: boolean;
}

export interface EmscriptenDoomModule {
  canvas?: HTMLCanvasElement | null;
  noInitialRun?: boolean;
  locateFile?: (path: string, scriptDirectory: string) => string;
  print?: (...args: unknown[]) => void;
  printErr?: (...args: unknown[]) => void;
  onRuntimeInitialized?: () => void;
  onAbort?: (reason: unknown) => void;
  FS?: {
    mkdir: (path: string) => void;
    unlink: (path: string) => void;
    writeFile: (path: string, data: Uint8Array | string) => void;
    readFile: (path: string, opts?: { encoding?: 'binary' | 'utf8' }) => Uint8Array;
    readdir: (path: string) => string[];
    analyzePath: (path: string) => { exists: boolean };
  };
  _main?: (argc: number, argv: number) => number;
  _Web_StartGame?: () => void;
  _Web_StartGameWithArgs?: (argsPtr: number) => void;
  _Web_KeyEvent?: (key: number, down: number) => void;
  _Web_MouseEvent?: (buttons: number, dx: number, dy: number) => void;
  _Web_SetModernControls?: (enable: number) => void;
  _Web_SetMouseSensitivity?: (sens: number) => void;
  _Web_SetVerticalMouse?: (enable: number) => void;
  stringToUTF8?: (str: string, outPtr: number, maxBytes: number) => void;
  allocateUTF8?: (str: string) => number;
  _free?: (ptr: number) => void;
  HEAPU8?: Uint8Array;
  __doomCtx?: CanvasRenderingContext2D | null;
  __doomFrame?: ImageData | null;
  __doomImageData?: ImageData | null;
}

declare global {
  interface Window {
    Module?: EmscriptenDoomModule;
    __doomAudioContext?: AudioContext | null;
    __doomAudioNextTime?: number | null;
    __doomMusicSynth?: unknown;
    onDoomStopped?: () => void;
    onDoomError?: (msg: string) => void;
    onDoomSetSfxVolume?: (vol: number) => void;
    onDoomSetMusicVolume?: (vol: number) => void;
    onDoomRegisterSong?: (handle: number, name: string, ptr: number, len: number) => void;
    onDoomUnregisterSong?: (handle: number) => void;
    onDoomInitMusic?: () => void;
    onDoomShutdownMusic?: () => void;
    onDoomPlaySong?: (handle: number, looping: number) => void;
    onDoomPauseSong?: (handle: number) => void;
    onDoomResumeSong?: (handle: number) => void;
    onDoomStopSong?: (handle: number) => void;
  }
}

