import type { Config } from '../api/types';
import type { AppState } from '../store';
import { store } from '../store';
import { checkbox, numberInput, select, settingRow, statRow, textInput } from '../ui/components';
import { el, svgIcon } from '../ui/dom';

type MainTab = 'general' | 'decoder' | 'dsp' | 'system' | 'status' | 'card' | 'about';
type SubTab = 'dsd' | 'dvda' | 'radio' | 'converter' | 'resampler' | 'convolver';
type Kind = 'bool' | 'intbool' | 'int' | 'string' | 'select' | 'hw_index' | 'range10';

interface FieldSpec {
  key: string;
  label: string;
  kind: Kind;
  tab: MainTab;
  sub?: SubTab;
  group?: string;
  hint?: string;
  min?: number;
  max?: number;
  options?: Array<{ value: string; label: string }>;
}

interface FieldControl {
  node: HTMLElement;
  get: () => unknown;
}

const MAIN_TABS: Array<{ id: MainTab; label: string; icon: string }> = [
  { id: 'general', label: 'General', icon: 'sliders' },
  { id: 'decoder', label: 'Decoder', icon: 'disc' },
  { id: 'dsp', label: 'DSP', icon: 'wave' },
  { id: 'system', label: 'System', icon: 'settings' },
  { id: 'status', label: 'Status', icon: 'info' },
  { id: 'card', label: 'Card', icon: 'volume' },
  { id: 'about', label: 'About', icon: 'info' },
];

const SUB_TABS: Partial<Record<MainTab, Array<{ id: SubTab; label: string }>>> = {
  decoder: [
    { id: 'dsd', label: 'DSD' },
    { id: 'dvda', label: 'DVD-A' },
    { id: 'radio', label: 'Radio' },
  ],
  dsp: [
    { id: 'converter', label: 'Converter' },
    { id: 'resampler', label: 'Resampler' },
    { id: 'convolver', label: 'Convolver' },
  ],
};

const DI_MODE = [
  { value: '0', label: 'Standard' },
  { value: '1', label: 'Direct Input' },
  { value: '2', label: 'Full Memory' },
];
const MMAP = [
  { value: '1', label: 'MMAP mode' },
  { value: '0', label: 'RW mode' },
];
const AFFINITY = [
  { value: '0', label: 'Without selecting cores' },
  { value: '1', label: 'Single Core' },
  { value: '2', label: 'Double Core' },
];
const DOP = [
  { value: '0', label: 'PCM' },
  { value: '1', label: 'DoP' },
  { value: '2', label: 'Native DSD' },
];
const DSD_LIMIT = [
  { value: '0', label: 'DSD64' },
  { value: '1', label: 'DSD128' },
  { value: '2', label: 'DSD256' },
  { value: '3', label: 'DSD512' },
];
const PCM_FREQ = [
  { value: '0', label: '44100' },
  { value: '1', label: '88200' },
  { value: '2', label: '176400' },
  { value: '3', label: '352800' },
];
const DSD_VOL = [0, 1, 2, 3, 4, 5, 6].map((v) => ({ value: String(v), label: `+${v}dB` }));
const DSD_PCM = [
  { value: '0', label: 'Multistage' },
  { value: '1', label: 'Direct' },
  { value: '2', label: 'FIR 30KHz' },
  { value: '3', label: 'FIR 40KHz' },
  { value: '4', label: 'FIR 50KHz' },
  { value: '5', label: 'FIR 60KHz' },
  { value: '6', label: 'FIR S-Audio Systems' },
];
const AREA = [
  { value: '0', label: 'None' },
  { value: '1', label: 'Stereo' },
  { value: '2', label: 'Multichannel' },
];
const DSD_FILTER = [
  ['0', 'clans-4'], ['1', 'clans-5'], ['2', 'clans-6'], ['3', 'clans-7'], ['4', 'clans-8'],
  ['5', 'sdm-4'], ['6', 'sdm-5'], ['7', 'sdm-6'], ['8', 'sdm-7'], ['9', 'sdm-8'],
].map(([value, label]) => ({ value, label }));
const DSD_OUTPUT = [
  { value: '0', label: 'DoP' },
  { value: '1', label: 'Native' },
];
const DSD_RATE = [
  { value: '0', label: 'DSD64' },
  { value: '1', label: 'DSD128' },
  { value: '2', label: 'DSD256' },
];
const DSD_LEVEL = [
  { value: '0', label: '0dB' },
  { value: '1', label: '-6dB' },
];
const SOXR_PHASE = [
  { value: '0', label: 'Minimum phase' },
  { value: '1', label: 'Intermediate phase' },
  { value: '2', label: 'Linear phase' },
];
const RATE_LABELS = ['original', '44.1 KHz', '48 KHz', '88.2 KHz', '96 KHz', '176.4 KHz', '192 KHz', '352.8 KHz', '384 KHz', '705.6 KHz', '768 KHz'];
const RATE_VALUES = RATE_LABELS.map((label, value) => ({ value: String(value), label }));
const rateOptions = (except: number) => RATE_VALUES.filter((o) => Number(o.value) !== except);

