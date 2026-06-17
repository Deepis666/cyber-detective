#!/usr/bin/env python3
"""
Cyberpunk Detective Audio Generator
Generates procedural BGM and SFX for the cyber-detective game.
Uses numpy + wave (no external dependencies needed).
Output: WAV files (browser-compatible, can be loaded by Audio() directly).
"""

import numpy as np
import wave
import struct
import os
import math

# ====================
# Config
# ====================
SAMPLE_RATE = 44100
BITS = 16
MAX_AMP = 32767

OUTPUT_DIR = "D:/CODE/cyber-detective/assets/audio"

def ensure_dir():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

def save_wav(filename, samples):
    """Save float64 samples [-1,1] to 16-bit WAV."""
    filepath = os.path.join(OUTPUT_DIR, filename)
    samples = np.clip(samples, -1.0, 1.0)
    int_samples = (samples * MAX_AMP).astype(np.int16)
    with wave.open(filepath, 'w') as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(SAMPLE_RATE)
        wf.writeframes(int_samples.tobytes())
    print(f"[audio] Generated: {filepath}")
    return filepath

def seconds_to_samples(sec):
    return int(SAMPLE_RATE * sec)

def make_time(sec):
    return np.linspace(0, sec, seconds_to_samples(sec), endpoint=False)

def tone(freq, duration, amp=0.3, envelope=None, phase=0.0):
    """Generate a sine tone with optional envelope."""
    t = make_time(duration)
    sig = amp * np.sin(2 * np.pi * freq * t + phase)
    if envelope is not None:
        sig = sig * envelope(t)
    return sig

def square(freq, duration, amp=0.15):
    t = make_time(duration)
    sig = amp * np.sign(np.sin(2 * np.pi * freq * t))
    return sig

def sawtooth(freq, duration, amp=0.15):
    t = make_time(duration)
    sig = amp * (2 * (t * freq - np.floor(t * freq + 0.5)))
    return sig

def noise(duration, amp=0.05):
    """White noise."""
    return amp * (2 * np.random.random(seconds_to_samples(duration)) - 1)

def lowpass_noise(duration, amp=0.1, cutoff=500):
    """Simple filtered noise using moving average."""
    n = seconds_to_samples(duration)
    raw = 2 * np.random.random(n) - 1
    window_size = max(1, int(SAMPLE_RATE / cutoff))
    kernel = np.ones(window_size) / window_size
    filtered = np.convolve(raw, kernel, mode='same')
    filtered = filtered / (np.max(np.abs(filtered)) + 1e-9)
    return amp * filtered

def ar_envelope(t, attack, release, duration):
    """Attack-Release envelope."""
    env = np.ones_like(t)
    attack_samples = int(attack * SAMPLE_RATE)
    release_samples = int(release * SAMPLE_RATE)
    total = len(t)
    env[:attack_samples] = np.linspace(0, 1, attack_samples)
    env[-release_samples:] = np.linspace(1, 0, release_samples)
    return env

def fade_in_out(t, fade_in=0.5, fade_out=0.5, duration=30):
    """Fade in/out envelope for BGM."""
    env = np.ones_like(t)
    fi = int(fade_in * SAMPLE_RATE)
    fo = int(fade_out * SAMPLE_RATE)
    if fi > 0:
        env[:fi] = np.linspace(0, 1, fi)
    if fo > 0:
        env[-fo:] = np.linspace(1, 0, fo)
    return env

def add_chords(t, base_freq, chord_intervals, amp=0.15, vibrato=2.0):
    """Add chord tones with slight vibrato."""
    sig = np.zeros_like(t)
    for interval in chord_intervals:
        freq = base_freq * interval
        vibrato_sig = 1 + 0.01 * np.sin(2 * np.pi * vibrato * t)
        sig += amp * np.sin(2 * np.pi * freq * t * vibrato_sig)
    return sig

# ====================
# BGM Generators
# ====================

