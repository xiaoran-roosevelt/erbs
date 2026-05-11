/**
 * 二百四 — 音效系统
 * 使用 WAV 数据 URI + wx.createInnerAudioContext 替代 Web Audio API
 */

const SAMPLE_RATE = 22050;

function writeString(view, offset, str) {
  for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
}

function float32ToWavDataUri(samples) {
  const numSamples = samples.length;
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, 'data');
  view.setUint32(40, numSamples * 2, true);

  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, s * 0x7FFF, true);
  }

  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return 'data:audio/wav;base64,' + btoa(binary);
}

function generateTone(freq, type, duration, volume) {
  const numSamples = Math.floor(SAMPLE_RATE * duration);
  const buffer = new Float32Array(numSamples);

  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE;
    const envelope = Math.exp(-t * 4);
    let sample;
    switch (type) {
      case 'sine': sample = Math.sin(2 * Math.PI * freq * t); break;
      case 'triangle': sample = 2 * Math.abs(2 * (t * freq - Math.floor(t * freq + 0.5))) - 1; break;
      case 'square': sample = Math.sin(2 * Math.PI * freq * t) > 0 ? 1 : -1; break;
      default: sample = Math.sin(2 * Math.PI * freq * t);
    }
    buffer[i] = sample * envelope * volume;
  }

  return buffer;
}

function generateToneWithDelay(freq, type, duration, volume, delay) {
  const numSamples = Math.floor(SAMPLE_RATE * (duration + delay));
  const buffer = new Float32Array(numSamples);
  const offset = Math.floor(SAMPLE_RATE * delay);

  for (let i = offset; i < numSamples; i++) {
    const t = (i - offset) / SAMPLE_RATE;
    const envelope = Math.exp(-t * 4);
    let sample;
    switch (type) {
      case 'sine': sample = Math.sin(2 * Math.PI * freq * t); break;
      case 'triangle': sample = 2 * Math.abs(2 * (t * freq - Math.floor(t * freq + 0.5))) - 1; break;
      case 'square': sample = Math.sin(2 * Math.PI * freq * t) > 0 ? 1 : -1; break;
      default: sample = Math.sin(2 * Math.PI * freq * t);
    }
    buffer[i] = sample * envelope * volume;
  }

  return buffer;
}

function mixBuffers(buffers) {
  const len = Math.max(...buffers.map(b => b.length));
  const out = new Float32Array(len);
  for (const b of buffers)
    for (let i = 0; i < b.length; i++) out[i] += b[i];
  return out;
}

const SFX_URIS = {};

function initSounds() {
  if (SFX_URIS.deal) return; // 已初始化

  SFX_URIS.deal = float32ToWavDataUri(generateTone(380, 'sine', 0.03, 0.05));
  SFX_URIS.pick = float32ToWavDataUri(generateTone(820, 'sine', 0.04, 0.07));
  SFX_URIS.play = float32ToWavDataUri(
    mixBuffers([
      generateTone(540, 'triangle', 0.06, 0.1),
      generateToneWithDelay(720, 'triangle', 0.05, 0.07, 0.06)
    ])
  );
  SFX_URIS.shout = float32ToWavDataUri(
    mixBuffers([
      generateTone(600, 'sine', 0.1, 0.17),
      generateToneWithDelay(900, 'sine', 0.11, 0.17, 0.1),
      generateToneWithDelay(1100, 'sine', 0.13, 0.17, 0.22)
    ])
  );
  SFX_URIS.score = float32ToWavDataUri(generateTone(680, 'triangle', 0.1, 0.16));
  SFX_URIS.win = float32ToWavDataUri(
    mixBuffers([
      generateTone(523, 'sine', 0.26, 0.18),
      generateToneWithDelay(659, 'sine', 0.26, 0.18, 0.13),
      generateToneWithDelay(784, 'sine', 0.26, 0.18, 0.26),
      generateToneWithDelay(1047, 'sine', 0.26, 0.18, 0.39)
    ])
  );
  SFX_URIS.lose = float32ToWavDataUri(
    mixBuffers([
      generateTone(380, 'sine', 0.2, 0.15),
      generateToneWithDelay(330, 'sine', 0.2, 0.15, 0.17),
      generateToneWithDelay(280, 'sine', 0.2, 0.15, 0.34),
      generateToneWithDelay(230, 'sine', 0.2, 0.15, 0.51)
    ])
  );
}

function playSfx(name) {
  // 不播放音效的环境
  if (typeof wx === 'undefined') return;
  initSounds();
  const uri = SFX_URIS[name];
  if (!uri) return;

  try {
    const ctx = wx.createInnerAudioContext();
    ctx.src = uri;
    ctx.autoplay = true;
    ctx.onEnded(() => ctx.destroy());
    ctx.onError(() => ctx.destroy());
  } catch (e) {
    // 静默失败
  }
}

const SFX = {
  deal: () => playSfx('deal'),
  pick: () => playSfx('pick'),
  play: () => playSfx('play'),
  shout: () => playSfx('shout'),
  score: () => playSfx('score'),
  win: () => playSfx('win'),
  lose: () => playSfx('lose'),
};

module.exports = { initSounds, playSfx, SFX };
