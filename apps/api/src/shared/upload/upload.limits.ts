import { BadRequestException } from '@nestjs/common';
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';

/** Max kiosk evidence frame size (bytes). */
export const INSPECT_FRAME_MAX_BYTES = 3 * 1024 * 1024;

const ALLOWED_FRAME_MIME = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);

export function isAllowedInspectMime(mime: string | undefined): boolean {
  if (!mime) return false;
  return ALLOWED_FRAME_MIME.has(mime.toLowerCase());
}

export function inspectFrameMulterOptions(): MulterOptions {
  return {
    limits: { fileSize: INSPECT_FRAME_MAX_BYTES, files: 1 },
    fileFilter: (_req, file, cb) => {
      if (!isAllowedInspectMime(file.mimetype)) {
        cb(
          new BadRequestException({
            code: 'INVALID_FRAME_TYPE',
            title: 'Bad Request',
            detail: 'Frame must be JPEG, PNG, or WebP',
          }),
          false,
        );
        return;
      }
      cb(null, true);
    },
  };
}
