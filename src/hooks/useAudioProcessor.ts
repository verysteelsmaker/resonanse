import { useRef, useState, useCallback, useEffect } from 'react';
import { createBarrelImpulse, createWallImpulse, bufferToWave } from '../utils/audioEffects';

export type EffectType = 'barrel' | 'wall' | 'none';

export interface AudioSettings {
  effectType: EffectType;
  intensity: number; // 0-100
  cutoff: number; // 50-2000 Hz
  reverbAmount: number; // 0-100
  volume: number; // 0-100
  muffled: number; // 0-100 extra attenuation for wall effect
}

const defaultSettings: AudioSettings = {
  effectType: 'wall',
  intensity: 70,
  cutoff: 300,
  reverbAmount: 50,
  volume: 80,
  muffled: 60,
};

export function useAudioProcessor() {
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const lowpassRef = useRef<BiquadFilterNode | null>(null);
  const highpassRef = useRef<BiquadFilterNode | null>(null);
  const convolverRef = useRef<ConvolverNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const compressorRef = useRef<DynamicsCompressorNode | null>(null);
  const dryGainRef = useRef<GainNode | null>(null);
  const wetGainRef = useRef<GainNode | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const animationFrameRef = useRef<number>(0);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const startTimeRef = useRef<number>(0);
  const pauseTimeRef = useRef<number>(0);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [hasAudio, setHasAudio] = useState(false);
  const [fileName, setFileName] = useState('');
  const [settings, setSettings] = useState<AudioSettings>(defaultSettings);
  const [frequencyData, setFrequencyData] = useState<Uint8Array>(new Uint8Array(128));
  const [isExporting, setIsExporting] = useState(false);

  const getContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
    return audioContextRef.current;
  }, []);

  const buildChain = useCallback((ctx: AudioContext) => {
    // Cleanup old nodes
    if (sourceNodeRef.current) {
      try { sourceNodeRef.current.stop(); } catch {}
      sourceNodeRef.current.disconnect();
    }
    lowpassRef.current?.disconnect();
    highpassRef.current?.disconnect();
    convolverRef.current?.disconnect();
    gainNodeRef.current?.disconnect();
    compressorRef.current?.disconnect();
    dryGainRef.current?.disconnect();
    wetGainRef.current?.disconnect();
    analyserRef.current?.disconnect();

    // Create new nodes
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyserRef.current = analyser;

    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpassRef.current = lowpass;

    const highpass = ctx.createBiquadFilter();
    highpass.type = 'highpass';
    highpassRef.current = highpass;

    const convolver = ctx.createConvolver();
    convolver.normalize = true;
    convolverRef.current = convolver;

    const dryGain = ctx.createGain();
    dryGainRef.current = dryGain;

    const wetGain = ctx.createGain();
    wetGainRef.current = wetGain;

    const gainNode = ctx.createGain();
    gainNodeRef.current = gainNode;

    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -24;
    compressor.knee.value = 30;
    compressor.ratio.value = 12;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.25;
    compressorRef.current = compressor;

    // Chain: source -> analyser -> lowpass -> highpass -> [dry/wet mix with convolver] -> gain -> compressor -> destination
    analyser.connect(lowpass);
    lowpass.connect(highpass);

    // Dry path
    highpass.connect(dryGain);
    dryGain.connect(gainNode);

    // Wet path
    highpass.connect(convolver);
    convolver.connect(wetGain);
    wetGain.connect(gainNode);

    gainNode.connect(compressor);
    compressor.connect(ctx.destination);

    return { analyser, lowpass, highpass, convolver, dryGain, wetGain, gainNode, compressor };
  }, []);

  const updateSettings = useCallback((newSettings: Partial<AudioSettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...newSettings };
      const ctx = audioContextRef.current;
      if (!ctx) return next;

      // Update lowpass
      if (lowpassRef.current) {
        const baseCutoff = next.effectType === 'barrel'
          ? 200 + (100 - next.intensity) * 8
          : next.effectType === 'wall'
            ? 80 + (100 - next.intensity) * 12
            : 20000;
        const targetCutoff = Math.min(20000, Math.max(40, baseCutoff * (next.cutoff / 500)));
        lowpassRef.current.frequency.setTargetAtTime(targetCutoff, ctx.currentTime, 0.1);
        lowpassRef.current.Q.value = next.effectType === 'barrel' ? 2 : 0.5;
      }

      // Update highpass
      if (highpassRef.current) {
        const hpFreq = next.effectType === 'wall' ? 40 + next.muffled * 0.5 : 20;
        highpassRef.current.frequency.setTargetAtTime(Math.min(hpFreq, 200), ctx.currentTime, 0.1);
      }

      // Update convolver impulse
      if (convolverRef.current) {
        if (next.effectType === 'barrel') {
          convolverRef.current.buffer = createBarrelImpulse(ctx);
        } else if (next.effectType === 'wall') {
          convolverRef.current.buffer = createWallImpulse(ctx);
        } else {
          convolverRef.current.buffer = null;
        }
      }

      // Update wet/dry mix
      if (dryGainRef.current && wetGainRef.current) {
        const wet = next.effectType === 'none' ? 0 : next.reverbAmount / 100;
        const dry = next.effectType === 'none' ? 1 : 1 - wet * 0.7;
        wetGainRef.current.gain.setTargetAtTime(wet, ctx.currentTime, 0.1);
        dryGainRef.current.gain.setTargetAtTime(dry, ctx.currentTime, 0.1);
      }

      // Update gain
      if (gainNodeRef.current) {
        const baseGain = next.effectType === 'wall'
          ? (next.volume / 100) * (1 - next.muffled / 300)
          : next.volume / 100;
        gainNodeRef.current.gain.setTargetAtTime(Math.max(0, baseGain), ctx.currentTime, 0.1);
      }

      return next;
    });
  }, []);

  const loadAudioFile = useCallback(async (file: File) => {
    const ctx = getContext();
    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    audioBufferRef.current = audioBuffer;
    setDuration(audioBuffer.duration);
    setHasAudio(true);
    setFileName(file.name);
    setCurrentTime(0);
    pauseTimeRef.current = 0;
  }, [getContext]);

  const startPlayback = useCallback((fromStart: boolean = false) => {
    const ctx = getContext();
    const buffer = audioBufferRef.current;
    if (!buffer) return;

    // Stop current
    if (sourceNodeRef.current) {
      try { sourceNodeRef.current.stop(); } catch {}
      sourceNodeRef.current.disconnect();
    }

    buildChain(ctx);
    // Apply current settings
    updateSettings({});

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    sourceNodeRef.current = source;

    const offset = fromStart ? 0 : pauseTimeRef.current;
    source.connect(analyserRef.current!);
    source.start(0, offset);
    startTimeRef.current = ctx.currentTime - offset;
    setIsPlaying(true);

    source.onended = () => {
      if (ctx.currentTime - startTimeRef.current >= buffer.duration - offset - 0.1) {
        setIsPlaying(false);
        setCurrentTime(0);
        pauseTimeRef.current = 0;
      }
    };
  }, [getContext, buildChain, updateSettings]);

  const pausePlayback = useCallback(() => {
    if (sourceNodeRef.current) {
      try { sourceNodeRef.current.stop(); } catch {}
      sourceNodeRef.current.disconnect();
      sourceNodeRef.current = null;
    }
    if (audioContextRef.current) {
      pauseTimeRef.current = audioContextRef.current.currentTime - startTimeRef.current;
    }
    setIsPlaying(false);
  }, []);

  const stopPlayback = useCallback(() => {
    if (sourceNodeRef.current) {
      try { sourceNodeRef.current.stop(); } catch {}
      sourceNodeRef.current.disconnect();
      sourceNodeRef.current = null;
    }
    pauseTimeRef.current = 0;
    setIsPlaying(false);
    setCurrentTime(0);
  }, []);

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      pausePlayback();
    } else {
      startPlayback();
    }
  }, [isPlaying, pausePlayback, startPlayback]);

  // Visualizer loop
  useEffect(() => {
    const loop = () => {
      if (analyserRef.current && isPlaying) {
        const data = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(data);
        setFrequencyData(data);

        if (audioContextRef.current) {
          const t = audioContextRef.current.currentTime - startTimeRef.current;
          setCurrentTime(Math.min(t, duration));
        }
      }
      animationFrameRef.current = requestAnimationFrame(loop);
    };
    animationFrameRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationFrameRef.current);
  }, [isPlaying, duration]);

  // Microphone recording
  const startRecording = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mediaRecorder = new MediaRecorder(stream);
    mediaRecorderRef.current = mediaRecorder;
    recordedChunksRef.current = [];

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) recordedChunksRef.current.push(e.data);
    };

    mediaRecorder.onstop = async () => {
      const blob = new Blob(recordedChunksRef.current, { type: 'audio/webm' });
      const arrayBuffer = await blob.arrayBuffer();
      const ctx = getContext();
      try {
        const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
        audioBufferRef.current = audioBuffer;
        setDuration(audioBuffer.duration);
        setHasAudio(true);
        setFileName('recording.webm');
        setCurrentTime(0);
        pauseTimeRef.current = 0;
      } catch {
        // Some browsers don't support webm decoding, try wav fallback
      }
      stream.getTracks().forEach(t => t.stop());
    };

    mediaRecorder.start();
    setIsRecording(true);
  }, [getContext]);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  }, []);

  // Export processed audio
  const exportAudio = useCallback(async () => {
    const buffer = audioBufferRef.current;
    if (!buffer) return;

    setIsExporting(true);
    const sampleRate = buffer.sampleRate;
    const offlineCtx = new OfflineAudioContext(
      buffer.numberOfChannels,
      buffer.length,
      sampleRate
    );

    // Rebuild chain in offline context
    const source = offlineCtx.createBufferSource();
    source.buffer = buffer;

    const analyser = offlineCtx.createAnalyser();
    analyser.fftSize = 256;

    const lowpass = offlineCtx.createBiquadFilter();
    lowpass.type = 'lowpass';
    const baseCutoff = settings.effectType === 'barrel'
      ? 200 + (100 - settings.intensity) * 8
      : settings.effectType === 'wall'
        ? 80 + (100 - settings.intensity) * 12
        : 20000;
    lowpass.frequency.value = Math.min(20000, Math.max(40, baseCutoff * (settings.cutoff / 500)));
    lowpass.Q.value = settings.effectType === 'barrel' ? 2 : 0.5;

    const highpass = offlineCtx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = settings.effectType === 'wall' ? 40 + settings.muffled * 0.5 : 20;

    const convolver = offlineCtx.createConvolver();
    convolver.normalize = true;
    if (settings.effectType === 'barrel') {
      convolver.buffer = createBarrelImpulse(offlineCtx);
    } else if (settings.effectType === 'wall') {
      convolver.buffer = createWallImpulse(offlineCtx);
    }

    const dryGain = offlineCtx.createGain();
    const wetGain = offlineCtx.createGain();
    const wet = settings.effectType === 'none' ? 0 : settings.reverbAmount / 100;
    const dry = settings.effectType === 'none' ? 1 : 1 - wet * 0.7;
    wetGain.gain.value = wet;
    dryGain.gain.value = dry;

    const gainNode = offlineCtx.createGain();
    const baseGain = settings.effectType === 'wall'
      ? (settings.volume / 100) * (1 - settings.muffled / 300)
      : settings.volume / 100;
    gainNode.gain.value = Math.max(0, baseGain);

    const compressor = offlineCtx.createDynamicsCompressor();
    compressor.threshold.value = -24;
    compressor.knee.value = 30;
    compressor.ratio.value = 12;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.25;

    source.connect(analyser);
    analyser.connect(lowpass);
    lowpass.connect(highpass);

    highpass.connect(dryGain);
    dryGain.connect(gainNode);

    highpass.connect(convolver);
    convolver.connect(wetGain);
    wetGain.connect(gainNode);

    gainNode.connect(compressor);
    compressor.connect(offlineCtx.destination);

    source.start(0);
    const rendered = await offlineCtx.startRendering();
    const blob = bufferToWave(rendered, rendered.length);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName.replace(/\.[^/.]+$/, '') + '_processed.wav';
    a.click();
    URL.revokeObjectURL(url);
    setIsExporting(false);
  }, [settings, fileName]);

  const seek = useCallback((time: number) => {
    pauseTimeRef.current = time;
    setCurrentTime(time);
    if (isPlaying) {
      startPlayback();
    }
  }, [isPlaying, startPlayback]);

  return {
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
  };
}
