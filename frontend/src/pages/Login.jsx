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
    <div class="min-h-[80vh] flex flex-col justify-center items-center px-4 animate-fade-in">
      <div class="glass max-w-md w-full p-8 rounded-2xl shadow-2xl relative overflow-hidden border border-slate-700/50">
        {/* Accent Glow */}
        <div class="absolute -top-24 -left-24 w-48 h-48 rounded-full bg-indigo-500/20 blur-3xl"></div>
        <div class="absolute -bottom-24 -right-24 w-48 h-48 rounded-full bg-purple-500/20 blur-3xl"></div>

        <div class="flex flex-col items-center mb-8 relative z-10">
          <div class="p-4 bg-indigo-600/20 border border-indigo-500/30 rounded-full text-indigo-400 mb-4 shadow-inner">
            <KeyRound size={32} class="animate-pulse" />
          </div>
          <h1 class="text-3xl font-extrabold text-slate-100 tracking-tight text-center">
            Recall Quiz Creator
          </h1>
          <p class="text-slate-400 text-sm text-center mt-2">
            Enter your passcode to unlock weighted-practice decks.
          </p>
        </div>

        <form onSubmit={handleSubmit} class="space-y-6 relative z-10">
          <div>
            <label class="block text-slate-350 text-sm font-medium mb-2" htmlFor="passcode">
              Passcode
            </label>
            <input
              id="passcode"
              type="password"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              placeholder="••••••••"
              class="w-full bg-slate-900/60 border border-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-slate-100 px-4 py-3 rounded-lg outline-none transition-all duration-200"
              disabled={submitting}
              autoFocus
            />
          </div>

          {error && (
            <div class="text-red-400 text-sm bg-red-950/20 border border-red-900/30 px-4 py-2.5 rounded-lg animate-slide-up">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || !passcode}
            class="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-medium py-3 rounded-lg shadow-lg hover:shadow-indigo-500/10 focus:outline-none transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Verifying...' : 'Unlock Account'}
          </button>
        </form>
      </div>
    </div>
  );
}
