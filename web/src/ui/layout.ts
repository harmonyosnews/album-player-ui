import { imageUrl } from '../api/client';
import { cleanDisplayName, formatDuration, formatFormat } from '../api/sanitize';
import type { AppState } from '../store';
import { store } from '../store';
import { el, iconButton, svgIcon } from './dom';

export interface LayoutRefs {
  view: HTMLElement;
  navLinks: HTMLElement[];
  mobileLinks: HTMLElement[];
  search: HTMLInputElement;
  themeBtn: HTMLButtonElement;
  offline: HTMLElement;
  toast: HTMLElement;
  player: {
    cover: HTMLImageElement;
    coverFallback: HTMLElement;
    title: HTMLElement;
    artist: HTMLElement;
    format: HTMLElement;
    play: HTMLButtonElement;
    stop: HTMLButtonElement;
    seek: HTMLInputElement;
    current: HTMLElement;
    total: HTMLElement;
    volumeWrap: HTMLElement;
    volume: HTMLInputElement;
    volumeIcon: HTMLElement;
    queue: HTMLButtonElement;
  };
  now: {
    root: HTMLElement;
    backdrop: HTMLElement;
    cover: HTMLImageElement;
    coverFallback: HTMLElement;
    title: HTMLElement;
    artist: HTMLElement;
    album: HTMLElement;
    format: HTMLElement;
    radio: HTMLElement;
    play: HTMLButtonElement;
    stop: HTMLButtonElement;
    seek: HTMLInputElement;
    current: HTMLElement;
    total: HTMLElement;
    queue: HTMLButtonElement;
    fav: HTMLButtonElement;
  };
  queue: {
    root: HTMLElement;
    body: HTMLElement;
    meta: HTMLElement;
    save: HTMLButtonElement;
    clear: HTMLButtonElement;
  };
}

let dragging = false;
let nowDragging = false;

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape' || !store.get().queueOpen) return;
  event.preventDefault();
  store.closeQueue();
});

const NAV: Array<{ section: string; items: Array<{ name: string; label: string; icon: string }> }> = [
  {
    section: '发现',
    items: [
      { name: 'home', label: '首页', icon: 'home' },
      { name: 'albums', label: '专辑', icon: 'disc' },
      { name: 'artists', label: '艺术家', icon: 'user' },
      { name: 'browse', label: '文件浏览', icon: 'folder' },
    ],
  },
  {
    section: '我的音乐',
    items: [
      { name: 'radio', label: '网络电台', icon: 'radio' },
      { name: 'playlists', label: '播放列表', icon: 'list' },
    ],
  },
];

function go(name: string, param?: string | number): void {
  const suffix = param == null ? '' : `/${encodeURIComponent(String(param))}`;
  location.hash = `#/${name}${suffix}`;
}

function navLink(item: { name: string; label: string; icon: string }, mobile = false): HTMLElement {
  const a = el(
    'a',
    {
      class: mobile ? 'mobile-nav-item' : 'nav-item',
      href: `#/${item.name}`,
      'data-route': item.name,
      onclick: (e: Event) => {
        e.preventDefault();
        go(item.name);
      },
    },
    [svgIcon(item.icon, mobile ? 20 : 18), el('span', { text: item.label })],
  );
  return a;
}

