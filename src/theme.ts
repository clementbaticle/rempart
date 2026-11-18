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
  /** Dégradé du fond : du bleu club (haut droite) au bleu nuit (bas gauche). */
  gradientTop: '#0C5E8F',
  gradientMid: '#0A2E52',
  background: '#06182C',
  /** Cartes « verre » posées sur le dégradé. */
  glassTop: 'rgba(255, 255, 255, 0.14)',
  glassBottom: 'rgba(255, 255, 255, 0.04)',
  glassLine: 'rgba(255, 255, 255, 0.18)',
  /** Lignes du terrain en fond, filigranes. */
  courtLine: 'rgba(255, 255, 255, 0.035)',
  watermark: 'rgba(255, 255, 255, 0.08)',
  /** Champs de formulaire. */
  field: 'rgba(6, 24, 44, 0.65)',
  text: '#FFFFFF',
  textSoft: '#B9D7EA',
  onYellow: '#06182C',
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
  /** Cible blanche de préparation (Go / no-go) : la zone est annoncée, la couleur vient ensuite. */
  cue: { color: '#F2F4F7', symbol: '○', label: 'Préparation' },
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
    '--brand-gradient-top': BRAND.gradientTop,
    '--brand-gradient-mid': BRAND.gradientMid,
    '--brand-bg': BRAND.background,
    '--brand-glass-top': BRAND.glassTop,
    '--brand-glass-bottom': BRAND.glassBottom,
    '--brand-glass-line': BRAND.glassLine,
    '--brand-court-line': BRAND.courtLine,
    '--brand-watermark': BRAND.watermark,
    '--brand-field': BRAND.field,
    '--brand-text': BRAND.text,
    '--brand-text-soft': BRAND.textSoft,
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
