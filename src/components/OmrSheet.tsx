'use client';

import React, { useState, useEffect } from 'react';
import { X, Check, Award, AlertCircle, LayoutGrid, FileText, RotateCcw, Flag, Play, Pause } from 'lucide-react';
import { QuestionSection, evaluateNat, evaluateMcq, evaluateMsq, calculateScore, AnswerKeyMap, AnswerKeyValue } from '../utils/scoring';

interface OmrSheetProps {
  sections: QuestionSection[];
  answers: { [questionId: string]: string | string[] };
  setAnswer: (qid: string, val: string | string[]) => void;
  verifiedSections: string[];
  toggleVerifySection: (secId: string) => void;
  keys: AnswerKeyMap | null;
  examType: 'CEED' | 'UCEED';
  questionTimes: { [questionId: string]: number };
  activeQuestionId: string | null;
  setActiveQuestionId: (qid: string | null) => void;
  trackingMode: 'auto' | 'manual' | 'off';
  setTrackingMode: (mode: 'auto' | 'manual' | 'off') => void;
  manualRunningQid: string | null;
  setManualRunningQid: (qid: string | null) => void;
  // New props
  submitted: boolean;
  setSubmitted: (val: boolean) => void;
  omrMode: 'page' | 'full';
  setOmrMode: (mode: 'page' | 'full') => void;
  pageNumber: number;
  pageQuestions?: { [page: string]: number[] };
  onResetSession: () => void;
  flaggedQuestions: string[];
  onToggleFlag: (qid: string) => void;
  isOmrOpen: boolean;
  setIsOmrOpen: (open: boolean) => void;
}

const fmtTime = (s: number) => {
  if (!s) return '0:00';
  const m = Math.floor(s / 60), sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
};

const getRecommendedTime = (type: 'NAT' | 'MSQ' | 'MCQ') => {
  if (type === 'NAT') return 210; // 3.5 minutes
  if (type === 'MSQ') return 210; // 3.5 minutes
  return 120; // 2.0 minutes
};

