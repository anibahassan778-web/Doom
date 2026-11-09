import test from 'node:test';
import assert from 'node:assert/strict';
import { parseWadHeader } from './wadParser';

test('rejects buffers smaller than 12 bytes', () => {
  const shortBuffer = new Uint8Array([0x49, 0x57, 0x41, 0x44]);
  const result = parseWadHeader(shortBuffer);
  assert.equal(result.isValid, false);
  assert.equal(result.type, 'INVALID');
  assert.match(result.errorMessage || '', /minimum WAD header size/);
});

test('rejects invalid magic headers', () => {
  const invalidMagic = new Uint8Array(16);
  invalidMagic.set([0x5A, 0x49, 0x50, 0x21]); // "ZIP!"
  const result = parseWadHeader(invalidMagic);
  assert.equal(result.isValid, false);
  assert.equal(result.type, 'INVALID');
  assert.match(result.errorMessage || '', /Invalid magic header/);
});

test('parses synthetic DOOM1 shareware IWAD header correctly', () => {
  // Construct a minimal valid IWAD in memory with 2 lumps: PLAYPAL and E1M1
  const numLumps = 2;
  const headerSize = 12;
  const dirOffset = headerSize; // 12
  const dirSize = numLumps * 16; // 32
  const totalSize = headerSize + dirSize; // 44 bytes

  const buffer = new Uint8Array(totalSize);
  const view = new DataView(buffer.buffer);

  // Magic: IWAD
  buffer[0] = 0x49; buffer[1] = 0x57; buffer[2] = 0x41; buffer[3] = 0x44;
  view.setInt32(4, numLumps, true);
  view.setInt32(8, dirOffset, true);

  // Lump 0: PLAYPAL (offset 0, size 0)
  const name0 = 'PLAYPAL';
  for (let c = 0; c < name0.length; c++) buffer[dirOffset + 8 + c] = name0.charCodeAt(c);

  // Lump 1: E1M1
  const name1 = 'E1M1';
  for (let c = 0; c < name1.length; c++) buffer[dirOffset + 16 + 8 + c] = name1.charCodeAt(c);

  const result = parseWadHeader(buffer);
  assert.equal(result.isValid, true);
  assert.equal(result.type, 'IWAD');
  assert.equal(result.numLumps, 2);
  assert.equal(result.hasPlaypal, true);
  assert.equal(result.targetFilename, 'doom1.wad');
  assert.equal(result.maps.includes('E1M1'), true);
});

test('detects DOOM2 when MAP01 is present', () => {
  const numLumps = 2;
  const headerSize = 12;
  const dirOffset = 12;
  const buffer = new Uint8Array(headerSize + numLumps * 16);
  const view = new DataView(buffer.buffer);

  // Magic: IWAD
  buffer[0] = 0x49; buffer[1] = 0x57; buffer[2] = 0x41; buffer[3] = 0x44;
  view.setInt32(4, numLumps, true);
  view.setInt32(8, dirOffset, true);

  const name0 = 'PLAYPAL';
  for (let c = 0; c < name0.length; c++) buffer[dirOffset + 8 + c] = name0.charCodeAt(c);
  const name1 = 'MAP01';
  for (let c = 0; c < name1.length; c++) buffer[dirOffset + 16 + 8 + c] = name1.charCodeAt(c);

  const result = parseWadHeader(buffer);
  assert.equal(result.isValid, true);
  assert.equal(result.type, 'IWAD');
  assert.equal(result.targetFilename, 'doom2.wad');
  assert.equal(result.detectedVersion, 'DOOM II: Hell on Earth');
});
