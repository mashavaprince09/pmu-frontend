import { Injectable } from '@angular/core';

export interface Phasor {
  channel: string;
  magnitude: number;
  phaseRad: number;
}

/** Cycles of the fundamental captured per FFT. Short enough that grid-frequency drift
 *  within the slice is negligible, long enough for the fundamental bin to be well-resolved. */
const TARGET_CYCLES = 16;

function hannWindow(n: number): Float64Array {
  const w = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1));
  }
  return w;
}

function nextPowerOfTwo(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

/** In-place iterative radix-2 Cooley-Tukey FFT. re/im length must be a power of two. */
function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wRe = Math.cos(ang);
    const wIm = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let curRe = 1;
      let curIm = 0;
      for (let k = 0; k < len / 2; k++) {
        const uRe = re[i + k];
        const uIm = im[i + k];
        const vRe = re[i + k + len / 2] * curRe - im[i + k + len / 2] * curIm;
        const vIm = re[i + k + len / 2] * curIm + im[i + k + len / 2] * curRe;
        re[i + k] = uRe + vRe;
        im[i + k] = uIm + vIm;
        re[i + k + len / 2] = uRe - vRe;
        im[i + k + len / 2] = uIm - vIm;
        const nextRe = curRe * wRe - curIm * wIm;
        const nextIm = curRe * wIm + curIm * wRe;
        curRe = nextRe;
        curIm = nextIm;
      }
    }
  }
}

@Injectable({ providedIn: 'root' })
export class PhasorService {
  /**
   * Computes per-channel phasors (magnitude + phase) at the fundamental frequency
   * via a Hann-windowed, zero-padded FFT over a short (~16-cycle) slice.
   *
   * Deliberately short: a multi-second FFT over PMU data smears the fundamental
   * across many bins because grid frequency drifts within the window (verified
   * empirically — an 8s window underestimated RMS by >5x vs. the time-domain value).
   * A short slice keeps drift negligible; zero-padding to the next power of two
   * gives finer bin resolution without capturing more drift.
   *
   * Phase is reported relative to the first channel in `channelOrder`.
   */
  computePhasors(
    channels: Record<string, Float64Array>,
    channelOrder: string[],
    sampleRateHz: number,
    fundamentalHz: number
  ): Phasor[] {
    if (!sampleRateHz || sampleRateHz <= 0 || !fundamentalHz || fundamentalHz <= 0) return [];

    const results: { channel: string; re: number; im: number; magnitude: number }[] = [];

    for (const channel of channelOrder) {
      const full = channels[channel];
      if (!full || full.length < 8) continue;

      const targetLen = Math.round((TARGET_CYCLES / fundamentalHz) * sampleRateHz);
      const sliceLen = Math.min(full.length, targetLen);
      const start = Math.floor((full.length - sliceLen) / 2);
      const slice = full.subarray(start, start + sliceLen);

      const window = hannWindow(sliceLen);
      const windowGain = window.reduce((a, b) => a + b, 0) / sliceLen;

      const nfft = nextPowerOfTwo(sliceLen);
      const re = new Float64Array(nfft);
      const im = new Float64Array(nfft);
      for (let i = 0; i < sliceLen; i++) {
        re[i] = slice[i] * window[i];
      }
      fft(re, im);

      const binHz = sampleRateHz / nfft;
      const bin = Math.round(fundamentalHz / binHz);
      const clampedBin = Math.max(1, Math.min(bin, nfft / 2 - 1));

      // Normalize by the un-padded slice length: zero-padding adds resolution, not energy.
      const magnitude = (2 / (sliceLen * windowGain)) * Math.hypot(re[clampedBin], im[clampedBin]);
      results.push({ channel, re: re[clampedBin], im: im[clampedBin], magnitude });
    }

    if (results.length === 0) return [];

    const referencePhase = Math.atan2(results[0].im, results[0].re);
    return results.map((r) => ({
      channel: r.channel,
      magnitude: r.magnitude,
      phaseRad: Math.atan2(r.im, r.re) - referencePhase
    }));
  }
}
