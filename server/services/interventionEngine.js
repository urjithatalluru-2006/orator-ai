import { INTERVENTION_CONFIG } from '../config/models.js';

/**
 * Intervention Policy Engine
 * Evaluates real-time candidate signals against the Flow > Perfection principle.
 * 
 * Math Formula:
 * Net Benefit = (Severity * Confidence * Contextual Impact) - Interruption Cost
 * Intervene ONLY when Net Benefit > INTERVENTION_CONFIG.THRESHOLD
 */
export function evaluateIntervention({
  transcriptChunk = '',
  wpm = 140,
  silenceSec = 0,
  fillerCount = 0,
  storyMomentum = 'normal', // 'high', 'normal', 'stalled'
  gazeRatio = 0.8,
  postureDelta = 0.1,
  mode = 'free_talk'
}) {
  let severity = 0;
  let confidence = 0.9;
  let impact = 0.5;
  let interruptionCost = 0.5; // Base cost of interrupting flow
  let candidateCue = null;
  let category = 'general';

  // Elevate interruption cost if user is in high narrative flow
  if (storyMomentum === 'high') {
    interruptionCost = 0.85; // Protect flow aggressively
  }

  // 1. Evaluate Speech Speed (WPM)
  if (wpm > INTERVENTION_CONFIG.MAX_SPEED_WPM) {
    severity = Math.min(1.0, (wpm - INTERVENTION_CONFIG.MAX_SPEED_WPM) / 40);
    impact = 0.8;
    candidateCue = 'Slow down.';
    category = 'pacing';
  }

  // 2. Evaluate Prolonged Silence / Hesitation under Pressure
  else if (silenceSec >= INTERVENTION_CONFIG.SILENCE_THRESHOLD_SEC) {
    severity = Math.min(1.0, silenceSec / 6.0);
    impact = 0.75;
    
    if (mode === 'story_lab' || storyMomentum === 'stalled') {
      candidateCue = "What's the tension?";
    } else if (mode === 'public_speaking') {
      candidateCue = 'Take a pause.';
    } else {
      candidateCue = 'Land the point.';
    }
    category = 'flow';
  }

  // 3. Evaluate Excessive Filler Word Spikes (e.g. >3 fillers in short window)
  else if (fillerCount >= 4 && storyMomentum !== 'high') {
    severity = 0.65;
    impact = 0.6;
    candidateCue = 'Pause instead of filler.';
    category = 'clarity';
  }

  // 4. Evaluate Visual Gaze Off-Screen for Extended Period
  else if (gazeRatio < 0.3) {
    severity = 0.6;
    impact = 0.7;
    candidateCue = 'Bring them back.';
    category = 'visual';
  }

  // Calculate Net Benefit
  const netBenefit = (severity * confidence * impact) - interruptionCost;

  if (candidateCue && netBenefit > INTERVENTION_CONFIG.THRESHOLD) {
    // Truncate cue to max 4 words strictly
    const cueWords = candidateCue.trim().split(/\s+/).slice(0, INTERVENTION_CONFIG.MAX_CUE_WORDS).join(' ');
    return {
      shouldIntervene: true,
      cue: cueWords,
      category,
      netBenefit: parseFloat(netBenefit.toFixed(2)),
      timestamp: Date.now()
    };
  }

  return {
    shouldIntervene: false,
    cue: null,
    netBenefit: parseFloat(netBenefit.toFixed(2))
  };
}
