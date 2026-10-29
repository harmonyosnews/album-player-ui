import { api, ApiError, postConfig } from '../api/client';
import { buildPayload, normaliseRoot, validatePayload } from '../api/config-fields';
import { clampInt } from '../api/sanitize';
import type {
  AlbumsResponse,
  AplayerState,
  Config,
  PlaylistsResponse,
  SongsResponse,
  ToastKind,
} from '../api/types';

export type RouteName = 'home' | 'albums' | 'album' | 'artists' | 'artist' | 'radio' | 'playlists' | 'browse' | 'settings';

export interface Route {
  name: RouteName;
  album?: number;
  artist?: string;
}

export interface Toast {
  id: number;
  text: string;
  kind: ToastKind;
}

export interface AppState {
  config: Config | null;
  albums: AlbumsResponse | null;
  songs: Map<number, SongsResponse>;
  songsRev: number;
  player: AplayerState | null;
  online: boolean;
  ready: boolean;
  busy: boolean;
  error: string;
  route: Route;
  radioMode: boolean;
  radioAlbums: AlbumsResponse | null;
  radioSongs: Map<number, SongsResponse>;
  radioSongsRev: number;
  radioLibraryRev: number;
  radioLoading: boolean;
  queueOpen: boolean;
  queueLoading: boolean;
  radioCategory: number | null;
  radioTitle: string;
  radioPics: string[];
  search: string;
  theme: 'dark' | 'light';
  nowPlayingOpen: boolean;
  toast: Toast | null;
  playlists: PlaylistsResponse | null;
  libraryRev: number;
  libraryRootIndex: number | null;
  activePlaylistIndex: number | null;
  libraryLoading: boolean;
  deferredLibraryReload: boolean;
  configRev: number;
}

type Listener = (state: AppState) => void;

const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

class Store {
  private state: AppState = {
    config: null,
    albums: null,
    songs: new Map(),
    songsRev: 0,
    player: null,
    online: true,
    ready: false,
    busy: false,
    error: '',
    route: { name: 'home' },
    radioMode: false,
    radioAlbums: null,
    radioSongs: new Map(),
    radioSongsRev: 0,
    radioLibraryRev: 0,
    radioLoading: false,
    queueOpen: false,
    queueLoading: false,
    radioCategory: null,
    radioTitle: '',
    radioPics: [],
    search: '',
    theme: (localStorage.getItem('apui.theme') as 'dark' | 'light') || 'dark',
    nowPlayingOpen: false,
    toast: null,
    playlists: null,
    libraryRev: 0,
    libraryRootIndex: null,
    activePlaylistIndex: null,
    libraryLoading: false,
    deferredLibraryReload: false,
    configRev: 0,
  };

  private listeners = new Set<Listener>();
  private pollTimer: number | undefined;
  private polling = false;
  private failures = 0;
  private lastRadioFetch = 0;
  private toastTimer: number | undefined;
  private radioQueue: Promise<void> = Promise.resolve();

