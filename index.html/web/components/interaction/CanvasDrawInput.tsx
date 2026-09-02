'use client';

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Eraser, PenTool } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { useSpatialAudio } from '@/components/audio/SpatialAudioProvider';

interface CanvasDrawInputProps {
  open: boolean;
  onClose: () => void;
  /** `data` is raw base64 PNG (no `data:` URL prefix) -- same shape the image
   *  attachment pipeline already expects (see OmniSynapseSearch/types.ts). */
  onAttach: (data: string) => void;
}

const CANVAS_SIZE = 320;
const MEDIA_TYPE = 'image/png';

/**
 * Small freehand-sketch popover for the U-AI multimodal input path. White
 * background + dark stroke (not the app's void/dark theme) is deliberate --
 * a sketch travels straight to Claude's vision input as a plain PNG, and a
 * light background with a dark line is the most legible thing to hand a
 * vision model, not a stylistic choice.
 */
export function CanvasDrawInput({ open, onClose, onAttach }: CanvasDrawInputProps) {
  const t = useTranslations('OmniSynapse');
  const { playHoverSfx } = useSpatialAudio();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const [hasStroke, setHasStroke] = useState(false);

  function getContext() {
    const canvas = canvasRef.current;
    return canvas ? canvas.getContext('2d') : null;
  }

  function clearCanvas() {
    const ctx = getContext();
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasStroke(false);
  }

  useEffect(() => {
    if (open) clearCanvas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function pointerPos(e: ReactPointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  function handlePointerDown(e: ReactPointerEvent<HTMLCanvasElement>) {
    const ctx = getContext();
    if (!ctx) return;
    drawingRef.current = true;
    setHasStroke(true);
    const { x, y } = pointerPos(e);
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function handlePointerMove(e: ReactPointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const ctx = getContext();
    if (!ctx) return;
    const { x, y } = pointerPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  function handlePointerUp() {
    drawingRef.current = false;
  }

  function handleAttach() {
    const canvas = canvasRef.current;
    if (!canvas || !hasStroke) return;
    const dataUrl = canvas.toDataURL(MEDIA_TYPE);
    const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
    if (!base64) return;
    onAttach(base64);
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} labelledBy="canvas-draw-title">
      <div className="mb-4 flex items-center gap-2">
        <PenTool size={18} className="text-accent" aria-hidden="true" />
        <h2 id="canvas-draw-title" className="font-serif text-lg font-bold text-white">
          {t('drawTitle')}
        </h2>
      </div>

      <canvas
        ref={canvasRef}
        width={CANVAS_SIZE}
        height={CANVAS_SIZE}
        className="touch-none border border-white/15"
        style={{ width: '100%', height: 'auto', aspectRatio: '1 / 1', cursor: 'crosshair' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      />

      <div className="mt-4 flex items-center justify-between gap-3">
        <button
          type="button"
          onMouseEnter={() => playHoverSfx()}
          onClick={clearCanvas}
          className="flex items-center gap-1.5 text-xs uppercase tracking-widest text-gray-400 transition-colors hover:text-white"
        >
          <Eraser size={14} aria-hidden="true" />
          {t('drawClear')}
        </button>
        <button
          type="button"
          disabled={!hasStroke}
          onMouseEnter={() => playHoverSfx()}
          onClick={handleAttach}
          className="border border-accent bg-accent/10 px-4 py-2 text-xs font-bold uppercase tracking-widest text-accent transition-all hover:bg-accent hover:text-void disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-accent/10 disabled:hover:text-accent"
        >
          {t('drawAttach')}
        </button>
      </div>
    </Modal>
  );
}
