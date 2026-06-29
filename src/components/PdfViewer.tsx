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
  
  // Dimensions
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const [zoomScale, setZoomScale] = useState<number>(1.0);

  // Pre-loaded page aspect ratios: pageNum -> ratio (width/height)
  const [pageAspectRatios, setPageAspectRatios] = useState<Record<number, number>>({});
  const [ratiosReady, setRatiosReady] = useState(false);

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

  // Touch gesture support for pinch-to-zoom (Tablets/Phones)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let startDistance = 0;
    let startZoom = 1.0;

    const getDistance = (touches: TouchList) => {
      if (touches.length < 2) return 0;
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      return Math.sqrt(dx * dx + dy * dy);
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        startDistance = getDistance(e.touches);
        startZoom = zoomScale;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && startDistance > 0) {
        e.preventDefault();
        const currentDistance = getDistance(e.touches);
        const ratio = currentDistance / Math.max(1, startDistance);
        setZoomScale(() => {
          const next = startZoom * ratio;
          return Math.max(0.4, Math.min(next, 3.0));
        });
      }
    };

    const handleTouchEnd = () => {
      startDistance = 0;
    };

    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd);

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [zoomScale]);

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

  // Reset scroll to top and auto-scroll lock when switching papers
  useEffect(() => {
    isAutoScrollingRef.current = false;
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    const container = containerRef.current;
    if (container) {
      container.scrollTop = 0;
    }
  }, [pdfUrl]);

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

  // Fetched PDFs will resolve dimensions per page inside child components.

  // Pre-load ALL page aspect ratios as soon as PDF is ready — needed for accurate scroll-to-page
  useEffect(() => {
    if (!pdfDoc) {
      setPageAspectRatios({});
      setRatiosReady(false);
      return;
    }
    const pageCount = pdfDoc.numPages;
    const promises = Array.from({ length: pageCount }, (_, i) =>
      pdfDoc.getPage(i + 1).then((page) => {
        const vp = page.getViewport({ scale: 1.0 });
        const ratio = vp.width && vp.height ? vp.width / vp.height : 1.414;
        return [i + 1, isNaN(ratio) || ratio <= 0 ? 1.414 : ratio] as [number, number];
      })
    );
    Promise.all(promises).then((entries) => {
      const map: Record<number, number> = {};
      entries.forEach(([pg, r]) => { map[pg] = r; });
      setPageAspectRatios(map);
      setRatiosReady(true);
    });
  }, [pdfDoc]);

  // Page-to-Scroll sync: scroll container to target page when pageNumber changes
  // We wait for ratiosReady AND use a DOM querySelector so we get the actual rendered element position.
  useEffect(() => {
    if (!pdfDoc || !ratiosReady) return;

    const container = containerRef.current;
    if (!container) return;

    // Delay to let DOM finish mounting/updating page heights
    const t = setTimeout(() => {
      const targetElement = container.querySelector(`[data-page-number="${pageNumber}"]`) as HTMLElement | null;
      if (!targetElement) return;

      // Compute scrollTop as: element's offsetTop relative to the scroll container
      const targetTop = targetElement.offsetTop;
      const currentTop = container.scrollTop;

      if (Math.abs(targetTop - currentTop) < 20) return; // already there

      isAutoScrollingRef.current = true;
      container.scrollTop = targetTop;

      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
      scrollTimeoutRef.current = setTimeout(() => {
        isAutoScrollingRef.current = false;
      }, 600);
    }, 300);

    return () => clearTimeout(t);
  }, [pageNumber, pdfDoc, ratiosReady]);

  // Scroll-to-Page sync: When user scrolls, detect which page is dominant and update pageNumber
  const handleScroll = () => {
    if (isLoading || !pdfDoc || !ratiosReady || isAutoScrollingRef.current) return;
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

  const activeZoom = isNaN(zoomScale) || zoomScale <= 0 ? 1.0 : zoomScale;
  const activeWidth = isNaN(containerWidth) || containerWidth <= 0 ? 800 : containerWidth;

  const pageWidth = Math.min(activeWidth, 1200) * activeZoom;

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
          const ratio = pageAspectRatios[pageNum] ?? 1.414;
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
              parentAspectRatio={ratio}
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

      {/* Page Number Overlay fixed top-left */}
      {pdfDoc && (
        <div 
          className="page-overlay-badge mono animate-fade-in"
          style={{
            position: 'absolute',
            top: '16px',
            left: '16px',
            background: 'var(--surface-muted)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: '6px 10px',
            fontSize: '10px',
            fontWeight: 600,
            color: 'var(--text-secondary)',
            zIndex: 40,
            pointerEvents: 'none',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
          }}
        >
          Page {pageNumber} / {pdfDoc.numPages}
        </div>
      )}

      {/* Floating Zoom Widget */}
      {pdfDoc && (
        <div className="zoom-widget animate-fade-in" style={{ right: '20px' }}>
          <button 
            onClick={() => setZoomScale(prev => Math.max(0.4, prev - 0.1))}
            title="Zoom Out"
            className="zoom-btn"
            aria-label="Zoom Out"
          >
            -
          </button>
          <span className="zoom-text mono">{Math.round(zoomScale * 100)}%</span>
          <button 
            onClick={() => setZoomScale(prev => Math.min(3.0, prev + 0.1))}
            title="Zoom In"
            className="zoom-btn"
            aria-label="Zoom In"
          >
            +
          </button>
          <button 
            onClick={() => setZoomScale(1.0)}
            title="Reset Zoom"
            className="zoom-reset-btn"
            aria-label="Reset zoom level to default"
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
  parentAspectRatio: number;
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
  parentAspectRatio
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [localStrokes, setLocalStrokes] = useState<Stroke[]>([]);
  const [isRendered, setIsRendered] = useState(false);

  // Debounce the visibility flag to prevent rendering canvases during fast scroll swipes
  const [debouncedIsVisible, setDebouncedIsVisible] = useState(false);

  useEffect(() => {
    if (isVisible) {
      const handler = setTimeout(() => {
        setDebouncedIsVisible(true);
      }, 150);
      return () => clearTimeout(handler);
    } else {
      setDebouncedIsVisible(false);
    }
  }, [isVisible]);

  // Use the pre-loaded ratio from the parent. No need to fetch again per child.
  const activeRatio = isNaN(parentAspectRatio) || parentAspectRatio <= 0 ? 1.414 : parentAspectRatio;
  const height = width / activeRatio;

  // Debounced dimensions to prevent rapidly re-rendering canvas on drag zoom
  const [debouncedWidth, setDebouncedWidth] = useState(width);
  const debouncedHeight = debouncedWidth / activeRatio;

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedWidth(width);
    }, 180);

    return () => clearTimeout(handler);
  }, [width]);

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
    if (!debouncedIsVisible || !pdfDoc) return;
    let isCancelled = false;
    let renderTask: any = null;

    pdfDoc.getPage(pageNum).then((page) => {
      if (isCancelled) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const viewport = page.getViewport({ scale: 1.0 });
      const viewWidth = viewport.width || 800;
      const scale = debouncedWidth / viewWidth;
      const scaledViewport = page.getViewport({ scale: isNaN(scale) || scale <= 0 ? 1.0 : scale });

      const finalWidth = isNaN(debouncedWidth) || debouncedWidth <= 0 ? 800 : debouncedWidth;
      const finalHeight = isNaN(debouncedHeight) || debouncedHeight <= 0 ? 565 : debouncedHeight;

      canvas.width = finalWidth;
      canvas.height = finalHeight;

      // Paint solid white background to prevent transparent PDF content showing dark backgrounds
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, finalWidth, finalHeight);

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
  }, [debouncedIsVisible, pdfDoc, pageNum, debouncedWidth, debouncedHeight]);

  const currentStrokes = isActive ? activeStrokes : localStrokes;
  const currentSetStrokes = isActive ? setActiveStrokes : (newStrokes: Stroke[]) => {
    onPageActive();
    setActiveStrokes(newStrokes);
  };

  return (
    <div
      ref={containerRef}
      data-page-number={pageNum}
      className={`pdf-page-wrapper relative pdf-frame select-none ${drawMode && isActive ? 'cursor-crosshair border-armed' : ''}`}
      style={{ 
        width: `${width}px`, 
        height: `${height}px`, 
        marginBottom: '24px',
        backgroundColor: '#ffffff',
        flexShrink: 0
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
