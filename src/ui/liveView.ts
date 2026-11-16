import { CameraStage } from './cameraStage';

/** Écran « Diagnostic caméra » : vidéo en miroir, squelette, panneau de diagnostic. */
export function renderLiveView(root: HTMLElement, onBack: () => void): () => void {
  const stage = new CameraStage({ diagnosticVisible: true });
  root.replaceChildren(stage.element);
  const back = document.createElement('button');
  back.className = 'live__back';
  back.type = 'button';
  back.textContent = '← Accueil';
  back.addEventListener('click', onBack);
  stage.element.append(back);
  void stage.start();
  return () => stage.stop();
}
