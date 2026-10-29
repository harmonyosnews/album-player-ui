import { imageUrl } from '../api/client';
import { cleanDisplayName, stripAlbumSuffix } from '../api/sanitize';
import type { AlbumVM } from '../api/types';
import type { AppState } from '../store';
import { el, svgIcon } from '../ui/dom';

export function navigate(name: string, param?: string | number): void {
  location.hash = `#/${name}${param == null ? '' : `/${encodeURIComponent(String(param))}`}`;
}

export function albumList(s: AppState): AlbumVM[] {
  const a = s.albums;
  if (!a) return [];
  const n = Math.max(a.AlbumList?.length || 0, a.Albums?.length || 0);
  const out: AlbumVM[] = [];
  for (let i = 0; i < n; i++) {
    const rawName = a.AlbumList?.[i] || a.Albums?.[i] || `专辑 ${i + 1}`;
    const name = cleanDisplayName(rawName) || stripAlbumSuffix(cleanDisplayName(a.Albums?.[i] || '')) || `专辑 ${i + 1}`;
    out.push({
      index: i,
      name,
      artist: cleanDisplayName(a.AuthorList?.[i] || ''),
      year: cleanDisplayName(a.YearList?.[i] || ''),
      display: cleanDisplayName(a.Albums?.[i] || ''),
      cover: imageUrl(i),
      tracks: a.Songs?.[i]?.Songs?.map((x) => cleanDisplayName(x)),
      lengths: a.Songs?.[i]?.SongsLen,
    });
  }
  return out;
}

export function albumAt(s: AppState, index: number): AlbumVM | null {
  const list = albumList(s);
  return list[index] || null;
}

export function coverImage(url: string, className: string, iconSize = 40): HTMLElement {
  const fallback = el('div', { class: 'cover-fallback' }, [svgIcon('music', iconSize)]);
  fallback.hidden = true;
  const img = el('img', {
    class: 'cover-img',
    alt: '',
    loading: 'lazy',
    onerror: () => {
      img.hidden = true;
      fallback.hidden = false;
    },
  });
  if (url) img.src = url;
  else {
    img.hidden = true;
    fallback.hidden = false;
  }
  return el('div', { class: className }, [fallback, img]);
}

export function pageHeader(title: string, subtitle = '', actions: HTMLElement[] = []): HTMLElement {
  return el('div', { class: 'page-header' }, [
    el('div', {}, [
      el('h1', { text: title }),
      subtitle ? el('p', { class: 'subtitle', text: subtitle }) : '',
    ]),
    el('div', { class: 'page-actions' }, actions),
  ]);
}

export function backButton(label: string, target: string): HTMLButtonElement {
  return el('button', {
    class: 'btn-text back-btn',
    type: 'button',
    onclick: () => { location.hash = target; },
  }, [svgIcon('chevronRight', 16), el('span', { text: label })]);
}

export function isCurrent(s: AppState, album: number, song?: number): boolean {
  const p = s.player;
  if (!p) return false;
  return p.Album === album && (song == null || p.Song === song);
}
