import React, { useState, useEffect } from 'react';
import { X, Sliders, Volume2, Monitor, Smartphone, Save, Download, Upload, Shield } from 'lucide-react';
import { GameSettings } from '../types/doom';
import { getSaveSlotInfo, exportSaveFile, importSaveFile, SaveSlotInfo } from '../utils/saveGameManager';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: GameSettings;
  onUpdateSettings: (newSettings: Partial<GameSettings>) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
}) => {
  const [activeTab, setActiveTab] = useState<'controls' | 'audio' | 'display' | 'mobile' | 'saves'>('controls');
  const [saveSlots, setSaveSlots] = useState<SaveSlotInfo[]>([]);
  const [importStatus, setImportStatus] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const slots = [0, 1, 2, 3, 4, 5].map((slot) => getSaveSlotInfo(slot, window.Module));
      setSaveSlots(slots);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleExportSave = (slot: number) => {
    try {
      exportSaveFile(slot, window.Module);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Save slot export failed');
    }
  };

  const handleImportSave = async (slot: number, file: File) => {
    try {
      await importSaveFile(file, slot, window.Module);
      setImportStatus(`Successfully imported save to Slot ${slot + 1}!`);
      const slots = [0, 1, 2, 3, 4, 5].map((s) => getSaveSlotInfo(s, window.Module));
      setSaveSlots(slots);
      setTimeout(() => setImportStatus(null), 3000);
    } catch (err: unknown) {
      setImportStatus(err instanceof Error ? err.message : 'Import failed');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
      <div className="relative w-full max-w-xl bg-neutral-900 border-2 border-neutral-700 shadow-[0_0_50px_rgba(0,0,0,0.8)] text-neutral-200 rounded overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-neutral-950 via-neutral-900 to-neutral-950 border-b border-neutral-800">
          <div className="flex items-center gap-2.5">
            <Sliders className="w-5 h-5 text-red-500" />
            <h2 className="text-lg font-bold font-mono tracking-wider uppercase text-neutral-100">
              Settings & Configuration
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded transition"
            aria-label="Close settings"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-neutral-800 bg-neutral-950/60 overflow-x-auto">
          {[
            { id: 'controls', label: 'Controls', icon: Sliders },
            { id: 'audio', label: 'Audio', icon: Volume2 },
            { id: 'display', label: 'Display', icon: Monitor },
            { id: 'mobile', label: 'Touch', icon: Smartphone },
            { id: 'saves', label: 'Save Games', icon: Save },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-mono font-bold tracking-wider uppercase border-b-2 transition whitespace-nowrap ${
                  isActive
                    ? 'border-red-500 text-red-400 bg-neutral-900'
                    : 'border-transparent text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/40'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1 font-mono text-xs">
          {/* Controls Tab */}
          {activeTab === 'controls' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between p-3 bg-neutral-950 rounded border border-neutral-800">
                <div>
                  <div className="font-bold text-neutral-200">Modern WASD + Mouse Strafing</div>
                  <div className="text-[11px] text-neutral-400">
                    A/D strafes horizontally while mouse horizontal axis turns player.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.modernControls}
                  onChange={(e) => onUpdateSettings({ modernControls: e.target.checked })}
                  className="w-4 h-4 accent-red-600 rounded cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between mb-2">
                  <span className="font-bold text-neutral-200">Mouse Sensitivity</span>
                  <span className="text-red-400 font-bold">{settings.mouseSensitivity}x</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="16"
                  step="1"
                  value={settings.mouseSensitivity}
                  onChange={(e) => onUpdateSettings({ mouseSensitivity: Number(e.target.value) })}
                  className="w-full accent-red-600"
                />
                <div className="flex justify-between text-[10px] text-neutral-500 mt-1">
                  <span>Slow (1x)</span>
                  <span>Normal (4x)</span>
                  <span>Fast (16x)</span>
                </div>
              </div>

              <div className="p-3 bg-neutral-950/80 rounded border border-neutral-800 text-[11px] space-y-1 text-neutral-300">
                <div className="font-bold text-amber-400 flex items-center gap-1.5 mb-1.5">
                  <Shield className="w-3.5 h-3.5" /> Desktop Key Binding Reference:
                </div>
                <div>• <strong>WASD / Arrow Keys</strong>: Move & Strafe</div>
                <div>• <strong>Mouse Movement</strong>: Turn & Aim (click canvas for Pointer Lock)</div>
                <div>• <strong>Left Mouse Click / Ctrl</strong>: Shoot weapon</div>
                <div>• <strong>Space / E</strong>: Use, Open doors, Activate switches</div>
                <div>• <strong>Shift</strong>: Speed / Run</div>
                <div>• <strong>1 - 7</strong>: Weapon selection</div>
                <div>• <strong>Tab</strong>: Automap</div>
                <div>• <strong>Esc</strong>: Game Menu / Pause</div>
              </div>
            </div>
          )}

          {/* Audio Tab */}
          {activeTab === 'audio' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between p-3 bg-neutral-950 rounded border border-neutral-800">
                <div>
                  <div className="font-bold text-neutral-200">Mute Audio</div>
                  <div className="text-[11px] text-neutral-400">Silence all sound output</div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.muted}
                  onChange={(e) => onUpdateSettings({ muted: e.target.checked })}
                  className="w-4 h-4 accent-red-600 rounded cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between mb-2">
                  <span className="font-bold text-neutral-200">Sound Effects Volume</span>
                  <span className="text-red-400 font-bold">{settings.soundVolume}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={settings.soundVolume}
                  onChange={(e) => onUpdateSettings({ soundVolume: Number(e.target.value) })}
                  className="w-full accent-red-600"
                />
              </div>

              <div className="p-3 bg-neutral-950/80 rounded border border-neutral-800 text-[11px] text-neutral-400">
                The sound backend streams mixed 11,025 Hz 16-bit PCM sound directly to the Web Audio API destination node, matching authentic 1993 sound dynamics.
              </div>
            </div>
          )}

          {/* Display Tab */}
          {activeTab === 'display' && (
            <div className="space-y-5">
              <div>
                <label className="block font-bold text-neutral-200 mb-2">Aspect Ratio Mode</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: '4:3', label: 'Classic 4:3 (Pillarbox)' },
                    { id: 'fill', label: 'Fit Viewport' },
                    { id: 'stretch', label: 'Stretch Full' },
                  ].map((mode) => (
                    <button
                      key={mode.id}
                      onClick={() => onUpdateSettings({ aspectRatio: mode.id as GameSettings['aspectRatio'] })}
                      className={`p-2.5 rounded border text-center transition ${
                        settings.aspectRatio === mode.id
                          ? 'border-red-500 bg-red-950/40 text-red-200 font-bold'
                          : 'border-neutral-800 bg-neutral-950 text-neutral-400 hover:text-neutral-200'
                      }`}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-neutral-950 rounded border border-neutral-800">
                <div>
                  <div className="font-bold text-neutral-200">CRT Retro Scanlines Effect</div>
                  <div className="text-[11px] text-neutral-400">
                    Simulates vintage cathode ray tube monitor phosphor lines
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.crtScanlines}
                  onChange={(e) => onUpdateSettings({ crtScanlines: e.target.checked })}
                  className="w-4 h-4 accent-red-600 rounded cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-neutral-950 rounded border border-neutral-800">
                <div>
                  <div className="font-bold text-neutral-200">Engine Telemetry HUD</div>
                  <div className="text-[11px] text-neutral-400">
                    Display frame timing, internal resolution (320×200), and pointer status
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.showTelemetry}
                  onChange={(e) => onUpdateSettings({ showTelemetry: e.target.checked })}
                  className="w-4 h-4 accent-red-600 rounded cursor-pointer"
                />
              </div>
            </div>
          )}

          {/* Mobile Touch Tab */}
          {activeTab === 'mobile' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between p-3 bg-neutral-950 rounded border border-neutral-800">
                <div>
                  <div className="font-bold text-neutral-200">Enable Touchscreen Controls</div>
                  <div className="text-[11px] text-neutral-400">Show virtual joystick and action buttons</div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.touchControlsEnabled}
                  onChange={(e) => onUpdateSettings({ touchControlsEnabled: e.target.checked })}
                  className="w-4 h-4 accent-red-600 rounded cursor-pointer"
                />
              </div>

              <div>
                <label className="block font-bold text-neutral-200 mb-2">Button Scale</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['small', 'medium', 'large'] as const).map((scale) => (
                    <button
                      key={scale}
                      onClick={() => onUpdateSettings({ touchScale: scale })}
                      className={`p-2 rounded border uppercase font-bold text-center transition ${
                        settings.touchScale === scale
                          ? 'border-red-500 bg-red-950/40 text-red-200'
                          : 'border-neutral-800 bg-neutral-950 text-neutral-400 hover:text-neutral-200'
                      }`}
                    >
                      {scale}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex justify-between mb-2">
                  <span className="font-bold text-neutral-200">Control Opacity</span>
                  <span className="text-red-400 font-bold">{Math.round(settings.touchOpacity * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.2"
                  max="1.0"
                  step="0.05"
                  value={settings.touchOpacity}
                  onChange={(e) => onUpdateSettings({ touchOpacity: Number(e.target.value) })}
                  className="w-full accent-red-600"
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-neutral-950 rounded border border-neutral-800">
                <div>
                  <div className="font-bold text-neutral-200">Haptic Feedback</div>
                  <div className="text-[11px] text-neutral-400">Vibrate on button press (mobile devices)</div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.haptics}
                  onChange={(e) => onUpdateSettings({ haptics: e.target.checked })}
                  className="w-4 h-4 accent-red-600 rounded cursor-pointer"
                />
              </div>
            </div>
          )}

          {/* Saves Tab */}
          {activeTab === 'saves' && (
            <div className="space-y-4">
              <p className="text-[11px] text-neutral-400">
                DOOM saves games via the in-game menu (Press Esc → Save Game). You can export and backup save files (.dsg) or import them into any slot.
              </p>

              {importStatus && (
                <div className="p-2.5 bg-green-950/80 border border-green-700 text-green-300 rounded text-xs">
                  {importStatus}
                </div>
              )}

              <div className="space-y-2">
                {saveSlots.map((slot) => (
                  <div
                    key={slot.slot}
                    className="p-3 bg-neutral-950 border border-neutral-800 rounded flex items-center justify-between gap-3"
                  >
                    <div>
                      <div className="font-bold text-neutral-200">Slot {slot.slot + 1}</div>
                      <div className="text-[11px] text-neutral-400 truncate max-w-[200px]">
                        {slot.description}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleExportSave(slot.slot)}
                        disabled={!slot.exists}
                        className="px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 disabled:opacity-40 text-neutral-200 text-xs rounded border border-neutral-700 flex items-center gap-1 cursor-pointer"
                        title="Download save file"
                      >
                        <Download className="w-3 h-3" /> Export
                      </button>
                      <label className="px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs rounded border border-neutral-700 flex items-center gap-1 cursor-pointer">
                        <Upload className="w-3 h-3" /> Import
                        <input
                          type="file"
                          accept=".dsg,application/octet-stream"
                          className="hidden"
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              handleImportSave(slot.slot, e.target.files[0]);
                            }
                          }}
                        />
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-neutral-950 border-t border-neutral-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-mono text-xs uppercase tracking-wider font-bold rounded cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
