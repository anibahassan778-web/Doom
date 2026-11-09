import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Crosshair, DoorOpen, Zap, Menu, Compass, ChevronLeft, ChevronRight } from 'lucide-react';
import { computeJoystickVector, DOOM_KEYS } from '../utils/touchMapping';
import { GameSettings } from '../types/doom';

interface VirtualControlsProps {
  settings: GameSettings;
  onKeyEvent: (key: number, down: boolean) => void;
  onMouseEvent?: (buttons: number, dx: number, dy: number) => void;
  className?: string;
}

export const VirtualControls: React.FC<VirtualControlsProps> = ({
  settings,
  onKeyEvent,
  onMouseEvent,
  className = '',
}) => {
  const [isRunning, setIsRunning] = useState(false);
  const [activeKeys, setActiveKeys] = useState<Set<number>>(new Set());
  const [joystickThumb, setJoystickThumb] = useState<{ x: number; y: number } | null>(null);

  const joystickRef = useRef<HTMLDivElement>(null);
  const joystickTouchId = useRef<number | null>(null);
  const joystickOrigin = useRef<{ x: number; y: number } | null>(null);
  const currentActions = useRef<{
    forward: boolean;
    backward: boolean;
    strafeLeft: boolean;
    strafeRight: boolean;
  }>({ forward: false, backward: false, strafeLeft: false, strafeRight: false });

  const triggerHaptic = useCallback(() => {
    if (settings.haptics && typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(10);
      } catch (_) {}
    }
  }, [settings.haptics]);

  const handleKeyTouch = useCallback(
    (key: number, down: boolean) => {
      triggerHaptic();
      setActiveKeys((prev) => {
        const next = new Set(prev);
        if (down) next.add(key);
        else next.delete(key);
        return next;
      });
      onKeyEvent(key, down);
    },
    [onKeyEvent, triggerHaptic]
  );

  const toggleRun = useCallback(() => {
    triggerHaptic();
    setIsRunning((prev) => {
      const next = !prev;
      onKeyEvent(DOOM_KEYS.RUN, next);
      return next;
    });
  }, [onKeyEvent, triggerHaptic]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      // Release any pressed keys
      activeKeys.forEach((key) => onKeyEvent(key, false));
    };
  }, [activeKeys, onKeyEvent]);

  // Handle Virtual Joystick Touch Events
  const handleJoystickStart = (e: React.TouchEvent) => {
    e.preventDefault();
    if (joystickTouchId.current !== null) return;

    const touch = e.changedTouches[0];
    joystickTouchId.current = touch.identifier;

    const rect = joystickRef.current?.getBoundingClientRect();
    if (!rect) return;

    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    joystickOrigin.current = { x: centerX, y: centerY };

    updateJoystick(touch.clientX, touch.clientY);
  };

  const handleJoystickMove = (e: React.TouchEvent) => {
    e.preventDefault();
    if (joystickTouchId.current === null || !joystickOrigin.current) return;

    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === joystickTouchId.current) {
        updateJoystick(touch.clientX, touch.clientY);
        break;
      }
    }
  };

  const handleJoystickEnd = (e: React.TouchEvent) => {
    e.preventDefault();
    if (joystickTouchId.current === null) return;

    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === joystickTouchId.current) {
        joystickTouchId.current = null;
        joystickOrigin.current = null;
        setJoystickThumb(null);

        // Reset all movement keys
        if (currentActions.current.forward) onKeyEvent(DOOM_KEYS.UP, false);
        if (currentActions.current.backward) onKeyEvent(DOOM_KEYS.DOWN, false);
        if (currentActions.current.strafeLeft) {
          onKeyEvent(settings.modernControls ? DOOM_KEYS.STRAFE_LEFT : DOOM_KEYS.LEFT, false);
        }
        if (currentActions.current.strafeRight) {
          onKeyEvent(settings.modernControls ? DOOM_KEYS.STRAFE_RIGHT : DOOM_KEYS.RIGHT, false);
        }
        currentActions.current = {
          forward: false,
          backward: false,
          strafeLeft: false,
          strafeRight: false,
        };
        break;
      }
    }
  };

  const updateJoystick = (clientX: number, clientY: number) => {
    if (!joystickOrigin.current) return;
    const radius = 55;
    const originX = joystickOrigin.current.x;
    const originY = joystickOrigin.current.y;

    const vec = computeJoystickVector(originX, originY, clientX, clientY, radius, 0.15);

    // Visual thumb positioning
    const clampedDist = Math.min(Math.hypot(clientX - originX, clientY - originY), radius);
    const angle = Math.atan2(clientY - originY, clientX - originX);
    setJoystickThumb({
      x: Math.cos(angle) * clampedDist,
      y: Math.sin(angle) * clampedDist,
    });

    const threshold = 0.35;
    const forward = vec.dy < -threshold;
    const backward = vec.dy > threshold;
    const strafeLeft = vec.dx < -threshold;
    const strafeRight = vec.dx > threshold;

    const strafeLeftKey = settings.modernControls ? DOOM_KEYS.STRAFE_LEFT : DOOM_KEYS.LEFT;
    const strafeRightKey = settings.modernControls ? DOOM_KEYS.STRAFE_RIGHT : DOOM_KEYS.RIGHT;

    // Dispatch key state changes only when altered
    if (forward !== currentActions.current.forward) {
      onKeyEvent(DOOM_KEYS.UP, forward);
      currentActions.current.forward = forward;
    }
    if (backward !== currentActions.current.backward) {
      onKeyEvent(DOOM_KEYS.DOWN, backward);
      currentActions.current.backward = backward;
    }
    if (strafeLeft !== currentActions.current.strafeLeft) {
      onKeyEvent(strafeLeftKey, strafeLeft);
      currentActions.current.strafeLeft = strafeLeft;
    }
    if (strafeRight !== currentActions.current.strafeRight) {
      onKeyEvent(strafeRightKey, strafeRight);
      currentActions.current.strafeRight = strafeRight;
    }
  };

  const currentWeapon = useRef(2); // Start with pistol (2)
  const switchWeapon = (delta: number) => {
    currentWeapon.current += delta;
    if (currentWeapon.current < 1) currentWeapon.current = 7;
    if (currentWeapon.current > 7) currentWeapon.current = 1;
    const key = 48 + currentWeapon.current;
    handleKeyTouch(key, true);
    setTimeout(() => handleKeyTouch(key, false), 100);
  };

  const scaleClasses = {
    small: 'scale-90',
    medium: 'scale-100',
    large: 'scale-110',
  }[settings.touchScale];

  return (
    <div
      className={`pointer-events-none select-none touch-none ${scaleClasses} ${className}`}
      style={{ opacity: settings.touchOpacity }}
    >
      {/* Top Utility Controls (Menu & Automap) */}
      <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-auto">
        <button
          type="button"
          onTouchStart={(e) => {
            e.preventDefault();
            handleKeyTouch(DOOM_KEYS.ESCAPE, true);
          }}
          onTouchEnd={(e) => {
            e.preventDefault();
            handleKeyTouch(DOOM_KEYS.ESCAPE, false);
          }}
          className="px-3 py-1.5 bg-neutral-900/80 border border-neutral-700 active:bg-red-900 text-neutral-300 font-mono text-xs rounded shadow flex items-center gap-1.5"
          aria-label="Toggle Menu"
        >
          <Menu className="w-3.5 h-3.5" />
          <span>MENU</span>
        </button>

        <button
          type="button"
          onTouchStart={(e) => {
            e.preventDefault();
            handleKeyTouch(DOOM_KEYS.MAP, true);
          }}
          onTouchEnd={(e) => {
            e.preventDefault();
            handleKeyTouch(DOOM_KEYS.MAP, false);
          }}
          className="px-3 py-1.5 bg-neutral-900/80 border border-neutral-700 active:bg-red-900 text-neutral-300 font-mono text-xs rounded shadow flex items-center gap-1.5"
          aria-label="Toggle Automap"
        >
          <Compass className="w-3.5 h-3.5" />
          <span>MAP</span>
        </button>
      </div>

      {/* Quick Weapon Selector Belt */}
      <div className="absolute bottom-28 left-1/2 -translate-x-1/2 flex items-center gap-1.5 pointer-events-auto bg-neutral-950/80 p-1.5 rounded-full border border-neutral-800 shadow-xl">
        <button
          type="button"
          onTouchStart={(e) => {
            e.preventDefault();
            switchWeapon(-1);
          }}
          className="w-8 h-8 rounded-full bg-neutral-800 active:bg-red-800 text-neutral-300 flex items-center justify-center font-mono text-xs font-bold"
          aria-label="Previous Weapon"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        {[1, 2, 3, 4, 5, 6, 7].map((num) => (
          <button
            key={num}
            type="button"
            onTouchStart={(e) => {
              e.preventDefault();
              handleKeyTouch(48 + num, true);
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              handleKeyTouch(48 + num, false);
            }}
            className="w-8 h-8 rounded-full bg-neutral-900 border border-neutral-700 active:bg-amber-600 active:text-black text-amber-500 flex items-center justify-center font-mono text-xs font-bold shadow"
            aria-label={`Select weapon ${num}`}
          >
            {num}
          </button>
        ))}
        <button
          type="button"
          onTouchStart={(e) => {
            e.preventDefault();
            switchWeapon(1);
          }}
          className="w-8 h-8 rounded-full bg-neutral-800 active:bg-red-800 text-neutral-300 flex items-center justify-center font-mono text-xs font-bold"
          aria-label="Next Weapon"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Bottom Area: Left Virtual Joystick, Right Action Buttons */}
      <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between pointer-events-none">
        {/* Left: Virtual Joystick Pad */}
        <div
          ref={joystickRef}
          onTouchStart={handleJoystickStart}
          onTouchMove={handleJoystickMove}
          onTouchEnd={handleJoystickEnd}
          onTouchCancel={handleJoystickEnd}
          className="relative w-36 h-36 rounded-full bg-gradient-to-b from-neutral-900/70 to-black/80 border-2 border-neutral-700/80 shadow-[0_0_20px_rgba(0,0,0,0.8)] pointer-events-auto flex items-center justify-center"
          aria-label="Movement joystick"
        >
          {/* Direction indicators */}
          <span className="absolute top-2 text-[10px] font-mono text-neutral-500 font-bold">▲</span>
          <span className="absolute bottom-2 text-[10px] font-mono text-neutral-500 font-bold">▼</span>
          <span className="absolute left-2 text-[10px] font-mono text-neutral-500 font-bold">◀</span>
          <span className="absolute right-2 text-[10px] font-mono text-neutral-500 font-bold">▶</span>

          {/* Center Stick Thumb */}
          <div
            className="w-14 h-14 rounded-full bg-gradient-to-b from-red-800 to-red-950 border border-red-500 shadow-lg flex items-center justify-center transition-transform duration-75"
            style={{
              transform: joystickThumb
                ? `translate(${joystickThumb.x}px, ${joystickThumb.y}px)`
                : 'translate(0px, 0px)',
            }}
          >
            <div className="w-4 h-4 rounded-full bg-red-400 shadow-inner" />
          </div>
        </div>

        {/* Right: Tactical Action Buttons (Fire, Use, Run) */}
        <div className="flex flex-col items-end gap-3 pointer-events-auto">
          {/* Top Row: Run and Use */}
          <div className="flex items-center gap-3">
            {/* Run Toggle Button */}
            <button
              type="button"
              onTouchStart={(e) => {
                e.preventDefault();
                toggleRun();
              }}
              className={`w-14 h-14 rounded-xl border flex flex-col items-center justify-center font-mono text-xs font-bold shadow-lg transition active:scale-95 ${
                isRunning
                  ? 'bg-amber-600 border-amber-400 text-black shadow-[0_0_15px_rgba(245,158,11,0.5)]'
                  : 'bg-neutral-900/90 border-neutral-700 text-neutral-300'
              }`}
              aria-label="Toggle Run"
            >
              <Zap className="w-4 h-4" />
              <span className="text-[10px] mt-0.5">RUN</span>
            </button>

            {/* Use Button (Space: Door/Switch/Elevator) */}
            <button
              type="button"
              onTouchStart={(e) => {
                e.preventDefault();
                handleKeyTouch(DOOM_KEYS.USE, true);
              }}
              onTouchEnd={(e) => {
                e.preventDefault();
                handleKeyTouch(DOOM_KEYS.USE, false);
              }}
              className="w-14 h-14 rounded-xl bg-neutral-900/90 border border-neutral-700 active:bg-neutral-700 active:border-neutral-400 text-neutral-200 flex flex-col items-center justify-center font-mono text-xs font-bold shadow-lg active:scale-95"
              aria-label="Use or Open"
            >
              <DoorOpen className="w-4 h-4" />
              <span className="text-[10px] mt-0.5">USE</span>
            </button>
          </div>

          {/* Primary FIRE Button */}
          <button
            type="button"
            onTouchStart={(e) => {
              e.preventDefault();
              handleKeyTouch(DOOM_KEYS.FIRE, true);
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              handleKeyTouch(DOOM_KEYS.FIRE, false);
            }}
            className="w-24 h-24 rounded-full bg-gradient-to-b from-red-600 to-red-950 border-2 border-red-500 text-white flex flex-col items-center justify-center font-black font-mono tracking-wider shadow-[0_0_30px_rgba(220,38,38,0.6)] active:scale-95 active:from-red-500 active:to-red-900 cursor-pointer"
            aria-label="Fire weapon"
          >
            <Crosshair className="w-8 h-8 mb-0.5 animate-pulse" />
            <span className="text-sm font-black tracking-widest text-amber-200">FIRE</span>
          </button>
        </div>
      </div>
    </div>
  );
};
