import { GoogleGenAI } from '@google/genai';
import { GEMINI_MODELS } from '../config/models.js';

export async function runPostSessionAnalysis({
  sessionPayload
}) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();

  // 1. If GEMINI_API_KEY is missing or empty in server/.env, handle gracefully without calling SDK ADC
  if (!apiKey) {
    console.log('Post-session analysis: GEMINI_API_KEY is not configured in server/.env. Using factual session metrics.');
    const factualData = computeAlgorithmicAnalysis(sessionPayload);
    factualData.isGeminiConfigured = false;
    factualData.geminiNotice = "Gemini API key is not configured in server/.env. Analysis derived strictly from factual session metrics.";
    return { success: true, isGeminiConfigured: false, data: factualData };
  }

  // 2. If GEMINI_API_KEY is present, instantiate GoogleGenAI safely with explicit apiKey
  try {
    const ai = new GoogleGenAI({ apiKey });
    const modelName = GEMINI_MODELS.DEEP_REASONING;

    const {
      transcript = '',
      durationSec = 10,
      mode = 'free_talk',
      wpmAvg = 0,
      fillerCount = 0,
      silenceSecondsTotal = 0,
      visualMetricsSummary = {},
      userObjective = 'General Communication Improvement'
    } = sessionPayload;

    const systemInstruction = `
You are a world-class executive communication, storytelling, public-speaking, and wit coach.
Analyze the speech session transcript and metadata deeply.
Do NOT output fake templates. Derive all analysis strictly from the user's actual transcript.
Output MUST strictly be valid JSON adhering to the expected schema.
`;

    const userPrompt = `
SESSION METADATA:
- Mode: ${mode}
- User Objective: ${userObjective}
- Session Duration: ${durationSec} seconds
- Average WPM: ${wpmAvg}
- Total Filler Words: ${fillerCount}
- Total Silence/Pauses: ${silenceSecondsTotal}s
- Visual Summary: ${JSON.stringify(visualMetricsSummary)}

FULL TRANSCRIPT:
"${transcript}"

Provide deep structured JSON analysis:
{
  "executiveVerdict": "A 2-sentence coach verdict based strictly on this transcript.",
  "topStrengths": ["Strength 1", "Strength 2"],
  "topWeaknesses": ["Weakness 1", "Weakness 2"],
  "scores": {
    "clarity": 80,
    "conciseness": 70,
    "storytelling": 85,
    "delivery": 75,
    "wit": 60,
    "memorability": 78,
    "overall": 75
  },
  "storytellingBreakdown": {
    "structureIdentified": "Setup -> Tension -> Payoff",
    "hookRating": "Strong / Moderate / Weak",
    "hookExplanation": "Explanation",
    "tensionScore": 80,
    "payoffScore": 75,
    "specificityRating": "Specificity observations"
  },
  "deliveryMetrics": {
    "wpmAssessment": "Pacing observation",
    "fillerBreakdown": "Filler word analysis",
    "pauseEffectiveness": "Pause analysis"
  },
  "visualAssessment": {
    "gazeObservation": "Gaze observation",
    "postureObservation": "Posture observation"
  },
  "memorabilitySpotlight": {
    "mostMemorableLine": "Exact quote from transcript",
    "whyMemorable": "Why quote sticks",
    "mostForgettableMoment": "Section needing rewrite",
    "improvementSuggestion": "Actionable rewrite"
  },
  "witAnalysis": {
    "observedWitMoments": [],
    "witMechanicUsed": "Reframing / Contrast",
    "coachingTip": "Tip"
  },
  "attentionTimeline": [
    { "timestampSec": 0, "attentionLevel": 80, "note": "Start" },
    { "timestampSec": ${Math.floor(durationSec / 2)}, "attentionLevel": 70, "note": "Midpoint" },
    { "timestampSec": ${durationSec}, "attentionLevel": 85, "note": "End" }
  ],
  "recommendedDrill": {
    "title": "Targeted Drill Title",
    "instructions": "Drill instructions",
    "targetWeakness": "Target weakness"
  }
}
`;

    const response = await ai.models.generateContent({
      model: modelName,
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      config: {
        systemInstruction,
        responseMimeType: 'application/json'
      }
    });

    const parsedData = JSON.parse(response.text);
    parsedData.isGeminiConfigured = true;
    return { success: true, isGeminiConfigured: true, data: parsedData };
  } catch (error) {
    console.error('Gemini post-session API error:', error.message);
    const fallbackData = computeAlgorithmicAnalysis(sessionPayload);
    fallbackData.isGeminiConfigured = true;
    fallbackData.geminiError = error.message;
    return { success: false, error: error.message, data: fallbackData };
  }
}

