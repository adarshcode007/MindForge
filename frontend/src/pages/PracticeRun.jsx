import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { pickNext } from '../lib/weightedPick';
import { Timer, ArrowRight, ShieldAlert, Award, RefreshCw, Home as HomeIcon, CheckCircle, XCircle } from 'lucide-react';

export default function PracticeRun() {
  const location = useLocation();
  const navigate = useNavigate();

  // Load state parameters passed from PracticeSetup
  const { pool: initialPool, mode, selectedDeckIds } = location.state || {};

  // If page is accessed directly without pool state, redirect to setup
  if (!initialPool || initialPool.length === 0) {
    useEffect(() => {
      navigate('/practice');
    }, []);
    return null;
  }

  // App States
  const [pool, setPool] = useState(initialPool);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [shuffledOptions, setShuffledOptions] = useState([]);
  const [recentIds, setRecentIds] = useState([]);

  // Session stats tracking
  const [questionCount, setQuestionCount] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [sessionWrongTags, setSessionWrongTags] = useState(new Set());
  
  // Quiz Interaction States
  const [selectedOptionIndex, setSelectedOptionIndex] = useState(null); // original index
  const [selectedShuffledIndex, setSelectedShuffledIndex] = useState(null); // shuffled UI index
  const [isAnswered, setIsAnswered] = useState(false);
  const [showConfidencePrompt, setShowConfidencePrompt] = useState(false);
  const [revealCorrectOption, setRevealCorrectOption] = useState(null);
  const [isQuestionLeech, setIsQuestionLeech] = useState(false);
  const [submittingAnswer, setSubmittingAnswer] = useState(false);
  const [sessionEnd, setSessionEnd] = useState(false);

  // Drill Timer (3 minutes = 180 seconds)
  const [timeLeft, setTimeLeft] = useState(180);
  const timerRef = useRef(null);

  // 1. Initialize session and pick first question
  useEffect(() => {
    // Pick the first question
    loadNextQuestion([], pool);

    // Setup timer if Drill mode
    if (mode === 'drill') {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            setSessionEnd(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // 2. Select next question helper
  const loadNextQuestion = (history = recentIds, currentPool = pool) => {
    // Reset states
    setSelectedOptionIndex(null);
    setSelectedShuffledIndex(null);
    setIsAnswered(false);
    setShowConfidencePrompt(false);
    setRevealCorrectOption(null);
    setIsQuestionLeech(false);

    // Stop conditions check
    if (mode === 'quick10' && questionCount >= 10) {
      setSessionEnd(true);
      return;
    }

    // Filter pool for "new" mode since timesShown changes dynamically
    let activePool = currentPool;
    if (mode === 'new') {
      activePool = currentPool.filter((q) => q.stats.timesShown === 0);
    }

    if (activePool.length === 0) {
      setSessionEnd(true);
      return;
    }

    // Select question using weighted pick (or uniform for full_random)
    let selected = null;
    if (mode === 'full_random') {
      const idx = Math.floor(Math.random() * activePool.length);
      selected = activePool[idx];
    } else {
      selected = pickNext(activePool, history);
    }

    if (!selected) {
      setSessionEnd(true);
      return;
    }

    // Add to rolling history (max 5 items)
    const newHistory = [...history, selected.id || selected._id];
    if (newHistory.length > 5) {
      newHistory.shift();
    }
    setRecentIds(newHistory);

    setCurrentQuestion(selected);
    setIsQuestionLeech(selected.stats.isLeech);

    // Shuffle options client-side
    const optionsWithIndices = selected.options.map((text, idx) => ({
      text,
      originalIndex: idx,
    }));
    const shuffled = [...optionsWithIndices];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    setShuffledOptions(shuffled);
  };

  // 3. Option selection handler
  const handleSelectOption = async (shuffledIndex, originalIndex) => {
    if (isAnswered) return;

    setSelectedOptionIndex(originalIndex);
    setSelectedShuffledIndex(shuffledIndex);

    const isCorrect = (originalIndex === currentQuestion.answer);

    if (isCorrect) {
      // Prompt confidence for correct answer
      setShowConfidencePrompt(true);
      setIsAnswered(true); // Locks interaction
    } else {
      // If wrong, submit immediately with confidence null
      setIsAnswered(true);
      await submitResult(originalIndex, null, false);
    }
  };

  // 4. API submit function
  const submitResult = async (originalIndex, confidenceVal, wasCorrect) => {
    setSubmittingAnswer(true);
    const qId = currentQuestion.id || currentQuestion._id;

    try {
      const response = await api.post(`/questions/${qId}/answer`, {
        selectedOption: originalIndex,
        confidence: confidenceVal,
      });

      // Update question counts
      setQuestionCount((prev) => prev + 1);
      if (wasCorrect) {
        setCorrectCount((prev) => prev + 1);
      } else {
        // Collect incorrect tags
        if (currentQuestion.tags) {
          setSessionWrongTags((prev) => {
            const nextTags = new Set(prev);
            currentQuestion.tags.forEach((t) => nextTags.add(t));
            return nextTags;
          });
        }
      }

      setRevealCorrectOption(response.correctOption);
      setIsQuestionLeech(response.isLeech);

      // Update local question pool stats for dynamic new mode filtering
      setPool((prevPool) =>
        prevPool.map((q) => {
          const checkId = q.id || q._id;
          if (checkId === qId) {
            return {
              ...q,
              stats: {
                ...q.stats,
                timesShown: q.stats.timesShown + 1,
                weight: response.newWeight,
                isLeech: response.isLeech,
              },
            };
          }
          return q;
        })
      );
    } catch (err) {
      console.error('Failed to submit answer:', err);
    } finally {
      setSubmittingAnswer(false);
    }
  };

  const handleConfidenceSelection = async (confidence) => {
    setShowConfidencePrompt(false);
    await submitResult(selectedOptionIndex, confidence, true);
  };

  const handleNext = () => {
    loadNextQuestion();
  };

  const handleEndSession = () => {
    setSessionEnd(true);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  // Helper formatting for timer
  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // ----------------------------------------------------
  // RENDER SUMMARY SCREEN
  // ----------------------------------------------------
  if (sessionEnd) {
    const accuracy = questionCount > 0 ? Math.round((correctCount / questionCount) * 100) : 0;
    return (
      <div class="max-w-2xl mx-auto px-4 py-12 animate-fade-in text-center">
        <div class="glass p-8 rounded-3xl border border-slate-700/50 shadow-2xl relative overflow-hidden">
          <div class="absolute -top-24 -left-24 w-48 h-48 rounded-full bg-indigo-500/10 blur-3xl"></div>
          
          <div class="p-4 bg-indigo-600/20 border border-indigo-500/35 rounded-full text-indigo-400 w-fit mx-auto mb-6">
            <Award size={48} class="animate-bounce" />
          </div>

          <h1 class="text-3xl font-extrabold text-slate-100 tracking-tight mb-2">
            Practice Session Completed!
          </h1>
          <p class="text-slate-400 text-sm mb-8">
            Here is a breakdown of your performance.
          </p>

          <div class="grid grid-cols-2 gap-4 mb-8">
            <div class="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl">
              <div class="text-4xl font-black text-indigo-400">
                {correctCount} <span class="text-lg font-medium text-slate-500">/ {questionCount}</span>
              </div>
              <div class="text-xs uppercase font-bold text-slate-500 tracking-wider mt-2">Score</div>
            </div>
            <div class="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl">
              <div class="text-4xl font-black text-emerald-450">{accuracy}%</div>
              <div class="text-xs uppercase font-bold text-slate-500 tracking-wider mt-2">Accuracy</div>
            </div>
          </div>

          {/* Wrong tags summary */}
          {sessionWrongTags.size > 0 && (
            <div class="text-left bg-slate-900/40 border border-slate-800/80 p-5 rounded-2xl mb-8">
              <h3 class="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                Needs Focus (Missed Topics)
              </h3>
              <div class="flex flex-wrap gap-2">
                {Array.from(sessionWrongTags).map((tag) => (
                  <span key={tag} class="bg-red-950/20 text-red-400 border border-red-900/35 px-2.5 py-1 rounded-lg text-xs font-semibold">
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Quick Buttons */}
          <div class="flex flex-col sm:flex-row gap-4">
            <button
              onClick={() => {
                setPool(initialPool);
                setQuestionCount(0);
                setCorrectCount(0);
                setSessionWrongTags(new Set());
                setSessionEnd(false);
                setTimeLeft(180);
                loadNextQuestion([], initialPool);
              }}
              class="flex-1 bg-gradient-to-r from-indigo-650 to-purple-650 hover:from-indigo-600 hover:to-purple-600 text-white font-bold py-3.5 rounded-xl shadow-lg transition-all duration-200 flex justify-center items-center gap-2"
            >
              <RefreshCw size={18} />
              Practice Again
            </button>
            <button
              onClick={() => navigate('/')}
              class="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-350 font-bold py-3.5 rounded-xl border border-slate-700/50 transition-all duration-200 flex justify-center items-center gap-2"
            >
              <HomeIcon size={18} />
              Back to Decks
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!currentQuestion) return null;

  const showNextButton = isAnswered && !showConfidencePrompt && !submittingAnswer;

  return (
    <div class="max-w-3xl mx-auto px-4 py-8 animate-fade-in">
      
      {/* Session Progress Header */}
      <div class="flex justify-between items-center mb-6 bg-slate-900/40 border border-slate-800 p-4 rounded-2xl">
        <div class="flex items-center gap-4">
          <div class="text-sm font-semibold text-slate-400">
            {mode === 'quick10' ? (
              <span>
                Progress: <strong class="text-indigo-400 text-base">{questionCount + (isAnswered ? 0 : 0)}</strong> / 10
              </span>
            ) : (
              <span>
                Attempted: <strong class="text-indigo-400 text-base">{questionCount}</strong>
              </span>
            )}
          </div>
          {mode !== 'quick10' && (
            <div class="text-xs text-slate-500 border-l border-slate-800 pl-4">
              Correct: <span class="text-emerald-400 font-semibold">{correctCount}</span>
            </div>
          )}
        </div>

        {/* Timer / End Button */}
        <div class="flex items-center gap-3">
          {mode === 'drill' && (
            <div class="flex items-center gap-1.5 bg-indigo-950/20 border border-indigo-900/30 text-indigo-400 px-3 py-1.5 rounded-xl text-sm font-mono font-bold">
              <Timer size={16} class="animate-pulse" />
              <span>{formatTime(timeLeft)}</span>
            </div>
          )}

          {mode !== 'quick10' && mode !== 'drill' && (
            <button
              onClick={handleEndSession}
              class="text-xs font-semibold px-3 py-1.5 bg-slate-800/80 hover:bg-red-950/20 border border-slate-700 hover:border-red-900/30 text-slate-400 hover:text-red-400 rounded-xl transition-all duration-200"
            >
              End Session
            </button>
          )}
        </div>
      </div>

      {/* Main Question Card */}
      <div class="glass p-8 rounded-3xl border border-slate-700/50 shadow-2xl space-y-6 relative overflow-hidden">
        {/* Difficult Badge / Leech Tag */}
        <div class="flex justify-between items-center">
          <div class="flex gap-2">
            <span class="bg-slate-900/80 text-slate-400 border border-slate-850 px-2.5 py-1 rounded-lg text-xs font-semibold uppercase tracking-wider">
              {currentQuestion.difficulty || 'medium'}
            </span>
          </div>

          {isQuestionLeech && (
            <span class="bg-rose-950/20 text-rose-450 border border-rose-900/30 px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 animate-pulse">
              <ShieldAlert size={14} />
              Leech Card
            </span>
          )}
        </div>

        {/* Question Text */}
        <div class="space-y-2">
          <h2 class="text-2xl font-bold text-slate-100 leading-snug break-words">
            {currentQuestion.question}
          </h2>
        </div>

        {/* Shuffled Options Grid */}
        <div class="space-y-3.5 pt-4">
          {shuffledOptions.map((opt, sIdx) => {
            const isSelected = selectedOptionIndex === opt.originalIndex;
            const isCorrectAnswer = opt.originalIndex === revealCorrectOption;
            const isWrongSelected = isSelected && revealCorrectOption !== null && revealCorrectOption !== opt.originalIndex;

            let btnStyle = 'border-slate-800 bg-slate-900/40 text-slate-300 hover:bg-slate-850 hover:border-slate-700';
            
            if (isAnswered) {
              // Lock hover states
              btnStyle = 'border-slate-800/40 bg-slate-900/20 text-slate-500 opacity-60 cursor-not-allowed';
            }

            if (revealCorrectOption !== null) {
              if (isCorrectAnswer) {
                btnStyle = 'border-emerald-500/40 bg-emerald-950/15 text-emerald-400 shadow-md shadow-emerald-950/10 font-medium';
              } else if (isWrongSelected) {
                btnStyle = 'border-red-500/40 bg-red-950/15 text-red-400 font-medium';
              }
            } else if (isSelected && showConfidencePrompt) {
              // Correct option selected but waiting for confidence score
              btnStyle = 'border-indigo-500/60 bg-indigo-950/20 text-indigo-300 shadow-md shadow-indigo-950/10';
            }

            return (
              <button
                key={sIdx}
                onClick={() => handleSelectOption(sIdx, opt.originalIndex)}
                disabled={isAnswered}
                class={`w-full text-left px-5 py-4 rounded-xl border text-sm transition-all duration-200 flex justify-between items-center ${btnStyle}`}
              >
                <span class="break-words pr-4">{opt.text}</span>
                {revealCorrectOption !== null && isCorrectAnswer && (
                  <CheckCircle size={16} class="text-emerald-400 flex-shrink-0" />
                )}
                {revealCorrectOption !== null && isWrongSelected && (
                  <XCircle size={16} class="text-red-400 flex-shrink-0" />
                )}
              </button>
            );
          })}
        </div>

        {/* Confidence Prompt */}
        {showConfidencePrompt && (
          <div class="bg-indigo-950/10 border border-indigo-500/25 p-5 rounded-2xl space-y-4 animate-slide-up">
            <div class="text-center">
              <h4 class="text-sm font-bold text-indigo-350">Correct! Rate your confidence:</h4>
              <p class="text-xs text-slate-500 mt-1">This adjusts the frequency this question will reappear.</p>
            </div>
            <div class="flex gap-4">
              <button
                onClick={() => handleConfidenceSelection('knew_it')}
                class="flex-1 bg-indigo-650 hover:bg-indigo-600 text-white font-semibold py-2.5 rounded-lg text-sm shadow-md transition-all duration-200"
              >
                Knew It (Halves Weight)
              </button>
              <button
                onClick={() => handleConfidenceSelection('guessed')}
                class="flex-1 bg-slate-805 hover:bg-slate-700 text-slate-300 font-semibold py-2.5 rounded-lg text-sm transition-all duration-200 border border-slate-700/50"
              >
                Guessed (Keep Weight)
              </button>
            </div>
          </div>
        )}

        {/* Explanation / Description Box */}
        {revealCorrectOption !== null && currentQuestion.description && (
          <div class="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl text-xs leading-relaxed text-slate-400 space-y-2 animate-slide-up">
            <span class="font-bold text-slate-300 text-[11px] uppercase tracking-wider block">Explanation</span>
            <p class="break-words">{currentQuestion.description}</p>
          </div>
        )}

        {/* Leech Flag Update in run */}
        {revealCorrectOption !== null && isQuestionLeech && (
          <div class="bg-rose-950/10 border border-rose-900/20 text-rose-450 p-4 rounded-xl text-xs leading-normal flex gap-2 items-start animate-slide-up">
            <ShieldAlert size={14} class="flex-shrink-0 mt-0.5" />
            <span>
              This question has been answered wrong consecutively. It will surface more frequently.
            </span>
          </div>
        )}

        {/* Next Button */}
        {showNextButton && (
          <button
            onClick={handleNext}
            class="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold py-3.5 rounded-xl border border-slate-700 flex justify-center items-center gap-2 transition-all duration-200 shadow-md animate-slide-up"
          >
            <span>Next Question</span>
            <ArrowRight size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
