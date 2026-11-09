/**
 * Virtual joystick and touch control vector math for DOOM port.
 */

export interface JoystickVector {
  dx: number; // -1.0 to 1.0
  dy: number; // -1.0 to 1.0
  intensity: number; // 0.0 to 1.0
}

export interface DoomActionState {
  forward: boolean;
  backward: boolean;
  strafeLeft: boolean;
  strafeRight: boolean;
  turnLeft: boolean;
  turnRight: boolean;
}

export function computeJoystickVector(
  originX: number,
  originY: number,
  currentX: number,
  currentY: number,
  radius: number,
  deadzone = 0.15
): JoystickVector {
  const deltaX = currentX - originX;
  const deltaY = currentY - originY;
  const distance = Math.hypot(deltaX, deltaY);

  if (distance <= radius * deadzone || radius <= 0) {
    return { dx: 0, dy: 0, intensity: 0 };
  }

  const clampedDist = Math.min(distance, radius);
  const normalizedDist = (clampedDist - radius * deadzone) / (radius * (1 - deadzone));
  const angle = Math.atan2(deltaY, deltaX);

  return {
    dx: Math.cos(angle) * normalizedDist,
    dy: Math.sin(angle) * normalizedDist,
    intensity: Math.min(1.0, Math.max(0.0, normalizedDist)),
  };
}

export function joystickToDoomActions(
  vector: JoystickVector,
  threshold = 0.35
): DoomActionState {
  const forward = vector.dy < -threshold;
  const backward = vector.dy > threshold;
  const strafeLeft = vector.dx < -threshold;
  const strafeRight = vector.dx > threshold;

  return {
    forward,
    backward,
    strafeLeft,
    strafeRight,
    turnLeft: strafeLeft,
    turnRight: strafeRight,
  };
}

/**
 * Standard DOOM keycodes from doomdef.h
 */
export const DOOM_KEYS = {
  UP: 0xad, // 173 KEY_UPARROW
  DOWN: 0xaf, // 175 KEY_DOWNARROW
  LEFT: 0xac, // 172 KEY_LEFTARROW
  RIGHT: 0xae, // 174 KEY_RIGHTARROW
  STRAFE_LEFT: 44, // ',' key_strafeleft
  STRAFE_RIGHT: 46, // '.' key_straferight
  FIRE: 0x80 + 0x1d, // 157 KEY_RCTRL
  USE: 32, // 32 ' ' Space
  RUN: 0x80 + 0x36, // 182 KEY_RSHIFT
  STRAFE_MOD: 0x80 + 0x38, // 184 KEY_RALT
  ESCAPE: 27, // 27 KEY_ESCAPE
  ENTER: 13, // 13 KEY_ENTER
  MAP: 9, // 9 KEY_TAB
  WEAPON_1: 49, // '1' Fist / Chainsaw
  WEAPON_2: 50, // '2' Pistol
  WEAPON_3: 51, // '3' Shotgun / Super Shotgun
  WEAPON_4: 52, // '4' Chaingun
  WEAPON_5: 53, // '5' Rocket Launcher
  WEAPON_6: 54, // '6' Plasma Rifle
  WEAPON_7: 55, // '7' BFG9000
} as const;
