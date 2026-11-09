import React, { useState, useRef } from 'react';
import { Upload, Download, AlertTriangle, CheckCircle, FileText, Play, X, RefreshCw } from 'lucide-react';
import { WadInfo, parseWadHeader } from '../utils/wadParser';

interface WadLoaderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onWadLoaded: (filename: string, data: Uint8Array, info: WadInfo) => void;
  currentWadInfo: WadInfo | null;
}

const PRESET_OPTIONS = [
  { value: 'doom1.wad', label: 'DOOM Shareware (DOOM1.WAD)', desc: 'Official 9-level shareware episode' },
  { value: 'doom.wad', label: 'DOOM Registered (DOOM.WAD)', desc: 'Episodes 1-3 classic registered release' },
  { value: 'doomu.wad', label: 'The Ultimate DOOM (DOOMU.WAD)', desc: 'Episodes 1-4 including Thy Flesh Consumed' },
  { value: 'doom2.wad', label: 'DOOM II: Hell on Earth (DOOM2.WAD)', desc: '32 levels with Super Shotgun and new demons' },
  { value: 'tnt.wad', label: 'Final DOOM: TNT Evilution (TNT.WAD)', desc: '32 full custom levels by Team TNT' },
  { value: 'plutonia.wad', label: 'Final DOOM: The Plutonia Experiment', desc: '32 intense challenge levels by the Casali brothers' },
];

