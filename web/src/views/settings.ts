import { safeUrl } from '../api/sanitize';
import type { AppState } from '../store';
import { store } from '../store';
import { checkbox, numberInput, select, settingRow, statRow, textInput } from '../ui/components';
import { el, svgIcon } from '../ui/dom';

type Kind = 'bool' | 'int' | 'string' | 'select';
type Control = HTMLInputElement | HTMLSelectElement;

interface FieldSpec {
  key: string;
  label: string;
  kind: Kind;
  hint?: string;
  min?: number;
  max?: number;
  options?: Array<{ value: string; label: string }>;
  section?: string;
}

const TABS = [
  { id: 'general', label: '常规' },
  { id: 'output', label: '输出' },
  { id: 'dsd', label: 'DSD' },
  { id: 'radio', label: '电台' },
  { id: 'advanced', label: '高级' },
  { id: 'status', label: '状态' },
];

let activeTab = sessionStorage.getItem('apui.settings.tab') || 'general';

const FIELDS: FieldSpec[] = [
  { key: 'covers', label: '封面目录', kind: 'string', hint: '默认 Covers;' },
  { key: 'root_folder', label: '音乐根目录', kind: 'string', hint: '不以 / 开头或结尾；用于自动载入媒体库' },
  { key: 'di_mode', label: '播放模式', kind: 'select', options: [
    { value: '0', label: 'Standard' }, { value: '1', label: 'Direct Input' }, { value: '2', label: 'Full Memory' },
  ] },
  { key: 'pframes', label: 'ALSA Period (frames)', kind: 'int', min: 1, max: 1_000_000 },
  { key: 'bframes', label: 'ALSA Buffer (frames)', kind: 'int', min: 1, max: 10_000_000 },
  { key: 'pmks', label: 'Period (µs)', kind: 'int', min: -1, max: 1_000_000 },
  { key: 'bmks', label: 'Buffer (µs)', kind: 'int', min: -1, max: 1_000_000 },
  { key: 'si_time', label: '曲间静音 (ms)', kind: 'int', min: 0, max: 60_000 },
  { key: 'gapless_mode', label: 'Gapless 无缝播放', kind: 'bool' },
  { key: 'preload_mode', label: 'Full preloading', kind: 'bool' },
  { key: 'volume_enabled', label: '启用软件音量', kind: 'bool', hint: '关闭时播放条不显示音量滑块' },
  { key: 'auto_mode', label: '自动下一专辑', kind: 'bool' },
  { key: 'cue_mode', label: '使用 .cue', kind: 'bool' },
  { key: 'tags_mode', label: '使用标签', kind: 'bool' },
  { key: 'mode_16bit', label: '16 bit 输出', kind: 'bool' },
  { key: 'mode_24bit', label: '24 bit 输出', kind: 'bool' },
  { key: 'lock_memory', label: '锁定内存', kind: 'bool' },
  { key: 'priority', label: '线程优先级', kind: 'int', min: 0, max: 99 },
  { key: 'nice', label: 'nice', kind: 'int', min: -20, max: 19 },
  { key: 'affinity_mode', label: 'CPU 亲和性', kind: 'select', options: [
    { value: '0', label: '不绑核' }, { value: '1', label: '单核' }, { value: '2', label: '双核' },
  ] },
  { key: 'mmap', label: 'ALSA 访问模式', kind: 'select', options: [
    { value: '1', label: 'MMAP' }, { value: '0', label: 'RW' },
  ] },
  { key: 'hw_volume', label: '使用硬件音量', kind: 'bool' },
  { key: 'att', label: '衰减 (dB)', kind: 'int', min: -120, max: 0 },
  { key: 'dop_mode', label: 'DSD 输出模式', kind: 'select', options: [
    { value: '0', label: 'PCM' }, { value: '1', label: 'DoP' }, { value: '2', label: 'Native DSD' },
  ] },
  { key: 'dsd_limit', label: 'DSD 上限', kind: 'select', options: [
    { value: '0', label: 'DSD64' }, { value: '1', label: 'DSD128' }, { value: '2', label: 'DSD256' }, { value: '3', label: 'DSD512' },
  ] },
  { key: 'pcm_freq', label: 'DSD→PCM 采样率', kind: 'select', options: [
    { value: '0', label: '44100' }, { value: '1', label: '88200' }, { value: '2', label: '176400' }, { value: '3', label: '352800' },
  ] },
  { key: 'dsd_vol', label: 'DSD→PCM 音量', kind: 'select', options: [
    { value: '0', label: '+0dB' }, { value: '1', label: '+1dB' }, { value: '2', label: '+2dB' }, { value: '3', label: '+3dB' }, { value: '4', label: '+4dB' },
  ] },
  { key: 'dsd_area', label: 'SACD 区域', kind: 'int', min: 0, max: 3 },
  { key: 'sacd_full', label: 'SACD 全盘', kind: 'bool' },
  { key: 'dvda_area', label: 'DVD-A 区域', kind: 'int', min: 0, max: 3 },
  { key: 'dvda_nomix', label: 'DVD-A 不混音', kind: 'bool' },
  { key: 'pcm_mult', label: 'PCM 多声道', kind: 'bool' },
  { key: 'enable_dsd', label: '启用 DSD', kind: 'select', options: [
    { value: '0', label: '关闭' }, { value: '1', label: '开启' },
  ] },
  { key: 'filter', label: 'DSD 滤波器', kind: 'int', min: 0, max: 99 },
  { key: 'output', label: 'DSD 输出', kind: 'int', min: 0, max: 99 },
  { key: 'rate', label: 'DSD 速率', kind: 'int', min: 0, max: 99 },
  { key: 'level', label: 'DSD 电平', kind: 'int', min: 0, max: 99 },
  { key: 'multithread', label: 'DSD 多线程', kind: 'select', options: [
    { value: '0', label: '关闭' }, { value: '1', label: '开启' },
  ] },
  { key: 'radio_pict', label: '显示电台图片', kind: 'bool' },
  { key: 'num_pics', label: '图片数量 (1–10)', kind: 'int', min: 1, max: 10 },
  { key: 'std_buffer', label: '电台缓冲 (frames)', kind: 'int', min: 16384, max: 8_388_608 },
  { key: 'radio_auto', label: '电台自动播放', kind: 'select', options: [
    { value: '0', label: '关闭' }, { value: '1', label: '开启' },
  ] },
  { key: 'api_flag', label: '查询宽度', kind: 'select', options: [
    { value: '0', label: '关闭' }, { value: '1', label: '开启' },
  ] },
  { key: 'api_add', label: '查询附加词', kind: 'string', hint: '例如 album cover' },
  { key: 'radio_proxy', label: '使用代理', kind: 'bool' },
  { key: 'radio_proxy2', label: '代理地址', kind: 'string', hint: '[user:pass@]server:port' },
  { key: 'radio_ua', label: '自定义 User-Agent', kind: 'bool' },
  { key: 'radio_user', label: 'User-Agent', kind: 'string' },
  { key: 'multi_mode', label: 'DSP 多声道', kind: 'bool' },
  { key: 'swap_mode', label: '声道交换', kind: 'bool' },
  { key: 'phase_mode', label: '相位', kind: 'bool' },
  { key: 'use_conv', label: '启用卷积', kind: 'bool' },
  { key: 'conv_filter', label: '卷积滤波器索引', kind: 'int', min: 0, max: 999 },
  { key: 'conv_db', label: '卷积增益 ×10', kind: 'int', min: -1200, max: 1200 },
  { key: 'soxr_phase', label: 'SoXR 相位', kind: 'int', min: 0, max: 99 },
  { key: 'soxr_filter', label: 'SoXR 滤波', kind: 'bool' },
  { key: 'soxr_quality', label: 'SoXR 质量', kind: 'bool' },
];

