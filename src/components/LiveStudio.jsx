import React, { useState, useEffect, useRef } from 'react';
import { 
  Video, Mic, MicOff, VideoOff, Play, Square, Sparkles, AlertCircle, 
  MessageSquare, Volume2, ShieldAlert, Award, Clock, Eye, Activity,
  Users, RefreshCw, Zap, Lightbulb, UserCheck, Flame, RotateCcw
} from 'lucide-react';
import { LocalAudioService } from '../services/localAudio';
import { LocalVisionService } from '../services/localVision';
import { LiveCoachingWSClient } from '../services/wsClient';

// Explicit Session State Machine Constants
const SESSION_STATES = {
  IDLE: 'IDLE',
  INITIALIZING_CAMERA: 'INITIALIZING_CAMERA',
  READY: 'READY',
  LISTENING: 'LISTENING',
  SPEAKING: 'SPEAKING',
  PAUSED: 'PAUSED',
  PROCESSING: 'PROCESSING',
  SESSION_COMPLETE: 'SESSION_COMPLETE',
  ERROR: 'ERROR'
};

const SESSION_MODES = [
  { id: 'free_talk', name: 'Free Talk', icon: MessageSquare, desc: 'Speak naturally, get minimal flow-preserving coaching' },
  { id: 'story_lab', name: 'Story Lab', icon: Sparkles, desc: 'Tell a story; focus on hook, tension, and payoff' },
  { id: 'public_speaking', name: 'Public Speaking', icon: Users, desc: 'Simulate stage or keynote speech delivery' },
  { id: 'conversation', name: 'Conversation', icon: Volume2, desc: '2-way interactive dialogue roleplay' },
  { id: 'rapid_fire', name: 'Rapid Fire', icon: Zap, desc: 'Respond spontaneously in 20 seconds' },
  { id: 'wit_lab', name: 'Wit Lab', icon: Lightbulb, desc: 'Train reframing, unexpected contrast, and timing' },
  { id: 'interview', name: 'Interview', icon: UserCheck, desc: 'Executive or technical behavioral interview practice' },
  { id: 'difficult_audience', name: 'Adversarial Audience', icon: ShieldAlert, desc: 'Skeptical, hostile, or distracted listener simulation' },
  { id: 'explain_something', name: 'Explain Something', icon: Activity, desc: 'Explain complex concepts simply with analogies' },
  { id: 'daily_drill', name: 'Daily Drill', icon: Flame, desc: '5-minute targeted adaptive communication workout' }
];

const ADVERSARIAL_PERSONAS = [
  { id: 'Skeptical Investor', label: 'Skeptical VC Investor', desc: 'Challenges unit economics & demands conciseness' },
  { id: 'Hostile Audience', label: 'Hostile Audience', desc: 'Interrupts, expresses doubt, points out flaws' },
  { id: 'Executive', label: 'Busy Executive', desc: 'Has 30 seconds; demands immediate bottom line' },
  { id: 'Interviewer', label: 'Executive Interviewer', desc: 'Asks sharp follow-up questions' }
];

