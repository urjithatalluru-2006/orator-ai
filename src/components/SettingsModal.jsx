import React, { useState, useEffect } from 'react';
import { X, Settings, ShieldCheck, Server, Database, Trash2, CheckCircle2, AlertTriangle, Key } from 'lucide-react';

export function SettingsModal({ isOpen, onClose, onClearData }) {
  const [serverHealth, setServerHealth] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      checkServerHealth();
    }
  }, [isOpen]);

  const checkServerHealth = async () => {
    setIsChecking(true);
    try {
      const res = await fetch('/api/health');
      const data = await res.json();
      setServerHealth(data);
    } catch (err) {
      setServerHealth({ status: 'offline', error: err.message });
    }
    setIsChecking(false);
  };

  const handleTestGemini = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/test-gemini');
      const data = await res.json();
      setTestResult(data);
    } catch (err) {
      setTestResult({ status: 'AUTH_ERROR', error: err.message });
    }
    setIsTesting(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="glass-panel max-w-lg w-full rounded-3xl border border-slate-800 p-6 space-y-6 shadow-2xl relative">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white">ORATOR AI CONFIG & CREDENTIALS</h2>
              <p className="text-xs text-slate-400 font-sans">Netlify serverless & Gemini API status</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Server & Model Status */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs font-bold uppercase text-slate-400">
            <span className="flex items-center gap-1.5">
              <Server className="w-4 h-4 text-indigo-400" /> API Environment Status
            </span>
            <button onClick={checkServerHealth} className="text-indigo-400 hover:underline text-[11px]">
              {isChecking ? 'Checking...' : 'Refresh'}
            </button>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 font-medium">API Endpoint Status:</span>
              <span className={`font-bold flex items-center gap-1 ${
                serverHealth?.status === 'online' ? 'text-emerald-400' : 'text-rose-400'
              }`}>
                <span className={`w-2 h-2 rounded-full ${
                  serverHealth?.status === 'online' ? 'bg-emerald-400' : 'bg-rose-400'
                }`}></span>
                {serverHealth?.status === 'online' ? 'Online (Netlify /api)' : 'Offline'}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-400 font-medium">Gemini Key Configured:</span>
              <span className={`font-bold ${serverHealth?.apiKeyConfigured ? 'text-emerald-400' : 'text-amber-400'}`}>
                {serverHealth?.apiKeyConfigured ? 'YES (Environment Variables)' : 'NO (Missing GEMINI_API_KEY)'}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-400 font-medium">Fast Analysis Model:</span>
              <span className="font-bold text-indigo-300">
                {serverHealth?.models?.FAST_ANALYSIS || 'gemini-3.6-flash'}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-400 font-medium">Deep Reasoning Model:</span>
              <span className="font-bold text-indigo-300">
                {serverHealth?.models?.DEEP_REASONING || 'gemini-3.6-flash'}
              </span>
            </div>
          </div>
        </div>

        {/* Test Gemini API Button */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
              <Key className="w-4 h-4 text-indigo-400" /> Test Gemini Authentication
            </span>
            <button
              onClick={handleTestGemini}
              disabled={isTesting}
              className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-sm transition-all"
            >
              {isTesting ? 'Testing...' : 'Test Connection'}
            </button>
          </div>

          {testResult && (
            <div className={`p-3 rounded-xl text-xs space-y-1 ${
              testResult.status === 'AUTHENTICATED' 
                ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-200' 
                : 'bg-amber-500/10 border border-amber-500/30 text-amber-200'
            }`}>
              <p className="font-bold flex items-center gap-1.5">
                {testResult.status === 'AUTHENTICATED' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                )}
                Status: {testResult.status}
              </p>
              <p className="text-[11px] leading-relaxed">
                {testResult.message || testResult.error || testResult.response}
              </p>
            </div>
          )}
        </div>

        {/* Security & Privacy Statement */}
        <div className="p-4 rounded-2xl bg-indigo-950/20 border border-indigo-500/20 space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-indigo-300">
            <ShieldCheck className="w-4 h-4 text-indigo-400" />
            <span>Zero Browser API Key Exposure</span>
          </div>
          <p className="text-[11px] text-slate-300 leading-relaxed">
            Gemini credentials are kept strictly in server-side Environment Variables. No permanent secret keys are ever exposed to the client bundle or browser environment.
          </p>
        </div>

        {/* Clear Data & Reset */}
        <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
          <button
            onClick={() => {
              if (window.confirm("Clear all local profile & session history data?")) {
                localStorage.clear();
                if (onClearData) onClearData();
                onClose();
              }
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-300 font-bold text-xs transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            <span>Reset Local Data</span>
          </button>

          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md transition-colors"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
}
