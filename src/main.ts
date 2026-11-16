import './styles.css';
import { registerSW } from 'virtual:pwa-register';
import { applyTheme } from './theme';
import { renderHome } from './ui/home';
import { renderLiveView } from './ui/liveView';
import { renderPlayerForm } from './ui/playerForm';
import { renderCalibration } from './ui/calibrationView';
import {
  addPlayer, getPlayer, latestCalibration, listPlayers, openDb, saveCalibration, type Db,
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
  go(() =>
    renderHome(root, players, {
      onSelectPlayer: (id) => void showCalibration(db, id),
      onNewPlayer: () => go(() =>
        renderPlayerForm(
          root,
          players.map((p) => p.id),
          async (input) => {
            await addPlayer(db, { ...input, active: true, createdAt: new Date().toISOString() });
            await showHome(db);
          },
          () => void showHome(db),
        ),
      ),
      onDiagnostic: () => go(() => renderLiveView(root, () => void showHome(db))),
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
      onExit: () => void showHome(db),
    }),
  );
}

openDb()
  .then(showHome)
  .catch((err: unknown) => {
    root.textContent = `Stockage local indisponible : ${String(err)}`;
  });
