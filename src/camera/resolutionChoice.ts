/**
 * Réglages de caméra forçables par l'adresse (diagnostic) :
 * `?res=640|960|1280` (résolution) et `?fps=30|60` (cadence demandée).
 */
export interface Resolution {
  width: number;
  height: number;
}

export function resolveResolution(
  search: string,
  presets: Readonly<Record<string, Resolution>>,
  fallback: Resolution,
): { resolution: Resolution; forced: boolean } {
  const key = new URLSearchParams(search).get('res')?.trim();
  const preset = key ? presets[key] : undefined;
  return preset ? { resolution: preset, forced: true } : { resolution: fallback, forced: false };
}

export function resolveFrameRate(
  search: string,
  allowed: readonly number[],
  fallback: number,
): { frameRate: number; forced: boolean } {
  const v = Number(new URLSearchParams(search).get('fps'));
  return allowed.includes(v) ? { frameRate: v, forced: true } : { frameRate: fallback, forced: false };
}
