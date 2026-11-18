/** Réglages staff (habillage « Club ») : export, import, suppression des données, code staff. */
import { makeBackup, parseBackup, sessionsCsv, trajectoriesCsv, trialsCsv } from '../export/csv';
import { checkCode, isValidCode, setCode, storedHash } from '../settings/staffCode';
import type { Player } from '../players/player';
import { deletePlayerData, exportAll, importAll, listPlayers, type Db } from '../storage/db';

/** Déverrouillé pour la durée d'ouverture de l'app. */
let unlocked = false;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

function shell(root: HTMLElement, onBack: () => void): HTMLElement {
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
              <div class="club__sub">Réglages staff</div>
            </div>
          </div>
          <img class="club__badge" src="${base}brand/logo-tmvh.png" alt="Toulon Métropole Var Handball" />
        </header>
        <div class="club__hero"><h1 class="club__title">Réglages<br /><span>staff</span></h1></div>
        <section class="settings"></section>
        <footer class="club__footer">
          <button class="club__ghost" type="button" data-action="back">← Accueil</button>
          <span class="club__version">v${__APP_VERSION__}</span>
        </footer>
      </div>
    </main>`;
  root.querySelector('[data-action="back"]')!.addEventListener('click', onBack);
  return root.querySelector<HTMLElement>('.settings')!;
}

function panel(title: string, text?: string): HTMLElement {
  const p = el('div', 'settings__panel');
  p.append(el('h2', 'settings__title', title));
  if (text) p.append(el('p', 'settings__text', text));
  return p;
}

function button(label: string, primary = false): HTMLButtonElement {
  const b = el('button', primary ? 'club__new settings__btn' : 'club__ghost settings__btn', label);
  b.type = 'button';
  return b;
}

function codeInput(placeholder: string): HTMLInputElement {
  const i = el('input', 'settings__code');
  i.type = 'password';
  i.inputMode = 'numeric';
  i.maxLength = 4;
  i.autocomplete = 'off';
  i.placeholder = placeholder;
  return i;
}

/** Fichier d'export à partager / télécharger. */
function file(name: string, text: string, type: string): File {
  return new File([text], name, { type });
}

async function deliver(files: File[], status: HTMLElement): Promise<void> {
  const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
  if (nav.canShare?.({ files }) && navigator.share) {
    try {
      await navigator.share({ files, title: 'Export Rempart' });
      status.textContent = 'Fichiers partagés.';
      return;
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        status.textContent = 'Partage annulé.';
        return;
      }
    }
  }
  // Repli : un téléchargement par fichier.
  for (const f of files) {
    const url = URL.createObjectURL(f);
    const a = document.createElement('a');
    a.href = url;
    a.download = f.name;
    document.body.append(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
  status.textContent = `${files.length} fichiers téléchargés.`;
}

export function renderSettings(root: HTMLElement, db: Db, onBack: () => void): void {
  const box = shell(root, onBack);
  if (unlocked) return void renderUnlocked(box, db, root, onBack);

  const hasCode = storedHash() !== null;
  const p = panel(
    hasCode ? 'Code staff' : 'Créer le code staff',
    hasCode ? 'Saisis le code à 4 chiffres.' : 'Choisis un code à 4 chiffres : il protégera l’export et la suppression des données.',
  );
  const a = codeInput('Code');
  const b = codeInput('Confirmer');
  const msg = el('p', 'settings__msg');
  const go = button(hasCode ? 'Déverrouiller' : 'Créer le code', true);
  p.append(a);
  if (!hasCode) p.append(b);
  p.append(go, msg);
  box.append(p);
  a.focus();
  go.addEventListener('click', async () => {
    if (!isValidCode(a.value)) return void (msg.textContent = 'Le code doit comporter 4 chiffres.');
    if (!hasCode) {
      if (a.value !== b.value) return void (msg.textContent = 'Les deux codes sont différents.');
      await setCode(a.value);
    } else if (!(await checkCode(a.value))) {
      a.value = '';
      return void (msg.textContent = 'Code incorrect.');
    }
    unlocked = true;
    renderSettings(root, db, onBack);
  });
}

async function renderUnlocked(box: HTMLElement, db: Db, root: HTMLElement, onBack: () => void): Promise<void> {
  // ---- Export ----
  const exp = panel(
    'Exporter les données',
    'essais.csv (un essai par ligne), seances.csv (résumés), trajectoires.csv et sauvegarde.json. ' +
      'Format : virgule, point décimal, UTF-8 (R, Python ; Excel via Données → À partir d’un fichier texte).',
  );
  const expBtn = button('Exporter', true);
  const expMsg = el('p', 'settings__msg');
  exp.append(expBtn, expMsg);
  expBtn.addEventListener('click', async () => {
    expMsg.textContent = 'Préparation…';
    const d = await exportAll(db);
    const stamp = new Date().toISOString().slice(0, 10);
    const files = [
      file(`rempart_essais_${stamp}.csv`, trialsCsv(d), 'text/csv'),
      file(`rempart_seances_${stamp}.csv`, sessionsCsv(d), 'text/csv'),
      file(`rempart_trajectoires_${stamp}.csv`, trajectoriesCsv(d), 'text/csv'),
      file(`rempart_sauvegarde_${stamp}.json`, JSON.stringify(makeBackup(d, __APP_VERSION__, new Date())), 'application/json'),
    ];
    await deliver(files, expMsg);
  });

  // ---- Import ----
  const imp = panel('Importer une sauvegarde', 'Ajoute les données d’un fichier sauvegarde.json, sans rien écraser.');
  const input = el('input', 'settings__file');
  input.type = 'file';
  input.accept = '.json,application/json';
  const impMsg = el('p', 'settings__msg');
  imp.append(input, impMsg);
  input.addEventListener('change', async () => {
    const f = input.files?.[0];
    if (!f) return;
    try {
      const b = parseBackup(await f.text());
      const c = await importAll(db, b);
      impMsg.textContent =
        `Importé : ${c.players} profil(s), ${c.calibrations} calibration(s), ${c.sessions} séance(s), ${c.trials} essai(s)` +
        (c.skipped ? ` · ${c.skipped} élément(s) déjà présent(s), ignoré(s).` : '.');
      void renderPlayers();
    } catch (err) {
      impMsg.textContent = err instanceof Error ? err.message : String(err);
    }
    input.value = '';
  });

  // ---- Suppression ----
  const del = panel('Supprimer les données d’une gardienne', 'Profil, calibrations, séances et essais. Irréversible : exporte d’abord si besoin.');
  const list = el('div', 'settings__players');
  del.append(list);
  const renderPlayers = async (): Promise<void> => {
    const players: Player[] = await listPlayers(db);
    list.replaceChildren(
      ...(players.length
        ? players.map((p) => {
            const row = el('div', 'settings__player');
            row.append(el('span', 'settings__pid', p.id));
            const b = button('Supprimer');
            b.addEventListener('click', async () => {
              const typed = window.prompt(`Supprimer définitivement toutes les données de ${p.id} ? Tape ${p.id} pour confirmer.`);
              if (typed?.trim().toUpperCase() !== p.id) return;
              await deletePlayerData(db, p.id);
              void renderPlayers();
            });
            row.append(b);
            return row;
          })
        : [el('p', 'settings__text', 'Aucun profil.')]),
    );
  };
  void renderPlayers();

  // ---- Code ----
  const code = panel('Changer le code staff');
  const c1 = codeInput('Nouveau code');
  const c2 = codeInput('Confirmer');
  const codeBtn = button('Enregistrer le code');
  const codeMsg = el('p', 'settings__msg');
  code.append(c1, c2, codeBtn, codeMsg);
  codeBtn.addEventListener('click', async () => {
    if (!isValidCode(c1.value)) return void (codeMsg.textContent = 'Le code doit comporter 4 chiffres.');
    if (c1.value !== c2.value) return void (codeMsg.textContent = 'Les deux codes sont différents.');
    await setCode(c1.value);
    c1.value = c2.value = '';
    codeMsg.textContent = 'Code modifié.';
  });

  const lock = button('Verrouiller');
  lock.addEventListener('click', () => {
    unlocked = false;
    renderSettings(root, db, onBack);
  });
  code.append(lock);

  box.append(exp, imp, del, code);
}