  get(): AppState {
    return this.state;
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private set(patch: Partial<AppState>): void {
    this.state = { ...this.state, ...patch };
    for (const fn of this.listeners) fn(this.state);
  }

  private setBusy(busy: boolean): void {
    this.set({ busy });
  }

  async init(): Promise<void> {
    this.applyTheme();
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        this.stopPolling();
        void this.poll();
      }
    });
    try {
      const config = await api.getConfig();
      this.set({ config, configRev: this.state.configRev + 1 });
      const player = await api.getState();
      this.set({ player, radioMode: player.RadioMode });
      let albums = this.state.albums;
      if (player.RadioMode) {
        const radioAlbums = await api.getAlbums();
        this.set({ radioAlbums, radioMode: true });
      } else {
        albums = await api.getAlbums();
        if (String(config.root_folder || '').trim()) {
          await this.ensureLibrary(true);
          albums = this.state.albums || albums;
        }
      }
      this.set({
        albums,
        player,
        radioMode: player.RadioMode,
        online: true,
        ready: true,
        error: '',
        libraryRev: this.state.libraryRev + 1,
      });
      this.startPolling();
      if (this.state.route.name === 'radio') void this.enterRadio();
    } catch (e) {
      this.set({ online: false, ready: true, error: this.describeError(e) });
    }
  }

  private describeError(e: unknown): string {
    if (e instanceof ApiError) {
      if (e.code === 'NETWORK') return '无法连接播放器，请检查 aplayer 是否运行';
      if (e.code === 'NOT_FOUND') return '接口不存在，可能 aplayer 版本不匹配';
      return e.message;
    }
    return e instanceof Error ? e.message : String(e);
  }

  private applyTheme(): void {
    document.body.dataset.theme = this.state.theme;
    localStorage.setItem('apui.theme', this.state.theme);
  }

  toggleTheme(): void {
    const theme = this.state.theme === 'dark' ? 'light' : 'dark';
    this.set({ theme });
    this.applyTheme();
  }

  // ---------- library ----------

  private findDriveIndex(pl: PlaylistsResponse, root: string): number | null {
    const target = normaliseRoot(root);
    if (!target) return null;
    const drives = pl.Drives || [];
    for (let i = 0; i < drives.length; i++) {
      const d = drives[i];
      if (d.level !== 0 || d.name === 'aplayer.dat') continue;
      const path = normaliseRoot(d.path || '');
      const name = normaliseRoot(d.name || '');
      if (path === target || name === target || (path && path.endsWith('/' + target))) return i;
    }
    return null;
  }

  async ensureLibrary(force = false): Promise<boolean> {
    const root = String(this.state.config?.root_folder || '').trim();
    if (!root || this.state.libraryLoading) return false;
    if (this.state.player?.Playing || this.state.player?.Paused) {
      this.set({ deferredLibraryReload: true });
      return false;
    }
    this.set({ libraryLoading: true });
    try {
      const pl = await api.getPlaylists(-1);
      this.set({ playlists: pl });
      const idx = this.findDriveIndex(pl, root);
      if (idx == null) return false;
      if (!force && this.state.activePlaylistIndex === idx && this.state.libraryRootIndex === idx) return true;
      await api.getPlaylist(idx);
      await sleep(700);
      const albums = await api.getAlbums();
      if (!albums.Albums.length && !albums.AlbumList.length) return false;
      this.set({
        albums,
        songs: new Map(),
        songsRev: this.state.songsRev + 1,
        libraryRev: this.state.libraryRev + 1,
        libraryRootIndex: idx,
        activePlaylistIndex: idx,
        deferredLibraryReload: false,
      });
      return true;
    } finally {
      this.set({ libraryLoading: false });
    }
  }

  async refreshAlbums(): Promise<void> {
    try {
      let albums = await api.getAlbums();
      if (this.state.radioMode) {
        this.set({ radioAlbums: albums, radioLibraryRev: this.state.radioLibraryRev + 1, online: true });
        return;
      }
      if (!albums.Albums.length && !albums.AlbumList.length) {
        await this.ensureLibrary();
        albums = this.state.albums || albums;
      }
      this.set({ albums, songs: new Map(), songsRev: this.state.songsRev + 1, online: true, libraryRev: this.state.libraryRev + 1 });
    } catch (e) {
      this.toast(this.describeError(e), 'error');
    }
  }

  async loadSongs(album: number): Promise<void> {
    if (this.state.songs.has(album)) return;
    try {
      const data = await api.getSongs(album);
      const songs = new Map(this.state.songs);
      songs.set(album, data);
      this.set({ songs, songsRev: this.state.songsRev + 1 });
    } catch (e) {
      this.toast(this.describeError(e), 'error');
    }
  }

  async loadRadioSongs(album: number): Promise<void> {
    if (this.state.radioSongs.has(album)) return;
    try {
      const data = await api.getSongs(album);
      const songs = new Map(this.state.radioSongs);
      songs.set(album, data);
      this.set({ radioSongs: songs, radioSongsRev: this.state.radioSongsRev + 1 });
    } catch (e) {
      this.toast(this.describeError(e), 'error');
    }
  }

  // ---------- playback ----------

  async refreshState(): Promise<void> {
    const player = await api.getState();
    this.set({ player, online: true, radioMode: player.RadioMode, error: '' });
    if (player.RadioMode && Date.now() - this.lastRadioFetch > 5000) {
      await this.refreshRadio();
    }
  }

  private startPolling(): void {
    this.stopPolling();
    void this.poll();
  }

  private stopPolling(): void {
    if (this.pollTimer) window.clearTimeout(this.pollTimer);
    this.pollTimer = undefined;
  }

  private schedule(): void {
    const base = document.hidden ? 5000 : 1000;
    const delay = this.failures ? Math.min(8000, 1000 * 2 ** this.failures) : base;
    this.pollTimer = window.setTimeout(() => void this.poll(), delay);
  }

  private async poll(): Promise<void> {
    if (this.polling) return;
    this.polling = true;
    try {
      await this.refreshState();
      this.failures = 0;
      const player = this.state.player;
      if (
        this.state.deferredLibraryReload &&
        this.state.route.name === 'home' &&
        player && !player.Playing && !player.Paused
      ) {
        this.set({ deferredLibraryReload: false });
        void this.ensureLibrary(false);
      }
    } catch (e) {
      this.failures = Math.min(this.failures + 1, 3);
      const msg = this.describeError(e);
      this.set({ online: false, error: msg });
    } finally {
      this.polling = false;
      this.schedule();
    }
  }

  refreshNow(): void {
    this.stopPolling();
    void this.poll();
  }

  async play(album: number, song: number): Promise<void> {
    this.setBusy(true);
    try {
      const p = this.state.player;
      if (p?.Playing || p?.Paused) {
        const stopped = await api.stop();
        if (stopped.Result && stopped.Result !== 'OK') throw new Error(stopped.Result);
      }
      const r = await api.play(album, song);
      if (r.Result !== 'OK') throw new Error(r.Result);
      await this.refreshState();
      this.refreshNow();
    } catch (e) {
      this.toast(this.describeError(e), 'error');
    } finally {
      this.setBusy(false);
    }
  }

  async togglePlayPause(): Promise<void> {
    const p = this.state.player;
    this.setBusy(true);
    try {
      if (p?.Playing) {
        await api.pause();
      } else if (p?.Paused) {
        await api.pause();
      } else {
        const albums = this.state.albums;
        if (!albums?.Albums.length) throw new Error('没有可播放的专辑');
        const album = p?.Album != null && p.Album >= 0 && p.Album < albums.Albums.length ? p.Album : 0;
        const song = p?.Song != null && p.Song >= 0 ? p.Song : 0;
        const r = await api.play(album, song);
        if (r.Result !== 'OK') throw new Error(r.Result);
      }
      await this.refreshState();
    } catch (e) {
      this.toast(this.describeError(e), 'error');
    } finally {
      this.setBusy(false);
    }
  }

  async stop(): Promise<void> {
    await this.run(() => api.stop());
  }

  async next(): Promise<void> {
    await this.run(() => api.next());
  }

  async prev(): Promise<void> {
    await this.run(() => api.prev());
  }

  async seek(percent: number): Promise<void> {
    const p = clampInt(percent, 0, 100, 0);
    await this.run(() => api.seek(p));
  }

  async setVolume(volume: number): Promise<void> {
    const v = clampInt(volume, 0, 100, 50);
    const p = this.state.player;
    if (p) this.set({ player: { ...p, Volume: v } });
    await this.run(() => api.setVolume(v));
  }

  private async run(fn: () => Promise<{ Result?: string } | unknown>): Promise<void> {
    this.setBusy(true);
    try {
      const r = (await fn()) as { Result?: string };
      if (r && typeof r === 'object' && r.Result && r.Result !== 'OK') throw new Error(r.Result);
      await this.refreshState();
      this.refreshNow();
    } catch (e) {
      this.toast(this.describeError(e), 'error');
    } finally {
      this.setBusy(false);
    }
  }

  // ---------- radio ----------

  async refreshRadio(): Promise<void> {
    try {
      const radio = await api.getRadio();
      const pics = await api.getPictures();
      this.lastRadioFetch = Date.now();
      const urls = (pics.Pics || [])
        .map((u) => {
          try {
            const url = new URL(u, location.href);
            return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : '';
          } catch {
            return '';
          }
        })
        .filter(Boolean);
      this.set({ radioTitle: radio.RadioTitle || '', radioPics: urls });
    } catch {
      /* radio metadata is best-effort */
    }
  }

  private enqueueRadio(fn: () => Promise<void>): Promise<void> {
    const next = this.radioQueue.then(fn, fn);
    this.radioQueue = next.catch(() => undefined);
    return next;
  }

  async enterRadio(): Promise<void> {
    return this.enqueueRadio(async () => {
      if (this.state.route.name !== 'radio') return;
      if (this.state.radioMode) {
        if (!this.state.radioAlbums) {
          try {
            const albums = await api.getAlbums();
            this.set({ radioAlbums: albums, radioLibraryRev: this.state.radioLibraryRev + 1 });
          } catch (e) {
            this.toast(this.describeError(e), 'error');
          }
        }
        return;
      }
      this.set({ radioLoading: true });
      try {
        const albums = await api.radioMode();
        if (!albums.RadioMode) throw new Error('无法进入电台模式');
        this.set({
          radioAlbums: albums,
          radioMode: true,
          radioLoading: false,
          radioCategory: null,
          radioSongs: new Map(),
          radioSongsRev: this.state.radioSongsRev + 1,
          radioLibraryRev: this.state.radioLibraryRev + 1,
          error: '',
        });
        await this.refreshState();
        await this.refreshRadio();
      } catch (e) {
        this.set({ radioLoading: false });
        this.toast(this.describeError(e), 'error');
      }
    });
  }

  async leaveRadio(): Promise<void> {
    return this.enqueueRadio(async () => {
      if (this.state.route.name === 'radio') return;
      if (!this.state.radioMode) {
        this.set({ radioAlbums: null, radioLoading: false });
        return;
      }
      this.set({ radioLoading: true });
      try {
        const albums = await api.radioMode();
        const hasLocal = albums.Albums.length > 0 || albums.AlbumList.length > 0;
        this.set({
          radioMode: false,
          radioAlbums: null,
          radioCategory: null,
          radioSongs: new Map(),
          radioSongsRev: this.state.radioSongsRev + 1,
          radioLoading: false,
          ...(hasLocal ? {
            albums,
            songs: new Map(),
            songsRev: this.state.songsRev + 1,
            libraryRev: this.state.libraryRev + 1,
          } : {}),
        });
        if (!hasLocal) await this.ensureLibrary();
        await this.refreshState();
      } catch (e) {
        this.set({ radioLoading: false });
        this.toast(this.describeError(e), 'error');
      }
    });
  }

  async openQueue(): Promise<void> {
    this.set({ queueOpen: true });
    const radio = this.state.radioMode;
    const albums = radio ? this.state.radioAlbums : this.state.albums;
    if (!albums) return;

    const total = Math.max(albums.AlbumList?.length || 0, albums.Albums?.length || 0);
    let indices: number[];
    if (radio) {
      if (this.state.radioCategory == null) return;
      indices = [this.state.radioCategory];
    } else {
      // Small queues are expanded fully; large libraries load the current album
      // first and let the user expand other albums on demand.
      indices = Array.from({ length: total }, (_, i) => i);
      if (indices.length > 12) {
        const current = this.state.player?.Album;
        indices = current != null && current >= 0 && current < total ? [current] : [];
      }
    }
    if (!indices.length) return;

    const current = this.state.player?.Album;
    if (current != null && indices.includes(current)) {
      indices.splice(indices.indexOf(current), 1);
      indices.unshift(current);
    }

    const source = radio ? this.state.radioSongs : this.state.songs;
    const map = new Map(source);
    this.set({ queueLoading: true });
    try {
      for (const index of indices) {
        if (!this.state.queueOpen || this.state.radioMode !== radio) break;
        if (map.has(index)) continue;
        try {
          const data = await api.getSongs(index);
          if (!this.state.queueOpen || this.state.radioMode !== radio) break;
          map.set(index, data);
          if (radio) {
            this.set({
              radioSongs: new Map(map),
              radioSongsRev: this.state.radioSongsRev + 1,
            });
          } else {
            this.set({
              songs: new Map(map),
              songsRev: this.state.songsRev + 1,
            });
          }
        } catch {
          /* keep the queue usable even if one album cannot be read */
        }
      }
    } finally {
      this.set({ queueLoading: false });
    }
  }

  closeQueue(): void {
    this.set({ queueOpen: false });
  }

  setRadioCategory(index: number | null): void {
    this.set({ radioCategory: index });
    if (index != null) void this.loadRadioSongs(index);
  }

  async favor(): Promise<void> {
    await this.run(() => api.favor());
    this.toast('已收藏当前电台', 'success');
  }

  async addStation(name: string, url: string, folder: string): Promise<boolean> {
    this.setBusy(true);
    try {
      const albums = await api.addStation({ name, url, folder });
      this.set({
        radioAlbums: albums,
        radioSongs: new Map(),
        radioSongsRev: this.state.radioSongsRev + 1,
        radioLibraryRev: this.state.radioLibraryRev + 1,
      });
      this.toast('电台已添加', 'success');
      return true;
    } catch (e) {
      this.toast(this.describeError(e), 'error');
      return false;
    } finally {
      this.setBusy(false);
    }
  }

  async deleteStation(album: number, song: number): Promise<void> {
    this.setBusy(true);
    try {
      const albums = await api.deleteStation(album, song);
      this.set({
        radioAlbums: albums,
        radioSongs: new Map(),
        radioSongsRev: this.state.radioSongsRev + 1,
        radioLibraryRev: this.state.radioLibraryRev + 1,
      });
      this.toast('电台已删除', 'success');
    } catch (e) {
      this.toast(this.describeError(e), 'error');
    } finally {
      this.setBusy(false);
    }
  }

  // ---------- playlists ----------

  async loadPlaylists(): Promise<void> {
    try {
      const playlists = await api.getPlaylists(-1);
      this.set({ playlists });
    } catch (e) {
      this.toast(this.describeError(e), 'error');
    }
  }

  async expandPlaylists(index: number): Promise<void> {
    try {
      const playlists = await api.getPlaylists(index);
      this.set({ playlists });
    } catch (e) {
      this.toast(this.describeError(e), 'error');
    }
  }

  async loadPlaylist(index: number): Promise<void> {
    this.setBusy(true);
    try {
      await api.getPlaylist(index);
      this.set({ activePlaylistIndex: index });
      await sleep(600);
      await this.refreshAlbums();
      if (location.hash !== '#/albums') location.hash = '#/albums';
      this.toast('播放列表已载入', 'success');
    } catch (e) {
      this.toast(this.describeError(e), 'error');
    } finally {
      this.setBusy(false);
    }
  }

  async savePlaylist(name: string): Promise<boolean> {
    const n = name.trim();
    if (!n) {
      this.toast('请输入播放列表名称', 'warn');
      return false;
    }
    this.setBusy(true);
    try {
      const playlists = await api.savePlaylist(n);
      this.set({ playlists });
      this.toast('播放列表已保存', 'success');
      return true;
    } catch (e) {
      this.toast(this.describeError(e), 'error');
      return false;
    } finally {
      this.setBusy(false);
    }
  }

  async deletePlaylist(name: string): Promise<void> {
    this.setBusy(true);
    try {
      const playlists = await api.deletePlaylist(name);
      this.set({ playlists });
      this.toast('播放列表已删除', 'success');
    } catch (e) {
      this.toast(this.describeError(e), 'error');
    } finally {
      this.setBusy(false);
    }
  }

  // ---------- settings ----------

  async saveSettings(patch: Record<string, unknown>): Promise<boolean> {
    const config = this.state.config;
    if (!config) {
      this.toast('配置尚未载入', 'error');
      return false;
    }
    const payload = buildPayload(config, patch);
    const errors = validatePayload(payload);
    if (errors.length) {
      this.toast(errors.slice(0, 3).join('；'), 'error');
      return false;
    }
    this.setBusy(true);
    try {
      const body = await postConfig(payload);
      if (!/saved/i.test(body)) throw new Error(body || '保存失败');
      const after = await api.getConfig();
      for (const key of ['covers', 'root_folder', 'volume_enabled', 'dop_mode', 'pframes']) {
        if (JSON.stringify(after[key]) !== JSON.stringify(payload[key])) {
          throw new Error(`保存后校验失败: ${key}`);
        }
      }
      this.set({ config: after, configRev: this.state.configRev + 1 });
      this.toast('设置已保存', 'success');
      return true;
    } catch (e) {
      this.toast(this.describeError(e), 'error');
      return false;
    } finally {
      this.setBusy(false);
    }
  }

  async selectCard(card: number): Promise<void> {
    this.setBusy(true);
    try {
      await api.selectCard(card);
      await sleep(2000);
      const [config, player] = await Promise.all([api.getConfig(), api.getState()]);
      this.set({ config, player, configRev: this.state.configRev + 1 });
      this.toast('声卡已切换', 'success');
    } catch (e) {
      this.toast(this.describeError(e), 'error');
    } finally {
      this.setBusy(false);
    }
  }

  async updateCatalog(replace: boolean): Promise<void> {
    this.setBusy(true);
    try {
      await api.updateCatalog(replace);
      await sleep(1200);
      if (this.state.radioMode) {
        const albums = await api.getAlbums();
        this.set({
          radioAlbums: albums,
          radioSongs: new Map(),
          radioSongsRev: this.state.radioSongsRev + 1,
          radioLibraryRev: this.state.radioLibraryRev + 1,
        });
      } else {
        await this.refreshAlbums();
      }
      this.toast('电台目录已更新', 'success');
    } catch (e) {
      this.toast(this.describeError(e), 'error');
    } finally {
      this.setBusy(false);
    }
  }

  exportConfig(): void {
    const config = this.state.config;
    if (!config) return;
    const { api_key: _apiKey, api_cx: _apiCx, ...safe } = config;
    const blob = new Blob([JSON.stringify(safe, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `apui-config-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ---------- ui ----------

  setRoute(route: Route): void {
    const prev = this.state.route;
    this.set({ route });
    if (prev.name === 'radio' && route.name !== 'radio' && this.state.radioMode) {
      void this.leaveRadio();
    }
    if (route.name === 'radio') {
      if (this.state.ready) void this.enterRadio();
    }
    if (route.name === 'album' && route.album != null) {
      void this.loadSongs(route.album);
    }
    if (route.name === 'home' && !this.state.radioMode && String(this.state.config?.root_folder || '').trim()) {
      void this.ensureLibrary(false);
    }
  }

  setSearch(search: string): void {
    this.set({ search });
  }

  toggleNowPlaying(open?: boolean): void {
    this.set({ nowPlayingOpen: open ?? !this.state.nowPlayingOpen });
  }

  toast(text: string, kind: ToastKind = 'info'): void {
    if (!text) return;
    if (this.toastTimer) window.clearTimeout(this.toastTimer);
    const id = Date.now();
    this.set({ toast: { id, text, kind } });
    this.toastTimer = window.setTimeout(() => {
      if (this.state.toast?.id === id) this.set({ toast: null });
    }, 3200);
  }
}

export const store = new Store();
