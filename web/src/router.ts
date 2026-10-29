import type { Route, RouteName } from './store';
import { store } from './store';

import { setSettingsTab } from './views/settings';

const KNOWN: RouteName[] = ['home', 'albums', 'album', 'artists', 'artist', 'radio', 'playlists', 'browse', 'settings'];

export function parseHash(): Route {
  const raw = location.hash.replace(/^#\/?/, '').replace(/\/+$/, '');
  if (!raw) return { name: 'home' };
  const parts = raw.split('/');
  const rawName = parts[0];
  if (rawName === 'about') {
    setSettingsTab('about');
    return { name: 'settings' };
  }
  if (!KNOWN.includes(rawName as RouteName)) return { name: 'home' };
  const name = rawName as RouteName;
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
  const apply = () => {
    const route = parseHash();
    if (/^#\/about\/?$/.test(location.hash)) history.replaceState(null, '', '#/settings');
    store.setRoute(route);
  };
  window.addEventListener('hashchange', apply);
  apply();
}
