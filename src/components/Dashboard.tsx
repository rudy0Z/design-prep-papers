'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Search, Play, FileWarning, RefreshCw, Bookmark, Circle, Timer, CheckCircle2 } from 'lucide-react';
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
  const [isLoadingProgress, setIsLoadingProgress] = useState(true);

  // Parallel pre-loading of progress maps using Promise.all
  // Reloads on every mount (navigating back from a paper) to reflect latest answers
  useEffect(() => {
    let cancelled = false;
    const loadAllProgress = async () => {
      setIsLoadingProgress(true);
      try {
        const progressMap: typeof progress = {};
        await Promise.all(
          papers.map(async (paper) => {
            const answers = await storage.getAnswers(paper.id);
            let attempted = 0;
            let total = 0;
            paper.sections.forEach((sec) => {
              total += sec.count;
              for (let i = 0; i < sec.count; i++) {
                const ans = answers[String(sec.startQ + i)];
                if (ans && (Array.isArray(ans) ? ans.length > 0 : String(ans).trim() !== '')) {
                  attempted++;
                }
              }
            });
            progressMap[paper.id] = { attempted, total };
          })
        );
        if (!cancelled) setProgress(progressMap);
      } catch (err) {
        if (!cancelled) console.error('Error loading progress:', err);
      } finally {
        if (!cancelled) setIsLoadingProgress(false);
      }
    };
    if (papers.length > 0) loadAllProgress();
    return () => { cancelled = true; };
  }, []);

  const filteredPapers = useMemo(() => papers.filter((p) => {
    const matchFilter = filter === 'all' || p.exam.toLowerCase() === filter;
    
    // Support multi-term match, e.g. "uceed 2022" matches both
    const cleanSearch = search.trim().toLowerCase();
    if (!cleanSearch) return matchFilter;

    const terms = cleanSearch.split(/\s+/);
    const matchSearch = terms.every(term => 
      p.exam.toLowerCase().includes(term) || p.year.toString().includes(term)
    );
    
    return matchFilter && matchSearch;
  }), [filter, papers, search]);

  // Group papers by "In Progress" (attempted > 0) vs "Not Started"
  const inProgressPapers = useMemo(() => {
    if (isLoadingProgress) return [];
    return papers.filter(p => {
      const prog = progress[p.id];
      return prog && prog.attempted > 0;
    });
  }, [papers, progress, isLoadingProgress]);

  // Group remaining papers by year
  const groupedPapers = useMemo(() => {
    const groups: { [year: number]: PaperInfo[] } = {};
    filteredPapers.forEach(paper => {
      if (!groups[paper.year]) groups[paper.year] = [];
      groups[paper.year].push(paper);
    });
    // Sort years descending
    return Object.entries(groups).sort((a, b) => Number(b[0]) - Number(a[0]));
  }, [filteredPapers]);

  const clearFilters = () => {
    setFilter('all');
    setSearch('');
  };

  return (
    <div className="dashboard-screen">
      {/* Top bar */}
      <div className="dashboard-topbar">
        <h1 className="dashboard-brand" id="dashboard-brand-title">
          <span className="dashboard-brand-dot" />
          DesignPrep Canvas
        </h1>

        <div className="dashboard-controls">
          <div className="filter-bar">
            {(['all', 'uceed', 'ceed'] as const).map((type) => (
              <button
                key={type}
                id={`filter-tab-${type}`}
                onClick={() => setFilter(type)}
                className={`filter-tab${filter === type ? ' active' : ''}`}
                aria-label={`Show ${type} papers`}
              >
                {type}
              </button>
            ))}
          </div>

          <div className="search-box">
            <Search size={14} />
            <input
              type="text"
              id="search-papers-input"
              placeholder="Search year or exam (e.g. uceed 2023)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search exam papers"
            />
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="dashboard-body">
        
        {/* Unified Papers List */}
        <div className="dashboard-section">
          <div className="dashboard-section-label">
            Official PYQs · {filteredPapers.length} paper{filteredPapers.length !== 1 ? 's' : ''}
          </div>

          {filteredPapers.length > 0 ? (
            <div className="linear-table">
              {groupedPapers.map(([year, yearPapers]) => (
                <div key={year} className="linear-table-group">
                  <div className="linear-table-group-header mono">
                    {year} Edition
                  </div>
                  
                  <div className="linear-table-rows">
                    {yearPapers.map((paper) => {
                      const prog = progress[paper.id] || { attempted: 0, total: 0 };
                      const percent = prog.total > 0 ? Math.round((prog.attempted / prog.total) * 100) : 0;
                      const hasStarted = prog.attempted > 0;
                      const isCompleted = hasStarted && prog.attempted === prog.total;

                      return (
                        <button
                          key={paper.id}
                          id={`paper-row-${paper.id}`}
                          onClick={() => onSelectPaper(paper.id)}
                          className={`linear-table-row ${hasStarted ? 'in-progress' : ''}`}
                          aria-label={`Open ${paper.exam} ${paper.year} paper, status: ${isCompleted ? 'completed' : hasStarted ? `${percent}% done` : 'not started'}`}
                        >
                          <div className="cell-status">
                            {isCompleted ? (
                              <CheckCircle2 size={13} className="status-icon text-ok" />
                            ) : hasStarted ? (
                              <Timer size={13} className="status-icon text-warning animate-pulse" />
                            ) : (
                              <Circle size={13} className="status-icon text-muted" />
                            )}
                          </div>

                          <div className="cell-title">
                            <span className={`paper-exam-chip ${paper.exam.toLowerCase()}`}>
                              {paper.exam}
                            </span>
                            <span className="paper-name">{paper.year}</span>
                          </div>

                          <div className="cell-meta text-muted mono">
                            {paper.sections.length} Sections · {prog.total} Qs
                          </div>

                          <div className="cell-progress">
                            {hasStarted ? (
                              <div className="progress-container">
                                <div className="progress-bar">
                                  <div className="progress-fill" style={{ width: `${percent}%` }} />
                                </div>
                                <span className="progress-label mono text-accent">
                                  {percent}% <span className="progress-counts">({prog.attempted}/{prog.total})</span>
                                </span>
                              </div>
                            ) : (
                              <span className="text-muted text-[11px]">Not started</span>
                            )}
                          </div>

                          <div className="cell-action text-muted">
                            {hasStarted ? 'Resume' : 'Start'} →
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <FileWarning size={20} style={{ margin: '0 auto 10px', color: 'var(--muted)' }} />
              <h3>No matching papers</h3>
              <p style={{ color: 'var(--muted)', fontSize: '12px', margin: '4px 0 12px' }}>
                We couldn&apos;t find any papers matching &quot;{search}&quot; under {filter === 'all' ? 'any exam' : filter.toUpperCase()}.
              </p>
              <button onClick={clearFilters} className="sheet-reset-btn" style={{ width: 'auto', display: 'inline-flex', padding: '0 12px', height: '28px', gap: '4px' }}>
                <RefreshCw size={10} />
                <span>Clear Filters</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
