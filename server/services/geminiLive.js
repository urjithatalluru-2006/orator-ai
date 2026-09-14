import { GoogleGenAI } from '@google/genai';
import { GEMINI_MODELS } from '../config/models.js';
import { evaluateIntervention } from './interventionEngine.js';

/**
 * Handles WebSocket connection for live speech streaming and roleplay interaction
 */
export function handleLiveConnection(ws, req) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  let ai = null;

  if (apiKey) {
    try {
      ai = new GoogleGenAI({ apiKey });
    } catch (e) {
      console.warn('Could not initialize GoogleGenAI instance:', e.message);
    }
  }

  let sessionState = {
    mode: 'free_talk',
    transcriptBuffer: '',
    fillerCount: 0,
    wpm: 140,
    silenceSec: 0,
    storyMomentum: 'normal',
    gazeRatio: 0.85,
    postureDelta: 0.1,
    roleplayPersona: 'Interviewer'
  };

  ws.on('message', async (message) => {
    try {
      const payload = JSON.parse(message.toString());

      switch (payload.type) {
        case 'INIT_SESSION':
          sessionState.mode = payload.mode || 'free_talk';
          sessionState.roleplayPersona = payload.roleplayPersona || 'Interviewer';
          ws.send(JSON.stringify({
            type: 'SESSION_READY',
            mode: sessionState.mode,
            isGeminiConfigured: !!apiKey,
            message: `Live Coaching Session initialized in ${sessionState.mode} mode.`
          }));
          break;

        case 'SPEECH_CHUNK':
          sessionState.transcriptBuffer += ' ' + (payload.transcript || '');
          sessionState.wpm = payload.wpm || sessionState.wpm;
          sessionState.silenceSec = payload.silenceSec || 0;
          sessionState.fillerCount += payload.fillersInChunk || 0;
          sessionState.storyMomentum = payload.storyMomentum || sessionState.storyMomentum;

          const intervention = evaluateIntervention({
            transcriptChunk: payload.transcript || '',
            wpm: sessionState.wpm,
            silenceSec: sessionState.silenceSec,
            fillerCount: sessionState.fillerCount,
            storyMomentum: sessionState.storyMomentum,
            gazeRatio: sessionState.gazeRatio,
            postureDelta: sessionState.postureDelta,
            mode: sessionState.mode
          });

          if (intervention.shouldIntervene) {
            ws.send(JSON.stringify({
              type: 'LIVE_CUE',
              cue: intervention.cue,
              category: intervention.category,
              netBenefit: intervention.netBenefit,
              timestamp: Date.now()
            }));
          }
          break;

        case 'VISUAL_METRICS_UPDATE':
          sessionState.gazeRatio = payload.gazeRatio !== undefined ? payload.gazeRatio : sessionState.gazeRatio;
          sessionState.postureDelta = payload.postureDelta !== undefined ? payload.postureDelta : sessionState.postureDelta;
          break;

        case 'ROLEPLAY_PROMPT':
          if (!ai || !apiKey) {
            ws.send(JSON.stringify({
              type: 'ROLEPLAY_RESPONSE',
              response: "Gemini API key is not configured in server/.env. Add GEMINI_API_KEY to server/.env to enable live AI roleplay responses.",
              persona: payload.persona || sessionState.roleplayPersona,
              isGeminiConfigured: false
            }));
            break;
          }

          const personaPrompts = {
            'Skeptical Investor': "You are an aggressive, skeptical venture capitalist. Challenge assumptions, demand unit economics, interrupt long stories.",
            'Hostile Audience': "You are an adversarial listener who disagrees with the speaker. Point out flaws, express doubt, ask tough follow-ups.",
            'Interviewer': "You are a sharp executive interviewer. Ask probing behavioral questions and test clarity.",
            'Friend': "You are a supportive but honest peer. Give candid reactions.",
            'Executive': "You have 30 seconds before your next meeting. Demand conciseness and immediate value."
          };

          const selectedPersona = personaPrompts[payload.persona || sessionState.roleplayPersona] || personaPrompts['Interviewer'];

          const roleplayPrompt = `
System Persona: ${selectedPersona}
User Mode: ${sessionState.mode}
User Said: "${payload.userUtterance}"

Generate a short, realistic, human 1-2 sentence response as this persona to keep the back-and-forth conversation natural and challenging.
`;

          const roleplayRes = await ai.models.generateContent({
            model: GEMINI_MODELS.FAST_ANALYSIS,
            contents: [{ role: 'user', parts: [{ text: roleplayPrompt }] }]
          });

          ws.send(JSON.stringify({
            type: 'ROLEPLAY_RESPONSE',
            response: roleplayRes.text.trim(),
            persona: payload.persona || sessionState.roleplayPersona,
            isGeminiConfigured: true
          }));
          break;

        default:
          break;
      }
    } catch (err) {
      console.error('Error handling WebSocket message:', err.message);
    }
  });

  ws.on('close', () => {
    // Client disconnected
  });
}