const FIELDS: FieldSpec[] = [
  // General
  { key: 'covers', label: 'Cover folders', kind: 'string', tab: 'general', group: 'Library & Output' },
  { key: 'root_folder', label: 'Root folder', kind: 'string', tab: 'general', group: 'Library & Output', hint: 'aplayer 可访问的目录；不以 / 开头或结尾' },
  { key: 'si_time', label: 'Play silence (ms)', kind: 'int', tab: 'general', group: 'Library & Output', min: 0, max: 60000 },
  { key: 'mode_16bit', label: '16 bit output', kind: 'bool', tab: 'general', group: 'Library & Output' },
  { key: 'mode_24bit', label: '24 bit output', kind: 'bool', tab: 'general', group: 'Library & Output' },
  { key: 'di_mode', label: 'Playback mode', kind: 'select', tab: 'general', group: 'Playback', options: DI_MODE },
  { key: 'std_buffer', label: 'Preload buffer (frames)', kind: 'int', tab: 'general', group: 'Playback', min: 16384, max: 8388608, hint: '16384–8388608' },
  { key: 'gapless_mode', label: 'Gapless mode', kind: 'bool', tab: 'general', group: 'Playback' },
  { key: 'preload_mode', label: 'Full preloading', kind: 'bool', tab: 'general', group: 'Playback' },
  { key: 'volume_enabled', label: 'Enable volume control', kind: 'bool', tab: 'general', group: 'Volume' },
  { key: 'hw_volume', label: 'HW volume', kind: 'bool', tab: 'general', group: 'Volume' },
  { key: 'hw_index', label: 'HW parameter', kind: 'hw_index', tab: 'general', group: 'Volume' },
  { key: 'auto_mode', label: 'Auto move to next album', kind: 'bool', tab: 'general', group: 'Library Options' },
  { key: 'cue_mode', label: 'Use .cue', kind: 'bool', tab: 'general', group: 'Library Options' },
  { key: 'tags_mode', label: 'Use tags', kind: 'bool', tab: 'general', group: 'Library Options' },
  { key: 'win1251', label: 'Windows-1251 tags', kind: 'intbool', tab: 'general', group: 'Library Options' },
  { key: 'pframes', label: 'ALSA Period (frames)', kind: 'int', tab: 'general', group: 'ALSA', min: 1, max: 1000000 },
  { key: 'pmks', label: 'ALSA Period (µs)', kind: 'int', tab: 'general', group: 'ALSA', min: -1, max: 1000000 },
  { key: 'bframes', label: 'ALSA Buffer (frames)', kind: 'int', tab: 'general', group: 'ALSA', min: 1, max: 10000000 },
  { key: 'bmks', label: 'ALSA Buffer (µs)', kind: 'int', tab: 'general', group: 'ALSA', min: -1, max: 1000000 },
  { key: 'mmap', label: 'Buffer Access', kind: 'select', tab: 'general', group: 'ALSA', options: MMAP },

  // Decoder → DSD
  { key: 'dop_mode', label: 'DSD output mode', kind: 'select', tab: 'decoder', sub: 'dsd', options: DOP },
  { key: 'dsd_limit', label: 'DSD Mode limit', kind: 'select', tab: 'decoder', sub: 'dsd', options: DSD_LIMIT },
  { key: 'pcm_freq', label: 'PCM samplerate', kind: 'select', tab: 'decoder', sub: 'dsd', options: PCM_FREQ },
  { key: 'dsd_vol', label: 'PCM Volume', kind: 'select', tab: 'decoder', sub: 'dsd', options: DSD_VOL },
  { key: 'pcm_mult', label: 'PCM for multichannel', kind: 'bool', tab: 'decoder', sub: 'dsd' },
  { key: 'sacd_full', label: 'Full disk mode', kind: 'bool', tab: 'decoder', sub: 'dsd' },
  { key: 'dsd_pcm', label: 'DSD to PCM converter', kind: 'select', tab: 'decoder', sub: 'dsd', options: DSD_PCM },
  { key: 'dsd_area', label: 'Preferable Area', kind: 'select', tab: 'decoder', sub: 'dsd', options: AREA },

  // Decoder → DVD-A
  { key: 'dvda_nomix', label: "Don't load stereo downmixes", kind: 'bool', tab: 'decoder', sub: 'dvda' },
  { key: 'dvda_area', label: 'Preferable Mode', kind: 'select', tab: 'decoder', sub: 'dvda', options: AREA },

  // Decoder → Radio
  { key: 'radio_pict', label: 'Load pictures', kind: 'bool', tab: 'decoder', sub: 'radio' },
  { key: 'num_pics', label: 'Pictures count (1–10)', kind: 'int', tab: 'decoder', sub: 'radio', min: 1, max: 10 },
  { key: 'api_flag', label: 'query with', kind: 'intbool', tab: 'decoder', sub: 'radio' },
  { key: 'api_add', label: 'Query text', kind: 'string', tab: 'decoder', sub: 'radio', hint: '例如 album cover' },
  { key: 'radio_auto', label: 'Autoplay', kind: 'intbool', tab: 'decoder', sub: 'radio' },
  { key: 'radio_proxy', label: 'Use proxy server', kind: 'bool', tab: 'decoder', sub: 'radio' },
  { key: 'radio_proxy2', label: 'Proxy address', kind: 'string', tab: 'decoder', sub: 'radio', hint: '[user:pass@]server:port' },
  { key: 'radio_ua', label: 'Custom User-Agent', kind: 'bool', tab: 'decoder', sub: 'radio' },
  { key: 'radio_user', label: 'User-Agent', kind: 'string', tab: 'decoder', sub: 'radio' },

  // DSP → Converter
  { key: 'multi_mode', label: 'Convert multichannel to stereo', kind: 'bool', tab: 'dsp', sub: 'converter' },
  { key: 'swap_mode', label: 'Swap channels (stereo)', kind: 'bool', tab: 'dsp', sub: 'converter' },
  { key: 'phase_mode', label: 'Invert phase', kind: 'bool', tab: 'dsp', sub: 'converter' },
  { key: 'enable_dsd', label: 'Convert PCM to DSD (Mans Rullgard)', kind: 'intbool', tab: 'dsp', sub: 'converter' },
  { key: 'filter', label: 'Filter', kind: 'select', tab: 'dsp', sub: 'converter', options: DSD_FILTER },
  { key: 'output', label: 'Output', kind: 'select', tab: 'dsp', sub: 'converter', options: DSD_OUTPUT },
  { key: 'rate', label: 'Rate', kind: 'select', tab: 'dsp', sub: 'converter', options: DSD_RATE },
  { key: 'level', label: 'Level', kind: 'select', tab: 'dsp', sub: 'converter', options: DSD_LEVEL },
  { key: 'multithread', label: 'Multi-thread mode', kind: 'intbool', tab: 'dsp', sub: 'converter' },

  // DSP → Resampler
  { key: 'res_bf44', label: '< 44 KHz', kind: 'select', tab: 'dsp', sub: 'resampler', options: RATE_VALUES },
  { key: 'res44', label: '44.1 KHz', kind: 'select', tab: 'dsp', sub: 'resampler', options: rateOptions(1) },
  { key: 'res48', label: '48 KHz', kind: 'select', tab: 'dsp', sub: 'resampler', options: rateOptions(2) },
  { key: 'res88', label: '88.2 KHz', kind: 'select', tab: 'dsp', sub: 'resampler', options: rateOptions(3) },
  { key: 'res96', label: '96 KHz', kind: 'select', tab: 'dsp', sub: 'resampler', options: rateOptions(4) },
  { key: 'res176', label: '176.4 KHz', kind: 'select', tab: 'dsp', sub: 'resampler', options: rateOptions(5) },
  { key: 'res192', label: '192 KHz', kind: 'select', tab: 'dsp', sub: 'resampler', options: rateOptions(6) },
  { key: 'res352', label: '352.8 KHz', kind: 'select', tab: 'dsp', sub: 'resampler', options: rateOptions(7) },
  { key: 'res384', label: '384 KHz', kind: 'select', tab: 'dsp', sub: 'resampler', options: rateOptions(8) },
  { key: 'soxr_phase', label: 'Phase', kind: 'select', tab: 'dsp', sub: 'resampler', options: SOXR_PHASE },
  { key: 'soxr_filter', label: 'Steep filter (99%)', kind: 'bool', tab: 'dsp', sub: 'resampler' },
  { key: 'soxr_quality', label: 'Ultra High Quality', kind: 'bool', tab: 'dsp', sub: 'resampler' },
  { key: 'att', label: 'Attenuate, dB -', kind: 'int', tab: 'dsp', sub: 'resampler', min: -120, max: 0 },

  // DSP → Convolver
  { key: 'use_conv', label: 'Enable convolver', kind: 'bool', tab: 'dsp', sub: 'convolver' },
  { key: 'conv_filter', label: 'Select filter', kind: 'int', tab: 'dsp', sub: 'convolver', min: 0, max: 999 },
  { key: 'conv_db', label: 'Attenuation', kind: 'range10', tab: 'dsp', sub: 'convolver', min: -60, max: 60 },

  // System
  { key: 'priority', label: 'Process Priority (0–99)', kind: 'int', tab: 'system', min: 0, max: 99 },
  { key: 'nice', label: 'Process Nice (-20–19)', kind: 'int', tab: 'system', min: -20, max: 19 },
  { key: 'lock_memory', label: 'Lock memory', kind: 'bool', tab: 'system' },
  { key: 'affinity_mode', label: 'Selecting cores', kind: 'select', tab: 'system', options: AFFINITY },

  // Card → Scream
  { key: 'ch_scr', label: 'Scream', kind: 'bool', tab: 'card' },
  { key: 'ch_tcp', label: 'TCP', kind: 'bool', tab: 'card' },
  { key: 'ip_scr', label: 'Receiver IP', kind: 'string', tab: 'card' },
  { key: 'pt_scr', label: 'Port', kind: 'int', tab: 'card', min: 1, max: 65535 },
];

