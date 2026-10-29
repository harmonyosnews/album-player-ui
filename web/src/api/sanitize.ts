export interface FormatState {
  Freq: number;
  Bps: number;
  Ch: number;
  Bitrate: number;
}

export function htmlToText(input: unknown): string {
  if (input == null) return '';
  const text = String(input);
  if (!/[<&]/.test(text)) return text.trim();
  const doc = new DOMParser().parseFromString(text, 'text/html');
  return (doc.body.textContent || '').replace(/\s+/g, ' ').trim();
}

export function safeUrl(raw: unknown, base = location.href): string | null {
  if (raw == null) return null;
  try {
    const u = new URL(String(raw), base);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : null;
  } catch {
    return null;
  }
}

export function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

export function cleanDisplayName(value: unknown): string {
  return htmlToText(value).replace(/\s+/g, ' ').trim();
}

export function stripAlbumSuffix(value: string): string {
  return cleanDisplayName(value)
    .replace(/\s*\[(?:\d+:)?\d{1,3}:\d{2}\]\s*(?:flac|wav|ape|wv|m4a|aac|ogg|mp3|dff|dsf|rad|m3u)?\s*$/i, '')
    .trim();
}

export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '0:00';
  const total = Math.round(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}

export function formatFreq(hz: number): string {
  if (!Number.isFinite(hz) || hz <= 0) return '';
  if (hz >= 1_000_000) return `${(hz / 1_000_000).toFixed(1)}MHz`;
  return `${(hz / 1000).toFixed(hz % 1000 === 0 ? 0 : 1)}kHz`;
}

export function formatFormat(state: FormatState): string {
  const parts: string[] = [];
  const f = formatFreq(state.Freq);
  if (f) parts.push(f);
  if (state.Bps > 0) parts.push(`${state.Bps}bit`);
  if (state.Ch > 0) parts.push(`${state.Ch}ch`);
  if (state.Bitrate > 0) parts.push(`${state.Bitrate}kbps`);
  return parts.join(' / ');
}

export function initials(name: string): string {
  const t = cleanDisplayName(name);
  if (!t) return '?';
  const parts = t.split(/\s+/);
  if (parts.length > 1) return (parts[0][0] + parts[1][0]).toUpperCase();
  return t.slice(0, 2).toUpperCase();
}
