'use client';

import React, { useRef, useEffect, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist/types/src/display/api';
import { DrawingCanvas } from './DrawingCanvas';
import { Stroke } from '../utils/storage';
import { FileWarning } from 'lucide-react';

interface PdfViewerProps {
  pdfUrl: string;
  pageNumber: number;
  setNumPages: (num: number) => void;
  drawMode: boolean;
  brushColor: string;
  brushWidth: number;
  strokes: Stroke[];
  setStrokes: (strokes: Stroke[]) => void;
}

export const PdfViewer: React.FC<PdfViewerProps> = ({
  pdfUrl,
  pageNumber,
  setNumPages,
  drawMode,
  brushColor,
  brushWidth,
  strokes,
  setStrokes
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pdfCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string>('');
  const [resizeCounter, setResizeCounter] = useState(0);

  useEffect(() => {
    const handleResize = () => setResizeCounter(prev => prev + 1);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
          throw new Error(`Received 0 bytes from ${apiUrl} (status ${response.status})`);
        }

        const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;

        if (isCancelled) {
          try { (pdf as any).destroy(); } catch (_) { /* ignore */ }
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

  useEffect(() => {
    if (!pdfDoc) return;
    let isCancelled = false;
    let renderTask: any = null;

    pdfDoc.getPage(pageNumber).then((page) => {
      if (isCancelled) return;
      const canvas = pdfCanvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const viewport = page.getViewport({ scale: 1.0 });
      const containerWidth = Math.max(320, container.clientWidth - 44);
      const scale = Math.min(containerWidth / viewport.width, 1.55);
      const scaledViewport = page.getViewport({ scale });

      canvas.width = scaledViewport.width;
      canvas.height = scaledViewport.height;
      setCanvasSize({ width: scaledViewport.width, height: scaledViewport.height });

      renderTask = page.render({ canvasContext: ctx, canvas, viewport: scaledViewport });
      renderTask.promise.catch((err: unknown) => {
        if (!isCancelled) console.error('Error rendering page:', err);
      });
    });

    return () => {
      isCancelled = true;
      if (renderTask) {
        try { renderTask.cancel(); } catch (_) { /* ignore */ }
      }
    };
  }, [pdfDoc, pageNumber, resizeCounter]);

  return (
    <div ref={containerRef} className="pdf-stage">
      {isLoading && (
        <div className="pdf-loading">
          <div className="loading-card">
            <div className="spinner" />
            <h3>Loading question paper</h3>
            <p>Preparing the PDF canvas and annotation layer.</p>
          </div>
        </div>
      )}

      {pdfDoc && (
        <div className="pdf-frame" style={{ width: canvasSize.width, height: canvasSize.height }}>
          <canvas ref={pdfCanvasRef} className="block" />
          <DrawingCanvas
            strokes={strokes}
            setStrokes={setStrokes}
            drawMode={drawMode}
            brushColor={brushColor}
            brushWidth={brushWidth}
            width={canvasSize.width}
            height={canvasSize.height}
          />
        </div>
      )}

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
  );
};