export function renderLayout(app: HTMLElement): LayoutRefs {
  app.innerHTML = '';
  const navLinks: HTMLElement[] = [];
  const sidebar = el('aside', { class: 'sidebar' }, [
    el('div', { class: 'logo', title: '回到首页', onclick: () => go('home') }, [
      el('div', { class: 'logo-mark' }, [svgIcon('disc', 24)]),
      el('div', { class: 'logo-text' }, [el('strong', { text: 'Album Player' }), el('small', { text: 'APUI' })]),
    ]),
    el('nav', { class: 'nav' }, NAV.map((section) => {
      const items = section.items.map((item) => {
        const link = navLink(item);
        navLinks.push(link);
        return link;
      });
      return el('div', { class: 'nav-section' }, [
        el('div', { class: 'nav-label', text: section.section }),
        ...items,
      ]);
    })),
    el('div', { class: 'sidebar-footer' }, [
      el('span', { class: 'version', text: `UI ${__APUI_VERSION__} · aplayer 2.19` }),
    ]),
  ]);

  const search = el('input', {
    class: 'search-input',
    type: 'search',
    placeholder: '搜索专辑、艺术家…',
    'aria-label': '搜索',
    oninput: () => {
      const value = search.value;
      store.setSearch(value);
      if (value && !['albums', 'album'].includes(store.get().route.name)) go('albums');
    },
  }) as HTMLInputElement;

  const settingsBtn = iconButton('settings', '设置', () => { location.hash = '#/settings'; });
  const themeBtn = iconButton('moon', '切换主题', () => store.toggleTheme());
  const refreshBtn = iconButton('refresh', '刷新媒体库', () => {
    void store.refreshAlbums();
    store.refreshNow();
  });
  const fullBtn = iconButton('expand', '全屏', () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen();
  });

  const topbar = el('header', { class: 'topbar' }, [
    el('div', { class: 'search-wrap' }, [svgIcon('search', 18), search]),
    el('div', { class: 'top-actions' }, [settingsBtn, refreshBtn, themeBtn, fullBtn]),
  ]);

  const offline = el('div', { class: 'offline-banner hidden' }, [
    svgIcon('alert', 16),
    el('span', { text: '播放器未响应，正在重试…' }),
  ]);

  const view = el('main', { class: 'view', id: 'view' });
  const main = el('div', { class: 'main' }, [topbar, offline, view]);

  const coverFallback = el('div', { class: 'mini-cover-fallback' }, [svgIcon('music', 22)]);
  const cover = el('img', { class: 'mini-cover-img', alt: '', hidden: true }) as HTMLImageElement;
  const coverWrap = el(
    'button',
    {
      class: 'mini-cover',
      type: 'button',
      title: '打开正在播放',
      'aria-label': '打开正在播放',
      onclick: () => store.toggleNowPlaying(true),
    },
    [coverFallback, cover],
  );
  const title = el('div', { class: 'player-title', text: '未在播放' });
  const artist = el('div', { class: 'player-artist', text: '选择一张专辑开始' });
  const format = el('span', { class: 'badge player-format', text: '' });
  const seek = el('input', {
    class: 'seek',
    type: 'range',
    min: '0',
    max: '100',
    step: '0.1',
    value: '0',
    'aria-label': '播放进度',
  }) as HTMLInputElement;
  seek.style.setProperty('--seek', '0%');
  const current = el('span', { class: 'time', text: '0:00' });
  const total = el('span', { class: 'time', text: '0:00' });
  seek.addEventListener('pointerdown', () => { dragging = true; });
  seek.addEventListener('input', () => {
    const p = store.get().player;
    const len = p?.PlayingLen || 0;
    seek.style.setProperty('--seek', `${Number(seek.value)}%`);
    if (len > 0) current.textContent = formatDuration((Number(seek.value) / 100) * len);
  });
  seek.addEventListener('change', () => {
    dragging = false;
    void store.seek(Number(seek.value));
  });
  seek.addEventListener('pointerup', () => { dragging = false; });

  const playBtn = el('button', {
    class: 'control-btn play-btn',
    type: 'button',
    title: '播放/暂停',
    'aria-label': '播放/暂停',
    onclick: () => void store.togglePlayPause(),
  }, [svgIcon('play', 22)]);
  const stopBtn = el('button', {
    class: 'control-btn',
    type: 'button',
    title: '停止',
    'aria-label': '停止',
    onclick: () => void store.stop(),
  }, [svgIcon('stop', 16)]);
  const prevBtn = el('button', {
    class: 'control-btn',
    type: 'button',
    title: '上一首',
    'aria-label': '上一首',
    onclick: () => void store.prev(),
  }, [svgIcon('prev', 18)]);
  const nextBtn = el('button', {
    class: 'control-btn',
    type: 'button',
    title: '下一首',
    'aria-label': '下一首',
    onclick: () => void store.next(),
  }, [svgIcon('next', 18)]);

  const volumeIcon = svgIcon('volume', 18);
  const volume = el('input', {
    class: 'volume',
    type: 'range',
    min: '0',
    max: '100',
    step: '1',
    value: '80',
    'aria-label': '音量',
  }) as HTMLInputElement;
  volume.addEventListener('change', () => void store.setVolume(Number(volume.value)));
  const volumeWrap = el('div', { class: 'volume-wrap' }, [volumeIcon, volume]);

  const queueBtn = el('button', {
    class: 'control-btn queue-btn',
    type: 'button',
    title: '当前播放队列',
    'aria-label': '当前播放队列',
    'aria-haspopup': 'dialog',
    'aria-expanded': 'false',
    onclick: () => void store.openQueue(),
  }, [svgIcon('list', 18)]);

  const playerBar = el('footer', { class: 'player-bar' }, [
    el('div', { class: 'player-progress' }, [current, seek, total]),
    el('div', { class: 'player-main' }, [
      el('div', { class: 'player-left' }, [coverWrap, el('div', { class: 'player-meta' }, [
        title,
        artist,
        format,
      ])]),
      el('div', { class: 'player-center' }, [prevBtn, stopBtn, playBtn, nextBtn, queueBtn]),
      el('div', { class: 'player-right' }, [volumeWrap]),
    ]),
  ]);

  const mobileLinks: HTMLElement[] = [];
  const mobileNav = el('nav', { class: 'mobile-nav', 'aria-label': '移动端导航' }, [
    el('div', { class: 'mobile-nav-items' }, [
      { name: 'home', label: '首页', icon: 'home' },
      { name: 'albums', label: '专辑', icon: 'disc' },
      { name: 'browse', label: '文件', icon: 'folder' },
      { name: 'radio', label: '电台', icon: 'radio' },
    ].map((item) => {
      const link = navLink(item, true);
      mobileLinks.push(link);
      return link;
    })),
  ]);

  const nowBackdrop = el('div', { class: 'now-backdrop' });
  const nowCoverFallback = el('div', { class: 'now-cover-fallback' }, [svgIcon('music', 60)]);
  const nowCover = el('img', { class: 'now-cover-img', alt: '', hidden: true }) as HTMLImageElement;
  const nowTitle = el('h1', { text: '未在播放' });
  const nowArtist = el('p', { class: 'now-artist', text: '' });
  const nowAlbum = el('p', { class: 'now-album', text: '' });
  const nowFormat = el('span', { class: 'badge', text: '' });
  const nowRadio = el('p', { class: 'now-radio', text: '' });
  const nowSeek = el('input', { class: 'seek', type: 'range', min: '0', max: '100', step: '0.1', value: '0', 'aria-label': '播放进度' }) as HTMLInputElement;
  nowSeek.style.setProperty('--seek', '0%');
  const nowCurrent = el('span', { class: 'time', text: '0:00' });
  const nowTotal = el('span', { class: 'time', text: '0:00' });
  nowSeek.addEventListener('pointerdown', () => { nowDragging = true; });
  nowSeek.addEventListener('input', () => {
    const len = store.get().player?.PlayingLen || 0;
    nowSeek.style.setProperty('--seek', `${Number(nowSeek.value)}%`);
    if (len > 0) nowCurrent.textContent = formatDuration((Number(nowSeek.value) / 100) * len);
  });
  nowSeek.addEventListener('change', () => { nowDragging = false; void store.seek(Number(nowSeek.value)); });
  nowSeek.addEventListener('pointerup', () => { nowDragging = false; });
  const nowPlay = el('button', { class: 'control-btn play-btn', type: 'button', title: '播放/暂停', 'aria-label': '播放/暂停', onclick: () => void store.togglePlayPause() }, [svgIcon('play', 24)]);
  const nowStop = el('button', { class: 'control-btn', type: 'button', title: '停止', 'aria-label': '停止', onclick: () => void store.stop() }, [svgIcon('stop', 18)]);
  const nowPrev = el('button', { class: 'control-btn', type: 'button', title: '上一首', 'aria-label': '上一首', onclick: () => void store.prev() }, [svgIcon('prev', 20)]);
  const nowNext = el('button', { class: 'control-btn', type: 'button', title: '下一首', 'aria-label': '下一首', onclick: () => void store.next() }, [svgIcon('next', 20)]);
  const nowQueue = el('button', { class: 'control-btn queue-btn', type: 'button', title: '当前播放队列', 'aria-label': '当前播放队列', onclick: () => void store.openQueue() }, [svgIcon('list', 20)]);
  const nowFav = el('button', { class: 'btn-secondary now-fav', type: 'button', title: '收藏当前电台', onclick: () => void store.favor() }, [svgIcon('heart', 16), el('span', { text: '收藏' })]);
  const nowClose = el('button', { class: 'now-close', type: 'button', title: '关闭', 'aria-label': '关闭正在播放', onclick: () => store.toggleNowPlaying(false) }, [svgIcon('chevronDown', 26)]);
  const nowRoot = el('div', { class: 'now-playing hidden', id: 'now-playing' }, [
    nowBackdrop,
    el('div', { class: 'now-panel' }, [
      nowClose,
      el('div', { class: 'now-cover' }, [nowCoverFallback, nowCover]),
      el('div', { class: 'now-info' }, [
        el('div', { class: 'now-heading' }, [nowTitle, nowArtist, nowAlbum, nowFormat]),
        nowRadio,
        el('div', { class: 'now-progress' }, [nowCurrent, nowSeek, nowTotal]),
        el('div', { class: 'now-controls' }, [nowPrev, nowStop, nowPlay, nowNext, nowQueue, nowFav]),
      ]),
    ]),
  ]);

  const toast = el('div', { class: 'toasts', 'aria-live': 'polite' });

  const queueMeta = el('span', { class: 'queue-meta', text: '' });
  const queueBody = el('div', { class: 'queue-body' });
  const queueSave = el('button', {
    class: 'btn-secondary',
    type: 'button',
    onclick: () => void saveQueueAsPlaylist(),
  }, [el('span', { text: '保存播放列表' })]);
  const queueClear = el('button', {
    class: 'btn-secondary',
    type: 'button',
    onclick: () => void store.clearQueue(),
  }, [el('span', { text: '清除队列' })]);
  const queueCancel = el('button', {
    class: 'btn-secondary',
    type: 'button',
    onclick: () => store.closeQueue(),
  }, [el('span', { text: '取消' })]);
  const queueClose = el('button', {
    class: 'queue-close',
    type: 'button',
    title: '关闭',
    'aria-label': '关闭播放队列',
    onclick: () => store.closeQueue(),
  }, [svgIcon('close', 20)]);
  const queueRoot = el('div', {
    class: 'queue-modal hidden',
    role: 'dialog',
    'aria-modal': 'true',
    'aria-labelledby': 'queue-title',
    tabindex: '-1',
  }, [
    el('div', { class: 'queue-backdrop', onclick: () => store.closeQueue() }),
    el('div', { class: 'queue-panel' }, [
      el('div', { class: 'queue-header' }, [
        el('div', { class: 'queue-heading' }, [
          el('h2', { id: 'queue-title', text: '当前播放队列' }),
          queueMeta,
        ]),
        queueClose,
      ]),
      queueBody,
      el('div', { class: 'queue-footer' }, [
        queueSave,
        queueClear,
        queueCancel,
      ]),
    ]),
  ]);

  app.append(sidebar, main, playerBar, mobileNav, nowRoot, queueRoot, toast);

  return {
    view,
    navLinks,
    mobileLinks,
    search,
    themeBtn,
    offline,
    toast,
    player: {
      cover, coverFallback, title, artist, format, play: playBtn, stop: stopBtn,
      seek, current, total, volumeWrap, volume, volumeIcon, queue: queueBtn,
    },
    now: {
      root: nowRoot, backdrop: nowBackdrop, cover: nowCover, coverFallback: nowCoverFallback,
      title: nowTitle, artist: nowArtist, album: nowAlbum, format: nowFormat, radio: nowRadio,
      play: nowPlay, stop: nowStop, seek: nowSeek, current: nowCurrent, total: nowTotal,
      queue: nowQueue, fav: nowFav,
    },
    queue: {
      root: queueRoot, body: queueBody, meta: queueMeta, save: queueSave, clear: queueClear,
    },
  };
}

