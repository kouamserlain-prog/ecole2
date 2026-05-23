import type { Request } from 'express';
import { discardUploadedFile, persistUploadedFile } from './upload-persist.util';

export { discardUploadedFile as unlinkUploadedFile };

export async function term3ReportCardDataFromUpload(req: Request): Promise<{
  term3ReportCardUrl: string;
  term3ReportCardOriginalName: string;
  term3ReportCardMimeType: string;
} | null> {
  const file = req.file;
  if (!file) return null;
  const term3ReportCardUrl = await persistUploadedFile(file, 'admission-documents', { req });
  return {
    term3ReportCardUrl,
    term3ReportCardOriginalName: file.originalname,
    term3ReportCardMimeType: file.mimetype,
  };
}
