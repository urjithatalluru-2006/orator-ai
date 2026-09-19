/**
 * Local Audio & Speech Detection Service for ORATOR AI
 * 
 * Features:
 * - Web Audio API Analyser for real-time RMS Voice Activity Detection (VAD)
 * - Explicit AudioContext auto-resumption to guarantee audio analysis in modern browsers
 * - Accurate dynamic WPM calculation based on active speaking duration
 * - Enhanced filler word detection (multi-word phrases + single-word tokens, punctuation-clean)
 * - Accurate pause count and silence duration tracking
 * - Real-time audio energy level (0-100%) for live UI feedback
 * - Diagnostic logging with [ORATOR][AUDIO] and [ORATOR][METRICS]
 */

const MULTI_WORD_FILLERS = [
  'you know', 'sort of', 'kind of', 'so yeah', 'i mean', 
  'at the end of the day', 'as in'
];

const SINGLE_WORD_FILLERS = [
  'um', 'uh', 'er', 'ah', 'like', 'basically', 'actually', 
  'literally', 'right', 'honestly', 'obviously'
];

export class LocalAudioService {
  constructor(onTranscriptUpdate, onMetricsUpdate, onStateChange) {
    this.onTranscriptUpdate = onTranscriptUpdate;
    this.onMetricsUpdate = onMetricsUpdate;
    this.onStateChange = onStateChange;

    this.audioCtx = null;
    this.analyser = null;
    this.mediaStream = null;
    this.recognition = null;

    // Session Metrics State
    this.isListening = false;
    this.isSpeaking = false;
    this.sessionStartTime = Date.now();
    this.lastSpeechTime = Date.now();
    this.speakingTimeMs = 0;
    this.totalSilenceMs = 0;
    this.silenceSec = 0;
    this.pauseCount = 0;

    // Transcript & Word Metrics
    this.transcript = '';
    this.wordCount = 0;
    this.fillerCount = 0;
    this.fillersList = [];
    this.wpm = 0;

    // VAD Loop
    this.vadInterval = null;
    this.lastVadCheck = Date.now();
    this.audioLevel = 0; // 0 to 100%
  }

