import { HapticPattern } from "../types";

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
    audioCtx = new AudioCtxClass();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  return audioCtx;
}

/**
 * Triggers physical vibration on supported mobile devices and plays synchronized low-frequency tactile audio clicks for desktop feedback.
 */
export function triggerHapticFeedback(pattern: HapticPattern, intensity = 0.7, durationMs = 150) {
  // 1. Browser Vibration API
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      switch (pattern) {
        case "CONFIRMATION_PULSE":
          navigator.vibrate(Math.min(durationMs, 120));
          break;
        case "ATTENTION_WARNING":
          navigator.vibrate([80, 50, 80, 50, 120]);
          break;
        case "DIRECTIONAL_SWEEP":
          navigator.vibrate([40, 30, 40, 30, 60]);
          break;
        case "HEARTBEAT_RHYTHM":
          navigator.vibrate([70, 100, 110, 300]);
          break;
        default:
          navigator.vibrate(80);
      }
    } catch {
      // Vibration may be restricted by iframe policies
    }
  }

  // 2. Synthesized Sub-bass Tactile Audio feedback
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    let freq = 120;
    if (pattern === "ATTENTION_WARNING") freq = 240;
    else if (pattern === "DIRECTIONAL_SWEEP") freq = 160;
    else if (pattern === "HEARTBEAT_RHYTHM") freq = 65;

    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, ctx.currentTime);

    const now = ctx.currentTime;
    const durSec = Math.max(0.08, durationMs / 1000);

    gain.gain.setValueAtTime(0.01, now);
    gain.gain.exponentialRampToValueAtTime(Math.min(0.3, intensity * 0.25), now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + durSec);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + durSec);
  } catch {
    // Audio context not ready
  }
}
