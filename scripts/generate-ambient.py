"""Synthesize the 42-second ambient track for the zoom-out journey.

Usage: python3 scripts/generate-ambient.py [output.wav]
Requires numpy and scipy. Output is 44.1 kHz, 16-bit stereo WAV.
"""
import sys

import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, fftconvolve, sosfilt

SR = 44100
DURATION = 42.0
N = int(SR * DURATION)
T = np.arange(N) / SR
DETUNE = (0.997, 1.003)  # left, right
rng = np.random.default_rng(42)


def midi_hz(note):
    return 440.0 * 2.0 ** ((note - 69) / 12.0)


def pad_note(note, rolloff):
    """Additive pad: 6 harmonics at 1/k^rolloff, detuned per channel, slow LFO."""
    freq = midi_hz(note)
    out = np.zeros((N, 2))
    for ch, detune in enumerate(DETUNE):
        for k in range(1, 7):
            phase = rng.uniform(0, 2 * np.pi)
            out[:, ch] += np.sin(2 * np.pi * freq * detune * k * T + phase) / k**rolloff
    lfo_hz = rng.uniform(0.05, 0.16)
    lfo_phase = rng.uniform(0, 2 * np.pi)
    lfo = 1.0 - 0.25 * (0.5 + 0.5 * np.sin(2 * np.pi * lfo_hz * T + lfo_phase))
    return out * lfo[:, None]


def chord(notes, start, end, fade_in, fade_out, level, rolloff=1.5, swell=None):
    sig = sum(pad_note(n, rolloff) for n in notes) / len(notes)
    env = np.clip((T - start) / fade_in, 0, 1) * np.clip((end - T) / fade_out, 0, 1)
    if swell:
        t0, t1 = swell
        env = env * (0.5 + 0.5 * np.clip((T - t0) / (t1 - t0), 0, 1))
    return sig * (env * level)[:, None]


def add_at(mix, start, mono):
    i = int(start * SR)
    seg = mono[: max(0, N - i)]
    mix[i : i + len(seg)] += seg[:, None]


def bell(note, amp, decay=2.2):
    t = np.arange(int(SR * decay * 5)) / SR
    freq = midi_hz(note)
    tone = np.sin(2 * np.pi * freq * t)
    tone += 0.3 * np.sin(2 * np.pi * freq * 2.01 * t) * np.exp(-t / 0.3)
    env = np.clip(t / 0.010, 0, 1) * np.exp(-t / decay)
    return amp * tone * env


def sub_boom(freq, amp, decay):
    t = np.arange(int(SR * decay * 5)) / SR
    inst = freq + 25.0 * np.exp(-t / 0.1)  # settles within ~0.3 s
    phase = 2 * np.pi * np.cumsum(inst) / SR
    return amp * np.sin(phase) * np.clip(t / 0.005, 0, 1) * np.exp(-t / decay)


def peak_norm(x):
    return x / np.max(np.abs(x))


dry = np.zeros((N, 2))

# Chords
dry += chord([38, 45, 50, 53, 57], 0.2, 17.5, 2.0, 3.0, 0.55)
dry += chord([34, 41, 46, 50, 53, 58], 15.0, 25.5, 3.0, 3.0, 0.6)
dry += chord([41, 48, 53, 57, 60, 65, 72], 22.5, 32.3, 3.5, 0.5, 1.1,
             rolloff=1.25, swell=(24.0, 31.0))
dry += chord([50, 57, 62], 32.6, 42.0, 2.5, 2.5, 0.28)

# Bells
for when, note, amp in [
    (0.3, 81, 0.35), (3.0, 74, 0.2), (9.0, 77, 0.2), (16.0, 74, 0.22),
    (24.0, 81, 0.28), (28.0, 84, 0.22), (35.4, 86, 0.35), (36.4, 81, 0.25),
    (39.0, 74, 0.25), (39.9, 81, 0.2),
]:
    add_at(dry, when, bell(note, amp))

# Sub booms
add_at(dry, 0.3, sub_boom(48, 0.7, 1.6))
add_at(dry, 24.0, sub_boom(44, 1.0, 2.2))

# Shimmer: band-passed noise rising 20–30 s, cut at 32.2 s
noise = rng.standard_normal((N, 2))
band = sosfilt(butter(2, [3000, 9000], btype="band", fs=SR, output="sos"), noise, axis=0)
shimmer_env = np.clip((T - 20.0) / 10.0, 0, 1) * np.clip((32.2 - T) / 0.03, 0, 1)
dry += 0.05 * peak_norm(band) * shimmer_env[:, None]

# Reverb: 3 s of exponentially decaying stereo noise
ir_t = np.arange(int(SR * 3.0)) / SR
ir = rng.standard_normal((len(ir_t), 2)) * np.exp(-ir_t / 0.9)[:, None]
wet = np.stack([fftconvolve(dry[:, ch], ir[:, ch])[:N] for ch in range(2)], axis=1)
mix = 0.6 * peak_norm(dry) + 0.55 * peak_norm(wet)

# Master
mix = sosfilt(butter(2, 6000, btype="low", fs=SR, output="sos"), mix, axis=0)
mix *= (np.clip(T / 0.3, 0, 1) * np.clip((DURATION - T) / 2.5, 0, 1))[:, None]
mix = 0.8 * peak_norm(mix)

out_path = sys.argv[1] if len(sys.argv) > 1 else "ambient.wav"
wavfile.write(out_path, SR, np.round(mix * 32767).astype(np.int16))
print(f"wrote {out_path}: {DURATION:.0f}s, {SR} Hz, stereo, 16-bit")
