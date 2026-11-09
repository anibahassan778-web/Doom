/**
 * WAD (Where's All the Data) header and directory inspector.
 * Validates binary data according to original id Software DOOM engine specifications.
 */

export interface WadInfo {
  isValid: boolean;
  type: 'IWAD' | 'PWAD' | 'INVALID';
  numLumps: number;
  infoTableOffset: number;
  fileSize: number;
  detectedVersion: string;
  targetFilename: string;
  hasPlaypal: boolean;
  hasColormap: boolean;
  maps: string[];
  errorMessage?: string;
}

export function parseWadHeader(buffer: ArrayBuffer | Uint8Array): WadInfo {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const size = bytes.byteLength;

  if (size < 12) {
    return {
      isValid: false,
      type: 'INVALID',
      numLumps: 0,
      infoTableOffset: 0,
      fileSize: size,
      detectedVersion: 'Corrupted / Too Small',
      targetFilename: 'unknown.wad',
      hasPlaypal: false,
      hasColormap: false,
      maps: [],
      errorMessage: `File is only ${size} bytes, minimum WAD header size is 12 bytes.`,
    };
  }

  const magic = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
  if (magic !== 'IWAD' && magic !== 'PWAD') {
    return {
      isValid: false,
      type: 'INVALID',
      numLumps: 0,
      infoTableOffset: 0,
      fileSize: size,
      detectedVersion: 'Not a DOOM WAD',
      targetFilename: 'unknown.wad',
      hasPlaypal: false,
      hasColormap: false,
      maps: [],
      errorMessage: `Invalid magic header: "${magic}". Expected "IWAD" or "PWAD".`,
    };
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const numLumps = view.getInt32(4, true);
  const infoTableOffset = view.getInt32(8, true);

  if (numLumps < 0 || infoTableOffset < 12 || infoTableOffset + numLumps * 16 > size) {
    return {
      isValid: false,
      type: magic as 'IWAD' | 'PWAD',
      numLumps,
      infoTableOffset,
      fileSize: size,
      detectedVersion: 'Corrupted Directory Table',
      targetFilename: 'unknown.wad',
      hasPlaypal: false,
      hasColormap: false,
      maps: [],
      errorMessage: `WAD lump directory table points outside file boundaries (offset: ${infoTableOffset}, lumps: ${numLumps}, size: ${size}).`,
    };
  }

  // Scan lump directory
  const lumps: string[] = [];
  const maps: string[] = [];
  let hasPlaypal = false;
  let hasColormap = false;
  let hasE1M1 = false;
  let hasE4M1 = false;
  let hasMap01 = false;
  let hasMap31 = false;

  for (let i = 0; i < numLumps; i++) {
    const entryOffset = infoTableOffset + i * 16;
    let name = '';
    for (let c = 0; c < 8; c++) {
      const code = bytes[entryOffset + 8 + c];
      if (code === 0) break;
      name += String.fromCharCode(code).toUpperCase();
    }
    lumps.push(name);

    if (name === 'PLAYPAL') hasPlaypal = true;
    if (name === 'COLORMAP') hasColormap = true;
    if (name === 'E1M1') hasE1M1 = true;
    if (name === 'E4M1') hasE4M1 = true;
    if (name === 'MAP01') hasMap01 = true;
    if (name === 'MAP31') hasMap31 = true;

    // Detect maps
    if (/^E[1-4]M[1-9]$/.test(name) || /^MAP[0-3][0-9]$/.test(name)) {
      if (!maps.includes(name)) maps.push(name);
    }
  }

  // Identify version
  let detectedVersion = 'Custom DOOM WAD';
  let targetFilename = 'doom.wad';

  if (hasMap01) {
    if (lumps.includes('REDMIN') || lumps.includes('TNTKEY')) {
      detectedVersion = 'Final DOOM: TNT Evilution';
      targetFilename = 'tnt.wad';
    } else if (lumps.includes('CAMO1') || lumps.includes('PLUTONIA')) {
      detectedVersion = 'Final DOOM: The Plutonia Experiment';
      targetFilename = 'plutonia.wad';
    } else {
      detectedVersion = 'DOOM II: Hell on Earth';
      targetFilename = 'doom2.wad';
    }
  } else if (hasE4M1) {
    detectedVersion = 'The Ultimate DOOM';
    targetFilename = 'doomu.wad';
  } else if (hasE1M1) {
    if (maps.some((m) => m.startsWith('E2') || m.startsWith('E3'))) {
      detectedVersion = 'DOOM (Registered)';
      targetFilename = 'doom.wad';
    } else {
      detectedVersion = 'DOOM Shareware (Episode 1: Knee-Deep in the Dead)';
      targetFilename = 'doom1.wad';
    }
  }

  return {
    isValid: true,
    type: magic as 'IWAD' | 'PWAD',
    numLumps,
    infoTableOffset,
    fileSize: size,
    detectedVersion,
    targetFilename,
    hasPlaypal,
    hasColormap,
    maps,
  };
}
