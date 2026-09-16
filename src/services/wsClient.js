/**
 * WebSocket Client Service for ORATOR AI
 * 
 * PRODUCTION ARCHITECTURE:
 * 1. Obtains short-lived ephemeral token from /api/live-token (Netlify Function / Express).
 * 2. Connects directly from the browser to Google's Gemini Live BidiGenerateContentConstrained WebSocket.
 * 3. The permanent GEMINI_API_KEY is NEVER exposed to the browser.
 * 4. Bidirectional conversational streaming with Gemini Live audio/text.
 * 5. Integrated local flow-preserving intervention policy engine for 0ms HUD coaching cues.
 * 6. Automatic reconnection and session recovery on network blips or token refresh.
 */

// Flow > Perfection Intervention Configuration
const INTERVENTION_CONFIG = {
  THRESHOLD: 0.50,
  MAX_SPEED_WPM: 195,
  SILENCE_THRESHOLD_SEC: 4.0,
  MAX_CUE_WORDS: 4
};

export class LiveCoachingWSClient {
  constructor(onMessageCallback, onErrorCallback) {
    this.ws = null;
    this.onMessage = onMessageCallback;
    this.onError = onErrorCallback;
    this.isConnected = false;
    this.isGeminiLiveDirect = false;
    this.setupCompleted = false;

    // Session State
    this.mode = 'free_talk';
    this.persona = 'Skeptical Investor';
    this.model = 'models/gemini-2.5-flash-native-audio-latest';
    this.ephemeralToken = null;
    this.wsEndpoint = null;

    // Reconnection & Heartbeat
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectTimer = null;
    this.isExplicitlyClosed = false;

    // Live Metrics Cache for Intervention Engine
    this.currentMetrics = {
      wpm: 0,
      silenceSec: 0,
      fillerCount: 0,
      storyMomentum: 'normal',
      gazeRatio: 0.85,
      postureDelta: 0
    };

    // Rate Limiting Interventions (At least 8 seconds between HUD toasts)
    this.lastInterventionTime = 0;
  }

