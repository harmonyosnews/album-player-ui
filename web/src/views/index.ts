import { imageUrl } from '../api/client';
import { cleanDisplayName, formatFormat, safeUrl } from '../api/sanitize';
import type { AlbumVM } from '../api/types';
import type { AppState } from '../store';
import { store } from '../store';
import type { LayoutRefs } from '../ui/layout';
import { albumCard, artistCard, badge, emptyState, sectionHeader, statRow, trackRow } from '../ui/components';
import { el, svgIcon } from '../ui/dom';
import { albumAt, albumList, backButton, coverImage, isCurrent, navigate, pageHeader } from './helpers';
import { renderSettings } from './settings';

export function renderView(refs: LayoutRefs, s: AppState): void {
  const view = refs.view;
  view.innerHTML = '';
  switch (s.route.name) {
    case 'home': return renderHome(view, s);
    case 'albums': return renderAlbums(view, s);
    case 'album': return renderAlbumDetail(view, s);
    case 'artists': return renderArtists(view, s);
    case 'artist': return renderArtistDetail(view, s);
    case 'radio': return renderRadio(view, s);
    case 'playlists': return renderPlaylistView(view, s, 'playlists');
    case 'browse': return renderPlaylistView(view, s, 'browse');
    case 'settings': return renderSettings(view, s);
    default: return renderHome(view, s);
  }
}

function currentAlbumIndex(s: AppState): number | null {
  const list = albumList(s);
  if (s.player && list.length && s.player.Album >= 0 && s.player.Album < list.length) return s.player.Album;
  const saved = s.albums?.SavedAlbumIndex;
  if (saved != null && saved >= 0 && saved < list.length) return saved;
  return list.length ? 0 : null;
}

function albumGrid(list: AlbumVM[]): HTMLElement {
  const grid = el('div', { class: 'album-grid' });
  for (const album of list) {
    grid.append(albumCard(album, {
      onOpen: (a) => {
        if (store.get().radioMode) {
          navigate('radio');
          store.setRadioCategory(a.index);
        } else {
          navigate('album', a.index);
        }
      },
      onPlay: (a) => void store.play(a.index, 0),
    }));
  }
  return grid;
}

function renderHome(view: HTMLElement, s: AppState): void {
  const list = albumList(s);
  const page = el('div', { class: 'page home-page' });
  if (!list.length) {
    page.append(emptyState(
      'disc',
      s.radioMode ? '电台目录未载入' : '媒体库还是空的',
      s.radioMode ? '请检查 Radio 目录或稍后刷新。' : '请在设置中填写音乐根目录，或通过“文件浏览”载入一个目录。',
      el('div', { class: 'button-row' }, [
        el('button', { class: 'btn-primary', type: 'button', onclick: () => navigate('settings') }, [svgIcon('settings', 16), el('span', { text: '打开设置' })]),
        el('button', { class: 'btn-secondary', type: 'button', onclick: () => navigate('browse') }, [svgIcon('folder', 16), el('span', { text: '文件浏览' })]),
      ]),
    ));
    view.append(page);
    return;
  }
  const idx = currentAlbumIndex(s);
  const heroAlbum = idx != null ? albumAt(s, idx) : list[0];
  if (!heroAlbum) return;
  const playing = !!s.player?.Playing;
  const paused = !!s.player?.Paused;
  const isHeroPlaying = s.player?.Album === heroAlbum.index && (playing || paused);
  const format = s.player && (playing || paused) ? formatFormat(s.player) : '';
  const eyebrow = s.radioMode ? '网络电台' : playing ? (paused ? '已暂停' : '正在播放') : '欢迎回来';
  const title = s.radioMode && s.radioTitle ? s.radioTitle : heroAlbum.name;
  const subtitle = s.radioMode ? '网络电台' : [heroAlbum.artist, heroAlbum.year].filter(Boolean).join(' · ');
  const hero = el('section', { class: 'hero' }, [
    coverImage(heroAlbum.cover, 'hero-cover', 50),
    el('div', { class: 'hero-info' }, [
      el('span', { class: 'eyebrow', text: eyebrow }),
      el('h1', { class: 'hero-title', text: title }),
      el('p', { class: 'hero-sub', text: subtitle || ' ' }),
      el('div', { class: 'hero-meta' }, [format ? badge(format) : '', s.player?.RadioTitle && s.radioMode ? badge('RADIO', 'badge-accent') : '']),
      el('div', { class: 'hero-actions' }, [
        el('button', {
          class: 'btn-primary',
          type: 'button',
          onclick: () => {
            if (isHeroPlaying) void store.togglePlayPause();
            else void store.play(heroAlbum.index, 0);
          },
        }, [svgIcon(isHeroPlaying && !paused ? 'pause' : 'play', 18), el('span', { text: isHeroPlaying ? (paused ? '继续' : '暂停') : '播放' })]),
        el('button', { class: 'btn-secondary', type: 'button', onclick: () => navigate(s.radioMode ? 'radio' : 'album', heroAlbum.index) }, [el('span', { text: '查看专辑' })]),
      ]),
    ]),
  ]);
  page.append(hero);
  page.append(sectionHeader(s.radioMode ? '电台分类' : '全部专辑', el('button', {
    class: 'btn-text', type: 'button', onclick: () => navigate(s.radioMode ? 'radio' : 'albums'),
  }, [el('span', { text: '查看全部' }), svgIcon('chevronRight', 14)])));
  page.append(albumGrid(list.slice(0, 12)));
  if (s.player?.LastError) {
    page.append(el('p', { class: 'inline-error', text: s.player.LastError }));
  }
  view.append(page);
}

