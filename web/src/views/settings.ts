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
  { id: 'general', label: '常规', icon: 'sliders' },
  { id: 'decoder', label: '解码器', icon: 'disc' },
  { id: 'dsp', label: 'DSP', icon: 'wave' },
  { id: 'system', label: '系统', icon: 'settings' },
  { id: 'status', label: '状态', icon: 'info' },
  { id: 'card', label: '声卡', icon: 'volume' },
  { id: 'about', label: '关于', icon: 'info' },
];

const SUB_TABS: Partial<Record<MainTab, Array<{ id: SubTab; label: string }>>> = {
  decoder: [
    { id: 'dsd', label: 'DSD' },
    { id: 'dvda', label: 'DVD-A' },
    { id: 'radio', label: '电台' },
  ],
  dsp: [
    { id: 'converter', label: '转换器' },
    { id: 'resampler', label: '重采样器' },
    { id: 'convolver', label: '卷积器' },
  ],
};

const DI_MODE = [
  { value: '0', label: '标准' },
  { value: '1', label: '直接输入' },
  { value: '2', label: '全内存' },
];
const MMAP = [
  { value: '1', label: 'MMAP 模式' },
  { value: '0', label: 'RW 模式' },
];
const AFFINITY = [
  { value: '0', label: '不绑定核心' },
  { value: '1', label: '单核' },
  { value: '2', label: '双核' },
];
const DOP = [
  { value: '0', label: 'PCM' },
  { value: '1', label: 'DoP' },
  { value: '2', label: '原生 DSD' },
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
  { value: '0', label: '多级' },
  { value: '1', label: '直接' },
  { value: '2', label: 'FIR 30kHz' },
  { value: '3', label: 'FIR 40kHz' },
  { value: '4', label: 'FIR 50kHz' },
  { value: '5', label: 'FIR 60kHz' },
  { value: '6', label: 'FIR S-Audio Systems' },
];
const AREA = [
  { value: '0', label: '无' },
  { value: '1', label: '立体声' },
  { value: '2', label: '多声道' },
];
const DSD_FILTER = [
  ['0', 'clans-4'], ['1', 'clans-5'], ['2', 'clans-6'], ['3', 'clans-7'], ['4', 'clans-8'],
  ['5', 'sdm-4'], ['6', 'sdm-5'], ['7', 'sdm-6'], ['8', 'sdm-7'], ['9', 'sdm-8'],
].map(([value, label]) => ({ value, label }));
const DSD_OUTPUT = [
  { value: '0', label: 'DoP' },
  { value: '1', label: '原生' },
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
  { value: '0', label: '最小相位' },
  { value: '1', label: '中间相位' },
  { value: '2', label: '线性相位' },
];
const RATE_LABELS = ['原始', '44.1 kHz', '48 kHz', '88.2 kHz', '96 kHz', '176.4 kHz', '192 kHz', '352.8 kHz', '384 kHz', '705.6 kHz', '768 kHz'];
const RATE_VALUES = RATE_LABELS.map((label, value) => ({ value: String(value), label }));
const rateOptions = (except: number) => RATE_VALUES.filter((o) => Number(o.value) !== except);

