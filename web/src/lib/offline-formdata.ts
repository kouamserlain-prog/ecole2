/**
 * Sérialisation / désérialisation FormData pour la file hors ligne.
 */

export type SerializedFormField = {
  name: string;
  value: string;
};

export type SerializedFormFile = {
  blobKey: string;
  fieldName: string;
  fileName: string;
  mimeType: string;
  size: number;
};

export type SyncQueueBody =
  | { kind: 'json'; data: unknown }
  | { kind: 'multipart'; fields: SerializedFormField[]; files: SerializedFormFile[] };

export function isMultipartBody(body: unknown): body is Extract<SyncQueueBody, { kind: 'multipart' }> {
  return Boolean(body && typeof body === 'object' && (body as SyncQueueBody).kind === 'multipart');
}

export function normalizeQueueBody(body: unknown): SyncQueueBody | undefined {
  if (body === undefined || body === null) return undefined;
  if (typeof body === 'object' && body !== null && 'kind' in body) {
    return body as SyncQueueBody;
  }
  return { kind: 'json', data: body };
}

export function extractFormDataParts(
  formData: FormData,
  blobKeyPrefix: string,
): { fields: SerializedFormField[]; files: Array<{ meta: SerializedFormFile; blob: Blob }> } {
  const fields: SerializedFormField[] = [];
  const files: Array<{ meta: SerializedFormFile; blob: Blob }> = [];
  let fileIndex = 0;

  formData.forEach((value, name) => {
    if (typeof value !== 'string') {
      const blob = value as Blob;
      const fileName =
        value instanceof File && value.name
          ? value.name
          : `fichier-${fileIndex + 1}`;
      const blobKey = `${blobKeyPrefix}:file:${fileIndex}`;
      files.push({
        meta: {
          blobKey,
          fieldName: name,
          fileName,
          mimeType: blob.type || 'application/octet-stream',
          size: blob.size,
        },
        blob,
      });
      fileIndex += 1;
      return;
    }
    fields.push({ name, value });
  });

  return { fields, files };
}

export function buildFormDataFromParts(
  fields: SerializedFormField[],
  files: SerializedFormFile[],
  loadBlob: (blobKey: string) => Promise<Blob | null>,
): Promise<FormData> {
  return (async () => {
    const form = new FormData();
    for (const field of fields) {
      form.append(field.name, field.value);
    }
    for (const fileMeta of files) {
      const blob = await loadBlob(fileMeta.blobKey);
      if (!blob) {
        throw new Error(`Fichier local introuvable : ${fileMeta.fileName}`);
      }
      const file = new File([blob], fileMeta.fileName, { type: fileMeta.mimeType });
      form.append(fileMeta.fieldName, file);
    }
    return form;
  })();
}

export function collectBlobKeys(body: SyncQueueBody | undefined): string[] {
  if (!body || body.kind !== 'multipart') return [];
  return body.files.map((f) => f.blobKey);
}
