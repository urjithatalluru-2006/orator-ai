export async function handler(event, context) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();

  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type"
    },
    body: JSON.stringify({
      status: "online",
      environment: "netlify-functions",
      serverTime: new Date().toISOString(),
      models: {
        LIVE_STREAM: process.env.GEMINI_LIVE_MODEL || "gemini-2.0-flash",
        FAST_ANALYSIS: process.env.GEMINI_FAST_MODEL || "gemini-3.6-flash",
        DEEP_REASONING: process.env.GEMINI_DEEP_MODEL || "gemini-3.6-flash"
      },
      apiKeyConfigured: !!(apiKey && apiKey.length > 0)
    })
  };
}
