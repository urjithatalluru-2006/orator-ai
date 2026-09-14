import React from 'react';
import { Sparkles, Activity, ShieldCheck, Flame, User, Settings, Video, BookOpen, Smile, Zap } from 'lucide-react';

export function Navbar({ activeTab, setActiveTab, profile, onOpenSettings }) {
  const streak = profile?.streak_days || 1;
  const sessionsCount = profile?.sessions_completed || 0;
  
  // Calculate score ONLY if real sessions exist
  const overallScore = (sessionsCount > 0 && profile?.communication_metrics)
    ? Math.round(Object.values(profile.communication_metrics).reduce((a, b) => a + b, 0) / 6)
    : null;

  return (
    <header className="sticky top-0 z-50 glass-panel border-b border-slate-800/80 px-4 lg:px-8 py-3.5 transition-all">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        
        {/* Brand Logo */}
        <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setActiveTab('studio')}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-indigo-500/25 ring-2 ring-indigo-400/30">
            <Sparkles className="w-5 h-5 text-white animate-pulse-slow" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-white via-slate-100 to-indigo-200 bg-clip-text text-transparent">
                ORATOR<span className="text-indigo-400">.AI</span>
              </span>
              <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                PRO COACH
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">Real-Time Human Communication & Storytelling Coach</p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="hidden md:flex items-center space-x-1 bg-slate-900/80 p-1.5 rounded-2xl border border-slate-800">
          <button
            onClick={() => setActiveTab('studio')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              activeTab === 'studio'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 ring-1 ring-indigo-400/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Video className="w-4 h-4" />
            <span>Live Studio</span>
          </button>

          <button
            onClick={() => setActiveTab('labs')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              activeTab === 'labs'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 ring-1 ring-indigo-400/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Smile className="w-4 h-4" />
            <span>Story & Wit Lab</span>
          </button>

          <button
            onClick={() => setActiveTab('profile')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              activeTab === 'profile'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 ring-1 ring-indigo-400/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <User className="w-4 h-4" />
            <span>Profile & Growth</span>
          </button>
        </nav>

        {/* Stats & Actions */}
        <div className="flex items-center space-x-3">
          
          {/* Overall Rating Badge: Shows '--' if unrated */}
          <div className="hidden sm:flex items-center space-x-2 bg-indigo-950/40 border border-indigo-500/20 px-3 py-1.5 rounded-xl">
            <Activity className="w-4 h-4 text-indigo-400" />
            <div className="text-xs">
              <span className="text-slate-400 font-medium">Orator Score: </span>
              <span className="text-indigo-300 font-bold">
                {overallScore !== null ? `${overallScore}/100` : 'Unrated (--)'}
              </span>
            </div>
          </div>

          {/* Streak Badge */}
          <div className="flex items-center space-x-1.5 bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-xl">
            <Flame className="w-4 h-4 text-amber-400 animate-pulse" />
            <span className="text-xs font-bold text-amber-300">{streak} Day Streak</span>
          </div>

          {/* Settings Toggle Button */}
          <button
            onClick={onOpenSettings}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Settings & Config"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>

      </div>
    </header>
  );
}