const MAIN_KEY = 'apui.settings.tab';
const SUB_KEY = (tab: string) => `apui.settings.sub.${tab}`;
let activeTab: MainTab = (sessionStorage.getItem(MAIN_KEY) as MainTab) || 'general';
let activeSub: SubTab = (sessionStorage.getItem(SUB_KEY(activeTab)) as SubTab) || firstSub(activeTab);

function firstSub(tab: MainTab): SubTab {
  return (SUB_TABS[tab]?.[0]?.id || 'dsd') as SubTab;
}

function hwOptions(config: Config): Array<{ value: string; label: string }> {
  const list = Array.isArray(config.hw_list) ? config.hw_list : [];
  if (!list.length) return [{ value: '0', label: '—' }];
  return list.map((label, index) => ({ value: String(index), label: String(label) }));
}

function fieldControl(spec: FieldSpec, config: Config): FieldControl {
  const current = config[spec.key];
  if (spec.kind === 'bool' || spec.kind === 'intbool') {
    const box = checkbox(spec.kind === 'intbool' ? current === 1 || current === true : current === true);
    return { node: box, get: () => (spec.kind === 'intbool' ? (box.checked ? 1 : 0) : box.checked) };
  }
  if (spec.kind === 'int') {
    const input = numberInput(Number(current ?? 0), spec.min, spec.max);
    return { node: input, get: () => Number(input.value) };
  }
  if (spec.kind === 'select') {
    const sel = select(String(current ?? spec.options?.[0]?.value ?? '0'), spec.options || []);
    return { node: sel, get: () => Number(sel.value) };
  }
  if (spec.kind === 'hw_index') {
    const opts = hwOptions(config);
    const sel = select(String(current ?? 0), opts);
    sel.disabled = opts.length <= 1 && opts[0]?.label === '—';
    return { node: sel, get: () => Number(sel.value) };
  }
  if (spec.kind === 'range10') {
    const wrap = el('div', { class: 'range-wrap' });
    const range = el('input', {
      class: 'range', type: 'range', min: String(spec.min ?? -60), max: String(spec.max ?? 60), step: '0.5',
      value: String(Number(current ?? 0) / 10),
    }) as HTMLInputElement;
    const label = el('span', { class: 'range-value', text: `${Number(range.value).toFixed(1)} dB` });
    range.addEventListener('input', () => { label.textContent = `${Number(range.value).toFixed(1)} dB`; });
    wrap.append(range, label);
    return { node: wrap, get: () => Math.round(Number(range.value) * 10) };
  }
  const input = textInput(String(current ?? ''));
  return {
    node: input,
    get: () => {
      let value = input.value;
      if (spec.key === 'root_folder') value = value.replace(/^\/+|\/+$/g, '');
      if (spec.key === 'covers') value = value.trim();
      return value;
    },
  };
}

