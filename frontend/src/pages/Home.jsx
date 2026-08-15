import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { Plus, BookOpen, Layers, Flame, Loader2 } from 'lucide-react';

export default function Home() {
  const [decks, setDecks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [newDeckName, setNewDeckName] = useState('');
  const [creatingLoader, setCreatingLoader] = useState(false);
  const navigate = useNavigate();

  const fetchDecks = async () => {
    try {
      setLoading(true);
      const data = await api.get('/decks');
      setDecks(data || []);
    } catch (err) {
      console.error(err);
      setError('Failed to load decks. Please try reloading.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDecks();
  }, []);

  const handleCreateDeck = async (e) => {
    e.preventDefault();
    if (!newDeckName.trim()) return;

    setCreatingLoader(true);
    setError('');
    try {
      const created = await api.post('/decks', { name: newDeckName });
      setDecks([created, ...decks]);
      setNewDeckName('');
      setIsCreating(false);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to create deck.');
    } finally {
      setCreatingLoader(false);
    }
  };

  const getHeatColor = (avgWeight) => {
    if (avgWeight <= 1.5) return 'bg-cyan-400 shadow-cyan-500/50';
    if (avgWeight <= 3.5) return 'bg-amber-400 shadow-amber-500/50';
    return 'bg-rose-500 shadow-rose-600/50';
  };

  const getHeatLabel = (avgWeight) => {
    if (avgWeight <= 1.5) return 'Cool (Mastered)';
    if (avgWeight <= 3.5) return 'Warm (Reviewing)';
    return 'Hot (Struggling)';
  };

  if (loading) {
    return (
      <div class="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 size={40} class="text-indigo-500 animate-spin" />
        <span class="text-slate-400 mt-4 font-medium">Loading decks...</span>
      </div>
    );
  }

  return (
    <div class="max-w-6xl mx-auto px-4 py-8 animate-fade-in">
      {/* Header */}
      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-10">
        <div>
          <h1 class="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-slate-100 to-slate-350 tracking-tight">
            Study Decks
          </h1>
          <p class="text-slate-400 mt-2">
            Practice questions. Shaky concepts resurface automatically.
          </p>
        </div>

        {!isCreating && (
          <button
            onClick={() => setIsCreating(true)}
            class="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-5 py-2.5 rounded-lg shadow-lg hover:shadow-indigo-500/25 transition-all duration-200"
          >
            <Plus size={18} />
            Create Deck
          </button>
        )}
      </div>

      {error && (
        <div class="bg-red-950/20 border border-red-900/30 text-red-400 px-4 py-3 rounded-lg mb-8 animate-slide-up">
          {error}
        </div>
      )}

      {/* Inline Create Form */}
      {isCreating && (
        <form onSubmit={handleCreateDeck} class="glass p-6 rounded-xl border border-slate-700/50 mb-8 animate-slide-up">
          <h3 class="text-lg font-semibold text-slate-200 mb-4">New Deck</h3>
          <div class="flex flex-col sm:flex-row gap-4">
            <input
              type="text"
              placeholder="e.g. SQL Performance, React Hooks"
              value={newDeckName}
              onChange={(e) => setNewDeckName(e.target.value)}
              disabled={creatingLoader}
              class="flex-1 bg-slate-900/60 border border-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-slate-100 px-4 py-2.5 rounded-lg outline-none transition-all duration-200"
              autoFocus
            />
            <div class="flex items-center gap-2">
              <button
                type="submit"
                disabled={creatingLoader || !newDeckName.trim()}
                class="bg-indigo-650 hover:bg-indigo-600 text-white px-5 py-2.5 rounded-lg font-medium transition-all duration-200 disabled:opacity-50 flex items-center gap-2"
              >
                {creatingLoader && <Loader2 size={16} class="animate-spin" />}
                Create
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsCreating(false);
                  setNewDeckName('');
                }}
                disabled={creatingLoader}
                class="bg-slate-800 hover:bg-slate-700 text-slate-300 px-5 py-2.5 rounded-lg font-medium transition-all duration-200"
              >
                Cancel
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Empty State */}
      {decks.length === 0 ? (
        <div class="glass p-12 rounded-2xl border border-slate-850 flex flex-col items-center text-center max-w-lg mx-auto mt-12">
          <div class="p-4 bg-slate-800/40 border border-slate-700/30 rounded-full text-slate-500 mb-4">
            <BookOpen size={36} />
          </div>
          <h2 class="text-xl font-bold text-slate-200">No decks found</h2>
          <p class="text-slate-400 mt-2 text-sm leading-relaxed">
            Create your first study deck above, then paste or upload multiple-choice questions to start practice loops.
          </p>
        </div>
      ) : (
        /* Grid of Deck Cards */
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {decks.map((deck) => (
            <div
              key={deck.id}
              onClick={() => navigate('/practice', { state: { preSelectedDeckId: deck.id } })}
              class="glass glass-hover p-6 rounded-2xl shadow-md cursor-pointer group relative overflow-hidden transition-all duration-300 flex flex-col h-full justify-between"
            >
              {/* Color Accent Bar */}
              <div
                class="absolute left-0 top-0 bottom-0 w-1.5 transition-all duration-300 group-hover:w-2"
                style={{ backgroundColor: deck.color }}
              ></div>

              <div class="pl-2">
                <div class="flex justify-between items-start gap-4 mb-4">
                  <h3 class="text-xl font-bold text-slate-100 group-hover:text-indigo-400 transition-colors duration-200 break-words line-clamp-2">
                    {deck.name}
                  </h3>
                  
                  {/* Heat Dot Indicator */}
                  {deck.questionCount > 0 && (
                    <div 
                      class="flex items-center gap-1.5 px-2.5 py-1 bg-slate-900/60 rounded-full border border-slate-800 text-[11px] font-semibold text-slate-400 shadow-sm"
                      title={`Heat: ${getHeatLabel(deck.averageWeight)} (Average weight: ${deck.averageWeight})`}
                    >
                      <span class={`w-2 h-2 rounded-full shadow-lg ${getHeatColor(deck.averageWeight)}`}></span>
                      <Flame size={12} class="text-amber-500/80" />
                    </div>
                  )}
                </div>

                {/* Deck Summary Stats */}
                <div class="flex items-center gap-6 text-slate-400 text-sm mt-auto pt-4">
                  <div class="flex items-center gap-1.5">
                    <Layers size={16} class="text-slate-500" />
                    <span>
                      {deck.questionCount} {deck.questionCount === 1 ? 'question' : 'questions'}
                    </span>
                  </div>
                </div>

                {/* Tag rollups preview */}
                {deck.tags && deck.tags.length > 0 && (
                  <div class="flex flex-wrap gap-1.5 mt-4 pt-3 border-t border-slate-800/40">
                    {deck.tags.slice(0, 3).map((tag, idx) => (
                      <span key={idx} class="bg-slate-850/60 text-slate-450 border border-slate-800/50 px-2 py-0.5 rounded text-[11px] font-medium tracking-wide">
                        #{tag}
                      </span>
                    ))}
                    {deck.tags.length > 3 && (
                      <span class="text-slate-500 text-[11px] font-medium self-center pl-1">
                        +{deck.tags.length - 3} more
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
