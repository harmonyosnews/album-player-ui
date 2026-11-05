import { api, ApiError, bumpImageCache, postConfig } from '../api/client';
import { buildPayload, normalizeConfigValue, normaliseRoot, validatePayload } from '../api/config-fields';
import { clampInt, cleanDisplayName } from '../api/sanitize';
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
  queueCleared: boolean;
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
  scanRev: number;
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
    queueCleared: false,
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
    scanRev: 0,
  };

  private listeners = new Set<Listener>();
  private pollTimer: number | undefined;
  private polling = false;
  private failures = 0;
  private lastRadioFetch = 0;
  private toastTimer: number | undefined;
  private radioQueue: Promise<void> = Promise.resolve();
  private libraryQueue: Promise<unknown> = Promise.resolve();
  private scanRefreshPending = false;

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
        if (player.Scanning) await this.waitForScan();
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

  // ---------- scanning ----------

  /**
   * aplayer 在 GetPlaylist 后异步扫描目录，扫描完成前 GetAlbums 可能为空或仍是旧列表。
   * 原版 UI 会轮询 State.Scanning 并在扫描结束后再取专辑；这里保持同样的时序。
   */
  private async waitForScan(timeoutMs = 60000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    let player: AplayerState;
    try {
      player = await api.getState();
    } catch {
      return;
    }
    this.set({ player, online: true, radioMode: player.RadioMode, error: '' });
    while (player.Scanning && Date.now() < deadline) {
      await sleep(250);
      try {
        player = await api.getState();
      } catch {
        return;
      }
      this.set({ player, online: true, radioMode: player.RadioMode, error: '' });
    }
  }

  private async fetchAlbumsAfterScan(): Promise<AlbumsResponse> {
    // 先读一次 State：GetPlaylist 返回时扫描可能刚开始，state 里还没有 Scanning=true。
    await this.waitForScan();
    let albums = await api.getAlbums();
    if (!albums.Albums.length && !albums.AlbumList.length) {
      await sleep(350);
      albums = await api.getAlbums();
    }
    return albums;
  }

  /** 扫描结束后刷新当前曲库视图，并丢弃扫描过程中缓存的旧曲目。 */
  private async handleScanComplete(): Promise<void> {
    if (this.scanRefreshPending) return;
    this.scanRefreshPending = true;
    try {
      let albums = await api.getAlbums();
      if (!albums.Albums.length && !albums.AlbumList.length) {
        await sleep(350);
        albums = await api.getAlbums();
      }
      if (!albums.Albums.length && !albums.AlbumList.length) return;
      if (this.state.radioMode) {
        this.set({
          radioAlbums: albums,
          radioSongs: new Map(),
          radioSongsRev: this.state.radioSongsRev + 1,
          radioLibraryRev: this.state.radioLibraryRev + 1,
          scanRev: this.state.scanRev + 1,
          online: true,
        });
      } else {
        this.set({
          albums,
          songs: new Map(),
          songsRev: this.state.songsRev + 1,
          libraryRev: this.state.libraryRev + 1,
          scanRev: this.state.scanRev + 1,
          online: true,
        });
      }
    } catch {
      /* keep the previous view if the refresh fails */
    } finally {
      this.scanRefreshPending = false;
    }
  }

  private async fetchSongs(album: number): Promise<SongsResponse> {
    const rev = this.state.scanRev;
    if (this.state.player?.Scanning) await this.waitForScan();
    let data = await api.getSongs(album);
    if (rev !== this.state.scanRev) {
      // 扫描在请求期间结束，重新读取，避免把扫描中的整轨 WAV 当成最终曲目
      await this.waitForScan();
      data = await api.getSongs(album);
    } else if (this.state.player?.Scanning) {
      await this.waitForScan();
      data = await api.getSongs(album);
    }
    if (!data.Songs?.length) {
      await sleep(300);
      const retry = await api.getSongs(album);
      if (retry.Songs?.length) data = retry;
    }
    return data;
  }

  // ---------- library ----------

  /** 串行化目录载入，避免首页自动载入和用户点“载入”互相覆盖。 */
  private enqueueLibrary<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.libraryQueue.then(fn, fn);
    this.libraryQueue = next.catch(() => undefined);
    return next;
  }

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
    return this.enqueueLibrary(() => this.ensureLibraryNow(force));
  }

  private async ensureLibraryNow(force = false): Promise<boolean> {
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
      const result = await api.getPlaylist(idx);
      if (result.Result !== 'OK') return false;
      const albums = await this.fetchAlbumsAfterScan();
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
    } catch (e) {
      this.toast(this.describeError(e), 'error');
      return false;
    } finally {
      this.set({ libraryLoading: false });
    }
  }

  async refreshAlbums(): Promise<void> {
    try {
      if (this.state.player?.Scanning) await this.waitForScan();
      let albums = await api.getAlbums();
      if (this.state.radioMode) {
        this.set({ radioAlbums: albums, radioLibraryRev: this.state.radioLibraryRev + 1, online: true });
        return;
      }
      if (!albums.Albums.length && !albums.AlbumList.length) {
        if (this.state.route.name === 'home') {
          await this.ensureLibrary();
          albums = this.state.albums || albums;
        }
      }
      this.set({ albums, songs: new Map(), songsRev: this.state.songsRev + 1, online: true, libraryRev: this.state.libraryRev + 1 });
    } catch (e) {
      this.toast(this.describeError(e), 'error');
    }
  }

  async loadSongs(album: number): Promise<void> {
    if (this.state.songs.has(album)) return;
    try {
      const data = await this.fetchSongs(album);
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
      const data = await this.fetchSongs(album);
      const songs = new Map(this.state.radioSongs);
      songs.set(album, data);
      this.set({ radioSongs: songs, radioSongsRev: this.state.radioSongsRev + 1 });
    } catch (e) {
      this.toast(this.describeError(e), 'error');
    }
  }

  // ---------- playback ----------

  async refreshState(): Promise<void> {
    const wasScanning = !!this.state.player?.Scanning;
    const player = await api.getState();
    this.set({ player, online: true, radioMode: player.RadioMode, error: '' });
    if (wasScanning && !player.Scanning) void this.handleScanComplete();
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
    this.set({ queueCleared: false });
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
        this.set({ queueCleared: false });
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
        bumpImageCache();
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
        bumpImageCache();
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
    if (this.state.queueCleared && !this.state.radioMode) return;
    const radio = this.state.radioMode;
    const albums = radio ? this.state.radioAlbums : this.state.albums;
    if (!albums) return;

    const total = Math.max(albums.AlbumList?.length || 0, albums.Albums?.length || 0);
    let indices: number[];
    if (radio) {
      if (this.state.radioCategory == null) return;
      indices = [this.state.radioCategory];
    } else {
      // Match the official UI: only the currently playing album is loaded.
      // Other albums stay as headers and load their tracks on demand.
      const current = this.state.player?.Album;
      indices = current != null && current >= 0 && current < total ? [current] : [];
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

  async clearQueue(): Promise<void> {
    if (!confirm('清空当前播放队列并停止播放？不会修改曲库或删除音乐文件。')) return;
    this.setBusy(true);
    try {
      await api.stop();
      this.set({
        queueCleared: true,
        queueOpen: false,
        songs: new Map(),
        songsRev: this.state.songsRev + 1,
        deferredLibraryReload: false,
      });
      await this.refreshState();
      this.toast('播放队列已清空，曲库未改动', 'success');
    } catch (e) {
      this.toast(this.describeError(e), 'error');
    } finally {
      this.setBusy(false);
    }
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

  async expandPlaylists(index: number, path = ''): Promise<void> {
    try {
      let target = index;
      if (path) {
        const fresh = await api.getPlaylists(-1);
        const match = fresh.Drives.map((drive, i) => ({ drive, i })).find(({ drive }) => drive.path === path);
        if (!match) {
          this.set({ playlists: fresh });
          this.toast('目录已变化，已刷新文件浏览', 'warn');
          return;
        }
        target = match.i;
      }
      const playlists = await api.getPlaylists(target);
      this.set({ playlists });
    } catch (e) {
      this.toast(this.describeError(e), 'error');
    }
  }

  async loadPlaylist(index: number, path = '', name = ''): Promise<void> {
    return this.enqueueLibrary(() => this.loadPlaylistNow(index, path, name));
  }

  private async loadPlaylistNow(index: number, path: string, name: string): Promise<void> {
    this.setBusy(true);
    try {
      // 树索引会随展开/折叠变化；点击时按路径重新解析，避免载入相邻目录。
      let target = index;
      let pl: PlaylistsResponse | null = null;
      try {
        pl = await api.getPlaylists(-1);
        this.set({ playlists: pl });
      } catch {
        /* fall back to the rendered index */
      }
      if (pl) {
        const entries = pl.Drives.map((drive, i) => ({ drive, i }));
        if (path) {
          const match = entries.find(({ drive }) => drive.path === path);
          if (!match) throw new Error('目录已变化，请刷新文件浏览后重试');
          target = match.i;
        } else if (name) {
          const match = entries.find(({ drive }) => drive.path === '' && drive.name === name);
          if (!match) throw new Error('列表已变化，请刷新后重试');
          target = match.i;
        }
        if (target < 0 || target >= pl.Drives.length) throw new Error('目录已变化，请刷新文件浏览后重试');
      } else if (path || name) {
        throw new Error('无法读取目录，请稍后重试');
      }
      const result = await api.getPlaylist(target);
      if (result.Result !== 'OK') throw new Error(result.Result || '载入失败');
      this.set({ activePlaylistIndex: target, libraryRootIndex: null });
      const albums = await this.fetchAlbumsAfterScan();
      bumpImageCache();
      this.set({
        albums,
        songs: new Map(),
        songsRev: this.state.songsRev + 1,
        libraryRev: this.state.libraryRev + 1,
        online: true,
        deferredLibraryReload: false,
      });
      if (!albums.Albums.length && !albums.AlbumList.length) {
        this.toast('该目录没有可播放的专辑', 'warn');
      } else {
        this.toast('播放列表已载入', 'success');
      }
      if (location.hash !== '#/albums') location.hash = '#/albums';
    } catch (e) {
      this.toast(this.describeError(e), 'error');
    } finally {
      this.setBusy(false);
    }
  }

  /**
   * 用于 WAV+CUE 专辑只显示整轨时的修复：打开 cue_mode 会改变后续扫描结果，
   * 必须重新 GetPlaylist 触发扫描，单靠刷新 GetAlbums 不会重新分轨。
   */
  async enableCueAndReload(albumIndex: number, albumName: string): Promise<void> {
    const ok = await this.saveSettings({ cue_mode: true });
    if (!ok) return;
    const idx = this.state.activePlaylistIndex;
    if (idx == null) {
      this.toast('已启用“使用 .cue”，请重新载入该专辑目录', 'success');
      return;
    }
    await this.loadPlaylist(idx);
    const albums = this.state.albums;
    if (!albums) return;
    const n = Math.max(albums.AlbumList?.length || 0, albums.Albums?.length || 0);
    let target = albumIndex >= 0 && albumIndex < n ? albumIndex : -1;
    if (target < 0) {
      for (let i = 0; i < n; i++) {
        const name = cleanDisplayName(albums.AlbumList?.[i] || albums.Albums?.[i] || '');
        if (name === albumName) {
          target = i;
          break;
        }
      }
    }
    if (target >= 0) location.hash = `#/album/${target}`;
    this.toast('已启用“使用 .cue”并重新载入', 'success');
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
      for (const key of ['covers', 'root_folder', 'volume_enabled', 'dop_mode', 'pframes', 'cue_mode', 'tags_mode', 'ch_scr', 'ch_tcp']) {
        const expected = normalizeConfigValue(key, payload[key]);
        const actual = normalizeConfigValue(key, after[key]);
        if (JSON.stringify(expected) !== JSON.stringify(actual)) {
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
      await this.waitForScan(60000);
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
