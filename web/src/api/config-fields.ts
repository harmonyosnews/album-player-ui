import type { Config } from './types';

export const WRITABLE_FIELDS = [
  'covers', 'gapless_mode', 'preload_mode', 'di_mode', 'pframes', 'bframes',
  'pmks', 'bmks', 'mode_16bit', 'mode_24bit', 'dop_mode', 'pcm_freq',
  'dsd_limit', 'dsd_pcm', 'dsd_vol', 'dsd_area', 'sacd_full', 'dvda_area',
  'dvda_nomix', 'pcm_mult', 'volume_enabled', 'auto_mode', 'cue_mode',
  'tags_mode', 'lock_memory', 'priority', 'nice', 'affinity_mode',
  'multi_mode', 'swap_mode', 'phase_mode', 'res_bf44', 'res44', 'res48',
  'res88', 'res96', 'res176', 'res192', 'res352', 'res384', 'soxr_phase',
  'soxr_filter', 'soxr_quality', 'radio_pict', 'radio_proxy', 'radio_proxy2',
  'radio_ua', 'radio_user', 'std_buffer', 'si_time', 'mmap', 'enable_dsd',
  'filter', 'output', 'rate', 'level', 'multithread', 'root_folder',
  'use_conv', 'conv_filter', 'conv_db', 'hw_index', 'hw_volume', 'att',
  'win1251', 'num_pics', 'api_flag', 'api_add', 'radio_auto', 'a_color',
  't_color', 'i_color', 'ai_color', 'ti_color', 'yi_color', 'ar_color',
  'ch_scr', 'ch_tcp', 'ip_scr', 'pt_scr',
] as const;

export type WritableField = typeof WRITABLE_FIELDS[number];

export function buildPayload(config: Config, patch: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of WRITABLE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(patch, key)) out[key] = patch[key];
    else if (Object.prototype.hasOwnProperty.call(config, key)) out[key] = config[key];
  }
  return out;
}

function int(p: Record<string, unknown>, key: string, min: number, max: number, errors: string[]): void {
  const v = p[key];
  if (!Number.isInteger(v) || (v as number) < min || (v as number) > max) {
    errors.push(`${key} 必须是 ${min}..${max} 的整数`);
  }
}

export function validatePayload(p: Record<string, unknown>): string[] {
  const errors: string[] = [];
  int(p, 'pframes', 1, 1_000_000, errors);
  int(p, 'bframes', 1, 10_000_000, errors);
  int(p, 'num_pics', 1, 10, errors);
  int(p, 'pt_scr', 1, 65535, errors);
  int(p, 'std_buffer', 16384, 8_388_608, errors);
  int(p, 'si_time', 0, 60_000, errors);
  int(p, 'priority', 0, 99, errors);
  int(p, 'nice', -20, 19, errors);
  int(p, 'att', -120, 0, errors);

  const enums: Record<string, number[]> = {
    di_mode: [0, 1, 2],
    affinity_mode: [0, 1, 2],
    mmap: [0, 1],
    dop_mode: [0, 1, 2],
    dsd_limit: [0, 1, 2, 3],
    pcm_freq: [0, 1, 2, 3],
    enable_dsd: [0, 1],
    multithread: [0, 1],
    win1251: [0, 1],
    api_flag: [0, 1],
    radio_auto: [0, 1],
  };
  for (const [key, allowed] of Object.entries(enums)) {
    if (!allowed.includes(p[key] as number)) errors.push(`${key} 必须是 ${allowed.join('/')} 之一`);
  }

  if (typeof p.covers !== 'string' || !p.covers.trim()) errors.push('covers 不能为空');
  if (typeof p.root_folder !== 'string') errors.push('root_folder 必须是字符串');
  if (typeof p.api_add !== 'string') errors.push('api_add 必须是字符串');
  return errors;
}

export function normaliseRoot(value: string): string {
  return value.replace(/^\/+|\/+$/g, '').toLowerCase();
}
