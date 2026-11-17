/**
 * Retours sonores synthétisés (Web Audio, aucun fichier : fonctionne hors ligne).
 * Ils sont joués APRÈS la réponse (ou avant la série) : ils n'interviennent pas dans la mesure.
 * Sur iPad, le contexte audio doit être créé lors d'un geste de l'utilisateur.
 */
import { CONFIG } from '../config';

type Note = [frequencyHz: number, durationMs: number, delayMs?: number];

export class Sounds {
  private ctx: AudioContext | null = null;

  constructor(public enabled: boolean = CONFIG.feedback.sound) {
    try {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      this.ctx = Ctor ? new Ctor() : null;
      void this.ctx?.resume();
    } catch {
      this.ctx = null;
    }
  }

  /** Bip du compte à rebours (3, 2, 1). */
  tick(): void {
    this.play([[660, 120]], 'sine');
  }

  /** « GO ». */
  go(): void {
    this.play([[990, 320]], 'sine');
  }

  /** Réussite : deux notes montantes. */
  success(): void {
    this.play([[784, 90], [1175, 140, 90]], 'triangle');
  }

  /** Erreur : note grave. */
  error(): void {
    this.play([[196, 260]], 'square', 0.12);
  }

  close(): void {
    void this.ctx?.close();
    this.ctx = null;
  }

  private play(notes: Note[], type: OscillatorType, volume = 0.25): void {
    const ctx = this.ctx;
    if (!this.enabled || !ctx) return;
    if (ctx.state === 'suspended') void ctx.resume();
    const t0 = ctx.currentTime + 0.005;
    for (const [freq, dur, delay = 0] of notes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = t0 + delay / 1000;
      const end = start + dur / 1000;
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(volume, start + 0.01);
      gain.gain.setValueAtTime(volume, end - 0.03);
      gain.gain.linearRampToValueAtTime(0, end);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(end + 0.02);
    }
  }
}
