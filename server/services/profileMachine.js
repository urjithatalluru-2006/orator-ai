import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '../data');
const PROFILE_FILE = path.join(DATA_DIR, 'profile.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initial profile template
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

export function getProfile() {
  try {
    if (fs.existsSync(PROFILE_FILE)) {
      const data = fs.readFileSync(PROFILE_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Error reading profile file, returning default:', err);
  }
  saveProfile(INITIAL_PROFILE);
  return INITIAL_PROFILE;
}

export function saveProfile(profileData) {
  try {
    fs.writeFileSync(PROFILE_FILE, JSON.stringify(profileData, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Error saving profile:', err);
    return false;
  }
}

export function updateProfileWithSession(analysisData, sessionMeta) {
  const profile = getProfile();
  
  profile.sessions_completed += 1;
  profile.last_session_date = new Date().toISOString();
  
  // Calculate rolling exponential moving average for metrics (alpha = 0.3)
  const alpha = 0.3;
  if (analysisData.scores) {
    Object.keys(profile.communication_metrics).forEach(metric => {
      if (analysisData.scores[metric] !== undefined) {
        const oldVal = profile.communication_metrics[metric];
        const newVal = analysisData.scores[metric];
        profile.communication_metrics[metric] = Math.round(oldVal * (1 - alpha) + newVal * alpha);
      }
    });
  }

  // Update weakness counters if detected in topWeaknesses
  if (Array.isArray(analysisData.topWeaknesses)) {
    analysisData.topWeaknesses.forEach(weaknessStr => {
      const existing = profile.recurring_patterns.weaknesses.find(w => w.label.toLowerCase() === weaknessStr.toLowerCase());
      if (existing) {
        existing.count += 1;
        existing.last_observed = new Date().toISOString();
      } else {
        profile.recurring_patterns.weaknesses.push({
          id: weaknessStr.toLowerCase().replace(/\s+/g, '_'),
          label: weaknessStr,
          count: 1,
          last_observed: new Date().toISOString()
        });
      }
    });
  }

  // Update strength counters
  if (Array.isArray(analysisData.topStrengths)) {
    analysisData.topStrengths.forEach(strengthStr => {
      const existing = profile.recurring_patterns.strengths.find(s => s.label.toLowerCase() === strengthStr.toLowerCase());
      if (existing) {
        existing.count += 1;
        existing.last_observed = new Date().toISOString();
      } else {
        profile.recurring_patterns.strengths.push({
          id: strengthStr.toLowerCase().replace(/\s+/g, '_'),
          label: strengthStr,
          count: 1,
          last_observed: new Date().toISOString()
        });
      }
    });
  }

  // Record session summary in history
  profile.session_history.unshift({
    id: `session_${Date.now()}`,
    timestamp: new Date().toISOString(),
    mode: sessionMeta.mode || 'free_talk',
    durationSec: sessionMeta.durationSec || 60,
    overallScore: analysisData.scores?.overall || 70,
    verdict: analysisData.executiveVerdict || '',
    recommendedDrill: analysisData.recommendedDrill?.title || 'Daily Communication Drill'
  });

  // Limit session history to last 30 sessions
  if (profile.session_history.length > 30) {
    profile.session_history = profile.session_history.slice(0, 30);
  }

  // Update adaptive curriculum focus based on lowest metric score
  const lowestMetric = Object.entries(profile.communication_metrics)
    .sort(([, a], [, b]) => a - b)[0];
  
  if (lowestMetric) {
    const focusMap = {
      storytelling: "Story Hooks & Narrative Tension",
      conciseness: "Concise Phrasing & Eliminating Ramble",
      wit: "Reframing Mechanics & Timing",
      delivery: "Pacing & Purposeful Pausing",
      clarity: "Structural Explanations & Analogies",
      memorability: "Crafting High-Impact Phrasing"
    };
    profile.adaptive_curriculum.current_focus = focusMap[lowestMetric[0]] || "Overall Communication Mastery";
  }

  saveProfile(profile);
  return profile;
}
