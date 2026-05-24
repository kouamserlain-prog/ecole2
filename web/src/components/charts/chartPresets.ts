import {
  CHART_ANIMATION_EASING,
  CHART_ANIMATION_MS,
  CHART_BLUE,
  CHART_RED,
} from './premiumPalette';

/** Barres verticales — coins supérieurs arrondis */
export const PREMIUM_BAR_RADIUS_TOP: [number, number, number, number] = [14, 14, 4, 4];

/** Barres horizontales — coins droits arrondis */
export const PREMIUM_BAR_RADIUS_H_RIGHT: [number, number, number, number] = [0, 14, 14, 0];

export const PREMIUM_BAR_MAX_SIZE = 44;

export const PREMIUM_CHART_ANIMATION = {
  isAnimationActive: true,
  animationDuration: CHART_ANIMATION_MS,
  animationEasing: CHART_ANIMATION_EASING,
} as const;

export const PREMIUM_LINE_PROPS = {
  type: 'monotone' as const,
  strokeWidth: 2.5,
  dot: { r: 4, strokeWidth: 2, stroke: '#ffffff' },
  activeDot: { r: 6, strokeWidth: 2, stroke: '#ffffff' },
  ...PREMIUM_CHART_ANIMATION,
};

export const CHART_CURSOR = {
  stroke: '#94a3b8',
  strokeWidth: 1,
  strokeDasharray: '4 6',
};

export const CHART_REFERENCE_LINE = {
  stroke: '#cbd5e1',
  strokeDasharray: '6 6',
  strokeWidth: 1,
};

/**
 * Géométrie donut premium — évite les secteurs dégénérés à une seule part.
 */
export function premiumPieGeometry(segmentCount: number) {
  const multi = segmentCount > 1;
  return {
    innerRadius: 52,
    outerRadius: 82,
    paddingAngle: multi ? 2 : 0,
    cornerRadius: multi ? 10 : 0,
    stroke: '#ffffff',
    strokeWidth: 2,
    ...PREMIUM_CHART_ANIMATION,
  };
}

export const PREMIUM_LEGEND_STYLE = {
  verticalAlign: 'bottom' as const,
  iconType: 'circle' as const,
  iconSize: 8,
  wrapperStyle: {
    paddingTop: 12,
    fontSize: 11,
    fontWeight: 600,
    lineHeight: '16px',
  },
};

/** Couleurs sémantiques série primaire / secondaire */
export const SERIES_PRIMARY = CHART_BLUE;
export const SERIES_SECONDARY = CHART_RED;