const FIELDS: FieldSpec[] = [
  // 常规
  { key: 'covers', label: '封面目录', kind: 'string', tab: 'general', group: '媒体库与输出' },
  { key: 'root_folder', label: '根目录', kind: 'string', tab: 'general', group: '媒体库与输出', hint: 'aplayer 可访问的目录；不以 / 开头或结尾' },
  { key: 'si_time', label: '曲间静音 (ms)', kind: 'int', tab: 'general', group: '媒体库与输出', min: 0, max: 60000 },
  { key: 'mode_16bit', label: '16 bit 输出', kind: 'bool', tab: 'general', group: '媒体库与输出' },
  { key: 'mode_24bit', label: '24 bit 输出', kind: 'bool', tab: 'general', group: '媒体库与输出' },
  { key: 'di_mode', label: '播放模式', kind: 'select', tab: 'general', group: '播放', options: DI_MODE },
  { key: 'std_buffer', label: '预载缓冲 (frames)', kind: 'int', tab: 'general', group: '播放', min: 16384, max: 8388608, hint: '16384–8388608' },
  { key: 'gapless_mode', label: '无缝播放 (Gapless)', kind: 'bool', tab: 'general', group: '播放' },
  { key: 'preload_mode', label: '完全预加载', kind: 'bool', tab: 'general', group: '播放' },
  { key: 'volume_enabled', label: '启用音量控制', kind: 'bool', tab: 'general', group: '音量' },
  { key: 'hw_volume', label: '硬件音量', kind: 'bool', tab: 'general', group: '音量' },
  { key: 'hw_index', label: '硬件参数', kind: 'hw_index', tab: 'general', group: '音量' },
  { key: 'auto_mode', label: '自动下一专辑', kind: 'bool', tab: 'general', group: '媒体库选项' },
  { key: 'cue_mode', label: '使用 .cue', kind: 'bool', tab: 'general', group: '媒体库选项' },
  { key: 'tags_mode', label: '使用标签', kind: 'bool', tab: 'general', group: '媒体库选项' },
  { key: 'win1251', label: 'Windows-1251 标签', kind: 'intbool', tab: 'general', group: '媒体库选项' },
  { key: 'pframes', label: 'ALSA 周期 (frames)', kind: 'int', tab: 'general', group: 'ALSA', min: 1, max: 1000000 },
  { key: 'pmks', label: 'ALSA 周期 (µs)', kind: 'int', tab: 'general', group: 'ALSA', min: -1, max: 1000000 },
  { key: 'bframes', label: 'ALSA 缓冲 (frames)', kind: 'int', tab: 'general', group: 'ALSA', min: 1, max: 10000000 },
  { key: 'bmks', label: 'ALSA 缓冲 (µs)', kind: 'int', tab: 'general', group: 'ALSA', min: -1, max: 1000000 },
  { key: 'mmap', label: '缓冲访问模式', kind: 'select', tab: 'general', group: 'ALSA', options: MMAP },

  // 解码器 → DSD
  { key: 'dop_mode', label: 'DSD 输出模式', kind: 'select', tab: 'decoder', sub: 'dsd', options: DOP },
  { key: 'dsd_limit', label: 'DSD 模式上限', kind: 'select', tab: 'decoder', sub: 'dsd', options: DSD_LIMIT },
  { key: 'pcm_freq', label: 'PCM 采样率', kind: 'select', tab: 'decoder', sub: 'dsd', options: PCM_FREQ },
  { key: 'dsd_vol', label: 'PCM 音量', kind: 'select', tab: 'decoder', sub: 'dsd', options: DSD_VOL },
  { key: 'pcm_mult', label: '多声道 PCM', kind: 'bool', tab: 'decoder', sub: 'dsd' },
  { key: 'sacd_full', label: '整盘模式', kind: 'bool', tab: 'decoder', sub: 'dsd' },
  { key: 'dsd_pcm', label: 'DSD→PCM 转换器', kind: 'select', tab: 'decoder', sub: 'dsd', options: DSD_PCM },
  { key: 'dsd_area', label: '优先区域', kind: 'select', tab: 'decoder', sub: 'dsd', options: AREA },

  // 解码器 → DVD-A
  { key: 'dvda_nomix', label: "不加载立体声下混", kind: 'bool', tab: 'decoder', sub: 'dvda' },
  { key: 'dvda_area', label: '优先模式', kind: 'select', tab: 'decoder', sub: 'dvda', options: AREA },

  // 解码器 → 电台
  { key: 'radio_pict', label: '加载图片', kind: 'bool', tab: 'decoder', sub: 'radio' },
  { key: 'num_pics', label: '图片数量 (1–10)', kind: 'int', tab: 'decoder', sub: 'radio', min: 1, max: 10 },
  { key: 'api_flag', label: '查询封面', kind: 'intbool', tab: 'decoder', sub: 'radio' },
  { key: 'api_add', label: '查询文本', kind: 'string', tab: 'decoder', sub: 'radio', hint: '例如 album cover' },
  { key: 'radio_auto', label: '自动播放', kind: 'intbool', tab: 'decoder', sub: 'radio' },
  { key: 'radio_proxy', label: '使用代理服务器', kind: 'bool', tab: 'decoder', sub: 'radio' },
  { key: 'radio_proxy2', label: '代理地址', kind: 'string', tab: 'decoder', sub: 'radio', hint: '[user:pass@]server:port' },
  { key: 'radio_ua', label: '自定义 User-Agent', kind: 'bool', tab: 'decoder', sub: 'radio' },
  { key: 'radio_user', label: 'User-Agent', kind: 'string', tab: 'decoder', sub: 'radio' },

  // DSP → 转换器
  { key: 'multi_mode', label: '多声道转立体声', kind: 'bool', tab: 'dsp', sub: 'converter' },
  { key: 'swap_mode', label: '声道交换（立体声）', kind: 'bool', tab: 'dsp', sub: 'converter' },
  { key: 'phase_mode', label: '反相', kind: 'bool', tab: 'dsp', sub: 'converter' },
  { key: 'enable_dsd', label: 'PCM 转 DSD（Mans Rullgard）', kind: 'intbool', tab: 'dsp', sub: 'converter' },
  { key: 'filter', label: '滤波器', kind: 'select', tab: 'dsp', sub: 'converter', options: DSD_FILTER },
  { key: 'output', label: '输出', kind: 'select', tab: 'dsp', sub: 'converter', options: DSD_OUTPUT },
  { key: 'rate', label: '速率', kind: 'select', tab: 'dsp', sub: 'converter', options: DSD_RATE },
  { key: 'level', label: '电平', kind: 'select', tab: 'dsp', sub: 'converter', options: DSD_LEVEL },
  { key: 'multithread', label: '多线程模式', kind: 'intbool', tab: 'dsp', sub: 'converter' },

  // DSP → 重采样器
  { key: 'res_bf44', label: '< 44 kHz', kind: 'select', tab: 'dsp', sub: 'resampler', options: RATE_VALUES },
  { key: 'res44', label: '44.1 kHz', kind: 'select', tab: 'dsp', sub: 'resampler', options: rateOptions(1) },
  { key: 'res48', label: '48 kHz', kind: 'select', tab: 'dsp', sub: 'resampler', options: rateOptions(2) },
  { key: 'res88', label: '88.2 kHz', kind: 'select', tab: 'dsp', sub: 'resampler', options: rateOptions(3) },
  { key: 'res96', label: '96 kHz', kind: 'select', tab: 'dsp', sub: 'resampler', options: rateOptions(4) },
  { key: 'res176', label: '176.4 kHz', kind: 'select', tab: 'dsp', sub: 'resampler', options: rateOptions(5) },
  { key: 'res192', label: '192 kHz', kind: 'select', tab: 'dsp', sub: 'resampler', options: rateOptions(6) },
  { key: 'res352', label: '352.8 kHz', kind: 'select', tab: 'dsp', sub: 'resampler', options: rateOptions(7) },
  { key: 'res384', label: '384 kHz', kind: 'select', tab: 'dsp', sub: 'resampler', options: rateOptions(8) },
  { key: 'soxr_phase', label: '相位', kind: 'select', tab: 'dsp', sub: 'resampler', options: SOXR_PHASE },
  { key: 'soxr_filter', label: '陡峭滤波器 (99%)', kind: 'bool', tab: 'dsp', sub: 'resampler' },
  { key: 'soxr_quality', label: '超高精度', kind: 'bool', tab: 'dsp', sub: 'resampler' },
  { key: 'att', label: '衰减 (dB)', kind: 'int', tab: 'dsp', sub: 'resampler', min: -120, max: 0 },

  // DSP → 卷积器
  { key: 'use_conv', label: '启用卷积', kind: 'bool', tab: 'dsp', sub: 'convolver' },
  { key: 'conv_filter', label: '选择滤波器', kind: 'int', tab: 'dsp', sub: 'convolver', min: 0, max: 999 },
  { key: 'conv_db', label: '衰减', kind: 'range10', tab: 'dsp', sub: 'convolver', min: -60, max: 60 },

  // 系统
  { key: 'priority', label: '进程优先级 (0–99)', kind: 'int', tab: 'system', min: 0, max: 99 },
  { key: 'nice', label: '进程 Nice (-20–19)', kind: 'int', tab: 'system', min: -20, max: 19 },
  { key: 'lock_memory', label: '锁定内存', kind: 'bool', tab: 'system' },
  { key: 'affinity_mode', label: 'CPU 核心选择', kind: 'select', tab: 'system', options: AFFINITY },

  // 声卡 → Scream 投屏
  { key: 'ch_scr', label: 'Scream 投屏', kind: 'bool', tab: 'card' },
  { key: 'ch_tcp', label: 'TCP', kind: 'bool', tab: 'card' },
  { key: 'ip_scr', label: '接收端 IP', kind: 'string', tab: 'card' },
  { key: 'pt_scr', label: '端口', kind: 'int', tab: 'card', min: 1, max: 65535 },
];