def generate_bgm_menu():
    """
    Menu BGM: Cyberpunk ambient, slow, mysterious, neon vibe.
    Duration: 25s (loopable).
    """
    duration = 25.0
    t = make_time(duration)
    sig = np.zeros_like(t)

    # Deep pad chord (Cm9 feel: C, Eb, G, Bb, D)
    base = 65.41  # C2
    chord = [1.0, 1.189, 1.498, 1.782, 2.0]  # C, Eb, G, Bb, C
    sig += add_chords(t, base, chord, amp=0.12, vibrato=0.3)

    # Higher pad (Cm add9)
    base2 = 130.81  # C3
    chord2 = [1.0, 1.189, 1.498, 1.782]
    sig += add_chords(t, base2, chord2, amp=0.08, vibrato=0.5)

    # Sub bass pulse (slow 1Hz LFO)
    lfo = 0.5 + 0.5 * np.sin(2 * np.pi * 0.5 * t)
    sig += 0.15 * np.sin(2 * np.pi * 32.7 * t) * lfo

    # Atmosphere: lowpass noise
    sig += lowpass_noise(duration, amp=0.06, cutoff=800)

    # Arpeggio-like high notes (sparse)
    arp_times = [3, 7, 11, 15, 19, 23]
    for at in arp_times:
        idx = int(at * SAMPLE_RATE)
        if idx < len(sig) - seconds_to_samples(1.5):
            note = tone(523.25, 1.5, amp=0.04,
                       envelope=lambda tt: np.exp(-3 * tt))
            sig[idx:idx+len(note)] += note

    # Fade in/out for seamless loop
    env = np.ones_like(t)
    fi = int(3.0 * SAMPLE_RATE)
    fo = int(3.0 * SAMPLE_RATE)
    env[:fi] = np.linspace(0, 1, fi)
    env[-fo:] = np.linspace(1, 0, fo)
    sig = sig * env

    return sig


def generate_bgm_investigation():
    """
    Investigation BGM: Tense, mysterious, slightly dark.
    Duration: 20s (loopable).
    """
    duration = 20.0
    t = make_time(duration)
    sig = np.zeros_like(t)

    # Dark drone (D minor feel)
    base = 73.42  # D2
    chord = [1.0, 1.189, 1.498]  # D, F, A
    sig += add_chords(t, base, chord, amp=0.14, vibrato=0.4)

    # Higher tension notes
    base2 = 146.83  # D3
    chord2 = [1.0, 1.189, 1.498, 1.782]
    sig += add_chords(t, base2, chord2, amp=0.06, vibrato=0.7)

    # Pulsing bass (heartbeat-like)
    pulse = np.zeros_like(t)
    for beat in np.arange(0, duration, 1.5):
        idx = int(beat * SAMPLE_RATE)
        if idx < len(pulse) - seconds_to_samples(0.8):
            p = tone(55.0, 0.8, amp=0.2,
                    envelope=lambda tt: np.exp(-5 * tt))
            pulse[idx:idx+len(p)] += p
    sig += pulse

    # Low noise texture
    sig += lowpass_noise(duration, amp=0.05, cutoff=600)

    # Sparse metallic pings
    ping_times = [2, 5, 9, 12, 16]
    for pt in ping_times:
        idx = int(pt * SAMPLE_RATE)
        if idx < len(sig) - seconds_to_samples(0.5):
            p = tone(880, 0.5, amp=0.03,
                    envelope=lambda tt: np.exp(-8 * tt))
            sig[idx:idx+len(p)] += p

    env = fade_in_out(t, 2.0, 2.0, duration)
    sig = sig * env
    return sig


