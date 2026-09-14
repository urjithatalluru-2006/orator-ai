import React, { useState } from 'react';
import { Sparkles, Smile, BookOpen, Lightbulb, Zap, ArrowRight, CheckCircle2, Play } from 'lucide-react';

const STORY_STRUCTURES = [
  {
    id: 'problem_struggle_solution',
    title: 'Problem → Struggle → Solution',
    category: 'Business & Leadership',
    description: 'Hook the listener with an undeniable problem, detail the painful struggle, then reveal the transformative solution.',
    example: 'We were losing $50k monthly on server downtime. Every patch failed. Then we rewrote the core routing engine.'
  },
  {
    id: 'curiosity_discovery_realization',
    title: 'Curiosity → Discovery → Realization',
    category: 'Technical & Explanations',
    description: 'Create an unanswered question first, walk through the discovery process, then land a memorable insight.',
    example: 'Why did conversion drop 40% only on Tuesdays? We audited the logs and discovered a hidden scheduled batch script.'
  },
  {
    id: 'setup_tension_payoff',
    title: 'Setup → Tension → Payoff',
    category: 'Public Speaking & Keynotes',
    description: 'Establish baseline expectations, heighten stakes and conflict, then deliver a high-impact conclusion.',
    example: 'I had 30 seconds before the board vote. The slide clicker broke. So I closed the laptop and told them the truth.'
  }
];

const WIT_MECHANICS = [
  {
    id: 'reframing',
    title: 'Dramatic Reframing',
    description: 'Take a mundane or ordinary situation and describe it as if it were a high-stakes dramatic movie event.',
    example: '"My phone battery died" → "My lifeline to modern civilization collapsed at 3%."'
  },
  {
    id: 'unexpected_contrast',
    title: 'Unexpected Contrast',
    description: 'Pair two completely opposing concepts together to create comedic or witty surprise.',
    example: '"He entered the room with the quiet authority of a golden retriever."'
  },
  {
    id: 'understatement',
    title: 'Masterful Understatement',
    description: 'Describe an overwhelming crisis with calm, minimal language to emphasize absurdity.',
    example: '"The server room was on fire, which slightly impacted latency."'
  }
];