function setCover(img: HTMLImageElement, fallback: HTMLElement, url: string): void {
  if (!url) {
    img.hidden = true;
    img.removeAttribute('src');
    fallback.hidden = false;
    return;
  }
  if (img.getAttribute('src') !== url) img.src = url;
  img.hidden = false;
  fallback.hidden = true;
}

function setText(node: HTMLElement, text: string): void {
  if (node.textContent !== text) node.textContent = text;
}

function setSeek(input: HTMLInputElement, percent: number): void {
  const value = Math.min(100, Math.max(0, percent));
  input.value = String(value);
  input.style.setProperty('--seek', `${value}%`);
}

function queuePlaylistName(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `播放队列 ${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}-${pad(d.getMinutes())}`;
}

function safePlaylistName(value: string): string {
  return value.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-').replace(/\s+/g, ' ').trim();
}

async function saveQueueAsPlaylist(): Promise<void> {
  const raw = window.prompt('请输入播放列表名称', queuePlaylistName());
  if (raw == null) return;
  const name = safePlaylistName(raw);
  const ok = await store.savePlaylist(name);
  if (ok) store.closeQueue();
}

function albumTitleAt(albums: NonNullable<AppState['albums']>, index: number): string {
  const raw = albums.AlbumList?.[index] || albums.Albums?.[index] || '';
  return cleanDisplayName(raw) || `专辑 ${index + 1}`;
}

