/**
 * Local Audio & Speech Detection Service
 * Real Voice Activity Detection (VAD) via Web Audio API Analyser RMS volume energy.
 * Calculates WPM strictly from active speech time.
 * Prevents fake metrics generation during silence.
 */

const FILLER_WORDS = [
  'um', 'uh', 'like', 'basically', 'you know', 'literally', 
  'sort of', 'kind of', 'actually', 'so yeah', 'right'
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

    this.isListening = false;
    this.isSpeaking = false;
    this.transcript = '';
    this.wordCount = 0;
    this.speakingTimeMs = 0;
    this.lastSpeechTime = Date.now();
    this.silenceSec = 0;
    this.fillerCount = 0;
    this.wpm = 0; // Starts strictly at 0 in IDLE state

    this.vadInterval = null;
    this.lastVadCheck = Date.now();
  }

  async startListening() {
    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });

      // 1. Web Audio API Analyser for Voice Activity Detection (VAD)
      this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const source = this.audioCtx.createMediaStreamSource(this.mediaStream);
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 512;
      this.analyser.smoothingTimeConstant = 0.4;
      source.connect(this.analyser);

      // 2. Web Speech API Recognition
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        this.recognition = new SpeechRecognition();
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang = 'en-US';

        this.recognition.onresult = (event) => {
          let interimTranscript = '';
          let finalTranscript = '';

          for (let i = event.resultIndex; i < event.results.length; ++i) {
            const transcriptChunk = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              finalTranscript += transcriptChunk + ' ';
              this.processTextChunk(transcriptChunk);
            } else {
              interimTranscript += transcriptChunk;
            }
          }

          const fullText = (this.transcript + ' ' + finalTranscript + interimTranscript).trim();
          if (this.onTranscriptUpdate) {
            this.onTranscriptUpdate(fullText, interimTranscript);
          }
        };

        this.recognition.onerror = (err) => {
          console.warn('Speech recognition notice:', err.error);
        };

        this.recognition.onend = () => {
          if (this.isListening && this.recognition) {
            try { this.recognition.start(); } catch (e) {}
          }
        };

        this.recognition.start();
      }

      this.isListening = true;
      this.lastVadCheck = Date.now();

      // 3. VAD Audio Energy Monitoring Loop (Runs at 20Hz)
      const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
      this.vadInterval = setInterval(() => {
        if (!this.isListening || !this.analyser) return;

        this.analyser.getByteFrequencyData(dataArray);
        
        // Calculate RMS audio energy volume
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i] * dataArray[i];
        }
        const rms = Math.sqrt(sum / dataArray.length);

        const now = Date.now();
        const deltaMs = now - this.lastVadCheck;
        this.lastVadCheck = now;

        // VAD Volume Threshold for human speech vs room noise (RMS > 14)
        const isCurrentlySpeaking = rms > 14;

        if (isCurrentlySpeaking) {
          this.lastSpeechTime = now;
          this.silenceSec = 0;
          this.speakingTimeMs += deltaMs;

          if (!this.isSpeaking) {
            this.isSpeaking = true;
            if (this.onStateChange) this.onStateChange('SPEAKING');
          }

          // Recalculate WPM strictly from active speaking time
          if (this.wordCount > 0 && this.speakingTimeMs > 2000) {
            const minutes = this.speakingTimeMs / 60000;
            this.wpm = Math.round(this.wordCount / minutes);
          }
        } else {
          // User is silent
          this.silenceSec = parseFloat(((now - this.lastSpeechTime) / 1000).toFixed(1));

          if (this.silenceSec > 1.2 && this.isSpeaking) {
            this.isSpeaking = false;
            if (this.onStateChange) this.onStateChange('PAUSED');
          }
        }

        this.emitMetrics();
      }, 50);

    } catch (err) {
      console.error('Error initializing local audio:', err);
      if (this.onStateChange) this.onStateChange('ERROR');
      throw err;
    }
  }

  processTextChunk(chunk) {
    const words = chunk.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (words.length === 0) return;

    this.wordCount += words.length;

    // Detect Filler Words strictly from recognized speech
    let newFillers = 0;
    words.forEach(w => {
      if (FILLER_WORDS.includes(w)) {
        newFillers += 1;
      }
    });
    this.fillerCount += newFillers;

    this.transcript += ' ' + chunk;
    this.emitMetrics(newFillers, chunk);
  }

  emitMetrics(newFillers = 0, lastChunk = '') {
    if (this.onMetricsUpdate) {
      this.onMetricsUpdate({
        wpm: this.wordCount > 0 ? this.wpm : 0,
        silenceSec: this.silenceSec,
        totalFillers: this.fillerCount,
        newFillers,
        wordCount: this.wordCount,
        isSpeaking: this.isSpeaking,
        lastChunk
      });
    }
  }

  reset() {
    this.transcript = '';
    this.wordCount = 0;
    this.speakingTimeMs = 0;
    this.silenceSec = 0;
    this.fillerCount = 0;
    this.wpm = 0;
    this.isSpeaking = false;
  }

  stopListening() {
    this.isListening = false;
    this.isSpeaking = false;
    if (this.vadInterval) clearInterval(this.vadInterval);
    if (this.recognition) {
      try { this.recognition.stop(); } catch (e) {}
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
    }
    if (this.audioCtx) {
      try { this.audioCtx.close(); } catch (e) {}
    }
  }
}
