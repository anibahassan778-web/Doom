import test from 'node:test';
import assert from 'node:assert';
import { parseMusData } from './doomMusicSynth.ts';

test('parseMusData returns null on empty or invalid buffer', () => {
  const empty = new Uint8Array(0);
  assert.strictEqual(parseMusData(empty), null);

  const invalid = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
  assert.strictEqual(parseMusData(invalid), null);
});

test('parseMusData parses valid synthetic MUS sequence', () => {
  // Construct a minimal valid MUS file
  // Header: "MUS\x1A", scoreLen = 7, scoreStart = 16, channels = 1, sec = 0, instrCnt = 0, dummy = 0
  const buf = new Uint8Array(32);
  buf[0] = 0x4d; // 'M'
  buf[1] = 0x55; // 'U'
  buf[2] = 0x53; // 'S'
  buf[3] = 0x1a; // 0x1a

  const view = new DataView(buf.buffer);
  view.setUint16(4, 7, true);  // scoreLen = 7
  view.setUint16(6, 16, true); // scoreStart = 16
  view.setUint16(8, 1, true);  // channels = 1
  view.setUint16(10, 0, true);
  view.setUint16(12, 0, true);
  view.setUint16(14, 0, true);

  // Score event 1: at offset 16:
  // desc = (0 << 7) | (1 << 4) | 0 = 0x10 (PlayNote on chan 0, not last)
  // noteByte = 0x80 | 40 (note 40 with volume)
  // vol = 100
  buf[16] = 0x10;
  buf[17] = 0x80 | 40;
  buf[18] = 100;

  // Score event 2: at offset 19:
  // desc = (1 << 7) | (0 << 4) | 0 = 0x80 (ReleaseNote on chan 0, last=true)
  // note = 40
  // delay = 140 ticks (140 in VLQ: 0x81, 0x0C -> 1*128 + 12 = 140)
  buf[19] = 0x80;
  buf[20] = 40;
  buf[21] = 0x81;
  buf[22] = 0x0c;

  // Score event 3: at offset 23:
  // desc = (0 << 7) | (5 << 4) | 0 = 0x50 (ScoreEnd)
  buf[23] = 0x50;

  const seq = parseMusData(buf);
  assert.ok(seq !== null, 'Sequence parsed');
  assert.strictEqual(seq.durationSec, 1.0, 'Duration is 140 ticks / 140 = 1 sec');
  assert.strictEqual(seq.events.length, 2, 'Two events parsed');
  assert.strictEqual(seq.events[0].type, 'noteOn');
  assert.strictEqual(seq.events[0].note, 40);
  assert.strictEqual(seq.events[0].velocity, 100);
  assert.strictEqual(seq.events[1].type, 'noteOff');
  assert.strictEqual(seq.events[1].note, 40);
});