const MAIN_KEY = 'apui.settings.tab';
const SUB_KEY = (tab: string) => `apui.settings.sub.${tab}`;
let activeTab: MainTab = (sessionStorage.getItem(MAIN_KEY) as MainTab) || 'general';
let activeSub: SubTab = (sessionStorage.getItem(SUB_KEY(activeTab)) as SubTab) || firstSub(activeTab);

export function setSettingsTab(tab: MainTab): void {
  activeTab = tab;
  activeSub = firstSub(tab);
  sessionStorage.setItem(MAIN_KEY, activeTab);
  sessionStorage.setItem(SUB_KEY(activeTab), activeSub);
}

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
  return value === 1 || value === true ? '是' : '否';
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
      el('p', { class: 'subtitle', text: 'Album Player 设置 · 保存/导入/导出均作用于完整配置（全部可写字段），不是当前分页' }),
    ]),
  ]);
  body.append(header);

  const save = (): void => {
    const patch = mergeDirty(controls);
    if (Object.keys(patch).length) void store.saveSettings(patch);
  };

  const actions = (canSave: boolean): HTMLElement => el('div', { class: 'settings-actions' }, [
    el('span', { class: 'settings-action-note', text: '完整配置操作：导入/导出/保存覆盖全部分页的可写字段。' }),
    el('div', { class: 'button-row' }, [
      el('button', { class: 'btn-secondary', type: 'button', title: '导出完整配置（全部分页）', onclick: () => store.exportConfig() }, [svgIcon('external', 16), el('span', { text: '导出配置' })]),
      el('button', { class: 'btn-secondary', type: 'button', title: '导入完整配置（全部分页）', onclick: () => triggerImport() }, [svgIcon('folder', 16), el('span', { text: '导入配置' })]),
      canSave ? el('button', { class: 'btn-primary', type: 'button', onclick: save }, [svgIcon('check', 18), el('span', { text: '保存设置' })]) : '',
    ]),
  ]);

  if (activeTab === 'status') {
    body.append(renderStatus(config, s), actions(false));
  } else if (activeTab === 'about') {
    body.append(renderAbout(config), actions(false));
  } else if (activeTab === 'card') {
    body.append(renderCard(config, controls), actions(true));
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

    body.append(actions(true));
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
    el('h3', { text: '电台目录' }),
    el('p', { class: 'hint' }, [
      el('span', { text: '目录日期：本地 ' }),
      (() => {
        const local = el('span', { text: '…' });
        const url = import.meta.env.DEV ? '/ap/date.html' : '/date.html';
        fetch(url, { cache: 'no-store' })
          .then((r) => r.text())
          .then((text) => { local.textContent = text.trim() || '—'; })
          .catch(() => { local.textContent = '—'; });
        return local;
      })(),
      el('span', { text: ` / 服务器 ${statValue(config, 'catdate')}` }),
    ]),
    el('div', { class: 'button-row' }, [
      el('button', { class: 'btn-secondary', type: 'button', onclick: () => {
        if (confirm('更新目录会联网并修改电台目录，继续？')) void store.updateCatalog(false);
      } }, [el('span', { text: '更新目录' })]),
      el('button', { class: 'btn-danger', type: 'button', onclick: () => {
        if (confirm('替换目录会覆盖本地电台目录，继续？')) void store.updateCatalog(true);
      } }, [el('span', { text: '替换目录' })]),
    ]),
  ]);
}

