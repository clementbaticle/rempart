/** Écran d'accueil (habillage TMVH, direction « Club ») : choix de la gardienne. */
import { CATEGORY_LABELS, type Player } from '../players/player';

export interface HomeActions {
  onSelectPlayer: (id: string) => void;
  onNewPlayer: () => void;
  onEditPlayer: (id: string) => void;
  onHistory: (id: string) => void;
  onDiagnostic: () => void;
}

/** Chiffres clés affichés sur la carte d'une gardienne (dernière série enregistrée). */
export interface PlayerStats {
  lastCalibration: string | null;
  rtMedian: number | null;
  hitRate: number | null;
}

const CHART =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19h16v2H4zM5 16l4-5 4 3 6-8 1.6 1.2-7.2 9.6-4-3L6.6 17.2z" fill="currentColor"/></svg>';

const PENCIL =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 17.5V20h2.5L17.8 8.7l-2.5-2.5L4 17.5Zm15.7-11.2a1 1 0 0 0 0-1.4l-1.6-1.6a1 1 0 0 0-1.4 0l-1.3 1.3 2.5 2.5 1.8-1.8Z" fill="currentColor"/></svg>';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

function stat(value: string, label: string): HTMLElement {
  const s = el('div', 'card__stat');
  s.append(el('span', 'card__stat-value', value), el('span', 'card__stat-label', label));
  return s;
}

export function renderHome(
  root: HTMLElement,
  players: readonly Player[],
  stats: ReadonlyMap<string, PlayerStats>,
  a: HomeActions,
): void {
  const base = import.meta.env.BASE_URL;
  root.innerHTML = `
    <main class="club">
      <div class="club__band" aria-hidden="true"></div>
      <div class="club__inner">
        <header class="club__top">
          <div class="club__brand">
            <img class="club__mark" src="${base}brand/rempart-dots.svg" alt="" />
            <div>
              <div class="club__name">Rempart</div>
              <div class="club__sub">TMVH · Gardiennes</div>
            </div>
          </div>
          <img class="club__badge" src="${base}brand/logo-tmvh.png" alt="Toulon Métropole Var Handball" />
        </header>

        <div class="club__hero">
          <h1 class="club__title">Choisis ta<br /><span>gardienne</span></h1>
          <button class="club__new" type="button" data-action="new"><span>+</span> Nouveau profil</button>
        </div>

        <section class="club__grid"></section>

        <footer class="club__footer">
          <button class="club__ghost" type="button" data-action="diag">Diagnostic caméra</button>
          <span class="club__version">v${__APP_VERSION__}</span>
        </footer>
      </div>
    </main>`;

  const grid = root.querySelector<HTMLElement>('.club__grid')!;
  for (const player of players) {
    const st = stats.get(player.id);
    const card = el('article', 'card');
    card.append(el('span', 'card__watermark', player.id));

    const main = el('button', 'card__main');
    main.type = 'button';
    main.setAttribute('aria-label', `Calibrer ${player.id}`);
    main.append(el('span', 'card__id', player.id));
    main.append(el('span', 'card__cat', `${CATEGORY_LABELS[player.category]} · ${player.heightCm} cm`));
    main.append(
      player.guardHeightCm !== undefined
        ? el('span', 'card__tag', 'Étalonnée')
        : el('span', 'card__tag card__tag--todo', 'À étalonner'),
    );
    const stats2 = el('div', 'card__stats');
    stats2.append(
      stat(st?.rtMedian != null ? String(Math.round(st.rtMedian)) : '—', 'TR ms'),
      stat(st?.hitRate != null ? `${Math.round(st.hitRate * 100)}%` : '—', 'Réussite'),
    );
    main.append(stats2);
    main.append(el('span', 'card__cta', 'Calibrer ›'));
    main.addEventListener('click', () => a.onSelectPlayer(player.id));

    const edit = el('button', 'card__edit');
    edit.type = 'button';
    edit.innerHTML = PENCIL;
    edit.setAttribute('aria-label', `Modifier le profil ${player.id}`);
    edit.addEventListener('click', () => a.onEditPlayer(player.id));

    const hist = el('button', 'card__edit card__hist');
    hist.type = 'button';
    hist.innerHTML = CHART;
    hist.setAttribute('aria-label', `Historique de ${player.id}`);
    hist.addEventListener('click', () => a.onHistory(player.id));

    card.append(main, edit, hist);
    grid.append(card);
  }

  if (players.length === 0) {
    const empty = el('div', 'club__empty');
    empty.append(
      el('strong', '', 'Crée le premier profil'),
      el('span', '', 'Un pseudonyme (G1, G2…) et la taille suffisent.'),
    );
    grid.append(empty);
  }
  root.querySelector('[data-action="new"]')!.addEventListener('click', a.onNewPlayer);

  root.querySelector('[data-action="diag"]')!.addEventListener('click', a.onDiagnostic);
}
