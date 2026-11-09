import test from 'node:test';
import assert from 'node:assert/strict';
import { computeJoystickVector, joystickToDoomActions } from './touchMapping';

test('returns zero vector inside deadzone', () => {
  const originX = 100;
  const originY = 100;
  const radius = 50;

  // Touch directly at center
  const centerVec = computeJoystickVector(originX, originY, 100, 100, radius);
  assert.equal(centerVec.dx, 0);
  assert.equal(centerVec.dy, 0);
  assert.equal(centerVec.intensity, 0);

  // Touch within 15% deadzone (dist = 5px < 7.5px)
  const deadzoneVec = computeJoystickVector(originX, originY, 104, 103, radius);
  assert.equal(deadzoneVec.intensity, 0);
});

test('computes forward direction when dragging up', () => {
  const originX = 100;
  const originY = 100;
  const radius = 50;

  // Drag straight UP (-Y in screen space)
  const upVec = computeJoystickVector(originX, originY, 100, 50, radius);
  assert.ok(upVec.dy < -0.8);
  assert.ok(Math.abs(upVec.dx) < 0.1);
  assert.equal(upVec.intensity, 1.0);

  const actions = joystickToDoomActions(upVec);
  assert.equal(actions.forward, true);
  assert.equal(actions.backward, false);
});

test('computes strafe right when dragging right', () => {
  const originX = 100;
  const originY = 100;
  const radius = 50;

  const rightVec = computeJoystickVector(originX, originY, 150, 100, radius);
  assert.ok(rightVec.dx > 0.8);
  assert.equal(rightVec.intensity, 1.0);

  const actions = joystickToDoomActions(rightVec);
  assert.equal(actions.strafeRight, true);
  assert.equal(actions.strafeLeft, false);
});
