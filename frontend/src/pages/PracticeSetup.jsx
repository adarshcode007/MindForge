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
      <div class="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 size={40} class="text-indigo-500 animate-spin" />
        <span class="text-slate-400 mt-4 font-medium">Loading setup...</span>
      </div>
    );
  }

  return (
    <div class="max-w-4xl mx-auto px-4 py-8 animate-fade-in">
      <div class="mb-10">
        <h1 class="text-4xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-slate-100 to-slate-350">
          Practice Setup
        </h1>
        <p class="text-slate-400 mt-2">
          Configure your review session limits, focus, and decks.
        </p>
      </div>

      {error && (
        <div class="bg-red-950/20 border border-red-900/30 text-red-400 px-4 py-3 rounded-lg mb-8 animate-slide-up">
          {error}
        </div>
      )}

      <div class="space-y-8">
        {/* Decks Selection */}
        <div class="glass p-6 rounded-2xl border border-slate-700/50 space-y-4">
          <h3 class="text-lg font-bold text-slate-200">Decks to Include</h3>
          {decks.length === 0 ? (
            <p class="text-slate-400 text-sm">No decks available. Create one first.</p>
          ) : (
            <div class="flex flex-wrap gap-2.5">
              {decks.map(deck => {
                const isSelected = selectedDeckIds.includes(deck.id);
                return (
                  <button
                    key={deck.id}
                    onClick={() => toggleDeck(deck.id)}
                    class={`px-4 py-2 rounded-xl text-sm font-medium border transition-all duration-200 flex items-center gap-2 ${
                      isSelected
                        ? 'bg-indigo-650/30 text-indigo-300 border-indigo-500/40 shadow-inner'
                        : 'bg-slate-900/40 text-slate-400 border-slate-800 hover:text-slate-200 hover:bg-slate-850/50'
                    }`}
                  >
                    <span
                      class="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: deck.color }}
                    ></span>
                    {deck.name}
                    <span class="text-[10px] px-1.5 py-0.5 rounded bg-slate-900/80 text-slate-500 font-semibold border border-slate-800">
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
          <div class="glass p-6 rounded-2xl border border-slate-700/50 space-y-4 animate-slide-up">
            <h3 class="text-lg font-bold text-slate-200">
              Filter by Tags <span class="text-xs font-normal text-slate-450 ml-2">(Optional)</span>
            </h3>
            <div class="flex flex-wrap gap-2">
              {availableTags.map(tag => {
                const isSelected = selectedTags.includes(tag);
                return (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    class={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all duration-205 ${
                      isSelected
                        ? 'bg-slate-800 text-indigo-300 border-indigo-500/30'
                        : 'bg-slate-900/30 text-slate-450 border-slate-800/80 hover:text-slate-300 hover:bg-slate-850/30'
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
        <div class="space-y-4">
          <h3 class="text-lg font-bold text-slate-200">Practice Mode</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            {MODES.map(mode => {
              const Icon = mode.icon;
              const isSelected = selectedMode === mode.id;
              return (
                <div
                  key={mode.id}
                  onClick={() => setSelectedMode(mode.id)}
                  class={`glass glass-hover p-5 rounded-2xl cursor-pointer border flex items-start gap-4 transition-all duration-250 ${
                    isSelected
                      ? 'border-indigo-550/40 bg-indigo-950/10 shadow-lg shadow-indigo-950/20'
                      : 'border-slate-800/80'
                  }`}
                >
                  <div class={`p-3 rounded-xl border ${mode.iconColor}`}>
                    <Icon size={20} />
                  </div>
                  <div>
                    <h4 class="font-bold text-slate-200">{mode.name}</h4>
                    <p class="text-slate-400 text-xs mt-1.5 leading-relaxed">
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
          class="w-full bg-gradient-to-r from-indigo-600 to-purple-650 hover:from-indigo-550 hover:to-purple-550 text-white font-bold py-4 rounded-2xl shadow-xl transition-all duration-200 disabled:opacity-50 flex justify-center items-center gap-2"
        >
          {fetchingPool ? (
            <>
              <Loader2 size={20} class="animate-spin" />
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
