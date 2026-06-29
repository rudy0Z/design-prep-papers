'use client';

import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, Play, Pause, X, Check, Award, AlertCircle, Clock, LayoutGrid, FileText, RotateCcw } from 'lucide-react';
import { QuestionSection, evaluateNat, evaluateMcq, evaluateMsq, calculateScore } from '../utils/scoring';

interface OmrSheetProps {
  sections: QuestionSection[];
  answers: { [questionId: string]: string | string[] };
  setAnswer: (qid: string, val: string | string[]) => void;
  verifiedSections: string[];
  toggleVerifySection: (secId: string) => void;
  keys: { [sectionType: string]: { [questionId: string]: any } } | null;
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
  verifiedSections, toggleVerifySection,
  keys, examType,
  questionTimes, activeQuestionId, setActiveQuestionId,
  trackingMode, setTrackingMode,
  manualRunningQid, setManualRunningQid,
  submitted, setSubmitted,
  omrMode, setOmrMode,
  pageNumber, pageQuestions,
  onResetSession
}) => {
  const [activeTab, setActiveTab] = useState<string>(sections[0]?.id ?? '');
  const [revealKeys, setRevealKeys] = useState(false);
  const [showReport, setShowReport] = useState(false);

  const isPartB = activeTab === 'part-b';
  const activeSection = sections.find(s => s.id === activeTab) ?? sections[0];

  useEffect(() => {
    if (submitted) {
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

  const verifyMsq = (qid: string, key: any): boolean | null => {
    const opts = (answers[qid] as string[]) ?? [];
    if (!opts.length) return null;

    if (Array.isArray(key) && Array.isArray(key[0])) {
      return key.some((k: string[]) => evaluateMsq(opts, k).isCorrect);
    } else if (Array.isArray(key)) {
      return evaluateMsq(opts, key as string[]).isCorrect;
    }
    return null;
  };

  // Calculate score properties
  const { score, totalMarks, totalAnswered, totalQuestions } = calculateScore(answers, sections, keys, examType);

  const activePageQs = pageQuestions?.[String(pageNumber)] ?? [];

  return (
    <div className={`omr-sheet ${omrMode === 'page' ? 'sheet-docked' : 'sheet-full'}`}>
      
      {/* Title & View Switcher */}
      <div className="sheet-header">
        <h3>Response Sheet</h3>
        <div className="view-toggle-segmented">
          <button 
            onClick={() => setOmrMode('page')}
            className={omrMode === 'page' ? 'active' : ''}
            title="Show questions on current page"
          >
            <FileText size={13} />
            <span>Page View</span>
          </button>
          <button 
            onClick={() => setOmrMode('full')}
            className={omrMode === 'full' ? 'active' : ''}
            title="Show full sheet grid"
          >
            <LayoutGrid size={13} />
            <span>Full Sheet</span>
          </button>
        </div>
      </div>

      {omrMode === 'full' ? (
        <>
          {/* Section tabs */}
          <div className="omr-tabs">
            {sections.map(sec => {
              const attempted = getAttempted(sec);
              const pct = sec.count > 0 ? (attempted / sec.count) * 100 : 0;
              return (
                <button
                  key={sec.id}
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
            <button
              onClick={() => setActiveTab('part-b')}
              className={`omr-tab${activeTab === 'part-b' ? ' active' : ''}`}
            >
              <strong>Part B</strong>
              <span>Sketch</span>
              <div className="tab-indicator"><i style={{ width: 0 }} /></div>
            </button>
          </div>

          {/* Content area */}
          <div className="omr-content">
            {isPartB ? (
              <div className="partb-card animate-fade-in">
                <h3>Part B — Design Section</h3>
                <p>Part B requires manual sketching and layout presentation. Use the annotation tools on the PDF canvas to overlay notes or sketch concepts directly on the paper pages.</p>
              </div>
            ) : activeSection ? (
              <div className="animate-fade-in">
                <div className="section-head">
                  <span className="section-desc mono">
                    {activeSection.type === 'NAT' && 'Numerical Answer Type'}
                    {activeSection.type === 'MCQ' && 'Multiple Choice — single correct'}
                    {activeSection.type === 'MSQ' && 'Multiple Select — one or more correct'}
                  </span>
                  <div className="tracking-control">
                    <span>Track</span>
                    {(['auto', 'manual', 'off'] as const).map(m => (
                      <button
                        key={m}
                        onClick={() => setTrackingMode(m)}
                        className={trackingMode === m ? 'active' : ''}
                      >{m}</button>
                    ))}
                  </div>
                </div>

                <div className="question-list">
                  {Array.from({ length: activeSection.count }).map((_, i) => {
                    const qid = String(activeSection.startQ + i);
                    const isActive = trackingMode === 'auto' && activeQuestionId === qid;
                    const isManualRunning = trackingMode === 'manual' && manualRunningQid === qid;
                    const hasKey = keys && keys[activeSection.type]?.[qid];
                    const correctKey = hasKey ? keys![activeSection.type][qid] : null;
                    const timeVal = questionTimes[qid] ?? 0;

                    let correct: boolean | null = null;
                    if (submitted && correctKey) {
                      if (activeSection.type === 'NAT') correct = verifyNat(qid, correctKey);
                      else if (activeSection.type === 'MCQ') correct = verifyMcq(qid, correctKey);
                      else correct = verifyMsq(qid, correctKey);
                    }

                    return (
                      <div
                        key={qid}
                        className={`question-row ${isActive ? 'active' : ''} ${submitted ? 'locked' : ''}`}
                        onClick={() => { if (trackingMode === 'auto') setActiveQuestionId(qid); }}
                      >
                        <div className="q-label mono">Q.{qid}</div>
                        
                        <div className="q-controls">
                          {activeSection.type === 'NAT' ? (
                            <>
                              <input
                                type="text"
                                value={(answers[qid] as string) ?? ''}
                                onChange={e => handleNat(qid, e.target.value)}
                                placeholder="—"
                                disabled={submitted}
                                className={`nat-input ${submitted && correct === true ? 'correct' : submitted && correct === false ? 'wrong' : ''}`}
                                onClick={e => e.stopPropagation()}
                              />
                              {submitted && correctKey && (
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
                                  const isCorrectOpt = submitted && correctKey && (
                                    activeSection.type === 'MSQ'
                                      ? (Array.isArray(correctKey) ? (Array.isArray(correctKey[0]) ? correctKey.flat() : correctKey) : [correctKey]).map((x: string) => x.toUpperCase()).includes(opt.toUpperCase())
                                      : correctKey.toUpperCase() === opt.toUpperCase()
                                  );
                                  return (
                                    <button
                                      key={opt}
                                      disabled={submitted}
                                      onClick={e => { e.stopPropagation(); activeSection.type === 'MSQ' ? handleMsq(qid, opt) : handleMcq(qid, opt); }}
                                      className={`choice-btn ${selected ? (submitted ? (isCorrectOpt ? 'correct' : 'wrong') : 'selected') : (submitted && isCorrectOpt ? 'correct' : '')}`}
                                    >
                                      {opt}
                                    </button>
                                  );
                                })}
                              </div>
                              {submitted && correctKey && correct === false && (
                                <div className="verify-note result-bad">
                                  {`✗ Key: ${Array.isArray(correctKey) ? (Array.isArray(correctKey[0]) ? correctKey.map((k: string[]) => k.join('+')).join('/') : (correctKey as string[]).join('+')) : correctKey}`}
                                </div>
                              )}
                            </>
                          )}
                        </div>

                        {trackingMode !== 'off' && (
                          <div className="q-time-col">
                            <span className={`q-time mono ${isActive || isManualRunning ? 'live' : ''}`}>
                              {fmtTime(timeVal)}
                            </span>
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
                <p>No questions mapped on Page {pageNumber}.</p>
                <span className="text-[10px] color-[var(--muted-2)]">This is likely a instructions, cover, or Part B sketching page.</span>
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
                if (submitted && correctKey) {
                  if (sec.type === 'NAT') correct = verifyNat(qid, correctKey);
                  else if (sec.type === 'MCQ') correct = verifyMcq(qid, correctKey);
                  else correct = verifyMsq(qid, correctKey);
                }

                return (
                  <div 
                    key={qid}
                    className={`dock-question-card ${isActive ? 'active' : ''} ${submitted ? 'locked' : ''}`}
                    onClick={() => { if (trackingMode === 'auto') setActiveQuestionId(qid); }}
                  >
                    <div className="dock-card-header">
                      <span className="mono font-semibold text-xs">Q.{qid} <span className="text-[10px] font-normal text-muted-2">({sec.type})</span></span>
                      
                      {trackingMode !== 'off' && (
                        <span className={`dock-q-time mono ${isActive || isManualRunning ? 'live' : ''}`}>
                          {fmtTime(timeVal)}
                        </span>
                      )}
                    </div>

                    <div className="dock-card-body">
                      {sec.type === 'NAT' ? (
                        <div className="flex flex-col gap-2 w-full">
                          <input
                            type="text"
                            value={(answers[qid] as string) ?? ''}
                            onChange={e => handleNat(qid, e.target.value)}
                            placeholder="Type value..."
                            disabled={submitted}
                            className={`nat-input dock-input ${submitted && correct === true ? 'correct' : submitted && correct === false ? 'wrong' : ''}`}
                            onClick={e => e.stopPropagation()}
                          />
                          {submitted && correctKey && (
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
                              const isCorrectOpt = submitted && correctKey && (
                                sec.type === 'MSQ'
                                  ? (Array.isArray(correctKey) ? (Array.isArray(correctKey[0]) ? correctKey.flat() : correctKey) : [correctKey]).map((x: string) => x.toUpperCase()).includes(opt.toUpperCase())
                                  : correctKey.toUpperCase() === opt.toUpperCase()
                              );
                              return (
                                <button
                                  key={opt}
                                  disabled={submitted}
                                  onClick={e => { e.stopPropagation(); sec.type === 'MSQ' ? handleMsq(qid, opt) : handleMcq(qid, opt); }}
                                  className={`choice-btn ${selected ? (submitted ? (isCorrectOpt ? 'correct' : 'wrong') : 'selected') : (submitted && isCorrectOpt ? 'correct' : '')}`}
                                >
                                  {opt}
                                </button>
                              );
                            })}
                          </div>
                          {submitted && correctKey && correct === false && (
                            <span className="verify-note text-[10px] result-bad">
                              {`✗ Key: ${Array.isArray(correctKey) ? (Array.isArray(correctKey[0]) ? correctKey.map((k: string[]) => k.join('+')).join('/') : (correctKey as string[]).join('+')) : correctKey}`}
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

      {/* Footer controls: Submit and Reset */}
      <div className="sheet-footer">
        {!submitted ? (
          <button 
            onClick={() => {
              if (window.confirm('Check answers now? This will lock all input and display your graded performance analytics.')) {
                setSubmitted(true);
              }
            }}
            className="submit-practice-btn"
          >
            <Check size={14} />
            <span>Check Answers</span>
          </button>
        ) : (
          <div className="flex flex-col gap-2 w-full">
            <button 
              onClick={() => setShowReport(true)}
              className="submit-practice-btn check-answers-active"
            >
              <Award size={14} />
              <span>Show Report Card</span>
            </button>
            <button 
              onClick={onResetSession}
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
              <div className="report-badge">CEED/UCEED PRACTICE SUMMARY</div>
              <h2>Performance Analytics</h2>
              <p>Practice session evaluation details and timeline efficiency.</p>
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
                          if (sec.type === 'NAT' && verifyNat(qid, correctKey) === true) correctCount++;
                          else if (sec.type === 'MCQ' && verifyMcq(qid, correctKey) === true) correctCount++;
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
                  
                  if (keys) {
                    for(let i=0; i<sec.count; i++) {
                      const qid = String(sec.startQ + i);
                      const key = secKeys[qid];
                      if (!key || !answers[qid]) continue;
                      
                      if (sec.type === 'NAT') {
                        if (verifyNat(qid, key) === true) secScore += 4;
                      } else if (sec.type === 'MCQ') {
                        const res = evaluateMcq(answers[qid] as string, key, examType);
                        secScore += res.marks;
                        if (res.isCorrect) secCorrect++;
                      } else if (sec.type === 'MSQ') {
                        const res = evaluateMsq(answers[qid] as string[], key);
                        secScore += res.marks;
                        if (res.isCorrect) secCorrect++;
                      }
                    }
                  }
                  
                  return (
                    <div key={sec.id} className="sec-breakdown-card">
                      <div className="flex justify-between items-center mb-2">
                        <h4>{sec.type} Section</h4>
                        <span className="mono text-xs font-semibold">{secScore.toFixed(1)} pts</span>
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
                          if (sec.type === 'NAT') correct = verifyNat(qid, key);
                          else if (sec.type === 'MCQ') correct = verifyMcq(qid, key);
                          else correct = verifyMsq(qid, key);
                        }

                        const ansStr = userAns 
                          ? (Array.isArray(userAns) ? userAns.join('+') : String(userAns)) 
                          : '—';
                        const keyStr = key 
                          ? (Array.isArray(key) ? (Array.isArray(key[0]) ? key.map((k: string[]) => k.join('+')).join(' / ') : (key as string[]).join('+')) : String(key))
                          : '—';

                        const timeDiff = recTime - timeVal;
                        const efficiencyClass = timeDiff >= 0 ? 'eff-good' : 'eff-bad';
                        const efficiencyLabel = timeDiff >= 0 
                          ? `⚡ -${fmtTime(timeDiff)} ahead` 
                          : `🐢 +${fmtTime(Math.abs(timeDiff))} over`;

                        return (
                          <tr key={qid} className={correct === true ? 'row-correct' : correct === false ? 'row-wrong' : 'row-unanswered'}>
                            <td className="mono font-semibold">Q.{qid}</td>
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
                Close & Review Responses
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
