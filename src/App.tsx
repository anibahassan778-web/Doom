import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Settings,
  FolderOpen,
  RotateCcw,
  Play,
  Square,
  HelpCircle,
  Smartphone,
  Shield,
  Flame,
} from 'lucide-react';
import { EngineStatus, GameSettings, EmscriptenDoomModule } from './types/doom';
import { WadInfo } from './utils/wadParser';
import { syncSavesFromStorageToFS, syncSavesFromFSToStorage } from './utils/saveGameManager';
import { DoomScreen } from './components/DoomScreen';
import { VirtualControls } from './components/VirtualControls';
import { WadLoaderModal } from './components/WadLoaderModal';
import { SettingsModal } from './components/SettingsModal';

const DEFAULT_SETTINGS: GameSettings = {
  mouseSensitivity: 4,
  modernControls: true,
  soundVolume: 85,
  musicVolume: 80,
  muted: false,
  aspectRatio: '4:3',
  crtScanlines: false,
  showTelemetry: true,
  touchControlsEnabled: true,
  touchOpacity: 0.75,
  touchScale: 'medium',
  haptics: true,
};

export default function App() {
  const [status, setStatus] = useState<EngineStatus>('loading-wasm');
  const [statusMessage, setStatusMessage] = useState('Initializing WebAssembly runtime…');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [settings, setSettings] = useState<GameSettings>(DEFAULT_SETTINGS);
  const [currentWadInfo, setCurrentWadInfo] = useState<WadInfo | null>(null);
  const [currentWadVariant, setCurrentWadVariant] = useState<string>('doom1.wad');
  const [isWadModalOpen, setIsWadModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const moduleRef = useRef<EmscriptenDoomModule | null>(null);
  const activeWadData = useRef<Uint8Array | null>(null);
  const gameContainerRef = useRef<HTMLDivElement>(null);

  // Detect touch device
  useEffect(() => {
    const isTouch =
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0 ||
      window.matchMedia('(pointer: coarse)').matches;
    setIsTouchDevice(isTouch);
  }, []);

  // Update C runtime settings when settings change
  useEffect(() => {
    if (moduleRef.current && status === 'running') {
      if (moduleRef.current._Web_SetModernControls) {
        moduleRef.current._Web_SetModernControls(settings.modernControls ? 1 : 0);
      }
      if (moduleRef.current._Web_SetMouseSensitivity) {
        moduleRef.current._Web_SetMouseSensitivity(settings.mouseSensitivity);
      }
    }
  }, [settings.modernControls, settings.mouseSensitivity, status]);

  // Audio Context unlock and volume management
  const ensureAudioUnlocked = useCallback(async () => {
    try {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioContextClass) {
        if (!window.__doomAudioContext) {
          window.__doomAudioContext = new AudioContextClass();
        }
        if (window.__doomAudioContext.state === 'suspended') {
          await window.__doomAudioContext.resume();
        }
      }
    } catch (_) {}
  }, []);

  // Initialize Emscripten Module
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    window.onDoomStopped = () => {
      setStatus('stopped');
      setStatusMessage('Game stopped.');
      syncSavesFromFSToStorage(window.Module);
    };

    window.onDoomError = (msg: string) => {
      setStatus('error');
      setErrorMessage(msg);
      setStatusMessage(`Engine fault: ${msg}`);
    };

    const doomModule: EmscriptenDoomModule = {
      canvas: canvas,
      noInitialRun: true,
      locateFile: (path: string, prefix: string) => {
        if (path.endsWith('.wasm')) return '/doom.wasm';
        return prefix + path;
      },
      print: (...args: unknown[]) => {
        console.log('[DOOM]', ...args);
      },
      printErr: (...args: unknown[]) => {
        console.warn('[DOOM]', ...args);
      },
      onRuntimeInitialized: () => {
        console.log('[DOOM] WebAssembly runtime ready.');
        setStatus('wasm-ready');
        setStatusMessage('Engine ready. Load a WAD file to begin playing.');

        // Check for autostart parameter
        const params = new URLSearchParams(window.location.search);
        if (params.get('autostart') === '1' && activeWadData.current) {
          setTimeout(() => handleStartGame(), 100);
        }
      },
      onAbort: (reason: unknown) => {
        console.error('[DOOM] Aborted:', reason);
        setStatus('error');
        setErrorMessage(String(reason));
        setStatusMessage(`WebAssembly aborted: ${reason}`);
      },
    };

    window.Module = doomModule;
    moduleRef.current = doomModule;

    // Load doom.js if not already present
    const existingScript = document.getElementById('doom-wasm-script');
    if (!existingScript) {
      const script = document.createElement('script');
      script.id = 'doom-wasm-script';
      script.src = '/doom.js';
      script.async = true;
      script.onerror = () => {
        setStatus('error');
        setErrorMessage('Failed to load /doom.js from server.');
        setStatusMessage('Could not load doom.js engine binary.');
      };
      document.body.appendChild(script);
    } else if (window.Module && (window.Module as { calledRun?: boolean }).calledRun) {
      setStatus('wasm-ready');
      setStatusMessage('Engine ready.');
    }
  }, []);

  // Sync saves periodically while playing
  useEffect(() => {
    if (status !== 'running') return;
    const interval = setInterval(() => {
      syncSavesFromFSToStorage(moduleRef.current);
    }, 15000);
    return () => clearInterval(interval);
  }, [status]);

  // Handle WAD loaded from modal
  const handleWadLoaded = (filename: string, data: Uint8Array, info: WadInfo) => {
    activeWadData.current = data;
    setCurrentWadVariant(filename);
    setCurrentWadInfo(info);

    const FS = moduleRef.current?.FS;
    if (FS) {
      try {
        try { FS.mkdir('/doom'); } catch (_) {}
        try { FS.mkdir('/home'); } catch (_) {}
        try { FS.mkdir('/home/web_user'); } catch (_) {}

        const known = [
          'doom1.wad', 'doom.wad', 'doomu.wad', 'doom2.wad',
          'tnt.wad', 'plutonia.wad', 'freedoom1.wad', 'freedoom2.wad'
        ];
        for (const k of known) {
          try { FS.unlink(`/doom/${k}`); } catch (_) {}
        }

        FS.writeFile(`/doom/${filename}`, data);
        setStatusMessage(`Loaded ${info.detectedVersion} (${filename}) into virtual filesystem.`);
        syncSavesFromStorageToFS(moduleRef.current);
      } catch (err: unknown) {
        console.error('Failed writing WAD to FS:', err);
        setErrorMessage('Could not write WAD to virtual filesystem.');
      }
    }
  };

  // Start DOOM
  const handleStartGame = async () => {
    if (!activeWadData.current && !currentWadInfo) {
      setIsWadModalOpen(true);
      return;
    }

    await ensureAudioUnlocked();

    const FS = moduleRef.current?.FS;
    if (FS && activeWadData.current) {
      try {
        try { FS.mkdir('/doom'); } catch (_) {}
        try { FS.mkdir('/home'); } catch (_) {}
        try { FS.mkdir('/home/web_user'); } catch (_) {}
        FS.writeFile(`/doom/${currentWadVariant}`, activeWadData.current);
        syncSavesFromStorageToFS(moduleRef.current);
      } catch (e) {
        console.warn('FS preparation:', e);
      }
    }

    try {
      setStatus('starting');
      setStatusMessage('Starting DOOM engine…');

      // Set modern controls and sensitivity before start
      if (moduleRef.current?._Web_SetModernControls) {
        moduleRef.current._Web_SetModernControls(settings.modernControls ? 1 : 0);
      }
      if (moduleRef.current?._Web_SetMouseSensitivity) {
        moduleRef.current._Web_SetMouseSensitivity(settings.mouseSensitivity);
      }

      if (moduleRef.current?._Web_StartGame) {
        moduleRef.current._Web_StartGame();
        setStatus('running');
        setStatusMessage('DOOM is running.');
        canvasRef.current?.focus();
      } else {
        throw new Error('Web_StartGame symbol not found in WebAssembly module.');
      }
    } catch (err: unknown) {
      console.error('Launch failure:', err);
      setStatus('error');
      setErrorMessage(err instanceof Error ? err.message : 'Unknown launch error');
      setStatusMessage('Failed to start DOOM engine.');
    }
  };

  // Stop / Restart DOOM
  const handleRestart = () => {
    if (confirm('Reload DOOM engine session? Current unsaved game state will be reset.')) {
      window.location.reload();
    }
  };

  // Key event forwarder for virtual touch controls
  const handleKeyEvent = useCallback((key: number, down: boolean) => {
    if (moduleRef.current?._Web_KeyEvent) {
      moduleRef.current._Web_KeyEvent(key, down ? 1 : 0);
    }
  }, []);

  // Mouse event forwarder
  const handleMouseEvent = useCallback((buttons: number, dx: number, dy: number) => {
    if (moduleRef.current?._Web_MouseEvent) {
      moduleRef.current._Web_MouseEvent(buttons, dx, dy);
    }
  }, []);

  // Fullscreen toggle
  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await gameContainerRef.current?.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (_) {}
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Sound mute toggle
  const toggleMute = () => {
    setSettings((prev) => {
      const nextMuted = !prev.muted;
      if (window.__doomAudioContext) {
        if (nextMuted) window.__doomAudioContext.suspend?.();
        else window.__doomAudioContext.resume?.();
      }
      return { ...prev, muted: nextMuted };
    });
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-[#090b0a] text-neutral-200 overflow-hidden select-none font-sans">
      {/* Top DOOM Industrial Header Bar */}
      <header className="h-14 bg-gradient-to-r from-[#141a16] via-[#1b241e] to-[#141a16] border-b border-[#2e3b31] px-4 flex items-center justify-between shrink-0 shadow-md z-40">
        {/* Left: Brand Sigil & Title */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-b from-red-700 to-red-950 border border-red-500 flex items-center justify-center font-black font-mono text-amber-200 text-xl shadow-inner">
            D
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-neutral-100 via-amber-100 to-red-400 font-mono">
                DOOM
              </h1>
              <span className="hidden sm:inline-block px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider bg-red-950/80 border border-red-800 text-red-300 rounded">
                WASM PORT 1.10
              </span>
            </div>
            <div className="text-[10px] text-neutral-400 font-mono flex items-center gap-2">
              <span className="truncate max-w-[150px] sm:max-w-xs text-neutral-300">
                {currentWadInfo ? currentWadInfo.detectedVersion : 'No IWAD loaded'}
              </span>
            </div>
          </div>
        </div>

        {/* Center: Status indicator */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-black/50 border border-neutral-800 rounded-full font-mono text-[11px]">
          <span
            className={`w-2 h-2 rounded-full ${
              status === 'running'
                ? 'bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.8)]'
                : status === 'error'
                ? 'bg-red-500'
                : 'bg-amber-500'
            }`}
          />
          <span className="text-neutral-300">{statusMessage}</span>
        </div>

        {/* Right: Quick Action Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Mute Button */}
          <button
            onClick={toggleMute}
            className="p-2 text-neutral-300 hover:text-white hover:bg-neutral-800/80 rounded border border-transparent hover:border-neutral-700 transition cursor-pointer"
            title={settings.muted ? 'Unmute Audio' : 'Mute Audio'}
            aria-label="Toggle Audio"
          >
            {settings.muted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4" />}
          </button>

          {/* WAD Manager Button */}
          <button
            onClick={() => setIsWadModalOpen(true)}
            className="px-2.5 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-neutral-200 border border-neutral-700 rounded font-mono text-xs flex items-center gap-1.5 transition cursor-pointer"
            title="Choose or Inspect WAD"
          >
            <FolderOpen className="w-3.5 h-3.5 text-amber-500" />
            <span className="hidden sm:inline">IWAD</span>
          </button>

          {/* Settings Button */}
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="p-2 text-neutral-300 hover:text-white hover:bg-neutral-800/80 rounded border border-transparent hover:border-neutral-700 transition cursor-pointer"
            title="Settings & Controls"
            aria-label="Settings"
          >
            <Settings className="w-4 h-4" />
          </button>

          {/* Fullscreen Button */}
          <button
            onClick={toggleFullscreen}
            className="p-2 text-neutral-300 hover:text-white hover:bg-neutral-800/80 rounded border border-transparent hover:border-neutral-700 transition cursor-pointer"
            title="Toggle Fullscreen"
            aria-label="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* Restart / Reload */}
          {status === 'running' && (
            <button
              onClick={handleRestart}
              className="p-2 text-red-400 hover:text-red-200 hover:bg-red-950/60 rounded border border-red-900/60 transition cursor-pointer"
              title="Restart DOOM Engine"
              aria-label="Restart Engine"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}

          {/* Start Button (if ready and not running) */}
          {status !== 'running' && currentWadInfo?.isValid && (
            <button
              onClick={handleStartGame}
              className="px-3.5 py-1.5 bg-gradient-to-b from-red-600 to-red-900 hover:from-red-500 hover:to-red-800 text-white font-mono font-bold text-xs uppercase tracking-wider rounded border border-red-500 shadow flex items-center gap-1.5 cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-white" />
              <span>PLAY</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Game Stage */}
      <main
        ref={gameContainerRef}
        className="relative flex-1 bg-black flex items-center justify-center overflow-hidden"
      >
        <DoomScreen
          status={status}
          statusMessage={statusMessage}
          errorMessage={errorMessage}
          settings={settings}
          currentWadInfo={currentWadInfo}
          onOpenWadModal={() => setIsWadModalOpen(true)}
          onStartGame={handleStartGame}
          onToggleFullscreen={toggleFullscreen}
          canvasRef={canvasRef}
        />

        {/* Mobile Virtual Touch Controls */}
        {status === 'running' && settings.touchControlsEnabled && isTouchDevice && (
          <VirtualControls
            settings={settings}
            onKeyEvent={handleKeyEvent}
            onMouseEvent={handleMouseEvent}
            className="absolute inset-0 z-30"
          />
        )}
      </main>

      {/* Modals */}
      <WadLoaderModal
        isOpen={isWadModalOpen}
        onClose={() => setIsWadModalOpen(false)}
        onWadLoaded={handleWadLoaded}
        currentWadInfo={currentWadInfo}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={(newOpts) => setSettings((prev) => ({ ...prev, ...newOpts }))}
      />
    </div>
  );
}
