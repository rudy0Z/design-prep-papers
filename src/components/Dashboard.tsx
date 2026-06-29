'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Search, Play, FileWarning, RefreshCw, Bookmark } from 'lucide-react';
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
  useEffect(() => {
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
        setProgress(progressMap);
      } catch (err) {
        console.error('Error loading progress:', err);
      } finally {
        setIsLoadingProgress(false);
      }
    };
    if (papers.length > 0) loadAllProgress();
  }, [papers]);

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
        
        {/* Continue Practicing Section */}
        {inProgressPapers.length > 0 && !search && filter === 'all' && (
          <div className="dashboard-section" style={{ marginBottom: '36px' }}>
            <div className="dashboard-section-label flex items-center gap-1.5" style={{ color: 'var(--accent)' }}>
              <Bookmark size={11} fill="currentColor" />
              <span>Continue practicing</span>
            </div>
            
            <div className="paper-grid" style={{ marginBottom: '12px' }}>
              {inProgressPapers.map((paper) => {
                const prog = progress[paper.id] || { attempted: 0, total: 0 };
                const percent = prog.total > 0 ? Math.round((prog.attempted / prog.total) * 100) : 0;
                return (
                  <button
                    key={`inprogress-${paper.id}`}
                    onClick={() => onSelectPaper(paper.id)}
                    className="paper-card in-progress"
                    style={{ borderLeft: '3px solid var(--accent)' }}
                  >
                    <div className="paper-year serif">{paper.year}</div>
                    
                    <div className="paper-meta">
                      <div className="flex items-center gap-2">
                        <span className={`paper-exam-chip ${paper.exam === 'CEED' ? 'ceed' : ''}`}>
                          {paper.exam}
                        </span>
                        <span className="mono text-[10px] font-semibold" style={{ color: 'var(--accent)' }}>
                          {percent}% done
                        </span>
                      </div>
                      <div className="paper-progress-text">
                        {prog.attempted} / {prog.total} answered
                      </div>
                      <div className="paper-progress-bar">
                        <div className="paper-progress-fill" style={{ width: `${percent}%` }} />
                      </div>
                    </div>

                    <div className="paper-action flex items-center gap-1">
                      <span>Resume</span>
                      <Play size={9} fill="currentColor" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Papers List */}
        <div className="dashboard-section">
          <div className="dashboard-section-label">
            {filteredPapers.length} paper{filteredPapers.length !== 1 ? 's' : ''} listed
          </div>

          {filteredPapers.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {groupedPapers.map(([year, yearPapers]) => (
                <div key={year} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ 
                    fontFamily: 'var(--font-mono)', 
                    fontSize: '11px', 
                    fontWeight: 600, 
                    color: 'var(--muted-2)',
                    borderBottom: '1px solid var(--border)',
                    paddingBottom: '4px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}>
                    {year} Edition
                  </div>
                  
                  <div className="paper-grid">
                    {yearPapers.map((paper) => {
                      const prog = progress[paper.id] || { attempted: 0, total: 0 };
                      const percent = prog.total > 0 ? Math.round((prog.attempted / prog.total) * 100) : 0;
                      const hasStarted = prog.attempted > 0;

                      return (
                        <button
                          key={paper.id}
                          onClick={() => onSelectPaper(paper.id)}
                          className="paper-card"
                        >
                          <div className="paper-year serif">{paper.year}</div>

                          <div className="paper-meta">
                            <span className={`paper-exam-chip ${paper.exam === 'CEED' ? 'ceed' : ''}`}>
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

                          <div className="paper-action">
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
                We couldn't find any papers matching "{search}" under {filter === 'all' ? 'any exam' : filter.toUpperCase()}.
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
