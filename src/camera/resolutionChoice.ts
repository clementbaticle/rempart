/**
 * Choix de la résolution demandée à la caméra (diagnostic) :
 * `?res=640`, `?res=960` ou `?res=1280` dans l'adresse ; sinon la résolution par défaut.
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
