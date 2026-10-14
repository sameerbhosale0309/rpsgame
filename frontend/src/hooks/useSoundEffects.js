import { useRef, useCallback } from 'react';

/**
 * Custom hook providing authentic 1980s Cassette Futurism & Relay Audio via Web Audio API
 */
export function useSoundEffects() {
  const audioCtxRef = useRef(null);

  const getAudioContext = useCallback(() => {
    if (!audioCtxRef.current) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      audioCtxRef.current = new AudioContext();
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  }, []);

  // Mechanical relay click / microswitch snap for physical buttons
  const playMechanicalClick = useCallback(() => {
    try {
      const ctx = getAudioContext();
      // Micro click burst
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(120, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 0.04);

      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.04);
    } catch (e) {
      console.warn('Audio click error:', e);
    }
  }, [getAudioContext]);

  // Vintage 8-bit / IBM terminal countdown tick (Square wave pulse)
  const playTick = useCallback((pitch = 520) => {
    try {
      const ctx = getAudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(pitch, ctx.currentTime);

      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.09);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.09);
    } catch (e) {
      console.warn('Audio tick error:', e);
    }
  }, [getAudioContext]);

  // 1980s Arcade Laser / Tape Stop Impact (SHOOT!)
  const playShoot = useCallback(() => {
    try {
      const ctx = getAudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(1400, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(110, ctx.currentTime + 0.28);

      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.28);
    } catch (e) {
      console.warn('Audio shoot error:', e);
    }
  }, [getAudioContext]);

  // Warm vintage analog synth victory fanfare (Classic 80s arcade triad)
  const playWin = useCallback(() => {
    try {
      const ctx = getAudioContext();
      const chords = [
        [261.63, 329.63, 392.00], // C4 major
        [329.63, 392.00, 523.25], // E4 inv
        [392.00, 523.25, 659.25], // G4 inv
        [523.25, 659.25, 783.99, 1046.50] // C5 triumph
      ];

      chords.forEach((frequencies, chordIdx) => {
        const time = ctx.currentTime + chordIdx * 0.12;
        frequencies.forEach((freq) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();

          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(freq, time);

          gain.gain.setValueAtTime(0.08, time);
          gain.gain.exponentialRampToValueAtTime(0.001, time + 0.3);

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.start(time);
          osc.stop(time + 0.3);
        });
      });
    } catch (e) {
      console.warn('Audio win error:', e);
    }
  }, [getAudioContext]);

  // CRT Degauss / 8-bit Defeat Buzz
  const playLose = useCallback(() => {
    try {
      const ctx = getAudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(75, ctx.currentTime + 0.45);

      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.45);
    } catch (e) {
      console.warn('Audio lose error:', e);
    }
  }, [getAudioContext]);

  // Analog Tape Chirp (Draw)
  const playDraw = useCallback(() => {
    try {
      const ctx = getAudioContext();
      [350, 440].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const time = ctx.currentTime + idx * 0.1;

        osc.type = 'square';
        osc.frequency.setValueAtTime(freq, time);

        gain.gain.setValueAtTime(0.1, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.08);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(time);
        osc.stop(time + 0.08);
      });
    } catch (e) {
      console.warn('Audio draw error:', e);
    }
  }, [getAudioContext]);

  return { playMechanicalClick, playTick, playShoot, playWin, playLose, playDraw };
}
