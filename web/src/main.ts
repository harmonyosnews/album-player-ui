import './styles.css';
import { startRouter } from './router';
import { store, type AppState } from './store';
import { renderLayout, updateLayout } from './ui/layout';
import { renderView } from './views';

const app = document.getElementById('app');
if (!app) throw new Error('#app not found');
const refs = renderLayout(app);
let lastKey = '';

function viewKey(s: AppState): string {
  const parts: Array<string | number> = [
    s.route.name,
    s.route.album ?? '',
    s.route.artist ?? '',
    s.libraryRev,
    s.configRev,
    s.songsRev,
    s.search,
    s.radioMode ? 1 : 0,
    s.radioCategory ?? '',
    s.playlists ? s.playlists.Drives.length : -1,
    s.albums?.Albums.length ?? -1,
    s.albums?.AlbumList.length ?? -1,
    s.ready ? 1 : 0,
  ];
  if (s.route.name !== 'settings') {
    parts.push(s.player?.Playing ? 1 : 0, s.player?.Paused ? 1 : 0, s.player?.Album ?? -1, s.player?.Song ?? -1);
  }
  if (s.route.name === 'home' || s.route.name === 'radio') {
    parts.push(s.radioTitle, s.radioPics.length);
  }
  if (s.route.name === 'about') parts.push(s.online ? 1 : 0);
  if (s.route.name === 'settings') parts.push(s.busy ? 1 : 0);
  return parts.join('|');
}

store.subscribe((s) => {
  updateLayout(refs, s);
  const key = viewKey(s);
  if (key !== lastKey) {
    lastKey = key;
    renderView(refs, s);
  }
});

startRouter();
void store.init();
