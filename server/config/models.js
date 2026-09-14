// Server-side Gemini Model Configuration
// Updated to current available Gemini models (gemini-3.6-flash / gemini-2.0-flash)

export const GEMINI_MODELS = {
  // Real-Time Live Streaming (Audio / Video Multimodal)
  LIVE_STREAM: process.env.GEMINI_LIVE_MODEL || 'gemini-2.0-flash',
  
  // Fast Event & Intervention Analysis
  FAST_ANALYSIS: process.env.GEMINI_FAST_MODEL || 'gemini-3.6-flash',
  
  // Deep Post-Session Reasoning & Comprehensive Feedback
  DEEP_REASONING: process.env.GEMINI_DEEP_MODEL || 'gemini-3.6-flash',
  
  // Backup / Fallback Model
  FALLBACK: process.env.GEMINI_FALLBACK_MODEL || 'gemini-2.0-flash'
};

export const INTERVENTION_CONFIG = {
  THRESHOLD: parseFloat(process.env.INTERVENTION_THRESHOLD || '0.60'),
  MAX_SPEED_WPM: parseInt(process.env.MAX_SPEED_WPM || '195', 10),
  SILENCE_THRESHOLD_SEC: parseFloat(process.env.SILENCE_THRESHOLD_SEC || '4.0'),
  MAX_CUE_WORDS: 4
};
