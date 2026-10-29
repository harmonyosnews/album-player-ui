import { imageUrl } from '../api/client';
import { formatDuration, formatFormat } from '../api/sanitize';
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
    fav: HTMLButtonElement;
  };
}

let dragging = false;
let nowDragging = false;

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
  {
    section: '系统',
    items: [
      { name: 'settings', label: '设置', icon: 'settings' },
      { name: 'about', label: '关于', icon: 'info' },
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
    el('div', { class: 'top-actions' }, [refreshBtn, themeBtn, fullBtn]),
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
  const current = el('span', { class: 'time', text: '0:00' });
  const total = el('span', { class: 'time', text: '0:00' });
  seek.addEventListener('pointerdown', () => { dragging = true; });
  seek.addEventListener('input', () => {
    const p = store.get().player;
    const len = p?.PlayingLen || 0;
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

  const playerBar = el('footer', { class: 'player-bar' }, [
    el('div', { class: 'player-progress' }, [current, seek, total]),
    el('div', { class: 'player-main' }, [
      el('div', { class: 'player-left' }, [coverWrap, el('div', { class: 'player-meta' }, [
        title,
        artist,
        format,
      ])]),
      el('div', { class: 'player-center' }, [prevBtn, stopBtn, playBtn, nextBtn]),
      el('div', { class: 'player-right' }, [volumeWrap]),
    ]),
  ]);

  const mobileLinks: HTMLElement[] = [];
  const mobileNav = el('nav', { class: 'mobile-nav', 'aria-label': '移动端导航' }, [
    el('div', { class: 'mobile-nav-items' }, [
      { name: 'home', label: '首页', icon: 'home' },
      { name: 'albums', label: '专辑', icon: 'disc' },
      { name: 'radio', label: '电台', icon: 'radio' },
      { name: 'settings', label: '设置', icon: 'settings' },
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
  const nowCurrent = el('span', { class: 'time', text: '0:00' });
  const nowTotal = el('span', { class: 'time', text: '0:00' });
  nowSeek.addEventListener('pointerdown', () => { nowDragging = true; });
  nowSeek.addEventListener('input', () => {
    const len = store.get().player?.PlayingLen || 0;
    if (len > 0) nowCurrent.textContent = formatDuration((Number(nowSeek.value) / 100) * len);
  });
  nowSeek.addEventListener('change', () => { nowDragging = false; void store.seek(Number(nowSeek.value)); });
  nowSeek.addEventListener('pointerup', () => { nowDragging = false; });
  const nowPlay = el('button', { class: 'control-btn play-btn', type: 'button', title: '播放/暂停', 'aria-label': '播放/暂停', onclick: () => void store.togglePlayPause() }, [svgIcon('play', 24)]);
  const nowStop = el('button', { class: 'control-btn', type: 'button', title: '停止', 'aria-label': '停止', onclick: () => void store.stop() }, [svgIcon('stop', 18)]);
  const nowPrev = el('button', { class: 'control-btn', type: 'button', title: '上一首', 'aria-label': '上一首', onclick: () => void store.prev() }, [svgIcon('prev', 20)]);
  const nowNext = el('button', { class: 'control-btn', type: 'button', title: '下一首', 'aria-label': '下一首', onclick: () => void store.next() }, [svgIcon('next', 20)]);
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
        el('div', { class: 'now-controls' }, [nowPrev, nowStop, nowPlay, nowNext, nowFav]),
      ]),
    ]),
  ]);

  const toast = el('div', { class: 'toasts', 'aria-live': 'polite' });

  app.append(sidebar, main, playerBar, mobileNav, nowRoot, toast);

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
      seek, current, total, volumeWrap, volume, volumeIcon,
    },
    now: {
      root: nowRoot, backdrop: nowBackdrop, cover: nowCover, coverFallback: nowCoverFallback,
      title: nowTitle, artist: nowArtist, album: nowAlbum, format: nowFormat, radio: nowRadio,
      play: nowPlay, stop: nowStop, seek: nowSeek, current: nowCurrent, total: nowTotal, fav: nowFav,
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
    refs.player.seek.value = String(Math.min(100, Math.max(0, (p.Position / p.PlayingLen) * 100)));
  } else if (!p || p.PlayingLen <= 0) {
    refs.player.seek.value = '0';
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
      refs.now.seek.value = String(Math.min(100, Math.max(0, (p.Position / p.PlayingLen) * 100)));
    } else if (!p || p.PlayingLen <= 0) {
      refs.now.seek.value = '0';
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
}
