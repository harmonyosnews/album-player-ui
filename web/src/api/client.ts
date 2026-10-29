import type {
  AlbumsResponse,
  AplayerState,
  Config,
  PathResponse,
  PicturesResponse,
  PlaylistsResponse,
  RadioResponse,
  ResultResponse,
  SongsResponse,
} from './types';

const API_BASE = import.meta.env.DEV ? '/ap' : '';
const IMG_TS = Date.now();

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status?: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

let chain: Promise<unknown> = Promise.resolve();

function serialize<T>(fn: () => Promise<T>): Promise<T> {
  const next = chain.then(fn, fn);
  chain = next.catch(() => undefined);
  return next;
}

async function request<T>(
  path: string,
  init: RequestInit,
  parse: 'json' | 'text',
  timeoutMs = 8000,
): Promise<T> {
  return serialize(async () => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      let res: Response;
      try {
        res = await fetch(`${API_BASE}${path}`, {
          cache: 'no-store',
          signal: controller.signal,
          ...init,
        });
      } catch {
        throw new ApiError('NETWORK', '无法连接播放器');
      }
      const text = await res.text();
      if (res.status === 404) throw new ApiError('NOT_FOUND', text.slice(0, 300), 404);
      if (!res.ok) throw new ApiError(`HTTP_${res.status}`, text.slice(0, 300), res.status);
      if (parse === 'text') return text as T;
      try {
        return JSON.parse(text) as T;
      } catch {
        throw new ApiError('BAD_JSON', text.slice(0, 300), res.status);
      }
    } finally {
      window.clearTimeout(timer);
    }
  });
}

function getJson<T>(query: string, timeoutMs = 8000): Promise<T> {
  return request<T>(`/?${query}`, { method: 'GET' }, 'json', timeoutMs);
}

function postJson<T>(query: string, body: unknown): Promise<T> {
  return request<T>(
    `/?${query}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
    'json',
  );
}

export async function postConfig(payload: Record<string, unknown>): Promise<string> {
  return request<string>(
    '/SetConfig',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
    'text',
    10000,
  );
}

export function imageUrl(albumIndex: number, cacheBust: number = IMG_TS): string {
  return `${API_BASE}/?GetImage&pl=0&image=${albumIndex}&time=${cacheBust}`;
}

export const api = {
  getConfig: () => getJson<Config>('GetConfig'),
  getAlbums: () => getJson<AlbumsResponse>('GetAlbums', 12000),
  getSongs: (album: number) => getJson<SongsResponse>(`GetSongs&album=${album}`),
  getState: () => getJson<AplayerState>('State', 5000),
  play: (album: number, song: number) => getJson<ResultResponse>(`Play&album=${album}&song=${song}`),
  stop: () => getJson<ResultResponse>('Stop'),
  pause: () => getJson<ResultResponse>('Pause'),
  next: () => getJson<ResultResponse>('Next'),
  prev: () => getJson<ResultResponse>('Prev'),
  seek: (percent: number) => getJson<ResultResponse>(`Position&pos=${percent}`),
  setVolume: (volume: number) => getJson<ResultResponse>(`SetVolume&volume=${volume}`),
  getPlaylists: (ind: number) => getJson<PlaylistsResponse>(`GetPlaylists&ind=${ind}`),
  getPlaylist: (index: number) => getJson<ResultResponse>(`GetPlaylist&playlist=${index}`),
  savePlaylist: (name: string) => getJson<PlaylistsResponse>(`SavePlaylist&name=${encodeURIComponent(name)}`),
  deletePlaylist: (name: string) => getJson<PlaylistsResponse>(`DeletePlaylist&name=${encodeURIComponent(name)}`),
  radioMode: () => getJson<AlbumsResponse>('RadioMode', 12000),
  getRadio: () => getJson<RadioResponse>('GetRadio'),
  getPictures: () => getJson<PicturesResponse>('GetPictures'),
  favor: () => getJson<ResultResponse>('Favor'),
  getPath: (album: number, song: number) => getJson<PathResponse>(`GetPath&album=${album}&song=${song}`),
  addStation: (body: { url: string; name: string; folder: string }) =>
    postJson<AlbumsResponse>('AddStation', body),
  deleteStation: (album: number, song: number) =>
    getJson<AlbumsResponse>(`DeleteStation&album=${album}&song=${song}`),
  selectCard: (card: number) => getJson<unknown>(`SelectCard&card=${card}`),
  updateCatalog: (replace: boolean) => getJson<unknown>(replace ? 'Update1' : 'Update0'),
};
