/**
 * WebSocket Client Service for ORATOR AI
 * Handles live coaching stream connection via Ephemeral Tokens or Server Proxy
 */
export class LiveCoachingWSClient {
  constructor(onMessageCallback, onErrorCallback) {
    this.ws = null;
    this.onMessage = onMessageCallback;
    this.onError = onErrorCallback;
    this.isConnected = false;
  }

  async connect() {
    try {
      // 1. Fetch ephemeral live token / connection config from relative Netlify route /api/live-token
      const tokenRes = await fetch('/api/live-token', { method: 'POST' });
      const tokenData = await tokenRes.json();

      if (tokenData && tokenData.isConfigured && tokenData.wsEndpoint) {
        // Connect to Live WebSocket
        const wsUrl = `${tokenData.wsEndpoint}?key=${tokenData.token || ''}`;
        this.initWebSocket(wsUrl);
      } else {
        // Fallback relative route if proxy WebSocket is active
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        const wsUrl = `${protocol}//${host}/api/live-stream`;
        this.initWebSocket(wsUrl);
      }
    } catch (err) {
      console.warn('Live WebSocket token resolution notice:', err.message);
      if (this.onError) this.onError(err);
    }
  }

  initWebSocket(wsUrl) {
    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.isConnected = true;
        console.log('Connected to ORATOR AI Live WebSocket');
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (this.onMessage) this.onMessage(data);
        } catch (err) {
          console.error('Error parsing WS message:', err);
        }
      };

      this.ws.onerror = (err) => {
        console.warn('WebSocket error notice:', err);
        if (this.onError) this.onError(err);
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        console.log('WebSocket connection closed');
      };
    } catch (err) {
      console.warn('WebSocket initialization notice:', err);
      if (this.onError) this.onError(err);
    }
  }

  initSession(mode = 'free_talk', persona = 'Interviewer') {
    this.send({
      type: 'INIT_SESSION',
      mode,
      roleplayPersona: persona
    });
  }

  sendSpeechChunk({ transcript, wpm, silenceSec, fillersInChunk, storyMomentum }) {
    this.send({
      type: 'SPEECH_CHUNK',
      transcript,
      wpm,
      silenceSec,
      fillersInChunk,
      storyMomentum
    });
  }

  sendVisualMetrics({ gazeRatio, postureDelta }) {
    this.send({
      type: 'VISUAL_METRICS_UPDATE',
      gazeRatio,
      postureDelta
    });
  }

  sendRoleplayPrompt(userUtterance, persona) {
    this.send({
      type: 'ROLEPLAY_PROMPT',
      userUtterance,
      persona
    });
  }

  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  disconnect() {
    if (this.ws) {
      try { this.ws.close(); } catch (e) {}
      this.ws = null;
      this.isConnected = false;
    }
  }
}
