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
      link.download = `mindforge-backup-${today}.json`;
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
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 size={40} className="text-blue-500 animate-spin" />
        <span className="text-slate-400 mt-4 font-medium">Loading settings...</span>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 animate-fade-in space-y-8 pb-24">
      {/* Header */}
      <div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-slate-100 via-slate-205 to-slate-350 tracking-tight font-display">
          System Settings
        </h1>
        <p className="text-slate-400 mt-2 text-xs sm:text-sm">
          Manage database backups, deck metadata, and user access.
        </p>
      </div>

      {error && (
        <div className="bg-red-950/20 border border-red-900/30 text-red-400 px-4 py-3 rounded-lg mb-8 animate-slide-up flex items-center gap-2 text-xs sm:text-sm">
          <ShieldAlert size={18} className="flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="bg-emerald-950/20 border border-emerald-900/30 text-emerald-450 px-4 py-3 rounded-lg mb-8 animate-slide-up flex items-center gap-2 text-xs sm:text-sm">
          <CheckCircle2 size={18} className="flex-shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Backup and Restore Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
        
        {/* Export Backup panel */}
        <div className="glass p-6 rounded-2xl border border-darkBorder space-y-4">
          <h3 className="text-base sm:text-lg font-bold text-slate-200 flex items-center gap-2 font-display">
            <Download size={18} className="text-blue-400" />
            Export Archive Backup
          </h3>
          <p className="text-slate-455 text-xs leading-relaxed">
            Download a full backup file containing all of your decks, practice logs, question cards, and calculated weights.
          </p>
          <button
            onClick={handleExportBackup}
            disabled={actionLoading === 'export'}
            className="w-full bg-slate-800 hover:bg-slate-750 text-slate-200 font-semibold py-2.5 rounded-xl border border-slate-700 flex justify-center items-center gap-2 transition-all duration-200 text-xs sm:text-sm"
          >
            {actionLoading === 'export' ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Download size={16} />
            )}
            Download JSON Backup
          </button>
        </div>

        {/* Import Backup panel */}
        <div className="glass p-6 rounded-2xl border border-darkBorder space-y-4">
          <h3 className="text-base sm:text-lg font-bold text-slate-200 flex items-center gap-2 font-display">
            <Upload size={18} className="text-blue-400" />
            Import Archive Backup
          </h3>
          <p className="text-slate-450 text-[11px] leading-relaxed block">
            Paste database JSON content. <strong className="text-red-405 font-bold">WARNING:</strong> This will replace all current data.
          </p>
          <textarea
            value={backupText}
            onChange={(e) => setBackupText(e.target.value)}
            placeholder='Paste exported JSON string here...'
            rows={3}
            className="w-full bg-slate-900/60 border border-slate-700 text-slate-100 p-3 rounded-lg outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-mono text-[10px] sm:text-xs leading-relaxed transition-all duration-200 resize-none no-scrollbar"
          />
          <button
            onClick={() => setConfirmImportBackup(true)}
            disabled={actionLoading === 'import' || !backupText.trim()}
            className="w-full bg-gradient-to-r from-blue-600 to-violet-650 hover:from-blue-550 hover:to-violet-600 text-white font-semibold py-2.5 rounded-xl shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-sm"
          >
            Restore JSON Backup
          </button>
        </div>
      </div>

      {/* Decks Management */}
      <div className="glass p-6 rounded-2xl border border-darkBorder space-y-6">
        <h3 className="text-base sm:text-lg font-bold text-slate-200 font-display">Deck Configuration</h3>
        
        {decks.length === 0 ? (
          <p className="text-slate-450 text-sm">No decks found. Go create one!</p>
        ) : (
          <div className="overflow-hidden border border-slate-850 rounded-xl divide-y divide-slate-855 bg-slate-900/10">
            {decks.map(deck => (
              <div key={deck.id} className="p-4 flex flex-col sm:flex-row justify-between sm:items-center gap-4 transition-all hover:bg-slate-900/30">
                <div className="flex items-center gap-3">
                  <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: deck.color }}></span>
                  <div className="min-w-0">
                    <h4 className="font-bold text-slate-200 truncate text-sm sm:text-base">{deck.name}</h4>
                    <p className="text-slate-500 text-xs mt-0.5">{deck.questionCount} questions</p>
                  </div>
                </div>

                <div className="flex className-center gap-2">
                  {/* Reset stats */}
                  <button
                    onClick={() => setConfirmResetDeck(deck)}
                    disabled={actionLoading === deck.id}
                    className="p-2 bg-slate-800 hover:bg-slate-750 text-slate-350 hover:text-blue-400 border border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all"
                    title="Reset weight statistics for this deck"
                  >
                    <RefreshCw size={14} className={actionLoading === deck.id ? 'animate-spin' : ''} />
                    Reset Weights
                  </button>

                  {/* Delete deck */}
                  <button
                    onClick={() => setConfirmDeleteDeck(deck)}
                    disabled={actionLoading === deck.id}
                    className="p-2 bg-rose-955/20 hover:bg-rose-900/20 text-rose-400 border border-rose-900/30 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all"
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
      <div className="flex justify-end pt-4">
        <button
          onClick={logout}
          className="bg-rose-950/20 border border-rose-900/30 text-rose-400 px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-rose-900/20 hover:border-rose-500/40 transition-all duration-200 shadow-md text-xs sm:text-sm"
        >
          <LogOut size={16} />
          Sign Out of Archive
        </button>
      </div>

      {/* ----------------------------------------------------
          MODALS / CONFIRMATION BOXES
          ---------------------------------------------------- */}
      
      {/* Confirm Import Backup */}
      {confirmImportBackup && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass max-w-md w-full p-6 rounded-2xl border border-rose-500/20 shadow-2xl space-y-6 animate-scale-in">
            <div className="flex items-center gap-3 text-rose-455 border-b border-slate-850 pb-4">
              <ShieldAlert size={24} />
              <h3 className="text-lg font-bold font-display">Confirm Overwrite</h3>
            </div>
            <p className="text-slate-355 text-xs sm:text-sm leading-relaxed">
              This action is destructive and irreversible. It will wipe out all existing decks, question cards, stats, and historical logs, replacing them with the backup data.
            </p>
            <div className="flex gap-4 border-t border-slate-850 pt-4">
              <button
                onClick={handleImportBackup}
                className="flex-1 bg-rose-600 hover:bg-rose-550 text-white font-semibold py-2.5 rounded-lg text-xs sm:text-sm transition-all"
              >
                Overwrite & Restore
              </button>
              <button
                onClick={() => setConfirmImportBackup(false)}
                className="flex-1 bg-slate-800 hover:bg-slate-750 text-slate-300 font-semibold py-2.5 rounded-lg text-xs sm:text-sm transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Reset Stats */}
      {confirmResetDeck && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass max-w-md w-full p-6 rounded-2xl border border-darkBorder shadow-2xl space-y-6 animate-scale-in">
            <div className="flex items-center gap-3 text-slate-200 border-b border-slate-855 pb-4">
              <RefreshCw size={20} className="text-blue-405 animate-spin" />
              <h3 className="text-lg font-bold font-display">Reset Weights</h3>
            </div>
            <p className="text-slate-355 text-xs sm:text-sm leading-relaxed">
              Are you sure you want to reset all learning statistics (weights, times wrong, etc.) back to default values for the deck <strong className="text-blue-400">"{confirmResetDeck.name}"</strong>?
            </p>
            <div className="flex gap-4 border-t border-slate-855 pt-4">
              <button
                onClick={() => handleResetDeckStats(confirmResetDeck.id)}
                className="flex-1 bg-blue-600 hover:bg-blue-555 text-white font-semibold py-2.5 rounded-lg text-xs sm:text-sm transition-all"
              >
                Reset Weights
              </button>
              <button
                onClick={() => setConfirmResetDeck(null)}
                className="flex-1 bg-slate-800 hover:bg-slate-750 text-slate-350 font-semibold py-2.5 rounded-lg text-xs sm:text-sm transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete Deck */}
      {confirmDeleteDeck && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass max-w-md w-full p-6 rounded-2xl border border-rose-500/20 shadow-2xl space-y-6 animate-scale-in">
            <div className="flex items-center gap-3 text-rose-455 border-b border-slate-850 pb-4">
              <Trash2 size={20} />
              <h3 className="text-lg font-bold font-display">Delete Deck</h3>
            </div>
            <p className="text-slate-355 text-xs sm:text-sm leading-relaxed">
              Are you sure you want to delete the deck <strong className="text-blue-400">"{confirmDeleteDeck.name}"</strong> and all of its question cards? This operation is permanent.
            </p>
            <div className="flex gap-4 border-t border-slate-855 pt-4">
              <button
                onClick={() => handleDeleteDeck(confirmDeleteDeck.id)}
                className="flex-1 bg-rose-600 hover:bg-rose-555 text-white font-semibold py-2.5 rounded-lg text-xs sm:text-sm transition-all"
              >
                Delete Deck
              </button>
              <button
                onClick={() => setConfirmDeleteDeck(null)}
                className="flex-1 bg-slate-800 hover:bg-slate-750 text-slate-350 font-semibold py-2.5 rounded-lg text-xs sm:text-sm transition-all"
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