function renderFieldGroups(tab: MainTab, sub: SubTab | null, config: Config, controls: Map<string, FieldControl>): HTMLElement {
  const fields = FIELDS.filter((f) => f.tab === tab && (!sub || f.sub === sub));
  const form = el('div', { class: 'settings-form' });
  let group = '';
  for (const spec of fields) {
    if (spec.group && spec.group !== group) {
      group = spec.group;
      form.append(el('div', { class: 'settings-group-title', text: group }));
    }
    const control = fieldControl(spec, config);
    controls.set(spec.key, control);
    form.append(settingRow(spec.label, control.node, spec.hint || ''));
  }
  return form;
}

function cardsOptions(config: Config): Array<{ value: string; label: string }> {
  const cards = Array.isArray(config.cards) ? config.cards : [];
  const out: Array<{ value: string; label: string }> = [];
  for (let i = 0; i < cards.length; i += 2) {
    out.push({ value: String(i / 2), label: String(cards[i]) + (cards[i + 1] ? ` — ${cards[i + 1]}` : '') });
  }
  return out;
}

function yesNo(value: unknown): string {
  return value === 1 || value === true ? 'yes' : 'no';
}

function statValue(config: Config, key: string): string {
  const value = (config as Record<string, unknown>)[key];
  return value == null || value === '' ? '—' : String(value);
}

