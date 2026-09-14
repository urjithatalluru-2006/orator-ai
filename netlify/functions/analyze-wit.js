import { GoogleGenAI } from '@google/genai';

/**
 * analyze-wit Netlify Function
 * Takes a user's sentence and returns a genuine Gemini-powered wit analysis.
 * The GEMINI_API_KEY stays server-side only. Never exposed to the browser.
 */
export async function handler(event, context) {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS"
      },
      body: ""
    };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return {
      statusCode: 503,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({
        error: "GEMINI_API_KEY not configured in Netlify environment variables.",
        isGeminiConfigured: false
      })
    };
  }

  try {
    const { sentence } = JSON.parse(event.body || '{}');
    if (!sentence?.trim()) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ error: "sentence field is required." })
      };
    }

    const ai = new GoogleGenAI({ apiKey });
    const modelName = process.env.GEMINI_FAST_MODEL || 'gemini-2.0-flash';

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

    const response = await ai.models.generateContent({
      model: modelName,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: { responseMimeType: 'application/json' }
    });

    const parsed = JSON.parse(response.text);
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ ...parsed, isGeminiConfigured: true })
    };
  } catch (err) {
    console.error('analyze-wit function error:', err.message);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: err.message, isGeminiConfigured: true })
    };
  }
}
