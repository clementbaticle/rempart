/** État de l'alimentation (Battery Status API : Chrome oui, Safari non). */
export interface PowerState {
  charging: boolean;
  level: number;
}

interface BatteryManagerLike extends EventTarget {
  charging: boolean;
  level: number;
}

/** Suit l'alimentation ; `onChange(null)` si l'information n'est pas disponible. */
export async function watchPower(onChange: (s: PowerState | null) => void): Promise<void> {
  const nav = navigator as Navigator & { getBattery?: () => Promise<BatteryManagerLike> };
  if (!nav.getBattery) {
    onChange(null);
    return;
  }
  try {
    const battery = await nav.getBattery();
    const emit = (): void => onChange({ charging: battery.charging, level: battery.level });
    battery.addEventListener('chargingchange', emit);
    battery.addEventListener('levelchange', emit);
    emit();
  } catch {
    onChange(null);
  }
}
