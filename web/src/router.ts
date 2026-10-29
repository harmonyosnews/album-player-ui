import type { Route, RouteName } from './store';
import { store } from './store';

const KNOWN: RouteName[] = ['home', 'albums', 'album', 'artists', 'artist', 'radio', 'playlists', 'browse', 'settings', 'about'];

export function parseHash(): Route {
  const raw = location.hash.replace(/^#\/?/, '').replace(/\/+$/, '');
  if (!raw) return { name: 'home' };
  const parts = raw.split('/');
  const name = parts[0] as RouteName;
  if (!KNOWN.includes(name)) return { name: 'home' };
  if (name === 'album') {
    const n = Number(parts[1]);
    return Number.isFinite(n) ? { name, album: n } : { name: 'albums' };
  }
  if (name === 'artist') {
    try {
      return { name, artist: decodeURIComponent(parts.slice(1).join('/')) };
    } catch {
      return { name, artist: parts.slice(1).join('/') };
    }
  }
  return { name };
}

export function startRouter(): void {
  const apply = () => store.setRoute(parseHash());
  window.addEventListener('hashchange', apply);
  apply();
}
