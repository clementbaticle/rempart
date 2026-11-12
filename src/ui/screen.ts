/** Plein écran et maintien de l'écran allumé (si le navigateur le permet). */

type FullscreenTarget = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };

export async function requestFullscreen(): Promise<void> {
  const el = document.documentElement as FullscreenTarget;
  try {
    if (document.fullscreenElement) return;
    if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: 'hide' });
    else await el.webkitRequestFullscreen?.();
  } catch {
    /* Non pris en charge (ex. Safari iPad hors app installée) : sans effet. */
  }
}

let wakeLock: WakeLockSentinel | null = null;

export async function keepScreenAwake(): Promise<void> {
  if (!('wakeLock' in navigator)) return;
  const acquire = async (): Promise<void> => {
    try {
      wakeLock = await navigator.wakeLock.request('screen');
    } catch {
      wakeLock = null;
    }
  };
  await acquire();
  // Le verrou est libéré quand l'app passe en arrière-plan : le reprendre au retour.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && (wakeLock === null || wakeLock.released)) {
      void acquire();
    }
  });
}
