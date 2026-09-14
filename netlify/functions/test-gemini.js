import { GoogleGenAI } from '@google/genai';

export async function handler(event, context) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();

  if (!apiKey) {
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify({
        configured: false,
        status: "MISSING_KEY",
        message: "GEMINI_API_KEY is not set in Netlify Environment Variables. Set GEMINI_API_KEY in Netlify Site Configuration."
      })
    };
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const modelName = process.env.GEMINI_FAST_MODEL || 'gemini-3.6-flash';

    const response = await ai.models.generateContent({
      model: modelName,
      contents: 'Verify authentication. Respond with exact word: AUTHENTICATED_OK'
    });

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify({
        configured: true,
        status: "AUTHENTICATED",
        model: modelName,
        response: response.text.trim()
      })
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify({
        configured: true,
        status: "AUTH_ERROR",
        error: err.message
      })
    };
  }
}