function mergeDirty(controls: Map<string, FieldControl>): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  for (const [key, control] of controls) patch[key] = control.get();
  return patch;
}

export function renderSettings(view: HTMLElement, s: AppState): void {
  view.innerHTML = '';
  const config = s.config;
  if (!config) {
    view.append(el('div', { class: 'empty-state' }, [svgIcon('settings', 40), el('h3', { text: '配置载入中…' })]));
    return;
  }
  if (!MAIN_TABS.some((t) => t.id === activeTab)) activeTab = 'general';
  if (SUB_TABS[activeTab] && !SUB_TABS[activeTab]!.some((t) => t.id === activeSub)) activeSub = firstSub(activeTab);

  const controls = new Map<string, FieldControl>();
  const layout = el('div', { class: 'settings-layout' });
  const nav = el('nav', { class: 'settings-nav', 'aria-label': '设置分页' });
  for (const tab of MAIN_TABS) {
    nav.append(el('button', {
      class: `settings-nav-btn${activeTab === tab.id ? ' active' : ''}`,
      type: 'button',
      onclick: () => {
        activeTab = tab.id;
        activeSub = firstSub(activeTab);
        sessionStorage.setItem(MAIN_KEY, activeTab);
        sessionStorage.setItem(SUB_KEY(activeTab), activeSub);
        renderSettings(view, store.get());
      },
    }, [svgIcon(tab.icon, 17), el('span', { text: tab.label })]));
  }

  const body = el('div', { class: 'settings-body' });
  const header = el('div', { class: 'page-header settings-header' }, [
    el('div', {}, [
      el('h1', { text: '设置' }),
      el('p', { class: 'subtitle', text: 'Album Player settings · 修改会写入 aplayer 配置；保存前做完整合并与校验' }),
    ]),
    el('div', { class: 'page-actions' }, [
      el('button', { class: 'btn-secondary', type: 'button', onclick: () => store.exportConfig() }, [svgIcon('external', 16), el('span', { text: '导出配置' })]),
      el('button', { class: 'btn-secondary', type: 'button', onclick: () => triggerImport() }, [svgIcon('folder', 16), el('span', { text: '导入配置' })]),
    ]),
  ]);
  body.append(header);

  const save = (): void => {
    const patch = mergeDirty(controls);
    if (Object.keys(patch).length) void store.saveSettings(patch);
  };

  if (activeTab === 'status') {
    body.append(renderStatus(config, s));
  } else if (activeTab === 'about') {
    body.append(renderAbout(config));
  } else if (activeTab === 'card') {
    body.append(renderCard(config, controls, save));
    header.querySelector('.page-actions')?.append(el('button', { class: 'btn-primary', type: 'button', onclick: save }, [svgIcon('check', 16), el('span', { text: '保存' })]));
  } else {
    const subs = SUB_TABS[activeTab];
    if (subs) {
      const subTabs = el('div', { class: 'tabs settings-subtabs' });
      for (const sub of subs) {
        subTabs.append(el('button', {
          class: `tab-btn${activeSub === sub.id ? ' active' : ''}`,
          type: 'button',
          text: sub.label,
          onclick: () => {
            activeSub = sub.id;
            sessionStorage.setItem(SUB_KEY(activeTab), activeSub);
            renderSettings(view, store.get());
          },
        }));
      }
      body.append(subTabs);
    }
    const form = renderFieldGroups(activeTab, subs ? activeSub : null, config, controls);
    body.append(form);

    if (activeTab === 'decoder' && activeSub === 'radio') {
      body.append(renderRadioCatalog(config));
    }
    if (activeTab === 'dsp' && activeSub === 'convolver') {
      body.append(renderConvolverInfo(config));
    }

    const saveBtn = el('button', { class: 'btn-primary save-btn', type: 'button', onclick: save }, [svgIcon('check', 18), el('span', { text: '保存设置' })]);
    header.querySelector('.page-actions')?.append(el('button', { class: 'btn-primary', type: 'button', onclick: save }, [svgIcon('check', 16), el('span', { text: '保存' })]));
    body.append(el('div', { class: 'save-bar' }, [saveBtn]));
  }

  const importInput = el('input', { type: 'file', accept: '.json,application/json', class: 'hidden' }) as HTMLInputElement;
  importInput.addEventListener('change', () => {
    const file = importInput.files?.[0];
    if (!file) return;
    file.text().then(async (text) => {
      try {
        const parsed = JSON.parse(text) as Record<string, unknown>;
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('JSON 必须是对象');
        if (!confirm('导入配置会覆盖可写字段，继续？')) return;
        await store.saveSettings(parsed);
      } catch (e) {
        store.toast(e instanceof Error ? e.message : String(e), 'error');
      }
    });
  });
  body.append(importInput);
  layout.append(nav, body);
  view.append(layout);
}

