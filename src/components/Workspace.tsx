'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './Header';
import { PdfViewer } from './PdfViewer';
import { OmrSheet } from './OmrSheet';
import { Dashboard } from './Dashboard';
import { storage, Stroke } from '../utils/storage';
import { AnswerKeyMap, calculateScore, QuestionSection } from '../utils/scoring';

interface PaperData {
  id: string;
  exam: string;
  year: number;
  pdfPath: string;
  ansPath: string | null;
  sections: QuestionSection[];
  keys: AnswerKeyMap | null;
  pageQuestions?: { [page: string]: number[] };
  totalPages?: number;
}

export const Workspace: React.FC = () => {
  const [papers, setPapers] = useState<PaperData[]>([]);
  const [activePaperId, setActivePaperId] = useState<string>('');
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [numPages, setNumPages] = useState<number>(1);
  const [drawMode, setDrawMode] = useState<boolean>(false);
  const [brushColor, setBrushColor] = useState<string>('#ff3366');
  const [brushWidth, setBrushWidth] = useState<number>(3);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [redoStrokes, setRedoStrokes] = useState<Stroke[]>([]);
  const [answers, setAnswers] = useState<{ [questionId: string]: string | string[] }>({});
  const [verifiedSections, setVerifiedSections] = useState<string[]>([]);
  const [isOmrCollapsed, setIsOmrCollapsed] = useState<boolean>(false);
  const [timerMode, setTimerMode] = useState<'stopwatch' | 'timer'>('stopwatch');
  const [timerDuration, setTimerDuration] = useState<number>(10800);
  const [timerRemaining, setTimerRemaining] = useState<number>(10800);
  const [timerElapsed, setTimerElapsed] = useState<number>(0);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);
  const [questionTimes, setQuestionTimes] = useState<{ [questionId: string]: number }>({});
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);
  const [trackingMode, setTrackingMode] = useState<'auto' | 'manual' | 'off'>('auto');
  const [manualRunningQid, setManualRunningQid] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isLoadingManifest, setIsLoadingManifest] = useState<boolean>(true);
  const [submitted, setSubmitted] = useState<boolean>(false);
  const [omrMode, setOmrMode] = useState<'page' | 'full'>('page');
  
  const currentPaper = papers.find((p) => p.id === activePaperId);

  useEffect(() => {
    fetch('/data/papers.json')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load papers');
        return res.json();
      })
      .then((data: PaperData[]) => {
        const sorted = [...data].sort((a, b) => {
          if (a.exam !== b.exam) return b.exam.localeCompare(a.exam);
          return b.year - a.year;
        });
        setPapers(sorted);
        setActivePaperId('');
        setIsLoadingManifest(false);
      })
      .catch((err) => {
        console.error('Error loading papers list:', err);
        setIsLoadingManifest(false);
      });
  }, []);

  useEffect(() => {
    if (!activePaperId) return;
    let isCurrent = true;

    storage.setActivePaperId(activePaperId);
    
    Promise.all([
      storage.getPageNumber(activePaperId),
      storage.getAnswers(activePaperId),
      storage.getVerifiedSections(activePaperId),
      storage.getQuestionTimes(activePaperId),
      storage.getSubmitted(activePaperId)
    ]).then(([savedPage, savedAnswers, savedVerified, savedTimes, savedSubmitted]) => {
      if (!isCurrent) return;

      setPageNumber(savedPage);
      setAnswers(savedAnswers);
      setVerifiedSections(savedVerified);
      setQuestionTimes(savedTimes);
      setSubmitted(savedSubmitted);

      const savedMode = (localStorage.getItem(`timer_mode_${activePaperId}`) as 'stopwatch' | 'timer') || 'stopwatch';
      const savedRemaining = parseInt(localStorage.getItem(`timer_remaining_${activePaperId}`) || '10800');
      const savedElapsed = parseInt(localStorage.getItem(`timer_elapsed_${activePaperId}`) || '0');
      const savedDuration = parseInt(localStorage.getItem(`timer_duration_${activePaperId}`) || '10800');
      const savedRunning = localStorage.getItem(`timer_running_${activePaperId}`) === 'true';

      setTimerMode(savedMode);
      setTimerRemaining(savedRemaining);
      setTimerElapsed(savedElapsed);
      setTimerDuration(savedDuration);
      setIsTimerRunning(savedRunning);
      setTrackingMode((localStorage.getItem('tracking_mode') as 'auto' | 'manual' | 'off') || 'auto');
      setActiveQuestionId(null);
      setManualRunningQid(null);
      setRedoStrokes([]);
      setIsOmrCollapsed(false);
    });

    return () => {
      isCurrent = false;
    };
  }, [activePaperId]);

  useEffect(() => {
    if (!activePaperId) return;
    let isCurrent = true;
    storage.getDrawingStrokes(activePaperId, pageNumber).then((loadedStrokes) => {
      if (isCurrent) {
        setStrokes(loadedStrokes);
      }
    });
    return () => {
      isCurrent = false;
    };
  }, [pageNumber, activePaperId]);

  useEffect(() => {
    if (!activePaperId) return;

    const interval = setInterval(() => {
      if (!isTimerRunning) return;

      if (timerMode === 'timer') {
        setTimerRemaining((prev) => {
          if (prev <= 1) {
            setIsTimerRunning(false);
            return 0;
          }
          return prev - 1;
        });
      } else {
        setTimerElapsed((prev) => prev + 1);
      }

      if (trackingMode === 'auto' && activeQuestionId) {
        setQuestionTimes((prev) => ({
          ...prev,
          [activeQuestionId]: (prev[activeQuestionId] || 0) + 1
        }));
      } else if (trackingMode === 'manual' && manualRunningQid) {
        setQuestionTimes((prev) => ({
          ...prev,
          [manualRunningQid]: (prev[manualRunningQid] || 0) + 1
        }));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isTimerRunning, timerMode, trackingMode, activeQuestionId, manualRunningQid, activePaperId]);

  // Debounced/Throttled writes to IndexedDB for question times to prevent disk thrashing
  useEffect(() => {
    if (!activePaperId || Object.keys(questionTimes).length === 0) return;
    const handler = setTimeout(() => {
      storage.saveQuestionTimes(activePaperId, questionTimes);
    }, 4000);
    return () => clearTimeout(handler);
  }, [questionTimes, activePaperId]);

  // Save question times on tab close/unmount
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (activePaperId && Object.keys(questionTimes).length > 0) {
        storage.saveQuestionTimes(activePaperId, questionTimes);
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      handleBeforeUnload();
    };
  }, [activePaperId, questionTimes]);

  // Debounced/Throttled writes to localStorage for timer state
  useEffect(() => {
    if (!activePaperId) return;
    const handler = setTimeout(() => {
      localStorage.setItem(`timer_remaining_${activePaperId}`, String(timerRemaining));
      localStorage.setItem(`timer_elapsed_${activePaperId}`, String(timerElapsed));
      localStorage.setItem(`timer_running_${activePaperId}`, String(isTimerRunning));
    }, 2000);
    return () => clearTimeout(handler);
  }, [timerRemaining, timerElapsed, isTimerRunning, activePaperId]);

  const handleActivePaperChange = (id: string) => {
    setActivePaperId(id);
    setNumPages(1);
    setPageNumber(1);
    setStrokes([]);
  };

  const handlePageChange = (page: number) => {
    setPageNumber(page);
    if (activePaperId) storage.savePageNumber(activePaperId, page);
  };

  const handleAnswerChange = (qid: string, val: string | string[]) => {
    const updated = { ...answers, [qid]: val };
    setAnswers(updated);
    if (activePaperId) {
      setIsSaving(true);
      storage.saveAnswers(activePaperId, updated).then(() => setIsSaving(false));
    }
  };

  const toggleVerifySection = (secId: string) => {
    const updated = verifiedSections.includes(secId) ? verifiedSections.filter(id => id !== secId) : [...verifiedSections, secId];
    setVerifiedSections(updated);
    if (activePaperId) {
      setIsSaving(true);
      storage.saveVerifiedSections(activePaperId, updated).then(() => setIsSaving(false));
    }
  };

  const handleStrokesChange = (newStrokes: Stroke[]) => {
    if (newStrokes.length > strokes.length) setRedoStrokes([]);
    setStrokes(newStrokes);
    if (activePaperId) {
      setIsSaving(true);
      storage.saveDrawingStrokes(activePaperId, pageNumber, newStrokes).then(() => setIsSaving(false));
    }
  };

  // Auto-focus active question based on pageNumber and unanswered questions
  useEffect(() => {
    if (!currentPaper || trackingMode !== 'auto' || activeQuestionId) return;

    const pageQs = (currentPaper as any).pageQuestions?.[String(pageNumber)];
    if (!pageQs || pageQs.length === 0) return;

    // Find the first question on the page that doesn't have an answer yet
    const firstUnanswered = pageQs.find((qId: number) => {
      const qidStr = String(qId);
      return !answers[qidStr] || answers[qidStr] === '' || (Array.isArray(answers[qidStr]) && (answers[qidStr] as string[]).length === 0);
    });

    if (firstUnanswered) {
      setActiveQuestionId(String(firstUnanswered));
    } else {
      // If all are answered, focus the first question on the page
      setActiveQuestionId(String(pageQs[0]));
    }
  }, [pageNumber, answers, trackingMode, activeQuestionId, currentPaper]);

  const handleSetSubmitted = (val: boolean) => {
    setSubmitted(val);
    if (activePaperId) {
      storage.saveSubmitted(activePaperId, val);
    }
  };

  const handleUndo = useCallback(() => {
    if (strokes.length === 0) return;
    const lastStroke = strokes[strokes.length - 1];
    setRedoStrokes((prev) => [...prev, lastStroke]);
    const updated = strokes.slice(0, -1);
    setStrokes(updated);
    if (activePaperId) {
      setIsSaving(true);
      storage.saveDrawingStrokes(activePaperId, pageNumber, updated).then(() => setIsSaving(false));
    }
  }, [activePaperId, pageNumber, strokes]);

  const handleRedo = useCallback(() => {
    if (redoStrokes.length === 0) return;
    const restoredStroke = redoStrokes[redoStrokes.length - 1];
    setRedoStrokes((prev) => prev.slice(0, -1));
    const updated = [...strokes, restoredStroke];
    setStrokes(updated);
    if (activePaperId) {
      setIsSaving(true);
      storage.saveDrawingStrokes(activePaperId, pageNumber, updated).then(() => setIsSaving(false));
    }
  }, [activePaperId, pageNumber, redoStrokes, strokes]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.getAttribute('contenteditable') === 'true')) return;
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && ((e.shiftKey && e.key.toLowerCase() === 'z') || e.key.toLowerCase() === 'y')) {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleRedo, handleUndo]);

  const handleClear = () => {
    if (window.confirm('Clear all drawings on this page?')) {
      setRedoStrokes([]);
      handleStrokesChange([]);
    }
  };

  const handleResetSession = async () => {
    if (!activePaperId) return;
    if (window.confirm('This wipes OMR answers, timers, and annotations for the current paper. Continue?')) {
      setIsSaving(true);
      await storage.resetSession(activePaperId);
      setAnswers({});
      setVerifiedSections([]);
      setStrokes([]);
      setRedoStrokes([]);
      setQuestionTimes({});
      setSubmitted(false);
      setTimerElapsed(0);
      setTimerRemaining(timerDuration);
      setIsTimerRunning(false);
      localStorage.removeItem(`timer_remaining_${activePaperId}`);
      localStorage.removeItem(`timer_elapsed_${activePaperId}`);
      localStorage.setItem(`timer_running_${activePaperId}`, 'false');
      setPageNumber(1);
      setIsSaving(false);
    }
  };

  const handleTimerModeChange = (mode: 'stopwatch' | 'timer') => { setTimerMode(mode); localStorage.setItem(`timer_mode_${activePaperId}`, mode); };
  const handleTimerRemainingChange = (sec: number) => { setTimerRemaining(sec); localStorage.setItem(`timer_remaining_${activePaperId}`, String(sec)); };
  const handleTimerElapsedChange = (sec: number) => { setTimerElapsed(sec); localStorage.setItem(`timer_elapsed_${activePaperId}`, String(sec)); };
  const handleTimerDurationChange = (sec: number) => { setTimerDuration(sec); localStorage.setItem(`timer_duration_${activePaperId}`, String(sec)); };
  const handleIsTimerRunningChange = (running: boolean) => { setIsTimerRunning(running); localStorage.setItem(`timer_running_${activePaperId}`, String(running)); };
  const handleTrackingModeChange = (mode: 'auto' | 'manual' | 'off') => {
    setTrackingMode(mode);
    localStorage.setItem('tracking_mode', mode);
    if (mode !== 'auto') setActiveQuestionId(null);
    if (mode !== 'manual') setManualRunningQid(null);
  };

  const { score, totalMarks, totalAnswered, totalQuestions } = currentPaper
    ? calculateScore(answers, currentPaper.sections, currentPaper.keys, currentPaper.exam as 'CEED' | 'UCEED')
    : { score: null, totalMarks: 0, totalAnswered: 0, totalQuestions: 0 };

  if (isLoadingManifest) {
    return (
      <div className="pdf-loading">
        <div className="loading-card">
          <div className="spinner" />
          <h3>Preparing your studio</h3>
          <p>Loading papers, answer keys, and saved local progress.</p>
        </div>
      </div>
    );
  }

  if (!activePaperId) {
    return <Dashboard papers={papers} onSelectPaper={handleActivePaperChange} />;
  }

  return (
    <div className="studio-shell">
      <Header
        papers={papers}
        activePaperId={activePaperId}
        setActivePaperId={handleActivePaperChange}
        pageNumber={pageNumber}
        setPageNumber={handlePageChange}
        numPages={numPages}
        drawMode={drawMode}
        setDrawMode={setDrawMode}
        brushColor={brushColor}
        setBrushColor={setBrushColor}
        brushWidth={brushWidth}
        setBrushWidth={setBrushWidth}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={strokes.length > 0}
        canRedo={redoStrokes.length > 0}
        onClear={handleClear}
        onReset={handleResetSession}
        score={score}
        totalMarks={totalMarks}
        totalAnswered={totalAnswered}
        totalQuestions={totalQuestions}
        timerMode={timerMode}
        setTimerMode={handleTimerModeChange}
        timerRemaining={timerRemaining}
        setTimerRemaining={handleTimerRemainingChange}
        timerElapsed={timerElapsed}
        setTimerElapsed={handleTimerElapsedChange}
        timerDuration={timerDuration}
        setTimerDuration={handleTimerDurationChange}
        isTimerRunning={isTimerRunning}
        setIsTimerRunning={handleIsTimerRunningChange}
        isOmrCollapsed={isOmrCollapsed}
        setIsOmrCollapsed={setIsOmrCollapsed}
        isSaving={isSaving}
        submitted={submitted}
      />

      <div className={`workspace-grid ${isOmrCollapsed ? 'omr-hidden' : omrMode === 'page' ? 'omr-mode-dock' : 'omr-mode-full'}`}>
        <section className={`pdf-pane ${isOmrCollapsed ? 'full' : ''}`}>
          {currentPaper ? (
            <PdfViewer
              pdfUrl={currentPaper.pdfPath}
              pageNumber={pageNumber}
              setPageNumber={handlePageChange}
              setNumPages={setNumPages}
              drawMode={drawMode}
              brushColor={brushColor}
              brushWidth={brushWidth}
              strokes={strokes}
              setStrokes={handleStrokesChange}
              activePaperId={activePaperId}
            />
          ) : null}
        </section>

        <aside className={`omr-pane ${isOmrCollapsed ? 'collapsed' : ''}`}>
          {currentPaper ? (
            <OmrSheet
              sections={currentPaper.sections}
              answers={answers}
              setAnswer={handleAnswerChange}
              verifiedSections={verifiedSections}
              toggleVerifySection={toggleVerifySection}
              keys={currentPaper.keys}
              examType={currentPaper.exam as 'CEED' | 'UCEED'}
              questionTimes={questionTimes}
              activeQuestionId={activeQuestionId}
              setActiveQuestionId={setActiveQuestionId}
              trackingMode={trackingMode}
              setTrackingMode={handleTrackingModeChange}
              manualRunningQid={manualRunningQid}
              setManualRunningQid={setManualRunningQid}
              submitted={submitted}
              setSubmitted={handleSetSubmitted}
              omrMode={omrMode}
              setOmrMode={setOmrMode}
              pageNumber={pageNumber}
              pageQuestions={(currentPaper as any).pageQuestions}
              onResetSession={handleResetSession}
            />
          ) : null}
        </aside>
      </div>
    </div>
  );
};