  /**
   * Initializes session parameters before connection
   */
  initSession(mode = 'free_talk', persona = 'Skeptical Investor') {
    this.mode = mode;
    this.persona = persona;

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      if (this.isGeminiLiveDirect) {
        this.sendGeminiSetup();
      } else {
        this.send({
          type: 'INIT_SESSION',
          mode: this.mode,
          roleplayPersona: this.persona
        });
      }
    }
  }

  /**
   * Main connection flow: obtains ephemeral token then connects
   */
  async connect() {
    this.isExplicitlyClosed = false;
    try {
      // 1. Request ephemeral token from secure server-side Netlify Function / API
      const tokenRes = await fetch('/api/live-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!tokenRes.ok) {
        throw new Error(`Token service responded with status ${tokenRes.status}`);
      }

      const tokenData = await tokenRes.json();

      if (tokenData && tokenData.liveAvailable && tokenData.ephemeralToken && tokenData.wsEndpoint) {
        // PRODUCTION: Connect directly to Google Gemini Live API with ephemeral token
        this.ephemeralToken = tokenData.ephemeralToken;
        this.wsEndpoint = tokenData.wsEndpoint;
        this.model = tokenData.model || 'models/gemini-2.5-flash-native-audio-latest';

        const directUrl = `${this.wsEndpoint}?access_token=${encodeURIComponent(this.ephemeralToken)}`;
        this.connectToGeminiLive(directUrl);
      } else {
        // LOCAL DEV FALLBACK: Connect to local Express WebSocket proxy
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        const proxyUrl = `${protocol}//${host}/api/live-stream`;
        this.connectToProxy(proxyUrl);
      }
    } catch (err) {
      console.warn('Live WebSocket token resolution failed, attempting proxy fallback:', err.message);
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const proxyUrl = `${protocol}//${host}/api/live-stream`;
      this.connectToProxy(proxyUrl);
    }
  }

  /**
   * Connect directly to Google Gemini Live BidiGenerateContentConstrained
   */
  connectToGeminiLive(wsUrl) {
    try {
      this.ws = new WebSocket(wsUrl);
      this.isGeminiLiveDirect = true;

      this.ws.onopen = () => {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        console.log('✅ Connected to Gemini Live API directly via Ephemeral Token');
        this.sendGeminiSetup();
      };

      this.ws.onmessage = (event) => {
        this.handleGeminiLiveMessage(event.data);
      };

      this.ws.onerror = (err) => {
        console.warn('Gemini Live WebSocket notice:', err);
        if (this.onError) this.onError(err);
      };

      this.ws.onclose = (event) => {
        this.isConnected = false;
        this.setupCompleted = false;
        console.log(`Gemini Live WS closed (code: ${event.code})`);
        this.handleAutoReconnect();
      };
    } catch (err) {
      console.error('Failed to initialize Gemini Live WebSocket:', err);
      if (this.onError) this.onError(err);
    }
  }

  /**
   * Send initial Gemini Live setup frame
   */
  sendGeminiSetup() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const personaInstructions = {
      'Skeptical Investor': 'You are an aggressive venture capital partner evaluating a live startup pitch. Challenge unit economics, interrupt vague storytelling, and demand concrete numbers.',
      'Hostile Audience': 'You are an adversarial conference attendee. Express skepticism, challenge claims, and ask difficult probing counter-questions.',
      'Executive': 'You are a busy C-suite executive with only 2 minutes. Demand immediate bottom-line clarity and interrupt long preamble.',
      'Interviewer': 'You are an executive hiring interviewer testing leadership and communication clarity. Ask sharp behavioral questions.'
    };

    const systemPrompt = `
You are ORATOR.AI, a world-class real-time human communication, storytelling, and speech coach.
Current Mode: ${this.mode}.
Roleplay Persona: ${personaInstructions[this.persona] || personaInstructions['Skeptical Investor']}

ROLEPLAY RULES:
- When the speaker talks to you, respond realistically and concisely as this persona.
- Keep responses to 1-2 punchy sentences to maintain natural conversation tempo.
- Never lecture on grammar. Focus on delivery, hook, clarity, and persuasive impact.
`;

    const setupMsg = {
      setup: {
        model: this.model,
        generationConfig: {
          responseModalities: ['TEXT']
        },
        systemInstruction: {
          parts: [{ text: systemPrompt }]
        }
      }
    };

    this.ws.send(JSON.stringify(setupMsg));
  }

  /**
   * Process raw message from Gemini Live WebSocket
   */
  handleGeminiLiveMessage(raw) {
    try {
      const msg = typeof raw === 'string' ? JSON.parse(raw) : JSON.parse(new TextDecoder().decode(raw));

      if (msg.setupComplete) {
        this.setupCompleted = true;
        console.log('✅ Gemini Live setupComplete received. Ready for streaming.');
        return;
      }

      if (msg.serverContent) {
        const parts = msg.serverContent.modelTurn?.parts || [];
        let combinedText = '';

        for (const part of parts) {
          if (part.text) combinedText += part.text;
        }

        if (combinedText.trim() && this.onMessage) {
          this.onMessage({
            type: 'ROLEPLAY_RESPONSE',
            persona: this.persona,
            response: combinedText.trim(),
            timestamp: Date.now()
          });
        }
      }
    } catch (err) {
      console.warn('Error parsing Gemini Live message:', err.message);
    }
  }

  /**
   * Fallback connection to local Express WebSocket proxy (dev mode)
   */
  connectToProxy(wsUrl) {
    try {
      this.ws = new WebSocket(wsUrl);
      this.isGeminiLiveDirect = false;

      this.ws.onopen = () => {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        console.log('Connected to local ORATOR AI WebSocket proxy');
        this.initSession(this.mode, this.persona);
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (this.onMessage) this.onMessage(data);
        } catch (e) {}
      };

      this.ws.onerror = (err) => {
        console.warn('Proxy WebSocket notice:', err);
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        this.handleAutoReconnect();
      };
    } catch (e) {
      console.warn('Proxy connection error:', e.message);
    }
  }

  /**
   * Automatic Reconnection with Exponential Backoff & Token Refresh
   */
  handleAutoReconnect() {
    if (this.isExplicitlyClosed) return;

    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(10000, 1000 * Math.pow(1.5, this.reconnectAttempts));
      console.log(`Live connection interrupted. Reconnecting in ${Math.round(delay / 1000)}s (Attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);

      if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
      this.reconnectTimer = setTimeout(() => {
        this.connect();
      }, delay);
    }
  }

  /**
   * Send speech chunk + evaluate zero-latency local Flow > Perfection coaching cues
   */
  sendSpeechChunk({ transcript, wpm, silenceSec, fillersInChunk, storyMomentum }) {
    // Update cached metrics
    this.currentMetrics.wpm = wpm || this.currentMetrics.wpm;
    this.currentMetrics.silenceSec = silenceSec || 0;
    this.currentMetrics.fillerCount += fillersInChunk || 0;
    this.currentMetrics.storyMomentum = storyMomentum || this.currentMetrics.storyMomentum;

    // 1. Evaluate Zero-Latency Flow Coaching Intervention Cues locally
    this.evaluateLocalIntervention(transcript);

    // 2. If connected to local proxy, forward chunk
    if (!this.isGeminiLiveDirect && this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.send({
        type: 'SPEECH_CHUNK',
        transcript,
        wpm,
        silenceSec,
        fillersInChunk,
        storyMomentum
      });
    }
  }

  /**
   * Evaluates real-time candidate signals against Flow > Perfection
   * Net Benefit = (Severity * Confidence * Impact) - Interruption Cost
   */
  evaluateLocalIntervention(transcriptChunk) {
    const now = Date.now();
    // Throttle HUD coaching cues to prevent over-interruption (min 8s apart)
    if (now - this.lastInterventionTime < 8000) return;

    const { wpm, silenceSec, fillerCount, storyMomentum, gazeRatio } = this.currentMetrics;
    let severity = 0;
    let confidence = 0.9;
    let impact = 0.5;
    let interruptionCost = 0.5;
    let candidateCue = null;
    let category = 'general';

    // Protect narrative flow aggressively
    if (storyMomentum === 'high') {
      interruptionCost = 0.85;
    }

    // 1. Pacing intervention (speaking too fast under pressure)
    if (wpm > INTERVENTION_CONFIG.MAX_SPEED_WPM) {
      severity = Math.min(1.0, (wpm - INTERVENTION_CONFIG.MAX_SPEED_WPM) / 40);
      impact = 0.8;
      candidateCue = 'Slow down.';
      category = 'pacing';
    }
    // 2. Prolonged silence / hesitation
    else if (silenceSec >= INTERVENTION_CONFIG.SILENCE_THRESHOLD_SEC) {
      severity = Math.min(1.0, silenceSec / 6.0);
      impact = 0.75;
      if (this.mode === 'story_lab') candidateCue = "What's the tension?";
      else if (this.mode === 'public_speaking') candidateCue = 'Take a pause.';
      else candidateCue = 'Land the point.';
      category = 'flow';
    }
    // 3. Filler word burst
    else if (fillerCount >= 4 && storyMomentum !== 'high') {
      severity = 0.65;
      impact = 0.6;
      candidateCue = 'Pause instead of filler.';
      category = 'clarity';
    }
    // 4. Lost eye contact / off-screen gaze
    else if (gazeRatio < 0.35) {
      severity = 0.6;
      impact = 0.7;
      candidateCue = 'Bring them back.';
      category = 'visual';
    }

    const netBenefit = (severity * confidence * impact) - interruptionCost;

    if (candidateCue && netBenefit > INTERVENTION_CONFIG.THRESHOLD) {
      this.lastInterventionTime = now;
      if (this.onMessage) {
        this.onMessage({
          type: 'LIVE_CUE',
          cue: candidateCue,
          category,
          netBenefit: parseFloat(netBenefit.toFixed(2)),
          timestamp: now
        });
      }
    }
  }

  /**
   * Send visual CV metrics (gaze, posture)
   */
  sendVisualMetrics({ gazeRatio, postureDelta }) {
    if (gazeRatio !== undefined) this.currentMetrics.gazeRatio = gazeRatio;
    if (postureDelta !== undefined) this.currentMetrics.postureDelta = postureDelta;

    if (!this.isGeminiLiveDirect && this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.send({
        type: 'VISUAL_METRICS_UPDATE',
        gazeRatio,
        postureDelta
      });
    }
  }

  /**
   * Send roleplay prompt to Gemini Live (or local fallback)
   */
  sendRoleplayPrompt(userUtterance, persona) {
    if (this.isGeminiLiveDirect && this.ws && this.ws.readyState === WebSocket.OPEN) {
      // Send user turn to Gemini Live WebSocket
      const clientContentMsg = {
        clientContent: {
          turns: [
            {
              role: 'user',
              parts: [{ text: userUtterance }]
            }
          ],
          turnComplete: true
        }
      };
      this.ws.send(JSON.stringify(clientContentMsg));
    } else if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      // Send to local proxy
      this.send({
        type: 'ROLEPLAY_PROMPT',
        userUtterance,
        persona: persona || this.persona
      });
    }
  }

  /**
   * Low-level send helper
   */
  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  /**
   * Disconnect safely and prevent auto-reconnect
   */
  disconnect() {
    this.isExplicitlyClosed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);

    if (this.ws) {
      try { this.ws.close(); } catch (e) {}
      this.ws = null;
      this.isConnected = false;
      this.setupCompleted = false;
    }
  }
}
