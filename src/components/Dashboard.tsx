'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { 
  Search, FileWarning, RefreshCw, Key, Circle, Timer, CheckCircle2, 
  Download, FileText, Sparkles, BookOpen, ExternalLink, Filter, 
  Layers, Compass, Palette, BookMarked
} from 'lucide-react';
import { storage } from '../utils/storage';
import { QuestionSection } from '../utils/scoring';
import { AppLogo } from './AppLogo';

export interface PaperInfo {
  id: string;
  exam: string;
  year: number;
  sections: QuestionSection[];
  pdfPath?: string;
  ansPath?: string | null;
  solutionPath?: string | null;
}

export interface OtherPaperInfo {
  id: string;
  exam: string;
  year: number;
  program: string;
  title: string;
  pdfPath: string;
  sizeMb: number;
  pages: number;
}

export interface BookItem {
  id: string;
  title: string;
  author: string;
  category: string;
  description: string;
  pdfPath: string;
  coverPath: string;
  sizeMb: number;
  pages: number;
}

interface DashboardProps {
  papers: PaperInfo[];
  otherPapers?: OtherPaperInfo[];
  books?: BookItem[];
  onSelectPaper: (id: string, docMode?: 'paper' | 'key' | 'solution') => void;
}

type MainTab = 'ceed_uceed' | 'nid' | 'nift' | 'arch' | 'books';