function renderRadioCatalog(config: Config): HTMLElement {
  return el('section', { class: 'settings-section' }, [
    el('h3', { text: 'Catalog' }),
    el('p', { class: 'hint' }, [
      el('span', { text: 'Catalog Date: local ' }),
      (() => {
        const local = el('span', { text: '…' });
        const url = import.meta.env.DEV ? '/ap/date.html' : '/date.html';
        fetch(url, { cache: 'no-store' })
          .then((r) => r.text())
          .then((text) => { local.textContent = text.trim() || '—'; })
          .catch(() => { local.textContent = '—'; });
        return local;
      })(),
      el('span', { text: ` / server ${statValue(config, 'catdate')}` }),
    ]),
    el('div', { class: 'button-row' }, [
      el('button', { class: 'btn-secondary', type: 'button', onclick: () => {
        if (confirm('Update Catalog 会联网并修改 Radio 目录，继续？')) void store.updateCatalog(false);
      } }, [el('span', { text: 'Update Catalog' })]),
      el('button', { class: 'btn-danger', type: 'button', onclick: () => {
        if (confirm('Replace Catalog 会覆盖本地 Radio 目录，继续？')) void store.updateCatalog(true);
      } }, [el('span', { text: 'Replace Catalog' })]),
    ]),
  ]);
}

function renderConvolverInfo(config: Config): HTMLElement {
  const list = statValue(config, 'conv_list');
  const desc = statValue(config, 'conv_desc');
  return el('section', { class: 'settings-section' }, [
    el('h3', { text: 'Convolver' }),
    el('p', { class: 'hint', text: 'Filters（来自 GetConfig.conv_list）' }),
    el('div', { class: 'mono-block', text: list }),
    el('p', { class: 'hint', text: 'Description' }),
    el('div', { class: 'mono-block', text: desc }),
  ]);
}

