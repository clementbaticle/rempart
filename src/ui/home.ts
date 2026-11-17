/** Écran d'accueil (habillage TMVH) : choix de la gardienne. */
import { CATEGORY_LABELS, type Player } from '../players/player';

export interface HomeActions {
  onSelectPlayer: (id: string) => void;
  onNewPlayer: () => void;
  onEditPlayer: (id: string) => void;
  onDiagnostic: () => void;
}

const PENCIL =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 17.5V20h2.5L17.8 8.7l-2.5-2.5L4 17.5Zm15.7-11.2a1 1 0 0 0 0-1.4l-1.6-1.6a1 1 0 0 0-1.4 0l-1.3 1.3 2.5 2.5 1.8-1.8Z" fill="currentColor"/></svg>';

const formatDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

export function renderHome(
  root: HTMLElement,
  players: readonly Player[],
  lastCalibration: ReadonlyMap<string, string>,
  a: HomeActions,
): void {
  const base = import.meta.env.BASE_URL;
  root.innerHTML = `
    <main class="brand">
      <header class="brand__bar">
        <div class="brand__identity">
          <img class="brand__mark" src="${base}brand/rempart-mark.svg" alt="" />
          <div>
            <div class="brand__name">Rempart</div>
            <div class="brand__tagline">Entraînement perceptivo-cognitif des gardiennes</div>
          </div>
        </div>
        <div class="brand__club">
          <img src="${base}brand/logo-tmvh.png" alt="Toulon Métropole Var Handball" />
        </div>
      </header>

      <section class="brand__content">
        <div class="brand__heading">
          <h1 class="brand__title">Gardiennes</h1>
          <p class="brand__lead">Choisissez une gardienne pour calibrer puis lancer une série.</p>
        </div>
        <div class="roster"></div>
      </section>

      <footer class="brand__footer">
        <button class="btn btn--ghost" type="button" data-action="diag">Diagnostic caméra</button>
        <span class="brand__version">Toulon Métropole Var Handball · v${__APP_VERSION__}</span>
      </footer>
    </main>`;

  const roster = root.querySelector<HTMLElement>('.roster')!;
  for (const player of players) {
    const card = el('article', 'roster__card');
    const main = el('button', 'roster__main');
    main.type = 'button';
    main.setAttribute('aria-label', `Calibrer ${player.id}`);
    main.append(el('span', 'roster__id', player.id));
    main.append(el('span', 'roster__meta', `${CATEGORY_LABELS[player.category]} · ${player.heightCm} cm`));

    const chips = el('span', 'roster__chips');
    chips.append(
      player.guardHeightCm !== undefined
        ? el('span', 'chip chip--ok', 'Étalonnée')
        : el('span', 'chip chip--todo', 'À étalonner'),
    );
    const last = lastCalibration.get(player.id);
    if (last) chips.append(el('span', 'chip', `Calibrée le ${formatDate(last)}`));
    main.append(chips);
    main.append(el('span', 'roster__cta', 'Calibrer →'));
    main.addEventListener('click', () => a.onSelectPlayer(player.id));

    const edit = el('button', 'roster__edit');
    edit.type = 'button';
    edit.innerHTML = PENCIL;
    edit.setAttribute('aria-label', `Modifier le profil ${player.id}`);
    edit.addEventListener('click', () => a.onEditPlayer(player.id));

    card.append(main, edit);
    roster.append(card);
  }

  const add = el('button', 'roster__add');
  add.type = 'button';
  add.innerHTML = '<span class="roster__plus">+</span><span>Nouveau profil</span>';
  add.addEventListener('click', a.onNewPlayer);
  roster.append(add);

  root.querySelector('[data-action="diag"]')!.addEventListener('click', a.onDiagnostic);
}
