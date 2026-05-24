"use client";

/**
 * Fond décoratif discret (mailles + halos) derrière les graphiques Recharts.
 */
export function PremiumChartMeshBackground() {
  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl"
      aria-hidden
    >
      <div
        className="absolute -right-12 -top-16 h-48 w-48 rounded-full bg-indigo-400/15 blur-3xl animate-pulse"
        style={{ animationDuration: '4s' }}
      />
      <div
        className="absolute -bottom-20 -left-8 h-56 w-56 rounded-full bg-violet-400/12 blur-3xl animate-pulse"
        style={{ animationDuration: '6s' }}
      />
      <div
        className="absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, rgb(148 163 184 / 0.22) 1px, transparent 0)`,
          backgroundSize: "24px 24px",
        }}
      />
    </div>
  );
}
