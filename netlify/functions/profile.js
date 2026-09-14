const INITIAL_PROFILE = {
  user_id: "default_user",
  created_at: new Date().toISOString(),
  sessions_completed: 0,
  streak_days: 1,
  last_session_date: new Date().toISOString(),
  communication_metrics: {
    clarity: 70,
    conciseness: 65,
    storytelling: 72,
    delivery: 75,
    wit: 60,
    memorability: 68
  },
  recurring_patterns: {
    weaknesses: [
      { id: "long_intros", label: "Long Introductions", count: 2, last_observed: new Date().toISOString() },
      { id: "speed_under_pressure", label: "Speaks Fast Under Pressure", count: 3, last_observed: new Date().toISOString() }
    ],
    strengths: [
      { id: "natural_tone", label: "Authentic & Conversational Tone", count: 4, last_observed: new Date().toISOString() },
      { id: "technical_clarity", label: "Clear Technical Explanations", count: 3, last_observed: new Date().toISOString() }
    ]
  },
  adaptive_curriculum: {
    current_focus: "Story Hooks & Narrative Tension",
    weekly_priority_queue: ["Hook Specificity", "Pausing Before Payoffs", "Concise Introductions"],
    mastery_progress: {
      story_hooks: 0.65,
      delivery_pausing: 0.70,
      wit_reframing: 0.45,
      handling_interruptions: 0.55
    }
  },
  session_history: []
};

export async function handler(event, context) {
  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type"
    },
    body: JSON.stringify(INITIAL_PROFILE)
  };
}
