import React, { useRef, useState, useEffect } from 'react';
import { MousePointer, Maximize2, RefreshCw, AlertTriangle, Play } from 'lucide-react';
import { EngineStatus, GameSettings } from '../types/doom';
import { WadInfo } from '../utils/wadParser';

interface DoomScreenProps {
  status: EngineStatus;
  statusMessage: string;
  errorMessage: string | null;
  settings: GameSettings;
  currentWadInfo: WadInfo | null;
  onOpenWadModal: () => void;
  onStartGame: () => void;
  onToggleFullscreen: () => void;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
}

export const DoomScreen: React.FC<DoomScreenProps> = ({
  status,
  statusMessage,
  errorMessage,
  settings,
  currentWadInfo,
  onOpenWadModal,
  onStartGame,
  onToggleFullscreen,
  canvasRef,
}) => {
  const [isPointerLocked, setIsPointerLocked] = useState(false);
  const [showLockPrompt, setShowLockPrompt] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handlePointerLockChange = () => {
      const locked = document.pointerLockElement === canvasRef.current;
      setIsPointerLocked(locked);
      if (locked) setShowLockPrompt(true);
      else setShowLockPrompt(false);
    };

    document.addEventListener('pointerlockchange', handlePointerLockChange);
    return () => document.removeEventListener('pointerlockchange', handlePointerLockChange);
  }, [canvasRef]);

  const handleCanvasClick = () => {
    if (status === 'running' && canvasRef.current && !isPointerLocked) {
      try {
        canvasRef.current.requestPointerLock();
      } catch (_) {}
    }
  };

  const aspectRatioClass = {
    '4:3': 'aspect-[4/3] max-h-full max-w-full',
    fill: 'w-full h-full object-contain',
    stretch: 'w-full h-full object-fill',
  }[settings.aspectRatio];

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-black flex items-center justify-center overflow-hidden select-none"
    >
      {/* Game Canvas Container */}
      <div
        className={`relative flex items-center justify-center ${aspectRatioClass} ${
          settings.crtScanlines ? 'crt-overlay' : ''
        }`}
      >
        <canvas
          ref={canvasRef}
          id="canvas"
          width={320}
          height={200}
          tabIndex={0}
          onClick={handleCanvasClick}
          className="w-full h-full pixelated bg-black outline-none block cursor-crosshair shadow-2xl"
          aria-label="Original DOOM game display"
          data-testid="doom-game-canvas"
        />

        {/* Pointer Lock Notification Banner */}
        {status === 'running' && !isPointerLocked && (
          <button
            type="button"
            onClick={handleCanvasClick}
            className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-neutral-900/90 hover:bg-neutral-800 border border-neutral-700 text-neutral-200 text-xs font-mono rounded-full shadow-lg flex items-center gap-2 transition cursor-pointer z-20 animate-fade-in"
          >
            <MousePointer className="w-3.5 h-3.5 text-red-500 animate-pulse" />
            <span>Click screen to capture mouse for aiming (ESC to release)</span>
          </button>
        )}

        {/* Telemetry Overlay */}
        {settings.showTelemetry && status === 'running' && (
          <div className="absolute top-2 left-2 px-2.5 py-1 bg-black/80 border border-neutral-800 font-mono text-[10px] text-green-400 rounded pointer-events-none z-20 flex items-center gap-3">
            <span>RES: 320×200</span>
            <span>TIC: 35Hz</span>
            <span>AIM: {isPointerLocked ? 'MOUSE LOCKED' : 'FREE'}</span>
          </div>
        )}

        {/* Overlays for Idle / Loading / Error States */}
        {status !== 'running' && (
          <div className="absolute inset-0 bg-gradient-to-b from-black/90 via-black/85 to-black/95 flex flex-col items-center justify-center p-6 text-center z-30">
            {/* Logo Sigil */}
            <div className="relative mb-4">
              <div className="w-16 h-16 bg-gradient-to-br from-red-600 to-red-950 border-2 border-red-500 flex items-center justify-center text-amber-300 font-black text-3xl font-mono shadow-[0_0_35px_rgba(220,38,38,0.7)]">
                D
              </div>
            </div>

            <h1 className="text-3xl sm:text-5xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-b from-amber-200 via-red-500 to-red-700 font-mono uppercase mb-2">
              DOOM
            </h1>
            <p className="text-xs sm:text-sm text-neutral-400 max-w-md mb-6 font-mono">
              Original Linux DOOM 1.10 engine running natively via WebAssembly, HTML5 Canvas & Web Audio API
            </p>

            {/* Status and Action Buttons */}
            {status === 'loading-wasm' && (
              <div className="flex items-center gap-2.5 text-amber-400 font-mono text-sm py-2">
                <RefreshCw className="w-5 h-5 animate-spin" />
                <span>Initializing WebAssembly engine…</span>
              </div>
            )}

            {status === 'error' && (
              <div className="max-w-md p-4 bg-red-950/80 border border-red-700 text-red-200 rounded text-xs font-mono space-y-2 mb-4">
                <div className="flex items-center gap-2 font-bold text-red-400">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>Engine Fault:</span>
                </div>
                <div className="break-words text-neutral-300">{errorMessage || statusMessage}</div>
              </div>
            )}

            {(status === 'wasm-ready' || status === 'idle' || status === 'stopped' || status === 'error') && (
              <div className="flex flex-col sm:flex-row items-center gap-3">
                {currentWadInfo && currentWadInfo.isValid ? (
                  <button
                    onClick={onStartGame}
                    className="px-8 py-3 bg-gradient-to-b from-red-600 to-red-900 hover:from-red-500 hover:to-red-800 text-white font-mono font-bold text-sm uppercase tracking-wider rounded border border-red-500 shadow-[0_0_25px_rgba(220,38,38,0.6)] flex items-center gap-2.5 cursor-pointer transition active:scale-95"
                  >
                    <Play className="w-5 h-5 fill-white" />
                    <span>Start Game ({currentWadInfo.targetFilename})</span>
                  </button>
                ) : null}

                <button
                  onClick={onOpenWadModal}
                  className="px-6 py-3 bg-neutral-900 hover:bg-neutral-800 text-neutral-200 font-mono font-bold text-sm uppercase tracking-wider rounded border border-neutral-700 shadow flex items-center gap-2 cursor-pointer transition"
                >
                  <span>{currentWadInfo?.isValid ? 'Change WAD' : 'Select or Fetch WAD'}</span>
                </button>
              </div>
            )}

            {currentWadInfo?.isValid && (
              <div className="mt-4 text-xs font-mono text-green-400 flex items-center gap-1.5">
                <span>Loaded:</span>
                <strong className="text-neutral-200">{currentWadInfo.detectedVersion}</strong>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