function buildQueueBody(body: HTMLElement, s: AppState): void {
  body.innerHTML = '';
  if (!s.radioMode && s.queueCleared) {
    body.append(el('div', { class: 'queue-empty' }, [svgIcon('list', 28), el('p', { text: '当前播放队列为空' })]));
    return;
  }
  const albums = s.radioMode ? s.radioAlbums : s.albums;
  const songMap = s.radioMode ? s.radioSongs : s.songs;
  if (!albums) {
    body.append(el('div', { class: 'queue-empty' }, [svgIcon('list', 28), el('p', { text: '播放队列尚未载入' })]));
    return;
  }
  let indices: number[];
  if (s.radioMode) {
    if (s.radioCategory == null) {
      body.append(el('div', { class: 'queue-empty' }, [svgIcon('radio', 28), el('p', { text: '请先在网络电台中选择一个分类' })]));
      return;
    }
    indices = [s.radioCategory];
  } else {
    const count = Math.max(albums.AlbumList?.length || 0, albums.Albums?.length || 0);
    const current = s.player?.Album;
    indices = current != null && current >= 0 && current < count ? [current] : [];
  }
  if (!indices.length) {
    body.append(el('div', { class: 'queue-empty' }, [svgIcon('list', 28), el('p', { text: '当前没有正在播放的专辑' })]));
    return;
  }

  const currentAlbum = s.player?.Album;
  const currentSong = s.player?.Song;
  for (let position = 0; position < indices.length; position++) {
    const index = indices[position]!;
    const data = songMap.get(index);
    const tracks = data?.Songs || [];
    const group = el('section', {
      class: `queue-group${currentAlbum === index ? ' current' : ''}`,
      dataset: { album: String(index) },
    });
    const artist = cleanDisplayName(albums.AuthorList?.[index] || '');
    const metaText = [
      artist,
      s.radioMode ? '电台分类' : '',
      data ? `${tracks.length} 首` : '点击载入曲目',
    ].filter(Boolean).join(' · ');
    const meta = el('span', { class: 'queue-album-meta', text: metaText });
    const head = el('button', {
      class: 'queue-album',
      type: 'button',
      title: data ? '曲目已载入' : '载入该专辑曲目',
      onclick: () => {
        if (data || head.dataset.loading === '1') return;
        head.dataset.loading = '1';
        meta.textContent = '正在载入曲目…';
        const load = s.radioMode ? store.loadRadioSongs(index) : store.loadSongs(index);
        void load.finally(() => {
          delete head.dataset.loading;
          if (head.isConnected && meta.textContent === '正在载入曲目…') meta.textContent = metaText;
        });
      },
    }, [
      el('span', { class: 'queue-album-index', text: String(position + 1).padStart(2, '0') }),
      el('span', { class: 'queue-album-name', text: albumTitleAt(albums, index) }),
      meta,
    ]);
    group.append(head);

    if (data && !tracks.length) {
      group.append(el('p', { class: 'queue-group-empty', text: '该专辑没有可播放的曲目' }));
    }
    for (let song = 0; song < tracks.length; song++) {
      const active = currentAlbum === index && currentSong === song;
      const title = cleanDisplayName(tracks[song] || '') || `曲目 ${song + 1}`;
      const length = data?.SongsLen?.[song];
      group.append(el('button', {
        class: `queue-track${active ? ' current' : ''}`,
        type: 'button',
        'aria-current': active ? 'true' : undefined,
        onclick: () => {
          void store.play(index, song);
          store.closeQueue();
        },
      }, [
        el('span', { class: 'queue-track-no' }, [
          active ? svgIcon('play', 11) : document.createTextNode(String(song + 1)),
        ]),
        el('span', { class: 'queue-track-title', text: title }),
        length ? el('span', { class: 'queue-track-time', text: formatDuration(length) }) : '',
      ]));
    }
    body.append(group);
  }
}

