/** Choix du mode de temps avant la série (habillage « Club »). */
import { CONFIG } from '../config';
import { GAME_LABELS, responseLimitMs, type ModeChoice } from '../trial/modes';
import type { Game } from '../core/sequence';
import type { Player } from '../players/player';

const seconds = (ms: number): string => (ms / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 });

export function renderModes(
  root: HTMLElement,
  player: Player,
  onChoose: (c: ModeChoice) => void,
  onBack: () => void,
): void {
  const P = CONFIG.modes;
  const base = import.meta.env.BASE_URL;
  let level = 1;
  let game: Game = 'classique';

  root.innerHTML = `
    <main class="club">
      <div class="club__band" aria-hidden="true"></div>
      <div class="club__inner">
        <header class="club__top">
          <div class="club__brand">
            <img class="club__mark" src="${base}brand/rempart-dots.svg" alt="" />
            <div>
              <div class="club__name">Rempart</div>
              <div class="club__sub"></div>
            </div>
          </div>
          <img class="club__badge" src="${base}brand/logo-tmvh.png" alt="Toulon Métropole Var Handball" />
        </header>

        <div class="club__hero">
          <h1 class="club__title">Choisis ton<br /><span>mode</span></h1>
          <div class="games" role="radiogroup" aria-label="Jeu (Découverte et Entraînement)"></div>
        </div>

        <section class="modes">
          <button class="mode" type="button" data-mode="decouverte">
            <span class="mode__kicker">Apprendre</span>
            <span class="mode__name">Découverte</span>
            <span class="mode__desc">Pas de limite de temps : atteins chaque cible, à ton rythme.</span>
            <span class="mode__time">∞</span>
          </button>
          <button class="mode mode--test" type="button" data-mode="test">
            <span class="mode__kicker">Mesurer</span>
            <span class="mode__name">Test</span>
            <span class="mode__desc">Batterie figée : Classique puis Go / no-go (48 essais, ≈ 3 min). Seul mode utilisé pour l’étude.</span>
            <span class="mode__time">${seconds(P.testResponseMs)} s</span>
          </button>
          <div class="mode mode--train">
            <span class="mode__kicker">Progresser</span>
            <span class="mode__name">Entraînement</span>
            <div class="mode__levels" role="radiogroup" aria-label="Niveau"></div>
            <span class="mode__time" data-train-time></span>
            <button class="mode__go" type="button" data-mode="entrainement">Lancer ›</button>
          </div>
        </section>

        <footer class="club__footer">
          <button class="club__ghost" type="button" data-action="back">← Accueil</button>
          <span class="club__version">Calibration enregistrée</span>
        </footer>
      </div>
    </main>`;

  root.querySelector('.club__sub')!.textContent = `${player.id} · prête à jouer`;
  const levels = root.querySelector<HTMLElement>('.mode__levels')!;
  const time = root.querySelector<HTMLElement>('[data-train-time]')!;
  const renderLevels = (): void => {
    levels.replaceChildren(
      ...P.trainingLevelsMs.map((_, i) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = `mode__level${i + 1 === level ? ' is-on' : ''}`;
        b.textContent = String(i + 1);
        b.setAttribute('role', 'radio');
        b.setAttribute('aria-checked', String(i + 1 === level));
        b.setAttribute('aria-label', `Niveau ${i + 1}`);
        b.addEventListener('click', () => {
          level = i + 1;
          renderLevels();
        });
        return b;
      }),
    );
    time.textContent = `${seconds(responseLimitMs({ mode: 'entrainement', level, game }, P))} s`;
  };
  renderLevels();

  const games = root.querySelector<HTMLElement>('.games')!;
  const renderGames = (): void => {
    games.replaceChildren(
      ...(Object.keys(GAME_LABELS) as Game[]).map((g) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = `games__item${g === game ? ' is-on' : ''}`;
        b.textContent = GAME_LABELS[g];
        b.setAttribute('role', 'radio');
        b.setAttribute('aria-checked', String(g === game));
        b.addEventListener('click', () => {
          game = g;
          renderGames();
        });
        return b;
      }),
    );
  };
  renderGames();

  root.querySelector('[data-mode="decouverte"]')!.addEventListener('click', () => onChoose({ mode: 'decouverte', level: null, game }));
  root.querySelector('[data-mode="test"]')!.addEventListener('click', () => onChoose({ mode: 'test', level: null, game: 'classique' }));
  root.querySelector('[data-mode="entrainement"]')!.addEventListener('click', () => onChoose({ mode: 'entrainement', level, game }));
  root.querySelector('[data-action="back"]')!.addEventListener('click', onBack);
}