function renderAlbums(view: HTMLElement, s: AppState): void {
  const list = albumList(s);
  const q = s.search.trim().toLowerCase();
  const filtered = q
    ? list.filter((a) => [a.name, a.artist, a.year, a.display].join(' ').toLowerCase().includes(q))
    : list;
  const page = el('div', { class: 'page' });
  page.append(pageHeader(s.radioMode ? '电台分类' : '专辑', `${filtered.length} 张${s.radioMode ? '分类' : '专辑'}${q ? ` · 搜索 “${s.search}”` : ''}`, [
    el('button', { class: 'btn-secondary', type: 'button', onclick: () => { store.refreshAlbums(); store.refreshNow(); } }, [svgIcon('refresh', 16), el('span', { text: '刷新' })]),
  ]));
  if (!filtered.length) {
    page.append(emptyState('disc', q ? '没有匹配结果' : '没有专辑', q ? '试试其他关键词。' : '在设置中配置音乐根目录，或使用文件浏览载入目录。'));
    view.append(page);
    return;
  }
  page.append(albumGrid(filtered));
  view.append(page);
}

function renderAlbumDetail(view: HTMLElement, s: AppState): void {
  const index = s.route.album;
  const album = index != null ? albumAt(s, index) : null;
  const page = el('div', { class: 'page album-page' });
  if (!album) {
    page.append(emptyState('disc', '专辑不存在', '它可能已被移除，返回专辑列表重试。', el('button', { class: 'btn-primary', type: 'button', onclick: () => navigate('albums') }, [el('span', { text: '返回专辑' })])));
    view.append(page);
    return;
  }
  page.append(backButton('返回专辑', '#/albums'));
  const header = el('section', { class: 'album-hero' }, [
    coverImage(album.cover, 'album-hero-cover', 60),
    el('div', { class: 'album-hero-info' }, [
      el('span', { class: 'eyebrow', text: s.radioMode ? '电台分类' : '专辑' }),
      el('h1', { text: album.name }),
      el('p', { class: 'hero-sub', text: [album.artist, album.year].filter(Boolean).join(' · ') || ' ' }),
      el('div', { class: 'hero-actions' }, [
        el('button', { class: 'btn-primary', type: 'button', onclick: () => void store.play(album.index, 0) }, [svgIcon('play', 18), el('span', { text: '播放全部' })]),
      ]),
    ]),
  ]);
  page.append(header);
  const songs = s.songs.get(album.index);
  if (!songs) {
    void store.loadSongs(album.index);
    page.append(el('div', { class: 'skeleton-list' }, Array.from({ length: 6 }, () => el('div', { class: 'skeleton-row' }))));
  } else if (!songs.Songs?.length) {
    page.append(emptyState('music', '没有可播放的曲目', '检查文件是否存在，或在 aplayer 中重新载入该目录。'));
  } else {
    const list = el('div', { class: 'track-list' });
    songs.Songs.forEach((raw, i) => {
      const title = cleanDisplayName(raw);
      list.append(trackRow(title, i, songs.SongsLen?.[i], isCurrent(s, album.index, i), () => void store.play(album.index, i)));
    });
    page.append(sectionHeader('曲目', el('span', { class: 'muted', text: `${songs.Songs.length} 首` })), list);
  }
  view.append(page);
}

