import type { Request, Response, NextFunction } from 'express';
import { getDeviceApiKey } from '../utils/device-api-key.util';
import { secureCompareStrings } from '../utils/secure-compare.util';

function readDeviceApiKey(req: Request): string | undefined {
  const header = req.headers['x-nfc-api-key'];
  if (typeof header === 'string' && header.length > 0) return header;
  const bodyKey = req.body?.apiKey;
  if (typeof bodyKey === 'string' && bodyKey.length > 0) return bodyKey;
  return undefined;
}

/**
 * Authentifie un terminal de pointage (NFC / visage) via X-NFC-API-Key.
 * En production, la clé dans l’URL (?apiKey) est refusée (fuite dans logs / historique).
 */
export function verifyDeviceApiKey(req: Request, res: Response, next: NextFunction): void {
  const queryKey = req.query.apiKey;
  if (
    process.env.NODE_ENV === 'production' &&
    typeof queryKey === 'string' &&
    queryKey.length > 0
  ) {
    res.status(400).json({
      error: 'Utilisez l’en-tête X-NFC-API-Key pour la clé matériel (pas de paramètre d’URL).',
    });
    return;
  }

  let provided = readDeviceApiKey(req);
  if (!provided && typeof queryKey === 'string') {
    provided = queryKey;
  }

  if (!provided || !secureCompareStrings(provided, getDeviceApiKey())) {
    res.status(401).json({
      error: 'Clé API matériel invalide ou manquante',
      message: 'Fournissez X-NFC-API-Key (terminal de pointage).',
    });
    return;
  }

  next();
}
