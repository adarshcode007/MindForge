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
      <div className="max-w-2xl mx-auto px-4 py-8 sm:py-12 animate-fade-in text-center pb-24">
        <div className="glass p-6 sm:p-8 rounded-3xl border border-darkBorder shadow-2xl relative overflow-hidden">
          <div className="absolute -top-24 -left-24 w-48 h-48 rounded-full bg-blue-500/10 blur-3xl"></div>
          
          <div className="p-4 bg-blue-600/15 border border-blue-500/25 rounded-full text-blue-400 w-fit mx-auto mb-6 shadow-inner">
            <Award size={48} className="animate-bounce" />
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-100 tracking-tight mb-2 font-display">
            Practice Session Completed
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm mb-8">
            Here is a breakdown of your active loop metrics.
          </p>

          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="bg-slate-900/60 border border-slate-800/80 p-4 sm:p-5 rounded-2xl">
              <div className="text-2xl sm:text-4xl font-extrabold text-blue-400 font-display">
                {correctCount} <span className="text-xs sm:text-lg font-medium text-slate-500">/ {questionCount}</span>
              </div>
              <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mt-2">Score</div>
            </div>
            <div className="bg-slate-900/60 border border-slate-800/80 p-4 sm:p-5 rounded-2xl">
              <div className="text-2xl sm:text-4xl font-extrabold text-emerald-450 font-display">{accuracy}%</div>
              <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mt-2">Accuracy</div>
            </div>
          </div>

          {/* Wrong tags summary */}
          {sessionWrongTags.size > 0 && (
            <div className="text-left bg-slate-900/40 border border-slate-800/80 p-4 sm:p-5 rounded-2xl mb-8">
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-3">
                Needs Focus (Missed Topics)
              </h3>
              <div className="flex flex-wrap gap-2">
                {Array.from(sessionWrongTags).map((tag) => (
                  <span key={tag} className="bg-rose-950/20 text-rose-455 border border-rose-900/25 px-2.5 py-1 rounded-lg text-xs font-semibold">
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Quick Buttons */}
          <div className="flex flex-col sm:flex-row gap-4">
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
              className="flex-1 bg-gradient-to-r from-blue-600 to-violet-650 hover:from-blue-550 hover:to-violet-600 text-white font-bold py-3 sm:py-3.5 rounded-xl shadow-lg transition-all duration-200 flex justify-center items-center gap-2 text-xs sm:text-sm"
            >
              <RefreshCw size={16} />
              Practice Again
            </button>
            <button
              onClick={() => navigate('/')}
              className="flex-1 bg-slate-800 hover:bg-slate-750 text-slate-350 font-bold py-3 sm:py-3.5 rounded-xl border border-slate-700 transition-all duration-200 flex justify-center items-center gap-2 text-xs sm:text-sm"
            >
              <HomeIcon size={16} />
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
    <div className="max-w-3xl mx-auto px-4 py-8 animate-fade-in pb-24">
      
      {/* Session Progress Header */}
      <div className="flex justify-between items-center mb-6 bg-slate-900/40 border border-darkBorder p-4 rounded-2xl">
        <div className="flex items-center gap-4">
          <div className="text-xs sm:text-sm font-semibold text-slate-400">
            {mode === 'quick10' ? (
              <span>
                Progress: <strong className="text-blue-400 text-sm sm:text-base font-display">{questionCount}</strong> / 10
              </span>
            ) : (
              <span>
                Attempted: <strong className="text-blue-400 text-sm sm:text-base font-display">{questionCount}</strong>
              </span>
            )}
          </div>
          {mode !== 'quick10' && (
            <div className="text-xs text-slate-500 border-l border-slate-800 pl-4">
              Correct: <span className="text-emerald-450 font-semibold">{correctCount}</span>
            </div>
          )}
        </div>

        {/* Timer / End Button */}
        <div className="flex items-center gap-3">
          {mode === 'drill' && (
            <div className="flex items-center gap-1.5 bg-blue-950/20 border border-blue-900/30 text-blue-400 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-mono font-bold">
              <Timer size={14} className="animate-pulse" />
              <span>{formatTime(timeLeft)}</span>
            </div>
          )}

          {mode !== 'quick10' && mode !== 'drill' && (
            <button
              onClick={handleEndSession}
              className="text-[10px] sm:text-xs font-semibold px-3 py-1.5 bg-slate-800/80 hover:bg-rose-950/20 border border-slate-700 hover:border-rose-900/30 text-slate-400 hover:text-rose-400 rounded-xl transition-all duration-200"
            >
              End Session
            </button>
          )}
        </div>
      </div>

      {/* Main Question Card */}
      <div className="glass p-5 sm:p-8 rounded-3xl border border-darkBorder shadow-2xl space-y-6 relative overflow-hidden">
        {/* Difficult Badge / Leech Tag */}
        <div className="flex justify-between items-center">
          <div className="flex gap-2">
            <span className="bg-slate-900/80 text-slate-400 border border-slate-850 px-2.5 py-1 rounded-lg text-[10px] font-semibold uppercase tracking-wider">
              {currentQuestion.difficulty || 'medium'}
            </span>
          </div>

          {isQuestionLeech && (
            <span className="bg-rose-950/20 text-rose-450 border border-rose-900/30 px-2.5 py-1 rounded-lg text-[10px] font-semibold flex items-center gap-1.5 animate-pulse">
              <ShieldAlert size={12} />
              Leech Card
            </span>
          )}
        </div>

        {/* Question Text */}
        <div className="space-y-2">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-100 leading-snug break-words">
            {currentQuestion.question}
          </h2>
        </div>

        {/* Shuffled Options Grid */}
        <div className="space-y-3 pt-2">
          {shuffledOptions.map((opt, sIdx) => {
            const isSelected = selectedOptionIndex === opt.originalIndex;
            const isCorrectAnswer = opt.originalIndex === revealCorrectOption;
            const isWrongSelected = isSelected && revealCorrectOption !== null && revealCorrectOption !== opt.originalIndex;

            let btnStyle = 'border-slate-800 bg-slate-900/40 text-slate-355 hover:bg-slate-850 hover:border-slate-700';
            
            if (isAnswered) {
              btnStyle = 'border-slate-800/40 bg-slate-900/20 text-slate-500 opacity-60 cursor-not-allowed';
            }

            if (revealCorrectOption !== null) {
              if (isCorrectAnswer) {
                btnStyle = 'border-emerald-500/35 bg-emerald-950/15 text-emerald-455 shadow-md font-medium';
              } else if (isWrongSelected) {
                btnStyle = 'border-rose-500/35 bg-rose-950/15 text-rose-455 font-medium';
              }
            } else if (isSelected && showConfidencePrompt) {
              btnStyle = 'border-blue-500/50 bg-blue-950/25 text-blue-350 shadow-md';
            }

            return (
              <button
                key={sIdx}
                onClick={() => handleSelectOption(sIdx, opt.originalIndex)}
                disabled={isAnswered}
                className={`w-full text-left px-4 sm:px-5 py-3 sm:py-4 rounded-xl border text-xs sm:text-sm transition-all duration-200 flex justify-between items-center gap-3 ${btnStyle}`}
              >
                <span className="break-words flex-1 leading-normal">{opt.text}</span>
                {revealCorrectOption !== null && isCorrectAnswer && (
                  <CheckCircle size={16} className="text-emerald-400 flex-shrink-0" />
                )}
                {revealCorrectOption !== null && isWrongSelected && (
                  <XCircle size={16} className="text-rose-400 flex-shrink-0" />
                )}
              </button>
            );
          })}
        </div>

        {/* Confidence Prompt */}
        {showConfidencePrompt && (
          <div className="bg-blue-955/10 border border-blue-500/25 p-4 sm:p-5 rounded-2xl space-y-4 animate-slide-up">
            <div className="text-center">
              <h4 className="text-xs sm:text-sm font-bold text-blue-350">Correct! Rate your confidence:</h4>
              <p className="text-[10px] text-slate-505 mt-1">This adjusts the frequency this question will reappear.</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => handleConfidenceSelection('knew_it')}
                className="flex-1 bg-blue-600 hover:bg-blue-550 text-white font-semibold py-2.5 rounded-lg text-xs sm:text-sm shadow-md transition-all duration-200"
              >
                Knew It (Halves Weight)
              </button>
              <button
                onClick={() => handleConfidenceSelection('guessed')}
                className="flex-1 bg-slate-800 hover:bg-slate-750 text-slate-350 font-semibold py-2.5 rounded-lg text-xs sm:text-sm transition-all duration-200 border border-slate-700"
              >
                Guessed (Keep Weight)
              </button>
            </div>
          </div>
        )}

        {/* Explanation / Description Box */}
        {revealCorrectOption !== null && currentQuestion.description && (
          <div className="bg-slate-900/60 border border-slate-800 p-4 sm:p-5 rounded-2xl text-[11px] sm:text-xs leading-relaxed text-slate-400 space-y-2 animate-slide-up">
            <span className="font-bold text-slate-300 text-[10px] uppercase tracking-wider block">Explanation</span>
            <p className="break-words leading-relaxed">{currentQuestion.description}</p>
          </div>
        )}

        {/* Leech Flag Update in run */}
        {revealCorrectOption !== null && isQuestionLeech && (
          <div className="bg-rose-955/10 border border-rose-900/20 text-rose-455 p-4 rounded-xl text-[11px] leading-normal flex gap-2 items-start animate-slide-up">
            <ShieldAlert size={14} className="flex-shrink-0 mt-0.5" />
            <span>
              This question has been answered wrong consecutively. It will surface more frequently.
            </span>
          </div>
        )}

        {/* Next Button */}
        {showNextButton && (
          <button
            onClick={handleNext}
            className="w-full bg-slate-800 hover:bg-slate-750 text-slate-200 font-semibold py-3.5 rounded-xl border border-slate-700 flex justify-center items-center gap-2 transition-all duration-200 shadow-md animate-slide-up text-xs sm:text-sm"
          >
            <span>Next Question</span>
            <ArrowRight size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