export const OmrSheet: React.FC<OmrSheetProps> = ({
  sections, answers, setAnswer,
  keys, examType,
  questionTimes, activeQuestionId, setActiveQuestionId,
  trackingMode, setTrackingMode,
  manualRunningQid, setManualRunningQid,
  submitted, setSubmitted,
  omrMode, setOmrMode,
  pageNumber, pageQuestions,
  onResetSession,
  flaggedQuestions, onToggleFlag,
  isOmrOpen, setIsOmrOpen
}) => {
  const [activeTab, setActiveTab] = useState<string>(sections[0]?.id ?? '');
  const [showReport, setShowReport] = useState(false);
  const [showConfirmSubmit, setShowConfirmSubmit] = useState(false);
  const [checked, setChecked] = useState(false);
  const showResults = submitted || checked;
  const activeSection = sections.find(s => s.id === activeTab) ?? sections[0];

  useEffect(() => {
    if (submitted) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShowReport(true);
    }
  }, [submitted]);

  const getAttempted = (sec: QuestionSection) => {
    let n = 0;
    for (let i = 0; i < sec.count; i++) {
      const ans = answers[String(sec.startQ + i)];
      if (ans && (Array.isArray(ans) ? ans.length > 0 : String(ans).trim() !== '')) n++;
    }
    return n;
  };

  const getQuestionSection = (qidNum: number): QuestionSection | undefined => {
    return sections.find(sec => qidNum >= sec.startQ && qidNum < sec.startQ + sec.count);
  };

  // Answer logic
  const handleNat = (qid: string, val: string) => {
    if (submitted) return; // locked
    if (val === '' || /^-?[0-9.]*$/.test(val)) setAnswer(qid, val);
  };

  const handleMcq = (qid: string, opt: string) => {
    if (submitted) return; // locked
    setAnswer(qid, opt);
  };

  const handleMsq = (qid: string, opt: string) => {
    if (submitted) return; // locked
    const cur = (answers[qid] as string[]) ?? [];
    setAnswer(qid, cur.includes(opt) ? cur.filter(o => o !== opt) : [...cur, opt].sort());
  };

  // Verification helper methods
  const verifyNat = (qid: string, key: string) => {
    const userAns = answers[qid] as string;
    if (!userAns || userAns.trim() === '') return null;
    return evaluateNat(userAns, key);
  };

  const verifyMcq = (qid: string, key: string) => {
    const ans = answers[qid] as string;
    if (!ans) return null;
    return evaluateMcq(ans, key, examType).isCorrect;
  };

  const verifyMsq = (qid: string, key: AnswerKeyValue): boolean | null => {
    const opts = (answers[qid] as string[]) ?? [];
    if (!opts.length) return null;

    if (Array.isArray(key) && Array.isArray(key[0])) {
      return (key as string[][]).some((k: string[]) => evaluateMsq(opts, k).isCorrect);
    } else if (Array.isArray(key)) {
      return evaluateMsq(opts, key as string[]).isCorrect;
    }
    return null;
  };

  // Calculate score properties
  const { score, totalMarks, totalAnswered, totalQuestions } = calculateScore(answers, sections, keys, examType);

  const activePageQs = pageQuestions?.[String(pageNumber)] ?? [];

  if (sections.length === 0) {
    return (
      <div className={`omr-sheet ${omrMode === 'page' ? 'sheet-docked' : 'sheet-full'} ${isOmrOpen ? 'open' : 'collapsed'}`}>
        <button
          onClick={() => setIsOmrOpen(!isOmrOpen)}
          className={`omr-drawer-handle ${isOmrOpen ? 'open' : 'closed'}`}
          id="omr-drawer-toggle-handle"
          title={isOmrOpen ? 'Hide response sheet' : 'Show response sheet'}
          aria-label="Toggle response sheet drawer"
        >
          <FileText size={14} />
        </button>

        <div className="sheet-header">
          <h2 id="omr-sheet-title">Response Sheet</h2>
        </div>
        
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px 24px',
          textAlign: 'center',
          height: '75%',
          color: 'var(--text-secondary)'
        }}>
          <AlertCircle size={32} style={{ marginBottom: 16, color: 'var(--muted)' }} />
          <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>
            No Objective Section
          </h3>
          <p style={{ fontSize: '12px', color: 'var(--muted)', lineHeight: 1.5, maxWidth: '280px' }}>
            This year&apos;s exam did not have a computer-based or objective section (MCQ/MSQ/NAT). The paper consists entirely of subjective drawing and design questions.
          </p>
          <span style={{ fontSize: '11px', color: 'var(--muted-2)', marginTop: 12, fontStyle: 'italic' }}>
            Please use the canvas annotation tools directly on the question paper to draft your work.
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={`omr-sheet ${omrMode === 'page' ? 'sheet-docked' : 'sheet-full'} ${isOmrOpen ? 'open' : 'collapsed'}`}>
      {/* Title & View Switcher */}
      <div className="sheet-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button 
            onClick={() => setIsOmrOpen(false)}
            className="sheet-close-btn"
            title="Close response sheet"
            aria-label="Close response sheet"
            style={{ 
              border: '1px solid rgba(255,255,255,0.1)', 
              background: 'rgba(255,255,255,0.05)', 
              cursor: 'pointer', 
              padding: '5px 7px', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              color: 'var(--text)', 
              borderRadius: '6px',
              transition: 'all 0.15s ease',
              flexShrink: 0
            }}
          >
            <X size={14} />
          </button>
          <h2 id="omr-sheet-title" style={{ margin: 0 }}>Response Sheet</h2>
        </div>
        <div className="view-toggle-segmented">
          <button 
            onClick={() => setOmrMode('page')}
            id="omr-btn-toggle-page"
            className={omrMode === 'page' ? 'active' : ''}
            title="Show questions on current page"
          >
            <FileText size={13} />
            <span>Page View</span>
          </button>
          <button 
            onClick={() => setOmrMode('full')}
            id="omr-btn-toggle-full"
            className={omrMode === 'full' ? 'active' : ''}
            title="Show full sheet grid"
          >
            <LayoutGrid size={13} />
            <span>Full Sheet</span>
          </button>
        </div>
      </div>

      <div className="sheet-settings-bar">
        <div className="tracking-control-unified" id="omr-tracking-control">
          <div className="tracking-label-row">
            <span>Auto-Track Time</span>
            {trackingMode === 'auto' && activeQuestionId && (
              <span className="tracking-now-badge mono">
                <span className="tracking-pulse-dot" />
                Tracking Q.{activeQuestionId}
              </span>
            )}
            {trackingMode === 'manual' && manualRunningQid && (
              <span className="tracking-now-badge mono">
                <span className="tracking-pulse-dot" />
                Timing Q.{manualRunningQid}
              </span>
            )}
            {trackingMode === 'auto' && !activeQuestionId && (
              <span className="tracking-idle-label mono">Click a question to track</span>
            )}
            {trackingMode === 'manual' && !manualRunningQid && (
              <span className="tracking-idle-label mono">Tap play on any question</span>
            )}
          </div>
          <div className="tracking-buttons-group">
            {(['auto', 'manual', 'off'] as const).map(m => (
              <button
                key={m}
                id={`omr-tracking-btn-${m}`}
                onClick={() => setTrackingMode(m)}
                className={`tracking-btn ${trackingMode === m ? 'active' : ''}`}
                title={m === 'auto' ? 'Track time spent based on focused question' : m === 'manual' ? 'Click play/pause next to each question manually' : 'Turn off question-level timing'}
              >
                {m === 'auto' ? 'Auto' : m === 'manual' ? 'Manual' : 'Off'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {omrMode === 'full' ? (
        <>
          {/* Section tabs */}
          <div className="omr-tabs" id="omr-section-tabs">
            {sections.map(sec => {
              const attempted = getAttempted(sec);
              const pct = sec.count > 0 ? (attempted / sec.count) * 100 : 0;
              return (
                <button
                  key={sec.id}
                  id={`omr-tab-${sec.id}`}
                  onClick={() => setActiveTab(sec.id)}
                  className={`omr-tab${activeTab === sec.id ? ' active' : ''}`}
                >
                  <strong>{sec.type}</strong>
                  <span className="mono">{attempted}/{sec.count}</span>
                  <div className="tab-indicator">
                    <i style={{ width: `${pct}%` }} />
                  </div>
                </button>
              );
            })}
          </div>

          {/* Content area */}
          <div className="omr-content">
            {activeSection ? (
              <div className="animate-fade-in">
                <div className="section-head">
                  <span className="section-desc mono">
                    {activeSection.type === 'NAT' && 'Numerical Answer Type'}
                    {activeSection.type === 'MCQ' && 'Multiple Choice — single correct'}
                    {activeSection.type === 'MSQ' && 'Multiple Select — one or more correct'}
                  </span>
                </div>

                <div className="question-list" id="omr-question-list">
                  {Array.from({ length: activeSection.count }).map((_, i) => {
                    const qid = String(activeSection.startQ + i);
                    const isActive = trackingMode === 'auto' && activeQuestionId === qid;
                    const isManualRunning = trackingMode === 'manual' && manualRunningQid === qid;
                    const hasKey = keys && keys[activeSection.type]?.[qid];
                    const correctKey = hasKey ? keys![activeSection.type][qid] : null;
                    const timeVal = questionTimes[qid] ?? 0;

                    let correct: boolean | null = null;
                    const hasAns = answers[qid] !== undefined && answers[qid] !== '' && !(Array.isArray(answers[qid]) && answers[qid].length === 0);
                    if (correctKey && (submitted || (checked && hasAns))) {
                      if (activeSection.type === 'NAT') correct = verifyNat(qid, correctKey as string);
                      else if (activeSection.type === 'MCQ') correct = verifyMcq(qid, correctKey as string);
                      else correct = verifyMsq(qid, correctKey);
                    }

                    const isFlagged = flaggedQuestions.includes(qid);
                    return (
                      <div
                        key={qid}
                        id={`omr-question-row-${qid}`}
                        className={`question-row ${isActive ? 'active' : ''} ${submitted ? 'locked' : ''} ${isFlagged ? 'flagged' : ''}`}
                        onClick={() => { if (trackingMode === 'auto') setActiveQuestionId(qid); }}
                      >
                        <div className="q-label mono flex items-center gap-1">
                          <button
                            onClick={(e) => { e.stopPropagation(); onToggleFlag(qid); }}
                            id={`omr-flag-btn-${qid}`}
                            className={`flag-action-btn ${isFlagged ? 'flagged' : ''}`}
                            title={isFlagged ? 'Flagged for review' : 'Flag for review'}
                            aria-label={isFlagged ? `Question ${qid} flagged. Tap to unflag.` : `Flag question ${qid} for review`}
                            style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '0', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', color: isFlagged ? 'var(--warning, #ffaa00)' : 'var(--muted)' }}
                          >
                            <Flag size={11} fill={isFlagged ? 'var(--warning, #ffaa00)' : 'transparent'} />
                          </button>
                          <span>Q.{qid}</span>
                        </div>
                        
                        <div className="q-controls">
                          {activeSection.type === 'NAT' ? (
                            <>
                              <input
                                type="text"
                                id={`omr-input-nat-${qid}`}
                                value={(answers[qid] as string) ?? ''}
                                onChange={e => handleNat(qid, e.target.value)}
                                placeholder="—"
                                disabled={submitted}
                                className={`nat-input ${showResults && correct === true ? 'correct' : showResults && correct === false ? 'wrong' : ''}`}
                                onClick={e => e.stopPropagation()}
                              />
                              {showResults && correctKey && correct !== null && (
                                <div className={`verify-note result-${correct ? 'ok' : 'bad'}`}>
                                  {correct ? '✓ Correct' : `✗ Key: ${correctKey}`}
                                </div>
                              )}
                            </>
                          ) : (
                            <>
                              <div className="choice-row">
                                {['A','B','C','D'].map(opt => {
                                  const selected = activeSection.type === 'MSQ'
                                    ? ((answers[qid] as string[]) ?? []).includes(opt)
                                    : answers[qid] === opt;
                                  const isCorrectOpt = showResults && correctKey && (
                                    activeSection.type === 'MSQ'
                                      ? (Array.isArray(correctKey) ? (Array.isArray(correctKey[0]) ? (correctKey as string[][]).flat() : (correctKey as string[])) : [correctKey as string]).map((x: string) => String(x).toUpperCase()).includes(opt.toUpperCase())
                                      : String(correctKey).toUpperCase() === opt.toUpperCase()
                                  );
                                  return (
                                    <button
                                      key={opt}
                                      id={`omr-btn-choice-${qid}-${opt}`}
                                      disabled={submitted}
                                      onClick={e => { e.stopPropagation(); if (activeSection.type === 'MSQ') { handleMsq(qid, opt); } else { handleMcq(qid, opt); } }}
                                      className={`choice-btn ${selected ? (showResults ? (isCorrectOpt ? 'correct' : 'wrong') : 'selected') : (showResults && isCorrectOpt ? 'correct' : '')}`}
                                      aria-label={activeSection.type === 'MSQ' ? `Option ${opt} for Question ${qid} (multiple select)` : `Option ${opt} for Question ${qid}`}
                                    >
                                      {opt}
                                    </button>
                                  );
                                })}
                              </div>
                              {showResults && correctKey && correct !== null && (
                                <div className={`verify-note result-${correct ? 'ok' : 'bad'}`}>
                                  {correct 
                                    ? '✓ Correct' 
                                    : `✗ Key: ${Array.isArray(correctKey) ? (Array.isArray(correctKey[0]) ? (correctKey as string[][]).map((k: string[]) => k.join('+')).join('/') : (correctKey as string[]).join('+')) : correctKey}`
                                  }
                                </div>
                              )}
                            </>
                          )}
                        </div>

                        {trackingMode !== 'off' && (
                          <div className="q-time-col">
                            <div className="q-time-row">
                              {(isActive || isManualRunning) && (
                                <span className="live-badge mono">LIVE</span>
                              )}
                              <span className={`q-time mono ${isActive || isManualRunning ? 'live' : ''}`}>
                                {fmtTime(timeVal)}
                              </span>
                            </div>
                            {trackingMode === 'manual' && !submitted && (
                              <button
                                className="manual-timer-btn"
                                onClick={e => { e.stopPropagation(); setManualRunningQid(isManualRunning ? null : qid); }}
                              >
                                {isManualRunning ? <Pause size={10} /> : <Play size={10} />}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        </>
      ) : (
        /* Contextual page view */
        <div className="dock-contextual-content animate-fade-in">
          <div className="dock-page-indicator">
            <span className="mono">Page {pageNumber} questions</span>
          </div>

          <div className="dock-question-list">
            {activePageQs.length === 0 ? (
              <div className="dock-empty-card">
                <AlertCircle size={15} style={{ marginBottom: 6, color: 'var(--muted)' }} />
                <p>No response entries required for Page {pageNumber}.</p>
                <span className="text-[10px] color-[var(--muted-2)]" style={{ display: 'block', padding: '0 8px', lineHeight: 1.4 }}>
                  This page contains cover details, general instructions, or Part B drawing prompts that are solved directly on physical paper.
                </span>
              </div>
            ) : (
              activePageQs.map(qNum => {
                const qid = String(qNum);
                const sec = getQuestionSection(qNum);
                if (!sec) return null;

                const isActive = trackingMode === 'auto' && activeQuestionId === qid;
                const isManualRunning = trackingMode === 'manual' && manualRunningQid === qid;
                const hasKey = keys && keys[sec.type]?.[qid];
                const correctKey = hasKey ? keys![sec.type][qid] : null;
                const timeVal = questionTimes[qid] ?? 0;

                let correct: boolean | null = null;
                const hasAns = answers[qid] !== undefined && answers[qid] !== '' && !(Array.isArray(answers[qid]) && answers[qid].length === 0);
                if (correctKey && (submitted || (checked && hasAns))) {
                  if (sec.type === 'NAT') correct = verifyNat(qid, correctKey as string);
                  else if (sec.type === 'MCQ') correct = verifyMcq(qid, correctKey as string);
                  else correct = verifyMsq(qid, correctKey);
                }

                const isFlagged = flaggedQuestions.includes(qid);
                return (
                  <div 
                    key={qid}
                    id={`omr-dock-card-q-${qid}`}
                    className={`dock-question-card ${isActive ? 'active' : ''} ${submitted ? 'locked' : ''} ${isFlagged ? 'flagged' : ''}`}
                    onClick={() => { if (trackingMode === 'auto') setActiveQuestionId(qid); }}
                  >
                    <div className="dock-card-header">
                      <span className="mono font-semibold text-xs flex items-center gap-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); onToggleFlag(qid); }}
                          id={`omr-dock-flag-btn-${qid}`}
                          className={`flag-action-btn ${isFlagged ? 'flagged' : ''}`}
                          title={isFlagged ? 'Flagged for review' : 'Flag for review'}
                          aria-label={isFlagged ? `Question ${qid} flagged. Tap to unflag.` : `Flag question ${qid} for review`}
                          style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '0', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', color: isFlagged ? 'var(--warning, #ffaa00)' : 'var(--muted-2)' }}
                        >
                          <Flag size={10} fill={isFlagged ? 'var(--warning, #ffaa00)' : 'transparent'} />
                        </button>
                        <span>Q.{qid}</span>
                        <span className="text-[10px] font-normal text-muted-2">({sec.type})</span>
                      </span>
                      
                      {trackingMode !== 'off' && (
                        <span className={`dock-q-time mono ${isActive || isManualRunning ? 'live' : ''}`}>
                          {(isActive || isManualRunning) && <span className="live-badge-dot" />}
                          {fmtTime(timeVal)}
                        </span>
                      )}
                    </div>

                    <div className="dock-card-body">
                      {sec.type === 'NAT' ? (
                        <div className="flex flex-col gap-2 w-full">
                          <input
                            type="text"
                            id={`omr-dock-input-nat-${qid}`}
                            value={(answers[qid] as string) ?? ''}
                            onChange={e => handleNat(qid, e.target.value)}
                            placeholder="Type value..."
                            disabled={submitted}
                            className={`nat-input dock-input ${showResults && correct === true ? 'correct' : showResults && correct === false ? 'wrong' : ''}`}
                            onClick={e => e.stopPropagation()}
                          />
                          {showResults && correctKey && correct !== null && (
                            <span className={`verify-note text-[10px] result-${correct ? 'ok' : 'bad'}`}>
                              {correct ? '✓ Correct' : `✗ Key: ${correctKey}`}
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2 w-full">
                          <div className="choice-row dock-row">
                            {['A','B','C','D'].map(opt => {
                              const selected = sec.type === 'MSQ'
                                ? ((answers[qid] as string[]) ?? []).includes(opt)
                                : answers[qid] === opt;
                              const isCorrectOpt = showResults && correctKey && (
                                sec.type === 'MSQ'
                                  ? (Array.isArray(correctKey) ? (Array.isArray(correctKey[0]) ? (correctKey as string[][]).flat() : (correctKey as string[])) : [correctKey as string]).map((x: string) => String(x).toUpperCase()).includes(opt.toUpperCase())
                                  : String(correctKey).toUpperCase() === opt.toUpperCase()
                              );
                              return (
                                <button
                                  key={opt}
                                  id={`omr-dock-btn-choice-${qid}-${opt}`}
                                  disabled={submitted}
                                  onClick={e => { e.stopPropagation(); if (sec.type === 'MSQ') { handleMsq(qid, opt); } else { handleMcq(qid, opt); } }}
                                  className={`choice-btn ${selected ? (showResults ? (isCorrectOpt ? 'correct' : 'wrong') : 'selected') : (showResults && isCorrectOpt ? 'correct' : '')}`}
                                  aria-label={sec.type === 'MSQ' ? `Option ${opt} for Question ${qid} (multiple choice)` : `Option ${opt} for Question ${qid}`}
                                >
                                  {opt}
                                </button>
                              );
                            })}
                          </div>
                          {showResults && correctKey && correct !== null && (
                            <span className={`verify-note text-[10px] result-${correct ? 'ok' : 'bad'}`}>
                              {correct 
                                ? '✓ Correct' 
                                : `✗ Key: ${Array.isArray(correctKey) ? (Array.isArray(correctKey[0]) ? (correctKey as string[][]).map((k: string[]) => k.join('+')).join('/') : (correctKey as string[]).join('+')) : correctKey}`
                              }
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Footer controls: Check toggle, Submit and Reset */}
      <div className="sheet-footer">
        {!submitted ? (
          <>
            <button
              onClick={() => { if (keys) setChecked(c => !c); }}
              id="omr-btn-check-toggle"
              className={`check-toggle-btn ${checked ? 'active' : ''} ${!keys ? 'disabled' : ''}`}
              disabled={!keys}
              aria-label={checked ? 'Hide answer check results' : 'Check answered questions instantly'}
              title={!keys ? 'No answer key available for this paper' : ''}
            >
              {checked ? <><X size={11} /> Hide Check</> : <><Check size={11} /> Check Answer</>}
            </button>
            <button 
              onClick={() => { if (keys) setShowConfirmSubmit(true); }}
              id="omr-btn-check-answers"
              className={`submit-practice-btn ${!keys ? 'disabled' : ''}`}
              disabled={!keys}
              aria-label="Grade response sheet and check answers"
              title={!keys ? 'No answer key available for this paper' : ''}
            >
              <Award size={14} />
              <span>Submit All</span>
            </button>
          </>
        ) : (
          <div className="flex flex-col gap-2 w-full">
            <button 
              onClick={() => setShowReport(true)}
              id="omr-btn-show-report"
              className="submit-practice-btn check-answers-active"
            >
              <Award size={14} />
              <span>Show Report Card</span>
            </button>
            <button 
              onClick={onResetSession}
              id="omr-btn-reset"
              className="sheet-reset-btn"
            >
              <RotateCcw size={12} />
              <span>Reset Practice Session</span>
            </button>
          </div>
        )}
      </div>

      {/* Evaluation Performance Report Modal */}
      {showReport && (
        <div className="report-modal-overlay animate-fade-in">
          <div className="report-modal-card animate-zoom-in">
            <button onClick={() => setShowReport(false)} className="close-modal-btn">
              <X size={16} />
            </button>

            <div className="report-header">
              <div className="report-badge">PRACTICE REPORT</div>
              <h2>Performance Analytics</h2>
            </div>

            {/* Score Stats Grid */}
            <div className="report-score-banner">
              <div className="stat-box">
                <span className="label">Total Score</span>
                <span className="value mono">{score !== null ? score.toFixed(2) : '--'}</span>
                <span className="max mono">/ {totalMarks} pts</span>
              </div>
              <div className="v-divider" />
              <div className="stat-box">
                <span className="label">Questions Attempted</span>
                <span className="value mono">{totalAnswered}</span>
                <span className="max mono">/ {totalQuestions} total</span>
              </div>
              <div className="v-divider" />
              <div className="stat-box">
                <span className="label">Overall Accuracy</span>
                <span className="value mono">
                  {totalAnswered > 0 && keys ? (
                    // Simple estimate of correct questions
                    // Count how many correct
                    `${Math.round((sections.reduce((acc, sec) => {
                      const secKeys = keys[sec.type] || {};
                      let correctCount = 0;
                      for(let i=0; i<sec.count; i++){
                        const qid = String(sec.startQ + i);
                        const correctKey = secKeys[qid];
                        if (correctKey && answers[qid]) {
                          if (sec.type === 'NAT' && verifyNat(qid, correctKey as string) === true) correctCount++;
                          else if (sec.type === 'MCQ' && verifyMcq(qid, correctKey as string) === true) correctCount++;
                          else if (sec.type === 'MSQ' && verifyMsq(qid, correctKey) === true) correctCount++;
                        }
                      }
                      return acc + correctCount;
                    }, 0) / totalAnswered) * 100)}%`
                  ) : '--'}
                </span>
                <span className="max">of attempted</span>
              </div>
            </div>

            {/* Section Summary breakdown */}
            <div className="report-section-breakdown">
              <h3>Section Breakdown</h3>
              <div className="section-grid">
                {sections.map(sec => {
                  const attempted = getAttempted(sec);
                  // Calculate points obtained in this section
                    let secScore = 0;
                    const secKeys = keys ? keys[sec.type] || {} : {};
                    let secCorrect = 0;
                    let secTotal = 0;
                    
                    if (keys) {
                      for(let i=0; i<sec.count; i++) {
                        const qid = String(sec.startQ + i);
                        const key = secKeys[qid];
                        if (!key || !answers[qid]) continue;
                        
                        if (sec.type === 'NAT') {
                          if (verifyNat(qid, key as string) === true) secScore += 4;
                          secTotal += 4;
                        } else if (sec.type === 'MCQ') {
                          const res = evaluateMcq(answers[qid] as string, key as string, examType);
                          secScore += res.marks;
                          secTotal += 4;
                          if (res.isCorrect) secCorrect++;
                        } else if (sec.type === 'MSQ') {
                          const res = evaluateMsq(answers[qid] as string[], key as string[]);
                          secScore += res.marks;
                          secTotal += 4;
                          if (res.isCorrect) secCorrect++;
                        }
                      }
                    }
                    
                    return (
                      <div key={sec.id} className="sec-breakdown-card">
                        <div className="flex justify-between items-center mb-2">
                          <h4>{sec.type} Section</h4>
                          <span className="mono text-xs font-semibold">{secScore.toFixed(1)}<span className="text-muted-2 font-normal">/{secTotal || sec.count * 4}</span></span>
                        </div>
                        <div className="flex justify-between text-[11px] text-muted-2">
                          <span>Attempted: {attempted}/{sec.count}</span>
                          {keys && <span>Correct: {secCorrect}</span>}
                        </div>
                      </div>
                    );
                })}
              </div>
            </div>

            {/* Timing & Accuracy details list */}
            <div className="report-details-list">
              <h3>Question Timeline Analysis</h3>
              <div className="table-container">
                <table className="timeline-table">
                  <thead>
                    <tr>
                      <th>Question</th>
                      <th>Type</th>
                      <th>Answer</th>
                      <th>Correct Key</th>
                      <th>Time</th>
                      <th>Rec. Time</th>
                      <th>Efficiency</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sections.flatMap(sec => {
                      const secKeys = keys ? keys[sec.type] || {} : {};
                      return Array.from({ length: sec.count }).map((_, idx) => {
                        const qNum = sec.startQ + idx;
                        const qid = String(qNum);
                        const userAns = answers[qid];
                        const key = secKeys[qid];
                        const timeVal = questionTimes[qid] ?? 0;
                        const recTime = getRecommendedTime(sec.type);
                        
                        let correct: boolean | null = null;
                        if (key) {
                          if (sec.type === 'NAT') correct = verifyNat(qid, key as string);
                          else if (sec.type === 'MCQ') correct = verifyMcq(qid, key as string);
                          else correct = verifyMsq(qid, key);
                        }

                        const ansStr = userAns 
                          ? (Array.isArray(userAns) ? userAns.join('+') : String(userAns)) 
                          : '—';
                        const keyStr = key 
                          ? (Array.isArray(key) ? (Array.isArray(key[0]) ? (key as string[][]).map((k: string[]) => k.join('+')).join(' / ') : (key as string[]).join('+')) : String(key))
                          : '—';

                        const timeDiff = recTime - timeVal;
                        const efficiencyClass = timeDiff >= 0 ? 'eff-good' : 'eff-bad';
                        const efficiencyLabel = timeDiff >= 0 
                          ? `-${fmtTime(timeDiff)} ahead` 
                          : `+${fmtTime(Math.abs(timeDiff))} over`;

                        const isFlagged = flaggedQuestions.includes(qid);
                        return (
                          <tr key={qid} className={`${correct === true ? 'row-correct' : correct === false ? 'row-wrong' : 'row-unanswered'} ${isFlagged ? 'row-flagged' : ''}`}>
                            <td className="mono font-semibold">
                              {isFlagged && <Flag size={9} fill="var(--warning, #ffaa00)" color="var(--warning, #ffaa00)" style={{ marginRight: 4, verticalAlign: 'middle' }} />}
                              <span>Q.{qid}</span>
                            </td>
                            <td>{sec.type}</td>
                            <td className="mono text-xs">{ansStr}</td>
                            <td className="mono text-xs">{keyStr}</td>
                            <td className="mono">{fmtTime(timeVal)}</td>
                            <td className="mono text-muted-2">{fmtTime(recTime)}</td>
                            <td className={`mono text-xs ${efficiencyClass}`}>{efficiencyLabel}</td>
                          </tr>
                        );
                      });
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="report-modal-footer">
              <button onClick={() => setShowReport(false)} className="close-report-btn">
                Close Report
              </button>
            </div>
          </div>
        </div>
      )}
      {showConfirmSubmit && (
        <div className="report-modal-overlay animate-fade-in" style={{ zIndex: 110 }}>
          <div className="report-modal-card animate-zoom-in" style={{ maxWidth: '400px', padding: '20px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text)', margin: '0 0 8px' }}>Submit & Grade Answer Sheet?</h3>
            <p style={{ fontSize: '12px', color: 'var(--muted)', margin: '0 0 16px', lineHeight: 1.5 }}>
              Ready to grade your work? This will finalize your responses, lock all inputs to prevent further changes, evaluate your choices against the official key, and compile your performance analytics report.
            </p>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button 
                onClick={() => setShowConfirmSubmit(false)} 
                className="sheet-reset-btn"
                style={{ width: 'auto', padding: '0 12px', height: '30px' }}
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  setShowConfirmSubmit(false);
                  setSubmitted(true);
                }} 
                className="submit-practice-btn"
                style={{ width: 'auto', padding: '0 14px', height: '30px' }}
              >
                Grade Sheet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