function fieldControl(spec: FieldSpec, value: unknown): Control {
  if (spec.kind === 'bool') return checkbox(value === true);
  if (spec.kind === 'int') return numberInput(Number(value ?? 0), spec.min, spec.max);
  if (spec.kind === 'select') return select(String(value ?? spec.options?.[0]?.value ?? '0'), spec.options || []);
  return textInput(String(value ?? ''));
}

function fieldValue(spec: FieldSpec, control: Control): unknown {
  if (spec.kind === 'bool') return (control as HTMLInputElement).checked;
  if (spec.kind === 'int') return Number((control as HTMLInputElement).value);
  if (spec.kind === 'select') return Number((control as HTMLSelectElement).value);
  let v = (control as HTMLInputElement).value;
  if (spec.key === 'root_folder') v = v.replace(/^\/+|\/+$/g, '');
  if (spec.key === 'covers') v = v.trim();
  return v;
}

function tabFields(tab: string): FieldSpec[] {
  if (tab === 'general') return FIELDS.filter((f) => ['covers', 'root_folder', 'di_mode', 'pframes', 'bframes', 'pmks', 'bmks', 'si_time', 'gapless_mode', 'preload_mode', 'volume_enabled', 'auto_mode', 'cue_mode', 'tags_mode', 'mode_16bit', 'mode_24bit', 'lock_memory', 'priority', 'nice', 'affinity_mode'].includes(f.key));
  if (tab === 'output') return FIELDS.filter((f) => ['mmap', 'hw_volume', 'att'].includes(f.key));
  if (tab === 'dsd') return FIELDS.filter((f) => ['dop_mode', 'dsd_limit', 'pcm_freq', 'dsd_vol', 'dsd_area', 'sacd_full', 'dvda_area', 'dvda_nomix', 'pcm_mult', 'enable_dsd', 'filter', 'output', 'rate', 'level', 'multithread'].includes(f.key));
  if (tab === 'radio') return FIELDS.filter((f) => ['radio_pict', 'num_pics', 'std_buffer', 'radio_auto', 'api_flag', 'api_add', 'radio_proxy', 'radio_proxy2', 'radio_ua', 'radio_user'].includes(f.key));
  if (tab === 'advanced') return FIELDS.filter((f) => ['multi_mode', 'swap_mode', 'phase_mode', 'use_conv', 'conv_filter', 'conv_db', 'soxr_phase', 'soxr_filter', 'soxr_quality'].includes(f.key));
  return [];
}

