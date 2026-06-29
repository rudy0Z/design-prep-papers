import React, { useState, useRef } from 'react';
import {
  Edit3,
  Trash2,
  Undo2,
  Redo2,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Award,
  FileText,
  Clock,
  Timer,
  Play,
  Pause,
  RotateCcw,
  Settings2,
  Pencil,
  Eraser,
  Loader2
} from 'lucide-react';

interface PaperInfo {
  id: string;
  exam: string;
  year: number;
}

interface HeaderProps {
  papers: PaperInfo[];
  activePaperId: string;
  setActivePaperId: (id: string) => void;
  pageNumber: number;
  setPageNumber: (page: number) => void;
  numPages: number;
  drawMode: boolean;
  setDrawMode: (mode: boolean) => void;
  brushColor: string;
  setBrushColor: (color: string) => void;
  brushWidth: number;
  setBrushWidth: (width: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onClear: () => void;
  onReset: () => void;
  score: number | null;
  totalMarks: number;
  totalAnswered: number;
  totalQuestions: number;
  timerMode: 'stopwatch' | 'timer';
  setTimerMode: (mode: 'stopwatch' | 'timer') => void;
  timerRemaining: number;
  setTimerRemaining: (sec: number) => void;
  timerElapsed: number;
  setTimerElapsed: (sec: number) => void;
  timerDuration: number;
  setTimerDuration: (sec: number) => void;
  isTimerRunning: boolean;
  setIsTimerRunning: (running: boolean) => void;
  isOmrCollapsed: boolean;
  setIsOmrCollapsed: (collapsed: boolean) => void;
  isSaving: boolean;
  submitted: boolean;
}

const BRUSH_COLORS = [
  { name: 'Pink', value: '#ff3366' },
  { name: 'Violet', value: '#a855f7' },
  { name: 'Green', value: '#00ff66' },
  { name: 'Yellow', value: '#ffff00' },
  { name: 'Blue', value: '#00ccff' }
];

export const Header: React.FC<HeaderProps> = ({
  papers,
  activePaperId,
  setActivePaperId,
  pageNumber,
  setPageNumber,
  numPages,
  drawMode,
  setDrawMode,
  brushColor,
  setBrushColor,
  brushWidth,
  setBrushWidth,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onClear,
  onReset,
  score,
  totalMarks,
  totalAnswered,
  totalQuestions,
  timerMode,
  setTimerMode,
  timerRemaining,
  setTimerRemaining,
  timerElapsed,
  setTimerElapsed,
  timerDuration,
  setTimerDuration,
  isTimerRunning,
  setIsTimerRunning,
  isOmrCollapsed,
  setIsOmrCollapsed,
  isSaving,
  submitted
}) => {
  const [showTimerSettings, setShowTimerSettings] = useState(false);
  const [lastPencilColor, setLastPencilColor] = useState('#ff3366');
  const [customHours, setCustomHours] = useState(0);
  const [customMinutes, setCustomMinutes] = useState(30);
  const [customMode, setCustomMode] = useState(false);
  const colorPickerRef = useRef<HTMLInputElement>(null);

  const currentPaper = papers.find((paper) => paper.id === activePaperId);

  const formatTime = (totalSeconds: number) => {
    const absSec = Math.max(0, isNaN(totalSeconds) ? 0 : totalSeconds);
    const hrs = Math.floor(absSec / 3600);
    const mins = Math.floor((absSec % 3600) / 60);
    const secs = absSec % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handlePrevPage = () => { if (pageNumber > 1) setPageNumber(pageNumber - 1); };
  const handleNextPage = () => { if (pageNumber < numPages) setPageNumber(pageNumber + 1); };
  const handleSelectPencil = () => setBrushColor(lastPencilColor);
  const handleSelectEraser = () => {
    if (brushColor !== 'eraser') setLastPencilColor(brushColor);
    setBrushColor('eraser');
  };
  const handleColorChange = (color: string) => {
    setBrushColor(color);
    setLastPencilColor(color);
  };
  const handleTimerReset = () => {
    setIsTimerRunning(false);
    if (timerMode === 'timer') {
      setTimerRemaining(timerDuration);
      localStorage.setItem(`timer_remaining_${activePaperId}`, String(timerDuration));
    } else {
      setTimerElapsed(0);
      localStorage.setItem(`timer_elapsed_${activePaperId}`, '0');
    }
    localStorage.setItem(`timer_running_${activePaperId}`, 'false');
  };

  return (
    <header className="studio-header">
      <div className="toolbar-cluster">
        <button onClick={() => setActivePaperId('')} className="studio-btn" title="Back to paper selector">
          <ChevronLeft size={15} /> Home
        </button>
        <select value={activePaperId} onChange={(e) => setActivePaperId(e.target.value)} className="studio-select">
          {papers.map((paper) => <option key={paper.id} value={paper.id}>{paper.exam} - {paper.year}</option>)}
        </select>
        <div className="v-divider" />
        <div className="kicker" style={{ color: 'var(--muted)' }}>{currentPaper?.exam} studio</div>
      </div>

      <div className="toolbar-cluster center">
        <div className="studio-btn page-pill">
          <button onClick={handlePrevPage} disabled={pageNumber <= 1} className="mini-icon" title="Previous page"><ChevronLeft size={14} /></button>
          <span className="mono">{pageNumber} / {numPages || 1}</span>
          <button onClick={handleNextPage} disabled={pageNumber >= numPages} className="mini-icon" title="Next page"><ChevronRight size={14} /></button>
        </div>

        <button onClick={() => setDrawMode(!drawMode)} className={`studio-btn ${drawMode ? 'active' : ''}`} title="Toggle annotation mode">
          <Edit3 size={15} /> Draw
        </button>
        <button onClick={() => setIsOmrCollapsed(!isOmrCollapsed)} className={`studio-btn ${isOmrCollapsed ? 'active' : ''}`} title="Toggle response sheet panel">
          <FileText size={15} /> {isOmrCollapsed ? 'Show Sheet' : 'Hide Sheet'}
        </button>

        {drawMode && (
          <div className="draw-kit animate-fade-in">
            <div className="tool-toggle">
              <button onClick={handleSelectPencil} className={brushColor !== 'eraser' ? 'active' : ''} title="Pencil"><Pencil size={15} /></button>
              <button onClick={handleSelectEraser} className={brushColor === 'eraser' ? 'active' : ''} title="Eraser"><Eraser size={15} /></button>
            </div>

            {brushColor !== 'eraser' && (
              <div className="swatch-row">
                {BRUSH_COLORS.map((color) => (
                  <button key={color.name} onClick={() => handleColorChange(color.value)} className={`swatch ${brushColor === color.value ? 'active' : ''}`} style={{ backgroundColor: color.value }} title={color.name} />
                ))}
                <button onClick={() => colorPickerRef.current?.click()} className="swatch" style={{ background: 'linear-gradient(135deg,#ff3366,#00ff66,#00ccff)' }} title="Custom color" />
                <input ref={colorPickerRef} type="color" hidden value={BRUSH_COLORS.some(c => c.value === brushColor) ? brushColor : '#ffffff'} onChange={(e) => handleColorChange(e.target.value)} />
              </div>
            )}

            <input type="range" min="1" max="8" value={brushWidth} onChange={(e) => setBrushWidth(parseInt(e.target.value))} className="range" title={`Brush size: ${brushWidth}px`} />
            <button onClick={onUndo} disabled={!canUndo} className="mini-icon" title="Undo"><Undo2 size={15} /></button>
            <button onClick={onRedo} disabled={!canRedo} className="mini-icon" title="Redo"><Redo2 size={15} /></button>
            <button onClick={onClear} className="mini-icon" title="Clear annotations"><Trash2 size={15} /></button>
          </div>
        )}
      </div>

      <div className="toolbar-cluster right">
        <div className="saved-state">
          {isSaving ? <Loader2 size={13} className="animate-spin" /> : <span className="saved-dot" />}
          <span>{isSaving ? 'Saving' : 'Saved'}</span>
        </div>

        <div className="timer-pill" style={{ position: 'relative' }}>
          {timerMode === 'timer' ? <Timer size={15} /> : <Clock size={15} />}
          <strong className="mono">{formatTime(timerMode === 'timer' ? timerRemaining : timerElapsed)}</strong>
          <button onClick={() => setIsTimerRunning(!isTimerRunning)} className="mini-icon" title={isTimerRunning ? 'Pause timer' : 'Start timer'}>
            {isTimerRunning ? <Pause size={13} /> : <Play size={13} />}
          </button>
          <button onClick={handleTimerReset} className="mini-icon" title="Reset timer"><RotateCcw size={13} /></button>
        </div>

        <div style={{ position: 'relative' }}>
          <button onClick={() => setShowTimerSettings(!showTimerSettings)} className="icon-btn" title="Timer settings"><Settings2 size={15} /></button>
          {showTimerSettings && (
            <div className="timer-popover animate-fade-in">
              <div className="kicker" style={{ marginBottom: 10 }}>Timer mode</div>
              <div className="segment">
                <button onClick={() => { setTimerMode('stopwatch'); setIsTimerRunning(false); }} className={timerMode === 'stopwatch' ? 'active' : ''}>Stopwatch</button>
                <button onClick={() => { setTimerMode('timer'); setIsTimerRunning(false); }} className={timerMode === 'timer' ? 'active' : ''}>Countdown</button>
              </div>

              {timerMode === 'timer' && (
                <>
                  <div className="preset-grid">
                    {[{ label: '15m', val: 900 }, { label: '30m', val: 1800 }, { label: '1h', val: 3600 }, { label: '2h', val: 7200 }, { label: '3h', val: 10800 }].map(preset => (
                      <button key={preset.label} onClick={() => { setTimerDuration(preset.val); setTimerRemaining(preset.val); setIsTimerRunning(false); setCustomMode(false); setShowTimerSettings(false); }} className={timerRemaining === preset.val && !customMode ? 'active' : ''}>{preset.label}</button>
                    ))}
                    <button onClick={() => setCustomMode(true)} className={customMode ? 'active' : ''}>Custom</button>
                  </div>
                  {customMode && (
                    <div className="duration-row animate-fade-in">
                      <input type="number" min="0" max="23" value={customHours} onChange={(e) => setCustomHours(Math.max(0, parseInt(e.target.value) || 0))} />
                      <span className="mono">:</span>
                      <input type="number" min="0" max="59" value={customMinutes} onChange={(e) => setCustomMinutes(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))} />
                      <button className="apply-btn" onClick={() => {
                        const totalSecs = (customHours * 3600) + (customMinutes * 60);
                        if (totalSecs > 0) { setTimerDuration(totalSecs); setTimerRemaining(totalSecs); setIsTimerRunning(false); setShowTimerSettings(false); }
                      }}>Apply</button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        <div className="score-strip">
          <FileText size={15} /> <span>Attempted <strong className="mono">{totalAnswered}/{totalQuestions}</strong></span>
          {submitted && (
            <>
              <div className="v-divider" style={{ height: '12px', margin: '0 8px' }} />
              <Award size={15} color="var(--accent)" /> <span>Score <strong className="mono">{score !== null ? score.toFixed(2) : '--'}</strong><span className="mono" style={{ color: 'var(--muted)' }}>/{totalMarks}</span></span>
            </>
          )}
        </div>
        <button onClick={onReset} className="icon-btn" title="Reset current session"><RefreshCw size={15} /></button>
      </div>
    </header>
  );
};
