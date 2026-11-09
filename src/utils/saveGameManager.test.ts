import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSaveDescription } from './saveGameManager';

test('parses DOOM save description correctly', () => {
  const data = new Uint8Array(64);
  const text = 'E1M1 - Hangar';
  for (let i = 0; i < text.length; i++) data[i] = text.charCodeAt(i);
  data[text.length] = 0; // null terminator

  const desc = parseSaveDescription(data);
  assert.equal(desc, 'E1M1 - Hangar');
});

test('handles empty or zeroed save buffer', () => {
  const data = new Uint8Array(64);
  const desc = parseSaveDescription(data);
  assert.equal(desc, '');
});