function updateQueue(refs: LayoutRefs, s: AppState): void {
  const wasOpen = refs.queue.root.dataset.open === '1';
  const opening = s.queueOpen && !wasOpen;
  refs.queue.root.classList.toggle('hidden', !s.queueOpen);
  refs.queue.root.dataset.open = s.queueOpen ? '1' : '';
  refs.player.queue.setAttribute('aria-expanded', s.queueOpen ? 'true' : 'false');
  refs.player.queue.classList.toggle('active', s.queueOpen);
  document.body.classList.toggle('queue-open', s.queueOpen);
  if (!s.queueOpen) {
    refs.queue.body.dataset.sig = '';
    if (wasOpen) refs.player.queue.focus({ preventScroll: true });
    return;
  }

  const albums = s.radioMode ? s.radioAlbums : s.albums;
  const songMap = s.radioMode ? s.radioSongs : s.songs;
  const count = albums ? Math.max(albums.AlbumList?.length || 0, albums.Albums?.length || 0) : 0;
  const displayed = s.radioMode ? (s.radioCategory == null ? 0 : 1) : count;
  const loaded = s.radioMode
    ? (s.radioCategory != null && songMap.has(s.radioCategory) ? 1 : 0)
    : Array.from(songMap.keys()).filter((i) => i < count).length;
  const currentAlbum = s.player?.Album;
  const cleared = !s.radioMode && s.queueCleared;
  const metaParts = cleared
    ? ['队列已清空']
    : s.radioMode
      ? (s.radioCategory != null && albums ? [albumTitleAt(albums, s.radioCategory), '网络电台'] : ['未选择分类'])
      : (currentAlbum != null && currentAlbum >= 0 && currentAlbum < count && albums
        ? [albumTitleAt(albums, currentAlbum), s.songs.has(currentAlbum) ? `${s.songs.get(currentAlbum)?.Songs?.length || 0} 首` : '正在载入']
        : ['当前没有正在播放的专辑']);
  if (s.queueLoading) metaParts.push('正在读取…');
  refs.queue.meta.textContent = metaParts.join(' · ');
  refs.queue.save.disabled = !albums || s.busy || displayed === 0 || cleared;
  refs.queue.clear.disabled = !albums || s.busy || displayed === 0 || cleared;

  const sig = [
    s.radioMode ? 1 : 0,
    s.queueLoading ? 1 : 0,
    s.radioMode ? s.radioLibraryRev : s.libraryRev,
    s.radioMode ? s.radioSongsRev : s.songsRev,
    s.radioCategory ?? '',
    cleared ? 1 : 0,
    s.player?.Album ?? -1,
    s.player?.Song ?? -1,
    s.player?.Playing ? 1 : 0,
    count,
    Array.from(songMap.entries()).map(([k, v]) => `${k}:${v.Songs?.length || 0}`).join(','),
  ].join('|');
  if (refs.queue.body.dataset.sig !== sig) {
    const focused = document.activeElement;
    const focusedAlbum = focused instanceof HTMLElement && refs.queue.body.contains(focused)
      ? focused.closest<HTMLElement>('.queue-group')?.dataset.album
      : undefined;
    const scrollTop = refs.queue.body.scrollTop;
    refs.queue.body.dataset.sig = sig;
    buildQueueBody(refs.queue.body, s);
    if (focusedAlbum != null) {
      refs.queue.body
        .querySelector<HTMLElement>(`.queue-group[data-album="${focusedAlbum}"] .queue-album`)
        ?.focus({ preventScroll: true });
    }
    if (opening) {
      window.requestAnimationFrame(() => {
        const current = refs.queue.body.querySelector<HTMLElement>('.queue-group.current');
        if (!current) {
          refs.queue.body.scrollTop = 0;
          return;
        }
        const bodyBox = refs.queue.body.getBoundingClientRect();
        const currentBox = current.getBoundingClientRect();
        refs.queue.body.scrollTop += currentBox.top - bodyBox.top - bodyBox.height / 2 + currentBox.height / 2;
      });
    } else {
      refs.queue.body.scrollTop = scrollTop;
    }
  }
  if (opening) {
    window.requestAnimationFrame(() => refs.queue.root.focus({ preventScroll: true }));
  }
}