function renderStatus(config: Config, s: AppState): HTMLElement {
  const p = s.player;
  return el('section', { class: 'settings-section' }, [
    el('h3', { text: 'Status' }),
    statRow('Root User', yesNo(config.stat_root)),
    statRow('Used Cores', statValue(config, 'stat_cpus')),
    statRow('Process Priority', statValue(config, 'stat_prio')),
    statRow('Process Nice', statValue(config, 'stat_nice')),
    statRow('Supports 16 bit output', yesNo(config.stat_16bit)),
    statRow('Supports 24 bit output', yesNo(config.stat_24bit)),
    statRow('Supports 32 bit output', yesNo(config.stat_32bit)),
    statRow('Supports Native DSD', config.stat_dsd32be === 1 || config.stat_dsd32le === 1 ? 'yes' : 'no'),
    statRow('Playing', p?.Playing ? 'yes' : 'no'),
    statRow('Playing file', p?.PlayingName || statValue(config, 'stat_file')),
    statRow('Source', statValue(config, 'stat_source')),
    statRow('Output', statValue(config, 'stat_output')),
    statRow('ALSA Period', statValue(config, 'stat_period_size')),
    statRow('ALSA Buffer', statValue(config, 'stat_buffer_size')),
  ]);
}

function renderCard(config: Config, controls: Map<string, FieldControl>, save: () => void): HTMLElement {
  const asound = Array.isArray(config.asound) ? config.asound.map(String) : [];
  const cards = Array.isArray(config.cards) ? config.cards.map(String) : [];
  const options = cardsOptions(config);
  const cardSelect = select(options[0]?.value || '0', options.length ? options : [{ value: '0', label: 'No cards detected' }]);
  cardSelect.disabled = !options.length;
  const form = renderFieldGroups('card', null, config, controls);
  const saveBtn = el('button', { class: 'btn-primary save-btn', type: 'button', onclick: save }, [svgIcon('check', 18), el('span', { text: '保存设置' })]);
  return el('div', { class: 'settings-card-body' }, [
    el('section', { class: 'settings-section' }, [
      el('h3', { text: 'Card' }),
      el('p', { class: 'hint', text: '/etc/asound.conf:' }),
      el('div', { class: 'mono-block', text: asound.join('\n') || 'File asound.conf not found.' }),
      el('p', { class: 'hint', text: 'Available cards:' }),
      el('div', { class: 'mono-block', text: cards.join('\n') || '—' }),
      settingRow('Select card', cardSelect, '切换声卡会停止当前播放并重新配置 ALSA'),
      el('div', { class: 'button-row' }, [
        el('button', { class: 'btn-primary', type: 'button', disabled: !options.length, onclick: () => {
          if (!confirm('切换声卡会停止当前播放并重新配置音频，继续？')) return;
          void store.selectCard(Number(cardSelect.value));
        } }, [el('span', { text: '应用声卡' })]),
      ]),
    ]),
    form,
    el('div', { class: 'save-bar' }, [saveBtn]),
  ]);
}

function renderAbout(config: Config): HTMLElement {
  const repo = 'https://github.com/harmonyosnews/album-player-ui';
  return el('div', { class: 'settings-about' }, [
    el('section', { class: 'settings-section' }, [
      el('h3', { text: 'Album Player UI' }),
      el('p', { class: 'hint', text: `APUI ${__APUI_VERSION__} · Apache License 2.0 · Copyright 2026 harmonyosnews` }),
      el('p', { class: 'hint', text: '独立 Web 前端，不包含、不修改 Album Player 音频引擎。' }),
      el('p', { class: 'hint', text: 'aplayer: 2.19 · 官方主页' }),
      el('p', {}, [
        el('a', { href: 'https://albumplayer.ru/linux/english.html', target: '_blank', rel: 'noopener', text: 'albumplayer.ru/linux/english.html' }),
      ]),
      el('p', {}, [
        el('a', { href: repo, target: '_blank', rel: 'noopener', text: repo }),
      ]),
    ]),
    el('section', { class: 'settings-section' }, [
      el('h3', { text: 'Credits' }),
      el('p', { class: 'hint', text: 'Album Player for Linux — Programming: Igor Antonov; Web-UI: dimas.' }),
      el('p', { class: 'hint', text: 'APUI settings layout is inspired by the official Album Player settings UI; APUI code is independently implemented.' }),
      el('p', { class: 'hint', text: '使用前请阅读 LICENSE、NOTICE、USER-AGREEMENT.md、DISCLAIMER.md。' }),
    ]),
  ]);
}


function triggerImport(): void {
  const input = document.querySelector<HTMLInputElement>('input[type=file].hidden');
  input?.click();
}