function cardsOptions(config: Record<string, unknown>): Array<{ value: string; label: string }> {
  const cards = Array.isArray(config.cards) ? config.cards : [];
  const out: Array<{ value: string; label: string }> = [];
  for (let i = 0; i < cards.length; i += 2) {
    out.push({ value: String(i / 2), label: String(cards[i]) + (cards[i + 1] ? ` — ${cards[i + 1]}` : '') });
  }
  return out;
}

export function renderSettings(view: HTMLElement, s: AppState): void {
  view.innerHTML = '';
  const config = s.config;
  if (!config) {
    view.append(el('div', { class: 'empty-state' }, [svgIcon('settings', 40), el('h3', { text: '配置载入中…' })]));
    return;
  }
  if (!TABS.some((t) => t.id === activeTab)) activeTab = 'general';

  const inputs = new Map<string, Control>();
  const page = el('div', { class: 'page settings-page' });
  page.append(el('div', { class: 'page-header' }, [
    el('div', {}, [el('h1', { text: '设置' }), el('p', { class: 'subtitle', text: '修改会写入 aplayer 配置；保存前会做完整合并与校验' })]),
    el('div', { class: 'page-actions' }, [
      el('button', { class: 'btn-secondary', type: 'button', onclick: () => store.exportConfig() }, [svgIcon('external', 16), el('span', { text: '导出配置' })]),
      el('button', { class: 'btn-secondary', type: 'button', onclick: () => triggerImport() }, [svgIcon('folder', 16), el('span', { text: '导入配置' })]),
    ]),
  ]));

  const tabs = el('div', { class: 'tabs' });
  for (const tab of TABS) {
    tabs.append(el('button', {
      class: `tab-btn${activeTab === tab.id ? ' active' : ''}`,
      type: 'button',
      text: tab.label,
      onclick: () => {
        activeTab = tab.id;
        sessionStorage.setItem('apui.settings.tab', activeTab);
        view.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
        renderSettings(view, store.get());
      },
    }));
  }
  page.append(tabs);

  if (activeTab === 'status') {
    page.append(renderStatus(config, s));
    view.append(page);
    return;
  }

  const form = el('div', { class: 'settings-form' });
  if (activeTab === 'output') {
    const cardOptions = cardsOptions(config);
    const current = Number(config.hw_index ?? 0);
    const cardSelect = select(String(current), cardOptions.length ? cardOptions : [{ value: '0', label: '未检测到声卡' }]);
    form.append(el('section', { class: 'settings-section' }, [
      el('h3', { text: '输出声卡' }),
      el('p', { class: 'hint', text: '切换声卡会停止当前播放并重新配置 ALSA，请确认后再操作。' }),
      settingRow('声卡', cardSelect, '来自 GetConfig.cards'),
      el('div', { class: 'button-row' }, [
        el('button', {
          class: 'btn-primary',
          type: 'button',
          disabled: s.busy || !cardOptions.length,
          onclick: () => {
            if (!confirm('切换声卡会停止当前播放并重新配置音频，继续？')) return;
            void store.selectCard(Number(cardSelect.value));
          },
        }, [el('span', { text: '应用声卡' })]),
      ]),
    ]));
  }

  const fields = tabFields(activeTab);
  if (fields.length) {
    const section = el('section', { class: 'settings-section' }, [
      el('h3', { text: TABS.find((t) => t.id === activeTab)?.label || '设置' }),
    ]);
    for (const spec of fields) {
      const control = fieldControl(spec, config[spec.key]);
      inputs.set(spec.key, control);
      section.append(settingRow(spec.label, control, spec.hint || ''));
    }
    form.append(section);
  }

  if (activeTab === 'radio') {
    form.append(el('section', { class: 'settings-section' }, [
      el('h3', { text: '电台目录' }),
      el('p', { class: 'hint', text: 'Update 增量更新；Replace 会替换本地 Radio 目录。执行前请备份 /opt/aplayer/Radio。' }),
      el('div', { class: 'button-row' }, [
        el('button', { class: 'btn-secondary', type: 'button', onclick: () => {
          if (confirm('更新电台目录会联网并修改 Radio 目录，继续？')) void store.updateCatalog(false);
        } }, [el('span', { text: '更新目录' })]),
        el('button', { class: 'btn-danger', type: 'button', onclick: () => {
          if (confirm('替换电台目录会覆盖本地 Radio 目录，继续？')) void store.updateCatalog(true);
        } }, [el('span', { text: '替换目录' })]),
      ]),
    ]));
  }

  if (activeTab === 'advanced') {
    form.append(el('section', { class: 'settings-section warning' }, [
      el('h3', { text: '高风险设置' }),
      el('p', { class: 'hint', text: 'DSP/卷积/SoXR 会改变声音路径。建议先导出配置并备份 config.dat；不确定时保持默认。' }),
    ]));
  }

  const save = el('button', {
    class: 'btn-primary save-btn',
    type: 'button',
    disabled: s.busy,
    onclick: async () => {
      const patch: Record<string, unknown> = {};
      for (const spec of fields) {
        const control = inputs.get(spec.key);
        if (control) patch[spec.key] = fieldValue(spec, control);
      }
      await store.saveSettings(patch);
    },
  }, [svgIcon('check', 18), el('span', { text: '保存设置' })]);
  const headerSave = el('button', { class: 'btn-primary', type: 'button', disabled: s.busy, onclick: () => save.click() }, [svgIcon('check', 16), el('span', { text: '保存' })]);
  page.querySelector('.page-actions')?.append(headerSave);
  page.append(form, el('div', { class: 'save-bar' }, [save]));

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
  page.append(importInput);
  view.append(page);
}