function artistGroups(s: AppState): Map<string, AlbumVM[]> {
  const map = new Map<string, AlbumVM[]>();
  for (const album of albumList(s)) {
    const key = album.artist || '未知艺术家';
    const arr = map.get(key) || [];
    arr.push(album);
    map.set(key, arr);
  }
  return map;
}

function renderArtists(view: HTMLElement, s: AppState): void {
  const groups = artistGroups(s);
  const page = el('div', { class: 'page' });
  page.append(pageHeader('艺术家', `${groups.size} 位艺术家`));
  if (!groups.size) {
    page.append(emptyState('user', '还没有艺术家', '配置音乐库后，艺术家会按标签自动聚合。'));
    view.append(page);
    return;
  }
  const grid = el('div', { class: 'artist-grid' });
  for (const [name, albums] of groups) {
    grid.append(artistCard(name, albums.length, () => navigate('artist', name)));
  }
  page.append(grid);
  view.append(page);
}

function renderArtistDetail(view: HTMLElement, s: AppState): void {
  const name = s.route.artist || '';
  const albums = albumList(s).filter((a) => (a.artist || '未知艺术家') === name);
  const page = el('div', { class: 'page' });
  page.append(backButton('返回艺术家', '#/artists'));
  page.append(pageHeader(name || '艺术家', `${albums.length} 张专辑`));
  if (!albums.length) page.append(emptyState('user', '没有专辑', '返回艺术家列表重试。'));
  else page.append(albumGrid(albums));
  view.append(page);
}

