import type { DensityMode } from './types';

export function getDefaultDensity(width: number): DensityMode {
  if (width >= 1600) return 'standard';
  return 'compact';
}

export function shouldHideSparkline(width: number): boolean {
  return width < 1280;
}

export function resolveBreakpoint(width: number): 'lg' | 'md' | 'sm' {
  if (width >= 1600) return 'lg';
  if (width >= 1280) return 'md';
  return 'sm';
}