  async startListening() {
    console.log('[ORATOR][AUDIO] Initializing microphone and speech recognition...');
    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });

      // 1. Web Audio API Setup with EXPLICIT RESUME
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioCtxClass();
      
      // CRITICAL FIX: Ensure AudioContext is running, not suspended
      if (this.audioCtx.state === 'suspended') {
        console.log('[ORATOR][AUDIO] AudioContext suspended, resuming...');
        await this.audioCtx.resume();
      }
      console.log('[ORATOR][AUDIO] AudioContext active, state:', this.audioCtx.state);

      const source = this.audioCtx.createMediaStreamSource(this.mediaStream);
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 512;
      this.analyser.smoothingTimeConstant = 0.3;
      source.connect(this.analyser);

      // 2. Web Speech API Recognition
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        this.recognition = new SpeechRecognition();
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang = 'en-US';

        this.recognition.onstart = () => {
          console.log('[ORATOR][AUDIO] SpeechRecognition started.');
        };

        this.recognition.onresult = (event) => {
          let interimTranscript = '';
          let finalTranscript = '';

          for (let i = event.resultIndex; i < event.results.length; ++i) {
            const chunk = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              this.processTextChunk(chunk);
            } else {
              interimTranscript += chunk;
            }
          }

          // User is actively generating speech
          this.lastSpeechTime = Date.now();
          if (!this.isSpeaking) {
            this.isSpeaking = true;
            if (this.onStateChange) this.onStateChange('SPEAKING');
          }

          if (interimTranscript.trim() && this.onTranscriptUpdate) {
            const fullText = (this.transcript + ' ' + interimTranscript).trim();
            this.onTranscriptUpdate(fullText, interimTranscript.trim());
          }
        };

        this.recognition.onerror = (err) => {
          console.warn('[ORATOR][AUDIO] SpeechRecognition error:', err.error);
        };

        this.recognition.onend = () => {
          if (this.isListening && this.recognition) {
            try { this.recognition.start(); } catch (e) {}
          }
        };

        try {
          this.recognition.start();
        } catch (e) {
          console.warn('[ORATOR][AUDIO] Could not start speech recognition:', e.message);
        }
      } else {
        console.warn('[ORATOR][AUDIO] Web Speech API not supported in this browser.');
      }

      this.isListening = true;
      this.sessionStartTime = Date.now();
      this.lastSpeechTime = Date.now();
      this.lastVadCheck = Date.now();

      this.frameCount = 0;
      this.lastFrameLogTime = 0;
      this.lastMetricsLogTime = 0;

      // 3. VAD Audio Energy Monitoring Loop (Runs at 25Hz / 40ms)
      const timeData = new Uint8Array(this.analyser.fftSize);

      this.vadInterval = setInterval(() => {
        if (!this.isListening || !this.analyser) return;

        this.frameCount += 1;

        // Ensure AudioContext hasn't been re-suspended
        if (this.audioCtx && this.audioCtx.state === 'suspended') {
          this.audioCtx.resume().catch(() => {});
        }

        // Calculate True RMS volume from time-domain waveform
        this.analyser.getByteTimeDomainData(timeData);
        let sumSquares = 0;
        for (let i = 0; i < timeData.length; i++) {
          const norm = (timeData[i] - 128) / 128; // Normalize -1.0 to 1.0
          sumSquares += norm * norm;
        }
        const rms = Math.sqrt(sumSquares / timeData.length);
        
        // Scaled audio energy 0-100%
        this.audioLevel = Math.min(100, Math.round(rms * 450));

        const now = Date.now();
        const deltaMs = now - this.lastVadCheck;
        this.lastVadCheck = now;

        // [CRITERION 1]: AUDIO receives microphone frames
        if (now - this.lastFrameLogTime > 2000 || this.frameCount === 1) {
          this.lastFrameLogTime = now;
          console.log(`[ORATOR][AUDIO] Microphone frame #${this.frameCount} received | RMS: ${rms.toFixed(4)} | Level: ${this.audioLevel}%`);
        }

        // VAD Speech Activity Threshold (RMS > 0.02)
        const isAudioActive = rms > 0.02;

        if (isAudioActive) {
          this.lastSpeechTime = now;
          this.silenceSec = 0;
          this.speakingTimeMs += deltaMs;

          // [CRITERION 2]: VAD changes between speech and silence (transition to SPEAKING)
          if (!this.isSpeaking) {
            this.isSpeaking = true;
            if (this.onStateChange) this.onStateChange('SPEAKING');
            console.log(`[ORATOR][VAD] State changed to SPEAKING | RMS: ${rms.toFixed(4)} | Audio Level: ${this.audioLevel}%`);
          }

          // Update WPM dynamically during speech
          this.recalculateWpm();
        } else {
          // User is in a pause or silent
          const silenceDurationMs = now - this.lastSpeechTime;
          this.silenceSec = parseFloat((silenceDurationMs / 1000).toFixed(1));
          this.totalSilenceMs += deltaMs;

          // [CRITERION 2 & 7]: VAD transition to PAUSED when silence exceeds 1.2 seconds
          if (this.silenceSec >= 1.2 && this.isSpeaking) {
            this.isSpeaking = false;
            this.pauseCount += 1;
            if (this.onStateChange) this.onStateChange('PAUSED');
            console.log(`[ORATOR][VAD] State changed to SILENCE / PAUSE | Silence duration: ${this.silenceSec}s`);
            console.log(`[ORATOR][METRICS] Pause count increased to ${this.pauseCount} (Measurable pause duration: ${this.silenceSec}s)`);
          }
        }

        this.emitMetrics();
      }, 40);

      console.log('[ORATOR][AUDIO] Microphone and VAD loop successfully running.');
    } catch (err) {
      console.error('[ORATOR][AUDIO] Error initializing audio service:', err);
      if (this.onStateChange) this.onStateChange('ERROR');
      throw err;
    }
  }

  processTextChunk(chunk) {
    if (!chunk || !chunk.trim()) return;

    // Clean text and tokenize
    const cleanChunk = chunk.toLowerCase();
    const rawWords = cleanChunk.split(/\s+/).map(w => w.replace(/[^\w]/g, '')).filter(Boolean);
    if (rawWords.length === 0) return;

    this.wordCount += rawWords.length;
    this.transcript = (this.transcript + ' ' + chunk.trim()).trim();

    // Notify transcript listener of committed speech segment
    if (this.onTranscriptUpdate) {
      this.onTranscriptUpdate(this.transcript, '');
    }

    // [CRITERION 4]: WORD COUNT increases
    console.log(`[ORATOR][METRICS] Word count increased to ${this.wordCount} (+${rawWords.length} words from "${chunk.trim()}")`);

    // 1. Detect Multi-word Fillers ('you know', 'sort of', etc.)
    let newFillers = 0;
    let workingText = cleanChunk;
    MULTI_WORD_FILLERS.forEach(phrase => {
      let idx = workingText.indexOf(phrase);
      while (idx !== -1) {
        newFillers += 1;
        this.fillersList.push(phrase);
        workingText = workingText.slice(0, idx) + ' ' + workingText.slice(idx + phrase.length);
        idx = workingText.indexOf(phrase);
      }
    });

    // 2. Detect Single-word Fillers ('um', 'uh', 'like', etc.)
    const remainingWords = workingText.split(/\s+/).map(w => w.replace(/[^\w]/g, '')).filter(Boolean);
    remainingWords.forEach(w => {
      if (SINGLE_WORD_FILLERS.includes(w)) {
        newFillers += 1;
        this.fillersList.push(w);
      }
    });

    this.fillerCount += newFillers;

    // [CRITERION 6]: FILLER COUNT changes when filler words are actually spoken
    if (newFillers > 0) {
      console.log(`[ORATOR][METRICS] Filler word detected! Count increased to ${this.fillerCount} (+${newFillers}: ${this.fillersList.slice(-newFillers).join(', ')})`);
    }

    // Recompute WPM on new text arrival
    this.recalculateWpm();

    this.emitMetrics(newFillers, chunk.trim());
  }

  recalculateWpm() {
    if (this.wordCount < 2) {
      this.wpm = 0;
      return;
    }

    // Active speaking minutes (with minimum floor to prevent initial spikes)
    const effectiveActiveMinutes = Math.max(0.08, this.speakingTimeMs / 60000);
    const calculated = Math.round(this.wordCount / effectiveActiveMinutes);

    const prevWpm = this.wpm;
    // Clamp to realistic human conversational speaking speed (40 - 260 WPM)
    this.wpm = Math.max(40, Math.min(260, calculated));

    // [CRITERION 5]: WPM changes once enough transcript data exists
    if (Math.abs(this.wpm - prevWpm) >= 3 || prevWpm === 0) {
      console.log(`[ORATOR][METRICS] WPM recalculated: ${this.wpm} WPM (Words: ${this.wordCount}, Active speaking time: ${(this.speakingTimeMs/1000).toFixed(1)}s)`);
    }
  }

  getFillerRate() {
    const elapsedMinutes = Math.max(0.1, (Date.now() - this.sessionStartTime) / 60000);
    return parseFloat((this.fillerCount / elapsedMinutes).toFixed(1));
  }

  emitMetrics(newFillers = 0, lastChunk = '') {
    const now = Date.now();
    const speakingTimeSec = Math.round(this.speakingTimeMs / 1000);

    // [CRITERION 3]: LOCAL METRICS change while I speak (logged periodically during speech)
    if (this.isSpeaking && (now - this.lastMetricsLogTime > 1800)) {
      this.lastMetricsLogTime = now;
      console.log('[ORATOR][METRICS] Local metrics updated while speaking:', {
        speakingTimeSec,
        silenceSec: this.silenceSec,
        wpm: this.wordCount > 0 ? this.wpm : 0,
        wordCount: this.wordCount,
        fillers: this.fillerCount,
        audioLevel: this.audioLevel
      });
    }

    if (this.onMetricsUpdate) {
      this.onMetricsUpdate({
        wpm: this.wordCount > 0 ? this.wpm : 0,
        silenceSec: this.silenceSec,
        totalSilenceSec: parseFloat((this.totalSilenceMs / 1000).toFixed(1)),
        speakingTimeSec,
        pauseCount: this.pauseCount,
        totalFillers: this.fillerCount,
        fillerRate: this.getFillerRate(),
        fillersList: this.fillersList.slice(-5), // Last 5 detected fillers
        newFillers,
        wordCount: this.wordCount,
        audioLevel: this.audioLevel,
        isSpeaking: this.isSpeaking,
        lastChunk
      });
    }
  }

  reset() {
    this.transcript = '';
    this.wordCount = 0;
    this.speakingTimeMs = 0;
    this.totalSilenceMs = 0;
    this.silenceSec = 0;
    this.pauseCount = 0;
    this.fillerCount = 0;
    this.fillersList = [];
    this.wpm = 0;
    this.isSpeaking = false;
    this.audioLevel = 0;
    this.sessionStartTime = Date.now();
    this.lastSpeechTime = Date.now();
  }

  stopListening() {
    console.log('[ORATOR][AUDIO] Stopping audio capture and VAD loop.');
    this.isListening = false;
    this.isSpeaking = false;

    if (this.vadInterval) {
      clearInterval(this.vadInterval);
      this.vadInterval = null;
    }
    if (this.recognition) {
      try { this.recognition.stop(); } catch (e) {}
      this.recognition = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => {
        try { track.stop(); } catch (e) {}
      });
      this.mediaStream = null;
    }
    if (this.audioCtx) {
      try { this.audioCtx.close(); } catch (e) {}
      this.audioCtx = null;
    }
  }
}
