import React, { useRef, useEffect, useState } from 'react';
import { Stroke, Point } from '../utils/storage';

interface DrawingCanvasProps {
  strokes: Stroke[];
  setStrokes: (strokes: Stroke[]) => void;
  drawMode: boolean;
  brushColor: string;
  brushWidth: number;
  width: number;
  height: number;
}

export const DrawingCanvas: React.FC<DrawingCanvasProps> = ({
  strokes,
  setStrokes,
  drawMode,
  brushColor,
  brushWidth,
  width,
  height
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentStrokePoints, setCurrentStrokePoints] = useState<Point[]>([]);

  // Redraw strokes whenever they or dimensions change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Helper to draw a single stroke
    const drawStroke = (stroke: Stroke) => {
      if (stroke.points.length === 0) return;

      ctx.beginPath();
      if (stroke.color === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
      } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = stroke.color;
      }
      ctx.lineWidth = stroke.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      const firstPoint = stroke.points[0];
      ctx.moveTo(firstPoint.x * width, firstPoint.y * height);

      for (let i = 1; i < stroke.points.length; i++) {
        const point = stroke.points[i];
        ctx.lineTo(point.x * width, point.y * height);
      }
      ctx.stroke();
      
      // Reset composite operation to default
      ctx.globalCompositeOperation = 'source-over';
    };

    // Draw all completed strokes
    strokes.forEach(drawStroke);

    // Draw current active stroke
    if (isDrawing && currentStrokePoints.length > 0) {
      drawStroke({
        points: currentStrokePoints,
        color: brushColor,
        width: brushWidth
      });
    }
  }, [strokes, currentStrokePoints, isDrawing, width, height, brushColor, brushWidth]);

  // Pointer Event Handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawMode) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.setPointerCapture(e.pointerId);
    setIsDrawing(true);

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    setCurrentStrokePoints([{ x, y }]);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !drawMode) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    // Add point if it has moved a reasonable distance or is first point
    setCurrentStrokePoints(prev => [...prev, { x, y }]);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    if (canvas) {
      canvas.releasePointerCapture(e.pointerId);
    }
    
    setIsDrawing(false);

    if (currentStrokePoints.length > 1) {
      const newStroke: Stroke = {
        points: currentStrokePoints,
        color: brushColor,
        width: brushWidth
      };
      setStrokes([...strokes, newStroke]);
    }
    setCurrentStrokePoints([]);
  };

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      className={`absolute top-0 left-0 touch-none ${
        drawMode ? 'cursor-crosshair z-10' : 'cursor-default pointer-events-none z-0'
      }`}
    />
  );
};