def generate_bgm_interrogation():
    """
    Interrogation BGM: Tense, rhythmic, building pressure.
    Duration: 20s (loopable).
    """
    duration = 20.0
    t = make_time(duration)
    sig = np.zeros_like(t)

    # Dark drone
    base = 55.0  # A1
    chord = [1.0, 1.189, 1.498, 1.782]  # A, C, E, G
    sig += add_chords(t, base, chord, amp=0.12, vibrato=0.6)

    # Rhythmic click (ticking clock feel)
    for beat in np.arange(0, duration, 0.8):
        idx = int(beat * SAMPLE_RATE)
        if idx < len(sig) - seconds_to_samples(0.05):
            click = tone(2000, 0.05, amp=0.08,
                        envelope=lambda tt: np.exp(-50 * tt))
            sig[idx:idx+len(click)] += click

    # Bass pulse (tension building)
    for beat in np.arange(0, duration, 2.0):
        idx = int(beat * SAMPLE_RATE)
        if idx < len(sig) - seconds_to_samples(1.0):
            p = tone(41.2, 1.0, amp=0.18,
                    envelope=lambda tt: np.exp(-3 * tt))
            sig[idx:idx+len(p)] += p

    # Tension high tones (dissonant)
    dissonant_times = [4, 8, 12, 16]
    for dt in dissonant_times:
        idx = int(dt * SAMPLE_RATE)
        if idx < len(sig) - seconds_to_samples(2.0):
            d1 = tone(440, 2.0, amp=0.04,
                     envelope=lambda tt: np.exp(-2 * tt))
            d2 = tone(466.16, 2.0, amp=0.04,
                     envelope=lambda tt: np.exp(-2 * tt))
            sig[idx:idx+len(d1)] += d1 + d2

    env = fade_in_out(t, 2.0, 2.0, duration)
    sig = sig * env
    return sig


def generate_bgm_ending():
    """
    Ending BGM: Somber, conclusive, reflective.
    Duration: 15s (one-shot, not looped).
    """
    duration = 15.0
    t = make_time(duration)
    sig = np.zeros_like(t)

    # Slow descending chord (Am -> F -> C -> E)
    chords = [
        (0.0, 110.0, [1.0, 1.189, 1.498]),   # Am (A2)
        (3.5, 87.31, [1.0, 1.189, 1.498]),   # F (F2)
        (7.0, 130.81, [1.0, 1.189, 1.498]),  # C (C3)
        (10.5, 82.41, [1.0, 1.259, 1.498]),  # E (E2)
    ]

    for start, base, intervals in chords:
        idx = int(start * SAMPLE_RATE)
        note_dur = 4.0
        nt = make_time(note_dur)
        chord_sig = add_chords(nt, base, intervals, amp=0.15, vibrato=0.2)
        env = np.exp(-0.5 * nt)
        chord_sig = chord_sig * env
        if idx + len(chord_sig) <= len(sig):
            sig[idx:idx+len(chord_sig)] += chord_sig

    # Sub bass
    sig += 0.1 * np.sin(2 * np.pi * 55.0 * t) * np.exp(-0.1 * t)

    # Fade out
    env = np.ones_like(t)
    fo = int(5.0 * SAMPLE_RATE)
    env[-fo:] = np.linspace(1, 0, fo)
    sig = sig * env
    return sig


# ====================
# SFX Generators
# ====================

def generate_sfx_click():
    """Short UI click sound."""
    duration = 0.15
    t = make_time(duration)
    sig = tone(1200, duration, amp=0.4,
              envelope=lambda tt: np.exp(-30 * tt))
    sig += tone(800, duration, amp=0.2,
               envelope=lambda tt: np.exp(-40 * tt))
    return sig


def generate_sfx_evidence():
    """Magical 'obtain' chime."""
    duration = 1.5
    t = make_time(duration)
    sig = np.zeros_like(t)

    # Ascending chime
    notes = [(0.0, 523.25, 0.3), (0.15, 659.25, 0.25), (0.3, 783.99, 0.2)]
    for start, freq, amp in notes:
        idx = int(start * SAMPLE_RATE)
        note_dur = 1.0
        nt = make_time(note_dur)
        n = tone(freq, note_dur, amp=amp,
                envelope=lambda tt: np.exp(-4 * tt))
        if idx + len(n) <= len(sig):
            sig[idx:idx+len(n)] += n

    # Shimmer
    sig += lowpass_noise(duration, amp=0.03, cutoff=2000) * np.exp(-3 * t)
    return sig


