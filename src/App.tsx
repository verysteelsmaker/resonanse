import { useRef, useState, useCallback } from 'react';
import {
  Play,
  Pause,
  Square,
  Mic,
  MicOff,
  Upload,
  Download,
  Volume2,
  Waves,
  Filter,
  Radio,
  Music,
  Trash2,
} from 'lucide-react';
import { useAudioProcessor } from './hooks/useAudioProcessor';
import { AudioVisualizer } from './components/AudioVisualizer';

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function App() {
  const {
    isPlaying,
    isRecording,
    duration,
    currentTime,
    hasAudio,
    fileName,
    settings,
    frequencyData,
    isExporting,
    loadAudioFile,
    togglePlay,
    stopPlayback,
    startRecording,
    stopRecording,
    updateSettings,
    exportAudio,
    seek,
  } = useAudioProcessor();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFile = useCallback(
    (file: File) => {
      if (file.type.startsWith('audio/')) {
        loadAudioFile(file);
      }
    },
    [loadAudioFile]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  const handleSeek = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const pct = Math.max(0, Math.min(1, x / rect.width));
      seek(pct * duration);
    },
    [duration, seek]
  );

  const clearAudio = useCallback(() => {
    stopPlayback();
    updateSettings({ effectType: 'wall', intensity: 70, cutoff: 300, reverbAmount: 50, volume: 80, muffled: 60 });
    window.location.reload();
  }, [stopPlayback, updateSettings]);

  return (
    <div className="min-h-screen bg-black text-white/90 flex flex-col items-center px-4 py-8 sm:py-12 select-none">
      {/* Header */}
      <header className="mb-10 text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full border border-white/10 mb-4">
          <Waves className="w-5 h-5 text-white/70" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-light tracking-widest uppercase text-white/90">
          Resonance
        </h1>
        <p className="text-xs sm:text-sm text-white/30 mt-2 tracking-wider uppercase">
          Audio spatial processor
        </p>
      </header>

      {/* Main card */}
      <div className="w-full max-w-2xl space-y-6">
        {/* Upload / Drop zone */}
        {!hasAudio && (
          <div
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onClick={() => fileInputRef.current?.click()}
            className={`
              relative border border-dashed rounded-2xl p-10 text-center cursor-pointer
              transition-all duration-300
              ${isDragging ? 'border-white/40 bg-white/[0.03]' : 'border-white/10 bg-white/[0.02] hover:border-white/25 hover:bg-white/[0.04]'}
            `}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
                e.target.value = '';
              }}
            />
            <Upload className="w-6 h-6 mx-auto mb-3 text-white/30" />
            <p className="text-sm text-white/50">Drop audio file or click to browse</p>
            <p className="text-xs text-white/20 mt-1">MP3, WAV, OGG, M4A</p>
          </div>
        )}

        {/* Recording row */}
        {!hasAudio && (
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={isRecording ? stopRecording : startRecording}
              className={`
                flex items-center gap-2 px-5 py-2.5 rounded-full text-xs tracking-wider uppercase
                transition-all duration-200 border
                ${isRecording
                  ? 'bg-red-500/10 border-red-500/30 text-red-300 hover:bg-red-500/20'
                  : 'bg-white/[0.03] border-white/10 text-white/50 hover:bg-white/[0.06] hover:text-white/70'}
              `}
            >
              {isRecording ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
              {isRecording ? 'Stop recording' : 'Record from mic'}
            </button>
          </div>
        )}

        {/* Audio loaded state */}
        {hasAudio && (
          <>
            {/* File info */}
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-3">
                <Music className="w-4 h-4 text-white/30" />
                <span className="text-sm text-white/60 truncate max-w-[200px] sm:max-w-xs">
                  {fileName}
                </span>
              </div>
              <button
                onClick={clearAudio}
                className="text-white/20 hover:text-white/50 transition-colors"
                title="Clear"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            {/* Visualizer */}
            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
              <AudioVisualizer frequencyData={frequencyData} isPlaying={isPlaying} />
            </div>

            {/* Progress */}
            <div className="space-y-2">
              <div
                className="h-1 bg-white/5 rounded-full cursor-pointer overflow-hidden"
                onClick={handleSeek}
              >
                <div
                  className="h-full bg-white/40 rounded-full transition-all duration-100"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-white/25 tracking-wider font-mono">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* Transport controls */}
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={togglePlay}
                className="w-12 h-12 rounded-full border border-white/15 bg-white/[0.04] flex items-center justify-center
                  hover:bg-white/[0.08] hover:border-white/30 transition-all active:scale-95"
              >
                {isPlaying ? (
                  <Pause className="w-5 h-5 text-white/80" />
                ) : (
                  <Play className="w-5 h-5 text-white/80 ml-0.5" />
                )}
              </button>
              <button
                onClick={stopPlayback}
                className="w-10 h-10 rounded-full border border-white/10 bg-white/[0.02] flex items-center justify-center
                  hover:bg-white/[0.06] hover:border-white/20 transition-all active:scale-95"
              >
                <Square className="w-4 h-4 text-white/50" />
              </button>
            </div>

            {/* Effect selector */}
            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-5 space-y-5">
              <div className="flex items-center gap-2 mb-1">
                <Radio className="w-3.5 h-3.5 text-white/30" />
                <span className="text-[10px] uppercase tracking-widest text-white/30">Effect</span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {(['wall', 'barrel', 'none'] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => updateSettings({ effectType: type })}
                    className={`
                      py-2.5 rounded-lg text-xs tracking-wider uppercase border transition-all
                      ${settings.effectType === type
                        ? 'bg-white/10 border-white/25 text-white/90'
                        : 'bg-transparent border-white/5 text-white/30 hover:border-white/15 hover:text-white/50'}
                    `}
                  >
                    {type === 'wall' ? 'Behind wall' : type === 'barrel' ? 'In barrel' : 'Original'}
                  </button>
                ))}
              </div>

              {/* Sliders */}
              <div className="space-y-5 pt-2">
                <SliderControl
                  icon={<Filter className="w-3.5 h-3.5" />}
                  label="Intensity"
                  value={settings.intensity}
                  onChange={(v) => updateSettings({ intensity: v })}
                  min={0}
                  max={100}
                />
                <SliderControl
                  icon={<Waves className="w-3.5 h-3.5" />}
                  label="Cutoff"
                  value={settings.cutoff}
                  onChange={(v) => updateSettings({ cutoff: v })}
                  min={50}
                  max={2000}
                  displayValue={`${settings.cutoff} Hz`}
                />
                <SliderControl
                  icon={<Radio className="w-3.5 h-3.5" />}
                  label="Reverb"
                  value={settings.reverbAmount}
                  onChange={(v) => updateSettings({ reverbAmount: v })}
                  min={0}
                  max={100}
                />
                {settings.effectType === 'wall' && (
                  <SliderControl
                    icon={<Filter className="w-3.5 h-3.5" />}
                    label="Muffle"
                    value={settings.muffled}
                    onChange={(v) => updateSettings({ muffled: v })}
                    min={0}
                    max={100}
                  />
                )}
                <SliderControl
                  icon={<Volume2 className="w-3.5 h-3.5" />}
                  label="Volume"
                  value={settings.volume}
                  onChange={(v) => updateSettings({ volume: v })}
                  min={0}
                  max={150}
                />
              </div>
            </div>

            {/* Export */}
            <button
              onClick={exportAudio}
              disabled={isExporting}
              className="w-full py-3 rounded-xl border border-white/10 bg-white/[0.03] flex items-center justify-center gap-2
                hover:bg-white/[0.07] hover:border-white/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Download className="w-4 h-4 text-white/50" />
              <span className="text-xs tracking-wider uppercase text-white/50">
                {isExporting ? 'Rendering...' : 'Export WAV'}
              </span>
            </button>
          </>
        )}
      </div>

      {/* Footer */}
      <footer className="mt-16 text-[10px] text-white/15 tracking-widest uppercase">
        Web Audio API
      </footer>
    </div>
  );
}

