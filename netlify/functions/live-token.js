/**
 * live-token Netlify Function
 * Returns session configuration for the Live Coaching stream.
 * SECURITY: The GEMINI_API_KEY is NEVER returned to the client.
 * The actual key stays server-side only. The client uses the proxy
 * WebSocket path (/api/live-stream) which the backend handles.
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

  // Check key presence server-side — NEVER send the key value to the client
  const isConfigured = !!(process.env.GEMINI_API_KEY?.trim());

  if (!isConfigured) {
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify({
        isConfigured: false,
        // No wsEndpoint — client will operate in local-VAD-only mode
        message: "GEMINI_API_KEY is not set. Set it in Netlify Site Configuration > Environment Variables."
      })
    };
  }

  // Return session metadata only — NO key, NO secret, NO token containing the key
  const sessionId = Buffer.from(`orator_session_${Date.now()}_${Math.random().toString(36).slice(2)}`).toString('base64');

  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    },
    body: JSON.stringify({
      isConfigured: true,
      // The client connects via the server-proxied WebSocket (backend holds the key)
      // wsEndpoint is intentionally omitted — client uses relative /api/live-stream
      sessionId,
      model: process.env.GEMINI_LIVE_MODEL || "gemini-2.0-flash",
      expiresAt: Date.now() + 3600000
    })
  };
}
