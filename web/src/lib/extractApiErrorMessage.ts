/** Extrait un message lisible depuis une réponse d’erreur API (axios). */
export function extractApiErrorMessage(
  err: unknown,
  fallback = 'Une erreur est survenue. Réessayez plus tard.'
): string {
  const data = (err as { response?: { data?: unknown } })?.response?.data;
  if (!data || typeof data !== 'object') {
    const msg = (err as Error)?.message;
    if (msg && /network|refused|failed/i.test(msg)) {
      return 'Serveur indisponible. Vérifiez votre connexion ou réessayez dans un instant.';
    }
    return fallback;
  }

  const record = data as Record<string, unknown>;
  if (typeof record.error === 'string' && record.error.trim()) {
    return record.error.trim();
  }

  const errors = record.errors;
  if (Array.isArray(errors) && errors.length > 0) {
    const parts = errors
      .map((e) => {
        if (!e || typeof e !== 'object') return null;
        const row = e as { msg?: string; message?: string };
        return row.msg || row.message || null;
      })
      .filter((s): s is string => Boolean(s));
    if (parts.length > 0) return parts.join(' · ');
  }

  return fallback;
}
