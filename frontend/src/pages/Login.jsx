import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { KeyRound } from 'lucide-react';

export default function Login() {
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { isAuthenticated, login } = useAuth();
  const navigate = useNavigate();

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!passcode) return;
    
    setError('');
    setSubmitting(true);

    try {
      const res = await api.post('/auth/login', { passcode });
      login(res.token);
      navigate('/');
    } catch (err) {
      console.error(err);
      setError(err.message || 'Invalid passcode. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex flex-col justify-center items-center px-4 animate-fade-in">
      <div className="glass max-w-md w-full p-8 rounded-2xl shadow-2xl relative overflow-hidden border border-darkBorder">
        {/* Accent Glow */}
        <div className="absolute -top-24 -left-24 w-48 h-48 rounded-full bg-blue-500/10 blur-3xl"></div>
        <div className="absolute -bottom-24 -right-24 w-48 h-48 rounded-full bg-violet-500/10 blur-3xl"></div>

        <div className="flex flex-col items-center mb-8 relative z-10">
          <div className="p-4 bg-blue-600/15 border border-blue-500/25 rounded-full text-blue-400 mb-4 shadow-inner">
            <KeyRound size={32} className="animate-pulse" />
          </div>
          <h1 className="text-3xl font-extrabold text-slate-100 tracking-tight text-center font-display">
            MindForge Archive
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm text-center mt-2">
            Enter your passcode to unlock weighted-practice decks.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 relative z-10">
          <div>
            <label className="block text-slate-350 text-xs font-medium uppercase tracking-wide mb-2" htmlFor="passcode">
              Passcode
            </label>
            <input
              id="passcode"
              type="password"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-slate-900/60 border border-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-slate-100 px-4 py-3 rounded-lg outline-none transition-all duration-200 text-sm"
              disabled={submitting}
              autoFocus
            />
          </div>

          {error && (
            <div className="text-red-400 text-xs bg-red-950/20 border border-red-900/30 px-4 py-2.5 rounded-lg animate-slide-up leading-relaxed">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || !passcode}
            className="w-full bg-gradient-to-r from-blue-600 to-violet-650 hover:from-blue-550 hover:to-violet-600 text-white font-medium py-3 rounded-lg shadow-lg shadow-blue-950/20 focus:outline-none transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            {submitting ? 'Verifying...' : 'Unlock Archive'}
          </button>
        </form>
      </div>
    </div>
  );
}
