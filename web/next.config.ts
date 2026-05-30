import type { NextConfig } from "next";
import path from "path";

/**
 * Origine du backend pour proxifier `/uploads/*` vers Express (logos branding, avatars, etc.).
 * Priorité : NEXT_PUBLIC_UPLOADS_ORIGIN, sinon origine dérivée de NEXT_PUBLIC_API_URL si absolue.
 * Désactiver avec NEXT_PUBLIC_DISABLE_UPLOADS_REWRITE=1 si front et API sont déjà sur le même domaine (reverse proxy).
 */
function isSafeHttpOrigin(origin: string): boolean {
  try {
    const u = new URL(origin);
    if (u.username || u.password) return false;
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

function backendOriginForUploadsProxy(): string | null {
  const explicit = process.env.NEXT_PUBLIC_UPLOADS_ORIGIN?.replace(/\/+$/, "").trim();
  if (explicit?.startsWith("http://") || explicit?.startsWith("https://")) {
    if (!isSafeHttpOrigin(explicit)) return null;
    return explicit.replace(/\/+$/, "");
  }
  const api = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "").trim();
  if (api?.startsWith("http://") || api?.startsWith("https://")) {
    if (!isSafeHttpOrigin(api)) return null;
    const stripped = api.replace(/\/api\/?$/i, "").replace(/\/+$/, "");
    return stripped.length > 0 ? stripped : null;
  }
  return null;
}

/** Pages publiques sensibles aux mises à jour (formulaire pré-inscription, etc.). */
const NO_STORE_CACHE_HEADERS = [
  { key: "Cache-Control", value: "no-store, no-cache, must-revalidate, max-age=0" },
  { key: "Pragma", value: "no-cache" },
  { key: "CDN-Cache-Control", value: "no-store" },
  { key: "Surrogate-Control", value: "no-store" },
] as const;

const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
] as const;

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data: https:",
  "media-src 'self' blob: https:",
  "connect-src 'self' https: wss:",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https:",
  "style-src 'self' 'unsafe-inline' https:",
  "upgrade-insecure-requests",
].join("; ");

const PRODUCTION_SECURITY_HEADERS =
  process.env.NODE_ENV === "production"
    ? ([
        { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" },
        { key: "Content-Security-Policy", value: CONTENT_SECURITY_POLICY },
      ] as const)
    : [];

const nextConfig: NextConfig = {
  /** Playwright et accès via 127.0.0.1 (évite le blocage HMR cross-origin en dev). */
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  turbopack: {
    root: path.resolve(process.cwd()),
  },
  async headers() {
    return [
      { source: "/:path*", headers: [...SECURITY_HEADERS, ...PRODUCTION_SECURITY_HEADERS] },
      { source: "/inscription", headers: [...NO_STORE_CACHE_HEADERS, ...SECURITY_HEADERS, ...PRODUCTION_SECURITY_HEADERS] },
      { source: "/pre-inscription", headers: [...NO_STORE_CACHE_HEADERS, ...SECURITY_HEADERS, ...PRODUCTION_SECURITY_HEADERS] },
    ];
  },
  async rewrites() {
    // Même domaine que l’API (reverse proxy, pas de proxy Next nécessaire) — évite une boucle si l’API est sur le même hôte.
    if (process.env.NEXT_PUBLIC_DISABLE_UPLOADS_REWRITE === "1") return [];
    const origin = backendOriginForUploadsProxy();
    if (!origin || !isSafeHttpOrigin(origin)) return [];
    return [
      {
        source: "/uploads/:path*",
        destination: `${origin}/uploads/:path*`,
      },
      {
        source: "/api/uploads/:path*",
        destination: `${origin}/uploads/:path*`,
      },
    ];
  },
};

export default nextConfig;