export function StoryAndWitLab({ onSelectPracticeMode }) {
  const [activeTab, setActiveTab] = useState('story');
  const [userDraft, setUserDraft] = useState('');
  const [witFeedback, setWitFeedback] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleAnalyzeWit = async () => {
    if (!userDraft.trim()) return;
    setIsAnalyzing(true);
    setWitFeedback(null);

    try {
      const response = await fetch('/api/analyze-wit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sentence: userDraft })
      });

      if (!response.ok) throw new Error(`Server returned ${response.status}`);
      const data = await response.json();

      setWitFeedback({
        original: userDraft,
        wittyReframing: data.wittyReframing || '',
        mechanicUsed: data.mechanicUsed || '',
        coachingInsight: data.coachingInsight || ''
      });
    } catch (err) {
      // Show honest error - no fake feedback
      setWitFeedback({
        original: userDraft,
        wittyReframing: null,
        mechanicUsed: null,
        coachingInsight: `Wit analysis unavailable: ${err.message}. Make sure the backend server is running and try again.`
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-fadeIn">
      
      {/* Header Banner */}
      <div className="glass-panel p-6 rounded-3xl border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-400">
            <Sparkles className="w-4 h-4" />
            <span>SPECIALIZED MASTERY SANDBOX</span>
          </div>
          <h1 className="text-3xl font-black text-white mt-1">STORY & WIT LAB</h1>
          <p className="text-xs text-slate-400 mt-1">
            Master narrative structures and witty reframing mechanics through interactive drills.
          </p>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center gap-2 bg-slate-900/80 p-1.5 rounded-2xl border border-slate-800">
          <button
            onClick={() => setActiveTab('story')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs transition-all ${
              activeTab === 'story'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Story Structures</span>
          </button>
          <button
            onClick={() => setActiveTab('wit')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs transition-all ${
              activeTab === 'wit'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Smile className="w-4 h-4" />
            <span>Wit Mechanics</span>
          </button>
        </div>
      </div>

      {activeTab === 'story' ? (
        /* Story Frameworks Section */
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {STORY_STRUCTURES.map(struct => (
              <div key={struct.id} className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4 flex flex-col justify-between hover:border-indigo-500/40 transition-all">
                <div className="space-y-3">
                  <span className="text-[10px] uppercase font-bold tracking-widest px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                    {struct.category}
                  </span>
                  <h3 className="text-lg font-black text-slate-100">{struct.title}</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">{struct.description}</p>

                  <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 text-xs text-slate-300 italic">
                    <strong>Example:</strong> "{struct.example}"
                  </div>
                </div>

                <button
                  onClick={() => onSelectPracticeMode && onSelectPracticeMode('story_lab')}
                  className="w-full py-3 rounded-2xl bg-slate-900 hover:bg-indigo-600 text-indigo-300 hover:text-white font-bold text-xs border border-slate-800 transition-all flex items-center justify-center gap-2"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Practice This Structure</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* Wit Mechanics & Reframing Workbench */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          <div className="lg:col-span-2 space-y-4">
            <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4">
              <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-amber-400" />
                Interactive Wit & Reframing Workbench
              </h3>
              <p className="text-xs text-slate-400">
                Type an ordinary sentence. The AI coach will explain why it works or demonstrate how to reframe it wittily.
              </p>

              <textarea
                value={userDraft}
                onChange={(e) => setUserDraft(e.target.value)}
                placeholder="e.g. My morning coffee machine leaked all over the kitchen counter..."
                className="w-full h-32 p-4 rounded-2xl bg-slate-950 border border-slate-800 text-sm text-slate-100 outline-none focus:border-indigo-500 font-sans resize-none"
              />

              <button
                onClick={handleAnalyzeWit}
                disabled={isAnalyzing || !userDraft.trim()}
                className="px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                <span>{isAnalyzing ? 'Analyzing Wit Mechanics...' : 'Analyze & Reframe Wittily'}</span>
              </button>
            </div>

            {witFeedback && (
              <div className={`glass-panel p-6 rounded-3xl border animate-fadeIn space-y-3 ${
                witFeedback.wittyReframing
                  ? 'border-amber-500/30 bg-amber-950/10'
                  : 'border-rose-500/30 bg-rose-950/10'
              }`}>
                <span className={`text-xs font-bold uppercase tracking-wider block ${
                  witFeedback.wittyReframing ? 'text-amber-400' : 'text-rose-400'
                }`}>
                  {witFeedback.wittyReframing ? 'Wit Coach Breakdown' : 'Analysis Unavailable'}
                </span>
                {witFeedback.wittyReframing && (
                  <p className="text-sm font-bold text-slate-100">{witFeedback.wittyReframing}</p>
                )}
                {witFeedback.mechanicUsed && (
                  <span className="text-xs px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20 font-bold">
                    Mechanic: {witFeedback.mechanicUsed}
                  </span>
                )}
                <p className="text-xs text-slate-300 leading-relaxed bg-slate-900/80 p-3.5 rounded-2xl border border-slate-800">
                  {witFeedback.coachingInsight}
                </p>
              </div>
            )}
          </div>

          {/* Right Column: Wit Mechanics Reference */}
          <div className="space-y-4">
            <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4">
              <h3 className="text-sm font-bold text-slate-200">Wit Core Mechanics</h3>
              <div className="space-y-3">
                {WIT_MECHANICS.map(m => (
                  <div key={m.id} className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
                    <span className="text-xs font-bold text-amber-300 block">{m.title}</span>
                    <p className="text-[11px] text-slate-400">{m.description}</p>
                    <p className="text-[11px] text-slate-300 italic pt-1">{m.example}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>
      )}

    </div>
  );
}
