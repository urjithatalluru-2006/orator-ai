import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { LiveStudio } from './components/LiveStudio';
import { PostSessionDashboard } from './components/PostSessionDashboard';
import { ProfileDashboard } from './components/ProfileDashboard';
import { StoryAndWitLab } from './components/StoryAndWitLab';
import { SettingsModal } from './components/SettingsModal';

export function App() {
  const [activeTab, setActiveTab] = useState('studio'); // 'studio' | 'dashboard' | 'labs' | 'profile'
  const [userProfile, setUserProfile] = useState(() => {
    try {
      const saved = localStorage.getItem('orator_user_profile');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });
  const [latestAnalysis, setLatestAnalysis] = useState(() => {
    try {
      const saved = localStorage.getItem('orator_latest_analysis');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Fetch Profile on Mount
  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const res = await fetch('/api/profile');
      if (res.ok) {
        const data = await res.json();
        setUserProfile(data);
        localStorage.setItem('orator_user_profile', JSON.stringify(data));
      }
    } catch (err) {
      console.warn('Backend server offline or unreachable:', err);
    }
  };

  // Called when LiveStudio ends session and receives deep analysis
  const handleSessionComplete = (analysisData, updatedProfile) => {
    // [CRITERION 13]: The response is stored in application state
    console.log('[ORATOR][STATE] App.jsx stored analysis response in latestAnalysis state & localStorage:', {
      overallScore: analysisData.scores?.overall,
      executiveVerdict: analysisData.executiveVerdict?.slice(0, 80),
      isFallback: !!analysisData.isFallback
    });

    setLatestAnalysis(analysisData);
    try {
      localStorage.setItem('orator_latest_analysis', JSON.stringify(analysisData));
    } catch (e) {}

    if (updatedProfile) {
      setUserProfile(updatedProfile);
      try {
        localStorage.setItem('orator_user_profile', JSON.stringify(updatedProfile));
      } catch (e) {}
    }
    setActiveTab('dashboard');
  };

  // Launch Practice Drill
  const handleLaunchDrill = (drill) => {
    setActiveTab('studio');
  };

  return (
    <div className="min-h-screen bg-[#0a0d14] text-slate-100 flex flex-col font-sans selection:bg-indigo-600 selection:text-white">
      
      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        profile={userProfile}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        
        {activeTab === 'studio' && (
          <LiveStudio
            onSessionComplete={handleSessionComplete}
            userProfile={userProfile}
          />
        )}

        {activeTab === 'dashboard' && (
          <PostSessionDashboard
            analysis={latestAnalysis}
            profile={userProfile}
            onStartNewSession={() => setActiveTab('studio')}
            onLaunchDrill={handleLaunchDrill}
          />
        )}

        {activeTab === 'labs' && (
          <StoryAndWitLab
            onSelectPracticeMode={(mode) => setActiveTab('studio')}
          />
        )}

        {activeTab === 'profile' && (
          <ProfileDashboard
            profile={userProfile}
          />
        )}

      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 py-6 px-4 text-center text-xs text-slate-600">
        <p>ORATOR AI — Real-Time Human Communication & Storytelling Coach • Powered by Google Gemini</p>
      </footer>

      {/* Settings & Privacy Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onClearData={fetchProfile}
      />

    </div>
  );
}

export default App;
