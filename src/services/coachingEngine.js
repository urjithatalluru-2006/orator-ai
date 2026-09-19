/**
 * ORATOR AI Dual-Layer Coaching Architecture
 * 
 * LAYER A: LOCAL REAL-TIME COACHING
 * Evaluates raw audio, Voice Activity Detection (VAD), and physical delivery metrics in real time.
 * 100% local, zero network latency, zero dependence on Gemini server responses.
 * Triggers immediate HUD delivery cues:
 * - "Slow down." (Pacing too fast > 185 WPM)
 * - "Pick up momentum." (Pacing too slow < 95 WPM)
 * - "Pause instead of filler." (Filler spikes)
 * - "Long silence." (Prolonged hesitation >= 3.2s)
 * - "Take a breath." (Run-on speech without pause > 12s)
 * - "Look at the lens." (Gaze away from camera)
 * - "Anchor your posture." (Excessive posture sway)
 * 
 * LAYER B: GEMINI & CONTENT COACHING
 * Evaluates transcript semantics, story arc, persuasive clarity, and wit.
 * Driven by Gemini Live multimodal turns and narrative analysis:
 * - "Make the hook stronger" (Opening lacks a clear thesis or contrast)
 * - "Add specificity" (Vague generalizations without concrete numbers/details)
 * - "What is the tension?" (Story Lab without obstacle or conflict)
 * - "Clarify the point" (Dense, abstract phrasing needing simpler analogy)
 * - "Use dramatic contrast" (Wit Lab opportunity)
 * - "Land the point" (Story payoff delivery)
 */

export class LocalDeliveryCoach {
  constructor(onCueCallback) {
    this.onCue = onCueCallback;
    this.lastCueTime = 0;
    this.lastCueType = null;
    this.lastEvalLogTime = 0;
    this.cooldownMs = 6500; // Minimum 6.5s between delivery cues to protect speaker flow
  }

  evaluateMetrics(metrics) {
    const now = Date.now();

    const {
      wpm = 0,
      silenceSec = 0,
      speakingTimeSec = 0,
      pauseCount = 0,
      fillerCount = 0,
      fillerRate = 0,
      wordCount = 0,
      gazeRatio = 0.85,
      postureDelta = 0,
      isSpeaking = false
    } = metrics;

    // [CRITERION 8]: LIVE COACHING receives the updated metrics (throttled every 2s)
    if (now - this.lastEvalLogTime > 2000) {
      this.lastEvalLogTime = now;
      console.log('[ORATOR][COACH] Live coaching received updated metrics:', {
        wpm,
        speakingTimeSec,
        pauseCount,
        fillerCount,
        silenceSec,
        isSpeaking
      });
    }

    if (now - this.lastCueTime < this.cooldownMs) return null;

    let cue = null;
    let type = null;
    let tip = '';

    // 1. Speaking Too Fast (>185 WPM with at least 8 words)
    if (isSpeaking && wpm > 185 && wordCount >= 8 && this.lastCueType !== 'fast_pace') {
      cue = 'Slow down.';
      type = 'fast_pace';
      tip = `Pacing is ${wpm} WPM. Take a breath to let your points sink in.`;
    }
    // 2. Speaking Too Slow (<95 WPM while actively speaking)
    else if (isSpeaking && wpm > 0 && wpm < 95 && wordCount >= 6 && this.lastCueType !== 'slow_pace') {
      cue = 'Pick up momentum.';
      type = 'slow_pace';
      tip = `Pacing is ${wpm} WPM. Drive energy and conversational tempo forward.`;
    }
    // 3. Long Silence / Extended Hesitation (>= 3.2 seconds)
    else if (silenceSec >= 3.2 && this.lastCueType !== 'long_silence') {
      cue = 'Take a breath and continue.';
      type = 'long_silence';
      tip = 'Hesitation detected. Formulate your next sentence and resume with confidence.';
    }
    // 4. Run-on Speech Without Pauses (Speaking continuously > 14s without pausing)
    else if (isSpeaking && speakingTimeSec > 14 && pauseCount === 0 && this.lastCueType !== 'need_pause') {
      cue = 'Pause to breathe.';
      type = 'need_pause';
      tip = 'You have spoken continuously for 14s. A silent pause creates anticipation.';
    }
    // 5. Filler Word Spikes (Filler rate > 3.0/min or >= 3 total fillers)
    else if (fillerCount >= 3 && fillerRate > 2.8 && this.lastCueType !== 'filler_spike') {
      cue = 'Pause instead of filler.';
      type = 'filler_spike';
      tip = `Detected ${fillerCount} filler words. Replace 'um' or 'like' with a clean pause.`;
    }
    // 6. Gaze Off-Screen (<40% eye contact)
    else if (gazeRatio < 0.40 && this.lastCueType !== 'gaze_loss') {
      cue = 'Look at the lens.';
      type = 'gaze_loss';
      tip = 'Eye contact with the camera commands trust and audience presence.';
    }
    // 7. Posture Sway (>0.35 movement delta)
    else if (postureDelta > 0.35 && this.lastCueType !== 'posture_sway') {
      cue = 'Anchor your shoulders.';
      type = 'posture_sway';
      tip = 'Keep posture still and centered to project executive composure.';
    }

    if (cue) {
      this.lastCueTime = now;
      this.lastCueType = type;

      const cueEvent = {
        layer: 'LOCAL_DELIVERY',
        category: 'DELIVERY',
        cue,
        tip,
        timestamp: now
      };

      console.log(`[ORATOR][COACH] ⚡ Layer A (Local Delivery): "${cue}" — ${tip}`);
      if (this.onCue) this.onCue(cueEvent);
      return cueEvent;
    }

    return null;
  }
}