function renderConvolverInfo(config: Config): HTMLElement {
  const list = statValue(config, 'conv_list');
  const desc = statValue(config, 'conv_desc');
  return el('section', { class: 'settings-section' }, [
    el('h3', { text: '卷积器' }),
    el('p', { class: 'hint', text: '滤波器列表（来自 GetConfig.conv_list）' }),
    el('div', { class: 'mono-block', text: list }),
    el('p', { class: 'hint', text: '描述' }),
    el('div', { class: 'mono-block', text: desc }),
  ]);
}

function renderStatus(config: Config, s: AppState): HTMLElement {
  const p = s.player;
  return el('section', { class: 'settings-section' }, [
    el('h3', { text: '状态' }),
    statRow('Root 用户', yesNo(config.stat_root)),
    statRow('已用核心', statValue(config, 'stat_cpus')),
    statRow('进程优先级', statValue(config, 'stat_prio')),
    statRow('进程 Nice', statValue(config, 'stat_nice')),
    statRow('支持 16 bit 输出', yesNo(config.stat_16bit)),
    statRow('支持 24 bit 输出', yesNo(config.stat_24bit)),
    statRow('支持 32 bit 输出', yesNo(config.stat_32bit)),
    statRow('支持原生 DSD', config.stat_dsd32be === 1 || config.stat_dsd32le === 1 ? 'yes' : 'no'),
    statRow('正在播放', p?.Playing ? '是' : '否'),
    statRow('播放文件', p?.PlayingName || statValue(config, 'stat_file')),
    statRow('源', statValue(config, 'stat_source')),
    statRow('输出', statValue(config, 'stat_output')),
    statRow('ALSA 周期', statValue(config, 'stat_period_size')),
    statRow('ALSA 缓冲', statValue(config, 'stat_buffer_size')),
  ]);
}