export function updateLayout(refs: LayoutRefs, s: AppState): void {
  const route = s.route.name;
  for (const link of [...refs.navLinks, ...refs.mobileLinks]) {
    const target = link.dataset.route || '';
    const active = target === route || (route === 'album' && target === 'albums') || (route === 'artist' && target === 'artists');
    link.classList.toggle('active', active);
    if (active) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }

  refs.themeBtn.innerHTML = '';
  refs.themeBtn.append(svgIcon(s.theme === 'dark' ? 'sun' : 'moon'));
  refs.themeBtn.title = s.theme === 'dark' ? '切换到浅色主题' : '切换到深色主题';
  if (document.activeElement !== refs.search && refs.search.value !== s.search) {
    refs.search.value = s.search;
  }
  refs.offline.classList.toggle('hidden', s.online);
  if (!s.online && s.error) refs.offline.querySelector('span')!.textContent = s.error;

  const p = s.player;
  const albums = s.albums;
  let albumIndex: number | null = null;
  if (p && albums && p.Album >= 0 && p.Album < albums.AlbumList.length) albumIndex = p.Album;
  const albumName = albumIndex != null ? albums!.AlbumList[albumIndex] : '';
  const artistName = albumIndex != null ? albums!.AuthorList[albumIndex] : '';
  const radio = !!p?.RadioMode;
  const playing = !!p?.Playing;
  const paused = !!p?.Paused;

  let titleText = '未在播放';
  let artistText = '选择一张专辑开始';
  let formatText = '';
  if (radio && playing) {
    titleText = p?.RadioTitle || p?.PlayingName || '网络电台';
    artistText = '网络电台';
    formatText = 'RADIO';
  } else if (p && (playing || paused)) {
    titleText = p.PlayingName || albumName || '未在播放';
    artistText = artistName || (radio ? '网络电台' : '');
    formatText = formatFormat(p);
  } else if (albumIndex != null) {
    titleText = albumName;
    artistText = artistName;
  }
  setText(refs.player.title, titleText);
  setText(refs.player.artist, artistText);
  setText(refs.player.format, formatText);
  refs.player.format.hidden = !formatText;
  setCover(refs.player.cover, refs.player.coverFallback, albumIndex != null ? imageUrl(albumIndex) : '');

  refs.player.play.innerHTML = '';
  refs.player.play.append(svgIcon(playing && !paused ? 'pause' : 'play', 22));
  refs.player.play.title = playing && !paused ? '暂停' : '播放';
  refs.player.play.setAttribute('aria-label', refs.player.play.title);
  refs.player.stop.disabled = !playing && !paused;
  refs.player.seek.disabled = !p || !p.ProgressVisible || p.PlayingLen <= 0;
  if (!dragging && p && p.PlayingLen > 0 && p.ProgressVisible) {
    setSeek(refs.player.seek, (p.Position / p.PlayingLen) * 100);
  } else if (!p || p.PlayingLen <= 0) {
    setSeek(refs.player.seek, 0);
  }
  setText(refs.player.current, p && p.ProgressVisible ? formatDuration(p.Position) : '0:00');
  setText(refs.player.total, p && p.ProgressVisible ? formatDuration(p.PlayingLen) : '0:00');
  const volumeEnabled = !!s.config?.volume_enabled;
  refs.player.volumeWrap.hidden = !volumeEnabled;
  if (volumeEnabled && p && document.activeElement !== refs.player.volume) {
    refs.player.volume.value = String(p.Volume);
  }

  refs.now.root.classList.toggle('hidden', !s.nowPlayingOpen);
  if (s.nowPlayingOpen) {
    setText(refs.now.title, titleText);
    setText(refs.now.artist, artistText);
    setText(refs.now.album, albumIndex != null ? [albumName, albums?.YearList[albumIndex]].filter(Boolean).join(' · ') : '');
    setText(refs.now.format, formatText);
    refs.now.format.hidden = !formatText;
    setText(refs.now.radio, radio && p?.RadioTitle ? p.RadioTitle : '');
    refs.now.radio.hidden = !(radio && p?.RadioTitle);
    setCover(refs.now.cover, refs.now.coverFallback, albumIndex != null ? imageUrl(albumIndex) : '');
    if (albumIndex != null) {
      refs.now.backdrop.style.backgroundImage = `url("${imageUrl(albumIndex)}")`;
      refs.now.backdrop.style.opacity = '1';
    } else {
      refs.now.backdrop.style.backgroundImage = '';
      refs.now.backdrop.style.opacity = '0';
    }
    refs.now.play.innerHTML = '';
    refs.now.play.append(svgIcon(playing && !paused ? 'pause' : 'play', 24));
    refs.now.play.title = playing && !paused ? '暂停' : '播放';
    refs.now.stop.disabled = !playing && !paused;
    refs.now.seek.disabled = !p || !p.ProgressVisible || p.PlayingLen <= 0;
    if (!nowDragging && p && p.PlayingLen > 0 && p.ProgressVisible) {
      setSeek(refs.now.seek, (p.Position / p.PlayingLen) * 100);
    } else if (!p || p.PlayingLen <= 0) {
      setSeek(refs.now.seek, 0);
    }
    setText(refs.now.current, p && p.ProgressVisible ? formatDuration(p.Position) : '0:00');
    setText(refs.now.total, p && p.ProgressVisible ? formatDuration(p.PlayingLen) : '0:00');
    refs.now.fav.hidden = !radio || !playing;
  }

  if (s.toast) {
    refs.toast.innerHTML = '';
    refs.toast.append(el('div', { class: `toast toast-${s.toast.kind}`, text: s.toast.text }));
  } else {
    refs.toast.innerHTML = '';
  }

  updateQueue(refs, s);
}
