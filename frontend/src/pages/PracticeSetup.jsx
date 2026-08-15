import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { filterForMode } from '../lib/weightedPick';
import { HelpCircle, Star, Zap, EyeOff, Shuffle, Loader2 } from 'lucide-react';

const MODES = [
  {
    id: 'quick10',
    name: 'Quick 10',
    description: "Ten questions, weighted toward what you're missing",
    icon: Star,
    iconColor: 'text-amber-400 bg-amber-500/10 border-amber-500/25',
  },
  {
    id: 'focused',
    name: 'Focused Review',
    description: "Only the ones you're still shaky on",
    icon: Zap,
    iconColor: 'text-rose-450 bg-rose-500/10 border-rose-500/25',
  },
  {
    id: 'new',
    name: 'New Only',
    description: "Questions you haven't seen yet",
    icon: EyeOff,
    iconColor: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/25',
  },
  {
    id: 'full_random',
    name: 'Full Random',
    description: "Everything, evenly, no weighting",
    icon: Shuffle,
    iconColor: 'text-slate-400 bg-slate-500/10 border-slate-500/25',
  },
  {
    id: 'drill',
    name: 'Drill (3 min)',
    description: "Race the clock, see how many you land",
    icon: HelpCircle,
    iconColor: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/25',
  },
];

