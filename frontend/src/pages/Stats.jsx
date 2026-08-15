import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
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
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 size={40} className="text-blue-500 animate-spin" />
        <span className="text-slate-400 mt-4 font-medium">Loading stats...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 animate-fade-in pb-24">
        <div className="bg-red-950/20 border border-red-900/30 text-red-400 px-4 py-3 rounded-lg flex items-center gap-2 text-sm">
          <AlertTriangle size={18} className="flex-shrink-0" />
          <span>{error}</span>
        </div>
      </div>
    );
  }

  const accuracyPercent = overview ? Math.round(overview.overallAccuracy * 100) : 0;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 animate-fade-in space-y-8 pb-24">
      {/* Header */}
      <div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-slate-100 via-slate-205 to-slate-350 tracking-tight font-display">
          Performance Dashboard
        </h1>
        <p className="text-slate-400 mt-2 text-xs sm:text-sm">
          Monitor your study streak, deck accuracy, and flags.
        </p>
      </div>

      {/* Summary Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {/* Total Questions */}
        <div className="glass p-5 rounded-2xl border border-darkBorder flex items-center gap-4">
          <div className="p-3.5 bg-blue-600/10 border border-blue-500/20 rounded-xl text-blue-455">
            <Layers size={24} />
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-100 font-display">{overview?.totalQuestions || 0}</div>
            <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mt-1">Questions Pool</div>
          </div>
        </div>

        {/* Overall Accuracy */}
        <div className="glass p-5 rounded-2xl border border-darkBorder flex items-center gap-4">
          <div className="p-3.5 bg-emerald-600/10 border border-emerald-500/20 rounded-xl text-emerald-450">
            <Award size={24} />
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-100 font-display">{accuracyPercent}%</div>
            <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mt-1">Overall Accuracy</div>
          </div>
        </div>

        {/* Current Streak */}
        <div className="glass p-5 rounded-2xl border border-darkBorder flex items-center gap-4">
          <div className="p-3.5 bg-amber-555/10 border border-amber-550/20 rounded-xl text-amber-500">
            <Flame size={24} className={currentStreak > 0 ? 'animate-pulse' : ''} />
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-100 font-display">{currentStreak} {currentStreak === 1 ? 'day' : 'days'}</div>
            <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mt-1">Practice Streak</div>
          </div>
        </div>

        {/* Active Leeches */}
        <div className="glass p-5 rounded-2xl border border-darkBorder flex items-center gap-4">
          <div className="p-3.5 bg-rose-600/10 border border-rose-500/20 rounded-xl text-rose-450">
            <AlertTriangle size={24} />
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-100 font-display">{overview?.leeches?.length || 0}</div>
            <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mt-1">Leech Cards</div>
          </div>
        </div>
      </div>

      {/* Analytics Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Trend Accuracy Line Chart */}
        <div className="glass p-5 sm:p-6 rounded-3xl border border-darkBorder space-y-4">
          <h3 className="text-base sm:text-lg font-bold text-slate-200 flex items-center gap-2 font-display">
            <TrendingUp size={18} className="text-blue-400" />
            Accuracy (Last 14 Days)
          </h3>
          <div className="h-64 sm:h-80 w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={last14DaysData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(59,130,246,0.03)" />
                <XAxis dataKey="dateLabel" stroke="#475569" fontSize={9} tickLine={false} />
                <YAxis stroke="#475569" fontSize={9} domain={[0, 1]} tickFormatter={(v) => `${Math.round(v * 100)}%`} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0c0f1d', border: '1px solid rgba(59,130,246,0.15)', borderRadius: '12px' }}
                  labelStyle={{ color: '#f1f5f9', fontWeight: 'bold' }}
                  formatter={(value) => [`${Math.round(value * 100)}%`, 'Accuracy']}
                />
                <Line type="monotone" dataKey="accuracy" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 3, strokeWidth: 1, fill: '#05070f' }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Weakest Tags Bar Chart */}
        <div className="glass p-5 sm:p-6 rounded-3xl border border-darkBorder space-y-4">
          <h3 className="text-base sm:text-lg font-bold text-slate-200 flex items-center gap-2 font-display">
            <AlertTriangle size={18} className="text-amber-450" />
            Weakest Tags (Lowest Accuracy)
          </h3>
          {formattedWeakestTags.length === 0 ? (
            <div className="h-64 sm:h-80 flex items-center justify-center text-slate-500 text-xs sm:text-sm">
              Practice more questions to populate tag metrics.
            </div>
          ) : (
            <div className="h-64 sm:h-80 w-full pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={formattedWeakestTags} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(59,130,246,0.03)" />
                  <XAxis dataKey="tag" stroke="#475569" fontSize={9} tickLine={false} />
                  <YAxis stroke="#475569" fontSize={9} domain={[0, 100]} tickFormatter={(v) => `${v}%`} tickLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0c0f1d', border: '1px solid rgba(59,130,246,0.15)', borderRadius: '12px' }}
                    formatter={(value, name, props) => [`${value}% (${props.payload.attempts} attempts)`, 'Accuracy']}
                  />
                  <Bar dataKey="accuracy" fill="#e11d48" radius={[4, 4, 0, 0]} maxBarSize={35} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Leech Relearning List */}
      <div className="glass p-5 sm:p-6 rounded-3xl border border-darkBorder space-y-4">
        <h3 className="text-base sm:text-lg font-bold text-slate-200 flex items-center gap-2 font-display">
          <AlertTriangle size={18} className="text-rose-500" />
          Needs Re-learning (Leeched Questions)
        </h3>
        <p className="text-slate-455 text-xs mt-1">
          These questions have been answered wrong consecutively 4+ times. Click a row to start a focused practice session.
        </p>

        {overview?.leeches?.length === 0 ? (
          <div className="p-8 text-center text-slate-505 text-xs sm:text-sm border border-dashed border-slate-800 rounded-2xl">
            Clean slate! No questions flagged as leeches right now.
          </div>
        ) : (
          <div className="overflow-hidden border border-slate-850 rounded-2xl bg-slate-900/10">
            <div className="max-h-80 overflow-y-auto no-scrollbar divide-y divide-slate-850">
              {overview?.leeches.map((leech) => (
                <div
                  key={leech.id}
                  onClick={() => navigate('/practice', { state: { preSelectedDeckId: leech.deckId || leech.deckSlug } })}
                  className="p-4 hover:bg-slate-900/30 cursor-pointer flex flex-col sm:flex-row justify-between sm:items-center gap-3 sm:gap-6 transition-all duration-150"
                >
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <p className="text-xs sm:text-sm font-semibold text-slate-200 truncate break-words">
                      {leech.question}
                    </p>
                    <span className="inline-block bg-slate-950 border border-slate-850 px-2 py-0.5 rounded text-[10px] text-slate-500 font-bold uppercase font-mono tracking-wider">
                      Deck: {leech.deckSlug}
                    </span>
                  </div>
                  <div className="text-left sm:text-right flex-shrink-0">
                    <span className="inline-block bg-rose-950/20 text-rose-455 border border-rose-900/25 px-2.5 py-1 rounded-lg text-xs font-semibold">
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