export const WadLoaderModal: React.FC<WadLoaderModalProps> = ({
  isOpen,
  onClose,
  onWadLoaded,
  currentWadInfo,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [targetVariant, setTargetVariant] = useState<string>('doom1.wad');
  const [parsedInfo, setParsedInfo] = useState<WadInfo | null>(currentWadInfo);
  const [fileData, setFileData] = useState<Uint8Array | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFile = async (file: File) => {
    setSelectedFile(file);
    setDownloadError(null);
    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      const info = parseWadHeader(bytes);
      setParsedInfo(info);
      setFileData(bytes);
      if (info.isValid && info.targetFilename) {
        setTargetVariant(info.targetFilename);
      }
    } catch (err: unknown) {
      setParsedInfo({
        isValid: false,
        type: 'INVALID',
        numLumps: 0,
        infoTableOffset: 0,
        fileSize: file.size,
        detectedVersion: 'Read Error',
        targetFilename: 'doom.wad',
        hasPlaypal: false,
        hasColormap: false,
        maps: [],
        errorMessage: err instanceof Error ? err.message : 'Failed to read file',
      });
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleDownloadShareware = async () => {
    setIsDownloading(true);
    setDownloadProgress(10);
    setDownloadError(null);

    // Direct CORS-enabled public domain / shareware mirrors
    const mirrors = [
      'https://raw.githubusercontent.com/Daivuk/PureDOOM/master/doom1.wad',
      'https://raw.githubusercontent.com/Akbar30Bill/DOOM_wads/master/doom1.wad',
    ];

    let success = false;
    for (const url of mirrors) {
      try {
        setDownloadProgress(25);
        const response = await fetch(url, { mode: 'cors' });
        if (!response.ok) continue;

        setDownloadProgress(60);
        const buffer = await response.arrayBuffer();
        setDownloadProgress(90);
        const bytes = new Uint8Array(buffer);
        const info = parseWadHeader(bytes);

        if (info.isValid && info.type === 'IWAD') {
          setFileData(bytes);
          setParsedInfo(info);
          setTargetVariant('doom1.wad');
          success = true;
          setDownloadProgress(100);
          break;
        }
      } catch (e) {
        console.warn('Mirror failed:', url, e);
      }
    }

    setIsDownloading(false);
    if (!success) {
      setDownloadError(
        'Unable to download shareware WAD automatically. Please select a local DOOM.WAD or DOOM1.WAD from your device.'
      );
    }
  };

  const handleLaunch = () => {
    if (fileData && parsedInfo && parsedInfo.isValid) {
      onWadLoaded(targetVariant, fileData, parsedInfo);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl bg-neutral-900 border-2 border-amber-800/80 shadow-[0_0_50px_rgba(180,40,20,0.4)] text-neutral-200 rounded-sm overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-red-950 via-neutral-900 to-red-950 border-b border-red-900/60">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-red-700/80 border border-red-500 flex items-center justify-center font-black text-amber-200 text-lg shadow-inner">
              W
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-wider text-red-500 font-mono uppercase">
                DOOM IWAD Manager
              </h2>
              <p className="text-xs text-neutral-400">Load authentic game data to launch engine</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800 transition"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* Quick Action: Fetch Shareware */}
          <div className="p-4 border border-amber-900/50 bg-neutral-950/80 rounded flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-amber-500 font-bold font-mono text-sm">NO WAD FILE ON HAND?</span>
                <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 bg-amber-950 border border-amber-700 text-amber-300">
                  Free Public Shareware
                </span>
              </div>
              <p className="text-xs text-neutral-400 mt-1">
                Download the classic v1.9 Shareware Episode 1 (DOOM1.WAD ~4.2 MB) directly into browser memory.
              </p>
            </div>
            <button
              onClick={handleDownloadShareware}
              disabled={isDownloading}
              className="w-full sm:w-auto px-4 py-2.5 bg-gradient-to-b from-amber-700 to-amber-900 hover:from-amber-600 hover:to-amber-800 border border-amber-500 text-amber-100 font-bold font-mono text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition disabled:opacity-50 cursor-pointer shadow-md"
            >
              {isDownloading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Downloading ({downloadProgress}%)…</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Fetch DOOM1.WAD</span>
                </>
              )}
            </button>
          </div>

          {downloadError && (
            <div className="p-3 bg-red-950/60 border border-red-800/80 rounded text-red-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{downloadError}</span>
            </div>
          )}

          {/* Drag & Drop Upload */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed p-8 text-center cursor-pointer transition rounded ${
              dragActive
                ? 'border-red-500 bg-red-950/30'
                : 'border-neutral-700 hover:border-neutral-500 bg-neutral-950/40'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".wad,application/octet-stream"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFile(e.target.files[0]);
                }
              }}
            />
            <Upload className="w-10 h-10 mx-auto text-neutral-400 mb-3" />
            <p className="text-sm font-bold text-neutral-200">
              Drag & Drop your DOOM WAD here, or <span className="text-red-400 underline">Browse</span>
            </p>
            <p className="text-xs text-neutral-500 mt-1">
              Supports DOOM.WAD, DOOM1.WAD, DOOM2.WAD, DOOMU.WAD, TNT.WAD, PLUTONIA.WAD
            </p>
          </div>

          {/* Parsed WAD Details */}
          {parsedInfo && (
            <div
              className={`p-4 rounded border text-xs space-y-2 ${
                parsedInfo.isValid
                  ? 'bg-neutral-950 border-green-800/60 text-neutral-300'
                  : 'bg-red-950/40 border-red-800/80 text-red-200'
              }`}
            >
              <div className="flex items-center justify-between font-mono">
                <span className="flex items-center gap-1.5 font-bold">
                  {parsedInfo.isValid ? (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                  )}
                  {parsedInfo.detectedVersion}
                </span>
                <span className="px-2 py-0.5 bg-neutral-800 rounded font-semibold text-[11px]">
                  {parsedInfo.type} · {(parsedInfo.fileSize / (1024 * 1024)).toFixed(2)} MB
                </span>
              </div>

              {parsedInfo.errorMessage && (
                <p className="text-red-400 font-mono mt-1">{parsedInfo.errorMessage}</p>
              )}

              {parsedInfo.isValid && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-neutral-800/80 font-mono text-[11px] text-neutral-400">
                  <div>
                    Lumps: <strong className="text-neutral-200">{parsedInfo.numLumps}</strong>
                  </div>
                  <div>
                    Palette: <strong className="text-neutral-200">{parsedInfo.hasPlaypal ? 'OK' : 'Missing'}</strong>
                  </div>
                  <div>
                    Colormap: <strong className="text-neutral-200">{parsedInfo.hasColormap ? 'OK' : 'Missing'}</strong>
                  </div>
                  <div className="col-span-2 sm:col-span-3 truncate">
                    Maps: <span className="text-neutral-300">{parsedInfo.maps.slice(0, 10).join(', ')}{parsedInfo.maps.length > 10 ? ` … (+${parsedInfo.maps.length - 10} more)` : ''}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Engine Target Name Selector */}
          <div>
            <label className="block text-xs font-mono uppercase tracking-wider text-neutral-400 mb-1.5">
              Engine Mount Identifier (IWAD Target Name)
            </label>
            <select
              value={targetVariant}
              onChange={(e) => setTargetVariant(e.target.value)}
              className="w-full bg-neutral-950 border border-neutral-700 text-neutral-200 px-3 py-2 text-xs font-mono rounded focus:border-red-500 focus:outline-none"
            >
              {PRESET_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label} ({opt.value})
                </option>
              ))}
            </select>
            <p className="text-[11px] text-neutral-500 mt-1">
              The engine searches for this exact file in <code className="text-neutral-400">/doom/</code>.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-neutral-950 border-t border-neutral-800 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-mono text-neutral-400 hover:text-neutral-200 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleLaunch}
            disabled={!fileData || !parsedInfo?.isValid}
            className="px-6 py-2.5 bg-gradient-to-b from-red-700 to-red-900 hover:from-red-600 hover:to-red-800 text-white font-mono font-bold text-xs uppercase tracking-wider rounded border border-red-500 flex items-center gap-2 shadow-lg disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition"
          >
            <Play className="w-4 h-4 fill-white" />
            <span>Load & Play</span>
          </button>
        </div>
      </div>
    </div>
  );
};