function renderRadio(view: HTMLElement, s: AppState): void {
  const page = el('div', { class: 'page' });
  if (!s.radioMode) {
    page.append(pageHeader('网络电台', 'aplayer 的电台目录'));
    page.append(emptyState('radio', '进入电台模式', 'aplayer 的电台与本地专辑使用同一套浏览接口；进入后会按分类展示 .rad / .m3u 条目。', el('button', {
      class: 'btn-primary', type: 'button', onclick: () => void store.enterRadio(),
    }, [svgIcon('radio', 16), el('span', { text: s.busy ? '正在进入…' : '进入电台模式' })])));
    view.append(page);
    return;
  }
  const categories = albumList(s);
  const category = s.radioCategory;
  page.append(pageHeader('网络电台', s.radioTitle || '选择分类开始收听', [
    el('button', { class: 'btn-secondary', type: 'button', onclick: () => void addStationDialog(s) }, [svgIcon('plus', 16), el('span', { text: '添加电台' })]),
    el('button', { class: 'btn-secondary', type: 'button', disabled: !s.player?.Playing, onclick: () => void store.favor() }, [svgIcon('heart', 16), el('span', { text: '收藏当前' })]),
    el('button', { class: 'btn-text', type: 'button', onclick: () => { void store.leaveRadio(); navigate('home'); } }, [el('span', { text: '退出电台模式' })]),
  ]));

  if (category == null) {
    const nowTitle = s.radioTitle || (s.player?.Playing ? s.player.PlayingName : '') || '还没有选择电台';
    const now = el('section', { class: 'radio-now' }, [
      s.radioPics[0] ? el('img', { class: 'radio-now-img', src: safeUrl(s.radioPics[0]) || '', alt: '', onerror: (e: Event) => { (e.target as HTMLImageElement).hidden = true; } }) : el('div', { class: 'radio-now-placeholder' }, [svgIcon('radio', 46)]),
      el('div', {}, [
        el('span', { class: 'eyebrow', text: '正在收听' }),
        el('h2', { text: nowTitle }),
        el('p', { class: 'hero-sub', text: s.player?.Playing ? '电台正在播放，点击分类可以切换。' : '从下面的分类中选择一个电台。' }),
      ]),
    ]);
    page.append(now);
    if (!categories.length) {
      page.append(emptyState('radio', '没有电台分类', '检查 Radio 目录，或在设置中更新电台目录。'));
    } else {
      page.append(sectionHeader('分类', el('span', { class: 'muted', text: `${categories.length} 个分类` })));
      page.append(albumGrid(categories));
    }
    view.append(page);
    return;
  }

  const cat = albumAt(s, category);
  if (!cat) {
    page.append(emptyState('radio', '分类不存在', '返回分类列表重试。', el('button', { class: 'btn-primary', type: 'button', onclick: () => store.setRadioCategory(null) }, [el('span', { text: '返回分类' })])));
    view.append(page);
    return;
  }
  page.append(backButton('返回分类', '#/radio'));
  page.append(el('section', { class: 'album-hero compact' }, [
    coverImage(cat.cover, 'album-hero-cover', 50),
    el('div', { class: 'album-hero-info' }, [
      el('span', { class: 'eyebrow', text: '电台分类' }),
      el('h1', { text: cat.name }),
      el('p', { class: 'hero-sub', text: '点击电台开始播放；收藏会写入 Radio/!Favorites。' }),
    ]),
  ]));
  const songs = s.songs.get(category);
  if (!songs) {
    void store.loadSongs(category);
    page.append(el('div', { class: 'skeleton-list' }, Array.from({ length: 8 }, () => el('div', { class: 'skeleton-row' }))));
  } else if (!songs.Songs?.length) {
    page.append(emptyState('radio', '这个分类没有电台', '尝试其他分类。'));
  } else {
    const list = el('div', { class: 'track-list' });
    songs.Songs.forEach((raw, i) => {
      const title = cleanDisplayName(raw);
      const row = el('div', {
        class: `track-row${isCurrent(s, category, i) ? ' is-current' : ''}`,
        tabindex: '0', role: 'button', 'aria-label': `播放 ${title}`,
        onclick: () => void store.play(category, i),
        onkeydown: (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); void store.play(category, i); } },
      }, [
        el('span', { class: 'track-number' }, [isCurrent(s, category, i) ? svgIcon('wave', 15) : svgIcon('radio', 15)]),
        el('span', { class: 'track-title', text: title }),
        el('span', { class: 'track-duration', text: 'RADIO' }),
        el('button', {
          class: 'track-delete', type: 'button', title: '删除电台', 'aria-label': `删除 ${title}`,
          onclick: (e: Event) => {
            e.stopPropagation();
            if (confirm(`删除电台“${title}”？`)) void store.deleteStation(category, i);
          },
        }, [svgIcon('trash', 15)]),
      ]);
      list.append(row);
    });
    page.append(sectionHeader('电台', el('span', { class: 'muted', text: `${songs.Songs.length} 个` })), list);
  }
  view.append(page);
}

function addStationDialog(s: AppState): void {
  const name = prompt('电台名称');
  if (!name?.trim()) return;
  const url = prompt('流地址 (http:// 或 https://)');
  if (!url?.trim()) return;
  if (!safeUrl(url)) { store.toast('流地址必须是 http/https', 'error'); return; }
  const category = s.radioCategory != null ? albumAt(s, s.radioCategory)?.name || 'My Radios' : 'My Radios';
  const folder = prompt('分类目录', category);
  if (!folder?.trim()) return;
  void store.addStation(name.trim(), url.trim(), folder.trim());
}

