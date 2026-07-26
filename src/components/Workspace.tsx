'use client';
/* eslint-disable react-hooks/set-state-in-effect */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Pencil, Highlighter, Eraser, Undo2, Redo2, Trash2 } from 'lucide-react';
import { Header } from './Header';
import { PdfViewer } from './PdfViewer';
import { OmrSheet } from './OmrSheet';
import { Dashboard } from './Dashboard';
import { storage, Stroke } from '../utils/storage';
import { AnswerKeyMap, calculateScore, QuestionSection } from '../utils/scoring';

function playBeep() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.5);
  } catch {
    // Audio not available
  }
}

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
  const [activePaperId, setActivePaperId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('active_paper_id') || '';
    }
    return '';
  });
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [numPages, setNumPages] = useState<number>(1);
  const [drawMode, setDrawMode] = useState<boolean>(false);
  const [brushColor, setBrushColor] = useState<string>('#ff3366');
  const [brushWidth, setBrushWidth] = useState<number>(3);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [redoStrokes, setRedoStrokes] = useState<Stroke[]>([]);
  const [answers, setAnswers] = useState<{ [questionId: string]: string | string[] }>({});
  const [verifiedSections, setVerifiedSections] = useState<string[]>([]);
  const [isOmrOpen, setIsOmrOpen] = useState<boolean>(false);
  const [lastPencilColor, setLastPencilColor] = useState<string>('#ff3366');
  const [lastPencilWidth, setLastPencilWidth] = useState<number>(3);
  const [lastHighlighterColor, setLastHighlighterColor] = useState<string>('rgba(255, 235, 59, 0.45)');
  const [lastHighlighterWidth, setLastHighlighterWidth] = useState<number>(12);
  
  const colorPickerRef = useRef<HTMLInputElement | null>(null);
  const answerSaveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const activePaperIdRef = useRef(activePaperId);
  activePaperIdRef.current = activePaperId;
  const [timerMode, setTimerMode] = useState<'stopwatch' | 'timer'>('stopwatch');
  const [timerDuration, setTimerDuration] = useState<number>(10800);
  const [timerRemaining, setTimerRemaining] = useState<number>(10800);
  const [timerElapsed, setTimerElapsed] = useState<number>(0);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);

  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isLoadingManifest, setIsLoadingManifest] = useState<boolean>(true);
  const [submitted, setSubmitted] = useState<boolean>(false);
  const [omrMode, setOmrMode] = useState<'page' | 'full'>('page');
  const [flaggedQuestions, setFlaggedQuestions] = useState<string[]>([]);
  const [confirmModal, setConfirmModal] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);
  const [dashboardKey, setDashboardKey] = useState(0);
  
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
        
        // Read persisted active paper from localStorage
        const savedPaperId = localStorage.getItem('active_paper_id');
        if (savedPaperId && sorted.some((p) => p.id === savedPaperId)) {
          setActivePaperId(savedPaperId);
        } else {
          setActivePaperId('');
          localStorage.removeItem('active_paper_id');
        }
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
      storage.getSubmitted(activePaperId),
      storage.getFlaggedQuestions(activePaperId)
    ]).then(([savedPage, savedAnswers, savedVerified, savedSubmitted, savedFlagged]) => {
      if (!isCurrent) return;

      setPageNumber(savedPage);
      setAnswers(savedAnswers);
      setVerifiedSections(savedVerified);
      setSubmitted(savedSubmitted);
      setFlaggedQuestions(savedFlagged);

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
      setRedoStrokes([]);
      setIsOmrOpen(false);
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

  // Auto-stop countdown when it hits 0
  useEffect(() => {
    if (timerMode === 'timer' && timerRemaining <= 0 && isTimerRunning) {
      setIsTimerRunning(false);
      playBeep();
    }
  }, [timerRemaining, timerMode, isTimerRunning]);

  useEffect(() => {
    if (!activePaperId) return;

    const interval = setInterval(() => {
      if (!isTimerRunning) return;

      if (timerMode === 'timer') {
        setTimerRemaining((prev) => Math.max(0, prev - 1));
      } else {
        setTimerElapsed((prev) => prev + 1);
      }

    }, 1000);

    return () => clearInterval(interval);
  }, [isTimerRunning, timerMode, activePaperId]);

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
    if (id) {
      localStorage.setItem('active_paper_id', id);
    } else {
      localStorage.removeItem('active_paper_id');
      setDashboardKey(k => k + 1);
    }
  };

  const handlePageChange = useCallback((page: number) => {
    const clamped = Math.max(1, Math.min(page, numPages));
    setPageNumber(clamped);
    if (activePaperId) storage.savePageNumber(activePaperId, clamped);
  }, [numPages, activePaperId]);

  const handleAnswerChange = (qid: string, val: string | string[]) => {
    const updated = { ...answers, [qid]: val };
    setAnswers(updated);
    clearTimeout(answerSaveTimer.current);
    if (activePaperId) {
      setIsSaving(true);
      answerSaveTimer.current = setTimeout(() => {
        const pid = activePaperIdRef.current;
        if (pid) storage.saveAnswers(pid, updated).then(() => setIsSaving(false));
      }, 400);
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

  const handleStrokesChange = useCallback((newStrokes: Stroke[]) => {
    if (newStrokes.length > strokes.length) setRedoStrokes([]);
    setStrokes(newStrokes);
    if (activePaperId) {
      setIsSaving(true);
      storage.saveDrawingStrokes(activePaperId, pageNumber, newStrokes).then(() => setIsSaving(false));
    }
  }, [activePaperId, pageNumber, strokes]);



  const toggleFlagQuestion = (qid: string) => {
    const updated = flaggedQuestions.includes(qid)
      ? flaggedQuestions.filter(id => id !== qid)
      : [...flaggedQuestions, qid];
    setFlaggedQuestions(updated);
    if (activePaperId) {
      storage.saveFlaggedQuestions(activePaperId, updated);
    }
  };

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

  const handleSelectPencil = useCallback(() => {
    if (brushColor === 'eraser') {
      setBrushColor(lastPencilColor);
      setBrushWidth(lastPencilWidth);
    } else if (brushColor.startsWith('rgba')) {
      setLastHighlighterColor(brushColor);
      setLastHighlighterWidth(brushWidth);
      setBrushColor(lastPencilColor);
      setBrushWidth(lastPencilWidth);
    }
  }, [brushColor, lastPencilColor, lastPencilWidth, brushWidth]);

  const handleSelectHighlighter = useCallback(() => {
    if (brushColor === 'eraser') {
      setBrushColor(lastHighlighterColor);
      setBrushWidth(lastHighlighterWidth);
    } else if (!brushColor.startsWith('rgba')) {
      setLastPencilColor(brushColor);
      setLastPencilWidth(brushWidth);
      setBrushColor(lastHighlighterColor);
      setBrushWidth(lastHighlighterWidth);
    }
  }, [brushColor, lastHighlighterColor, lastHighlighterWidth, brushWidth]);

  const handleSelectEraser = useCallback(() => {
    if (brushColor !== 'eraser') {
      if (brushColor.startsWith('rgba')) {
        setLastHighlighterColor(brushColor);
        setLastHighlighterWidth(brushWidth);
      } else {
        setLastPencilColor(brushColor);
        setLastPencilWidth(brushWidth);
      }
      setBrushColor('eraser');
      setBrushWidth(16);
    }
  }, [brushColor, brushWidth]);

  const handleColorChange = useCallback((color: string) => {
    if (color.startsWith('rgba')) {
      setBrushColor(color);
      setLastHighlighterColor(color);
    } else {
      setBrushColor(color);
      setLastPencilColor(color);
    }
  }, []);

  useEffect(() => {
    if (brushColor === 'eraser') return;
    if (brushColor.startsWith('rgba')) {
      setLastHighlighterWidth(brushWidth);
    } else {
      setLastPencilWidth(brushWidth);
    }
  }, [brushWidth, brushColor]);

  const handleClear = useCallback(() => {
    setConfirmModal({
      title: 'Clear Page Drawings?',
      message: `This will permanently erase all vector drawing lines and sketch notes on Page ${pageNumber}. This action cannot be undone.`,
      onConfirm: () => {
        setRedoStrokes([]);
        handleStrokesChange([]);
      }
    });
  }, [handleStrokesChange, pageNumber]);

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
      } else if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
        const key = e.key.toLowerCase();
        if (key === 'd' || key === 'p') {
          setDrawMode(true);
          handleSelectPencil();
        } else if (key === 'h') {
          setDrawMode(true);
          handleSelectHighlighter();
        } else if (key === 'e') {
          setDrawMode(true);
          handleSelectEraser();
        } else if (key === 'c') {
          handleClear();
        } else if ((key === 'o' || key === 's') && currentPaper?.keys) {
          setIsOmrOpen(prev => !prev);
        } else if (key === '[' || e.key === 'ArrowLeft') {
          if (pageNumber > 1) handlePageChange(pageNumber - 1);
        } else if (key === ']' || e.key === 'ArrowRight') {
          if (pageNumber < numPages) handlePageChange(pageNumber + 1);
        } else if (key === 'escape') {
          setIsOmrOpen(false);
          setConfirmModal(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    handleRedo,
    handleUndo,
    handleClear,
    handleSelectPencil,
    handleSelectHighlighter,
    handleSelectEraser,
    handlePageChange,
    pageNumber,
    numPages,
    answers,
    currentPaper,
    submitted
  ]);

  const handleResetSession = () => {
    if (!activePaperId) return;
    setConfirmModal({
      title: 'Reset Session Progress?',
      message: 'Are you sure you want to reset? This will wipe your digital answer sheet, drawing canvas notes, and time-tracking stats for this paper. Your progress will be lost.',
      onConfirm: async () => {
        setIsSaving(true);
        await storage.resetSession(activePaperId);
        setAnswers({});
        setVerifiedSections([]);
        setStrokes([]);
        setRedoStrokes([]);
        setSubmitted(false);
        setFlaggedQuestions([]);
        setTimerElapsed(0);
        setTimerRemaining(timerDuration);
        setIsTimerRunning(false);
        localStorage.removeItem(`timer_remaining_${activePaperId}`);
        localStorage.removeItem(`timer_elapsed_${activePaperId}`);
        localStorage.setItem(`timer_running_${activePaperId}`, 'false');
        setPageNumber(1);
        setIsSaving(false);
      }
    });
  };

  const handleTimerModeChange = (mode: 'stopwatch' | 'timer') => { setTimerMode(mode); localStorage.setItem(`timer_mode_${activePaperId}`, mode); };
  const handleTimerRemainingChange = (sec: number) => { setTimerRemaining(sec); localStorage.setItem(`timer_remaining_${activePaperId}`, String(sec)); };
  const handleTimerElapsedChange = (sec: number) => { setTimerElapsed(sec); localStorage.setItem(`timer_elapsed_${activePaperId}`, String(sec)); };
  const handleTimerDurationChange = (sec: number) => { setTimerDuration(sec); localStorage.setItem(`timer_duration_${activePaperId}`, String(sec)); };
  const handleIsTimerRunningChange = (running: boolean) => { setIsTimerRunning(running); localStorage.setItem(`timer_running_${activePaperId}`, String(running)); };
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
    return <Dashboard key={dashboardKey} papers={papers} onSelectPaper={handleActivePaperChange} />;
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
        isOmrOpen={isOmrOpen}
        setIsOmrOpen={setIsOmrOpen}
        isSaving={isSaving}
        submitted={submitted}
        hasKeys={!!currentPaper?.keys}
      />

      <div className="workspace-grid relative">
        <section className="pdf-pane full relative overflow-hidden">
          {currentPaper ? (
            <>
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

              {drawMode && (
                <div className="floating-draw-palette animate-fade-in" id="workspace-draw-palette">
                  <div className="tool-toggle">
                    <button 
                      onClick={handleSelectPencil} 
                      className={brushColor !== 'eraser' && !brushColor.startsWith('rgba') ? 'active' : ''} 
                      id="palette-btn-pencil"
                      title="Pencil tool (P / D)"
                      aria-label="Pencil drawing tool"
                    >
                      <Pencil size={14} />
                    </button>
                    <button 
                      onClick={handleSelectHighlighter} 
                      className={brushColor.startsWith('rgba') ? 'active' : ''} 
                      id="palette-btn-highlighter"
                      title="Highlighter tool (H)"
                      aria-label="Highlighter transparent tool"
                    >
                      <Highlighter size={14} />
                    </button>
                    <button 
                      onClick={handleSelectEraser} 
                      className={brushColor === 'eraser' ? 'active' : ''} 
                      id="palette-btn-eraser"
                      title="Eraser tool (E)"
                      aria-label="Eraser tool"
                    >
                      <Eraser size={14} />
                    </button>
                  </div>
                  
                  <div className="v-divider" />
                  
                  {brushColor !== 'eraser' && (
                    <div className="swatch-row">
                      {(brushColor.startsWith('rgba')
                        ? [
                            { name: 'Yellow', value: 'rgba(255, 235, 59, 0.45)' },
                            { name: 'Green', value: 'rgba(139, 195, 74, 0.45)' },
                            { name: 'Cyan', value: 'rgba(0, 188, 212, 0.45)' },
                            { name: 'Pink', value: 'rgba(244, 63, 94, 0.45)' }
                          ]
                        : [
                            { name: 'Black', value: '#111111' },
                            { name: 'Pink', value: '#ff3366' },
                            { name: 'Violet', value: '#a855f7' },
                            { name: 'Green', value: '#00ff66' },
                            { name: 'Blue', value: '#00ccff' }
                          ]
                      ).map((color) => (
                        <button 
                          key={color.name} 
                          onClick={() => handleColorChange(color.value)} 
                          className={`swatch ${brushColor === color.value ? 'active' : ''}`} 
                          style={{ backgroundColor: color.value.startsWith('rgba') ? color.value.replace('0.45', '1.0') : color.value }} 
                          title={color.name}
                          aria-label={`Select color ${color.name}`}
                        />
                      ))}
                      <button 
                        onClick={() => colorPickerRef.current?.click()} 
                        className="swatch" 
                        style={{ background: 'linear-gradient(135deg,#ff3366,#00ff66,#00ccff)' }} 
                        title="Custom color"
                        aria-label="Open custom color picker"
                      />
                      <input 
                        ref={colorPickerRef} 
                        type="color" 
                        hidden 
                        value={brushColor.startsWith('#') ? brushColor : '#ffffff'} 
                        onChange={(e) => handleColorChange(e.target.value)} 
                      />
                    </div>
                  )}

                  <div className="v-divider" />

                  <input 
                    type="range" 
                    min="1" 
                    max="16" 
                    value={brushWidth} 
                    onChange={(e) => setBrushWidth(parseInt(e.target.value))} 
                    className="range" 
                    title={`Brush width: ${brushWidth}px`} 
                    aria-label={`Brush stroke width: ${brushWidth} pixels`}
                    id="palette-range-width"
                  />

                  <div className="v-divider" />

                  <button 
                    onClick={handleUndo} 
                    disabled={strokes.length === 0} 
                    className="mini-icon" 
                    title="Undo stroke (Ctrl+Z)"
                    id="palette-btn-undo"
                    aria-label="Undo drawing stroke"
                  >
                    <Undo2 size={14} />
                  </button>
                  <button 
                    onClick={handleRedo} 
                    disabled={redoStrokes.length === 0} 
                    className="mini-icon" 
                    title="Redo stroke (Ctrl+Y)"
                    id="palette-btn-redo"
                    aria-label="Redo drawing stroke"
                  >
                    <Redo2 size={14} />
                  </button>
                  <button 
                    onClick={handleClear} 
                    className="mini-icon" 
                    title="Clear page drawings (C)"
                    id="palette-btn-clear"
                    aria-label="Clear all page drawings"
                  >
                    <Trash2 size={14} />
                  </button>

                  <div className="v-divider hide-mobile" />

                  <div className="palette-kbd-help hide-mobile">
                    <span><kbd className="kbd-badge">P</kbd> Pencil</span>
                    <span><kbd className="kbd-badge">H</kbd> High</span>
                    <span><kbd className="kbd-badge">E</kbd> Erase</span>
                  </div>
                </div>
              )}

              {currentPaper && !isOmrOpen && (
                <div className="quick-omr-capsule animate-fade-in" id="workspace-quick-omr">
                  <div className="quick-omr-header">
                    <span className="mono">Page {pageNumber} Responses</span>
                    <button className="expand-drawer-btn" onClick={() => setIsOmrOpen(true)} title="Expand response sheet drawer" aria-label="Expand response sheet drawer">
                      Open Sheet →
                    </button>
                  </div>
                  <div className="quick-omr-questions">
                    {(() => {
                      const activePageQs = currentPaper.pageQuestions?.[String(pageNumber)] ?? [];
                      if (activePageQs.length === 0) {
                        return <span className="no-qs text-[10px] text-muted-2">No response entries required</span>;
                      }
                      return activePageQs.map(qNum => {
                        const qid = String(qNum);
                        const sec = currentPaper.sections.find(s => qNum >= s.startQ && qNum < s.startQ + s.count);
                        if (!sec) return null;
                        const val = answers[qid];
                        const isNat = sec.type === 'NAT';
                        const isMsq = sec.type === 'MSQ';

                        return (
                          <div key={qid} className="quick-row">
                            <span className="q-badge mono">Q.{qid}</span>
                            {isNat ? (
                              <input
                                type="text"
                                placeholder="Value"
                                value={(val as string) ?? ''}
                                onChange={(e) => handleAnswerChange(qid, e.target.value)}
                                disabled={submitted}
                                className="quick-nat-input"
                                aria-label={`Numerical response for Question ${qid}`}
                              />
                            ) : (
                              <div className="quick-choices">
                                {['A', 'B', 'C', 'D'].map(opt => {
                                  const selected = isMsq
                                    ? Array.isArray(val) && val.includes(opt)
                                    : val === opt;
                                  
                                  return (
                                    <button
                                      key={opt}
                                      disabled={submitted}
                                      onClick={() => {
                                        let newVal: string | string[];
                                        if (isMsq) {
                                          const arr = Array.isArray(val) ? (val as string[]) : [];
                                          newVal = arr.includes(opt) ? arr.filter(o => o !== opt) : [...arr, opt];
                                        } else {
                                          newVal = opt;
                                        }
                                        handleAnswerChange(qid, newVal);
                                      }}
                                      className={`quick-choice-btn ${selected ? 'selected' : ''}`}
                                      aria-label={isMsq ? `Select option ${opt} for Question ${qid} (multiple choice)` : `Select option ${opt} for Question ${qid}`}
                                    >
                                      {opt}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              )}
            </>
          ) : null}
        </section>

        <aside className={`omr-pane ${isOmrOpen ? 'open' : 'collapsed'}`}>
          {currentPaper ? (
            <OmrSheet
              sections={currentPaper.sections}
              answers={answers}
              setAnswer={handleAnswerChange}
              verifiedSections={verifiedSections}
              toggleVerifySection={toggleVerifySection}
              keys={currentPaper.keys}
              examType={currentPaper.exam as 'CEED' | 'UCEED'}
              submitted={submitted}
              setSubmitted={handleSetSubmitted}
              omrMode={omrMode}
              setOmrMode={setOmrMode}
              pageNumber={pageNumber}
              pageQuestions={currentPaper.pageQuestions}
              onResetSession={handleResetSession}
              flaggedQuestions={flaggedQuestions}
              onToggleFlag={toggleFlagQuestion}
              isOmrOpen={isOmrOpen}
              setIsOmrOpen={setIsOmrOpen}
            />
          ) : null}
        </aside>
      </div>

      {confirmModal && (
        <div className="report-modal-overlay animate-fade-in" style={{ zIndex: 110 }}>
          <div className="report-modal-card animate-zoom-in" style={{ maxWidth: '400px', padding: '20px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text)', margin: '0 0 8px' }}>{confirmModal.title}</h3>
            <p style={{ fontSize: '12px', color: 'var(--muted)', margin: '0 0 16px', lineHeight: 1.5 }}>
              {confirmModal.message}
            </p>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button 
                onClick={() => setConfirmModal(null)} 
                className="sheet-reset-btn"
                style={{ width: 'auto', padding: '0 12px', height: '30px' }}
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  confirmModal.onConfirm();
                  setConfirmModal(null);
                }} 
                className="submit-practice-btn"
                style={{ width: 'auto', padding: '0 14px', height: '30px' }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
