'use client';

import React, { useRef, useEffect, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist/types/src/display/api';
import { DrawingCanvas } from './DrawingCanvas';
import { Stroke, storage } from '../utils/storage';
import { FileWarning } from 'lucide-react';

interface PdfViewerProps {
  pdfUrl: string;
  pageNumber: number;
  setPageNumber: (page: number) => void;
  setNumPages: (num: number) => void;
  drawMode: boolean;
  brushColor: string;
  brushWidth: number;
  strokes: Stroke[];
  setStrokes: (strokes: Stroke[]) => void;
  activePaperId: string;
}

export const PdfViewer: React.FC<PdfViewerProps> = ({
  pdfUrl,
  pageNumber,
  setPageNumber,
  setNumPages,
  drawMode,
  brushColor,
  brushWidth,
  strokes,
  setStrokes,
  activePaperId
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string>('');
  
  // Dimensions & aspect ratio
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const [pageAspectRatio, setPageAspectRatio] = useState<number>(1.414); // default CEED/UCEED landscape aspect ratio
  const [zoomScale, setZoomScale] = useState<number>(1.0);

  // Scroll sync refs
  const isAutoScrollingRef = useRef(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Listen to wheel events on container for pinch-to-zoom and ctrl+scroll zoom
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
        const delta = -e.deltaY * 0.003;
        setZoomScale((prev) => {
          const next = prev + delta;
          return Math.max(0.4, Math.min(next, 3.0));
        });
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, []);

  // Measure container width for responsive scaling
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateWidth = () => {
      // Subtract padding
      setContainerWidth(Math.max(320, container.clientWidth - 48));
    };

    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  // Fetch the PDF
  useEffect(() => {
    if (!pdfUrl) return;
    setIsLoading(true);
    setLoadError('');
    setPdfDoc(null);
    setNumPages(0);

    let isCancelled = false;
    const controller = new AbortController();

    (async () => {
      try {
        const pdfjs = await import('pdfjs-dist');
        pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

        if (isCancelled) return;

        let pdfSource: any;

        // In production (Vercel), we pass the direct URL to PDF.js.
        // This enables progressive streaming & on-demand chunking (first page loads instantly!).
        // In development, Turbopack's hot-reload server has range request bugs that throw 204s,
        // so we fetch the raw bytes using standard fetch first.
        if (process.env.NODE_ENV === 'production') {
          pdfSource = {
            url: pdfUrl,
            disableRange: false,
            disableAutoFetch: false,
          };
        } else {
          const slug = pdfUrl.replace(/^\/data\//, '');
          const apiUrl = `/api/pdf/${slug}`;

          const response = await fetch(apiUrl, {
            signal: controller.signal,
          });

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          const arrayBuffer = await response.arrayBuffer();

          if (isCancelled) return;

          if (arrayBuffer.byteLength === 0) {
            throw new Error(`Received empty buffer from api`);
          }

          pdfSource = { data: arrayBuffer };
        }

        const loadingTask = pdfjs.getDocument(pdfSource);
        const pdf = await loadingTask.promise;

        if (isCancelled) {
          try { (pdf as any).destroy(); } catch (_) {}
          return;
        }

        setPdfDoc(pdf);
        setNumPages(pdf.numPages);
        setIsLoading(false);
      } catch (err: unknown) {
        if (isCancelled) return;
        if (err instanceof DOMException && err.name === 'AbortError') return;
        console.error('Error loading PDF:', err);
        const detail = err instanceof Error ? err.message : String(err);
        setLoadError(`PDF load failed: ${detail}`);
        setIsLoading(false);
      }
    })();

    return () => {
      isCancelled = true;
      controller.abort();
    };
  }, [pdfUrl, setNumPages]);

  // Determine correct page aspect ratio from the first page
  useEffect(() => {
    if (!pdfDoc) return;
    pdfDoc.getPage(1).then((page) => {
      const viewport = page.getViewport({ scale: 1.0 });
      if (viewport.width && viewport.height) {
        setPageAspectRatio(viewport.width / viewport.height);
      }
    }).catch((err) => {
      console.error('Error getting page aspect ratio:', err);
    });
  }, [pdfDoc]);

  // Page-to-Scroll sync: When header changes the pageNumber, scroll the container to that page
  useEffect(() => {
    if (!pdfDoc) return;
    const container = containerRef.current;
    if (!container) return;

    const targetElement = container.querySelector(`[data-page-number="${pageNumber}"]`);
    if (targetElement) {
      const rect = targetElement.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      const isInView = (
        rect.top >= containerRect.top - 50 &&
        rect.bottom <= containerRect.bottom + 50
      );

      if (!isInView) {
        isAutoScrollingRef.current = true;
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });

        if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
        scrollTimeoutRef.current = setTimeout(() => {
          isAutoScrollingRef.current = false;
        }, 800);
      }
    }
  }, [pageNumber, pdfDoc]);

  // Scroll-to-Page sync: When user scrolls, detect which page is dominant and update pageNumber
  const handleScroll = () => {
    if (isAutoScrollingRef.current) return;
    const container = containerRef.current;
    if (!container) return;

    const children = container.querySelectorAll('.pdf-page-wrapper');
    if (children.length === 0) return;

    let minDistance = Infinity;
    let closestPageNum = pageNumber;
    const containerCenter = container.getBoundingClientRect().top + container.clientHeight / 2;

    children.forEach((child) => {
      const rect = child.getBoundingClientRect();
      const childCenter = rect.top + rect.height / 2;
      const distance = Math.abs(childCenter - containerCenter);
      
      if (distance < minDistance) {
        minDistance = distance;
        const pNumAttr = child.getAttribute('data-page-number');
        if (pNumAttr) {
          closestPageNum = parseInt(pNumAttr);
        }
      }
    });

    if (closestPageNum !== pageNumber) {
      setPageNumber(closestPageNum);
    }
  };

  // Clean timeout on unmount
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    };
  }, []);

  const pageWidth = Math.min(containerWidth, 1200) * zoomScale;
  const pageHeight = pageWidth / pageAspectRatio;

  return (
    <div className="relative w-full h-full overflow-hidden" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <div 
        ref={containerRef} 
        className="pdf-stage" 
        onScroll={handleScroll}
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', height: '100%', overflowY: 'auto' }}
      >
        {isLoading && (
          <div className="pdf-loading">
            <div className="loading-card">
              <div className="spinner" />
              <h3>Loading question paper</h3>
              <p>Preparing the PDF canvas and annotation layer.</p>
            </div>
          </div>
        )}

        {pdfDoc && Array.from({ length: pdfDoc.numPages }, (_, i) => {
          const pageNum = i + 1;
          return (
            <PdfPageItem
              key={pageNum}
              pageNum={pageNum}
              pdfDoc={pdfDoc}
              drawMode={drawMode}
              brushColor={brushColor}
              brushWidth={brushWidth}
              isActive={pageNumber === pageNum}
              onPageActive={() => {
                if (pageNumber !== pageNum) {
                  setPageNumber(pageNum);
                }
              }}
              activeStrokes={strokes}
              setActiveStrokes={setStrokes}
              paperId={activePaperId}
              width={pageWidth}
              height={pageHeight}
            />
          );
        })}

        {!pdfDoc && !isLoading && (
          <div className="pdf-empty">
            <div className="pdf-empty-card">
              <div style={{ marginBottom: 12, color: 'var(--muted)' }}><FileWarning size={24} /></div>
              <h3>Question paper unavailable</h3>
              <p>{loadError || 'Select a paper with a valid PDF file to open the reading canvas.'}</p>
            </div>
          </div>
        )}
      </div>

      {/* Floating Zoom Widget */}
      {pdfDoc && (
        <div className="zoom-widget animate-fade-in">
          <button 
            onClick={() => setZoomScale(prev => Math.max(0.4, prev - 0.1))}
            title="Zoom Out"
            className="zoom-btn"
          >
            -
          </button>
          <span className="zoom-text mono">{Math.round(zoomScale * 100)}%</span>
          <button 
            onClick={() => setZoomScale(prev => Math.min(3.0, prev + 0.1))}
            title="Zoom In"
            className="zoom-btn"
          >
            +
          </button>
          <button 
            onClick={() => setZoomScale(1.0)}
            title="Reset Zoom"
            className="zoom-reset-btn"
          >
            Reset
          </button>
        </div>
      )}
    </div>
  );
};

