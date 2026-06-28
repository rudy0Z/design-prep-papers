'use client';

import React, { useState } from 'react';
import { Eye, EyeOff, Play, Pause } from 'lucide-react';
import { QuestionSection, evaluateNat, evaluateMcq, evaluateMsq } from '../utils/scoring';

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
}

const fmtTime = (s: number) => {
  if (!s) return '';
  const m = Math.floor(s / 60), sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
};

export const OmrSheet: React.FC<OmrSheetProps> = ({
  sections, answers, setAnswer,
  verifiedSections, toggleVerifySection,
  keys, examType,
  questionTimes, activeQuestionId, setActiveQuestionId,
  trackingMode, setTrackingMode,
  manualRunningQid, setManualRunningQid,
}) => {
  const [activeTab, setActiveTab] = useState<string>(sections[0]?.id ?? '');
  const [revealKeys, setRevealKeys] = useState(false);

  const isPartB = activeTab === 'part-b';
  const activeSection = sections.find(s => s.id === activeTab) ?? sections[0];
  const isVerified = activeSection && verifiedSections.includes(activeSection.id);

  const getAttempted = (sec: QuestionSection) => {
    let n = 0;
    for (let i = 0; i < sec.count; i++) {
      const ans = answers[String(sec.startQ + i)];
      if (ans && (Array.isArray(ans) ? ans.length > 0 : String(ans).trim() !== '')) n++;
    }
    return n;
  };

  // Answer logic
  const handleNat = (qid: string, val: string) => {
    if (val === '' || /^-?[0-9.]*$/.test(val)) setAnswer(qid, val);
  };
  const handleMcq = (qid: string, opt: string) => setAnswer(qid, opt);
  const handleMsq = (qid: string, opt: string) => {
    const cur = (answers[qid] as string[]) ?? [];
    setAnswer(qid, cur.includes(opt) ? cur.filter(o => o !== opt) : [...cur, opt].sort());
  };

  // Verification helpers mapped directly to scoring utilities
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
      // Return true if any of the multiple accepted answer sets is fully correct
      return key.some((k: string[]) => evaluateMsq(opts, k).isCorrect);
    } else if (Array.isArray(key)) {
      return evaluateMsq(opts, key as string[]).isCorrect;
    }
    return null;
  };

  return (
    <div className="omr-sheet">
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

      {/* Content */}
      <div className="omr-content">
        {isPartB ? (
          <div className="partb-card animate-fade-in">
            <h3>Part B — Drawing Section</h3>
            <p>Part B requires manual sketching and layout presentation. Use the annotation tools on the PDF canvas to overlay notes or sketch concepts directly on the paper pages.</p>
          </div>
        ) : activeSection ? (
          <div className="animate-fade-in">
            {/* Section controls header */}
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

            {/* Question rows — single column */}
            <div className="question-list">
              {Array.from({ length: activeSection.count }).map((_, i) => {
                const qid = String(activeSection.startQ + i);
                const isActive = trackingMode === 'auto' && activeQuestionId === qid;
                const isManualRunning = trackingMode === 'manual' && manualRunningQid === qid;
                const hasKey = keys && keys[activeSection.type]?.[qid];
                const correctKey = hasKey ? keys![activeSection.type][qid] : null;
                const timeVal = questionTimes[qid] ?? 0;

                // Determine correctness for visual states
                let correct: boolean | null = null;
                if (isVerified && correctKey) {
                  if (activeSection.type === 'NAT') correct = verifyNat(qid, correctKey);
                  else if (activeSection.type === 'MCQ') correct = verifyMcq(qid, correctKey);
                  else correct = verifyMsq(qid, correctKey);
                }

                return (
                  <div
                    key={qid}
                    className={`question-row${isActive ? ' active' : ''}`}
                    onClick={() => { if (trackingMode === 'auto') setActiveQuestionId(qid); }}
                  >
                    {/* Q number */}
                    <div className="q-label mono">Q.{qid}</div>

                    {/* Answer input */}
                    <div className="q-controls">
                      {activeSection.type === 'NAT' ? (
                        <>
                          <input
                            type="text"
                            value={(answers[qid] as string) ?? ''}
                            onChange={e => handleNat(qid, e.target.value)}
                            placeholder="—"
                            className={`nat-input${isVerified && correct === true ? ' correct' : isVerified && correct === false ? ' wrong' : ''}`}
                            onClick={e => e.stopPropagation()}
                          />
                          {isVerified && correctKey && (
                            <div className={`verify-note result-${correct ? 'ok' : 'bad'}`}>
                              {correct ? '✓ Correct' : `✗ Ans: ${correctKey}`}
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
                              const isCorrectOpt = isVerified && correctKey && (
                                activeSection.type === 'MSQ'
                                  ? (Array.isArray(correctKey) ? (Array.isArray(correctKey[0]) ? correctKey.flat() : correctKey) : [correctKey]).map((x: string) => x.toUpperCase()).includes(opt.toUpperCase())
                                  : correctKey.toUpperCase() === opt.toUpperCase()
                              );
                              return (
                                <button
                                  key={opt}
                                  onClick={e => { e.stopPropagation(); activeSection.type === 'MSQ' ? handleMsq(qid, opt) : handleMcq(qid, opt); }}
                                  className={`choice-btn${selected ? (isVerified ? (isCorrectOpt ? ' correct' : ' wrong') : ' selected') : (isVerified && isCorrectOpt ? ' correct' : '')}`}
                                >
                                  {opt}
                                </button>
                              );
                            })}
                          </div>
                          {isVerified && correctKey && correct === false && (
                            <div className="verify-note result-bad">
                              {`✗ Key: ${Array.isArray(correctKey) ? (Array.isArray(correctKey[0]) ? correctKey.map((k: string[]) => k.join('+')).join(' / ') : (correctKey as string[]).join('+')) : correctKey}`}
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    {/* Time column */}
                    {trackingMode !== 'off' && (
                      <div className="q-time-col">
                        <span className={`q-time mono${isActive || isManualRunning ? ' live' : ''}`}>
                          {fmtTime(timeVal)}
                        </span>
                        {trackingMode === 'manual' && (
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

      {/* Footer: self-check + key reveal */}
      {!isPartB && activeSection && (
        <div className="omr-footer">
          <button
            onClick={() => toggleVerifySection(activeSection.id)}
            className={`primary-action${isVerified ? ' checking' : ''}`}
          >
            {isVerified ? 'Checking mode — click to edit' : 'Submit & check answers'}
          </button>
          {keys && (
            <>
              <button onClick={() => setRevealKeys(!revealKeys)} className="secondary-action">
                <span>{revealKeys ? 'Hide answer key' : 'Show answer key'}</span>
                {revealKeys ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
              {revealKeys && (
                <div className="key-panel animate-fade-in">
                  <div className="key-grid">
                    {(['NAT','MSQ','MCQ'] as const).map(type => (
                      <div key={type}>
                        <h4>{type}</h4>
                        {Object.entries(keys[type] ?? {}).map(([qid, val]) => (
                          <div key={qid} className="key-row">
                            <span>Q{qid}</span>
                            <strong>
                              {Array.isArray(val)
                                ? Array.isArray(val[0]) ? val.map((x: string[]) => x.join('+')).join(' / ') : (val as string[]).join('+')
                                : String(val)}
                            </strong>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};
