import type { AlbumVM } from '../api/types';
import { formatDuration } from '../api/sanitize';
import { el, svgIcon } from './dom';

export interface AlbumCardOptions {
  onOpen: (album: AlbumVM) => void;
  onPlay: (album: AlbumVM) => void;
}

export function albumCard(album: AlbumVM, opts: AlbumCardOptions): HTMLElement {
  const placeholder = el('div', { class: 'cover-fallback' }, [svgIcon('music', 30)]);
  const img = el('img', {
    class: 'cover-img',
    src: album.cover,
    alt: '',
    loading: 'lazy',
    onerror: () => {
      img.hidden = true;
      placeholder.hidden = false;
    },
  });
  const cover = el('div', { class: 'album-cover' }, [placeholder, img]);
  placeholder.hidden = true;
  const play = el(
    'button',
    {
      class: 'album-play',
      type: 'button',
      title: '播放专辑',
      'aria-label': `播放 ${album.name}`,
      onclick: (e: Event) => {
        e.stopPropagation();
        opts.onPlay(album);
      },
    },
    [svgIcon('play', 20)],
  );
  const card = el(
    'div',
    {
      class: 'album-card',
      tabindex: '0',
      role: 'button',
      'aria-label': `打开专辑 ${album.name}`,
      onclick: () => opts.onOpen(album),
      onkeydown: (e: KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          opts.onOpen(album);
        }
      },
    },
    [
      cover,
      play,
      el('div', { class: 'album-name', text: album.name }),
      el('div', { class: 'album-sub', text: [album.artist, album.year].filter(Boolean).join(' · ') }),
    ],
  );
  return card;
}

export function artistCard(name: string, count: number, onClick: () => void): HTMLElement {
  const initial = (name.trim()[0] || '?').toUpperCase();
  const card = el(
    'div',
    {
      class: 'artist-card',
      tabindex: '0',
      role: 'button',
      'aria-label': `查看艺术家 ${name}`,
      onclick: onClick,
      onkeydown: (e: KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      },
    },
    [
      el('div', { class: 'artist-avatar' }, [el('span', { text: initial })]),
      el('div', { class: 'artist-name', text: name }),
      el('div', { class: 'artist-sub', text: `${count} 张专辑` }),
    ],
  );
  return card;
}

export function trackRow(
  title: string,
  index: number,
  length: number | undefined,
  current: boolean,
  onPlay: () => void,
): HTMLElement {
  const number = el('span', { class: 'track-number' }, [current ? svgIcon('wave', 15) : String(index + 1)]);
  const row = el(
    'div',
    {
      class: `track-row${current ? ' is-current' : ''}`,
      tabindex: '0',
      role: 'button',
      'aria-label': `播放 ${title}`,
      onclick: onPlay,
      onkeydown: (e: KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onPlay();
        }
      },
    },
    [
      number,
      el('span', { class: 'track-title', text: title }),
      el('span', { class: 'track-duration', text: length ? formatDuration(length) : '—' }),
      el('span', { class: 'track-play' }, [svgIcon('play', 16)]),
    ],
  );
  return row;
}

export function emptyState(iconName: string, title: string, desc: string, action?: HTMLElement): HTMLElement {
  return el('div', { class: 'empty-state' }, [
    svgIcon(iconName, 40),
    el('h3', { text: title }),
    el('p', { text: desc }),
    action || '',
  ]);
}

export function sectionHeader(title: string, action?: HTMLElement): HTMLElement {
  return el('div', { class: 'section-header' }, [
    el('h2', { text: title }),
    action || el('span'),
  ]);
}

export function badge(text: string, cls = ''): HTMLElement {
  return el('span', { class: `badge ${cls}`.trim(), text });
}

export function statRow(label: string, value: string): HTMLElement {
  return el('div', { class: 'stat-row' }, [
    el('span', { class: 'stat-label', text: label }),
    el('span', { class: 'stat-value', text: value || '—' }),
  ]);
}

export function settingRow(label: string, control: HTMLElement, hint = ''): HTMLElement {
  return el('label', { class: 'setting-row' }, [
    el('span', { class: 'setting-label' }, [
      el('span', { text: label }),
      hint ? el('small', { text: hint }) : '',
    ]),
    control,
  ]);
}

export function textInput(value: string, type = 'text'): HTMLInputElement {
  return el('input', { class: 'input', type, value });
}

export function numberInput(value: number, min?: number, max?: number): HTMLInputElement {
  const input = el('input', { class: 'input input-number', type: 'number', value: String(value) });
  if (min != null) input.min = String(min);
  if (max != null) input.max = String(max);
  return input;
}

export function checkbox(checked: boolean): HTMLInputElement {
  return el('input', { class: 'checkbox', type: 'checkbox', checked });
}

export function select(value: string, options: Array<{ value: string; label: string }>): HTMLSelectElement {
  const s = el('select', { class: 'input select' });
  for (const o of options) s.append(el('option', { value: o.value, text: o.label }));
  s.value = value;
  return s;
}
