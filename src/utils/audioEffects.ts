export function createImpulseResponse(
  audioContext: AudioContext | OfflineAudioContext,
  duration: number,
  decay: number,
  reverse: boolean = false
): AudioBuffer {
  const sampleRate = audioContext.sampleRate;
  const length = sampleRate * duration;
  const impulse = audioContext.createBuffer(2, length, sampleRate);
  const left = impulse.getChannelData(0);
  const right = impulse.getChannelData(1);

  for (let i = 0; i < length; i++) {
    const n = reverse ? length - i : i;
    const value = (Math.random() * 2 - 1) * Math.pow(1 - n / length, decay);
    left[i] = value;
    right[i] = value;
  }

  return impulse;
}

export function createBarrelImpulse(
  audioContext: AudioContext | OfflineAudioContext
): AudioBuffer {
  const sampleRate = audioContext.sampleRate;
  const duration = 2.5;
  const length = Math.floor(sampleRate * duration);
  const impulse = audioContext.createBuffer(2, length, sampleRate);

  for (let ch = 0; ch < 2; ch++) {
    const data = impulse.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      const env = Math.exp(-t * 3);
      const resonance = Math.sin(2 * Math.PI * 80 * t) * 0.3 +
                        Math.sin(2 * Math.PI * 120 * t) * 0.2 +
                        Math.sin(2 * Math.PI * 200 * t) * 0.1;
      const noise = (Math.random() * 2 - 1) * 0.05;
      data[i] = (resonance + noise) * env;
    }
  }

  return impulse;
}

export function createWallImpulse(
  audioContext: AudioContext | OfflineAudioContext
): AudioBuffer {
  const sampleRate = audioContext.sampleRate;
  const duration = 1.2;
  const length = Math.floor(sampleRate * duration);
  const impulse = audioContext.createBuffer(2, length, sampleRate);

  for (let ch = 0; ch < 2; ch++) {
    const data = impulse.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      const env = Math.exp(-t * 6);
      const resonance = Math.sin(2 * Math.PI * 200 * t) * 0.15 +
                        Math.sin(2 * Math.PI * 400 * t) * 0.08;
      const noise = (Math.random() * 2 - 1) * 0.03;
      data[i] = (resonance + noise) * env;
    }
  }

  return impulse;
}

export function bufferToWave(abuffer: AudioBuffer, len: number): Blob {
  const numOfChan = abuffer.numberOfChannels;
  const length = len * numOfChan * 2 + 44;
  const buffer = new ArrayBuffer(length);
  const view = new DataView(buffer);
  const channels: Float32Array[] = [];
  let i: number;
  let sample: number;
  let offset = 0;
  let pos = 0;

  // write WAVE header
  setUint32(0x46464952); // "RIFF"
  setUint32(length - 8); // file length - 8
  setUint32(0x45564157); // "WAVE"

  setUint32(0x20746d66); // "fmt " chunk
  setUint32(16); // length = 16
  setUint16(1); // PCM (uncompressed)
  setUint16(numOfChan);
  setUint32(abuffer.sampleRate);
  setUint32(abuffer.sampleRate * 2 * numOfChan); // avg. bytes/sec
  setUint16(numOfChan * 2); // block-align
  setUint16(16); // 16-bit (hardcoded in this demo)

  setUint32(0x61746164); // "data" - chunk
  setUint32(length - pos - 4); // chunk length

  // write interleaved data
  for (i = 0; i < numOfChan; i++) {
    channels.push(abuffer.getChannelData(i));
  }

  while (pos < length) {
    for (i = 0; i < numOfChan; i++) {
      sample = Math.max(-1, Math.min(1, channels[i][offset]));
      sample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(pos, sample, true);
      pos += 2;
    }
    offset++;
  }

  return new Blob([buffer], { type: 'audio/wav' });

  function setUint16(data: number) {
    view.setUint16(pos, data, true);
    pos += 2;
  }

  function setUint32(data: number) {
    view.setUint32(pos, data, true);
    pos += 4;
  }
}
