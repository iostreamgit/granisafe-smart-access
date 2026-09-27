import { useCallback, useEffect, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import '@tensorflow/tfjs';
import { FakeAiScenario } from '@granisafe/shared';
import { ApiError, apiGet, apiSend } from '../../lib/api';
import { useAuthStore } from '../../features/auth/auth-store';
import type { IdentifyResponse, InspectResponse } from '../../features/access/types';
import {
  drawPersonFrame,
  isPersonFramedWell,
  mapBoxToCoverDisplay,
  personBoxToGuideStyle,
  pickPersonBox,
  smoothPersonBox,
  type GuideCssRect,
  type PersonBox,
  type PersonFrameTone,
} from '../../features/access/person-tracker';
import {
  isGranisafeQrPayload,
  QR_SCAN_DEBOUNCE_MS,
  startQrScanner,
  stopQrScanner,
} from '../../features/access/qr-scanner';
import type { Html5Qrcode } from 'html5-qrcode';
import styles from './AccessKioskPage.module.css';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '';
const STABLE_FRAMES_NEEDED = 10;
const DETECT_INTERVAL_MS = 120;
const QR_READER_ID = 'gsa-qr-reader';

const SCENARIOS = [
  { value: FakeAiScenario.ALL_OK, label: 'All PPE present' },
  { value: FakeAiScenario.MISSING_HELMET, label: 'Missing helmet' },
  { value: FakeAiScenario.MISSING_VEST, label: 'Missing vest' },
  { value: FakeAiScenario.MISSING_UNIFORM, label: 'Missing uniform' },
  { value: FakeAiScenario.NONE, label: 'No PPE' },
  { value: FakeAiScenario.AI_ERROR, label: 'AI error (fail-closed)' },
];

const PPE_LABELS: Record<string, string> = {
  HELMET: 'Helmet',
  SAFETY_VEST: 'Safety vest',
  UNIFORM: 'Uniform',
};

const PPE_TRACK = ['HELMET', 'SAFETY_VEST', 'UNIFORM'] as const;

function ppeLabel(ppeClass: string) {
  return PPE_LABELS[ppeClass] ?? ppeClass.replaceAll('_', ' ');
}

function ppeRecommendations(result: InspectResponse, requiredPpe: string[]): string[] {
  if (result.decision === 'GRANTED') {
    return [
      'All required PPE was detected. You may proceed through the gate.',
      'Keep your helmet, safety vest, and uniform on while on site.',
    ];
  }

  const recs: string[] = [];
  const missing = new Set(
    result.detections.filter((d) => !d.detected).map((d) => d.ppeClass),
  );
  for (const item of requiredPpe.length ? requiredPpe : PPE_TRACK) {
    if (!missing.has(item)) continue;
    if (item === 'HELMET') recs.push('Put on a certified safety helmet and keep it fully visible in the frame.');
    else if (item === 'SAFETY_VEST') recs.push('Wear a high-visibility safety vest over your clothing.');
    else if (item === 'UNIFORM') recs.push('Wear the required company uniform so it is clearly visible.');
    else recs.push(`Put on the required ${ppeLabel(item).toLowerCase()} and retake the check.`);
  }
  for (const reason of result.reasons) {
    if (reason.code === 'MISSING_PPE') continue;
    if (reason.message) recs.push(reason.message);
  }
  recs.push('Stand in the capture frame again and press Retake for a new PPE check.');
  return [...new Set(recs)];
}

function PpeMeters({ result }: { result: InspectResponse | null }) {
  return (
    <div className={styles.ppeList}>
      {PPE_TRACK.map((ppeClass) => {
        const hit = result?.detections.find((d) => d.ppeClass === ppeClass);
        const waiting = hit == null;
        const pct = waiting ? 0 : Math.round(Math.min(1, Math.max(0, hit.confidence)) * 100);
        const ok = hit?.detected === true;
        return (
          <div
            key={ppeClass}
            className={styles.ppeRow}
            data-ok={waiting ? 'wait' : ok ? 'true' : 'false'}
          >
            <span className={styles.ppeName}>{ppeLabel(ppeClass)}</span>
            <span className={styles.ppeState}>
              {waiting ? 'Waiting' : ok ? `Detected · ${pct}%` : `Missing · ${pct}%`}
            </span>
            <div className={styles.ppeBar} aria-hidden>
              <div className={styles.ppeBarFill} style={{ width: `${waiting ? 8 : pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AlertBanner({
  tone,
  title,
  children,
}: {
  tone: 'danger' | 'warn' | 'ok' | 'info';
  title: string;
  children?: ReactNode;
}) {
  const mark = { danger: '!', warn: '!', ok: '✓', info: 'i' }[tone];
  return (
    <div
      className={`${styles.alert} ${styles[`alert_${tone}`]}`}
      role={tone === 'danger' ? 'alert' : 'status'}
    >
      <span className={styles.alertMark} aria-hidden>
        {mark}
      </span>
      <div className={styles.alertBody}>
        <strong className={styles.alertTitle}>{title}</strong>
        {children ? <p className={styles.alertText}>{children}</p> : null}
      </div>
    </div>
  );
}

type AiStatus = {
  adapter: 'fake' | 'http';
  baseUrl: string | null;
  killSwitch: boolean;
  timeoutMs: number;
};

type TrackStatus =
  'idle' | 'loading_model' | 'searching' | 'tracking' | 'locking' | 'captured' | 'awaiting_retake';

async function postJson<T>(path: string, token: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new ApiError(
      response.status,
      (err as { detail?: string }).detail ?? `Request failed (${response.status})`,
      (err as { code?: string }).code,
    );
  }
  return response.json() as Promise<T>;
}

async function postInspect(
  token: string,
  attemptId: string,
  mockScenario: string | undefined,
  frame?: File | null,
): Promise<InspectResponse> {
  const form = new FormData();
  form.set('attemptId', attemptId);
  if (mockScenario) form.set('mockScenario', mockScenario);
  if (frame) form.set('frame', frame);

  const response = await fetch(`${API_BASE}/api/v1/access/inspect`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Idempotency-Key': crypto.randomUUID(),
    },
    body: form,
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new ApiError(
      response.status,
      (err as { detail?: string }).detail ?? `Request failed (${response.status})`,
      (err as { code?: string }).code,
    );
  }
  return response.json() as Promise<InspectResponse>;
}

function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}

export function AccessKioskPage() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [method, setMethod] = useState<'EMPLOYEE_CODE' | 'QR' | 'RFID'>('EMPLOYEE_CODE');
  const [identifier, setIdentifier] = useState('EMP-1001');
  const [direction, setDirection] = useState<'ENTRY' | 'EXIT'>('ENTRY');
  const [detectMode, setDetectMode] = useState<'camera' | 'simulate'>('camera');
  const [scenario, setScenario] = useState<string>(FakeAiScenario.MISSING_HELMET);
  const [frame, setFrame] = useState<File | null>(null);
  const [snapshotUrl, setSnapshotUrl] = useState<string | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [identified, setIdentified] = useState<IdentifyResponse | null>(null);
  const [result, setResult] = useState<InspectResponse | null>(null);
  const [aiStatus, setAiStatus] = useState<AiStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [trackStatus, setTrackStatus] = useState<TrackStatus>('idle');
  const [autoInspect, setAutoInspect] = useState(true);
  const [personScore, setPersonScore] = useState<number | null>(null);
  const [identifyUi, setIdentifyUi] = useState<'manual' | 'scan'>('manual');
  const [qrScanning, setQrScanning] = useState(false);
  const [qrStatus, setQrStatus] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);
  const [lockProgress, setLockProgress] = useState(0);
  const [resultModal, setResultModal] = useState<'closed' | 'checking' | 'ready'>('closed');
  const [guideFollow, setGuideFollow] = useState(false);
  const [guideStyle, setGuideStyle] = useState<GuideCssRect | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cameraBoxRef = useRef<HTMLDivElement | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const captureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const modelRef = useRef<cocoSsd.ObjectDetection | null>(null);
  const qrScannerRef = useRef<Html5Qrcode | null>(null);
  const qrHandlingRef = useRef(false);
  const lastQrAtRef = useRef(0);
  const loopActiveRef = useRef(false);
  const stableCountRef = useRef(0);
  const capturedForPresenceRef = useRef(false);
  const awaitingRetakeRef = useRef(false);
  const lastDetectAtRef = useRef(0);
  const smoothedBoxRef = useRef<PersonBox | null>(null);
  const identifiedRef = useRef<IdentifyResponse | null>(null);
  const autoInspectRef = useRef(true);
  const detectModeRef = useRef(detectMode);
  const scenarioRef = useRef(scenario);
  const accessTokenRef = useRef(accessToken);
  const snapshotUrlRef = useRef(snapshotUrl);
  const busyRef = useRef(busy);
  const resultRef = useRef(result);

  useEffect(() => {
    identifiedRef.current = identified;
  }, [identified]);
  useEffect(() => {
    autoInspectRef.current = autoInspect;
  }, [autoInspect]);
  useEffect(() => {
    detectModeRef.current = detectMode;
  }, [detectMode]);
  useEffect(() => {
    scenarioRef.current = scenario;
  }, [scenario]);
  useEffect(() => {
    accessTokenRef.current = accessToken;
  }, [accessToken]);
  useEffect(() => {
    snapshotUrlRef.current = snapshotUrl;
  }, [snapshotUrl]);
  useEffect(() => {
    busyRef.current = busy;
  }, [busy]);
  useEffect(() => {
    resultRef.current = result;
  }, [result]);

  useEffect(() => {
    if (resultModal === 'closed') return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setResultModal('closed');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [resultModal]);

  useEffect(() => {
    void (async () => {
      if (!accessToken) return;
      try {
        const status = await apiGet<AiStatus>('/api/v1/access/ai-status', accessToken);
        setAiStatus(status);
      } catch {
        setAiStatus(null);
      }
    })();
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;

    const beat = async () => {
      try {
        await apiSend('POST', '/api/v1/dashboard/camera-heartbeat', accessToken, {
          accessPointCode: 'GATE-1',
          status: cameraOn ? 'ONLINE' : 'DEGRADED',
        });
      } catch {
        if (!cancelled) {
          /* heartbeat is best-effort */
        }
      }
    };

    void beat();
    const timer = window.setInterval(() => void beat(), 20_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [accessToken, cameraOn]);

  useEffect(() => {
    return () => {
      loopActiveRef.current = false;
      stopStream(streamRef.current);
      streamRef.current = null;
      modelRef.current = null;
      void stopQrScanner(qrScannerRef.current);
      qrScannerRef.current = null;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (snapshotUrl) URL.revokeObjectURL(snapshotUrl);
    };
  }, [snapshotUrl]);

  const captureFrame = useCallback(async (): Promise<File | null> => {
    const video = videoRef.current;
    const canvas = captureCanvasRef.current;
    if (!video || !canvas || video.readyState < 2) {
      return null;
    }

    const width = video.videoWidth || 640;
    const height = video.videoHeight || 480;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.92),
    );
    if (!blob) return null;

    const file = new File([blob], `kiosk-frame-${Date.now()}.jpg`, {
      type: 'image/jpeg',
    });
    if (snapshotUrlRef.current) URL.revokeObjectURL(snapshotUrlRef.current);
    const url = URL.createObjectURL(blob);
    setSnapshotUrl(url);
    setFrame(file);
    setFlash(true);
    window.setTimeout(() => setFlash(false), 280);
    return file;
  }, []);

  const armCapture = useCallback(() => {
    awaitingRetakeRef.current = false;
    capturedForPresenceRef.current = false;
    stableCountRef.current = 0;
    smoothedBoxRef.current = null;
    setLockProgress(0);
    setGuideFollow(false);
    setGuideStyle(null);
    setTrackStatus((prev) => (prev === 'idle' ? 'idle' : 'tracking'));
  }, []);

  const runInspectWithFile = useCallback(async (file: File | null) => {
    const token = accessTokenRef.current;
    const id = identifiedRef.current;
    if (!token || !id || busyRef.current || awaitingRetakeRef.current) return;
    // Open the result window immediately so the operator always sees the outcome.
    setResultModal('checking');
    setBusy(true);
    setError(null);
    busyRef.current = true;
    try {
      const data = await postInspect(
        token,
        id.attemptId,
        detectModeRef.current === 'simulate' ? scenarioRef.current : undefined,
        file,
      );
      setResult(data);
      // Attempt is finished — block further auto-inspect until Retake (new identify).
      awaitingRetakeRef.current = true;
      capturedForPresenceRef.current = true;
      setTrackStatus('awaiting_retake');
      setResultModal('ready');
    } catch (err) {
      setResultModal('closed');
      setError(err instanceof ApiError ? err.message : 'Inspect failed');
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, []);

  const stopTrackingLoop = useCallback(() => {
    loopActiveRef.current = false;
    stableCountRef.current = 0;
    smoothedBoxRef.current = null;
    setGuideFollow(false);
    setGuideStyle(null);
    const overlay = overlayRef.current;
    if (overlay) {
      const ctx = overlay.getContext('2d');
      ctx?.clearRect(0, 0, overlay.width, overlay.height);
    }
  }, []);

  const startTrackingLoop = useCallback(() => {
    if (loopActiveRef.current) return;
    loopActiveRef.current = true;
    setTrackStatus('searching');

    const tick = async () => {
      if (!loopActiveRef.current) return;

      const video = videoRef.current;
      const overlay = overlayRef.current;
      const cameraBox = cameraBoxRef.current;
      const model = modelRef.current;

      if (video && overlay && cameraBox && model && video.readyState >= 2 && video.videoWidth > 0) {
        const now = performance.now();
        if (now - lastDetectAtRef.current >= DETECT_INTERVAL_MS) {
          lastDetectAtRef.current = now;
          try {
            const vw = video.videoWidth;
            const vh = video.videoHeight;
            const displayW = cameraBox.clientWidth;
            const displayH = cameraBox.clientHeight;
            if (overlay.width !== displayW || overlay.height !== displayH) {
              overlay.width = displayW;
              overlay.height = displayH;
            }

            const detections = await model.detect(video);
            const rawBox = pickPersonBox(detections, vw, vh);
            const smoothed = rawBox
              ? smoothPersonBox(smoothedBoxRef.current, rawBox)
              : null;
            smoothedBoxRef.current = smoothed;

            const box = smoothed
              ? mapBoxToCoverDisplay(smoothed, vw, vh, displayW, displayH)
              : null;

            const ctx = overlay.getContext('2d');
            if (ctx) {
              ctx.clearRect(0, 0, overlay.width, overlay.height);
              if (box && smoothed) {
                const wellFramedNow = isPersonFramedWell(smoothed, vw, vh);
                setPersonScore(smoothed.score);
                setGuideFollow(true);
                setGuideStyle(personBoxToGuideStyle(box, displayW, displayH, true));

                let frameLabel: string;
                let tone: PersonFrameTone;
                if (awaitingRetakeRef.current) {
                  const decision = resultRef.current?.decision;
                  frameLabel =
                    decision === 'GRANTED'
                      ? 'PPE check complete'
                      : 'PPE check complete — Retake';
                  tone = decision === 'GRANTED' ? 'ok' : 'warn';
                } else if (!wellFramedNow) {
                  frameLabel = `Step closer · ${Math.round(smoothed.score * 100)}%`;
                  tone = 'warn';
                } else if (!capturedForPresenceRef.current) {
                  const progress = Math.min(1, stableCountRef.current / STABLE_FRAMES_NEEDED);
                  frameLabel =
                    progress >= 0.5
                      ? 'Hold still'
                      : `Tracking · ${Math.round(smoothed.score * 100)}%`;
                  tone = progress >= 0.5 ? 'lock' : 'ok';
                } else {
                  frameLabel = busyRef.current ? 'Checking PPE…' : 'Snapshot taken';
                  tone = 'lock';
                }

                // Webcam video is CSS-mirrored; flip overlay boxes to match.
                drawPersonFrame(ctx, box, true, overlay.width, frameLabel, tone);

                if (awaitingRetakeRef.current) {
                  setLockProgress(1);
                  setTrackStatus('awaiting_retake');
                } else if (wellFramedNow && !capturedForPresenceRef.current) {
                  stableCountRef.current += 1;
                  const progress = Math.min(1, stableCountRef.current / STABLE_FRAMES_NEEDED);
                  setLockProgress(progress);
                  setTrackStatus(
                    stableCountRef.current >= STABLE_FRAMES_NEEDED / 2 ? 'locking' : 'tracking',
                  );
                  if (stableCountRef.current >= STABLE_FRAMES_NEEDED) {
                    capturedForPresenceRef.current = true;
                    setLockProgress(1);
                    setTrackStatus('captured');
                    const file = await captureFrame();
                    if (
                      file &&
                      autoInspectRef.current &&
                      identifiedRef.current &&
                      !busyRef.current &&
                      !awaitingRetakeRef.current
                    ) {
                      void runInspectWithFile(file);
                    }
                  }
                } else if (!wellFramedNow) {
                  if (capturedForPresenceRef.current && !awaitingRetakeRef.current) {
                    // Person left — allow a new auto snap for the same open attempt.
                    capturedForPresenceRef.current = false;
                  }
                  stableCountRef.current = 0;
                  setLockProgress(0);
                  setTrackStatus(awaitingRetakeRef.current ? 'awaiting_retake' : 'tracking');
                } else if (awaitingRetakeRef.current) {
                  setLockProgress(1);
                  setTrackStatus('awaiting_retake');
                } else {
                  setLockProgress(1);
                  setTrackStatus('captured');
                }
              } else {
                setPersonScore(null);
                setGuideFollow(false);
                setGuideStyle(null);
                stableCountRef.current = 0;
                if (capturedForPresenceRef.current && !awaitingRetakeRef.current) {
                  capturedForPresenceRef.current = false;
                }
                if (!awaitingRetakeRef.current) setLockProgress(0);
                setTrackStatus(awaitingRetakeRef.current ? 'awaiting_retake' : 'searching');
              }
            }
          } catch {
            /* keep loop alive if a single detect fails */
          }
        }
      }

      if (loopActiveRef.current) {
        requestAnimationFrame(() => void tick());
      }
    };

    void tick();
  }, [captureFrame, runInspectWithFile]);

  async function ensureModel() {
    if (modelRef.current) return modelRef.current;
    setTrackStatus('loading_model');
    const model = await cocoSsd.load({ base: 'lite_mobilenet_v2' });
    modelRef.current = model;
    return model;
  }

  async function haltQrScanner() {
    await stopQrScanner(qrScannerRef.current);
    qrScannerRef.current = null;
    setQrScanning(false);
  }

  async function startCamera() {
    setCameraError(null);
    try {
      await haltQrScanner();
      setIdentifyUi('manual');
      stopTrackingLoop();
      stopStream(streamRef.current);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'user' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraOn(true);
      await ensureModel();
      capturedForPresenceRef.current = false;
      stableCountRef.current = 0;
      startTrackingLoop();
    } catch (err) {
      setCameraOn(false);
      setTrackStatus('idle');
      const message = err instanceof Error ? err.message : 'Unable to access webcam';
      setCameraError(
        `${message}. Allow camera permission for this site, or upload a photo instead.`,
      );
    }
  }

  function stopCamera() {
    stopTrackingLoop();
    stopStream(streamRef.current);
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOn(false);
    setTrackStatus('idle');
    setPersonScore(null);
    setWellFramed(false);
    setLockProgress(0);
  }

  async function identifyEmployee(overrides?: {
    method?: 'EMPLOYEE_CODE' | 'QR' | 'RFID';
    identifier?: string;
  }): Promise<IdentifyResponse | null> {
    if (!accessToken) return null;
    const data = await postJson<IdentifyResponse>('/api/v1/access/identify', accessToken, {
      method: overrides?.method ?? method,
      identifier: overrides?.identifier ?? identifier,
      direction,
      accessPointCode: 'GATE-1',
    });
    setIdentified(data);
    return data;
  }

  async function onQrDecoded(raw: string) {
    const text = raw.trim();
    const now = Date.now();
    if (qrHandlingRef.current) return;
    if (now - lastQrAtRef.current < QR_SCAN_DEBOUNCE_MS) return;
    if (!isGranisafeQrPayload(text)) {
      setQrStatus('Unrecognized code — expect GSA:v1:… badge');
      return;
    }

    qrHandlingRef.current = true;
    lastQrAtRef.current = now;
    try {
      setQrStatus('QR scanned — identifying…');
      setBusy(true);
      setError(null);
      setResult(null);
      setMethod('QR');
      setIdentifier(text);
      await haltQrScanner();
      setIdentifyUi('manual');
      armCapture();
      await identifyEmployee({ method: 'QR', identifier: text });
      setQrStatus('Identified — starting PPE camera…');
      await startCamera();
      setQrStatus(null);
    } catch (err) {
      setIdentified(null);
      const message = err instanceof ApiError ? err.message : 'QR identify failed';
      setError(message);
      setQrStatus(null);
      // Allow another scan attempt
      void startQrScan();
    } finally {
      setBusy(false);
      qrHandlingRef.current = false;
    }
  }

  async function startQrScan() {
    setError(null);
    setCameraError(null);
    setQrStatus('Starting QR camera…');
    try {
      stopCamera();
      await haltQrScanner();
      setIdentifyUi('scan');
      // Wait for React to mount #gsa-qr-reader before Html5Qrcode attaches.
      await new Promise((r) => setTimeout(r, 80));
      if (!document.getElementById(QR_READER_ID)) {
        throw new Error('QR reader element not ready');
      }
      const scanner = await startQrScanner({
        elementId: QR_READER_ID,
        onDecode: (text) => void onQrDecoded(text),
        onError: (message) => {
          setCameraError(`${message}. Allow camera permission or use Type / paste.`);
          setQrScanning(false);
          setIdentifyUi('manual');
        },
      });
      qrScannerRef.current = scanner;
      setQrScanning(true);
      setQrStatus('Point camera at employee QR badge');
    } catch (err) {
      setQrScanning(false);
      setIdentifyUi('manual');
      const message = err instanceof Error ? err.message : 'QR scanner failed';
      setCameraError(message);
      setQrStatus(null);
    }
  }

  async function stopQrScanUi() {
    await haltQrScanner();
    setIdentifyUi('manual');
    setQrStatus(null);
  }

  async function onIdentify(event: FormEvent) {
    event.preventDefault();
    if (!accessToken) return;
    try {
      setBusy(true);
      setError(null);
      setResult(null);
      armCapture();
      await identifyEmployee();
      if (!cameraOn) void startCamera();
      else if (!loopActiveRef.current) startTrackingLoop();
    } catch (err) {
      setIdentified(null);
      setError(err instanceof ApiError ? err.message : 'Identify failed');
    } finally {
      setBusy(false);
    }
  }

  /** New attempt + clear capture lock so PPE can be re-checked after DENIED/GRANTED. */
  async function onRetake() {
    if (!accessToken) return;
    try {
      setBusy(true);
      setError(null);
      setResult(null);
      setResultModal('closed');
      if (snapshotUrlRef.current) URL.revokeObjectURL(snapshotUrlRef.current);
      setSnapshotUrl(null);
      setFrame(null);
      await identifyEmployee();
      armCapture();
      if (!cameraOn) await startCamera();
      else if (!loopActiveRef.current) startTrackingLoop();
      else setTrackStatus('tracking');
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Retake failed — try Identify again';
      setError(
        message.includes('cooldown') || message.includes('Duplicate')
          ? `${message} Tip: Admin → Settings → lower Access cooldown (e.g. 5s).`
          : message,
      );
    } finally {
      setBusy(false);
    }
  }

  async function onInspect() {
    if (!accessToken || !identified) return;
    if (awaitingRetakeRef.current) {
      setError('This attempt already finished — click Retake for a new PPE check.');
      return;
    }
    const captured = await captureFrame();
    await runInspectWithFile(captured ?? frame);
  }

  const live = aiStatus?.adapter === 'http';
  const trackCopy: Record<TrackStatus, { kicker: string; title: string; badge: string }> = {
    idle: {
      kicker: 'Camera off',
      title: 'Start the camera to open the PPE capture frame',
      badge: 'Tracking off',
    },
    loading_model: {
      kicker: 'Starting',
      title: 'Loading body tracker…',
      badge: 'Loading tracker…',
    },
    searching: {
      kicker: 'Looking for you',
      title: 'Step into view — the detection frame follows your body',
      badge: 'Looking for a person',
    },
    tracking: {
      kicker: 'Tracking',
      title: 'Frame locked on you — move closer until it turns green',
      badge: 'Following person',
    },
    locking: {
      kicker: 'Hold still',
      title: 'Stay still — snapshot in a moment',
      badge: 'Locking snapshot…',
    },
    captured: {
      kicker: 'Captured',
      title: busy ? 'Snapshot taken — checking PPE' : 'Snapshot taken',
      badge: 'Snapshot taken',
    },
    awaiting_retake: {
      kicker: result?.decision === 'GRANTED' ? 'Granted' : 'Check complete',
      title:
        result?.decision === 'GRANTED'
          ? 'All required PPE detected — see result window'
          : 'Missing PPE — see result window, then Retake',
      badge: 'PPE check complete',
    },
  };
  const hud = trackCopy[trackStatus];
  const showGuide = cameraOn && trackStatus !== 'loading_model';
  const showSilhouette =
    showGuide && !guideFollow && trackStatus !== 'captured' && trackStatus !== 'awaiting_retake';
  const showLockBar =
    cameraOn && (trackStatus === 'locking' || (lockProgress > 0 && lockProgress < 1));
  const followingGuideStyle: CSSProperties | undefined =
    guideFollow && guideStyle
      ? {
          left: guideStyle.left,
          top: guideStyle.top,
          width: guideStyle.width,
          height: guideStyle.height,
        }
      : undefined;
  const resultSummary =
    result == null
      ? null
      : result.decision === 'GRANTED'
        ? 'All required PPE was detected. Gate can open.'
        : (result.reasons[0]?.message ?? 'PPE check failed.');

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h2>Access Control</h2>
        <p>
          Kiosk with QR scan, body tracking, and auto snapshot —{' '}
          {live ? 'Live HTTP AI' : 'In-process Fake AI'}.
          {aiStatus?.killSwitch ? ' Kill switch ON (fail-closed).' : ''}
        </p>
        {aiStatus && (
          <p className={styles.meta}>
            Adapter: <strong>{aiStatus.adapter}</strong>
            {live && aiStatus.baseUrl ? ` → ${aiStatus.baseUrl}` : ''}
            {` · timeout ${aiStatus.timeoutMs}ms`}
            {detectMode === 'camera'
              ? ' · Camera mode uses real frame / YOLO when loaded'
              : ' · Simulate mode: scenario dropdown overrides detections'}
          </p>
        )}
      </div>

      <div className={styles.alerts}>
        {error && (
          <AlertBanner tone="danger" title="Action failed">
            {error}
          </AlertBanner>
        )}
        {cameraError && (
          <AlertBanner tone="danger" title="Camera unavailable">
            {cameraError}
          </AlertBanner>
        )}
        {qrStatus && !cameraError && (
          <AlertBanner tone="info" title="QR scanner">
            {qrStatus}
          </AlertBanner>
        )}
        {identified && !result && !error && (
          <AlertBanner tone="ok" title={`${identified.employee.fullName} identified`}>
            Required PPE: {identified.requiredPpe.map(ppeLabel).join(', ') || 'none'}. Step into
            view — the frame follows you for a snapshot.
          </AlertBanner>
        )}
      </div>

      <div className={styles.grid}>
        <div className={styles.leftStack}>
        <section className={styles.panel}>
          <h3>1. Identify</h3>
          <p className={styles.panelLead}>
            Identify the employee first. The PPE camera will then capture and check required gear.
          </p>
          <div className={styles.tabs}>
            <button
              type="button"
              className={identifyUi === 'manual' ? styles.tabActive : styles.tab}
              onClick={() => void stopQrScanUi()}
            >
              Type / paste
            </button>
            <button
              type="button"
              className={identifyUi === 'scan' ? styles.tabActive : styles.tab}
              onClick={() => void startQrScan()}
              disabled={busy}
            >
              Scan QR
            </button>
          </div>

          {identifyUi === 'scan' ? (
            <div className={styles.form}>
              <div className={styles.qrBox}>
                <div id={QR_READER_ID} className={styles.qrReader} />
                {!qrScanning && (
                  <div className={styles.cameraPlaceholder}>Starting QR scanner…</div>
                )}
              </div>
              {qrStatus && <p className={styles.meta}>{qrStatus}</p>}
              <label>
                Direction
                <select
                  value={direction}
                  onChange={(e) => setDirection(e.target.value as 'ENTRY' | 'EXIT')}
                >
                  <option value="ENTRY">ENTRY</option>
                  <option value="EXIT">EXIT</option>
                </select>
              </label>
              <p className={styles.meta}>
                Print a badge from Employees → QR, then hold it in front of the camera. A valid{' '}
                <code>GSA:v1:…</code> code auto-identifies and opens the PPE camera.
              </p>
              <div className={styles.actions}>
                <button type="button" onClick={() => void stopQrScanUi()} disabled={busy}>
                  Cancel scan
                </button>
              </div>
              <div className={styles.quick}>
                {['EMP-1001', 'EMP-1002', 'EMP-1003'].map((code) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => {
                      void stopQrScanUi();
                      setMethod('EMPLOYEE_CODE');
                      setIdentifier(code);
                    }}
                  >
                    {code}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <form className={styles.form} onSubmit={onIdentify}>
              <label>
                Method
                <select value={method} onChange={(e) => setMethod(e.target.value as typeof method)}>
                  <option value="EMPLOYEE_CODE">Employee code (demo)</option>
                  <option value="QR">QR payload</option>
                  <option value="RFID">RFID tag</option>
                </select>
              </label>
              <label>
                Identifier
                <input
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="EMP-1001 or GSA:v1:… or RFID-1001"
                  required
                />
              </label>
              <div className={styles.quick}>
                {['EMP-1001', 'EMP-1002', 'EMP-1003'].map((code) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => {
                      setMethod('EMPLOYEE_CODE');
                      setIdentifier(code);
                    }}
                  >
                    {code}
                  </button>
                ))}
              </div>
              <label>
                Direction
                <select
                  value={direction}
                  onChange={(e) => setDirection(e.target.value as 'ENTRY' | 'EXIT')}
                >
                  <option value="ENTRY">ENTRY</option>
                  <option value="EXIT">EXIT</option>
                </select>
              </label>
              <div className={styles.actions}>
                <button type="submit" disabled={busy}>
                  Identify
                </button>
                <button type="button" disabled={busy} onClick={() => void startQrScan()}>
                  Scan QR instead
                </button>
              </div>
            </form>
          )}

          {identified && (
            <div className={styles.identityCard}>
              <span className={styles.identityKicker}>Identified</span>
              <strong>{identified.employee.fullName}</strong>
              <div className={styles.meta}>
                {identified.employee.employeeCode}
                {identified.employee.departmentName ? ` · ${identified.employee.departmentName}` : ''}
                {` · ${identified.direction}`}
              </div>
              <div className={styles.ppeNeeded}>
                {identified.requiredPpe.map((item) => (
                  <span key={item} className={styles.ppeChip}>
                    {ppeLabel(item)}
                  </span>
                ))}
              </div>
            </div>
          )}
        </section>

          <div className={styles.extras}>
            {snapshotUrl && (
              <div className={styles.snapshotRow}>
                <img src={snapshotUrl} alt="Captured PPE frame" className={styles.snapshot} />
                <div className={styles.snapshotCopy}>
                  <strong>Last capture</strong>
                  <p className={styles.meta}>Ready for inspect or retake.</p>
                </div>
              </div>
            )}
            <div className={styles.extrasGrid}>
              <label>
                Detection mode
                <select
                  value={detectMode}
                  onChange={(e) => setDetectMode(e.target.value as 'camera' | 'simulate')}
                >
                  <option value="camera">Camera</option>
                  <option value="simulate">Simulate</option>
                </select>
              </label>
              {detectMode === 'simulate' ? (
                <label>
                  Simulated scenario
                  <select value={scenario} onChange={(e) => setScenario(e.target.value)}>
                    {SCENARIOS.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <p className={styles.hint}>
                  Fill the outline, then hold still when the frame turns green.
                </p>
              )}
              <label>
                Upload photo
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null;
                    setFrame(file);
                    if (snapshotUrl) URL.revokeObjectURL(snapshotUrl);
                    setSnapshotUrl(file ? URL.createObjectURL(file) : null);
                  }}
                />
              </label>
            </div>
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.primary}
                disabled={busy || !identified}
                onClick={() => void onInspect()}
              >
                Capture & run PPE inspect
              </button>
            </div>
          </div>
        </div>

        <section className={styles.cameraColumn}>
          <div className={styles.stageHead}>
            <h3>PPE camera</h3>
            <p>The detection frame follows you. Results open in a popup when the check finishes.</p>
          </div>
          <div
            className={styles.stage}
            data-status={trackStatus}
            data-decision={result?.decision ?? ''}
          >
            <div
              ref={cameraBoxRef}
              className={styles.cameraBox}
              data-status={trackStatus}
              data-decision={result?.decision ?? ''}
              data-live={cameraOn ? 'true' : 'false'}
              data-follow={guideFollow ? 'true' : 'false'}
            >
              <video ref={videoRef} className={styles.video} playsInline muted autoPlay />
              <canvas ref={overlayRef} className={styles.overlay} />
              {showGuide && (
                <div
                  className={styles.frameGuide}
                  data-follow={guideFollow ? 'true' : 'false'}
                  style={followingGuideStyle}
                  aria-hidden
                >
                  <span className={styles.bracketTl} />
                  <span className={styles.bracketTr} />
                  <span className={styles.bracketBl} />
                  <span className={styles.bracketBr} />
                  {showSilhouette && (
                    <svg className={styles.silhouette} viewBox="0 0 120 180">
                      <circle cx="60" cy="40" r="22" />
                      <path d="M24 168c4-52 28-70 36-70s32 18 36 70" />
                    </svg>
                  )}
                </div>
              )}
              {cameraOn && (
                <div className={styles.cameraHud}>
                  <span className={styles.livePill}>
                    <span className={styles.liveDot} />
                    LIVE
                  </span>
                  <div className={styles.hudCopy}>
                    <span className={styles.hudKicker}>{hud.kicker}</span>
                    <strong>{hud.title}</strong>
                  </div>
                </div>
              )}
              {showLockBar && (
                <div className={styles.lockTrack} aria-hidden>
                  <div className={styles.lockFill} style={{ width: `${Math.round(lockProgress * 100)}%` }} />
                </div>
              )}
              {!cameraOn && (
                <div className={styles.cameraPlaceholder}>
                  <strong>PPE capture camera is off</strong>
                  Start the webcam. Step into view — the outline follows your body.
                </div>
              )}
              {cameraOn && (
                <div className={styles.trackBadge} data-status={trackStatus}>
                  {hud.badge}
                  {personScore != null ? ` · ${Math.round(personScore * 100)}%` : ''}
                </div>
              )}
              {busy && cameraOn && identified && resultModal === 'closed' && (
                <div className={styles.inspectMask}>
                  <div>
                    <strong>Checking PPE…</strong>
                    <span>Helmet, vest, and uniform are being inspected</span>
                  </div>
                </div>
              )}
              {flash && <div className={styles.flash} />}
            </div>
            <canvas ref={captureCanvasRef} className={styles.hiddenCanvas} />

            <div className={styles.toolbar}>
              {!cameraOn ? (
                <button type="button" onClick={() => void startCamera()}>
                  Start webcam
                </button>
              ) : (
                <button type="button" onClick={stopCamera}>
                  Stop webcam
                </button>
              )}
              <button
                type="button"
                disabled={!cameraOn || busy || trackStatus === 'awaiting_retake'}
                onClick={() => {
                  if (trackStatus === 'awaiting_retake') {
                    setError('Click Retake first — this attempt already finished.');
                    return;
                  }
                  capturedForPresenceRef.current = true;
                  setTrackStatus('captured');
                  void (async () => {
                    const file = await captureFrame();
                    if (identifiedRef.current) {
                      await runInspectWithFile(file);
                    }
                  })();
                }}
              >
                Capture now
              </button>
              <button
                type="button"
                className={styles.primary}
                disabled={busy || !identifier.trim()}
                onClick={() => void onRetake()}
              >
                Retake
              </button>
              <label className={styles.checkRow}>
                <input
                  type="checkbox"
                  checked={autoInspect}
                  onChange={(e) => setAutoInspect(e.target.checked)}
                />
                Auto inspect
              </label>
            </div>
          </div>
        </section>
      </div>

      {resultModal !== 'closed' &&
        createPortal(
          <div
            className={styles.resultOverlay}
            role="dialog"
            aria-modal="true"
            aria-labelledby="ppe-result-title"
          >
            <div className={styles.resultOverlayScrim} onClick={() => setResultModal('closed')} />
            <div className={styles.resultWindow} data-decision={result?.decision ?? 'PENDING'}>
              <button
                type="button"
                className={styles.resultClose}
                onClick={() => setResultModal('closed')}
                aria-label="Close results"
              >
                Close
              </button>

              <div className={styles.resultWindowGrid}>
                <div className={styles.resultPhoto}>
                  {snapshotUrl ? (
                    <img src={snapshotUrl} alt="Live PPE snapshot" />
                  ) : (
                    <div className={styles.resultPhotoEmpty}>No snapshot</div>
                  )}
                  <span className={styles.resultPhotoLabel}>Live snapshot</span>
                </div>

                <div className={styles.resultIdentity}>
                  <p className={styles.resultKicker}>PPE inspection</p>
                  <h3 id="ppe-result-title">
                    {identified?.employee.fullName ?? 'Employee'}
                  </h3>
                  <dl className={styles.resultFacts}>
                    <div>
                      <dt>Employee ID</dt>
                      <dd>{identified?.employee.employeeCode ?? '—'}</dd>
                    </div>
                    <div>
                      <dt>Department</dt>
                      <dd>{identified?.employee.departmentName ?? '—'}</dd>
                    </div>
                    <div>
                      <dt>Direction</dt>
                      <dd>{identified?.direction ?? direction}</dd>
                    </div>
                  </dl>
                  <div
                    className={
                      resultModal === 'checking'
                        ? styles.resultStampBannerWait
                        : result?.decision === 'GRANTED'
                          ? styles.resultStampBannerOk
                          : result?.decision === 'DENIED'
                            ? styles.resultStampBannerBad
                            : styles.resultStampBannerWait
                    }
                  >
                    {resultModal === 'checking'
                      ? 'Checking PPE…'
                      : result?.decision === 'GRANTED'
                        ? 'Access granted'
                        : result?.decision === 'DENIED'
                          ? 'Access denied'
                          : 'Waiting for result'}
                  </div>
                  <p className={styles.resultWindowSummary}>
                    {resultModal === 'checking'
                      ? 'Snapshot captured. Inspecting helmet, safety vest, and uniform.'
                      : resultSummary}
                  </p>
                </div>
              </div>

              <section className={styles.resultWindowSection}>
                <h4>PPE scores</h4>
                <PpeMeters result={resultModal === 'ready' ? result : null} />
              </section>

              <section className={styles.resultWindowSection}>
                <h4>Recommendations</h4>
                {resultModal === 'checking' ? (
                  <p className={styles.meta}>Recommendations appear when the check finishes.</p>
                ) : (
                  <ul className={styles.recommendList}>
                    {(result
                      ? ppeRecommendations(result, identified?.requiredPpe ?? [])
                      : ['Capture a live snapshot to get PPE recommendations.']
                    ).map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                )}
              </section>

              <div className={styles.resultWindowActions}>
                <button type="button" onClick={() => setResultModal('closed')}>
                  Back to camera
                </button>
                {result?.decision === 'DENIED' && (
                  <button
                    type="button"
                    className={styles.primary}
                    disabled={busy}
                    onClick={() => void onRetake()}
                  >
                    Retake after fixing PPE
                  </button>
                )}
                {result?.decision === 'GRANTED' && (
                  <button
                    type="button"
                    className={styles.primary}
                    disabled={busy}
                    onClick={() => void onRetake()}
                  >
                    Next person
                  </button>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