interface SliderControlProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  onChange: (val: number) => void;
  min: number;
  max: number;
  displayValue?: string;
}

function SliderControl({ icon, label, value, onChange, min, max, displayValue }: SliderControlProps) {
  const percent = ((value - min) / (max - min)) * 100;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-white/30">
          {icon}
          <span className="text-[10px] uppercase tracking-widest">{label}</span>
        </div>
        <span className="text-[10px] text-white/40 font-mono">
          {displayValue ?? value}
        </span>
      </div>
      <div className="relative h-6 flex items-center">
        {/* Background track */}
        <div className="absolute left-0 right-0 h-1 bg-white/5 rounded-full pointer-events-none" />
        {/* Filled track */}
        <div
          className="absolute left-0 h-1 bg-white/30 rounded-full pointer-events-none"
          style={{ width: `${percent}%` }}
        />
        {/* Native range input - transparent and full size for real interaction */}
        <input
          type="range"
          min={min}
          max={max}
          step={1}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="relative w-full h-6 bg-transparent appearance-none cursor-pointer z-10
            [&::-webkit-slider-thumb]:appearance-none
            [&::-webkit-slider-thumb]:w-3
            [&::-webkit-slider-thumb]:h-3
            [&::-webkit-slider-thumb]:rounded-full
            [&::-webkit-slider-thumb]:bg-white
            [&::-webkit-slider-thumb]:shadow-md
            [&::-webkit-slider-thumb]:cursor-grab
            [&::-webkit-slider-thumb]:active:cursor-grabbing
            [&::-moz-range-thumb]:w-3
            [&::-moz-range-thumb]:h-3
            [&::-moz-range-thumb]:rounded-full
            [&::-moz-range-thumb]:bg-white
            [&::-moz-range-thumb]:border-0
            [&::-moz-range-thumb]:cursor-grab"
          style={{
            background: 'transparent',
          }}
        />
      </div>
    </div>
  );
}
