/** Historique d'une gardienne (habillage « Club ») : évolution du TR en Test, liste des séances. */
import type { Player } from '../players/player';
import type { SessionRecord } from '../storage/sessionRecord';
import { referenceRt } from './resultsView';
import { sessionLabel } from './sessionLabel';

const fmtDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

/** Courbe SVG du TR médian des séances Test (plus bas = plus rapide). */
function chart(points: { date: string; rt: number }[]): SVGSVGElement {
  const W = 640;
  const H = 200;
  const P = { l: 48, r: 16, t: 16, b: 30 };
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('class', 'history__chart');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Évolution du TR médian en Test');
  const rts = points.map((p) => p.rt);
  const lo = Math.floor((Math.min(...rts) - 20) / 50) * 50;
  const hi = Math.ceil((Math.max(...rts) + 20) / 50) * 50;
  const x = (i: number): number => P.l + (points.length === 1 ? (W - P.l - P.r) / 2 : (i / (points.length - 1)) * (W - P.l - P.r));
  const y = (v: number): number => P.t + ((v - lo) / Math.max(hi - lo, 1)) * (H - P.t - P.b);
  const add = (tag: string, attrs: Record<string, string>, text?: string): void => {
    const e = document.createElementNS(ns, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    if (text) e.textContent = text;
    svg.append(e);
  };
  for (const v of [lo, (lo + hi) / 2, hi]) {
    add('line', { x1: String(P.l), x2: String(W - P.r), y1: String(y(v)), y2: String(y(v)), class: 'history__grid' });
    add('text', { x: String(P.l - 8), y: String(y(v) + 4), 'text-anchor': 'end', class: 'history__axis' }, String(Math.round(v)));
  }
  add('polyline', { points: points.map((p, i) => `${x(i)},${y(p.rt)}`).join(' '), class: 'history__line' });
  points.forEach((p, i) => {
    add('circle', { cx: String(x(i)), cy: String(y(p.rt)), r: '5', class: 'history__dot' });
    add('text', { x: String(x(i)), y: String(H - 8), 'text-anchor': 'middle', class: 'history__axis' }, fmtDate(p.date));
  });
  return svg;
}

export function renderHistory(
  root: HTMLElement,
  player: Player,
  sessions: readonly SessionRecord[],
  onBack: () => void,
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
              <div class="club__sub"></div>
            </div>
          </div>
          <img class="club__badge" src="${base}brand/logo-tmvh.png" alt="Toulon Métropole Var Handball" />
        </header>
        <div class="club__hero"><h1 class="club__title">Historique<br /><span></span></h1></div>
        <section class="history">
          <div class="history__panel">
            <div class="history__title">TR médian en Test (Classique) · plus bas = plus rapide</div>
            <div class="history__chart-box"></div>
          </div>
          <div class="history__panel history__list"></div>
        </section>
        <footer class="club__footer">
          <button class="club__ghost" type="button" data-action="back">← Retour</button>
          <span class="club__version"></span>
        </footer>
      </div>
    </main>`;
  const $ = <E extends HTMLElement>(q: string): E => root.querySelector<E>(q)!;
  $('.club__sub').textContent = `${player.id} · Historique`;
  $('.club__title span').textContent = player.id;
  $('.club__version').textContent = `${sessions.length} séance${sessions.length > 1 ? 's' : ''}`;

  const tests = sessions
    .filter((s) => s.mode === 'test' && s.status === 'completed' && referenceRt(s) !== null)
    .map((s) => ({ date: s.date, rt: referenceRt(s)! }))
    .sort((a, b) => a.date.localeCompare(b.date));
  const box = $('.history__chart-box');
  if (tests.length) box.append(chart(tests));
  else box.append(el('p', 'history__empty', 'Aucune batterie Test terminée pour l’instant.'));

  const list = $('.history__list');
  if (!sessions.length) list.append(el('p', 'history__empty', 'Aucune séance enregistrée.'));
  for (const s of sessions) {
    const row = el('div', 'history__row');
    row.append(el('span', 'history__date', new Date(s.date).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })));
    row.append(el('span', 'history__label', sessionLabel(s) + (s.status === 'interrupted' ? ' · interrompue' : '')));
    const rt = referenceRt(s);
    row.append(el('span', 'history__num', rt == null ? '—' : `${Math.round(rt)} ms`));
    row.append(el('span', 'history__num', `${Math.round((s.summary?.hitRate ?? 0) * 100)} %`));
    const cr = s.byGame?.gonogo?.commissionRate ?? s.summary?.commissionRate;
    row.append(el('span', 'history__num', cr == null ? '' : `${Math.round(cr * 100)} % comm.`));
    list.append(row);
  }
  $('[data-action="back"]').addEventListener('click', onBack);
}