export default function PracticeSetup() {
  const location = useLocation();
  const navigate = useNavigate();

  const [decks, setDecks] = useState([]);
  const [selectedDeckIds, setSelectedDeckIds] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);
  const [selectedMode, setSelectedMode] = useState('quick10');
  
  const [loading, setLoading] = useState(true);
  const [fetchingPool, setFetchingPool] = useState(false);
  const [error, setError] = useState('');

  // 1. Fetch available decks on mount
  useEffect(() => {
    const loadDecks = async () => {
      try {
        setLoading(true);
        const data = await api.get('/decks');
        setDecks(data || []);
        
        // Handle pre-selected deck from Home state
        const preSelectedId = location.state?.preSelectedDeckId;
        if (preSelectedId && data.some(d => d.id === preSelectedId)) {
          setSelectedDeckIds([preSelectedId]);
        } else if (data && data.length > 0) {
          // Default to all selected
          setSelectedDeckIds(data.map(d => d.id));
        }
      } catch (err) {
        console.error(err);
        setError('Failed to fetch decks.');
      } finally {
        setLoading(false);
      }
    };
    loadDecks();
  }, [location.state]);

  // 2. Compute union of tags from selected decks
  const availableTags = React.useMemo(() => {
    const tagsUnion = new Set();
    decks
      .filter(d => selectedDeckIds.includes(d.id))
      .forEach(d => {
        if (d.tags) {
          d.tags.forEach(t => tagsUnion.add(t));
        }
      });
    return Array.from(tagsUnion);
  }, [decks, selectedDeckIds]);

  // Reset tag selection when they disappear from selected decks
  useEffect(() => {
    setSelectedTags(prev => prev.filter(t => availableTags.includes(t)));
  }, [availableTags]);

  const toggleDeck = (id) => {
    setSelectedDeckIds(prev =>
      prev.includes(id)
        ? prev.filter(item => item !== id)
        : [...prev, id]
    );
  };

  const toggleTag = (tag) => {
    setSelectedTags(prev =>
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  const handleStartSession = async () => {
    if (selectedDeckIds.length === 0) {
      setError('Please select at least one deck to practice.');
      return;
    }

    setFetchingPool(true);
    setError('');

    try {
      // Fetch pool for all selected decks
      const questionsPromises = selectedDeckIds.map(deckId =>
        api.get(`/decks/${deckId}/questions?mode=all`)
      );
      const results = await Promise.all(questionsPromises);
      
      // Merge results client-side
      let mergedPool = results.flat();

      // Filter by selected tags if any
      if (selectedTags.length > 0) {
        mergedPool = mergedPool.filter(q =>
          q.tags && q.tags.some(t => selectedTags.includes(t))
        );
      }

      // Filter by mode (focused, new, etc.)
      const finalPool = filterForMode(mergedPool, selectedMode);

      if (finalPool.length === 0) {
        setError('The filtered question pool is empty. Try choosing a different mode or deck.');
        setFetchingPool(false);
        return;
      }

      // Navigate to run practice session
      navigate('/practice/run', {
        state: {
          pool: finalPool,
          mode: selectedMode,
          selectedDeckIds,
        }
      });
    } catch (err) {
      console.error(err);
      setError('Failed to prepare practice pool.');
      setFetchingPool(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 size={40} className="text-blue-500 animate-spin" />
        <span className="text-slate-400 mt-4 font-medium">Loading setup...</span>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 animate-fade-in pb-24">
      <div className="mb-10">
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-slate-100 via-slate-205 to-slate-350 font-display">
          Practice Setup
        </h1>
        <p className="text-slate-400 mt-2 text-xs sm:text-sm">
          Configure your review session limits, focus, and decks.
        </p>
      </div>

      {error && (
        <div className="bg-red-950/20 border border-red-900/30 text-red-400 px-4 py-3 rounded-lg mb-8 animate-slide-up text-xs sm:text-sm">
          {error}
        </div>
      )}

      <div className="space-y-8">
        {/* Decks Selection */}
        <div className="glass p-6 rounded-2xl border border-darkBorder space-y-4">
          <h3 className="text-base sm:text-lg font-bold text-slate-200 font-display">Decks to Include</h3>
          {decks.length === 0 ? (
            <p className="text-slate-400 text-sm">No decks available. Create one first.</p>
          ) : (
            <div className="flex flex-wrap gap-2.5">
              {decks.map(deck => {
                const isSelected = selectedDeckIds.includes(deck.id);
                return (
                  <button
                    key={deck.id}
                    onClick={() => toggleDeck(deck.id)}
                    className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-medium border transition-all duration-200 flex items-center gap-2 ${
                      isSelected
                        ? 'bg-blue-600/10 text-blue-400 border-blue-500/25 shadow-md shadow-blue-950/15'
                        : 'bg-slate-900/40 text-slate-400 border-transparent hover:text-slate-200 hover:bg-slate-850/50'
                    }`}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: deck.color }}
                    ></span>
                    {deck.name}
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-900/80 text-slate-500 font-semibold border border-slate-800">
                      {deck.questionCount}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Tags Selection */}
        {availableTags.length > 0 && (
          <div className="glass p-6 rounded-2xl border border-darkBorder space-y-4 animate-slide-up">
            <h3 className="text-base sm:text-lg font-bold text-slate-200 font-display">
              Filter by Tags <span className="text-xs font-normal text-slate-450 ml-2">(Optional)</span>
            </h3>
            <div className="flex flex-wrap gap-2">
              {availableTags.map(tag => {
                const isSelected = selectedTags.includes(tag);
                return (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all duration-200 ${
                      isSelected
                        ? 'bg-slate-900 text-blue-400 border-blue-500/20'
                        : 'bg-slate-900/30 text-slate-450 border-transparent hover:text-slate-300 hover:bg-slate-850/30'
                    }`}
                  >
                    #{tag}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Mode Selection */}
        <div className="space-y-4">
          <h3 className="text-base sm:text-lg font-bold text-slate-200 font-display">Practice Mode</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {MODES.map(mode => {
              const Icon = mode.icon;
              const isSelected = selectedMode === mode.id;
              return (
                <div
                  key={mode.id}
                  onClick={() => setSelectedMode(mode.id)}
                  className={`glass glass-hover p-5 rounded-2xl cursor-pointer border flex items-start gap-4 transition-all duration-200 ${
                    isSelected
                      ? 'border-blue-500/30 bg-blue-950/5 shadow-md shadow-blue-950/15'
                      : 'border-slate-800/80'
                  }`}
                >
                  <div className={`p-3 rounded-xl border ${mode.iconColor}`}>
                    <Icon size={20} />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-250 text-sm sm:text-base">{mode.name}</h4>
                    <p className="text-slate-400 text-xs mt-1.5 leading-relaxed">
                      {mode.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Start button */}
        <button
          onClick={handleStartSession}
          disabled={fetchingPool || selectedDeckIds.length === 0}
          className="w-full bg-gradient-to-r from-blue-600 to-violet-650 hover:from-blue-550 hover:to-violet-600 text-white font-bold py-4 rounded-2xl shadow-xl transition-all duration-200 disabled:opacity-50 flex justify-center items-center gap-2 text-sm sm:text-base"
        >
          {fetchingPool ? (
            <>
              <Loader2 size={20} className="animate-spin" />
              Preparing Question Pool...
            </>
          ) : (
            'Start Practice Session'
          )}
        </button>
      </div>
    </div>
  );
}
