/**
 * WebSocket Client Service for ORATOR AI
 * 
 * PRODUCTION ARCHITECTURE:
 * 1. Obtains short-lived ephemeral token from /api/live-token (Netlify Function / Express).
 * 2. Connects directly to Google's Gemini Live BidiGenerateContentConstrained WebSocket.
 * 3. Permanent GEMINI_API_KEY is NEVER exposed to the browser.
 * 4. Enables inputAudioTranscription for native audio transcription.
 * 5. Plays Gemini Live 24kHz PCM audio responses directly through Web Audio API.
 * 6. Evaluates real-time Flow > Perfection coaching cues with zero latency.
 * 7. Reconnects automatically with token refresh on disconnection.
 * 8. Diagnostic logging with [ORATOR][LIVE] and [ORATOR][COACH].
 */

export class LiveCoachingWSClient {
  constructor(onMessageCallback, onErrorCallback) {
    this.ws = null;
    this.onMessage = onMessageCallback;
    this.onError = onErrorCallback;
    this.isConnected = false;
    this.isGeminiLiveDirect = false;
    this.setupCompleted = false;

    // Session Parameters
    this.mode = 'free_talk';
    this.persona = 'Skeptical Investor';
    this.model = 'models/gemini-2.5-flash-native-audio-latest';
    this.ephemeralToken = null;
    this.wsEndpoint = null;

    // Audio Playback Context for Gemini 24kHz PCM audio
    this.playbackCtx = null;

    // Reconnection State
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectTimer = null;
    this.isExplicitlyClosed = false;

    // Metrics Cache for Live Coaching Intervention
    this.metrics = {
      wpm: 0,
      silenceSec: 0,
      totalSilenceSec: 0,
      speakingTimeSec: 0,
      pauseCount: 0,
      fillerCount: 0,
      fillerRate: 0,
      wordCount: 0,
      gazeRatio: 0.85,
      postureDelta: 0,
      isSpeaking: false,
      storyMomentum: 'normal'
    };

    // Rate Limiting Interventions (Min 7s between HUD coaching cues)
    this.lastCueTime = 0;
    this.lastCueType = null;
  }

