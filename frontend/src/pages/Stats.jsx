import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { Award, Flame, AlertTriangle, Layers, TrendingUp, Loader2 } from 'lucide-react';

export default function Stats() {
  const navigate = useNavigate();
  const [overview, setOverview] = useState(null);
  const [trendData, setTrendData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchStatsData = async () => {
      try {
        setLoading(true);
        // Fetch overview and last 30 days trend
        const [overviewRes, trendRes] = await Promise.all([
          api.get('/stats/overview'),
          api.get('/stats/trend?days=30')
        ]);
        setOverview(overviewRes);
        setTrendData(trendRes || []);
      } catch (err) {
        console.error(err);
        setError('Failed to fetch stats dashboard data.');
      } finally {
        setLoading(false);
      }
    };
    fetchStatsData();
  }, []);

  // Compute streak client-side from 30 days trend data
  const currentStreak = React.useMemo(() => {
    if (trendData.length === 0) return 0;
    
    let streak = 0;
    // Iterate from today (last element) backward
    for (let i = trendData.length - 1; i >= 0; i--) {
      const day = trendData[i];
      if (day.shown > 0) {
        streak++;
      } else {
        // If today has 0 activity, we check if yesterday had activity.
        // If yes, streak continues (user has until midnight to practice).
        // If no, streak is broken.
        if (i === trendData.length - 1) {
          continue; // Skip checking today's break, go to yesterday
        }
        break;
      }
    }
    return streak;
  }, [trendData]);

  // Extract last 14 days for accuracy trend chart
  const last14DaysData = React.useMemo(() => {
    return trendData.slice(-14).map(d => ({
      ...d,
      // Format date label (e.g. "Aug 15")
      dateLabel: new Date(d.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' })
    }));
  }, [trendData]);

  const formattedWeakestTags = React.useMemo(() => {
    if (!overview?.weakestTags) return [];
    return overview.weakestTags.map(t => ({
      tag: `#${t.tag}`,
      accuracy: Math.round(t.accuracy * 100),
      attempts: t.attempts
    }));
  }, [overview]);

  if (loading) {
    return (
      <div class="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 size={40} class="text-indigo-500 animate-spin" />
        <span class="text-slate-400 mt-4 font-medium">Loading stats...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div class="max-w-4xl mx-auto px-4 py-8 animate-fade-in">
        <div class="bg-red-950/20 border border-red-900/30 text-red-400 px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertTriangle size={18} />
          <span>{error}</span>
        </div>
      </div>
    );
  }

  const accuracyPercent = overview ? Math.round(overview.overallAccuracy * 100) : 0;

  return (
    <div class="max-w-6xl mx-auto px-4 py-8 animate-fade-in space-y-8">
      {/* Header */}
      <div>
        <h1 class="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-slate-100 to-slate-350 tracking-tight">
          Performance Dashboard
        </h1>
        <p class="text-slate-400 mt-2">
          Monitor your study streak, deck accuracy, and flags.
        </p>
      </div>

      {/* Summary Cards Row */}
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Questions */}
        <div class="glass p-6 rounded-2xl border border-slate-700/50 flex items-center gap-4">
          <div class="p-3.5 bg-indigo-650/20 border border-indigo-500/25 rounded-xl text-indigo-400">
            <Layers size={24} />
          </div>
          <div>
            <div class="text-3xl font-extrabold text-slate-100">{overview?.totalQuestions || 0}</div>
            <div class="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-1">Questions Pool</div>
          </div>
        </div>

        {/* Overall Accuracy */}
        <div class="glass p-6 rounded-2xl border border-slate-700/50 flex items-center gap-4">
          <div class="p-3.5 bg-emerald-650/20 border border-emerald-500/25 rounded-xl text-emerald-400">
            <Award size={24} />
          </div>
          <div>
            <div class="text-3xl font-extrabold text-slate-100">{accuracyPercent}%</div>
            <div class="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-1">Overall Accuracy</div>
          </div>
        </div>

        {/* Current Streak */}
        <div class="glass p-6 rounded-2xl border border-slate-700/50 flex items-center gap-4">
          <div class="p-3.5 bg-amber-650/20 border border-amber-500/25 rounded-xl text-amber-500">
            <Flame size={24} class={currentStreak > 0 ? 'animate-pulse' : ''} />
          </div>
          <div>
            <div class="text-3xl font-extrabold text-slate-100">{currentStreak} {currentStreak === 1 ? 'day' : 'days'}</div>
            <div class="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-1">Practice Streak</div>
          </div>
        </div>

        {/* Active Leeches */}
        <div class="glass p-6 rounded-2xl border border-slate-700/50 flex items-center gap-4">
          <div class="p-3.5 bg-rose-650/20 border border-rose-500/25 rounded-xl text-rose-450">
            <AlertTriangle size={24} />
          </div>
          <div>
            <div class="text-3xl font-extrabold text-slate-100">{overview?.leeches?.length || 0}</div>
            <div class="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-1">Leech Cards</div>
          </div>
        </div>
      </div>

      {/* Analytics Charts Grid */}
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Trend Accuracy Line Chart */}
        <div class="glass p-6 rounded-3xl border border-slate-700/50 space-y-4">
          <h3 class="text-lg font-bold text-slate-200 flex items-center gap-2">
            <TrendingUp size={18} class="text-indigo-400" />
            Accuracy (Last 14 Days)
          </h3>
          <div class="h-80 w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={last14DaysData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="dateLabel" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} domain={[0, 1]} tickFormatter={(v) => `${Math.round(v * 100)}%`} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                  labelStyle={{ color: '#f1f5f9', fontWeight: 'bold' }}
                  formatter={(value) => [`${Math.round(value * 100)}%`, 'Accuracy']}
                />
                <Line type="monotone" dataKey="accuracy" stroke="#6366f1" strokeWidth={3} dot={{ r: 4, strokeWidth: 1 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Weakest Tags Bar Chart */}
        <div class="glass p-6 rounded-3xl border border-slate-700/50 space-y-4">
          <h3 class="text-lg font-bold text-slate-200 flex items-center gap-2">
            <AlertTriangle size={18} class="text-amber-400" />
            Weakest Tags (Lowest Accuracy)
          </h3>
          {formattedWeakestTags.length === 0 ? (
            <div class="h-80 flex items-center justify-center text-slate-400 text-sm">
              Practice more questions to populate tag metrics.
            </div>
          ) : (
            <div class="h-80 w-full pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={formattedWeakestTags} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="tag" stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={11} domain={[0, 100]} tickFormatter={(v) => `${v}%`} tickLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                    formatter={(value, name, props) => [`${value}% (${props.payload.attempts} attempts)`, 'Accuracy']}
                  />
                  <Bar dataKey="accuracy" fill="#ef4444" radius={[6, 6, 0, 0]} maxBarSize={45} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Leech Relearning List */}
      <div class="glass p-6 rounded-3xl border border-slate-700/50 space-y-4">
        <h3 class="text-lg font-bold text-slate-200 flex items-center gap-2">
          <AlertTriangle size={18} class="text-rose-500" />
          Needs Re-learning (Leeched Questions)
        </h3>
        <p class="text-slate-400 text-xs mt-1">
          These questions have been answered wrong consecutively 4+ times. Click a row to start a focused practice session.
        </p>

        {overview?.leeches?.length === 0 ? (
          <div class="p-8 text-center text-slate-400 text-sm border border-dashed border-slate-800 rounded-2xl">
            Clean slate! No questions flagged as leeches right now.
          </div>
        ) : (
          <div class="overflow-hidden border border-slate-800 rounded-2xl bg-slate-900/20">
            <div class="max-h-80 overflow-y-auto no-scrollbar divide-y divide-slate-800">
              {overview?.leeches.map((leech) => (
                <div
                  key={leech.id}
                  onClick={() => navigate('/practice', { state: { preSelectedDeckId: leech.deckId || leech.deckSlug } })}
                  class="p-4 hover:bg-slate-800/40 cursor-pointer flex justify-between items-center gap-6 transition-all duration-150"
                >
                  <div class="space-y-1.5 flex-1 min-w-0">
                    <p class="text-sm font-semibold text-slate-250 truncate break-words">
                      {leech.question}
                    </p>
                    <span class="inline-block bg-slate-900 border border-slate-800 px-2 py-0.5 rounded text-[10px] text-slate-400 font-bold uppercase">
                      Deck: {leech.deckSlug}
                    </span>
                  </div>
                  <div class="text-right flex-shrink-0">
                    <span class="inline-block bg-rose-950/20 text-rose-400 border border-rose-900/30 px-2.5 py-1 rounded-lg text-xs font-semibold">
                      {leech.consecutiveWrong} wrong in a row
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
