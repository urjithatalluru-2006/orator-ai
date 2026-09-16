/**
 * live-token Netlify Function
 * Generates an official ephemeral authentication token for Gemini Live API.
 * 
 * SECURITY ARCHITECTURE:
 * 1. Permanent GEMINI_API_KEY is read strictly server-side from Netlify Environment Variables.
 * 2. This function calls Google's auth_tokens endpoint:
 *    POST https://generativelanguage.googleapis.com/v1alpha/auth_tokens
 * 3. Google mints a short-lived ephemeral token (name: "auth_tokens/<unique_id>").
 * 4. The ephemeral token is returned to the browser.
 * 5. The browser uses this token to connect directly to:
 *    wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained?access_token=<ephemeral_token>
 * 6. The permanent GEMINI_API_KEY is NEVER exposed to the browser or network logs.
 */

export async function handler(event, context) {
  // Handle CORS preflight
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

  const apiKey = process.env.GEMINI_API_KEY?.trim();

  if (!apiKey) {
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify({
        isConfigured: false,
        message: "GEMINI_API_KEY is not set in Netlify Environment Variables. Operating in local metrics fallback mode."
      })
    };
  }

  try {
    // Call Google's official AuthToken service to generate an ephemeral token
    const tokenResponse = await fetch('https://generativelanguage.googleapis.com/v1alpha/auth_tokens', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify({
        // Standard ephemeral token specification (valid for 30 minutes)
      })
    });

    if (!tokenResponse.ok) {
      const errText = await tokenResponse.text();
      console.error('Google AuthToken service error:', tokenResponse.status, errText);
      return {
        statusCode: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        },
        body: JSON.stringify({
          isConfigured: true,
          liveAvailable: false,
          error: `Google AuthToken service returned status ${tokenResponse.status}`,
          message: "Could not generate ephemeral token. Client will use local flow engine."
        })
      };
    }

    const tokenData = await tokenResponse.json();
    const ephemeralToken = tokenData.name; // Format: "auth_tokens/<id>"

    // Return ephemeral connection details to browser (permanent key is NOT exposed)
    const liveWsEndpoint = "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained";
    const liveModel = process.env.GEMINI_LIVE_MODEL || "models/gemini-2.5-flash-native-audio-latest";

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify({
        isConfigured: true,
        liveAvailable: true,
        ephemeralToken, // Short-lived token only (auth_tokens/...)
        wsEndpoint: liveWsEndpoint,
        model: liveModel,
        expiresInSec: 1800
      })
    };
  } catch (err) {
    console.error('Error in live-token Netlify function:', err.message);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify({
        isConfigured: true,
        liveAvailable: false,
        error: err.message
      })
    };
  }
}
