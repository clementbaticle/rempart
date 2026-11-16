/**
 * Fichier de thème unique : toutes les couleurs de l'interface.
 * Les feuilles de style n'utilisent que les variables CSS injectées ici.
 *
 * Règles (cahier des charges, section 10) :
 * - les couleurs TMVH (`brand`) servent uniquement à l'accueil, aux menus et aux résultats ;
 * - pendant les exercices (`exercise`), fond sombre et neutre, aucune couleur du club ;
 * - les couleurs des cibles (`targets`) sont fixes, indépendantes du thème,
 *   et toujours accompagnées d'un symbole.
 */

/** Habillage TMVH : accueil, menus, résultats. */
export const BRAND = {
  blue: '#04A5DF',
  yellow: '#FBD427',
  background: '#0B1D2A',
  surface: '#12293A',
  text: '#FFFFFF',
  textMuted: '#A9C1D1',
  onYellow: '#0B1D2A',
} as const;

/** Écrans d'exercice : neutre, sans couleur du club. */
export const EXERCISE = {
  background: '#0E1116',
  panel: 'rgba(14, 17, 22, 0.78)',
  text: '#E6E8EB',
  textMuted: '#8B949E',
  skeleton: '#C9D1D9',
  gridLine: 'rgba(201, 209, 217, 0.45)',
  progressTrack: 'rgba(230, 232, 235, 0.2)',
  landmark: '#FFFFFF',
  ok: '#3FB950',
  warning: '#D29922',
  error: '#F85149',
} as const;

/** Cibles : couleurs et symboles fixes (ne jamais dériver du thème). */
export const TARGETS = {
  go: { color: '#22C55E', symbol: '●', label: 'Go' },
  noGo: { color: '#EF4444', symbol: '✕', label: 'No-go' },
  leftHand: { color: '#F97316', symbol: 'G', label: 'Main gauche' },
  rightHand: { color: '#E91EDB', symbol: 'D', label: 'Main droite' },
  /** Le symbole « pied » est une icône (dessinée), pas un caractère. */
  foot: { color: '#FFFFFF', symbol: 'foot-icon', label: 'Pied' },
} as const;

export type TargetKind = keyof typeof TARGETS;

/** Injecte les couleurs sous forme de variables CSS sur :root. */
export function applyTheme(root: HTMLElement = document.documentElement): void {
  const vars: Record<string, string> = {
    '--brand-blue': BRAND.blue,
    '--brand-yellow': BRAND.yellow,
    '--brand-bg': BRAND.background,
    '--brand-surface': BRAND.surface,
    '--brand-text': BRAND.text,
    '--brand-text-muted': BRAND.textMuted,
    '--brand-on-yellow': BRAND.onYellow,
    '--ex-bg': EXERCISE.background,
    '--ex-panel': EXERCISE.panel,
    '--ex-text': EXERCISE.text,
    '--ex-text-muted': EXERCISE.textMuted,
    '--ex-ok': EXERCISE.ok,
    '--ex-warning': EXERCISE.warning,
    '--ex-error': EXERCISE.error,
    '--ex-progress-track': EXERCISE.progressTrack,
  };
  for (const [name, value] of Object.entries(vars)) root.style.setProperty(name, value);
}
