'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { storage } from '../utils/storage';
import { QuestionSection } from '../utils/scoring';

interface PaperInfo {
  id: string;
  exam: string;
  year: number;
  sections: QuestionSection[];
}

interface DashboardProps {
  papers: PaperInfo[];
  onSelectPaper: (id: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ papers, onSelectPaper }) => {
  const [filter, setFilter] = useState<'all' | 'uceed' | 'ceed'>('all');
  const [search, setSearch] = useState('');
  const [progress, setProgress] = useState<{ [paperId: string]: { attempted: number; total: number } }>({});

  useEffect(() => {
    const loadAllProgress = async () => {
      const progressMap: typeof progress = {};
      for (const paper of papers) {
        const answers = await storage.getAnswers(paper.id);
        let attempted = 0;
        let total = 0;
        paper.sections.forEach((sec) => {
          total += sec.count;
          for (let i = 0; i < sec.count; i++) {
            const ans = answers[String(sec.startQ + i)];
            if (ans && (Array.isArray(ans) ? ans.length > 0 : String(ans).trim() !== '')) attempted++;
          }
        });
        progressMap[paper.id] = { attempted, total };
      }
      setProgress(progressMap);
    };
    if (papers.length > 0) loadAllProgress();
  }, [papers]);

  const filteredPapers = useMemo(() => papers.filter((p) => {
    const matchFilter = filter === 'all' || p.exam.toLowerCase() === filter;
    const matchSearch = p.exam.toLowerCase().includes(search.toLowerCase()) || p.year.toString().includes(search);
    return matchFilter && matchSearch;
  }), [filter, papers, search]);

  return (
    <div className="dashboard-screen">
      {/* Top bar */}
      <div className="dashboard-topbar">
        <div className="dashboard-brand">
          <span className="dashboard-brand-dot" />
          DesignPrep Canvas
        </div>

        <div className="dashboard-controls">
          <div className="filter-bar">
            {(['all', 'uceed', 'ceed'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setFilter(type)}
                className={`filter-tab${filter === type ? ' active' : ''}`}
              >
                {type}
              </button>
            ))}
          </div>

          <label className="search-box">
            <Search size={14} />
            <input
              type="text"
              placeholder="Search year or exam"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
        </div>
      </div>

      {/* Body */}
      <div className="dashboard-body">
        <div className="dashboard-section-label">
          {filteredPapers.length} paper{filteredPapers.length !== 1 ? 's' : ''} available
        </div>

        <div className="paper-grid">
          {filteredPapers.length > 0 ? filteredPapers.map((paper) => {
            const prog = progress[paper.id] || { attempted: 0, total: 0 };
            const percent = prog.total > 0 ? Math.round((prog.attempted / prog.total) * 100) : 0;
            const hasStarted = prog.attempted > 0;

            return (
              <button
                key={paper.id}
                onClick={() => onSelectPaper(paper.id)}
                className="paper-card"
              >
                {/* Year — typographically dominant */}
                <div className="paper-year serif">{paper.year}</div>

                {/* Meta */}
                <div className="paper-meta">
                  <span className={`paper-exam-chip${paper.exam === 'CEED' ? ' ceed' : ''}`}>
                    {paper.exam}
                  </span>
                  <div className="paper-progress-text">
                    {hasStarted
                      ? `${prog.attempted} / ${prog.total} answered`
                      : `${paper.sections.length} sections · not started`}
                  </div>
                  {hasStarted && (
                    <div className="paper-progress-bar">
                      <div className="paper-progress-fill" style={{ width: `${percent}%` }} />
                    </div>
                  )}
                </div>

                {/* Action */}
                <div className="paper-action">
                  {hasStarted ? 'Resume' : 'Start'} →
                </div>
              </button>
            );
          }) : (
            <div className="empty-state">No papers match this filter.</div>
          )}
        </div>
      </div>
    </div>
  );
};
