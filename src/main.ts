import './styles.css';
import { registerSW } from 'virtual:pwa-register';
import { applyTheme } from './theme';
import { renderHome } from './ui/home';
import { renderLiveView } from './ui/liveView';

applyTheme();
registerSW({ immediate: true });

const root = document.getElementById('app')!;
renderHome(root, () => {
  void renderLiveView(root);
});
