import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

import { runPostSessionAnalysis } from './services/postSessionAnalysis.js';
import { getProfile, updateProfileWithSession } from './services/profileMachine.js';
import { GEMINI_MODELS } from './config/models.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Explicitly load server/.env file path
dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Safe Credentials Verification Check (Zero Leakage)
const getApiKey = () => process.env.GEMINI_API_KEY?.trim() || '';
const isGeminiConfigured = () => getApiKey().length > 0;

// 1. Healthcheck Endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    serverTime: new Date().toISOString(),
    models: GEMINI_MODELS,
    apiKeyConfigured: isGeminiConfigured()
  });
});

// 2. Test Gemini API Authentication Endpoint
app.get('/api/test-gemini', async (req, res) => {
  const apiKey = getApiKey();
  if (!apiKey) {
    return res.json({
      configured: false,
      status: 'MISSING_KEY',
      message: 'GEMINI_API_KEY is not set in server/.env. Add GEMINI_API_KEY to server/.env and restart.'
    });
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: GEMINI_MODELS.FAST_ANALYSIS,
      contents: 'Verify authentication. Respond with exact word: AUTHENTICATED_OK'
    });

    res.json({
      configured: true,
      status: 'AUTHENTICATED',
      model: GEMINI_MODELS.FAST_ANALYSIS,
      response: response.text.trim()
    });
  } catch (err) {
    console.error('Gemini test authentication error:', err.message);
    res.status(500).json({
      configured: true,
      status: 'AUTH_ERROR',
      error: err.message
    });
  }
// 2b. Gemini Live Ephemeral Token Minting Endpoint
app.all('/api/live-token', async (req, res) => {
  const apiKey = getApiKey();
  if (!apiKey) {
    return res.json({
      isConfigured: false,
      message: 'GEMINI_API_KEY is not set in server/.env.'
    });
  }

  try {
    const tokenResponse = await fetch('https://generativelanguage.googleapis.com/v1alpha/auth_tokens', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify({})
    });

    if (!tokenResponse.ok) {
      const errText = await tokenResponse.text();
      console.error('Google AuthToken error:', tokenResponse.status, errText);
      return res.json({
        isConfigured: true,
        liveAvailable: false,
        error: `Google AuthToken error ${tokenResponse.status}`
      });
    }

    const tokenData = await tokenResponse.json();
    res.json({
      isConfigured: true,
      liveAvailable: true,
      ephemeralToken: tokenData.name,
      wsEndpoint: 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained',
      model: process.env.GEMINI_LIVE_MODEL || 'models/gemini-2.5-flash-native-audio-latest',
      expiresInSec: 1800
    });
  } catch (err) {
    console.error('Failed to generate live token:', err.message);
    res.status(500).json({ isConfigured: true, liveAvailable: false, error: err.message });
  }
});

// 3. Profile Management Endpoints
app.get('/api/profile', (req, res) => {
  const profile = getProfile();
  res.json(profile);
});

// 4b. Wit Analysis Endpoint (local dev parity with netlify/functions/analyze-wit.js)
app.post('/api/analyze-wit', async (req, res) => {
  const apiKey = getApiKey();
  const { sentence } = req.body || {};

  if (!sentence?.trim()) {
    return res.status(400).json({ error: 'sentence field is required.' });
  }

  if (!apiKey) {
    return res.status(503).json({
      error: 'GEMINI_API_KEY not configured in server/.env.',
      isGeminiConfigured: false
    });
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const prompt = `
You are a wit and humor coach. Analyze this sentence for its wit potential.

ORIGINAL SENTENCE: "${sentence}"

Return a JSON object with exactly these fields:
{
  "wittyReframing": "A wittier version of the sentence, demonstrating the technique",
  "mechanicUsed": "Name the specific wit mechanic used (Reframing / Unexpected Contrast / Understatement / Irony / etc.)",
  "coachingInsight": "2-3 sentences explaining WHY the reframing works and what timing/delivery tip would make it land better in real conversation."
}

Only return valid JSON. No markdown, no explanation outside the JSON.
`;
    const response = await new GoogleGenAI({ apiKey }).models.generateContent({
      model: GEMINI_MODELS.FAST_ANALYSIS,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: { responseMimeType: 'application/json' }
    });
    const parsed = JSON.parse(response.text);
    res.json({ ...parsed, isGeminiConfigured: true });
  } catch (err) {
    console.error('analyze-wit route error:', err.message);
    res.status(500).json({ error: err.message, isGeminiConfigured: true });
  }
});

// 5. Post-Session Analysis Endpoint
app.post('/api/analyze-session', async (req, res) => {
  try {
    const sessionPayload = req.body;
    if (!sessionPayload || !sessionPayload.transcript) {
      return res.status(400).json({ error: 'Missing session transcript payload.' });
    }

    // [CRITERION 12]: /api/analyze-session receives that exact session data
    console.log('[ORATOR][API] /api/analyze-session received exact session payload:', {
      wordCount: sessionPayload.wordCount,
      durationSec: sessionPayload.durationSec,
      wpmAvg: sessionPayload.wpmAvg,
      fillerCount: sessionPayload.fillerCount,
      pauseCount: sessionPayload.pauseCount,
      speakingTimeSec: sessionPayload.speakingTimeSec,
      silenceSecondsTotal: sessionPayload.silenceSecondsTotal,
      transcriptSnippet: sessionPayload.transcript.slice(0, 60),
      cuesCount: sessionPayload.cuesTriggered?.length || 0
    });

    // Run post-session analysis safely
    const analysisResult = await runPostSessionAnalysis({ sessionPayload });

    // Update user profile state machine with session evidence
    const updatedProfile = updateProfileWithSession(analysisResult.data, sessionPayload);

    res.json({
      analysis: analysisResult.data,
      profile: updatedProfile,
      isGeminiConfigured: isGeminiConfigured()
    });
  } catch (err) {
    console.error('Error during session analysis route:', err.message);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`ORATOR AI Server running on http://localhost:${PORT}`);
  console.log(`Live Token Endpoint: http://localhost:${PORT}/api/live-token`);
  console.log(`Gemini API Key Configured: ${isGeminiConfigured() ? 'YES (server/.env)' : 'NO (Missing GEMINI_API_KEY in server/.env)'}`);
  console.log(`====================================================`);
});