  initSession(mode = 'free_talk', persona = 'Skeptical Investor') {
    this.mode = mode;
    this.persona = persona;
    console.log(`[ORATOR][LIVE] Session initialized: mode=${mode}, persona=${persona}`);

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

  async connect() {
    this.isExplicitlyClosed = false;
    console.log('[ORATOR][LIVE] Requesting ephemeral token from /api/live-token...');

    try {
      const tokenRes = await fetch('/api/live-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!tokenRes.ok) {
        throw new Error(`Token endpoint returned status ${tokenRes.status}`);
      }

      const tokenData = await tokenRes.json();
      console.log('[ORATOR][LIVE] Live token response:', {
        isConfigured: tokenData.isConfigured,
        liveAvailable: tokenData.liveAvailable,
        endpoint: tokenData.wsEndpoint ? 'AVAILABLE' : 'NONE'
      });

      if (tokenData && tokenData.liveAvailable && tokenData.ephemeralToken && tokenData.wsEndpoint) {
        this.ephemeralToken = tokenData.ephemeralToken;
        this.wsEndpoint = tokenData.wsEndpoint;
        this.model = tokenData.model || 'models/gemini-2.5-flash-native-audio-latest';

        const directUrl = `${this.wsEndpoint}?access_token=${encodeURIComponent(this.ephemeralToken)}`;
        console.log('[ORATOR][LIVE] Connecting directly to Gemini Live constrained endpoint...');
        this.connectToGeminiLive(directUrl);
      } else {
        console.log('[ORATOR][LIVE] Ephemeral token unavailable. Client operating in local flow and delivery coaching mode.');
        if (this.onError) {
          this.onError(new Error('Ephemeral token unavailable. Operating in local delivery coaching mode.'));
        }
      }
    } catch (err) {
      console.warn('[ORATOR][LIVE] Token acquisition error. Operating in local delivery coaching mode:', err.message);
      if (this.onError) {
        this.onError(err);
      }
    }
  }

  connectToGeminiLive(wsUrl) {
    try {
      this.ws = new WebSocket(wsUrl);
      this.isGeminiLiveDirect = true;

      this.ws.onopen = () => {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        console.log('[ORATOR][LIVE] ✅ Connected to Gemini Live WSS successfully!');
        this.sendGeminiSetup();
      };

      this.ws.onmessage = (event) => {
        this.handleGeminiLiveMessage(event.data);
      };

      this.ws.onerror = (err) => {
        console.warn('[ORATOR][LIVE] Gemini Live WebSocket error:', err);
        if (this.onError) this.onError(err);
      };

      this.ws.onclose = (event) => {
        this.isConnected = false;
        this.setupCompleted = false;
        console.log(`[ORATOR][LIVE] Gemini Live WebSocket closed (code: ${event.code})`);
        this.handleAutoReconnect();
      };
    } catch (err) {
      console.error('[ORATOR][LIVE] Error connecting to Gemini Live:', err);
      if (this.onError) this.onError(err);
    }
  }

  sendGeminiSetup() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const personaPrompts = {
      'Skeptical Investor': 'You are a skeptical VC partner listening to a speech. Challenge weak assumptions, demand unit economics, and test clarity.',
      'Hostile Audience': 'You are an adversarial audience member. Question claims, raise counterarguments, and demand proof.',
      'Executive': 'You are a busy C-suite executive with limited time. Demand conciseness and immediate bottom-line impact.',
      'Interviewer': 'You are an executive interviewer. Ask sharp behavioral questions to test depth and authentic communication.'
    };

    const systemPrompt = `
You are ORATOR.AI, a live communication, storytelling, and speech coach.
Mode: ${this.mode}.
Persona: ${personaPrompts[this.persona] || personaPrompts['Skeptical Investor']}

Be concise, constructive, and dynamic. In conversation mode, reply in 1-2 sharp conversational sentences.
`;

    const setupMsg = {
      setup: {
        model: this.model,
        generationConfig: {
          responseModalities: ['AUDIO']
        },
        inputAudioTranscription: {},
        systemInstruction: {
          parts: [{ text: systemPrompt }]
        }
      }
    };

    console.log('[ORATOR][LIVE] Sending setup frame to Gemini Live...');
    this.ws.send(JSON.stringify(setupMsg));
  }

  handleGeminiLiveMessage(rawData) {
    try {
      const msg = typeof rawData === 'string' ? JSON.parse(rawData) : JSON.parse(new TextDecoder().decode(rawData));

      // 1. Setup Complete
      if (msg.setupComplete) {
        this.setupCompleted = true;
        console.log('[ORATOR][LIVE] ✅ Gemini Live setupComplete received. Session active.');
        return;
      }

      // 2. Input Audio Transcription (Committed / Interim from Gemini)
      if (msg.serverContent?.inputTranscription) {
        const text = msg.serverContent.inputTranscription.text;
        console.log('[ORATOR][LIVE] Gemini inputTranscription (committed):', text);
        if (this.onMessage && text) {
          this.onMessage({
            type: 'LIVE_TRANSCRIPT',
            text: text.trim(),
            isFinal: true
          });
        }
      }

      if (msg.serverContent?.interimInputTranscription) {
        const text = msg.serverContent.interimInputTranscription.text;
        if (this.onMessage && text) {
          this.onMessage({
            type: 'LIVE_TRANSCRIPT',
            text: text.trim(),
            isFinal: false
          });
        }
      }

      // 3. Model Audio / Turn Responses
      if (msg.serverContent?.modelTurn?.parts) {
        const parts = msg.serverContent.modelTurn.parts;
        for (const part of parts) {
          // If Gemini streams 24kHz PCM audio back
          if (part.inlineData && part.inlineData.data) {
            this.playPcmAudio(part.inlineData.data, part.inlineData.mimeType);
          }
          // If text is provided
          if (part.text && this.onMessage) {
            this.onMessage({
              type: 'ROLEPLAY_RESPONSE',
              persona: this.persona,
              response: part.text.trim(),
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            });
          }
        }
      }
    } catch (err) {
      console.warn('[ORATOR][LIVE] Error parsing message:', err.message);
    }
  }

