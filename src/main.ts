import '@fontsource/space-grotesk/latin-400.css';
import '@fontsource/space-grotesk/latin-500.css';
import '@fontsource/space-grotesk/latin-700.css';
import './styles.css';
import './brand.css';
import { registerSW } from 'virtual:pwa-register';
import { applyTheme } from './theme';
import { renderHome, type PlayerStats } from './ui/home';
import { renderLiveView } from './ui/liveView';
import { renderPlayerForm } from './ui/playerForm';
import { renderCalibration } from './ui/calibrationView';
import { renderTrials } from './ui/trialView';
import { renderModes } from './ui/modeView';
import type { Player } from './players/player';
import type { CalibrationRecord } from './storage/calibrationRecord';
import type { SessionRecord, TrialRow } from './storage/sessionRecord';
import { referenceRt, renderResults } from './ui/resultsView';
import { renderHistory } from './ui/historyView';
import {
  addPlayer, getPlayer, latestCalibration, listPlayers, openDb, saveCalibration, saveSession, updatePlayer, listSessions, type Db,
} from './storage/db';

applyTheme();
registerSW({ immediate: true });

const root = document.getElementById('app')!;
/** Libère l'écran courant (caméra notamment) avant d'en afficher un autre. */
let leave: (() => void) | null = null;

function go(next: () => void | (() => void)): void {
  leave?.();
  leave = null;
  const cleanup = next();
  if (cleanup) leave = cleanup;
}

async function showHome(db: Db): Promise<void> {
  const players = await listPlayers(db);
  const stats = new Map<string, PlayerStats>();
  for (const p of players) {
    const c = await latestCalibration(db, p.id);
    const s = (await listSessions(db, p.id)).find((x) => x.summary?.trials > 0);
    stats.set(p.id, {
      lastCalibration: c?.date ?? null,
      rtMedian: s ? referenceRt(s) : null,
      hitRate: s ? (s.byGame?.classique ?? s.summary).hitRate : null,
    });
  }
  go(() =>
    renderHome(root, players, stats, {
      onSelectPlayer: (id) => void showCalibration(db, id),
      onNewPlayer: () => go(() =>
        renderPlayerForm(root, {
          existingIds: players.map((p) => p.id),
          onSubmit: async (input) => {
            await addPlayer(db, { ...input, active: true, createdAt: new Date().toISOString() });
            await showHome(db);
          },
          onCancel: () => void showHome(db),
        }),
      ),
      onEditPlayer: (id) => {
        const initial = players.find((p) => p.id === id);
        if (!initial) return;
        go(() =>
          renderPlayerForm(root, {
            existingIds: players.map((p) => p.id),
            initial,
            onSubmit: async (input) => {
              await updatePlayer(db, initial.id, { ...initial, ...input });
              await showHome(db);
            },
            onCancel: () => void showHome(db),
          }),
        );
      },
      onDiagnostic: () => go(() => renderLiveView(root, () => void showHome(db))),
      onHistory: async (id) => {
        const p = await getPlayer(db, id);
        if (p) await showHistory(db, p, () => void showHome(db));
      },
    }),
  );
}

async function showCalibration(db: Db, playerId: string): Promise<void> {
  const player = await getPlayer(db, playerId);
  if (!player) return showHome(db);
  const previous = await latestCalibration(db, playerId);
  go(() =>
    renderCalibration(root, player, {
      previous,
      save: (record) => saveCalibration(db, record),
      saveReference: async (guardHeightCm) => {
        const current = (await getPlayer(db, playerId)) ?? player;
        const updated = { ...current, guardHeightCm, guardHeightDate: new Date().toISOString() };
        await updatePlayer(db, current.id, updated);
        return updated;
      },
      onExit: () => void showHome(db),
      onStart: (record) => showModes(db, player, record),
    }),
  );
}

/** Choix du mode ; après chaque série, on y revient avec la même calibration. */
/** Résultats d'une série, comparés à la séance comparable précédente (même mode, même jeu). */
async function showResults(
  db: Db,
  player: Player,
  record: CalibrationRecord,
  session: SessionRecord,
  trials: TrialRow[],
  saved: boolean,
): Promise<void> {
  const previous = (await listSessions(db, player.id)).find(
    (s) => s.id !== session.id && s.status === 'completed' && s.mode === session.mode && s.game === session.game,
  );
  const again = (): void => showModes(db, player, record);
  go(() =>
    renderResults(root, player, session, trials, previous, saved, {
      onAgain: again,
      onHistory: () => void showHistory(db, player, () => void showResults(db, player, record, session, trials, saved)),
      onHome: () => void showHome(db),
    }),
  );
}

async function showHistory(db: Db, player: Player, onBack: () => void): Promise<void> {
  const sessions = await listSessions(db, player.id);
  go(() => renderHistory(root, player, sessions, onBack));
}

function showModes(db: Db, player: Player, record: CalibrationRecord): void {
  go(() =>
    renderModes(
      root,
      player,
      (choice) =>
        go(() =>
          renderTrials(root, player, record, choice, {
            save: (session, trials) => saveSession(db, session, trials),
            onExit: () => void showHome(db),
            onDone: (session, trials, saved) => void showResults(db, player, record, session, trials, saved),
          }),
        ),
      () => void showHome(db),
    ),
  );
}

openDb()
  .then(showHome)
  .catch((err: unknown) => {
    root.textContent = `Stockage local indisponible : ${String(err)}`;
  });