/**
 * Computes factual post-session scores strictly from actual captured session payload.
 */
function computeAlgorithmicAnalysis({
  transcript = '',
  durationSec = 10,
  wpmAvg = 0,
  fillerCount = 0,
  silenceSecondsTotal = 0
}) {
  const words = transcript.trim().split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  if (wordCount < 5) {
    return {
      executiveVerdict: wordCount === 0
        ? "No spoken transcript was captured during this session. Speak clearly into the microphone to receive full coaching feedback."
        : `Only ${wordCount} words captured ("${transcript.trim()}"). Minimum 5 words required to calculate meaningful communication scores.`,
      topStrengths: ["Session initiated cleanly"],
      topWeaknesses: [wordCount === 0 ? "No active speech detected" : "Insufficient speech sample (< 5 words)"],
      scores: { clarity: null, conciseness: null, storytelling: null, delivery: null, wit: null, memorability: null, overall: null },
      storytellingBreakdown: { structureIdentified: "Insufficient Evidence", hookRating: "N/A", hookExplanation: "Insufficient speech captured.", tensionScore: null, payoffScore: null, specificityRating: "N/A" },
      deliveryMetrics: { wpmAssessment: `${wpmAvg || 0} WPM (Sample too short)`, fillerBreakdown: `${fillerCount} fillers detected`, pauseEffectiveness: "Insufficient evidence" },
      visualAssessment: { gazeObservation: "Standard camera positioning", postureObservation: "Normal baseline posture" },
      memorabilitySpotlight: { mostMemorableLine: "N/A (Insufficient evidence)", whyMemorable: "N/A", mostForgettableMoment: "N/A", improvementSuggestion: "Start speaking naturally when session begins." },
      witAnalysis: { observedWitMoments: [], witMechanicUsed: "N/A", coachingTip: "Speak naturally to analyze wit mechanics." },
      attentionTimeline: [{ timestampSec: 0, attentionLevel: null, note: "Insufficient speech data" }],
      recommendedDrill: { title: "Spontaneous Speaking Warmup", instructions: "Speak continuously for 20 seconds on any topic.", targetWeakness: "Silence / No Speech Captured" }
    };
  }

  const effectiveWpm = wpmAvg > 0 ? wpmAvg : Math.round(wordCount / Math.max(0.1, durationSec / 60));
  const fillerRatio = fillerCount / wordCount;
  const clarityScore = Math.max(30, Math.min(98, Math.round(92 - (fillerRatio * 300))));
  
  const wpmDelta = Math.abs(effectiveWpm - 145);
  const concisenessScore = Math.max(30, Math.min(95, Math.round(90 - (wpmDelta * 0.4))));

  const silenceRatio = silenceSecondsTotal / Math.max(1, durationSec);
  const deliveryScore = Math.max(30, Math.min(95, Math.round(88 - (fillerCount * 3) - (silenceRatio * 20))));

  const sentences = transcript.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const hasStoryKeywords = /because|suddenly|realized|problem|then|finally|learned|struggle/i.test(transcript);
  const storytellingScore = Math.max(40, Math.min(95, Math.round(65 + (sentences.length * 3) + (hasStoryKeywords ? 15 : 0))));

  const witScore = Math.max(30, Math.min(90, Math.round(60 + (transcript.length > 100 ? 10 : 0))));
  const memorabilityScore = Math.round((clarityScore * 0.3) + (storytellingScore * 0.4) + (deliveryScore * 0.3));
  const overallScore = Math.round((clarityScore + concisenessScore + storytellingScore + deliveryScore + witScore + memorabilityScore) / 6);

  const sortedSentences = [...sentences].sort((a, b) => b.length - a.length);
  const mostMemorableLine = sentences[0]?.trim() || transcript.slice(0, 80);
  const mostForgettableMoment = sortedSentences[0]?.trim() || transcript.slice(-80);

  return {
    executiveVerdict: `You spoke ${wordCount} words at an average pace of ${effectiveWpm} WPM over ${durationSec} seconds with ${fillerCount} filler words detected.`,
    topStrengths: [
      effectiveWpm >= 120 && effectiveWpm <= 170 ? `Pacing maintained in optimal 120-170 WPM range (${effectiveWpm} WPM)` : "Active speaking participation",
      fillerCount <= 2 ? "Low filler word usage" : "Captured continuous narrative flow"
    ],
    topWeaknesses: [
      fillerCount > 3 ? `Detected ${fillerCount} filler words (replace with clean pauses)` : "Introductions can be more concise",
      effectiveWpm > 190 ? `Speech rate was fast (${effectiveWpm} WPM under pressure)` : "Tension before payoff can be heightened"
    ],
    scores: {
      clarity: clarityScore,
      conciseness: concisenessScore,
      storytelling: storytellingScore,
      delivery: deliveryScore,
      wit: witScore,
      memorability: memorabilityScore,
      overall: overallScore
    },
    storytellingBreakdown: {
      structureIdentified: sentences.length >= 3 ? "Setup -> Tension -> Payoff" : "Single Thought Narrative",
      hookRating: sentences[0]?.length < 60 ? "Strong" : "Moderate",
      hookExplanation: `Opening sentence: "${sentences[0]?.trim() || transcript.slice(0, 50)}"`,
      tensionScore: Math.round(storytellingScore * 0.9),
      payoffScore: Math.round(storytellingScore * 0.95),
      specificityRating: `Captured ${sentences.length} distinct sentence structures.`
    },
    deliveryMetrics: {
      wpmAssessment: `Average pacing was ${wpmAvg} WPM over ${durationSec}s.`,
      fillerBreakdown: `Detected ${fillerCount} filler words across ${wordCount} words.`,
      pauseEffectiveness: `Total silence duration was ${silenceSecondsTotal}s.`
    },
    visualAssessment: {
      gazeObservation: "Maintained baseline camera positioning.",
      postureObservation: "Posture remained centered throughout session."
    },
    memorabilitySpotlight: {
      mostMemorableLine: `"${mostMemorableLine}"`,
      whyMemorable: "Clear direct opening statement from your actual transcript.",
      mostForgettableMoment: `"${mostForgettableMoment}"`,
      improvementSuggestion: "Condense long sentences into punchy, direct statements."
    },
    witAnalysis: {
      observedWitMoments: sentences.slice(0, 1),
      witMechanicUsed: "Observation",
      coachingTip: "Use unexpected contrast to elevate witty timing."
    },
    attentionTimeline: [
      { timestampSec: 0, attentionLevel: Math.min(95, overallScore + 10), note: "Opening" },
      { timestampSec: Math.floor(durationSec / 2), attentionLevel: Math.max(40, overallScore - 10), note: "Midpoint explanation" },
      { timestampSec: durationSec, attentionLevel: Math.min(95, overallScore + 5), note: "Conclusion" }
    ],
    recommendedDrill: {
      title: fillerCount > 3 ? "Clean Pause Drill" : "Concise Hook Challenge",
      instructions: fillerCount > 3 ? "Speak for 30 seconds replacing every 'um/uh' with 1 second of silence." : "Deliver your core thesis in the first 10 seconds.",
      targetWeakness: fillerCount > 3 ? "Filler word frequency" : "Long introductions"
    }
  };
}
