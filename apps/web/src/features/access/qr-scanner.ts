import { Html5Qrcode, type CameraDevice } from 'html5-qrcode';

export { isGranisafeQrPayload, QR_SCAN_DEBOUNCE_MS, GSA_QR_PREFIX } from './qr-payload';

export async function pickQrCameraId(): Promise<string | undefined> {
  const cameras: CameraDevice[] = await Html5Qrcode.getCameras();
  if (!cameras.length) return undefined;
  const back = cameras.find((c) => /back|rear|environment/i.test(c.label));
  return (back ?? cameras[0])?.id;
}

export async function startQrScanner(input: {
  elementId: string;
  onDecode: (text: string) => void;
  onError?: (message: string) => void;
}): Promise<Html5Qrcode> {
  const scanner = new Html5Qrcode(input.elementId, { verbose: false });
  const cameraId = await pickQrCameraId();
  const config = {
    fps: 8,
    qrbox: { width: 240, height: 240 },
    aspectRatio: 1.333,
  };

  try {
    if (cameraId) {
      await scanner.start(
        cameraId,
        config,
        (decoded) => input.onDecode(decoded),
        () => undefined,
      );
    } else {
      await scanner.start(
        { facingMode: 'environment' },
        config,
        (decoded) => input.onDecode(decoded),
        () => undefined,
      );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unable to start QR camera';
    input.onError?.(message);
    throw err;
  }

  return scanner;
}

export async function stopQrScanner(scanner: Html5Qrcode | null): Promise<void> {
  if (!scanner) return;
  try {
    if (scanner.isScanning) {
      await scanner.stop();
    }
  } catch {
    /* already stopped */
  }
  try {
    scanner.clear();
  } catch {
    /* element may be unmounted */
  }
}