export function LiveStudio({ onSessionComplete, userProfile }) {
  // Session State Machine
  const [sessionState, setSessionState] = useState(SESSION_STATES.IDLE);
  const [errorMessage, setErrorMessage] = useState('');
  const [selectedMode, setSelectedMode] = useState('free_talk');
  const [selectedPersona, setSelectedPersona] = useState('Skeptical Investor');

  // Media Controls
  const [isMicOn, setIsMicOn] = useState(true);
  const [isVideoOn, setIsVideoOn] = useState(true);

  // Real Captured Session Metrics
  const [transcript, setTranscript] = useState('');
  const [interimText, setInterimText] = useState('');
  const [wpm, setWpm] = useState(0); // Strictly 0 in IDLE/READY
  const [silenceSec, setSilenceSec] = useState(0);
  const [fillerCount, setFillerCount] = useState(0);
  const [gazeRatio, setGazeRatio] = useState(0.85);
  const [postureDelta, setPostureDelta] = useState(0);
  const [gestureActivity, setGestureActivity] = useState(0);

  // HUD Coaching Interventions & Roleplay
  const [activeCue, setActiveCue] = useState(null);
  const [roleplayMessages, setRoleplayMessages] = useState([]);
  const [sessionDuration, setSessionDuration] = useState(0);

  // Element Refs
  const videoRef = useRef(null);

  // Service Refs
  const audioServiceRef = useRef(null);
  const visionServiceRef = useRef(null);
  const wsClientRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const durationTimerRef = useRef(null);

  // Cleanup media tracks safely
  const stopMediaTracks = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => {
        try { track.stop(); } catch (e) {}
      });
      mediaStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopMediaTracks();
      if (durationTimerRef.current) clearInterval(durationTimerRef.current);
      if (visionServiceRef.current) visionServiceRef.current.stop();
      if (audioServiceRef.current) audioServiceRef.current.stopListening();
      if (wsClientRef.current) wsClientRef.current.disconnect();
    };
  }, []);

  // Initialize Camera Stream
  const initCameraStream = async () => {
    setSessionState(SESSION_STATES.INITIALIZING_CAMERA);
    setErrorMessage('');
    stopMediaTracks();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        },
        audio: false // Audio is initialized separately by LocalAudioService
      });

      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      // Initialize Vision Service with Offscreen Canvas (NO ghost overlay)
      visionServiceRef.current = new LocalVisionService(
        videoRef.current,
        (metrics) => {
          setGazeRatio(metrics.gazeRatio);
          setPostureDelta(metrics.postureDelta);
          setGestureActivity(metrics.gestureActivity);

          if (wsClientRef.current && wsClientRef.current.isConnected) {
            wsClientRef.current.sendVisualMetrics(metrics);
          }
        }
      );
      visionServiceRef.current.start();

      setSessionState(SESSION_STATES.READY);
    } catch (err) {
      console.error('Camera initialization error:', err);
      setErrorMessage(`Camera error: ${err.message || 'Permission denied or device in use.'}`);
      setSessionState(SESSION_STATES.ERROR);
    }
  };

  // Start Active Coaching Session
  const handleStartSession = async () => {
    setTranscript('');
    setInterimText('');
    setWpm(0);
    setSilenceSec(0);
    setFillerCount(0);
    setRoleplayMessages([]);
    setActiveCue(null);
    setSessionDuration(0);
    setErrorMessage('');

    // 1. Initialize Camera if not already running
    if (!mediaStreamRef.current) {
      await initCameraStream();
    }

    // 2. Connect WebSocket to Server
    wsClientRef.current = new LiveCoachingWSClient((data) => {
      if (data.type === 'LIVE_CUE') {
        setActiveCue({
          cue: data.cue,
          category: data.category,
          timestamp: Date.now()
        });
        setTimeout(() => {
          setActiveCue(prev => (prev?.timestamp === data.timestamp ? null : prev));
        }, 4000);
      } else if (data.type === 'ROLEPLAY_RESPONSE') {
        setRoleplayMessages(prev => [...prev, {
          sender: data.persona || 'AI Coach',
          text: data.response,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }]);

        if ('speechSynthesis' in window) {
          const utterance = new SpeechSynthesisUtterance(data.response);
          utterance.rate = 1.0;
          window.speechSynthesis.speak(utterance);
        }
      }
    });

    wsClientRef.current.connect();
    wsClientRef.current.initSession(selectedMode, selectedPersona);

    // 3. Initialize Audio & Voice Activity Detection (VAD)
    try {
      audioServiceRef.current = new LocalAudioService(
        (fullText, interim) => {
          setTranscript(fullText);
          setInterimText(interim);
        },
        (metrics) => {
          setWpm(metrics.wpm);
          setSilenceSec(metrics.silenceSec);
          setFillerCount(metrics.totalFillers);

          if (wsClientRef.current && wsClientRef.current.isConnected && metrics.lastChunk) {
            wsClientRef.current.sendSpeechChunk({
              transcript: metrics.lastChunk,
              wpm: metrics.wpm,
              silenceSec: metrics.silenceSec,
              fillersInChunk: metrics.newFillers,
              storyMomentum: selectedMode === 'story_lab' ? 'high' : 'normal'
            });
          }
        },
        (vState) => {
          if (vState === 'SPEAKING') {
            setSessionState(SESSION_STATES.SPEAKING);
          } else if (vState === 'PAUSED') {
            setSessionState(SESSION_STATES.PAUSED);
          } else if (vState === 'ERROR') {
            setErrorMessage('Microphone error or permission denied.');
            setSessionState(SESSION_STATES.ERROR);
          }
        }
      );
      await audioServiceRef.current.startListening();
      setSessionState(SESSION_STATES.LISTENING);
    } catch (err) {
      setErrorMessage(`Microphone error: ${err.message || 'Could not start audio recording.'}`);
      setSessionState(SESSION_STATES.ERROR);
      return;
    }

    // 4. Session Duration Timer
    if (durationTimerRef.current) clearInterval(durationTimerRef.current);
    durationTimerRef.current = setInterval(() => {
      setSessionDuration(prev => prev + 1);
    }, 1000);
  };

  // End Session & Trigger Post-Session Analysis
  const handleEndSession = async () => {
    setSessionState(SESSION_STATES.PROCESSING);

    if (durationTimerRef.current) clearInterval(durationTimerRef.current);
    if (visionServiceRef.current) visionServiceRef.current.stop();
    if (audioServiceRef.current) audioServiceRef.current.stopListening();
    if (wsClientRef.current) wsClientRef.current.disconnect();

    stopMediaTracks();

    const durationSec = Math.max(5, sessionDuration);
    const sessionPayload = {
      transcript: transcript.trim(),
      durationSec,
      mode: selectedMode,
      wpmAvg: wpm,
      fillerCount,
      silenceSecondsTotal: silenceSec,
      visualMetricsSummary: {
        gazeRatioAvg: gazeRatio,
        postureDeltaAvg: postureDelta,
        gestureActivityAvg: gestureActivity
      },
      userObjective: SESSION_MODES.find(m => m.id === selectedMode)?.name || 'General Speaking'
    };

    try {
      const response = await fetch('/api/analyze-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sessionPayload)
      });

      const result = await response.json();
      setSessionState(SESSION_STATES.SESSION_COMPLETE);
      if (onSessionComplete && result.analysis) {
        onSessionComplete(result.analysis, result.profile || userProfile);
      }
    } catch (err) {
      console.error('Failed post-session analysis route:', err);
      setErrorMessage('Post-session analysis server request failed.');
      setSessionState(SESSION_STATES.ERROR);
    }
  };

  const handleSendRoleplayUtterance = (e) => {
    e.preventDefault();
    if (!transcript.trim()) return;

    setRoleplayMessages(prev => [...prev, {
      sender: 'You',
      text: transcript.slice(-150),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }]);

    if (wsClientRef.current && wsClientRef.current.isConnected) {
      wsClientRef.current.sendRoleplayPrompt(transcript.slice(-200), selectedPersona);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const isSessionActive = [
    SESSION_STATES.LISTENING,
    SESSION_STATES.SPEAKING,
    SESSION_STATES.PAUSED
  ].includes(sessionState);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      
      {/* Session Header Controls & State Machine Indicator */}
      <div className="glass-panel p-6 rounded-3xl border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4 shadow-xl">
        <div>
          <h1 className="text-2xl font-black bg-gradient-to-r from-white via-slate-100 to-indigo-300 bg-clip-text text-transparent flex items-center gap-3">
            <span>LIVE COACHING STUDIO</span>
            
            {/* Explicit State Machine Badge */}
            <span className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full border ${
              sessionState === SESSION_STATES.SPEAKING
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 animate-pulse'
                : sessionState === SESSION_STATES.PAUSED
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                : sessionState === SESSION_STATES.LISTENING
                ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                : sessionState === SESSION_STATES.PROCESSING
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 animate-spin'
                : sessionState === SESSION_STATES.ERROR
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}>
              <span className={`w-2 h-2 rounded-full ${
                sessionState === SESSION_STATES.SPEAKING ? 'bg-emerald-400' :
                sessionState === SESSION_STATES.PAUSED ? 'bg-amber-400' :
                sessionState === SESSION_STATES.LISTENING ? 'bg-indigo-400' : 'bg-slate-500'
              }`}></span>
              STATUS: {sessionState}
            </span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Real Voice Activity Detection (VAD) • Authoritative Live Webcam Stream
          </p>
        </div>

        {/* Start / Stop Button */}
        <div className="flex items-center gap-3">
          {!isSessionActive ? (
            <button
              onClick={handleStartSession}
              disabled={sessionState === SESSION_STATES.PROCESSING}
              className="flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-bold shadow-lg shadow-indigo-600/30 ring-2 ring-indigo-400/40 transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
            >
              <Play className="w-5 h-5 fill-current" />
              <span>START COACHING SESSION</span>
            </button>
          ) : (
            <button
              onClick={handleEndSession}
              className="flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-bold shadow-lg shadow-rose-600/30 ring-2 ring-rose-400/40 transition-all hover:scale-105 active:scale-95"
            >
              <Square className="w-5 h-5 fill-current" />
              <span>END & ANALYZE SESSION ({formatTime(sessionDuration)})</span>
            </button>
          )}
        </div>
      </div>

      {/* Error Alert Display */}
      {sessionState === SESSION_STATES.ERROR && (
        <div className="glass-panel p-4 rounded-2xl border border-rose-500/40 bg-rose-950/20 text-rose-200 text-sm flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
            <span>{errorMessage || 'Session encountered an unexpected error.'}</span>
          </div>
          <button
            onClick={initCameraStream}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-500 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Retry Camera</span>
          </button>
        </div>
      )}

      {/* Mode Selection Pills */}
      {!isSessionActive && (
        <div className="glass-card p-4 rounded-2xl border border-slate-800/80">
          <div className="flex items-center justify-between mb-3 px-1">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Select Session Mode</span>
            <span className="text-xs text-indigo-400 font-semibold">10 Adaptive Scenarios Available</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
            {SESSION_MODES.map(mode => {
              const Icon = mode.icon;
              const isSelected = selectedMode === mode.id;
              return (
                <button
                  key={mode.id}
                  onClick={() => setSelectedMode(mode.id)}
                  className={`p-3 rounded-xl text-left transition-all border ${
                    isSelected
                      ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-md shadow-indigo-500/10'
                      : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Icon className={`w-4 h-4 ${isSelected ? 'text-indigo-400' : 'text-slate-500'}`} />
                    <span className="text-xs font-bold truncate">{mode.name}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 line-clamp-1">{mode.desc}</p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Studio Viewport */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Authoritative Camera Feed (2 cols wide) */}
        <div className="lg:col-span-2 space-y-4">
          
          {/* Video Container */}
          <div className="relative aspect-video rounded-3xl overflow-hidden glass-panel border border-slate-800 bg-slate-950 shadow-2xl group">
            
            {/* EXACTLY ONE Authoritative Live Video Element */}
            <video
              ref={videoRef}
              muted
              playsInline
              className={`w-full h-full object-cover ${!isVideoOn ? 'hidden' : ''}`}
            />

            {!isVideoOn && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950 text-slate-600">
                <VideoOff className="w-16 h-16 mb-2 stroke-[1.5]" />
                <span className="text-sm font-medium">Camera Preview Disabled</span>
              </div>
            )}

            {/* REAL-TIME FLOW-PRESERVING HUD CUE TOAST */}
            {activeCue && (
              <div className="absolute top-6 left-1/2 -translate-x-1/2 z-30 animate-bounce">
                <div className="px-6 py-3 rounded-2xl bg-indigo-600/90 text-white font-extrabold text-lg shadow-2xl shadow-indigo-500/50 backdrop-blur-xl border border-indigo-300/40 flex items-center gap-3">
                  <Sparkles className="w-6 h-6 text-amber-300 animate-spin" />
                  <span>{activeCue.cue}</span>
                </div>
              </div>
            )}

            {/* Real-time Overlay Badges */}
            <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
              {/* WPM Badge: Shows '--' or real WPM */}
              <div className="bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-700/60 text-xs font-bold flex items-center gap-2">
                <Activity className="w-3.5 h-3.5 text-indigo-400" />
                <span>{wpm > 0 ? `${wpm} WPM` : '-- WPM'}</span>
                <span className="text-slate-500">|</span>
                <span className={wpm > 195 ? 'text-amber-400' : wpm > 0 ? 'text-emerald-400' : 'text-slate-400'}>
                  {wpm > 195 ? 'Fast' : wpm > 0 ? 'Active' : 'Silent'}
                </span>
              </div>

              <div className="bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-700/60 text-xs font-bold flex items-center gap-2">
                <Eye className="w-3.5 h-3.5 text-cyan-400" />
                <span>Gaze Focus: {Math.round(gazeRatio * 100)}%</span>
              </div>
            </div>

            <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
              {/* NO FAKE LIVE SCORE: Displays real speech filler count */}
              <div className="bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-700/60 text-xs font-bold text-slate-300">
                <span>Fillers: </span>
                <span className={fillerCount > 5 ? 'text-rose-400 font-extrabold' : 'text-slate-200'}>
                  {fillerCount}
                </span>
              </div>
            </div>

            {/* Bottom Controls Bar */}
            <div className="absolute bottom-4 left-4 right-4 z-20 flex items-center justify-between">
              <div className="flex items-center gap-2 bg-slate-900/80 backdrop-blur-md p-1.5 rounded-2xl border border-slate-800">
                <button
                  onClick={() => setIsMicOn(!isMicOn)}
                  className={`p-2.5 rounded-xl text-xs font-bold transition-all ${
                    isMicOn ? 'bg-slate-800 text-slate-200' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                  }`}
                  title={isMicOn ? "Mute Microphone" : "Unmute Microphone"}
                >
                  {isMicOn ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                </button>
                <button
                  onClick={async () => {
                    if (isVideoOn) {
                      stopMediaTracks();
                      setIsVideoOn(false);
                    } else {
                      setIsVideoOn(true);
                      await initCameraStream();
                    }
                  }}
                  className={`p-2.5 rounded-xl text-xs font-bold transition-all ${
                    isVideoOn ? 'bg-slate-800 text-slate-200' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                  }`}
                  title={isVideoOn ? "Disable Camera" : "Enable Camera"}
                >
                  {isVideoOn ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
                </button>
              </div>

              <div className="text-xs font-semibold text-slate-400 bg-slate-900/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-800">
                Mode: <span className="text-indigo-300 font-bold">{SESSION_MODES.find(m => m.id === selectedMode)?.name}</span>
              </div>
            </div>

          </div>

          {/* Live Audio & Speech Stream Box */}
          <div className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <Mic className="w-4 h-4 text-indigo-400" />
                Live Speech Stream & Transcription
              </span>
              <span className="text-xs text-slate-500">{transcript.split(/\s+/).filter(Boolean).length} Words Captured</span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800/80 min-h-[100px] max-h-[140px] overflow-y-auto text-sm text-slate-200 leading-relaxed font-sans">
              {transcript ? (
                <>
                  <span>{transcript}</span>
                  <span className="text-indigo-400 font-medium italic animate-pulse"> {interimText}</span>
                </>
              ) : (
                <span className="text-slate-600 italic">
                  {isSessionActive ? "Listening for speech... (Start speaking naturally)" : "Click 'START COACHING SESSION' above to begin..."}
                </span>
              )}
            </div>
          </div>

        </div>

        {/* Right Column: Conversational Roleplay / Adversarial Simulation Panel */}
        <div className="space-y-4">
          <div className="glass-panel p-5 rounded-3xl border border-slate-800 flex flex-col h-[520px]">
            
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-indigo-400" />
                  <span>2-Way Roleplay & Adversarial Agent</span>
                </h3>
                <p className="text-[11px] text-slate-400">Interactive conversational challenge engine</p>
              </div>

              {/* Persona Selector */}
              <select
                value={selectedPersona}
                onChange={(e) => setSelectedPersona(e.target.value)}
                disabled={isSessionActive}
                className="bg-slate-900 border border-slate-700 text-xs font-semibold text-indigo-300 rounded-xl px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-indigo-500"
              >
                {ADVERSARIAL_PERSONAS.map(p => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
            </div>

            {/* Roleplay Chat History Stream */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3 my-3">
              {roleplayMessages.length === 0 ? (
                <div className="text-center py-12 text-slate-500 space-y-2">
                  <UserCheck className="w-8 h-8 mx-auto text-slate-600" />
                  <p className="text-xs">Selected Persona: <strong className="text-indigo-400">{selectedPersona}</strong></p>
                  <p className="text-[11px] text-slate-600">
                    During conversation mode, the AI will challenge assumptions and ask spontaneous follow-ups.
                  </p>
                </div>
              ) : (
                roleplayMessages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-2xl text-xs space-y-1 ${
                      msg.sender === 'You'
                        ? 'bg-indigo-600/20 border border-indigo-500/30 text-indigo-100 ml-6'
                        : 'bg-slate-900 border border-slate-800 text-slate-200 mr-6'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold">
                      <span>{msg.sender}</span>
                      <span>{msg.timestamp}</span>
                    </div>
                    <p className="leading-relaxed">{msg.text}</p>
                  </div>
                ))
              )}
            </div>

            {/* Quick Action Button to prompt AI response */}
            {isSessionActive && (
              <form onSubmit={handleSendRoleplayUtterance} className="pt-2 border-t border-slate-800 flex gap-2">
                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md shadow-indigo-600/20 transition-all flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Prompt Persona Challenge</span>
                </button>
              </form>
            )}

          </div>
        </div>

      </div>

    </div>
  );
}