interface PdfPageItemProps {
  pageNum: number;
  pdfDoc: PDFDocumentProxy;
  drawMode: boolean;
  brushColor: string;
  brushWidth: number;
  isActive: boolean;
  onPageActive: () => void;
  activeStrokes: Stroke[];
  setActiveStrokes: (strokes: Stroke[]) => void;
  paperId: string;
  width: number;
  height: number;
}

const PdfPageItem: React.FC<PdfPageItemProps> = ({
  pageNum,
  pdfDoc,
  drawMode,
  brushColor,
  brushWidth,
  isActive,
  onPageActive,
  activeStrokes,
  setActiveStrokes,
  paperId,
  width,
  height
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [localStrokes, setLocalStrokes] = useState<Stroke[]>([]);
  const [isRendered, setIsRendered] = useState(false);

  // Lazy-load pages using IntersectionObserver
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          setIsVisible(entry.isIntersecting);
        });
      },
      {
        root: null,
        rootMargin: '600px', // start loading 600px before coming in viewport
        threshold: 0.01
      }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  // Sync strokes for non-active pages
  useEffect(() => {
    if (isActive) return;
    let isCurrent = true;
    storage.getDrawingStrokes(paperId, pageNum).then((strokes) => {
      if (isCurrent) setLocalStrokes(strokes);
    });
    return () => { isCurrent = false; };
  }, [isActive, paperId, pageNum]);

  // Render canvas when page becomes visible in window viewport
  useEffect(() => {
    if (!isVisible || !pdfDoc) return;
    let isCancelled = false;
    let renderTask: any = null;

    pdfDoc.getPage(pageNum).then((page) => {
      if (isCancelled) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const viewport = page.getViewport({ scale: 1.0 });
      const scale = width / viewport.width;
      const scaledViewport = page.getViewport({ scale });

      canvas.width = width;
      canvas.height = height;

      renderTask = page.render({ canvasContext: ctx, canvas, viewport: scaledViewport });
      renderTask.promise.then(() => {
        if (!isCancelled) setIsRendered(true);
      }).catch((err: any) => {
        if (!isCancelled && err.name !== 'RenderingCancelledException') {
          console.error(`Page ${pageNum} render error:`, err);
        }
      });
    });

    return () => {
      isCancelled = true;
      if (renderTask) {
        try { renderTask.cancel(); } catch (_) {}
      }
    };
  }, [isVisible, pdfDoc, pageNum, width, height]);

  const currentStrokes = isActive ? activeStrokes : localStrokes;
  const currentSetStrokes = isActive ? setActiveStrokes : (newStrokes: Stroke[]) => {
    onPageActive();
    setActiveStrokes(newStrokes);
  };

  return (
    <div
      ref={containerRef}
      data-page-number={pageNum}
      className={`pdf-page-wrapper relative pdf-frame select-none`}
      style={{ 
        width: `${width}px`, 
        height: `${height}px`, 
        marginBottom: '24px',
        backgroundColor: '#ffffff'
      }}
      onPointerDown={() => {
        if (!isActive) {
          onPageActive();
        }
      }}
    >
      <canvas ref={canvasRef} className="block absolute top-0 left-0 w-full h-full" />
      
      {!isRendered && (
        <div className="absolute inset-0 flex items-center justify-center bg-white">
          <div className="spinner" style={{ margin: 0 }} />
        </div>
      )}

      {isRendered && (
        <DrawingCanvas
          strokes={currentStrokes}
          setStrokes={currentSetStrokes}
          drawMode={drawMode && isActive}
          brushColor={brushColor}
          brushWidth={brushWidth}
          width={width}
          height={height}
        />
      )}

      <div className="absolute bottom-3 right-3 px-2 py-1 rounded bg-black/60 text-white font-mono text-[10px] select-none pointer-events-none z-20">
        Page {pageNum}
      </div>
    </div>
  );
};