export const Dashboard: React.FC<DashboardProps> = ({ 
  papers, 
  otherPapers = [], 
  books = [], 
  onSelectPaper 
}) => {
  const [mainTab, setMainTab] = useState<MainTab>('ceed_uceed');
  
  // CEED & UCEED view state
  const [examFilter, setExamFilter] = useState<'all' | 'uceed' | 'ceed' | 'solutions'>('all');
  const [search, setSearch] = useState('');
  
  // Other exams filter
  const [otherProgramFilter, setOtherProgramFilter] = useState('all');
  const [otherSearch, setOtherSearch] = useState('');
  
  // Books filter
  const [bookCategory, setBookCategory] = useState('all');
  const [bookSearch, setBookSearch] = useState('');

  // Progress state for CEED/UCEED
  const [progress, setProgress] = useState<{ [paperId: string]: { attempted: number; total: number } }>({});
  const [isLoadingProgress, setIsLoadingProgress] = useState(true);

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

  // Counts
  const counts = useMemo(() => {
    return {
      all: papers.length,
      uceed: papers.filter((p) => p.exam.toLowerCase() === 'uceed').length,
      ceed: papers.filter((p) => p.exam.toLowerCase() === 'ceed').length,
      solutions: papers.filter((p) => Boolean(p.solutionPath)).length,
      nid: otherPapers.filter((p) => p.exam === 'NID').length,
      nift: otherPapers.filter((p) => p.exam === 'NIFT').length,
      arch: otherPapers.filter((p) => p.exam.includes('Architecture')).length,
      books: books.length,
    };
  }, [papers, otherPapers, books]);

  // Filtered CEED & UCEED Papers
  const filteredCeedUceed = useMemo(() => {
    return papers.filter((p) => {
      let matchFilter = true;
      if (examFilter === 'solutions') {
        matchFilter = Boolean(p.solutionPath);
      } else if (examFilter !== 'all') {
        matchFilter = p.exam.toLowerCase() === examFilter;
      }

      const cleanSearch = search.trim().toLowerCase();
      if (!cleanSearch) return matchFilter;

      const terms = cleanSearch.split(/\s+/);
      const matchSearch = terms.every((term) => {
        if (term === 'solution' || term === 'solutions' || term === 'sol') {
          return Boolean(p.solutionPath);
        }
        if (term === 'key' || term === 'answer' || term === 'ans') {
          return Boolean(p.ansPath);
        }
        return p.exam.toLowerCase().includes(term) || p.year.toString().includes(term);
      });

      return matchFilter && matchSearch;
    });
  }, [examFilter, papers, search]);

  // Group CEED/UCEED by Year
  const groupedCeedUceed = useMemo(() => {
    const groups: { [year: number]: PaperInfo[] } = {};
    filteredCeedUceed.forEach((paper) => {
      if (!groups[paper.year]) groups[paper.year] = [];
      groups[paper.year].push(paper);
    });
    return Object.entries(groups).sort((a, b) => Number(b[0]) - Number(a[0]));
  }, [filteredCeedUceed]);

  // Filtered Other Papers
  const filteredOtherPapers = useMemo(() => {
    let targetExam = '';
    if (mainTab === 'nid') targetExam = 'NID';
    if (mainTab === 'nift') targetExam = 'NIFT';
    if (mainTab === 'arch') targetExam = 'Architecture & M.Des';

    return otherPapers.filter((p) => {
      if (p.exam !== targetExam) return false;
      if (otherProgramFilter !== 'all' && !p.program.toLowerCase().includes(otherProgramFilter.toLowerCase())) {
        return false;
      }
      const q = otherSearch.trim().toLowerCase();
      if (!q) return true;
      return (
        p.title.toLowerCase().includes(q) ||
        p.program.toLowerCase().includes(q) ||
        p.year.toString().includes(q)
      );
    });
  }, [otherPapers, mainTab, otherProgramFilter, otherSearch]);

  // Distinct programs for currently selected other exam
  const otherPrograms = useMemo(() => {
    let targetExam = '';
    if (mainTab === 'nid') targetExam = 'NID';
    if (mainTab === 'nift') targetExam = 'NIFT';
    if (mainTab === 'arch') targetExam = 'Architecture & M.Des';
    const set = new Set<string>();
    otherPapers.filter((p) => p.exam === targetExam).forEach((p) => set.add(p.program));
    return Array.from(set);
  }, [otherPapers, mainTab]);

  // Book categories
  const bookCategories = useMemo(() => {
    const set = new Set<string>();
    books.forEach((b) => set.add(b.category));
    return ['all', ...Array.from(set)];
  }, [books]);

  // Filtered Books
  const filteredBooks = useMemo(() => {
    return books.filter((b) => {
      if (bookCategory !== 'all' && b.category !== bookCategory) return false;
      const q = bookSearch.trim().toLowerCase();
      if (!q) return true;
      return (
        b.title.toLowerCase().includes(q) ||
        b.author.toLowerCase().includes(q) ||
        b.description.toLowerCase().includes(q) ||
        b.category.toLowerCase().includes(q)
      );
    });
  }, [books, bookCategory, bookSearch]);

  return (
    <div className="dashboard-screen">
      {/* Top Header */}
      <div className="dashboard-topbar">
        <h1 className="dashboard-brand" id="dashboard-brand-title">
          <AppLogo size={28} />
          <span>DesignPrep Studio &amp; Library</span>
        </h1>

        {/* Global Main Category Switcher */}
        <div className="main-category-switcher mono" role="tablist">
          <button
            onClick={() => setMainTab('ceed_uceed')}
            className={`cat-tab ${mainTab === 'ceed_uceed' ? 'active' : ''}`}
            role="tab"
          >
            <Compass size={13} />
            <span>CEED &amp; UCEED</span>
            <span className="cat-count-badge">{counts.all}</span>
          </button>

          <button
            onClick={() => { setMainTab('nid'); setOtherProgramFilter('all'); }}
            className={`cat-tab ${mainTab === 'nid' ? 'active' : ''}`}
            role="tab"
          >
            <span>NID</span>
            <span className="cat-count-badge">{counts.nid}</span>
          </button>

          <button
            onClick={() => { setMainTab('nift'); setOtherProgramFilter('all'); }}
            className={`cat-tab ${mainTab === 'nift' ? 'active' : ''}`}
            role="tab"
          >
            <span>NIFT</span>
            <span className="cat-count-badge">{counts.nift}</span>
          </button>

          <button
            onClick={() => { setMainTab('arch'); setOtherProgramFilter('all'); }}
            className={`cat-tab ${mainTab === 'arch' ? 'active' : ''}`}
            role="tab"
          >
            <span>Architecture &amp; M.Des</span>
            <span className="cat-count-badge">{counts.arch}</span>
          </button>

          <button
            onClick={() => setMainTab('books')}
            className={`cat-tab books-tab ${mainTab === 'books' ? 'active' : ''}`}
            role="tab"
          >
            <BookOpen size={13} />
            <span>Design Books</span>
            <span className="cat-count-badge special">{counts.books}</span>
          </button>
        </div>
      </div>

      {/* Body Area */}
      <div className="dashboard-body">
        {/* ========================================================= */}
        {/* VIEW 1: CEED & UCEED (Interactive Tests, Answers & Sol)  */}
        {/* ========================================================= */}
        {mainTab === 'ceed_uceed' && (
          <div className="dashboard-section animate-fade-in">
            {/* Control Bar */}
            <div className="dashboard-subbar">
              {/* Filters & Search */}
              <div className="dashboard-controls" style={{ width: '100%', justifyContent: 'space-between' }}>
                <div className="filter-bar">
                  {(
                    [
                      { id: 'all', label: 'All', count: counts.all, isSpecial: false },
                      { id: 'uceed', label: 'UCEED', count: counts.uceed, isSpecial: false },
                      { id: 'ceed', label: 'CEED', count: counts.ceed, isSpecial: false },
                      { id: 'solutions', label: 'Solutions', count: counts.solutions, isSpecial: true },
                    ] satisfies Array<{ id: 'all' | 'uceed' | 'ceed' | 'solutions'; label: string; count: number; isSpecial: boolean }>
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      id={`filter-tab-${tab.id}`}
                      onClick={() => setExamFilter(tab.id)}
                      className={`filter-tab${examFilter === tab.id ? ' active' : ''}${tab.isSpecial ? ' filter-tab-special' : ''}`}
                      aria-label={`Show ${tab.label} papers`}
                    >
                      {tab.isSpecial && <Sparkles size={11} className="tab-special-icon" />}
                      <span>{tab.label}</span>
                      <span className="filter-tab-badge">{tab.count}</span>
                    </button>
                  ))}
                </div>

                <div className="search-box">
                  <Search size={14} />
                  <input
                    type="text"
                    id="search-papers-input"
                    placeholder="Search year, exam, or 'solution'..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    aria-label="Search exam papers"
                  />
                </div>
              </div>
            </div>

            {/* Sub-header status and download legend */}
            <div className="dashboard-section-header">
              <div className="dashboard-section-label">
                Official Papers &amp; Solutions · {filteredCeedUceed.length} paper{filteredCeedUceed.length !== 1 ? 's' : ''}
              </div>
              <div className="dashboard-download-legend mono">
                <span className="legend-item"><span className="legend-dot qp" /> QP: Paper</span>
                <span className="legend-item"><span className="legend-dot key" /> Key: Answer Key</span>
                <span className="legend-item"><span className="legend-dot sol" /> Sol: Detailed Solution</span>
              </div>
            </div>

            {/* Table */}
            {filteredCeedUceed.length > 0 ? (
              <div className="linear-table">
                <div className="linear-table-columns-header mono text-muted">
                  <span className="th-col th-status">Status</span>
                  <span className="th-col th-paper">Exam Edition</span>
                  <span className="th-col th-meta">Breakdown</span>
                  <span className="th-col th-progress">Progress</span>
                  <span className="th-col th-downloads">Quick Downloads (Paper / Key / Sol)</span>
                  <span className="th-col th-action">Practice</span>
                </div>

                {groupedCeedUceed.map(([year, yearPapers]) => (
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
                            onClick={() => onSelectPaper(paper.id, 'paper')}
                            className={`linear-table-row ${hasStarted ? 'in-progress' : ''}`}
                            aria-label={`Open ${paper.exam} ${paper.year} paper`}
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
                              {paper.sections.length} Secs · {prog.total} Qs
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

                            {/* Quick Direct Downloads */}
                            <div className="cell-downloads" onClick={(e) => e.stopPropagation()}>
                              {paper.pdfPath ? (
                                <a
                                  href={paper.pdfPath}
                                  download
                                  title={`Download ${paper.exam} ${paper.year} Question Paper`}
                                  className="dl-pill dl-pill-qp"
                                  aria-label="Download Question Paper"
                                >
                                  <FileText size={11} />
                                  <span>QP</span>
                                </a>
                              ) : (
                                <span className="dl-pill dl-pill-disabled" title="Question paper not available">—</span>
                              )}

                              {paper.ansPath ? (
                                <a
                                  href={paper.ansPath}
                                  download
                                  title={`Download ${paper.exam} ${paper.year} Official Answer Key`}
                                  className="dl-pill dl-pill-key"
                                  aria-label="Download Official Answer Key"
                                >
                                  <Key size={11} />
                                  <span>Key</span>
                                </a>
                              ) : (
                                <span className="dl-pill dl-pill-disabled" title="Official answer key not available">—</span>
                              )}

                              {paper.solutionPath ? (
                                <a
                                  href={paper.solutionPath}
                                  download
                                  title={`Download ${paper.exam} ${paper.year} Detailed Annotated Solution (by Sai Praveen)`}
                                  className="dl-pill dl-pill-solution"
                                  aria-label="Download Detailed Solution"
                                >
                                  <Sparkles size={11} />
                                  <span>Solution</span>
                                </a>
                              ) : (
                                <span className="dl-pill dl-pill-disabled" title="Detailed solution not available">—</span>
                              )}
                            </div>

                            <div className="cell-action text-muted">
                              {hasStarted ? 'Resume →' : 'Start →'}
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
                  No papers found matching your search.
                </p>
                <button
                  onClick={() => { setExamFilter('all'); setSearch(''); }}
                  className="sheet-reset-btn"
                  style={{ width: 'auto', display: 'inline-flex', padding: '0 12px', height: '28px', gap: '4px' }}
                >
                  <RefreshCw size={10} />
                  <span>Reset Filters</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* VIEW 2: NID, NIFT & Architecture Papers (Open & Download) */}
        {/* ========================================================= */}
        {(mainTab === 'nid' || mainTab === 'nift' || mainTab === 'arch') && (
          <div className="dashboard-section animate-fade-in">
            {/* Control Bar */}
            <div className="dashboard-subbar">
              <div className="filter-bar">
                <button
                  onClick={() => setOtherProgramFilter('all')}
                  className={`filter-tab ${otherProgramFilter === 'all' ? 'active' : ''}`}
                >
                  All ({otherPapers.filter((p) => p.exam === (mainTab === 'nid' ? 'NID' : mainTab === 'nift' ? 'NIFT' : 'Architecture & M.Des')).length})
                </button>
                {otherPrograms.map((prog) => (
                  <button
                    key={prog}
                    onClick={() => setOtherProgramFilter(prog)}
                    className={`filter-tab ${otherProgramFilter === prog ? 'active' : ''}`}
                  >
                    {prog}
                  </button>
                ))}
              </div>

              <div className="search-box">
                <Search size={14} />
                <input
                  type="text"
                  placeholder={`Search ${mainTab.toUpperCase()} papers...`}
                  value={otherSearch}
                  onChange={(e) => setOtherSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="dashboard-section-header">
              <div className="dashboard-section-label">
                {mainTab === 'nid' && 'National Institute of Design (NID) Past Year Papers'}
                {mainTab === 'nift' && 'National Institute of Fashion Technology (NIFT) Past Year Papers'}
                {mainTab === 'arch' && 'Architecture & Common M.Des Entrance Papers'}
                <span className="ml-2 text-muted text-xs font-normal">
                  ({filteredOtherPapers.length} paper{filteredOtherPapers.length !== 1 ? 's' : ''} available to view &amp; download)
                </span>
              </div>
            </div>

            {/* Other Papers Table */}
            {filteredOtherPapers.length > 0 ? (
              <div className="linear-table">
                <div className="other-table-columns-header mono text-muted">
                  <span className="th-col">Year</span>
                  <span className="th-col">Program</span>
                  <span className="th-col">Paper Title</span>
                  <span className="th-col">Pages &amp; Size</span>
                  <span className="th-col text-right">Actions</span>
                </div>

                <div className="linear-table-rows">
                  {filteredOtherPapers.map((paper) => (
                    <div key={paper.id} className="other-table-row">
                      <div className="mono font-semibold text-accent">
                        {paper.year}
                      </div>

                      <div>
                        <span className="program-badge">{paper.program}</span>
                      </div>

                      <div className="other-paper-title font-medium">
                        {paper.title}
                      </div>

                      <div className="cell-meta text-muted mono">
                        {paper.pages} pgs · {paper.sizeMb} MB
                      </div>

                      <div className="other-actions">
                        <button
                          type="button"
                          onClick={() => onSelectPaper(paper.id, 'paper')}
                          className="read-paper-btn"
                          title="Open paper in reading &amp; sketching studio"
                        >
                          <ExternalLink size={12} />
                          <span>Open Paper</span>
                        </button>

                        <a
                          href={paper.pdfPath}
                          download
                          className="dl-pill dl-pill-qp"
                          title={`Download ${paper.title} PDF`}
                        >
                          <Download size={11} />
                          <span>Download</span>
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="empty-state">
                <FileWarning size={20} style={{ margin: '0 auto 10px', color: 'var(--muted)' }} />
                <h3>No papers match your filter</h3>
                <button
                  onClick={() => { setOtherProgramFilter('all'); setOtherSearch(''); }}
                  className="sheet-reset-btn"
                  style={{ width: 'auto', display: 'inline-flex', padding: '0 12px', height: '28px', gap: '4px' }}
                >
                  <RefreshCw size={10} />
                  <span>Clear Filters</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* VIEW 3: Design Books Library (Rich Card Layout & Download)*/}
        {/* ========================================================= */}
        {mainTab === 'books' && (
          <div className="dashboard-section animate-fade-in">
            {/* Control Bar */}
            <div className="dashboard-subbar">
              <div className="filter-bar flex-wrap">
                {bookCategories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setBookCategory(cat)}
                    className={`filter-tab ${bookCategory === cat ? 'active' : ''}`}
                  >
                    {cat === 'all' ? `All Books (${counts.books})` : cat}
                  </button>
                ))}
              </div>

              <div className="search-box">
                <Search size={14} />
                <input
                  type="text"
                  placeholder="Search books by title, author, or keyword..."
                  value={bookSearch}
                  onChange={(e) => setBookSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="dashboard-section-header">
              <div className="dashboard-section-label">
                Art, Perspective &amp; Design Masterclasses ({filteredBooks.length} Handbooks)
                <span className="ml-2 text-muted text-xs font-normal">
                  — Curated foundational references available for high-speed download
                </span>
              </div>
            </div>

            {/* Books Card Grid */}
            {filteredBooks.length > 0 ? (
              <div className="books-card-grid">
                {filteredBooks.map((book) => (
                  <div key={book.id} className="book-card">
                    {/* Cover Image Container */}
                    <div className="book-cover-wrap">
                      <img
                        src={book.coverPath}
                        alt={book.title}
                        loading="lazy"
                        className="book-cover-img"
                      />
                      <span className="book-category-chip">{book.category}</span>
                    </div>

                    {/* Content */}
                    <div className="book-card-body">
                      <h3 className="book-title" title={book.title}>
                        {book.title}
                      </h3>
                      <div className="book-author mono text-muted">
                        by {book.author}
                      </div>
                      <p className="book-desc">
                        {book.description}
                      </p>
                    </div>

                    {/* Footer / Download Action */}
                    <div className="book-card-footer">
                      <div className="book-meta mono text-muted">
                        <span>{book.pages} pgs</span>
                        <span className="meta-dot">·</span>
                        <span className="book-size-badge">{book.sizeMb} MB</span>
                      </div>

                      <a
                        href={book.pdfPath}
                        download
                        className="book-download-btn"
                        title={`Download "${book.title}" (${book.sizeMb} MB PDF)`}
                      >
                        <Download size={13} />
                        <span>Download PDF</span>
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <FileWarning size={20} style={{ margin: '0 auto 10px', color: 'var(--muted)' }} />
                <h3>No books found matching your search</h3>
                <button
                  onClick={() => { setBookCategory('all'); setBookSearch(''); }}
                  className="sheet-reset-btn"
                  style={{ width: 'auto', display: 'inline-flex', padding: '0 12px', height: '28px', gap: '4px' }}
                >
                  <RefreshCw size={10} />
                  <span>Reset Search</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