function renderStatus(config: Record<string, unknown>, s: AppState): HTMLElement {
  const p = s.player;
  const cards = Array.isArray(config.cards) ? config.cards : [];
  const asound = Array.isArray(config.asound) ? config.asound : [];
  const container = el('div', { class: 'settings-form' }, [
    el('section', { class: 'settings-section' }, [
      el('h3', { text: '播放器状态' }),
      statRow('Root', String(config.stat_root ?? '')),
      statRow('CPU', String(config.stat_cpus ?? '')),
      statRow('优先级', String(config.stat_prio ?? '')),
      statRow('Nice', String(config.stat_nice ?? '')),
      statRow('16 bit', String(config.stat_16bit ?? '')),
      statRow('24 bit', String(config.stat_24bit ?? '')),
      statRow('32 bit', String(config.stat_32bit ?? '')),
      statRow('DSD BE/LE', `${config.stat_dsd32be ?? 0} / ${config.stat_dsd32le ?? 0}`),
      statRow('正在播放', p?.Playing ? '是' : '否'),
      statRow('当前文件', p?.PlayingName || '—'),
      statRow('当前源', String(config.stat_source ?? '')),
      statRow('当前输出', String(config.stat_output ?? '')),
      statRow('播放位置', p ? `${p.Position} / ${p.PlayingLen} ms` : '—'),
    ]),
    el('section', { class: 'settings-section' }, [
      el('h3', { text: '声卡' }),
      ...cards.map((c) => el('div', { class: 'mono-line', text: String(c) })),
    ]),
    el('section', { class: 'settings-section' }, [
      el('h3', { text: '/etc/asound.conf' }),
      ...asound.map((line) => el('div', { class: 'mono-line', text: String(line) })),
    ]),
    el('section', { class: 'settings-section' }, [
      el('h3', { text: '目录日期' }),
      statRow('电台目录', String(config.catdate ?? '—')),
    ]),
  ]);
  return container;
}

function triggerImport(): void {
  const input = document.querySelector<HTMLInputElement>('input[type=file].hidden');
  input?.click();
}
