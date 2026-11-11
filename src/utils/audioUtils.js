/**
 * Browser Web Audio helpers for EchoTrust Live Verification:
 * - Real 16kHz Mono 16-bit PCM WAV resampling + peak normalization + RMS quality telemetry
 * - Real FFT frequency analysis (no synthetic/Math.random waveforms)
 */

export const POST_TTS_COOLDOWN_MS = 450;

export async function convertBlobToWavWithMetrics(blob) {
  let ctx = null;
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    ctx = new AudioCtx();
    const arrayBuffer = await blob.arrayBuffer();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

    const targetSampleRate = 16000;
    const OfflineCtx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    const offlineCtx = new OfflineCtx(
      1,
      Math.max(1, Math.ceil(audioBuffer.duration * targetSampleRate)),
      targetSampleRate
    );
    const source = offlineCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(offlineCtx.destination);
    source.start(0);
    const renderedBuffer = await offlineCtx.startRendering();
    const channelData = renderedBuffer.getChannelData(0);

    let maxPeak = 0;
    let sumSq = 0;
    for (let i = 0; i < channelData.length; i++) {
      const v = channelData[i];
      const av = Math.abs(v);
      if (av > maxPeak) maxPeak = av;
      sumSq += v * v;
    }
    const rms = Math.sqrt(sumSq / Math.max(1, channelData.length));
    const gainMultiplier = maxPeak > 0.015 ? Math.min(3.5, 0.92 / maxPeak) : 1.0;

    const wavBuffer = new ArrayBuffer(44 + channelData.length * 2);
    const view = new DataView(wavBuffer);
    const writeString = (v, offset, str) => {
      for (let i = 0; i < str.length; i++) {
        v.setUint8(offset + i, str.charCodeAt(i));
      }
    };

    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + channelData.length * 2, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, targetSampleRate, true);
    view.setUint32(28, targetSampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(view, 36, 'data');
    view.setUint32(40, channelData.length * 2, true);

    let offset = 44;
    for (let i = 0; i < channelData.length; i++, offset += 2) {
      const s = Math.max(-1, Math.min(1, channelData[i] * gainMultiplier));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }

    return {
      wavBlob: new Blob([wavBuffer], { type: 'audio/wav' }),
      durationSec: audioBuffer.duration,
      peak: maxPeak,
      rms,
    };
  } catch (err) {
    return {
      wavBlob: blob,
      durationSec: 0,
      peak: 0.1,
      rms: 0.05,
      conversionError: err?.message || 'Audio decode failed',
    };
  } finally {
    if (ctx) {
      ctx.close().catch(() => {});
    }
  }
}

export function computeWaveformBars(analyser, numBars = 24) {
  if (!analyser) return new Array(numBars).fill(6);
  const binCount = analyser.frequencyBinCount;
  if (!binCount) return new Array(numBars).fill(6);

  const data = new Uint8Array(binCount);
  analyser.getByteFrequencyData(data);
  const step = Math.max(1, Math.floor((binCount * 0.6) / numBars));
  const bars = [];
  for (let i = 0; i < numBars; i++) {
    let sum = 0;
    for (let j = 0; j < step; j++) {
      sum += data[i * step + j] || 0;
    }
    const avg = sum / step;
    bars.push(Math.max(6, Math.min(100, Math.round((avg / 255) * 100))));
  }
  return bars;
}

export const IDLE_WAVEFORM_BARS = new Array(24).fill(6);

