import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Download, Upload, RefreshCw, Trash2, LogOut, ShieldAlert, Loader2, CheckCircle2 } from 'lucide-react';

export default function Settings() {
  const { logout } = useAuth();
  const [decks, setDecks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [backupText, setBackupText] = useState('');
  
  // Action loaders & states
  const [actionLoading, setActionLoading] = useState(null); // 'export' | 'import' | deckId
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Modals / Confirmations
  const [confirmDeleteDeck, setConfirmDeleteDeck] = useState(null); // deck object
  const [confirmResetDeck, setConfirmResetDeck] = useState(null); // deck object
  const [confirmImportBackup, setConfirmImportBackup] = useState(false);

  const fetchDecks = async () => {
    try {
      setLoading(true);
      const data = await api.get('/decks');
      setDecks(data || []);
    } catch (err) {
      console.error(err);
      setError('Failed to fetch decks.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDecks();
  }, []);

  const handleExportBackup = async () => {
    setError('');
    setSuccess('');
    setActionLoading('export');
    try {
      const backupData = await api.get('/export');
      const jsonString = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const today = new Date().toISOString().split('T')[0];
      const link = document.createElement('a');
      link.href = url;
      link.download = `recall-backup-${today}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setSuccess('Backup exported successfully.');
    } catch (err) {
      console.error(err);
      setError('Failed to export backup data.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleImportBackup = async () => {
    if (!backupText.trim()) return;
    setError('');
    setSuccess('');
    setActionLoading('import');

    let parsed;
    try {
      parsed = JSON.parse(backupText);
      if (!parsed.decks || !parsed.questions || !parsed.dailyLogs) {
        throw new Error('Missing decks, questions, or dailyLogs arrays.');
      }
    } catch (err) {
      setError(`Invalid JSON backup format: ${err.message}`);
      setActionLoading(null);
      setConfirmImportBackup(false);
      return;
    }

    try {
      const res = await api.post('/import-backup', parsed);
      setSuccess(`Backup restored successfully! Loaded ${res.questionCount} questions.`);
      setBackupText('');
      setConfirmImportBackup(false);
      fetchDecks();
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to restore backup.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleResetDeckStats = async (deckId) => {
    setError('');
    setSuccess('');
    setActionLoading(deckId);
    try {
      const res = await api.post(`/decks/${deckId}/reset-stats`);
      setSuccess(`Reset stats for ${res.resetCount} questions in deck.`);
      setConfirmResetDeck(null);
      fetchDecks();
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to reset deck stats.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteDeck = async (deckId) => {
    setError('');
    setSuccess('');
    setActionLoading(deckId);
    try {
      await api.delete(`/decks/${deckId}`);
      setSuccess('Deck deleted successfully.');
      setConfirmDeleteDeck(null);
      fetchDecks();
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to delete deck.');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div class="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 size={40} class="text-indigo-500 animate-spin" />
        <span class="text-slate-400 mt-4 font-medium">Loading settings...</span>
      </div>
    );
  }

  return (
    <div class="max-w-4xl mx-auto px-4 py-8 animate-fade-in space-y-8">
      {/* Header */}
      <div>
        <h1 class="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-slate-100 to-slate-350 tracking-tight">
          System Settings
        </h1>
        <p class="text-slate-400 mt-2">
          Manage database backups, deck metadata, and user access.
        </p>
      </div>

      {error && (
        <div class="bg-red-950/20 border border-red-900/30 text-red-400 px-4 py-3 rounded-lg animate-slide-up flex items-center gap-2">
          <ShieldAlert size={18} />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div class="bg-emerald-950/20 border border-emerald-900/30 text-emerald-400 px-4 py-3 rounded-lg animate-slide-up flex items-center gap-2">
          <CheckCircle2 size={18} />
          <span>{success}</span>
        </div>
      )}

      {/* Backup and Restore Row */}
      <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Export Backup panel */}
        <div class="glass p-6 rounded-2xl border border-slate-700/50 space-y-4">
          <h3 class="text-lg font-bold text-slate-200 flex items-center gap-2">
            <Download size={18} class="text-indigo-400" />
            Export Database Backup
          </h3>
          <p class="text-slate-400 text-xs leading-relaxed">
            Download a full backup file containing all of your decks, practice logs, question cards, and calculated weights.
          </p>
          <button
            onClick={handleExportBackup}
            disabled={actionLoading === 'export'}
            class="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold py-2.5 rounded-xl border border-slate-750 flex justify-center items-center gap-2 transition-all duration-200"
          >
            {actionLoading === 'export' ? (
              <Loader2 size={16} class="animate-spin" />
            ) : (
              <Download size={16} />
            )}
            Download JSON Backup
          </button>
        </div>

        {/* Import Backup panel */}
        <div class="glass p-6 rounded-2xl border border-slate-700/50 space-y-4">
          <h3 class="text-lg font-bold text-slate-200 flex items-center gap-2">
            <Upload size={18} class="text-indigo-400" />
            Import Database Backup
          </h3>
          <p class="text-slate-450 text-[11px] leading-relaxed block">
            Paste database JSON content. <strong class="text-red-400">WARNING:</strong> This will replace all current data.
          </p>
          <textarea
            value={backupText}
            onChange={(e) => setBackupText(e.target.value)}
            placeholder='Paste exported JSON string here...'
            rows={3}
            class="w-full bg-slate-900/60 border border-slate-700 text-slate-100 p-3 rounded-lg outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-mono text-xs leading-relaxed transition-all duration-200 resize-none no-scrollbar"
          />
          <button
            onClick={() => setConfirmImportBackup(true)}
            disabled={actionLoading === 'import' || !backupText.trim()}
            class="w-full bg-gradient-to-r from-indigo-650 to-purple-650 hover:from-indigo-600 hover:to-purple-600 text-white font-semibold py-2.5 rounded-xl shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Restore JSON Backup
          </button>
        </div>
      </div>

      {/* Decks Management */}
      <div class="glass p-6 rounded-2xl border border-slate-700/50 space-y-6">
        <h3 class="text-lg font-bold text-slate-200">Deck Configuration</h3>
        
        {decks.length === 0 ? (
          <p class="text-slate-400 text-sm">No decks found. Go create one!</p>
        ) : (
          <div class="overflow-hidden border border-slate-800 rounded-xl divide-y divide-slate-800 bg-slate-900/20">
            {decks.map(deck => (
              <div key={deck.id} class="p-4 flex flex-col sm:flex-row justify-between sm:items-center gap-4 transition-all hover:bg-slate-800/10">
                <div class="flex items-center gap-3">
                  <span class="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: deck.color }}></span>
                  <div class="min-w-0">
                    <h4 class="font-bold text-slate-200 truncate">{deck.name}</h4>
                    <p class="text-slate-500 text-xs mt-0.5">{deck.questionCount} questions</p>
                  </div>
                </div>

                <div class="flex items-center gap-2">
                  {/* Reset stats */}
                  <button
                    onClick={() => setConfirmResetDeck(deck)}
                    disabled={actionLoading === deck.id}
                    class="p-2 bg-slate-800 hover:bg-slate-750 text-slate-350 hover:text-indigo-400 border border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all"
                    title="Reset weight statistics for this deck"
                  >
                    <RefreshCw size={14} class={actionLoading === deck.id ? 'animate-spin' : ''} />
                    Reset Weights
                  </button>

                  {/* Delete deck */}
                  <button
                    onClick={() => setConfirmDeleteDeck(deck)}
                    disabled={actionLoading === deck.id}
                    class="p-2 bg-red-950/25 hover:bg-red-900/20 text-red-400 border border-red-900/35 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all"
                    title="Delete deck and its questions permanently"
                  >
                    <Trash2 size={14} />
                    Delete Deck
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Log out section */}
      <div class="flex justify-end pt-4">
        <button
          onClick={logout}
          class="bg-red-950/20 border border-red-900/30 text-red-400 px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-red-900/20 hover:border-red-500/40 transition-all duration-200 shadow-md"
        >
          <LogOut size={16} />
          Sign Out of Account
        </button>
      </div>

      {/* ----------------------------------------------------
          MODALS / CONFIRMATION BOXES
          ---------------------------------------------------- */}
      
      {/* Confirm Import Backup */}
      {confirmImportBackup && (
        <div class="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div class="glass max-w-md w-full p-6 rounded-2xl border border-red-500/20 shadow-2xl space-y-6 animate-scale-in">
            <div class="flex items-center gap-3 text-red-400 border-b border-slate-800 pb-4">
              <ShieldAlert size={24} />
              <h3 class="text-lg font-bold">Confirm Database Overwrite</h3>
            </div>
            <p class="text-slate-350 text-sm leading-relaxed">
              This action is destructive and irreversible. It will wipe out all existing decks, question cards, stats, and historical logs, replacing them with the backup data.
            </p>
            <div class="flex gap-4 border-t border-slate-800 pt-4">
              <button
                onClick={handleImportBackup}
                class="flex-1 bg-red-650 hover:bg-red-600 text-white font-semibold py-2.5 rounded-lg text-sm transition-all"
              >
                Yes, Overwrite & Restore
              </button>
              <button
                onClick={() => setConfirmImportBackup(false)}
                class="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold py-2.5 rounded-lg text-sm transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Reset Stats */}
      {confirmResetDeck && (
        <div class="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div class="glass max-w-md w-full p-6 rounded-2xl border border-slate-800 shadow-2xl space-y-6">
            <div class="flex items-center gap-3 text-slate-200 border-b border-slate-850 pb-4">
              <RefreshCw size={20} class="text-indigo-400" />
              <h3 class="text-lg font-bold">Reset Weights</h3>
            </div>
            <p class="text-slate-350 text-sm leading-relaxed">
              Are you sure you want to reset all learning statistics (weights, times wrong, etc.) back to default values for the deck <strong class="text-indigo-350">"{confirmResetDeck.name}"</strong>?
            </p>
            <div class="flex gap-4 border-t border-slate-800 pt-4">
              <button
                onClick={() => handleResetDeckStats(confirmResetDeck.id)}
                class="flex-1 bg-indigo-650 hover:bg-indigo-600 text-white font-semibold py-2.5 rounded-lg text-sm transition-all"
              >
                Reset Weights
              </button>
              <button
                onClick={() => setConfirmResetDeck(null)}
                class="flex-1 bg-slate-850 hover:bg-slate-750 text-slate-300 font-semibold py-2.5 rounded-lg text-sm transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete Deck */}
      {confirmDeleteDeck && (
        <div class="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div class="glass max-w-md w-full p-6 rounded-2xl border border-red-500/20 shadow-2xl space-y-6">
            <div class="flex items-center gap-3 text-red-400 border-b border-slate-800 pb-4">
              <Trash2 size={20} />
              <h3 class="text-lg font-bold">Delete Deck</h3>
            </div>
            <p class="text-slate-350 text-sm leading-relaxed">
              Are you sure you want to delete the deck <strong class="text-indigo-350">"{confirmDeleteDeck.name}"</strong> and all of its question cards? This operation is permanent.
            </p>
            <div class="flex gap-4 border-t border-slate-800 pt-4">
              <button
                onClick={() => handleDeleteDeck(confirmDeleteDeck.id)}
                class="flex-1 bg-red-650 hover:bg-red-600 text-white font-semibold py-2.5 rounded-lg text-sm transition-all"
              >
                Delete Deck
              </button>
              <button
                onClick={() => setConfirmDeleteDeck(null)}
                class="flex-1 bg-slate-800 hover:bg-slate-750 text-slate-300 font-semibold py-2.5 rounded-lg text-sm transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
