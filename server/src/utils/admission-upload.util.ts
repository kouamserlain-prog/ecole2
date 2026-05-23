import fs from 'fs';
import type { Request } from 'express';
import { getFileUrl } from '../middleware/upload.middleware';

export function unlinkUploadedFile(file: Express.Multer.File | undefined): void {
  if (file?.path && fs.existsSync(file.path)) {
    try {
      fs.unlinkSync(file.path);
    } catch {
      /* ignore */
    }
  }
}

export function term3ReportCardDataFromUpload(req: Request):
  | {
      term3ReportCardUrl: string;
      term3ReportCardOriginalName: string;
      term3ReportCardMimeType: string;
    }
  | null {
  const file = req.file;
  if (!file) return null;
  const relative = getFileUrl(file.filename, 'admission-documents');
  const host = req.get('host');
  const protocol = req.protocol;
  const fullUrl = host ? `${protocol}://${host}${relative}` : relative;
  return {
    term3ReportCardUrl: fullUrl,
    term3ReportCardOriginalName: file.originalname,
    term3ReportCardMimeType: file.mimetype,
  };
}
