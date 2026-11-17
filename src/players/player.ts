/** Profil joueuse (section 8) : pseudonyme uniquement, aucun nom (section 11). */

export type Category = 'pro' | 'cf' | 'reserve' | 'champ';
export type Position = 'gardienne' | 'champ';
export type Laterality = 'droitiere' | 'gauchere';

export const CATEGORY_LABELS: Record<Category, string> = {
  pro: 'Pro',
  cf: 'Centre de formation',
  reserve: 'Réserve',
  champ: 'Joueuse de champ',
};

export const POSITION_LABELS: Record<Position, string> = {
  gardienne: 'Gardienne',
  champ: 'Joueuse de champ',
};

export const LATERALITY_LABELS: Record<Laterality, string> = {
  droitiere: 'Droitière',
  gauchere: 'Gauchère',
};

export interface Player {
  /** Pseudonyme (G1, C2, TEST…), sert d'identifiant. */
  id: string;
  category: Category;
  position: Position;
  laterality: Laterality;
  heightCm: number;
  /** Étalonnage individuel : hauteur de garde visage → chevilles (cm), mesurée sur la ligne de but. */
  guardHeightCm?: number;
  /** Date ISO de l'étalonnage individuel. */
  guardHeightDate?: string;
  active: boolean;
  createdAt: string;
}

export type PlayerInput = Omit<Player, 'active' | 'createdAt' | 'guardHeightCm' | 'guardHeightDate'>;

/** Pseudonyme : 1 à 8 lettres majuscules ou chiffres (pas d'espace, pas d'accent). */
export const PSEUDONYM_PATTERN = /^[A-Z0-9]{1,8}$/;

export function normalizePseudonym(raw: string): string {
  return raw.trim().toUpperCase();
}

export function validatePlayer(
  input: PlayerInput,
  limits: { minHeightCm: number; maxHeightCm: number },
  existingIds: readonly string[] = [],
): string[] {
  const errors: string[] = [];
  if (!PSEUDONYM_PATTERN.test(input.id)) {
    errors.push('Pseudonyme : 1 à 8 lettres ou chiffres, sans espace (ex. G1).');
  } else if (existingIds.includes(input.id)) {
    errors.push(`Le pseudonyme ${input.id} existe déjà.`);
  }
  if (!(input.category in CATEGORY_LABELS)) errors.push('Catégorie invalide.');
  if (!(input.position in POSITION_LABELS)) errors.push('Poste invalide.');
  if (!(input.laterality in LATERALITY_LABELS)) errors.push('Latéralité invalide.');
  if (
    !Number.isFinite(input.heightCm) ||
    input.heightCm < limits.minHeightCm ||
    input.heightCm > limits.maxHeightCm
  ) {
    errors.push(`Taille : entre ${limits.minHeightCm} et ${limits.maxHeightCm} cm.`);
  }
  return errors;
}
