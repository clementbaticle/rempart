/** Création d'un profil joueuse (habillage TMVH). Aucun nom : pseudonyme uniquement. */
import { CONFIG } from '../config';
import {
  CATEGORY_LABELS, LATERALITY_LABELS, POSITION_LABELS, normalizePseudonym, validatePlayer,
  type Category, type Laterality, type PlayerInput, type Position,
} from '../players/player';

function options(labels: Record<string, string>): string {
  return Object.entries(labels)
    .map(([v, l]) => `<option value="${v}">${l}</option>`)
    .join('');
}

export function renderPlayerForm(
  root: HTMLElement,
  existingIds: readonly string[],
  onSubmit: (input: PlayerInput) => Promise<void>,
  onCancel: () => void,
): void {
  const { minHeightCm, maxHeightCm } = CONFIG.player;
  root.innerHTML = `
    <main class="home">
      <form class="form" novalidate>
        <h1 class="form__title">Nouveau profil</h1>
        <p class="form__note">Aucun nom dans l’app : utilisez un pseudonyme (G1, G2…).
          La correspondance nom ↔ pseudonyme se garde en dehors de l’app.</p>
        <label>Pseudonyme
          <input name="id" autocomplete="off" autocapitalize="characters" maxlength="8" placeholder="G1" required />
        </label>
        <label>Catégorie <select name="category">${options(CATEGORY_LABELS)}</select></label>
        <label>Poste <select name="position">${options(POSITION_LABELS)}</select></label>
        <label>Latéralité <select name="laterality">${options(LATERALITY_LABELS)}</select></label>
        <label>Taille (cm)
          <input name="heightCm" type="number" inputmode="numeric" min="${minHeightCm}" max="${maxHeightCm}" step="1" required />
        </label>
        <ul class="form__errors" hidden></ul>
        <div class="form__actions">
          <button class="btn btn--ghost" type="button" data-action="cancel">Annuler</button>
          <button class="btn btn--primary" type="submit">Créer</button>
        </div>
      </form>
    </main>`;

  const form = root.querySelector('form')!;
  const errors = root.querySelector<HTMLElement>('.form__errors')!;
  root.querySelector('[data-action="cancel"]')!.addEventListener('click', onCancel);

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
    const problems = validatePlayer(input, CONFIG.player, existingIds);
    errors.replaceChildren(
      ...problems.map((p) => {
        const li = document.createElement('li');
        li.textContent = p;
        return li;
      }),
    );
    errors.hidden = problems.length === 0;
    if (problems.length === 0) void onSubmit(input);
  });
}