def generate_sfx_combine():
    """Evidence combine - mechanical/mental synthesis sound."""
    duration = 1.2
    t = make_time(duration)
    sig = np.zeros_like(t)

    # Mechanical click sequence
    for i, beat in enumerate(np.arange(0, 0.6, 0.15)):
        idx = int(beat * SAMPLE_RATE)
        if idx < len(sig) - seconds_to_samples(0.1):
            c = tone(600 + i*100, 0.1, amp=0.2,
                    envelope=lambda tt: np.exp(-30 * tt))
            sig[idx:idx+len(c)] += c

    # Final "connection" chord
    idx = int(0.6 * SAMPLE_RATE)
    chord_notes = [440, 554.37, 659.25]
    for freq in chord_notes:
        n = tone(freq, 0.6, amp=0.15,
                envelope=lambda tt: np.exp(-5 * tt))
        if idx + len(n) <= len(sig):
            sig[idx:idx+len(n)] += n

    return sig


def generate_sfx_contradiction():
    """Dramatic contradiction discovery sound."""
    duration = 1.5
    t = make_time(duration)
    sig = np.zeros_like(t)

    # Impact
    idx = 0
    impact = tone(150, 0.3, amp=0.4,
                envelope=lambda tt: np.exp(-10 * tt))
    sig[idx:idx+len(impact)] += impact

    # Dissonant screech
    idx = int(0.2 * SAMPLE_RATE)
    screech = tone(800, 0.8, amp=0.2,
                  envelope=lambda tt: np.exp(-4 * tt))
    screech += tone(850, 0.8, amp=0.2,
                    envelope=lambda tt: np.exp(-4 * tt))
    if idx + len(screech) <= len(sig):
        sig[idx:idx+len(screech)] += screech

    # Reverb-ish noise burst
    sig += lowpass_noise(duration, amp=0.06, cutoff=2000) * np.exp(-4 * t)
    return sig


def generate_sfx_stress():
    """Stress rising - warning/heartbeat sound."""
    duration = 1.0
    t = make_time(duration)
    sig = np.zeros_like(t)

    # Rapid heartbeat
    for beat in np.arange(0, duration, 0.25):
        idx = int(beat * SAMPLE_RATE)
        if idx < len(sig) - seconds_to_samples(0.15):
            p = tone(80, 0.15, amp=0.3,
                    envelope=lambda tt: np.exp(-15 * tt))
            sig[idx:idx+len(p)] += p

    # Rising tension tone
    idx = int(0.3 * SAMPLE_RATE)
    rising = np.zeros(seconds_to_samples(0.7))
    rt = np.linspace(0, 0.7, len(rising))
    freq = 200 + 400 * rt
    rising = 0.15 * np.sin(2 * np.pi * np.cumsum(freq) / SAMPLE_RATE)
    rising = rising * np.exp(-2 * rt)
    if idx + len(rising) <= len(sig):
        sig[idx:idx+len(rising)] += rising

    return sig


# ====================
# Main
# ====================

def main():
    ensure_dir()
    np.random.seed(42)  # Reproducible

    print("=" * 50)
    print("Cyberpunk Detective Audio Generator")
    print("=" * 50)

    # BGM
    print("\n[BGM] Generating...")
    save_wav("bgm_menu.wav", generate_bgm_menu())
    save_wav("bgm_investigation.wav", generate_bgm_investigation())
    save_wav("bgm_interrogation.wav", generate_bgm_interrogation())
    save_wav("bgm_ending.wav", generate_bgm_ending())

    # SFX
    print("\n[SFX] Generating...")
    save_wav("sfx_click.wav", generate_sfx_click())
    save_wav("sfx_evidence.wav", generate_sfx_evidence())
    save_wav("sfx_combine.wav", generate_sfx_combine())
    save_wav("sfx_contradiction.wav", generate_sfx_contradiction())
    save_wav("sfx_stress.wav", generate_sfx_stress())

    print("\n" + "=" * 50)
    print("All audio generated successfully!")
    print(f"Output: {OUTPUT_DIR}")
    print("=" * 50)

    # List generated files
    for f in sorted(os.listdir(OUTPUT_DIR)):
        fp = os.path.join(OUTPUT_DIR, f)
        size = os.path.getsize(fp)
        print(f"  {f} ({size:,} bytes)")


if __name__ == "__main__":
    main()