function renderCard(config: Config, controls: Map<string, FieldControl>): HTMLElement {
  const asound = Array.isArray(config.asound) ? config.asound.map(String) : [];
  const cards = Array.isArray(config.cards) ? config.cards.map(String) : [];
  const options = cardsOptions(config);
  const cardSelect = select(options[0]?.value || '0', options.length ? options : [{ value: '0', label: '未检测到声卡' }]);
  cardSelect.disabled = !options.length;
  const form = renderFieldGroups('card', null, config, controls);
  return el('div', { class: 'settings-card-body' }, [
    el('section', { class: 'settings-section' }, [
      el('h3', { text: '声卡' }),
      el('p', { class: 'hint', text: '/etc/asound.conf:' }),
      el('div', { class: 'mono-block', text: asound.join('\n') || '未找到 asound.conf' }),
      el('p', { class: 'hint', text: '可用声卡：' }),
      el('div', { class: 'mono-block', text: cards.join('\n') || '—' }),
      settingRow('选择声卡', cardSelect, '切换声卡会停止当前播放并重新配置 ALSA'),
      el('div', { class: 'button-row' }, [
        el('button', { class: 'btn-primary', type: 'button', disabled: !options.length, onclick: () => {
          if (!confirm('切换声卡会停止当前播放并重新配置音频，继续？')) return;
          void store.selectCard(Number(cardSelect.value));
        } }, [el('span', { text: '应用声卡' })]),
      ]),
    ]),
    form,
  ]);
}

function renderAbout(config: Config): HTMLElement {
  const repo = 'https://github.com/harmonyosnews/album-player-ui';
  return el('div', { class: 'settings-about' }, [
    el('section', { class: 'settings-section' }, [
      el('h3', { text: 'Album Player UI（APUI）' }),
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
      el('h3', { text: '致谢' }),
      el('p', { class: 'hint', text: 'Album Player for Linux — Programming: Igor Antonov; Web-UI: dimas.' }),
      el('p', { class: 'hint', text: 'APUI 设置页布局参考官方 Album Player 设置界面；APUI 代码为独立实现。' }),
      el('p', { class: 'hint', text: '使用前请阅读 LICENSE、NOTICE、USER-AGREEMENT.md、DISCLAIMER.md。' }),
    ]),
  ]);
}


function triggerImport(): void {
  const input = document.querySelector<HTMLInputElement>('input[type=file].hidden');
  input?.click();
}
