/**
 * 二百四 — 音效系统
 * 使用 WAV 数据 URI + wx.createInnerAudioContext 替代 Web Audio API
 */

const SAMPLE_RATE = 22050;

function writeString(view, offset, str) {
  for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
}

function myBtoa(str) {
  if (typeof btoa === 'function') return btoa(str);
  var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  var out = '', i = 0;
  while (i < str.length) {
    var a = str.charCodeAt(i++);
    var b = str.charCodeAt(i++);
    var c = str.charCodeAt(i++);
    var b1 = a >> 2;
    var b2 = ((a & 3) << 4) | (b >> 4);
    var b3 = isNaN(b) ? 64 : ((b & 15) << 2) | (c >> 6);
    var b4 = isNaN(c) ? 64 : (c & 63);
    out += chars.charAt(b1) + chars.charAt(b2) + chars.charAt(b3) + chars.charAt(b4);
  }
  return out;
}

function float32ToWavDataUri(samples) {
  var numSamples = samples.length;
  var buffer = new ArrayBuffer(44 + numSamples * 2);
  var view = new DataView(buffer);

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

  for (var i = 0; i < numSamples; i++) {
    var s = samples[i];
    if (s > 1) s = 1; if (s < -1) s = -1;
    view.setInt16(44 + i * 2, s * 0x7FFF, true);
  }

  var bytes = new Uint8Array(buffer);
  var binary = '';
  for (var j = 0; j < bytes.length; j++) binary += String.fromCharCode(bytes[j]);
  return 'data:audio/wav;base64,' + myBtoa(binary);
}

function generateTone(freq, type, duration, volume) {
  var numSamples = Math.floor(SAMPLE_RATE * duration);
  var buffer = new Float32Array(numSamples);

  for (var i = 0; i < numSamples; i++) {
    var t = i / SAMPLE_RATE;
    var envelope = Math.exp(-t * 4);
    var sample;
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
  var numSamples = Math.floor(SAMPLE_RATE * (duration + delay));
  var buffer = new Float32Array(numSamples);
  var offset = Math.floor(SAMPLE_RATE * delay);

  for (var i = offset; i < numSamples; i++) {
    var t = (i - offset) / SAMPLE_RATE;
    var envelope = Math.exp(-t * 4);
    var sample;
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
  var len = 0;
  for (var i = 0; i < buffers.length; i++) { if (buffers[i].length > len) len = buffers[i].length; }
  var out = new Float32Array(len);
  for (var i = 0; i < buffers.length; i++) {
    for (var j = 0; j < buffers[i].length; j++) out[j] += buffers[i][j];
  }
  return out;
}

var SFX_URIS = null;

function initSounds() {
  if (SFX_URIS) return;
  try {
    SFX_URIS = {};
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
  } catch (e) {
    // 音效生成失败则静默，不阻塞游戏
    SFX_URIS = { _empty: true };
  }
}

function playSfx(name) {
  if (typeof wx === 'undefined') return;
  try {
    initSounds();
    if (SFX_URIS._empty) return;
    var uri = SFX_URIS[name];
    if (!uri) return;
    var ctx = wx.createInnerAudioContext();
    ctx.src = uri;
    ctx.autoplay = true;
    ctx.onEnded(function () { ctx.destroy(); });
    ctx.onError(function () { ctx.destroy(); });
  } catch (e) {
    // 静默失败
  }
}

var SFX = {
  deal: function () { playSfx('deal'); },
  pick: function () { playSfx('pick'); },
  play: function () { playSfx('play'); },
  shout: function () { playSfx('shout'); },
  score: function () { playSfx('score'); },
  win: function () { playSfx('win'); },
  lose: function () { playSfx('lose'); },
};

module.exports = { initSounds: initSounds, playSfx: playSfx, SFX: SFX };
