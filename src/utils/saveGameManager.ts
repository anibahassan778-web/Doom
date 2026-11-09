/**
 * Save game manager for DOOM .dsg files.
 * DOOM saves to doomsav0.dsg ... doomsav5.dsg in virtual MEMFS.
 */

const STORAGE_PREFIX = 'DOOM_WASM_SAVE_SLOT_';

export type DoomModuleLike = Window['Module'] | null | undefined;

export interface SaveSlotInfo {
  slot: number;
  filename: string;
  exists: boolean;
  size: number;
  description: string;
  timestamp?: number;
}

export function getSaveSlotInfo(slot: number, moduleInstance?: DoomModuleLike): SaveSlotInfo {
  const filename = `doomsav${slot}.dsg`;
  const defaultInfo: SaveSlotInfo = {
    slot,
    filename,
    exists: false,
    size: 0,
    description: `Slot ${slot + 1} (Empty)`,
  };

  try {
    // First check virtual filesystem
    const FS = moduleInstance?.FS;
    if (FS) {
      const candidates = [`/home/web_user/${filename}`, `/${filename}`, filename];
      for (const p of candidates) {
        try {
          const stat = FS.analyzePath(p);
          if (stat && stat.exists) {
            const data = FS.readFile(p);
            const desc = parseSaveDescription(data);
            return {
              slot,
              filename,
              exists: true,
              size: data.byteLength,
              description: desc || `Slot ${slot + 1} (${data.byteLength} bytes)`,
            };
          }
        } catch (_) {}
      }
    }

    // Fallback check browser localStorage
    const stored = localStorage.getItem(`${STORAGE_PREFIX}${slot}`);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        slot,
        filename,
        exists: true,
        size: parsed.size || 0,
        description: parsed.description || `Slot ${slot + 1} (Saved)`,
        timestamp: parsed.timestamp,
      };
    }
  } catch (_) {}

  return defaultInfo;
}

export function parseSaveDescription(data: Uint8Array): string {
  // DOOM savegame header has description text in the first 24-32 bytes
  let desc = '';
  for (let i = 0; i < Math.min(data.byteLength, 32); i++) {
    const ch = data[i];
    if (ch === 0) break;
    if (ch >= 32 && ch <= 126) desc += String.fromCharCode(ch);
  }
  return desc.trim();
}

export function syncSavesFromStorageToFS(moduleInstance?: DoomModuleLike): void {
  const FS = moduleInstance?.FS;
  if (!FS) return;

  for (let slot = 0; slot < 6; slot++) {
    try {
      const stored = localStorage.getItem(`${STORAGE_PREFIX}${slot}`);
      if (stored) {
        const item = JSON.parse(stored);
        if (item.base64) {
          const binary = atob(item.base64);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

          const paths = [`/doomsav${slot}.dsg`, `/home/web_user/doomsav${slot}.dsg`];
          for (const p of paths) {
            try {
              FS.writeFile(p, bytes);
            } catch (_) {}
          }
        }
      }
    } catch (_) {}
  }
}

export function syncSavesFromFSToStorage(moduleInstance?: DoomModuleLike): void {
  const FS = moduleInstance?.FS;
  if (!FS) return;

  for (let slot = 0; slot < 6; slot++) {
    const filename = `doomsav${slot}.dsg`;
    const candidates = [`/home/web_user/${filename}`, `/${filename}`, filename];
    for (const p of candidates) {
      try {
        const stat = FS.analyzePath(p);
        if (stat && stat.exists) {
          const data = FS.readFile(p);
          const desc = parseSaveDescription(data);
          let binary = '';
          for (let i = 0; i < data.byteLength; i++) binary += String.fromCharCode(data[i]);
          const base64 = btoa(binary);

          localStorage.setItem(
            `${STORAGE_PREFIX}${slot}`,
            JSON.stringify({
              slot,
              size: data.byteLength,
              description: desc || `Slot ${slot + 1}`,
              base64,
              timestamp: Date.now(),
            })
          );
          break;
        }
      } catch (_) {}
    }
  }
}

export function exportSaveFile(slot: number, moduleInstance?: DoomModuleLike): void {
  const FS = moduleInstance?.FS;
  let data: Uint8Array | null = null;
  const filename = `doomsav${slot}.dsg`;

  if (FS) {
    const candidates = [`/home/web_user/${filename}`, `/${filename}`, filename];
    for (const p of candidates) {
      try {
        const stat = FS.analyzePath(p);
        if (stat && stat.exists) {
          data = FS.readFile(p);
          break;
        }
      } catch (_) {}
    }
  }

  if (!data) {
    const stored = localStorage.getItem(`${STORAGE_PREFIX}${slot}`);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.base64) {
        const bin = atob(parsed.base64);
        data = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) data[i] = bin.charCodeAt(i);
      }
    }
  }

  if (!data) {
    throw new Error(`Save slot ${slot + 1} does not have save data.`);
  }

  const blob = new Blob([data.buffer as ArrayBuffer], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function importSaveFile(
  file: File,
  targetSlot: number,
  moduleInstance?: DoomModuleLike
): Promise<void> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const filename = `doomsav${targetSlot}.dsg`;

  const FS = moduleInstance?.FS;
  if (FS) {
    const paths = [`/${filename}`, `/home/web_user/${filename}`];
    for (const p of paths) {
      try {
        FS.writeFile(p, bytes);
      } catch (_) {}
    }
  }

  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  const base64 = btoa(binary);

  localStorage.setItem(
    `${STORAGE_PREFIX}${targetSlot}`,
    JSON.stringify({
      slot: targetSlot,
      size: bytes.byteLength,
      description: parseSaveDescription(bytes) || `Slot ${targetSlot + 1}`,
      base64,
      timestamp: Date.now(),
    })
  );
}