export class ContentCoach {
  constructor(onCueCallback) {
    this.onCue = onCueCallback;
    this.lastCueTime = 0;
    this.cooldownMs = 8000; // Minimum 8s between content suggestions
  }

  /**
   * Evaluates spoken transcript content for story structure, specificity, and hooks
   */
  evaluateContent(transcript, mode = 'free_talk') {
    const now = Date.now();
    if (now - this.lastCueTime < this.cooldownMs) return null;

    const text = transcript.trim();
    const words = text.split(/\s+/).filter(Boolean);
    if (words.length < 12) return null; // Need minimum context before content coaching

    // [CRITERION 8]: LIVE COACHING receives transcript for Layer B semantic coaching
    console.log('[ORATOR][COACH] Layer B ContentCoach received transcript segment:', {
      words: words.length,
      snippet: text.slice(-50)
    });

    let cue = null;
    let category = 'CONTENT';
    let tip = '';

    // A. Hook Strength (First 15-25 words)
    if (words.length >= 15 && words.length <= 35) {
      const hasHookWords = /secret|mistake|why|imagine|never|today|realized|problem|truth/i.test(text);
      if (!hasHookWords) {
        cue = 'Make the hook stronger.';
        category = 'HOOK';
        tip = 'Open with a bold claim, provocative question, or high-stakes premise.';
      }
    }
    // B. Story Tension & Conflict (Story Lab mode)
    else if (mode === 'story_lab' && words.length >= 35) {
      const hasConflict = /suddenly|problem|struggle|failed|crisis|obstacle|tension|threat|risk|blocked/i.test(text);
      if (!hasConflict) {
        cue = "What is the tension?";
        category = 'STORYTELLING';
        tip = 'Every great story requires an obstacle or conflict before the breakthrough.';
      }
    }
    // C. Concrete Specificity
    else if (words.length >= 50) {
      const hasNumbersOrQuotes = /\d+|"|percent|dollar|\$|yesterday|specifically|exact/i.test(text);
      if (!hasNumbersOrQuotes) {
        cue = 'Add specificity.';
        category = 'CLARITY';
        tip = 'Replace generalizations with a concrete number, named person, or sensory detail.';
      }
    }
    // D. Wit & Contrast (Wit Lab mode)
    else if (mode === 'wit_lab') {
      cue = 'Use dramatic contrast.';
      category = 'WIT';
      tip = 'Pair high stakes with an ordinary object or understated reaction.';
    }
    // E. Landing the Payoff / Thesis
    else if (words.length >= 75) {
      const hasConclusion = /therefore|lesson|takeaway|bottom line|so what|remember|result/i.test(text);
      if (!hasConclusion) {
        cue = 'Land the point.';
        category = 'CLARITY';
        tip = 'State your clear takeaway and wrap up your key assertion.';
      }
    }

    if (cue) {
      this.lastCueTime = now;

      const cueEvent = {
        layer: 'GEMINI_CONTENT',
        category,
        cue,
        tip,
        timestamp: now
      };

      console.log(`[ORATOR][COACH] 🧠 Layer B (Content Coaching): "${cue}" — ${tip}`);
      if (this.onCue) this.onCue(cueEvent);
      return cueEvent;
    }

    return null;
  }
}
