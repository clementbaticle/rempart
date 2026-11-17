/** Création ou modification d'un profil joueuse (habillage TMVH). Aucun nom : pseudonyme uniquement. */
import { CONFIG } from '../config';
import {
  CATEGORY_LABELS, LATERALITY_LABELS, POSITION_LABELS, normalizePseudonym, validatePlayer,
  type Category, type Laterality, type Player, type PlayerInput, type Position,
} from '../players/player';

function options(labels: Record<string, string>): string {
  return Object.entries(labels)
    .map(([v, l]) => `<option value="${v}">${l}</option>`)
    .join('');
}

export interface PlayerFormOptions {
  /** Pseudonymes déjà utilisés (le profil modifié est exclu automatiquement). */
  existingIds: readonly string[];
  /** Profil à modifier ; absent pour une création. */
  initial?: Player;
  onSubmit: (input: PlayerInput) => Promise<void>;
  onCancel: () => void;
}

export function renderPlayerForm(root: HTMLElement, o: PlayerFormOptions): void {
  const { minHeightCm, maxHeightCm } = CONFIG.player;
  const editing = o.initial !== undefined;
  root.innerHTML = `
    <main class="club club--form">
      <div class="club__band" aria-hidden="true"></div>
      <div class="club__inner">
      <form class="form" novalidate>
        <h1 class="form__title">${editing ? 'Modifier le <span>profil</span>' : 'Nouveau <span>profil</span>'}</h1>
        <p class="form__note">Aucun nom dans l’app : utilisez un pseudonyme (G1, G2…).
          La correspondance nom ↔ pseudonyme se garde en dehors de l’app.</p>
        <div class="form__grid">
          <label>Pseudonyme
            <input name="id" autocomplete="off" autocapitalize="characters" maxlength="8" placeholder="G1" required />
          </label>
          <label>Taille (cm)
            <input name="heightCm" type="number" inputmode="numeric" min="${minHeightCm}" max="${maxHeightCm}" step="1" required />
          </label>
          <label>Catégorie <select name="category">${options(CATEGORY_LABELS)}</select></label>
          <label>Poste <select name="position">${options(POSITION_LABELS)}</select></label>
          <label>Latéralité <select name="laterality">${options(LATERALITY_LABELS)}</select></label>
        </div>
        <p class="form__note" data-edit-note hidden>Les calibrations déjà enregistrées sont conservées
          (et suivent le profil si le pseudonyme change). Une nouvelle taille s’applique aux prochaines calibrations.</p>
        <ul class="form__errors" hidden></ul>
        <div class="form__actions">
          <button class="btn btn--ghost" type="button" data-action="cancel">Annuler</button>
          <button class="btn btn--primary" type="submit">${editing ? 'Enregistrer' : 'Créer'}</button>
        </div>
      </form>
      </div>
    </main>`;

  const form = root.querySelector('form')!;
  const field = <T extends HTMLInputElement | HTMLSelectElement>(name: string): T =>
    form.elements.namedItem(name) as T;
  if (o.initial) {
    field<HTMLInputElement>('id').value = o.initial.id;
    field<HTMLSelectElement>('category').value = o.initial.category;
    field<HTMLSelectElement>('position').value = o.initial.position;
    field<HTMLSelectElement>('laterality').value = o.initial.laterality;
    field<HTMLInputElement>('heightCm').value = String(o.initial.heightCm);
    root.querySelector<HTMLElement>('[data-edit-note]')!.hidden = false;
  }
  const otherIds = o.existingIds.filter((id) => id !== o.initial?.id);

  const errors = root.querySelector<HTMLElement>('.form__errors')!;
  const showErrors = (problems: readonly string[]): void => {
    errors.replaceChildren(
      ...problems.map((p) => {
        const li = document.createElement('li');
        li.textContent = p;
        return li;
      }),
    );
    errors.hidden = problems.length === 0;
  };
  root.querySelector('[data-action="cancel"]')!.addEventListener('click', o.onCancel);

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = new FormData(form);
    const input: PlayerInput = {
      id: normalizePseudonym(String(data.get('id') ?? '')),
      category: data.get('category') as Category,
      position: data.get('position') as Position,
      laterality: data.get('laterality') as Laterality,
      heightCm: Number(String(data.get('heightCm') ?? '').replace(',', '.')),
    };
    const problems = validatePlayer(input, CONFIG.player, otherIds);
    showErrors(problems);
    if (problems.length === 0) {
      o.onSubmit(input).catch((err: unknown) => showErrors([err instanceof Error ? err.message : String(err)]));
    }
  });
}