  /**
   * Plays base64 PCM audio from Gemini Live response
   */
  playPcmAudio(base64Audio, mimeType) {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!this.playbackCtx) {
        this.playbackCtx = new AudioCtx({ sampleRate: 24000 });
      }
      if (this.playbackCtx.state === 'suspended') {
        this.playbackCtx.resume();
      }

      const binary = atob(base64Audio);
      const len = binary.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binary.charCodeAt(i);
      }

      // Convert 16-bit signed PCM to Float32
      const int16Array = new Int16Array(bytes.buffer);
      const float32Array = new Float32Array(int16Array.length);
      for (let i = 0; i < int16Array.length; i++) {
        float32Array[i] = int16Array[i] / 32768;
      }

      const audioBuffer = this.playbackCtx.createBuffer(1, float32Array.length, 24000);
      audioBuffer.copyToChannel(float32Array, 0);

      const source = this.playbackCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.playbackCtx.destination);
      source.start();
    } catch (e) {
      console.warn('[ORATOR][LIVE] Error playing PCM audio:', e.message);
    }
  }

  connectToProxy(wsUrl) {
    try {
      this.ws = new WebSocket(wsUrl);
      this.isGeminiLiveDirect = false;

      this.ws.onopen = () => {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        console.log('[ORATOR][LIVE] Connected to local proxy WebSocket.');
        this.initSession(this.mode, this.persona);
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (this.onMessage) this.onMessage(data);
        } catch (e) {}
      };

      this.ws.onerror = (err) => {
        console.warn('[ORATOR][LIVE] Proxy WebSocket notice:', err);
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        this.handleAutoReconnect();
      };
    } catch (e) {
      console.warn('[ORATOR][LIVE] Proxy connection error:', e.message);
    }
  }

  handleAutoReconnect() {
    if (this.isExplicitlyClosed) return;

    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(8000, 1000 * Math.pow(1.5, this.reconnectAttempts));
      console.log(`[ORATOR][LIVE] Connection dropped. Auto-reconnecting in ${Math.round(delay / 1000)}s (Attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);

      if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
      this.reconnectTimer = setTimeout(() => {
        this.connect();
      }, delay);
    }
  }

  /**
   * Evaluates live metrics on every tick and emits coaching cues when warranted
   */
  updateMetrics(metrics) {
    this.metrics = { ...this.metrics, ...metrics };
    this.evaluateInterventions();
  }

  /**
   * Flow > Perfection Intervention Engine:
   * Actionable real-time guidance that protects speaking flow while correcting flaws
   */
  evaluateInterventions() {
    const now = Date.now();
    // Cooldown: at least 7 seconds between coaching cues
    if (now - this.lastCueTime < 7000) return;

    const { 
      wpm, 
      silenceSec, 
      fillerCount, 
      fillerRate, 
      gazeRatio, 
      postureDelta, 
      isSpeaking, 
      wordCount 
    } = this.metrics;

    let cue = null;
    let category = 'general';
    let tip = '';

    // 1. Pacing Too Fast (>185 WPM with at least 10 words captured)
    if (isSpeaking && wpm > 185 && wordCount >= 10 && this.lastCueType !== 'pacing_fast') {
      cue = 'Slow down.';
      category = 'PACING';
      tip = `Pacing is ${wpm} WPM. Take a breath to let your key points land.`;
      this.lastCueType = 'pacing_fast';
    }
    // 2. Pacing Too Slow (<95 WPM while actively speaking)
    else if (isSpeaking && wpm > 0 && wpm < 95 && wordCount >= 8 && this.lastCueType !== 'pacing_slow') {
      cue = 'Pick up momentum.';
      category = 'PACING';
      tip = `Pacing is ${wpm} WPM. Build forward drive and conversational energy.`;
      this.lastCueType = 'pacing_slow';
    }
    // 3. Excessive Silence / Hesitation (>= 3.5s pause)
    else if (silenceSec >= 3.5 && this.lastCueType !== 'silence') {
      category = 'FLOW';
      if (this.mode === 'story_lab') {
        cue = "What's the tension?";
        tip = 'Bring in the conflict, obstacle, or surprise.';
      } else if (this.mode === 'public_speaking') {
        cue = 'Land the point.';
        tip = 'Summarize your core thesis with conviction.';
      } else if (this.mode === 'conversation') {
        cue = 'Invite their reaction.';
        tip = 'Ask a question or pass the conversational floor.';
      } else {
        cue = 'Deliver the takeaway.';
        tip = 'State your clear takeaway and transition forward.';
      }
      this.lastCueType = 'silence';
    }
    // 4. Filler Word Burst (>= 3 fillers or filler rate > 4/min)
    else if (fillerCount >= 3 && fillerRate > 3.0 && this.lastCueType !== 'filler') {
      cue = 'Pause instead of filler.';
      category = 'CLARITY';
      tip = `Detected ${fillerCount} filler words. Replace 'um' or 'like' with a silent pause.`;
      this.lastCueType = 'filler';
    }
    // 5. Eye Contact Disengagement (Gaze focus < 40%)
    else if (gazeRatio < 0.40 && this.lastCueType !== 'gaze') {
      cue = 'Look at the lens.';
      category = 'PRESENCE';
      tip = 'Direct eye contact commands audience confidence.';
      this.lastCueType = 'gaze';
    }
    // 6. Posture Instability (Shift > 0.35)
    else if (postureDelta > 0.35 && this.lastCueType !== 'posture') {
      cue = 'Anchor your shoulders.';
      category = 'PRESENCE';
      tip = 'Steady, grounded posture signals executive authority.';
      this.lastCueType = 'posture';
    }

    if (cue) {
      this.lastCueTime = now;
      console.log(`[ORATOR][COACH] 💡 Triggered HUD Cue: [${category}] "${cue}" — ${tip}`);

      if (this.onMessage) {
        this.onMessage({
          type: 'LIVE_CUE',
          cue,
          category,
          tip,
          timestamp: now
        });
      }
    }
  }

  sendSpeechChunk({ transcript, wpm, silenceSec, fillersInChunk, storyMomentum }) {
    this.updateMetrics({
      wpm,
      silenceSec,
      fillerCount: this.metrics.fillerCount + (fillersInChunk || 0),
      storyMomentum
    });

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

  sendVisualMetrics({ gazeRatio, postureDelta }) {
    this.updateMetrics({ gazeRatio, postureDelta });

    if (!this.isGeminiLiveDirect && this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.send({
        type: 'VISUAL_METRICS_UPDATE',
        gazeRatio,
        postureDelta
      });
    }
  }

  sendRoleplayPrompt(userUtterance, persona) {
    console.log(`[ORATOR][LIVE] Sending roleplay turn: "${userUtterance.slice(-80)}"`);

    if (this.isGeminiLiveDirect && this.ws && this.ws.readyState === WebSocket.OPEN) {
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
      this.send({
        type: 'ROLEPLAY_PROMPT',
        userUtterance,
        persona: persona || this.persona
      });
    }
  }

  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  disconnect() {
    console.log('[ORATOR][LIVE] Disconnecting WebSocket.');
    this.isExplicitlyClosed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);

    if (this.ws) {
      try { this.ws.close(); } catch (e) {}
      this.ws = null;
      this.isConnected = false;
      this.setupCompleted = false;
    }
    if (this.playbackCtx) {
      try { this.playbackCtx.close(); } catch (e) {}
      this.playbackCtx = null;
    }
  }
}
