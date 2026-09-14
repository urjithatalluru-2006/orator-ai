import React from 'react';
import { User, Award, Flame, TrendingUp, AlertTriangle, CheckCircle2, BookOpen, Clock, Zap, ArrowUpRight } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

export function ProfileDashboard({ profile }) {
  if (!profile) return null;

  const sessionsCount = profile.sessions_completed || 0;
  const metrics = profile.communication_metrics || {
    clarity: 0, conciseness: 0, storytelling: 0, delivery: 0, wit: 0, memorability: 0
  };

  const history = profile.session_history || [];
  const streak = profile.streak_days || 1;
  const curriculum = profile.adaptive_curriculum || {
    current_focus: "Story Hooks & Tension",
    weekly_priority_queue: ["Hook Specificity", "Pausing Before Payoffs", "Concise Introductions"],
    mastery_progress: { story_hooks: 0.65 }
  };

  const chartData = history.slice(0, 10).reverse().map((s, idx) => ({
    name: `S${idx + 1}`,
    score: s.overallScore || 0,
    mode: s.mode || 'Free Talk'
  }));

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-fadeIn">
      
      {/* Profile Header Banner */}
      <div className="glass-panel p-6 rounded-3xl border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center space-x-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-600 to-cyan-400 flex items-center justify-center shadow-xl shadow-indigo-500/20 ring-4 ring-indigo-400/20">
            <User className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white">COMMUNICATION PROFILE & GROWTH</h1>
            <p className="text-xs text-slate-400 mt-1">
              Structured evolving profile • {sessionsCount} Sessions Completed
            </p>
          </div>
        </div>

        {/* Quick Stats Badges */}
        <div className="flex items-center gap-3">
          <div className="bg-slate-900 border border-slate-800 px-4 py-2.5 rounded-2xl text-center">
            <span className="text-xs font-semibold text-slate-400 block">Streak</span>
            <span className="text-lg font-black text-amber-400 flex items-center justify-center gap-1">
              <Flame className="w-4 h-4 fill-current" /> {streak} Days
            </span>
          </div>

          <div className="bg-slate-900 border border-slate-800 px-4 py-2.5 rounded-2xl text-center">
            <span className="text-xs font-semibold text-slate-400 block">Active Focus</span>
            <span className="text-sm font-extrabold text-indigo-300 truncate max-w-[160px] block">
              {curriculum.current_focus}
            </span>
          </div>
        </div>
      </div>

      {/* Adaptive Weekly Curriculum Roadmap */}
      <div className="glass-panel p-6 rounded-3xl border border-indigo-500/30 bg-gradient-to-r from-indigo-950/30 via-slate-900 to-slate-950 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-indigo-400 font-bold text-sm">
            <BookOpen className="w-5 h-5" />
            <span>ADAPTIVE TRAINING CURRICULUM</span>
          </div>
          <span className="text-xs font-semibold px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
            Auto-Adjusted from Session Evidence
          </span>
        </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {curriculum.weekly_priority_queue?.map((item, idx) => {
            // Use real mastery progress data if available, otherwise 0
            const masteryKey = item.toLowerCase().replace(/[^a-z0-9]+/g, '_');
            const masteryKeys = Object.keys(curriculum.mastery_progress || {});
            const matchedKey = masteryKeys.find(k => item.toLowerCase().includes(k.replace(/_/g, ' ')) || k.includes(masteryKey.slice(0, 6)));
            const masteryPct = matchedKey
              ? Math.round((curriculum.mastery_progress[matchedKey] || 0) * 100)
              : 0;
            return (
              <div key={idx} className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400 font-bold">
                  <span>PRIORITY {idx + 1}</span>
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                </div>
                <p className="text-sm font-extrabold text-slate-100">{item}</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                    <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${masteryPct}%` }}></div>
                  </div>
                  <span className="text-[10px] text-slate-500 font-bold w-8 text-right">{masteryPct}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Long-Term Progression Trend Chart */}
      <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              Historical Score Progression Trend
            </h3>
            <p className="text-xs text-slate-400">Track overall communication impact trajectory across sessions</p>
          </div>
        </div>

        <div className="h-56 w-full">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="name" stroke="#64748b" />
                <YAxis domain={[0, 100]} stroke="#64748b" />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px' }} />
                <Line type="monotone" dataKey="score" stroke="#6366f1" strokeWidth={3} dot={{ fill: '#6366f1', r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-xs text-slate-500 italic">
              No session history recorded yet. Complete a live coaching session to begin tracking progress.
            </div>
          )}
        </div>
      </div>

      {/* Recurring Strengths vs Weaknesses Vectors */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Recurring Weaknesses */}
        <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4">
          <h3 className="text-sm font-bold text-rose-400 uppercase tracking-wider flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Recurring Communication Patterns (To Fix)
          </h3>
          <div className="space-y-2">
            {profile.recurring_patterns?.weaknesses?.length > 0 ? (
              profile.recurring_patterns.weaknesses.map((w, idx) => (
                <div key={idx} className="p-3 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-slate-200 block">{w.label}</span>
                    <span className="text-[10px] text-slate-500">Observed in {w.count} sessions</span>
                  </div>
                  <span className="text-xs font-bold px-2.5 py-1 rounded-xl bg-rose-500/10 text-rose-300 border border-rose-500/20">
                    {w.count}x
                  </span>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-500 italic">No recurring weaknesses logged yet.</p>
            )}
          </div>
        </div>

        {/* Observed Strengths */}
        <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4">
          <h3 className="text-sm font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            Observed Strengths (To Retain)
          </h3>
          <div className="space-y-2">
            {profile.recurring_patterns?.strengths?.length > 0 ? (
              profile.recurring_patterns.strengths.map((s, idx) => (
                <div key={idx} className="p-3 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-slate-200 block">{s.label}</span>
                    <span className="text-[10px] text-slate-500">Observed in {s.count} sessions</span>
                  </div>
                  <span className="text-xs font-bold px-2.5 py-1 rounded-xl bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                    {s.count}x
                  </span>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-500 italic">No recurring strengths logged yet.</p>
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
