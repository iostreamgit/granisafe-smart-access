import type { DetectedObject } from '@tensorflow-models/coco-ssd';

export type PersonBox = {
  x: number;
  y: number;
  width: number;
  height: number;
  score: number;
};

export type PersonFrameTone = 'warn' | 'ok' | 'lock';

export type GuideCssRect = {
  left: string;
  top: string;
  width: string;
  height: string;
};

/** Centered stand-here window when no person is tracked yet. */
export function standGuideRect(videoWidth: number, videoHeight: number) {
  const height = videoHeight * 0.92;
  const width = Math.min(videoWidth * 0.82, height * 0.75);
  return {
    x: (videoWidth - width) / 2,
    y: (videoHeight - height) / 2,
    width,
    height,
  };
}

/** Pick the largest high-confidence person detection. */
export function pickPersonBox(
  detections: DetectedObject[],
  videoWidth: number,
  videoHeight: number,
  minScore = 0.45,
): PersonBox | null {
  let best: PersonBox | null = null;
  let bestArea = 0;

  for (const det of detections) {
    if (det.class !== 'person' || det.score < minScore) continue;
    const [x, y, width, height] = det.bbox;
    const area = width * height;
    if (area <= bestArea) continue;
    bestArea = area;
    best = {
      x: Math.max(0, x),
      y: Math.max(0, y),
      width: Math.min(width, videoWidth - Math.max(0, x)),
      height: Math.min(height, videoHeight - Math.max(0, y)),
      score: det.score,
    };
  }
  return best;
}

/** EMA so the on-screen frame doesn't jitter frame-to-frame. */
export function smoothPersonBox(
  prev: PersonBox | null,
  next: PersonBox,
  alpha = 0.42,
): PersonBox {
  if (!prev) return next;
  return {
    x: prev.x + (next.x - prev.x) * alpha,
    y: prev.y + (next.y - prev.y) * alpha,
    width: prev.width + (next.width - prev.width) * alpha,
    height: prev.height + (next.height - prev.height) * alpha,
    score: next.score,
  };
}

/**
 * Person is large enough for a PPE snapshot (head + torso).
 * Position on screen can move — the guide follows the box.
 */
export function isPersonFramedWell(
  box: PersonBox,
  videoWidth: number,
  videoHeight: number,
): boolean {
  const areaRatio = (box.width * box.height) / Math.max(1, videoWidth * videoHeight);
  if (areaRatio < 0.07 || areaRatio > 0.96) return false;
  if (box.height < videoHeight * 0.32) return false;
  if (box.width < videoWidth * 0.12) return false;

  // Mostly inside the frame edges
  const marginX = videoWidth * 0.02;
  const marginY = videoHeight * 0.02;
  if (box.x < -marginX || box.y < -marginY) return false;
  if (box.x + box.width > videoWidth + marginX) return false;
  if (box.y + box.height > videoHeight + marginY) return false;

  return true;
}

/** Map a video-space box onto the displayed (object-fit: cover) rectangle. */
export function mapBoxToCoverDisplay(
  box: PersonBox,
  videoWidth: number,
  videoHeight: number,
  displayWidth: number,
  displayHeight: number,
): PersonBox {
  const scale = Math.max(displayWidth / videoWidth, displayHeight / videoHeight);
  const scaledW = videoWidth * scale;
  const scaledH = videoHeight * scale;
  const offsetX = (displayWidth - scaledW) / 2;
  const offsetY = (displayHeight - scaledH) / 2;
  return {
    x: box.x * scale + offsetX,
    y: box.y * scale + offsetY,
    width: box.width * scale,
    height: box.height * scale,
    score: box.score,
  };
}

/** CSS % rect for the guide overlay (mirrors when webcam is mirrored). */
export function personBoxToGuideStyle(
  box: PersonBox,
  displayWidth: number,
  displayHeight: number,
  mirrored: boolean,
  padFrac = 0.04,
): GuideCssRect {
  const padX = box.width * padFrac;
  const padY = box.height * padFrac;
  let x = box.x - padX;
  let y = box.y - padY;
  let w = box.width + padX * 2;
  let h = box.height + padY * 2;

  if (mirrored) {
    x = displayWidth - x - w;
  }

  x = Math.max(0, x);
  y = Math.max(0, y);
  w = Math.min(w, displayWidth - x);
  h = Math.min(h, displayHeight - y);

  return {
    left: `${(x / displayWidth) * 100}%`,
    top: `${(y / displayHeight) * 100}%`,
    width: `${(w / displayWidth) * 100}%`,
    height: `${(h / displayHeight) * 100}%`,
  };
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, w, h, radius);
    return;
  }
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

export function drawPersonFrame(
  ctx: CanvasRenderingContext2D,
  box: PersonBox,
  mirrored: boolean,
  canvasWidth: number,
  label: string,
  tone: PersonFrameTone = 'ok',
) {
  const x = mirrored ? canvasWidth - box.x - box.width : box.x;
  const palette = {
    warn: { stroke: '#fbbf24', fill: '#facc15', glow: 'rgba(250, 204, 21, 0.45)', ink: '#1a1405' },
    ok: { stroke: '#4ade80', fill: '#86efac', glow: 'rgba(74, 222, 128, 0.5)', ink: '#052e16' },
    lock: { stroke: '#bbf7d0', fill: '#dcfce7', glow: 'rgba(187, 247, 208, 0.6)', ink: '#052e16' },
  }[tone];

  const radius = Math.min(18, box.width * 0.055, box.height * 0.055);
  ctx.save();
  ctx.strokeStyle = palette.stroke;
  ctx.lineWidth = Math.max(3, canvasWidth * 0.0038);
  ctx.shadowColor = palette.glow;
  ctx.shadowBlur = 12;
  roundRect(ctx, x, box.y, box.width, box.height, radius);
  ctx.stroke();

  const arm = Math.min(box.width, box.height) * 0.14;
  ctx.shadowBlur = 0;
  ctx.lineWidth = Math.max(4, canvasWidth * 0.005);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(x, box.y + arm);
  ctx.lineTo(x, box.y);
  ctx.lineTo(x + arm, box.y);
  ctx.moveTo(x + box.width - arm, box.y);
  ctx.lineTo(x + box.width, box.y);
  ctx.lineTo(x + box.width, box.y + arm);
  ctx.moveTo(x, box.y + box.height - arm);
  ctx.lineTo(x, box.y + box.height);
  ctx.lineTo(x + arm, box.y + box.height);
  ctx.moveTo(x + box.width - arm, box.y + box.height);
  ctx.lineTo(x + box.width, box.y + box.height);
  ctx.lineTo(x + box.width, box.y + box.height - arm);
  ctx.stroke();

  const fontSize = Math.max(13, canvasWidth * 0.02);
  ctx.font = `700 ${fontSize}px Manrope, ui-sans-serif, system-ui, sans-serif`;
  const padX = 10;
  const padY = 6;
  const textWidth = ctx.measureText(label).width;
  const pillH = fontSize + padY * 2;
  const pillW = textWidth + padX * 2;
  const pillX = x;
  const pillY = Math.max(8, box.y - pillH - 8);
  ctx.fillStyle = palette.fill;
  roundRect(ctx, pillX, pillY, pillW, pillH, 8);
  ctx.fill();
  ctx.fillStyle = palette.ink;
  ctx.fillText(label, pillX + padX, pillY + padY + fontSize * 0.8);
  ctx.restore();
}
