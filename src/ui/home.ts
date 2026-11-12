/** Écran d'accueil (habillage TMVH). */
export function renderHome(root: HTMLElement, onStart: () => void): void {
  const logo = `${import.meta.env.BASE_URL}brand/logo-tmvh.png`;
  root.innerHTML = `
    <main class="home">
      <img class="home__logo" src="${logo}" alt="Logo du Toulon Métropole Var Handball" />
      <h1 class="home__title">Rempart</h1>
      <p class="home__subtitle">Entraînement perceptivo-cognitif des gardiennes</p>
      <button class="btn btn--primary" type="button">Démarrer la caméra</button>
      <p class="home__hint">Étape 1 — socle : caméra, squelette et diagnostic.</p>
    </main>`;
  root.querySelector('button')!.addEventListener('click', onStart, { once: true });
}