function visibleDrives(s: AppState): Array<{ drive: { path: string; name: string; level: number; expanded: number }; index: number }> {
  const pl = s.playlists;
  if (!pl) return [];
  const all = pl.Drives.map((drive, index) => ({ drive, index }));
  const root = String(s.config?.root_folder || '').replace(/^\/+|\/+$/g, '');
  if (!root) return all;
  const rootDrive = all.find(({ drive }) => drive.level === 0 && drive.name !== 'aplayer.dat' && (drive.path.replace(/^\/+|\/+$/g, '').toLowerCase() === root.toLowerCase() || drive.name.toLowerCase() === root.toLowerCase()));
  if (!rootDrive) return all;
  const rootPath = rootDrive.drive.path;
  return all.filter(({ drive }) => drive.name === 'aplayer.dat' || drive.path === rootPath || drive.path.startsWith(rootPath + '/'));
}

function renderPlaylistView(view: HTMLElement, s: AppState, mode: 'playlists' | 'browse'): void {
  const page = el('div', { class: 'page' });
  const title = mode === 'playlists' ? '播放列表' : '文件浏览';
  const subtitle = mode === 'playlists' ? 'aplayer 的列表是文件/目录；展开浏览，载入会改变当前专辑库' : '展开目录浏览；载入会把该目录作为当前播放列表';
  const headerActions: HTMLElement[] = [
    el('button', { class: 'btn-secondary', type: 'button', onclick: () => { void store.loadPlaylists(); } }, [svgIcon('refresh', 16), el('span', { text: '刷新' })]),
  ];
  if (mode === 'playlists') {
    headerActions.push(el('button', { class: 'btn-primary', type: 'button', onclick: () => {
      const name = prompt('播放列表名称');
      if (name?.trim()) void store.savePlaylist(name);
    } }, [svgIcon('plus', 16), el('span', { text: '保存当前' })]));
  }
  page.append(pageHeader(title, subtitle, headerActions));
  const root = String(s.config?.root_folder || '');
  if (!root) {
    page.append(el('p', { class: 'inline-warn', text: '未配置音乐根目录：以下为播放器可见目录。建议在设置 → 常规中填写 root_folder。' }));
  }
  if (!s.playlists) {
    void store.loadPlaylists();
    page.append(el('div', { class: 'skeleton-list' }, Array.from({ length: 6 }, () => el('div', { class: 'skeleton-row' }))));
    view.append(page);
    return;
  }
  const items = visibleDrives(s);
  if (!items.length) {
    page.append(emptyState(mode === 'playlists' ? 'list' : 'folder', '没有可显示的条目', '检查音乐根目录或在设置中配置。'));
    view.append(page);
    return;
  }
  const list = el('div', { class: 'browser-list' });
  for (const { drive, index } of items) {
    const isFile = drive.name === 'aplayer.dat' || /\.(dat|m3u)$/i.test(drive.name);
    const actionButtons: HTMLElement[] = [];
    if (!isFile) {
      const expanded = drive.expanded === 1;
      actionButtons.push(el('button', {
        class: 'btn-secondary small', type: 'button', title: expanded ? '折叠目录' : '展开目录',
        onclick: () => void store.expandPlaylists(index),
      }, [svgIcon(expanded ? 'chevronDown' : 'chevronRight', 14), el('span', { text: expanded ? '折叠' : '展开' })]));
    }
    actionButtons.push(el('button', {
      class: 'btn-secondary small', type: 'button', title: '载入为当前播放列表',
      onclick: () => void store.loadPlaylist(index),
    }, [el('span', { text: '载入' })]));
    if (mode === 'playlists' && isFile) {
      actionButtons.push(el('button', {
        class: 'btn-danger small', type: 'button', title: '删除列表',
        onclick: () => { if (confirm(`删除列表“${drive.name}”？`)) void store.deletePlaylist(drive.name); },
      }, [svgIcon('trash', 14)]));
    }
    const row = el('div', { class: 'browser-row', style: { paddingLeft: `${12 + Math.min(drive.level, 6) * 18}px` } }, [
      el('span', { class: 'browser-icon' }, [svgIcon(isFile ? 'list' : 'folder', 18)]),
      el('div', { class: 'browser-meta' }, [
        el('span', { class: 'browser-name', text: cleanDisplayName(drive.name) }),
        el('span', { class: 'browser-path', text: drive.path || '—' }),
      ]),
      el('div', { class: 'browser-actions' }, actionButtons),
    ]);
    list.append(row);
  }
  page.append(list);
  view.append(page);
}

