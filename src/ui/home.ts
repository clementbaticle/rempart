/** Écran d'accueil (habillage TMVH) : choix de la joueuse. */
import { CATEGORY_LABELS, type Player } from '../players/player';

export interface HomeActions {
  onSelectPlayer: (id: string) => void;
  onNewPlayer: () => void;
  onEditPlayer: (id: string) => void;
  onDiagnostic: () => void;
}

export function renderHome(root: HTMLElement, players: readonly Player[], a: HomeActions): void {
  const logo = `${import.meta.env.BASE_URL}brand/logo-tmvh.png`;
  root.innerHTML = `
    <main class="home">
      <header class="home__header">
        <img class="home__logo" src="${logo}" alt="Logo du Toulon Métropole Var Handball" />
        <div>
          <h1 class="home__title">Rempart</h1>
          <p class="home__subtitle">Entraînement perceptivo-cognitif des gardiennes</p>
        </div>
      </header>
      <section class="home__players">
        <h2 class="home__section-title">Choisir une joueuse</h2>
        <div class="home__list"></div>
        <button class="btn btn--primary" type="button" data-action="new">+ Nouveau profil</button>
      </section>
      <footer class="home__footer">
        <button class="btn btn--ghost" type="button" data-action="diag">Diagnostic caméra</button>
        <span class="home__version">v${__APP_VERSION__}</span>
      </footer>
    </main>`;

  const list = root.querySelector<HTMLElement>('.home__list')!;
  if (players.length === 0) {
    const p = document.createElement('p');
    p.className = 'home__empty';
    p.textContent = 'Aucun profil pour l’instant.';
    list.append(p);
  }
  for (const player of players) {
    const card = document.createElement('div');
    card.className = 'player-card';
    const main = document.createElement('button');
    main.type = 'button';
    main.className = 'player-card__main';
    main.setAttribute('aria-label', `Calibrer ${player.id}`);
    const id = document.createElement('span');
    id.className = 'player-card__id';
    id.textContent = player.id;
    const info = document.createElement('span');
    info.className = 'player-card__info';
    info.textContent = `${CATEGORY_LABELS[player.category]} · ${player.heightCm} cm`;
    main.append(id, info);
    main.addEventListener('click', () => a.onSelectPlayer(player.id));
    const edit = document.createElement('button');
    edit.type = 'button';
    edit.className = 'player-card__edit';
    edit.textContent = 'Modifier';
    edit.setAttribute('aria-label', `Modifier le profil ${player.id}`);
    edit.addEventListener('click', () => a.onEditPlayer(player.id));
    card.append(main, edit);
    list.append(card);
  }
  root.querySelector('[data-action="new"]')!.addEventListener('click', a.onNewPlayer);
  root.querySelector('[data-action="diag"]')!.addEventListener('click', a.onDiagnostic);
}
