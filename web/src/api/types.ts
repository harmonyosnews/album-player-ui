export interface AplayerState {
  Playing: boolean;
  Paused: boolean;
  ProgressVisible: boolean;
  Volume: number;
  Album: number;
  Song: number;
  Bitrate: number;
  Bps: number;
  Ch: number;
  Position: number;
  Freq: number;
  PlayingLen: number;
  PlayingName: string;
  RadioTitle: string;
  RadioMode: boolean;
  RadioPictures: boolean;
  LastError: string;
  Scanning: boolean;
}

export interface SongsBlock {
  Songs: string[];
  SongsLen?: number[];
}

export interface AlbumsResponse {
  Albums: string[];
  AlbumList: string[];
  AuthorList: string[];
  YearList: string[];
  Songs: SongsBlock[];
  Playlists: string[];
  SavedAlbumIndex: number;
  SavedSongIndex: number;
  RadioMode: boolean;
}

export interface SongsResponse {
  Songs?: string[];
  SongsLen?: number[];
}

export interface ResultResponse {
  Result: string;
}

export interface DriveEntry {
  path: string;
  name: string;
  level: number;
  expanded: number;
}

export interface PlaylistsResponse {
  Playlists: string[];
  Drives: DriveEntry[];
}

export interface RadioResponse {
  RadioTitle: string;
}

export interface PicturesResponse {
  Pics?: string[];
}

export interface PathResponse {
  Path: string;
}

export type Config = Record<string, unknown> & {
  covers?: string;
  root_folder?: string;
  volume_enabled?: boolean;
  hw_volume?: boolean;
  cards?: string[];
  hw_list?: string[];
  stat_root?: number;
  stat_playing?: number;
  stat_source?: string;
  stat_output?: string;
  stat_cpus?: string;
  stat_nice?: number;
  stat_prio?: number;
  stat_16bit?: number;
  stat_24bit?: number;
  stat_32bit?: number;
  stat_dsd32be?: number;
  stat_dsd32le?: number;
  asound?: string[];
  num_pics?: number;
  api_flag?: number;
  api_add?: string;
  radio_auto?: number;
  radio_pict?: boolean;
};

export interface AlbumVM {
  index: number;
  name: string;
  artist: string;
  year: string;
  display: string;
  cover: string;
  tracks?: string[];
  lengths?: number[];
}

export interface PlayerVM {
  playing: boolean;
  paused: boolean;
  volume: number;
  album: number;
  song: number;
  title: string;
  radioTitle: string;
  positionMs: number;
  durationMs: number;
  bitrate: number;
  bits: number;
  channels: number;
  freqHz: number;
  progressVisible: boolean;
  radioMode: boolean;
  lastError: string;
  scanning: boolean;
}

export type ToastKind = 'info' | 'success' | 'error' | 'warn';
