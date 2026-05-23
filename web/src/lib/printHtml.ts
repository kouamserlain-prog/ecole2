/**
 * Impression HTML sans fenêtre pop-up (évite le blocage navigateur).
 */
export function printHtmlDocument(html: string, delayMs = 350): void {
  if (typeof document === 'undefined') {
    throw new Error('Impression indisponible dans cet environnement.');
  }

  const iframe = document.createElement('iframe');
  iframe.setAttribute(
    'style',
    'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden',
  );
  iframe.setAttribute('title', 'Impression');
  document.body.appendChild(iframe);

  const win = iframe.contentWindow;
  const doc = iframe.contentDocument ?? win?.document;
  if (!doc || !win) {
    iframe.remove();
    throw new Error('Impossible de préparer l’impression.');
  }

  doc.open();
  doc.write(html);
  doc.close();

  const cleanup = () => {
    try {
      iframe.remove();
    } catch {
      /* déjà retiré */
    }
  };

  const trigger = () => {
    try {
      win.focus();
      win.print();
    } catch {
      cleanup();
      throw new Error('Impossible de lancer l’impression.');
    }
  };

  win.onafterprint = cleanup;
  setTimeout(() => {
    trigger();
    setTimeout(cleanup, 60_000);
  }, delayMs);
}
