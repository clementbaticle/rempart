/**
 * Choix du délégué de calcul (diagnostic) : `?delegate=CPU` ou `?delegate=GPU`
 * dans l'adresse force ce délégué ; sinon l'ordre par défaut (GPU puis CPU) s'applique.
 */
export type DelegateName = 'GPU' | 'CPU';

export function resolveDelegates(
  search: string,
  defaults: readonly DelegateName[],
): { delegates: readonly DelegateName[]; forced: boolean } {
  const value = new URLSearchParams(search).get('delegate')?.trim().toUpperCase();
  if (value === 'GPU' || value === 'CPU') return { delegates: [value], forced: true };
  return { delegates: defaults, forced: false };
}
