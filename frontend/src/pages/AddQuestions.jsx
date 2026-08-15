import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { ClipboardList, Play, CheckCircle2, AlertCircle, FileText, Loader2, ArrowRight, Upload } from 'lucide-react';

const EXPECTED_FORMAT_EXAMPLE = `[
  {
    "question": "What is the result of typeof null in JavaScript?",
    "options": ["\\"object\\"", "\\"null\\"", "\\"undefined\\"", "\\"function\\""],
    "answer": 0,
    "description": "In JavaScript, typeof null is officially evaluated to 'object' due to a historical design quirk.",
    "difficulty": "easy",
    "tags": ["javascript", "types"]
  }
]`;

export default function AddQuestions() {
  const [decks, setDecks] = useState([]);
  const [selectedDeckId, setSelectedDeckId] = useState('');
  const [isCreatingDeck, setIsCreatingDeck] = useState(false);
  const [newDeckName, setNewDeckName] = useState('');
  
  const [jsonInput, setJsonInput] = useState('');
  const [validating, setValidating] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Preview state
  const [previewData, setPreviewData] = useState(null);

  const fetchDecks = async () => {
    try {
      const data = await api.get('/decks');
      setDecks(data || []);
      if (data && data.length > 0) {
        setSelectedDeckId(data[0].id);
      }
    } catch (err) {
      console.error(err);
      setError('Failed to fetch decks.');
    }
  };

  useEffect(() => {
    fetchDecks();
  }, []);

  const handleCreateDeckDirectly = async (e) => {
    e.preventDefault();
    if (!newDeckName.trim()) return;
    setError('');
    try {
      const created = await api.post('/decks', { name: newDeckName });
      setDecks([created, ...decks]);
      setSelectedDeckId(created.id);
      setIsCreatingDeck(false);
      setNewDeckName('');
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to create new deck.');
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');
    setSuccess('');
    
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target.result;
        // Verify it parses as JSON to give early warning
        JSON.parse(text);
        setJsonInput(text);
        setSuccess(`File "${file.name}" loaded successfully! Click "Validate & Preview" to proceed.`);
      } catch (err) {
        setError(`Failed to parse "${file.name}" as JSON: ${err.message}`);
      }
    };
    reader.onerror = () => {
      setError(`Failed to read file "${file.name}".`);
    };
    reader.readAsText(file);
  };

  const handleValidatePreview = async () => {
    if (!selectedDeckId) {
      setError('Please select a deck first.');
      return;
    }
    if (!jsonInput.trim()) {
      setError('Please paste JSON data first.');
      return;
    }

    setValidating(true);
    setError('');
    setSuccess('');
    setPreviewData(null);

    let parsedQuestions;
    try {
      parsedQuestions = JSON.parse(jsonInput);
      if (!Array.isArray(parsedQuestions)) {
        throw new Error('Root must be an array of questions.');
      }
    } catch (err) {
      setError(`Invalid JSON structure: ${err.message}`);
      setValidating(false);
      return;
    }

    try {
      const result = await api.post(`/decks/${selectedDeckId}/import/preview`, {
        questions: parsedQuestions,
      });
      setPreviewData(result);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Validation failed on the server.');
    } finally {
      setValidating(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!previewData || !previewData.previewId) return;

    setConfirming(true);
    setError('');
    setSuccess('');

    try {
      const result = await api.post(`/decks/${selectedDeckId}/import/confirm`, {
        previewId: previewData.previewId,
      });

      setSuccess(`Import completed! Imported: ${result.imported}, Updated: ${result.updated}, Skipped: ${result.skipped}.`);
      setJsonInput('');
      setPreviewData(null);
      
      // Update local decks count
      fetchDecks();
    } catch (err) {
      console.error(err);
      setError(err.message || 'Import confirmation failed.');
    } finally {
      setConfirming(false);
    }
  };

  const canConfirm = previewData && (previewData.summary.new > 0 || previewData.summary.changed > 0);

  return (
    <div class="max-w-5xl mx-auto px-4 py-8 animate-fade-in">
      <div class="mb-8">
        <h1 class="text-4xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-slate-100 to-slate-350">
          Add Questions
        </h1>
        <p class="text-slate-400 mt-2">
          Paste MCQ questions in JSON format to populate or update your deck.
        </p>
      </div>

      {error && (
        <div class="bg-red-950/20 border border-red-900/30 text-red-400 px-4 py-3 rounded-lg mb-8 animate-slide-up flex items-center gap-2">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div class="bg-emerald-950/20 border border-emerald-900/30 text-emerald-400 px-4 py-3 rounded-lg mb-8 animate-slide-up flex items-center gap-2">
          <CheckCircle2 size={18} />
          <span>{success}</span>
        </div>
      )}

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Input Form Column */}
        <div class="lg:col-span-2 space-y-6">
          <div class="glass p-6 rounded-2xl border border-slate-700/50 space-y-6">
            
            {/* Deck Selector & Inline Create */}
            <div class="space-y-3">
              <label class="block text-slate-300 text-sm font-medium">Select Target Deck</label>
              {!isCreatingDeck ? (
                <div class="flex gap-3">
                  <select
                    value={selectedDeckId}
                    onChange={(e) => {
                      if (e.target.value === '__create_new__') {
                        setIsCreatingDeck(true);
                      } else {
                        setSelectedDeckId(e.target.value);
                      }
                    }}
                    class="flex-1 bg-slate-900/60 border border-slate-700 text-slate-150 px-4 py-2.5 rounded-lg outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all duration-200"
                  >
                    {decks.map((deck) => (
                      <option key={deck.id} value={deck.id}>
                        {deck.name} ({deck.questionCount} Qs)
                      </option>
                    ))}
                    <option value="__create_new__">+ Create New Deck...</option>
                  </select>
                </div>
              ) : (
                <form onSubmit={handleCreateDeckDirectly} class="flex gap-3 animate-slide-up">
                  <input
                    type="text"
                    placeholder="New deck name"
                    value={newDeckName}
                    onChange={(e) => setNewDeckName(e.target.value)}
                    class="flex-1 bg-slate-900/60 border border-slate-700 text-slate-150 px-4 py-2.5 rounded-lg outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all duration-200"
                    autoFocus
                  />
                  <button
                    type="submit"
                    disabled={!newDeckName.trim()}
                    class="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-4 rounded-lg text-sm transition-all"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsCreatingDeck(false)}
                    class="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 rounded-lg text-sm transition-all"
                  >
                    Cancel
                  </button>
                </form>
              )}
            </div>

            {/* File Upload Zone */}
            <div class="space-y-3">
              <label class="block text-slate-350 text-sm font-medium">Upload Questions JSON File</label>
              <div class="border border-dashed border-slate-700 hover:border-indigo-500/50 bg-slate-900/30 hover:bg-slate-900/50 p-6 rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all relative group shadow-inner">
                <Upload class="text-slate-400 group-hover:text-indigo-400 mb-2 transition-colors duration-200" size={24} />
                <span class="text-xs text-slate-400 font-medium">
                  Drag & drop your JSON file here, or <span class="text-indigo-400 hover:underline">browse</span>
                </span>
                <span class="text-[10px] text-slate-500 mt-1">Accepts standard .json files</span>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleFileUpload}
                  class="absolute inset-0 opacity-0 cursor-pointer"
                />
              </div>
            </div>

            {/* Pasting Textarea */}
            <div class="space-y-3">
              <div class="flex justify-between items-center">
                <label class="block text-slate-300 text-sm font-medium">Questions JSON Payload</label>
                <button
                  type="button"
                  onClick={() => setJsonInput(EXPECTED_FORMAT_EXAMPLE)}
                  class="text-indigo-400 hover:text-indigo-350 text-xs font-semibold hover:underline"
                >
                  Insert Sample JSON
                </button>
              </div>
              <textarea
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
                placeholder={`Paste question JSON array here...\n\nExample:\n${EXPECTED_FORMAT_EXAMPLE}`}
                rows={15}
                class="w-full bg-slate-900/60 border border-slate-700 text-slate-100 p-4 rounded-lg outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-mono text-xs leading-relaxed transition-all duration-200 resize-y no-scrollbar"
              />
            </div>

            <button
              onClick={handleValidatePreview}
              disabled={validating || !jsonInput.trim()}
              class="w-full bg-gradient-to-r from-indigo-650 to-purple-650 hover:from-indigo-600 hover:to-purple-600 text-white font-medium py-3 rounded-lg flex justify-center items-center gap-2 shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {validating ? (
                <>
                  <Loader2 size={18} class="animate-spin" />
                  Validating Questions...
                </>
              ) : (
                <>
                  <ClipboardList size={18} />
                  Validate & Preview Import
                </>
              )}
            </button>
          </div>
        </div>

        {/* Info / Preview Column */}
        <div class="space-y-6">
          {/* Instructions Box */}
          <div class="glass p-6 rounded-2xl border border-slate-700/50 space-y-4">
            <h3 class="text-lg font-bold text-slate-200 flex items-center gap-2">
              <FileText size={18} class="text-indigo-400" />
              Import Instructions
            </h3>
            <ul class="text-slate-400 text-xs space-y-3 list-disc pl-4 leading-relaxed">
              <li>
                Provide an array of question objects containing fields: <code class="text-indigo-300 font-semibold">question</code>, <code class="text-indigo-300 font-semibold">options</code>, and <code class="text-indigo-300 font-semibold">answer</code> (0-based index of correct option).
              </li>
              <li>
                Optional fields include: <code class="text-indigo-300 font-semibold">description</code>, <code class="text-indigo-300 font-semibold">difficulty</code> ("easy" | "medium" | "hard"), and <code class="text-indigo-300 font-semibold">tags</code> (array of strings).
              </li>
              <li>
                The server deduplicates questions using a stable content hash of the normalized question text.
              </li>
              <li>
                If content hash matches an existing question in the deck, but text/options/answer fields differ, it is classified as a <strong class="text-indigo-300">Changed</strong> question. Its content is updated on confirm, but stats remain intact.
              </li>
            </ul>
          </div>

          {/* Validation Preview Summary Panel */}
          {previewData && (
            <div class="glass p-6 rounded-2xl border border-indigo-500/20 shadow-indigo-950/20 shadow-xl space-y-6 animate-slide-up">
              <h3 class="text-lg font-bold text-indigo-300">Validation Summary</h3>
              
              <div class="grid grid-cols-2 gap-3 text-center">
                <div class="bg-slate-900/60 border border-slate-800 p-3 rounded-xl">
                  <div class="text-2xl font-black text-indigo-400">{previewData.summary.new}</div>
                  <div class="text-[10px] uppercase font-bold text-slate-500 tracking-wider">New</div>
                </div>
                <div class="bg-slate-900/60 border border-slate-800 p-3 rounded-xl">
                  <div class="text-2xl font-black text-yellow-500">{previewData.summary.changed}</div>
                  <div class="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Changed</div>
                </div>
                <div class="bg-slate-900/60 border border-slate-800 p-3 rounded-xl col-span-2 sm:col-span-1">
                  <div class="text-2xl font-black text-slate-400">{previewData.summary.unchanged}</div>
                  <div class="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Unchanged</div>
                </div>
                <div class="bg-slate-900/60 border border-slate-800 p-3 rounded-xl col-span-2 sm:col-span-1">
                  <div class="text-2xl font-black text-red-400">{previewData.summary.errors}</div>
                  <div class="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Errors</div>
                </div>
              </div>

              {/* Validation errors list */}
              {previewData.errors.length > 0 && (
                <div class="space-y-2 border-t border-slate-800 pt-4">
                  <div class="text-xs font-bold text-slate-400">Error Details:</div>
                  <div class="max-h-40 overflow-y-auto space-y-2 no-scrollbar">
                    {previewData.errors.map((err, idx) => (
                      <div key={idx} class="bg-red-950/20 border border-red-900/20 p-2 rounded text-[11px] text-red-450 leading-normal flex gap-1.5 items-start">
                        <AlertCircle size={12} class="flex-shrink-0 mt-0.5" />
                        <span>
                          Index {err.index}: {err.message}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Confirm Import Action Button */}
              <button
                onClick={handleConfirmImport}
                disabled={confirming || !canConfirm}
                class="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold py-3 rounded-lg flex justify-center items-center gap-2 shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {confirming ? (
                  <>
                    <Loader2 size={18} class="animate-spin" />
                    Importing Questions...
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={18} />
                    Confirm Import
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
