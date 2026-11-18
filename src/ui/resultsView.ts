/** Résultats d'une série (habillage « Club ») : chiffres clés, comparaison, carte des zones. */
import { CONFIG } from '../config';
import { GRID_COLUMNS, ZONE_COUNT } from '../calibration/grid';
import { zoneStats, type SessionSummary } from '../trial/outcome';
import type { Player } from '../players/player';
import type { SessionRecord, TrialRow } from '../storage/sessionRecord';
import { sessionLabel } from './sessionLabel';

export interface ResultsActions {
  onAgain: () => void;
  onHistory: () => void;
  onHome: () => void;
}

const ms = (v: number | null | undefined): string => (v == null ? '—' : String(Math.round(v)));
const pct = (v: number | null | undefined): string => (v == null ? '—' : `${Math.round(v * 100)}`);

/** Chiffre de référence d'une séance : TR médian du Classique (ou des go, hors batterie). */
export function referenceRt(s: SessionRecord): number | null {
  return s.byGame?.classique?.rtMedian ?? s.summary?.rtMedian ?? null;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

function tile(value: string, unit: string, label: string, accent = false): HTMLElement {
  const t = el('div', `stat${accent ? ' stat--accent' : ''}`);
  const v = el('div', 'stat__value', value);
  if (unit) v.append(el('span', 'stat__unit', unit));
  t.append(v, el('div', 'stat__label', label));
  return t;
}

export function renderResults(
  root: HTMLElement,
  player: Player,
  session: SessionRecord,
  trials: readonly TrialRow[],
  previous: SessionRecord | undefined,
  saved: boolean,
  a: ResultsActions,
): void {
  const base = import.meta.env.BASE_URL;
  const T = CONFIG.trial;
  const s: SessionSummary = session.summary;
  const classique = session.byGame?.classique;
  const gonogo = session.byGame?.gonogo;
  const rt = referenceRt(session);
  const prevRt = previous ? referenceRt(previous) : null;

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
        <div class="results">
          <section class="results__main">
            <div class="results__kicker"></div>
            <div class="results__hero">
              <div class="results__big"></div>
              <div class="results__delta"></div>
            </div>
            <div class="results__stats"></div>
            <ul class="results__warn"></ul>
          </section>
          <section class="results__zones">
            <div class="results__zones-title">Carte des zones · TR médian (ms)</div>
            <div class="zones"></div>
            <div class="results__zones-hint">Plus la case est jaune, plus la réaction est rapide.</div>
          </section>
        </div>
        <footer class="club__footer">
          <div class="results__actions">
            <button class="club__ghost" type="button" data-action="home">Accueil</button>
            <button class="club__ghost" type="button" data-action="history">Historique</button>
          </div>
          <button class="club__new" type="button" data-action="again">Autre exercice ›</button>
        </footer>
      </div>
    </main>`;

  const $ = <E extends HTMLElement>(q: string): E => root.querySelector<E>(q)!;
  $('.club__sub').textContent = `${player.id} · Résultats`;
  $('.results__kicker').textContent =
    `${sessionLabel(session)} · ${new Date(session.date).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` +
    (session.status === 'interrupted' ? ' · série interrompue' : '');

  // Chiffre héros : TR médian.
  const big = $('.results__big');
  big.append(el('span', 'results__big-value', ms(rt)), el('span', 'results__big-unit', 'ms'));
  big.append(el('span', 'results__big-label', classique && gonogo ? 'TR médian · Classique' : 'TR médian'));
  if (rt != null && prevRt != null) {
    const d = Math.round(rt - prevRt);
    const better = d < 0;
    const delta = $('.results__delta');
    delta.className = `results__delta ${better ? 'is-better' : 'is-worse'}`;
    delta.textContent = `${d > 0 ? '+' : d < 0 ? '−' : '±'}${Math.abs(d)} ms`;
    delta.title = `Par rapport à la séance comparable précédente (${new Date(previous!.date).toLocaleDateString('fr-FR')})`;
    delta.append(el('small', '', 'vs séance précédente'));
  }

  const stats = $('.results__stats');
  const go = classique ?? s;
  stats.append(tile(pct(go.hitRate), '%', 'Réussite', true));
  if (gonogo || s.noGoTrials > 0) {
    const g = gonogo ?? s;
    stats.append(tile(pct(g.commissionRate), '%', `Commissions (${g.commissions}/${g.noGoTrials})`));
  }
  if (gonogo) {
    stats.append(tile(ms(gonogo.rtMedianDirect), 'ms', 'TR · vert direct'));
    stats.append(tile(ms(gonogo.rtMedianCued), 'ms', 'TR · blanc → vert'));
  }
  stats.append(tile(ms(go.mtMedian), 'ms', 'Mouvement'));
  stats.append(tile(String(s.falseStarts), '', 'Faux départs'));
  stats.append(tile(session.meanDetectionFps == null ? '—' : session.meanDetectionFps.toFixed(0), 'i/s', 'Détection'));

  const warn = $('.results__warn');
  const warnings: string[] = [];
  if (session.lowQuality) warnings.push(`Qualité insuffisante (moins de ${CONFIG.quality.minFps} i/s) : résultats peu fiables.`);
  if (!saved) warnings.push('Échec de l’enregistrement de la séance.');
  if (s.rtExcluded) warnings.push(`${s.rtExcluded} TR hors ${T.validRtMinMs}-${T.validRtMaxMs} ms exclus du calcul.`);
  warnings.forEach((w) => warn.append(el('li', '', w)));

  // Carte des zones : intensité selon le TR (le plus rapide = jaune plein).
  const zs = zoneStats(trials, ZONE_COUNT, { minMs: T.validRtMinMs, maxMs: T.validRtMaxMs });
  const values = zs.map((z) => z.rtMedian).filter((v): v is number => v !== null);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const grid = $('.zones');
  grid.style.gridTemplateColumns = `repeat(${GRID_COLUMNS}, 1fr)`;
  for (const z of zs) {
    const cell = el('div', 'zones__cell');
    if (z.rtMedian !== null) {
      const k = hi > lo ? 1 - (z.rtMedian - lo) / (hi - lo) : 1;
      cell.style.setProperty('--k', k.toFixed(2));
      cell.classList.add('has-value');
    }
    cell.append(el('span', 'zones__id', String(z.zone)), el('span', 'zones__rt', ms(z.rtMedian)));
    cell.append(el('span', 'zones__n', z.goTrials ? `${z.hits}/${z.goTrials}` : ''));
    grid.append(cell);
  }

  $('[data-action="again"]').addEventListener('click', a.onAgain);
  $('[data-action="history"]').addEventListener('click', a.onHistory);
  $('[data-action="home"]').addEventListener('click', a.onHome);
}
