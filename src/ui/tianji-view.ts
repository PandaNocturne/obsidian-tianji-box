import { ItemView, MarkdownRenderer, Notice, TFile, WorkspaceLeaf, setIcon } from 'obsidian';
import type TianjiPlugin from '../main';
import { DIVINATION_TAB_META } from '../divination-tabs';
import type {
	DivinationType,
	Gender,
	LiuyaoMethod,
	LiuyaoResult,
	ReadingRecord,
	YaoValue,
} from '../types';
import {
	YAO_LABELS,
	YAO_POSITION_NAMES,
	getHexagramByBinary,
} from '../liuyao/hexagrams';
import { getZhouyiByBinary, type ZhouyiText } from '../liuyao/zhouyi';
import {
	autoCastLines,
	buildLiuyaoResult,
	throwThreeCoinsDetailed,
	type CoinFace,
} from '../liuyao/casting';
import {
	calculateBazi,
	formatBaziChartText,
	wuxingOfChar,
	type BaziProfessionalChart,
	type CalendarType,
	type WuXing,
} from '../bazi/pillars';
import { CITIES } from '../bazi/cities';
import {
	DEFAULT_DECK_ID,
	getDeckInfo,
	suitAccent,
	type DeckId,
} from '../tarot/decks';
import { getSpread, isFlexibleSpread, TAROT_SPREADS } from '../tarot/spreads';
import {
	buildManualTarot,
	drawTarot,
	formatTarotReadingChart,
	getOrientMeaning,
	remainingTarotDeck,
	type DrawnCard,
	type TarotReading,
} from '../tarot/draw';
import {
	castXiaoliuren,
	XIAOLIUREN_METHOD_LABELS,
	type XiaoliurenMethod,
} from '../xiaoliuren/casting';
import {
	buildXiaoliurenResult,
	formatXiaoliurenChartText,
	getBodySideRelation,
	withTaijiRelations,
	type XiaoliurenCell,
	type XiaoliurenResult,
} from '../xiaoliuren/chart';
import {
	PALACES_GRID,
	type XiaoliurenPalace,
} from '../xiaoliuren/palaces';
import {
	castMeihua,
	MEIHUA_METHOD_LABELS,
	type MeihuaMethod,
} from '../meihua/casting';
import {
	buildMeihuaResult,
	formatMeihuaChartText,
	type MeihuaResult,
} from '../meihua/chart';
import { mutualBinary } from '../meihua/trigrams';
import { TarotPickModal } from './tarot-pick-modal';
import { TarotShuffleModal } from './tarot-shuffle-modal';
import {
	TarotSlotPickModal,
	type TarotSlotPick,
} from './tarot-slot-pick-modal';
import { FileNoteModal } from './file-note-modal';
import { ConfirmModal } from './confirm-modal';
import { TarotCardDetailModal } from './tarot-card-modal';
import { renderLibraryGrid, type LibraryFilter, type LibraryLayout } from './library';
import { TAROT_DECK } from '../tarot/cards';
import {
	ensureReadingNoteFile,
	findReadingNoteFile,
	buildNoteVaultPathForReading,
	openNoteInTab,
	readNoteBody,
	readingHasNote,
	resolveReadingNoteFile,
} from '../notes/reading-note';

export const TIANJI_VIEW_TYPE = 'tianji-view';

export type TabId = DivinationType;
/** cast=表单；chart=排盘；library=历史库 */
type PanelMode = 'cast' | 'chart' | 'library';

export class TianjiView extends ItemView {
	plugin: TianjiPlugin;
	private activeTab: TabId;
	private liuyaoPanel: PanelMode = 'cast';
	private baziPanel: PanelMode = 'cast';
	private tarotPanel: PanelMode = 'cast';
	private xiaoliurenPanel: PanelMode = 'cast';
	private meihuaPanel: PanelMode = 'cast';
	/** 历史库筛选：全部 / 仅收藏 */
	private libraryFilter: LibraryFilter = 'all';
	/** 历史库搜索关键词 */
	private libraryQuery = '';

	// 六爻 state
	private liuyaoSubject = '问事';
	private liuyaoGender: Gender = 'male';
	private liuyaoQuestion = '';
	private liuyaoMethod: LiuyaoMethod = 'auto';
	private liuyaoLines: YaoValue[] = [7, 7, 7, 7, 7, 7];
	private liuyaoCoinIndex = 0;
	private liuyaoCoinFaces: [CoinFace, CoinFace, CoinFace] = [
		'yang',
		'yin',
		'yang',
	];
	private liuyaoResult: LiuyaoResult | null = null;
	private liuyaoRecordId: number | null = null;
	private liuyaoCastLocal = '';

	// 八字 state
	private baziName = '';
	private baziRelation = '本人';
	private baziGender: Gender = 'male';
	private baziCalendar: CalendarType = 'solar';
	private baziLeapMonth = false;
	private baziDate = '';
	private baziTime = '12:00';
	private baziCity = '未知/不校正';
	private baziTrueSolar = false;
	private baziQuestion = '';
	private baziChart: BaziProfessionalChart | null = null;
	private baziRecordId: number | null = null;
	private baziSelectedDayun = 1;
	private baziSelectedLiunian = 0;

	// 塔罗 state
	private tarotDeckId: DeckId = DEFAULT_DECK_ID;
	private tarotSpreadId = 'three-time';
	private tarotSubject = '问事';
	private tarotQuestion = '';
	private tarotAllowReversed = true;
	private tarotReading: TarotReading | null = null;
	private tarotRecordId: number | null = null;
	private tarotShuffling = false;
	/** 抽牌页草稿：选牌后不立刻进牌阵，点「开始排盘」再确认 */
	private tarotDraft: (TarotSlotPick | null)[] = [];
	/** 本局已用牌 id：继续提问时从剩余牌组抽取 */
	private tarotSessionUsedIds: string[] = [];
	/** 自定义牌阵：洗牌/自动/手动时的目标张数 */
	private tarotCustomCount = 3;

	// 小六壬 state
	private xiaoliurenSubject = '问事';
	private xiaoliurenQuestion = '';
	private xiaoliurenMethod: XiaoliurenMethod = 'day-hour';
	private xiaoliurenNumber = '';
	private xiaoliurenCastLocal = '';
	private xiaoliurenResult: XiaoliurenResult | null = null;
	private xiaoliurenRecordId: number | null = null;
	/** 立太极宫位；null 表示未立，六亲按身宫 */
	private xiaoliurenTaijiPalace: XiaoliurenPalace | null = null;

	// 梅花易数 state
	private meihuaSubject = '问事';
	private meihuaQuestion = '';
	private meihuaMethod: MeihuaMethod = 'time';
	private meihuaNum1 = '';
	private meihuaNum2 = '';
	private meihuaNum3 = '';
	private meihuaCastLocal = '';
	private meihuaResult: MeihuaResult | null = null;
	private meihuaRecordId: number | null = null;

	private shellEl: HTMLElement | null = null;
	private tabsEl: HTMLElement | null = null;
	private bodyEl: HTMLElement | null = null;

	constructor(leaf: WorkspaceLeaf, plugin: TianjiPlugin) {
		super(leaf);
		this.plugin = plugin;
		this.activeTab = this.resolveInitialTab();
		const now = new Date();
		const pad = (n: number) => String(n).padStart(2, '0');
		this.baziDate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
		this.liuyaoCastLocal = this.toDatetimeLocal(now);
		this.xiaoliurenCastLocal = this.toDatetimeLocal(now);
		this.meihuaCastLocal = this.toDatetimeLocal(now);
	}

	/** 上次打开的标签（若仍启用），否则第一个已启用模块 */
	private resolveInitialTab(): TabId {
		const enabled = this.plugin.getEnabledTabs();
		if (enabled.length === 0) return 'liuyao';
		const last = this.plugin.settings.lastActiveTab;
		if (last && enabled.includes(last)) return last;
		return enabled[0]!;
	}

	private persistActiveTab(tab: TabId): void {
		if (this.plugin.settings.lastActiveTab === tab) return;
		this.plugin.settings.lastActiveTab = tab;
		void this.plugin.saveSettings();
	}

	private toDatetimeLocal(d: Date): string {
		const pad = (n: number) => String(n).padStart(2, '0');
		return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
	}

	/** 规范为 datetime-local（含秒）；缺秒时补 :00 */
	private normalizeDatetimeLocal(value: string): string {
		const v = value.trim();
		if (!v) return this.toDatetimeLocal(new Date());
		if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)) return `${v}:00`;
		if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(v)) return v.slice(0, 19);
		const d = new Date(v);
		return Number.isNaN(d.getTime())
			? this.toDatetimeLocal(new Date())
			: this.toDatetimeLocal(d);
	}

	private parseCastTime(): Date {
		if (!this.liuyaoCastLocal) return new Date();
		const d = new Date(this.normalizeDatetimeLocal(this.liuyaoCastLocal));
		return Number.isNaN(d.getTime()) ? new Date() : d;
	}

	getViewType(): string {
		return TIANJI_VIEW_TYPE;
	}

	getDisplayText(): string {
		return '天机匣';
	}

	getIcon(): string {
		return 'dices';
	}

	/** 供命令切换品类页签 */
	setTab(tab: TabId): void {
		if (!this.plugin.getEnabledTabs().includes(tab)) return;
		if (this.activeTab === tab) {
			this.persistActiveTab(tab);
			return;
		}
		this.activeTab = tab;
		this.persistActiveTab(tab);
		this.syncTabs();
		this.renderBody();
	}

	/** 当前页签被关闭时，落到上次有效标签或第一个已启用模块 */
	ensureValidTab(): void {
		const enabled = this.plugin.getEnabledTabs();
		if (enabled.length === 0) return;
		if (!enabled.includes(this.activeTab)) {
			const last = this.plugin.settings.lastActiveTab;
			this.activeTab =
				last && enabled.includes(last) ? last : enabled[0]!;
			this.persistActiveTab(this.activeTab);
			if (this.bodyEl) {
				this.syncTabs();
				this.renderBody();
			}
		}
	}

	/** 设置里改完启用/排序后重建标签栏 */
	applyTabSettings(): void {
		this.ensureValidTab();
		this.render(true);
	}

	async onOpen(): Promise<void> {
		this.ensureValidTab();
		this.render(true);
	}

	async onClose(): Promise<void> {
		this.shellEl = null;
		this.tabsEl = null;
		this.bodyEl = null;
		this.contentEl.empty();
	}

	/** @param full 为 true 时重建整壳（首次打开）；默认只刷新内容区，避免闪烁 */
	private render(full = false): void {
		if (full || !this.shellEl || !this.bodyEl || !this.tabsEl) {
			const root = this.contentEl;
			root.empty();
			root.addClass('tianji-view');

			this.shellEl = root.createDiv({ cls: 'tianji-shell' });
			const header = this.shellEl.createDiv({ cls: 'tianji-header' });
			this.tabsEl = header.createDiv({ cls: 'tianji-tabs' });
			this.buildTabs();
			this.bodyEl = this.shellEl.createDiv({ cls: 'tianji-body' });
		}

		this.syncTabs();
		this.renderBody();
	}

	private renderBody(): void {
		if (!this.bodyEl) {
			this.render(true);
			return;
		}
		this.bodyEl.empty();
		try {
			if (!this.plugin.db?.isReady()) {
				const warn = this.bodyEl.createDiv({
					cls: 'tianji-form tianji-db-warning',
				});
				warn.createEl('p', {
					text: '本地数据库未就绪，历史库与存档暂不可用；起卦界面仍可浏览。可尝试重载插件或更新到最新版。',
				});
			}
			if (this.activeTab === 'liuyao') this.renderLiuyao(this.bodyEl);
			else if (this.activeTab === 'xiaoliuren')
				this.renderXiaoliuren(this.bodyEl);
			else if (this.activeTab === 'meihua') this.renderMeihua(this.bodyEl);
			else if (this.activeTab === 'bazi') this.renderBazi(this.bodyEl);
			else this.renderTarot(this.bodyEl);
		} catch (e) {
			console.error('Tianji render failed', e);
			const err = this.bodyEl.createDiv({ cls: 'tianji-form' });
			err.createEl('p', {
				text: '界面渲染失败，请查看控制台或重新加载插件。',
			});
			err.createEl('p', {
				cls: 'tianji-muted',
				text: String(e),
			});
		}
	}

	private buildTabs(): void {
		if (!this.tabsEl) return;
		this.tabsEl.empty();
		const enabled = this.plugin.getEnabledTabs();
		for (const id of enabled) {
			const meta = DIVINATION_TAB_META[id];
			this.makeTab(this.tabsEl, id, meta.label, meta.icon);
		}
		this.tabsEl.toggleClass('is-single', enabled.length <= 1);
	}

	private syncTabs(): void {
		if (!this.tabsEl) return;
		const buttons = this.tabsEl.querySelectorAll('button.tianji-tab');
		buttons.forEach((btn) => {
			const id = btn.getAttribute('data-tab');
			btn.toggleClass('is-active', id === this.activeTab);
		});
	}

	private makeTab(
		parent: HTMLElement,
		id: TabId,
		label: string,
		iconName: string,
	): void {
		const btn = parent.createEl('button', {
			cls: `tianji-tab${this.activeTab === id ? ' is-active' : ''}`,
			type: 'button',
			attr: { 'data-tab': id },
		});
		const iconWrap = btn.createSpan({ cls: 'tianji-tab-icon' });
		setIcon(iconWrap, iconName);
		btn.createSpan({ cls: 'tianji-tab-label', text: label });
		btn.addEventListener('click', () => {
			if (this.activeTab === id) return;
			this.activeTab = id;
			this.persistActiveTab(id);
			this.syncTabs();
			this.renderBody();
		});
	}

	/* -------------------- 六爻 -------------------- */

	private renderLiuyao(container: HTMLElement): void {
		const workTop =
			this.liuyaoPanel === 'chart'
				? container.createDiv({ cls: 'tianji-work-top' })
				: container;
		this.renderPanelSwitch(workTop, {
			mode: this.liuyaoPanel,
			castLabel: '起卦',
			chartLabel: '排盘',
			libraryLabel: '卦例库',
			type: 'liuyao',
			onChange: (m) => {
				this.liuyaoPanel = m;
				this.renderBody();
			},
		});
		if (this.liuyaoPanel === 'library') {
			this.renderTypeLibrary(container, {
				type: 'liuyao',
				emptyText: '暂无六爻卦例。确认起卦后将自动写入卦例库。',
			});
			return;
		}
		if (this.liuyaoPanel === 'chart') {
			this.renderLiuyaoChart(container, workTop);
			return;
		}
		this.renderLiuyaoCast(container);
	}

	private renderLiuyaoCast(container: HTMLElement): void {
		const stage = container.createDiv({ cls: 'tianji-stage' });
		const form = stage.createDiv({ cls: 'tianji-form tianji-cast-card' });

		const top = form.createDiv({ cls: 'tianji-cast-row' });
		this.field(top, '占测事由', (el) => {
			const input = el.createEl('input', {
				type: 'text',
				cls: 'tianji-input',
				placeholder: '如：事业、感情、财运…',
				value: this.liuyaoSubject,
			});
			input.addEventListener('input', () => {
				this.liuyaoSubject = input.value;
			});
		});
		this.field(top, '性别', (el) => {
			const wrap = el.createDiv({ cls: 'tianji-radio-row' });
			this.radio(wrap, '男', this.liuyaoGender === 'male', () => {
				if (this.liuyaoGender === 'male') return;
				this.liuyaoGender = 'male';
				this.syncChipRow(wrap, '男');
			});
			this.radio(wrap, '女', this.liuyaoGender === 'female', () => {
				if (this.liuyaoGender === 'female') return;
				this.liuyaoGender = 'female';
				this.syncChipRow(wrap, '女');
			});
		});
		this.field(top, '起卦时间', (el) => {
			const input = el.createEl('input', {
				type: 'datetime-local',
				cls: 'tianji-input',
				value: this.normalizeDatetimeLocal(this.liuyaoCastLocal),
			});
			input.step = '1';
			input.addEventListener('change', () => {
				this.liuyaoCastLocal = this.normalizeDatetimeLocal(input.value);
				input.value = this.liuyaoCastLocal;
			});
			const nowBtn = el.createEl('button', {
				cls: 'tianji-btn',
				text: '此刻',
			});
			nowBtn.addEventListener('click', () => {
				this.liuyaoCastLocal = this.toDatetimeLocal(new Date());
				input.value = this.liuyaoCastLocal;
			});
			if (this.liuyaoResult?.ganZhiText) {
				el.createDiv({
					cls: 'tianji-cast-ganzhi',
					text: this.liuyaoResult.ganZhiText,
				});
			}
		});

		this.field(form, '占测问题（必填）', (el) => {
			const ta = el.createEl('textarea', {
				cls: 'tianji-textarea',
				placeholder: '请描述您的具体问题（必填）',
				attr: { required: 'true' },
			});
			ta.value = this.liuyaoQuestion;
			ta.rows = 4;
			ta.addEventListener('input', () => {
				this.liuyaoQuestion = ta.value;
			});
		});

		this.field(form, '起卦方式', (el) => {
			const wrap = el.createDiv({ cls: 'tianji-radio-row' });
			const methods: Array<{ id: LiuyaoMethod; label: string }> = [
				{ id: 'auto', label: '天机起卦' },
				{ id: 'coin', label: '铜钱起卦' },
				{ id: 'manual', label: '手动起卦' },
			];
			for (const m of methods) {
				this.radio(wrap, m.label, this.liuyaoMethod === m.id, () => {
					this.liuyaoMethod = m.id;
					this.liuyaoCoinIndex = 0;
					this.render();
				});
			}
		});

		if (this.liuyaoMethod === 'coin') {
			this.renderCoinCastBoard(form);
		} else if (this.liuyaoMethod === 'manual') {
			const board = form.createDiv({ cls: 'tianji-yao-board' });
			board.createEl('h3', { text: '卦象' });
			for (let display = 5; display >= 0; display--) {
				const row = board.createDiv({ cls: 'tianji-yao-row' });
				row.createSpan({
					cls: 'tianji-yao-pos',
					text: YAO_POSITION_NAMES[display]!,
				});
				const value = this.liuyaoLines[display]!;
				const meta = YAO_LABELS[value]!;
				this.renderYaoBar(row, {
					yang: meta.yang,
					moving: meta.changing,
				});
				const sel = row.createEl('select', {
					cls: 'tianji-select tianji-yao-select',
				});
				([6, 7, 8, 9] as YaoValue[]).forEach((v) => {
					const m = YAO_LABELS[v]!;
					const opt = sel.createEl('option', {
						text: m.name,
						value: String(v),
					});
					if (v === value) opt.selected = true;
				});
				sel.addEventListener('change', () => {
					this.liuyaoLines[display] = Number(sel.value) as YaoValue;
					this.liuyaoResult = null;
					this.render();
				});
			}
		}

		const notes = form.createEl('details', {
			cls: 'tianji-notes',
		});
		notes.open = this.liuyaoMethod !== 'coin';
		notes.createEl('summary', { text: '注意事项' });
		const ul = notes.createEl('ul');
		for (const tip of [
			'心态端正：心平气和、专注一事，勿仓促起卦。',
			'环境安静：选择不被打扰之处，利于意念凝聚。',
			'诚心诚意：认真对待，勿玩笑戏弄求卦。',
			'避免频繁：同一问题短时间内勿反复起卦。',
		]) {
			ul.createEl('li', { text: tip });
		}

		const actions = form.createDiv({ cls: 'tianji-actions tianji-cast-actions' });

		if (this.liuyaoMethod === 'auto') {
			const btn = actions.createEl('button', {
				cls: 'tianji-btn tianji-btn-primary',
				text: '一键排盘',
			});
			btn.addEventListener('click', () => {
				if (!this.requireLiuyaoQuestion()) return;
				this.liuyaoLines = autoCastLines();
				void this.saveLiuyaoCast(
					buildLiuyaoResult({
						lines: [...this.liuyaoLines],
						method: this.liuyaoMethod,
						subject: this.liuyaoSubject,
						gender: this.liuyaoGender,
						question: this.liuyaoQuestion,
						castTime: this.parseCastTime(),
					}),
				);
			});
		}

		if (this.liuyaoMethod === 'manual') {
			const castBtn = actions.createEl('button', {
				cls: 'tianji-btn tianji-btn-primary',
				text: '确认排盘',
			});
			castBtn.addEventListener('click', () => {
				if (!this.requireLiuyaoQuestion()) return;
				try {
					void this.saveLiuyaoCast(
						buildLiuyaoResult({
							lines: [...this.liuyaoLines],
							method: this.liuyaoMethod,
							subject: this.liuyaoSubject,
							gender: this.liuyaoGender,
							question: this.liuyaoQuestion,
							castTime: this.parseCastTime(),
						}),
					);
				} catch (e) {
					new Notice(String(e));
				}
			});
		}
	}

	/** 铜钱起卦：三币 + 爻象条 + 操作栏（适配侧边栏） */
	private renderCoinCastBoard(parent: HTMLElement): void {
		let panel = parent.querySelector(
			'.tianji-coin-panel',
		) as HTMLElement | null;
		if (!panel) {
			panel = parent.createDiv({ cls: 'tianji-coin-panel' });
		} else {
			panel.empty();
		}
		this.fillCoinCastPanel(panel);
	}

	private refreshCoinCastPanel(): void {
		const panel = this.contentEl.querySelector(
			'.tianji-coin-panel',
		) as HTMLElement | null;
		if (!panel) {
			this.renderBody();
			return;
		}
		panel.empty();
		this.fillCoinCastPanel(panel);
	}

	private fillCoinCastPanel(panel: HTMLElement): void {
		const coins = panel.createDiv({ cls: 'tianji-coins' });
		for (const face of this.liuyaoCoinFaces) {
			this.renderCoinEl(coins, face);
		}

		const board = panel.createDiv({ cls: 'tianji-coin-yao-board' });
		for (let display = 5; display >= 0; display--) {
			const filled = display < this.liuyaoCoinIndex;
			const value = filled ? this.liuyaoLines[display]! : null;
			const meta = value != null ? YAO_LABELS[value]! : null;
			const row = board.createDiv({
				cls: `tianji-coin-yao-row${
					display === this.liuyaoCoinIndex && this.liuyaoCoinIndex < 6
						? ' is-current'
						: ''
				}${filled ? ' is-filled' : ''}`,
			});
			row.createSpan({
				cls: 'tianji-yao-pos',
				text: YAO_POSITION_NAMES[display]!,
			});
			const barWrap = row.createDiv({ cls: 'tianji-yao-bar-wrap' });
			if (meta) {
				this.renderYaoBar(barWrap, {
					yang: meta.yang,
					moving: meta.changing,
				});
			} else {
				this.renderYaoBar(barWrap, { yang: true, empty: true });
			}
			row.createSpan({
				cls: 'tianji-yao-name',
				text: meta?.name ?? '—',
			});
		}

		const tip = panel.createDiv({ cls: 'tianji-coin-tip' });
		tip.setText(
			this.liuyaoCoinIndex >= 6
				? '六爻已齐，可一键排盘确认'
				: `请摇第 ${this.liuyaoCoinIndex + 1} 爻（自初爻起）`,
		);

		const bar = panel.createDiv({ cls: 'tianji-coin-actions' });
		const resetBtn = bar.createEl('button', {
			cls: 'tianji-icon-btn',
			type: 'button',
			attr: { 'aria-label': '重置', title: '重置' },
		});
		setIcon(resetBtn, 'rotate-ccw');
		resetBtn.addEventListener('click', () => {
			this.resetCoinCast();
			this.refreshCoinCastPanel();
		});

		const quickBtn = bar.createEl('button', {
			cls: 'tianji-btn tianji-btn-coin-quick',
			text: '一键排盘',
			type: 'button',
		});
		quickBtn.addEventListener('click', () => {
			if (!this.requireLiuyaoQuestion()) return;
			const lines: YaoValue[] = [];
			let lastFaces = this.liuyaoCoinFaces;
			for (let i = 0; i < 6; i++) {
				const r = throwThreeCoinsDetailed();
				lines.push(r.value);
				lastFaces = r.faces;
			}
			this.liuyaoLines = lines;
			this.liuyaoCoinFaces = lastFaces;
			this.liuyaoCoinIndex = 6;
			void this.saveLiuyaoCast(
				buildLiuyaoResult({
					lines: [...lines],
					method: 'coin',
					subject: this.liuyaoSubject,
					gender: this.liuyaoGender,
					question: this.liuyaoQuestion,
					castTime: this.parseCastTime(),
				}),
			);
		});

		const shakeBtn = bar.createEl('button', {
			cls: 'tianji-btn tianji-btn-coin-shake',
			text: this.liuyaoCoinIndex >= 6 ? '重新摇卦' : '摇卦',
			type: 'button',
		});
		shakeBtn.addEventListener('click', () => {
			if (this.liuyaoCoinIndex >= 6) {
				this.resetCoinCast();
				this.refreshCoinCastPanel();
				return;
			}
			const r = throwThreeCoinsDetailed();
			this.liuyaoCoinFaces = r.faces;
			this.liuyaoLines[this.liuyaoCoinIndex] = r.value;
			this.liuyaoCoinIndex += 1;
			this.liuyaoResult = null;
			this.liuyaoRecordId = null;
			this.refreshCoinCastPanel();
		});

		const helpBtn = bar.createEl('button', {
			cls: 'tianji-icon-btn',
			type: 'button',
			attr: { 'aria-label': '说明', title: '铜钱起卦说明' },
		});
		setIcon(helpBtn, 'help-circle');
		helpBtn.addEventListener('click', () => {
			new Notice(
				'字（阳）计 3、背（阴）计 2；三钱之和：6老阴、7少阳、8少阴、9老阳。自初爻摇至上爻。',
				8000,
			);
		});

		if (this.liuyaoCoinIndex >= 6) {
			const confirm = panel.createDiv({ cls: 'tianji-coin-confirm' });
			const castBtn = confirm.createEl('button', {
				cls: 'tianji-btn tianji-btn-primary',
				text: '确认排盘',
				type: 'button',
			});
			castBtn.addEventListener('click', () => {
				if (!this.requireLiuyaoQuestion()) return;
				void this.saveLiuyaoCast(
					buildLiuyaoResult({
						lines: [...this.liuyaoLines],
						method: 'coin',
						subject: this.liuyaoSubject,
						gender: this.liuyaoGender,
						question: this.liuyaoQuestion,
						castTime: this.parseCastTime(),
					}),
				);
			});
		}
	}

	private renderCoinEl(parent: HTMLElement, face: CoinFace): void {
		const coin = parent.createDiv({
			cls: `tianji-coin${face === 'yang' ? ' is-yang' : ' is-yin'}`,
		});
		coin.createDiv({ cls: 'tianji-coin-ring' });
		coin.createDiv({ cls: 'tianji-coin-hole' });
		if (face === 'yang') {
			const faceEl = coin.createDiv({ cls: 'tianji-coin-face' });
			faceEl.createSpan({ text: '乾' });
			faceEl.createSpan({ text: '隆' });
			faceEl.createSpan({ text: '通' });
			faceEl.createSpan({ text: '寶' });
		} else {
			coin.createDiv({ cls: 'tianji-coin-manchu', text: 'ᠪᠣᠣ' });
		}
	}

	private resetCoinCast(): void {
		this.liuyaoCoinIndex = 0;
		this.liuyaoLines = [7, 7, 7, 7, 7, 7];
		this.liuyaoCoinFaces = ['yang', 'yin', 'yang'];
		this.liuyaoResult = null;
		this.liuyaoRecordId = null;
	}

	private renderLiuyaoChart(
		container: HTMLElement,
		topBar?: HTMLElement,
	): void {
		const stage = container.createDiv({ cls: 'tianji-stage tianji-chart-stage' });
		if (!this.liuyaoResult) {
			this.renderChartEmpty(stage, '尚未排盘。请先在「起卦」完成起卦。', '去起卦', () => {
				this.liuyaoPanel = 'cast';
				this.render();
			});
			return;
		}

		const r = this.liuyaoResult;
		const toolbar = (topBar ?? stage).createDiv({ cls: 'tianji-chart-toolbar' });
		const backBtn = toolbar.createEl('button', {
			cls: 'tianji-btn',
			text: '返回起卦',
		});
		backBtn.addEventListener('click', () => {
			this.liuyaoPanel = 'cast';
			this.render();
		});
		const copyBtn = toolbar.createEl('button', {
			cls: 'tianji-btn tianji-btn-primary',
			text: '复制排盘',
		});
		copyBtn.addEventListener('click', () => {
			void this.copyText(r.chartText, '排盘已复制');
		});
		this.appendFavoriteToolbarBtn(toolbar, this.liuyaoRecordId);

		const card = stage.createDiv({ cls: 'tianji-result-card tianji-liuyao-result' });

		const info = card.createDiv({ cls: 'tianji-liuyao-info' });
		info.createEl('h4', { text: '基本信息' });
		const infoGrid = info.createDiv({ cls: 'tianji-liuyao-info-grid' });
		const subject =
			r.question.trim()
				? `${r.subject || '问事'}（${r.question.trim()}）`
				: r.subject || '问事';
		this.addInfoCell(infoGrid, '占测事由', subject);
		this.addInfoCell(infoGrid, '起卦时间', r.solarText);
		this.addInfoCell(infoGrid, '方式', this.liuyaoMethodLabel(r.method));
		this.addInfoCell(infoGrid, '干支历', r.ganZhiText);

		const boards = card.createDiv({
			cls: `tianji-liuyao-boards${r.changed ? '' : ' is-static'}`,
		});

		const ben = boards.createDiv({ cls: 'tianji-liuyao-board' });
		ben.createDiv({
			cls: 'tianji-liuyao-board-title',
			text: `本卦【${r.original.alias}】`,
		});
		for (let i = 5; i >= 0; i--) {
			const row = r.yaoRows[i]!;
			const { liuqin, ganzhi } = splitNajiaText(row.benText);
			this.renderLiuyaoBoardLine(ben, {
				showLiuShen: true,
				liuShen: row.liuShen,
				liuqin,
				ganzhi,
				yang: YAO_LABELS[row.value]?.yang ?? true,
				moving: row.isMoving,
				movingMark: row.value === 9 ? '○' : row.value === 6 ? '✕' : '',
				role: row.isShi ? '世' : row.isYing ? '应' : '',
			});
		}

		if (r.changed) {
			const bian = boards.createDiv({ cls: 'tianji-liuyao-board' });
			bian.createDiv({
				cls: 'tianji-liuyao-board-title',
				text: `变卦【${r.changed.alias}】`,
			});
			for (let i = 5; i >= 0; i--) {
				const row = r.yaoRows[i]!;
				const { liuqin, ganzhi } = splitNajiaText(row.bianText);
				let yang = YAO_LABELS[row.value]?.yang ?? true;
				if (row.isMoving) yang = !yang;
				this.renderLiuyaoBoardLine(bian, {
					showLiuShen: false,
					liuShen: '',
					liuqin,
					ganzhi,
					yang,
					moving: false,
					movingMark: '',
					role: '',
				});
			}
		}

		this.renderLiuyaoSimpleAnalysis(stage, r);
		this.appendReadingNoteSection(stage, this.liuyaoRecordId);
	}

	private renderLiuyaoSimpleAnalysis(
		parent: HTMLElement,
		r: LiuyaoResult,
	): void {
		const section = parent.createDiv({ cls: 'tianji-simple-analysis' });
		section.createEl('h3', {
			cls: 'tianji-simple-analysis-title',
			text: '简易分析',
		});

		const originalText = getZhouyiByBinary(r.original.binary);
		if (originalText) {
			this.renderZhouyiCard(section, r.original.alias, originalText, r);
		}

		const guaXiang = section.createDiv({ cls: 'tianji-analysis-block' });
		guaXiang.createDiv({ cls: 'tianji-analysis-block-title', text: '卦象' });
		guaXiang.createDiv({
			cls: 'tianji-analysis-block-body',
			text: r.changed
				? `${r.original.alias}之${r.changed.alias}`
				: `${r.original.alias}卦`,
		});

		const interpret = section.createDiv({ cls: 'tianji-analysis-block' });
		interpret.createDiv({ cls: 'tianji-analysis-block-title', text: '解释' });
		interpret.createDiv({
			cls: 'tianji-analysis-block-body',
			text: this.buildLiuyaoInterpretation(r),
		});

		const advice = section.createDiv({ cls: 'tianji-analysis-block' });
		advice.createDiv({ cls: 'tianji-analysis-block-title', text: '建议' });
		advice.createDiv({
			cls: 'tianji-analysis-block-body',
			text: this.buildLiuyaoAdvice(r),
		});
	}

	private renderZhouyiCard(
		parent: HTMLElement,
		alias: string,
		text: ZhouyiText,
		r: LiuyaoResult,
	): void {
		const details = parent.createEl('details', {
			cls: 'tianji-zhouyi-card',
		});
		details.open = true;
		details.createEl('summary', { text: `《周易》- ${alias}` });

		const body = details.createDiv({ cls: 'tianji-zhouyi-body' });

		const guaCi = body.createDiv({ cls: 'tianji-zhouyi-section' });
		guaCi.createDiv({ cls: 'tianji-zhouyi-h', text: '卦辞' });
		guaCi.createDiv({
			cls: 'tianji-zhouyi-p',
			text: text.guaCi.replace(
				new RegExp(`^${text.name}[：:]\\s*`),
				`${alias}：`,
			),
		});

		const explain = body.createDiv({ cls: 'tianji-zhouyi-section' });
		explain.createDiv({ cls: 'tianji-zhouyi-h', text: '卦辞解释' });
		explain.createDiv({
			cls: 'tianji-zhouyi-p',
			text: `彖曰：${text.tuanCi}`,
		});
		explain.createDiv({
			cls: 'tianji-zhouyi-p',
			text: `象曰：${text.daXiang}`,
		});

		const yao = body.createDiv({ cls: 'tianji-zhouyi-section' });
		yao.createDiv({ cls: 'tianji-zhouyi-h', text: '爻辞' });
		const moving = new Set(r.movingPositions);
		const lineCount = Math.min(6, text.yaoCi.length);
		for (let i = 0; i < lineCount; i++) {
			const item = yao.createDiv({
				cls: `tianji-zhouyi-yao${moving.has(i + 1) ? ' is-moving' : ''}`,
			});
			item.createDiv({
				cls: 'tianji-zhouyi-p',
				text: text.yaoCi[i] ?? '',
			});
			const xiang = text.xiaoXiang[i];
			if (xiang) {
				item.createDiv({
					cls: 'tianji-zhouyi-p is-xiang',
					text: `象曰：${xiang}`,
				});
			}
		}
	}

	private buildLiuyaoInterpretation(r: LiuyaoResult): string {
		const parts: string[] = [];
		parts.push(
			`本卦为${r.original.alias}，象曰「${r.original.nature}」。`,
		);
		if (r.changed) {
			const names = r.movingPositions
				.map((p) => YAO_POSITION_NAMES[p - 1] ?? `第${p}爻`)
				.join('、');
			parts.push(
				`动爻在${names}，变卦为${r.changed.alias}，象曰「${r.changed.nature}」。`,
			);
			parts.push(
				`事体由「${r.original.nature}」转向「${r.changed.nature}」，宜就动爻所在之位审情取舍。`,
			);
		} else {
			parts.push('六爻安静，事体相对稳定，宜按本卦之象审度当下。');
		}
		return parts.join('');
	}

	private buildLiuyaoAdvice(r: LiuyaoResult): string {
		if (!r.changed) {
			return `卦象未动，宜守「${r.original.nature}」之本，循势而行，不宜强求骤变。`;
		}
		const moveHint =
			r.movingPositions.length === 1
				? '一爻独发，事机较专，可就该爻辞细参。'
				: r.movingPositions.length >= 3
					? '多爻齐动，事机纷繁，宜把握大势，勿拘泥一端。'
					: '两爻发动，情势有转机，宜因时进退。';
		return `本卦「${r.original.nature}」，变趋「${r.changed.nature}」。${moveHint}行事当兼顾始终，既守其常，亦顺其变。`;
	}

	private addInfoCell(parent: HTMLElement, label: string, value: string): void {
		const cell = parent.createDiv({ cls: 'tianji-liuyao-info-cell' });
		cell.createSpan({ cls: 'tianji-liuyao-info-label', text: `${label}：` });
		cell.createSpan({ cls: 'tianji-liuyao-info-value', text: value });
	}

	private liuyaoMethodLabel(method: LiuyaoMethod): string {
		switch (method) {
			case 'auto':
				return '天机起卦';
			case 'coin':
				return '铜钱起卦';
			case 'manual':
				return '手动起卦';
		}
	}

	/** 阳爻实线 / 阴爻断线；empty 为未摇占位 */
	private renderYaoBar(
		parent: HTMLElement,
		opts: { yang: boolean; moving?: boolean; empty?: boolean },
	): HTMLElement {
		const visual = parent.createDiv({
			cls: `tianji-yao-visual${
				opts.empty ? ' is-empty' : opts.yang ? ' is-yang' : ' is-yin'
			}${opts.moving ? ' is-moving' : ''}`,
		});
		if (opts.empty || opts.yang) {
			visual.createDiv({ cls: 'tianji-yao-seg' });
		} else {
			visual.createDiv({ cls: 'tianji-yao-seg' });
			visual.createDiv({ cls: 'tianji-yao-seg' });
		}
		return visual;
	}

	private renderLiuyaoBoardLine(
		parent: HTMLElement,
		opts: {
			showLiuShen: boolean;
			liuShen: string;
			liuqin: string;
			ganzhi: string;
			yang: boolean;
			moving: boolean;
			movingMark: string;
			role: string;
		},
	): void {
		const line = parent.createDiv({
			cls: `tianji-liuyao-line${opts.showLiuShen ? ' has-liushen' : ''}`,
		});
		if (opts.showLiuShen) {
			line.createSpan({ cls: 'tianji-ll-liushen', text: opts.liuShen });
		}
		line.createSpan({ cls: 'tianji-ll-liuqin', text: opts.liuqin });
		line.createSpan({ cls: 'tianji-ll-ganzhi', text: opts.ganzhi });

		this.renderYaoBar(line, { yang: opts.yang, moving: opts.moving });

		const marks = line.createDiv({ cls: 'tianji-ll-marks' });
		if (opts.movingMark) {
			marks.createSpan({
				cls: 'tianji-ll-move',
				text: opts.movingMark,
			});
		}
		if (opts.role) {
			marks.createSpan({ cls: 'tianji-ll-role', text: opts.role });
		}
	}

	private requireLiuyaoQuestion(): boolean {
		if (this.liuyaoQuestion.trim()) return true;
		new Notice('占测问题不能为空');
		return false;
	}

	private async saveLiuyaoCast(result: LiuyaoResult): Promise<void> {
		if (!this.requireLiuyaoQuestion()) return;
		this.liuyaoResult = result;
		this.liuyaoPanel = 'chart';
		const title =
			this.liuyaoSubject ||
			this.liuyaoQuestion.slice(0, 20) ||
			result.original.alias ||
			'六爻占卜';
		try {
			this.liuyaoRecordId = await this.plugin.db.insertReading({
				type: 'liuyao',
				title,
				inputJson: JSON.stringify({
					subject: this.liuyaoSubject,
					gender: this.liuyaoGender,
					question: this.liuyaoQuestion,
					method: this.liuyaoMethod,
					castTime: result.castTime,
				}),
				resultJson: JSON.stringify(result),
			});
			this.render();
			new Notice(
				`已存档：${result.original.alias}${
					result.changed ? `之${result.changed.alias}` : ''
				}`,
			);
		} catch (e) {
			this.render();
			new Notice(`排盘已出，存档失败：${String(e)}`);
		}
	}

	/* -------------------- 八字 -------------------- */

	private renderBazi(container: HTMLElement): void {
		const workTop =
			this.baziPanel === 'chart'
				? container.createDiv({ cls: 'tianji-work-top' })
				: container;
		this.renderPanelSwitch(workTop, {
			mode: this.baziPanel,
			castLabel: '起盘',
			chartLabel: '命盘',
			libraryLabel: '命理库',
			type: 'bazi',
			onChange: (m) => {
				this.baziPanel = m;
				this.render();
			},
		});
		if (this.baziPanel === 'library') {
			this.renderTypeLibrary(container, {
				type: 'bazi',
				emptyText: '暂无八字命盘。排盘后点击「添加命理库」保存。',
			});
			return;
		}
		if (this.baziPanel === 'chart') {
			this.renderBaziChartPage(container, workTop);
			return;
		}

		const stage = container.createDiv({ cls: 'tianji-stage' });
		const form = stage.createDiv({ cls: 'tianji-form tianji-cast-card' });

		const identity = form.createDiv({
			cls: 'tianji-cast-row is-2',
		});
		this.field(identity, '姓名', (el) => {
			const input = el.createEl('input', {
				type: 'text',
				cls: 'tianji-input',
				placeholder: '必填，如：张三',
				value: this.baziName,
			});
			input.addEventListener('input', () => {
				this.baziName = input.value;
			});
		});
		this.field(identity, '关系', (el) => {
			const sel = el.createEl('select', { cls: 'tianji-select' });
			for (const rel of [
				'本人',
				'父亲',
				'母亲',
				'配偶',
				'子女',
				'兄弟',
				'姐妹',
				'朋友',
				'客户',
				'其他',
			]) {
				const opt = sel.createEl('option', { text: rel, value: rel });
				if (rel === this.baziRelation) opt.selected = true;
			}
			sel.addEventListener('change', () => {
				this.baziRelation = sel.value;
			});
		});

		const top = form.createDiv({ cls: 'tianji-cast-row' });
		this.field(top, '性别', (el) => {
			const wrap = el.createDiv({ cls: 'tianji-radio-row' });
			this.radio(wrap, '男', this.baziGender === 'male', () => {
				if (this.baziGender === 'male') return;
				this.baziGender = 'male';
				this.syncChipRow(wrap, '男');
			});
			this.radio(wrap, '女', this.baziGender === 'female', () => {
				if (this.baziGender === 'female') return;
				this.baziGender = 'female';
				this.syncChipRow(wrap, '女');
			});
		});

		this.field(top, '历法', (el) => {
			const wrap = el.createDiv({ cls: 'tianji-radio-row' });
			this.radio(wrap, '阳历', this.baziCalendar === 'solar', () => {
				if (this.baziCalendar === 'solar' && !this.baziLeapMonth)
					return;
				this.baziCalendar = 'solar';
				this.baziLeapMonth = false;
				this.renderBody();
			});
			this.radio(wrap, '阴历', this.baziCalendar === 'lunar', () => {
				if (this.baziCalendar === 'lunar') return;
				this.baziCalendar = 'lunar';
				this.renderBody();
			});
			if (this.baziCalendar === 'lunar') {
				this.radio(wrap, '闰月', this.baziLeapMonth, () => {
					this.baziLeapMonth = !this.baziLeapMonth;
					wrap.querySelectorAll('button.tianji-chip').forEach((btn) => {
						const label = btn.getAttribute('data-chip');
						if (label === '阳历') btn.toggleClass('is-active', false);
						if (label === '阴历') btn.toggleClass('is-active', true);
						if (label === '闰月')
							btn.toggleClass('is-active', this.baziLeapMonth);
					});
				});
			}
		});

		this.field(
			form,
			this.baziCalendar === 'lunar' ? '出生日期（农历）' : '出生日期（公历）',
			(el) => {
				const input = el.createEl('input', {
					type: 'date',
					cls: 'tianji-input',
					value: this.baziDate,
				});
				input.addEventListener('change', () => {
					this.baziDate = input.value;
				});
			},
		);

		this.field(form, '出生时间', (el) => {
			const input = el.createEl('input', {
				type: 'time',
				cls: 'tianji-input',
				value: this.baziTime,
			});
			input.addEventListener('change', () => {
				this.baziTime = input.value;
			});
		});

		this.field(form, '出生地点', (el) => {
			const sel = el.createEl('select', {
				cls: 'tianji-select tianji-select-city',
			});
			for (const city of CITIES) {
				const label = city.province
					? `${city.name} · ${city.province}`
					: city.name;
				const opt = sel.createEl('option', {
					text: label,
					value: city.name,
					attr: { title: label },
				});
				if (city.name === this.baziCity) opt.selected = true;
			}
			sel.title =
				sel.selectedOptions[0]?.text ??
				sel.value;
			sel.addEventListener('change', () => {
				this.baziCity = sel.value;
				sel.title = sel.selectedOptions[0]?.text ?? sel.value;
			});
		});

		this.field(form, '真太阳时', (el) => {
			const wrap = el.createDiv({ cls: 'tianji-radio-row' });
			this.radio(wrap, '关闭', !this.baziTrueSolar, () => {
				if (!this.baziTrueSolar) return;
				this.baziTrueSolar = false;
				this.syncChipRow(wrap, '关闭');
			});
			this.radio(wrap, '开启', this.baziTrueSolar, () => {
				if (this.baziTrueSolar) return;
				this.baziTrueSolar = true;
				this.syncChipRow(wrap, '开启');
			});
			el.createDiv({
				cls: 'tianji-tip',
				text: '开启后按出生地经度与均时差校正；未知地点不校正',
			});
		});

		this.field(form, '关注问题（可选）', (el) => {
			const ta = el.createEl('textarea', {
				cls: 'tianji-textarea',
				placeholder: '如：事业方向、婚姻时机、健康注意…',
			});
			ta.value = this.baziQuestion;
			ta.rows = 2;
			ta.addEventListener('input', () => {
				this.baziQuestion = ta.value;
			});
		});

		const actions = form.createDiv({
			cls: 'tianji-actions tianji-cast-actions',
		});
		const calcBtn = actions.createEl('button', {
			cls: 'tianji-btn tianji-btn-primary',
			text: '确定排盘',
		});
		calcBtn.addEventListener('click', () => {
			try {
				if (!this.requireBaziName()) return;
				this.applyBaziChart(this.getBaziChart(), false);
			} catch (e) {
				new Notice(String(e));
			}
		});
		const saveBtn = actions.createEl('button', {
			cls: 'tianji-btn',
			text: '添加命理库',
		});
		saveBtn.addEventListener('click', () => {
			try {
				if (!this.requireBaziName()) return;
				void this.addBaziToLibrary(this.getBaziChart());
			} catch (e) {
				new Notice(String(e));
			}
		});
	}

	private renderBaziChartPage(
		container: HTMLElement,
		topBar?: HTMLElement,
	): void {
		const stage = container.createDiv({
			cls: 'tianji-stage tianji-chart-stage',
		});
		if (!this.baziChart) {
			this.renderChartEmpty(
				stage,
				'尚未排盘。请先在「起盘」填写信息并确认。',
				'去起盘',
				() => {
					this.baziPanel = 'cast';
					this.render();
				},
			);
			return;
		}

		const toolbar = (topBar ?? stage).createDiv({ cls: 'tianji-chart-toolbar' });
		const backBtn = toolbar.createEl('button', {
			cls: 'tianji-btn',
			text: '返回起盘',
		});
		backBtn.addEventListener('click', () => {
			this.baziPanel = 'cast';
			this.render();
		});
		if (this.baziRecordId == null) {
			const addLib = toolbar.createEl('button', {
				cls: 'tianji-btn tianji-btn-primary',
				text: '添加命理库',
			});
			addLib.addEventListener('click', () => {
				if (!this.baziChart) return;
				if (!this.requireBaziName()) return;
				void this.addBaziToLibrary(this.baziChart);
			});
		}
		this.appendFavoriteToolbarBtn(toolbar, this.baziRecordId);

		this.renderBaziChart(stage, this.baziChart);
		this.appendReadingNoteSection(stage, this.baziRecordId);
	}

	private renderBaziChart(
		container: HTMLElement,
		chart: BaziProfessionalChart,
	): void {
		const card = container.createDiv({ cls: 'tianji-result-card' });
		const titleRow = card.createDiv({ cls: 'tianji-result-title-row' });
		titleRow.createEl('h3', { text: '专业命盘' });
		const copyBtn = titleRow.createEl('button', {
			cls: 'tianji-btn tianji-btn-primary',
			text: '复制排盘',
		});
		copyBtn.addEventListener('click', () => {
			void this.copyText(formatBaziChartText(chart), '八字排盘已复制');
		});

		const info = card.createDiv({ cls: 'tianji-bazi-info' });
		const nameLine = [
			this.baziName.trim() || '未命名',
			this.baziRelation,
			chart.gender === 'male' ? '男' : '女',
		].join(' · ');
		info.createDiv({
			cls: 'tianji-bazi-name-line',
			text: nameLine,
		});
		info.createDiv({
			text: `历法：${chart.calendar === 'lunar' ? '农历' : '公历'}　地点：${chart.cityName}`,
		});
		if (this.baziQuestion.trim()) {
			info.createDiv({ text: `关注：${this.baziQuestion.trim()}` });
		}
		info.createDiv({ text: `公历：${chart.solarText}` });
		info.createDiv({ text: `农历：${chart.lunarText}` });
		if (chart.trueSolarText) {
			info.createDiv({
				text: `真太阳时：${chart.trueSolarText}（${chart.trueSolarDetail}）`,
			});
		} else {
			info.createDiv({ text: chart.trueSolarDetail });
		}
		info.createDiv({ cls: 'tianji-bazi-daymaster' });
		const dmLine = info.lastElementChild as HTMLElement;
		dmLine.createSpan({ text: '日主：' });
		this.appendWuxingText(dmLine, chart.dayMaster);
		this.appendWuxingText(dmLine, chart.dayMasterElement);
		dmLine.createSpan({ text: '　五行：' });
		dmLine.createSpan({ text: chart.wuxingText });

		info.createDiv({
			text: `胎元：${chart.taiyuan}　命宫：${chart.minggong}　身宫：${chart.shengong}`,
		});
		info.createDiv({ text: `起运：${chart.qiyunText}` });

		card.createEl('h4', { cls: 'tianji-bazi-section', text: '基本命盘' });
		const table = card.createEl('table', { cls: 'tianji-bazi-table' });
		const colgroup = table.createEl('colgroup');
		colgroup.createEl('col', { cls: 'tianji-bazi-label-col' });
		for (let i = 0; i < 4; i++) {
			colgroup.createEl('col');
		}
		const thead = table.createEl('thead');
		const hr = thead.createEl('tr');
		hr.createEl('th', { text: '' });
		for (const name of ['年柱', '月柱', '日柱', '时柱']) {
			hr.createEl('th', { text: name });
		}

		const pillars = [chart.year, chart.month, chart.day, chart.hour];
		const tbody = table.createEl('tbody');
		const addRow = (label: string, cells: string[], cls?: string) => {
			const tr = tbody.createEl('tr');
			tr.createEl('th', { text: label });
			for (const c of cells) {
				const td = tr.createEl('td', { text: c });
				if (cls) td.addClass(cls);
			}
		};
		const addWuxingRow = (
			label: string,
			cells: string[],
			cls?: string,
		) => {
			const tr = tbody.createEl('tr');
			tr.createEl('th', { text: label });
			for (const c of cells) {
				const td = tr.createEl('td');
				if (cls) td.addClass(cls);
				this.appendWuxingText(td, c);
			}
		};

		addRow('主星', pillars.map((p) => p.mainStar), 'tianji-bazi-star');
		addWuxingRow(
			'天干',
			pillars.map((p) => p.stem),
			'tianji-bazi-gan',
		);
		addWuxingRow(
			'地支',
			pillars.map((p) => p.branch),
			'tianji-bazi-zhi',
		);
		addWuxingRow(
			'五行',
			pillars.map((p) => `${p.stemElement}${p.branchElement}`),
		);
		addRow(
			'藏干',
			pillars.map((p) =>
				p.hidden.map((h) => `${h.stem}(${h.shiShen})`).join(' '),
			),
		);
		addRow('纳音', pillars.map((p) => p.nayin));
		addRow('星运', pillars.map((p) => p.changsheng));
		addRow('空亡', pillars.map((p) => p.xunkong));
		addRow('神煞', pillars.map((p) => p.shensha.join('、') || '—'));

		// 大运（可点选）
		card.createEl('h4', {
			cls: 'tianji-bazi-section',
			text: '专业细盘 · 大运（点击切换流年）',
		});
		if (this.baziSelectedDayun >= chart.dayun.length) {
			this.baziSelectedDayun = Math.min(1, chart.dayun.length - 1);
		}
		const duWrap = card.createDiv({ cls: 'tianji-dayun-row' });
		chart.dayun.forEach((du, idx) => {
			if (!du.label) return;
			const cell = duWrap.createDiv({
				cls: `tianji-dayun-cell${idx === this.baziSelectedDayun ? ' is-active' : ''}`,
			});
			cell.createDiv({ cls: 'tianji-dayun-age', text: `${du.startAge}岁` });
			const gz = cell.createDiv({ cls: 'tianji-dayun-gz' });
			this.appendWuxingText(gz, du.label);
			cell.createDiv({ cls: 'tianji-dayun-star', text: du.shiShen });
			cell.createDiv({
				cls: 'tianji-dayun-year',
				text: `${du.startYear}-${du.endYear}`,
			});
			cell.addEventListener('click', () => {
				this.baziSelectedDayun = idx;
				this.baziSelectedLiunian = 0;
				this.render();
			});
		});

		const selected = chart.dayun[this.baziSelectedDayun];
		if (selected?.liuNian?.length) {
			card.createEl('h4', {
				cls: 'tianji-bazi-section',
				text: `流年 · ${selected.label}运`,
			});
			const lnWrap = card.createDiv({ cls: 'tianji-dayun-row' });
			selected.liuNian.forEach((ln, idx) => {
				const cell = lnWrap.createDiv({
					cls: `tianji-dayun-cell tianji-liunian-cell${idx === this.baziSelectedLiunian ? ' is-active' : ''}`,
				});
				cell.createDiv({
					cls: 'tianji-dayun-age',
					text: `${ln.year}`,
				});
				const gz = cell.createDiv({ cls: 'tianji-dayun-gz' });
				this.appendWuxingText(gz, ln.label);
				cell.createDiv({
					cls: 'tianji-dayun-star',
					text: ln.shiShen,
				});
				cell.createDiv({
					cls: 'tianji-dayun-year',
					text: `${ln.age}岁`,
				});
				cell.addEventListener('click', () => {
					this.baziSelectedLiunian = idx;
					this.render();
				});
			});

			const ln =
				selected.liuNian[this.baziSelectedLiunian] ?? selected.liuNian[0];
			if (ln?.liuYue?.length) {
				card.createEl('h4', {
					cls: 'tianji-bazi-section',
					text: `流月 · ${ln.year}年 ${ln.label}`,
				});
				const lyWrap = card.createDiv({ cls: 'tianji-liuyue-grid' });
				const monthNames = [
					'寅', '卯', '辰', '巳', '午', '未',
					'申', '酉', '戌', '亥', '子', '丑',
				];
				ln.liuYue.forEach((ly, i) => {
					const cell = lyWrap.createDiv({ cls: 'tianji-liuyue-cell' });
					cell.createDiv({
						cls: 'tianji-liuyue-m',
						text: `${monthNames[i] ?? i + 1}月`,
					});
					const gz = cell.createDiv({ cls: 'tianji-liuyue-gz' });
					this.appendWuxingText(gz, ly.label);
					cell.createDiv({
						cls: 'tianji-liuyue-star',
						text: ly.shiShen,
					});
				});
			}
		}
	}

	/** 按五行给天干地支（及五行字）上色 */
	private appendWuxingText(parent: HTMLElement, text: string): void {
		const wxClass: Record<WuXing, string> = {
			木: 'mu',
			火: 'huo',
			土: 'tu',
			金: 'jin',
			水: 'shui',
		};
		for (const ch of text) {
			const wx =
				wuxingOfChar(ch) ??
				(ch === '木' ||
				ch === '火' ||
				ch === '土' ||
				ch === '金' ||
				ch === '水'
					? (ch as WuXing)
					: null);
			if (wx) {
				parent.createSpan({
					cls: `tianji-wx tianji-wx-${wxClass[wx]}`,
					text: ch,
				});
			} else {
				parent.createSpan({ text: ch });
			}
		}
	}

	private getBaziChart(): BaziProfessionalChart {
		if (!this.baziDate) throw new Error('请选择出生日期');
		const [y, m, d] = this.baziDate.split('-').map(Number);
		const [hh, mm] = (this.baziTime || '12:00').split(':').map(Number);
		if (!y || !m || !d) throw new Error('出生日期无效');
		let month = m;
		if (this.baziCalendar === 'lunar' && this.baziLeapMonth) {
			month = -Math.abs(m);
		}
		return calculateBazi({
			gender: this.baziGender,
			calendar: this.baziCalendar,
			year: y,
			month,
			day: d,
			hour: hh ?? 12,
			minute: mm ?? 0,
			cityName: this.baziCity,
			useTrueSolar: this.baziTrueSolar,
		});
	}

	private baziInputSnapshot() {
		return {
			name: this.baziName,
			relation: this.baziRelation,
			gender: this.baziGender,
			calendar: this.baziCalendar,
			leapMonth: this.baziLeapMonth,
			date: this.baziDate,
			time: this.baziTime,
			city: this.baziCity,
			trueSolar: this.baziTrueSolar,
			question: this.baziQuestion,
		};
	}

	private requireBaziName(): boolean {
		if (this.baziName.trim()) return true;
		new Notice('请填写姓名');
		return false;
	}

	private baziLibraryTitle(chart: BaziProfessionalChart): string {
		const name = this.baziName.trim() || '未命名';
		const pillars = `${chart.year.label}${chart.month.label}${chart.day.label}${chart.hour.label}`;
		return `${name}（${this.baziRelation}）· ${pillars}`;
	}

	/** 仅排盘预览，不写入命理库 */
	private applyBaziChart(
		chart: BaziProfessionalChart,
		keepRecordId: boolean,
	): void {
		this.baziChart = chart;
		this.baziPanel = 'chart';
		if (!keepRecordId) this.baziRecordId = null;
		const idx = chart.dayun.findIndex((d) => d.liuNian?.length);
		this.baziSelectedDayun =
			idx >= 0 ? idx : Math.min(1, chart.dayun.length - 1);
		this.baziSelectedLiunian = 0;
		this.render();
		new Notice(
			`排盘完成：${chart.year.label} ${chart.month.label} ${chart.day.label} ${chart.hour.label}`,
		);
	}

	/** 写入命理库并打开命盘 */
	private async addBaziToLibrary(chart: BaziProfessionalChart): Promise<void> {
		this.baziChart = chart;
		this.baziPanel = 'chart';
		const idx = chart.dayun.findIndex((d) => d.liuNian?.length);
		this.baziSelectedDayun =
			idx >= 0 ? idx : Math.min(1, chart.dayun.length - 1);
		this.baziSelectedLiunian = 0;
		try {
			this.baziRecordId = await this.plugin.db.insertReading({
				type: 'bazi',
				title: this.baziLibraryTitle(chart),
				inputJson: JSON.stringify(this.baziInputSnapshot()),
				resultJson: JSON.stringify(chart),
			});
			this.render();
			new Notice(`已加入命理库：${this.baziName.trim() || '未命名'}`);
		} catch (e) {
			this.render();
			new Notice(`存档失败：${String(e)}`);
		}
	}

	/* -------------------- 塔罗 -------------------- */

	private renderTarot(container: HTMLElement): void {
		const workTop =
			this.tarotPanel === 'chart'
				? container.createDiv({ cls: 'tianji-work-top' })
				: container;
		this.renderPanelSwitch(workTop, {
			mode: this.tarotPanel,
			castLabel: '抽牌',
			chartLabel: '牌阵',
			libraryLabel: '牌阵库',
			type: 'tarot',
			onChange: (m) => {
				this.tarotPanel = m;
				this.render();
			},
		});
		if (this.tarotPanel === 'library') {
			this.renderTypeLibrary(container, {
				type: 'tarot',
				emptyText: '暂无塔罗牌阵。洗牌抽牌后将自动写入牌阵库。',
			});
			return;
		}
		if (this.tarotPanel === 'chart') {
			this.renderTarotChartPage(container, workTop);
			return;
		}

		const stage = container.createDiv({ cls: 'tianji-stage' });

		const form = stage.createDiv({ cls: 'tianji-form tianji-cast-card' });

		if (this.tarotSessionUsedIds.length > 0) {
			const sessionBar = form.createDiv({ cls: 'tianji-tarot-session-bar' });
			const remain = remainingTarotDeck(this.tarotSessionUsedIds).length;
			sessionBar.createDiv({
				cls: 'tianji-tarot-session-meta',
				text: `本局已用 ${this.tarotSessionUsedIds.length} 张 · 剩余 ${remain} 张（续问从此牌组抽）`,
			});
			const newGame = sessionBar.createEl('button', {
				cls: 'tianji-tarot-session-close',
				type: 'button',
				attr: {
					title: '新开一局',
					'aria-label': '新开一局',
				},
			});
			setIcon(newGame, 'x');
			newGame.addEventListener('click', () => {
				this.startFreshTarotSession();
				new Notice('已整副重洗，开始新一局');
				this.render();
			});
		}

		this.field(form, '占测事由', (el) => {
			const input = el.createEl('input', {
				type: 'text',
				cls: 'tianji-input',
				placeholder: '如：事业、感情、财运…',
				value: this.tarotSubject,
			});
			input.addEventListener('input', () => {
				this.tarotSubject = input.value;
			});
		});

		this.field(form, '占测问题（必填）', (el) => {
			const ta = el.createEl('textarea', {
				cls: 'tianji-textarea',
				placeholder: '请描述您的具体问题（必填）',
				attr: { required: 'true' },
			});
			ta.value = this.tarotQuestion;
			ta.rows = 3;
			ta.addEventListener('input', () => {
				this.tarotQuestion = ta.value;
			});
		});

		this.field(form, '牌阵方式', (el) => {
			const wrap = el.createDiv({ cls: 'tianji-spread-grid' });
			for (const s of TAROT_SPREADS) {
				const countHint = isFlexibleSpread(s)
					? '任意张数'
					: `${s.positions.length} 张`;
				const btn = wrap.createEl('button', {
					cls: `tianji-spread-chip${this.tarotSpreadId === s.id ? ' is-active' : ''}`,
					type: 'button',
					text: s.name,
					attr: {
						title: `${countHint} · ${s.desc}`,
					},
				});
				btn.addEventListener('click', () => {
					if (this.tarotSpreadId === s.id) return;
					this.tarotSpreadId = s.id;
					this.resetTarotDraft();
					this.render();
				});
			}
		});

		const options = form.createDiv({ cls: 'tianji-cast-options' });

		const orientBlock = options.createDiv({
			cls: 'tianji-cast-option tianji-cast-option-orient',
		});
		orientBlock.createSpan({
			cls: 'tianji-cast-option-label',
			text: '逆位',
		});
		const wrap = orientBlock.createDiv({ cls: 'tianji-radio-row' });
		this.radio(wrap, '允许逆位', this.tarotAllowReversed, () => {
			if (this.tarotAllowReversed) return;
			this.tarotAllowReversed = true;
			this.syncChipRow(wrap, '允许逆位');
		});
		this.radio(wrap, '仅正位', !this.tarotAllowReversed, () => {
			if (!this.tarotAllowReversed) return;
			this.tarotAllowReversed = false;
			this.syncChipRow(wrap, '仅正位');
		});

		if (isFlexibleSpread(this.tarotSpreadId)) {
			const countBlock = options.createDiv({
				cls: 'tianji-cast-option tianji-cast-option-count',
			});
			countBlock.createSpan({
				cls: 'tianji-cast-option-label',
				text: '张数',
			});
			const stepper = countBlock.createDiv({
				cls: 'tianji-count-stepper',
			});
			const maxCount = Math.max(
				1,
				remainingTarotDeck(this.tarotSessionUsedIds).length,
			);
			const clampCount = (raw: number) => {
				const n = Math.floor(raw);
				return Number.isFinite(n) ? Math.max(1, Math.min(maxCount, n)) : 1;
			};
			const minus = stepper.createEl('button', {
				cls: 'tianji-count-stepper-btn',
				type: 'button',
				text: '−',
				attr: { 'aria-label': '减少张数' },
			});
			const valueEl = stepper.createEl('input', {
				cls: 'tianji-count-stepper-value',
				type: 'number',
				attr: {
					min: '1',
					max: String(maxCount),
					step: '1',
					'aria-label': '抽牌张数',
				},
			});
			valueEl.value = String(this.tarotCustomCount);
			const plus = stepper.createEl('button', {
				cls: 'tianji-count-stepper-btn',
				type: 'button',
				text: '+',
				attr: { 'aria-label': '增加张数' },
			});
			const syncStepper = () => {
				valueEl.value = String(this.tarotCustomCount);
				minus.disabled = this.tarotCustomCount <= 1;
				plus.disabled = this.tarotCustomCount >= maxCount;
			};
			minus.addEventListener('click', () => {
				this.tarotCustomCount = clampCount(this.tarotCustomCount - 1);
				syncStepper();
			});
			plus.addEventListener('click', () => {
				this.tarotCustomCount = clampCount(this.tarotCustomCount + 1);
				syncStepper();
			});
			valueEl.addEventListener('change', () => {
				this.tarotCustomCount = clampCount(Number(valueEl.value));
				syncStepper();
			});
			syncStepper();
		}

		const actions = form.createDiv({
			cls: 'tianji-actions tianji-cast-actions',
		});
		const shuffleBtn = actions.createEl('button', {
			cls: 'tianji-btn tianji-btn-primary',
			text: '洗牌抽牌',
		});
		shuffleBtn.disabled = this.tarotShuffling;
		shuffleBtn.addEventListener('click', () => {
			this.openTarotShuffleModal();
		});

		const autoBtn = actions.createEl('button', {
			cls: 'tianji-btn tianji-btn-primary',
			text: this.tarotShuffling ? '发牌中…' : '自动选牌',
		});
		autoBtn.disabled = this.tarotShuffling;
		autoBtn.addEventListener('click', () => {
			void this.runTarotDraw();
		});

		const pickBtn = actions.createEl('button', {
			cls: 'tianji-btn',
			text: '手动选牌',
		});
		pickBtn.disabled = this.tarotShuffling;
		pickBtn.addEventListener('click', () => {
			this.openTarotPickModal();
		});

		this.renderTarotSpreadPreview(stage);
	}

	private renderTarotChartPage(
		container: HTMLElement,
		topBar?: HTMLElement,
	): void {
		const stage = container.createDiv({
			cls: 'tianji-stage tianji-chart-stage',
		});
		if (!this.tarotReading) {
			this.renderChartEmpty(
				stage,
				'尚未抽牌。请先在「抽牌」完成选牌。',
				'去抽牌',
				() => {
					this.tarotPanel = 'cast';
					this.render();
				},
			);
			return;
		}

		const toolbar = (topBar ?? stage).createDiv({ cls: 'tianji-chart-toolbar' });
		const backBtn = toolbar.createEl('button', {
			cls: 'tianji-btn',
			text: '返回抽牌',
		});
		backBtn.addEventListener('click', () => {
			this.startFreshTarotSession();
			new Notice('已开始新一局');
			this.render();
		});
		const continueBtn = toolbar.createEl('button', {
			cls: 'tianji-btn tianji-btn-primary',
			text: '继续提问',
		});
		continueBtn.addEventListener('click', () => {
			this.continueTarotSession();
		});
		const copyBtn = toolbar.createEl('button', {
			cls: 'tianji-btn',
			text: '复制牌阵',
		});
		copyBtn.addEventListener('click', () => {
			void this.copyText(
				formatTarotReadingChart(this.tarotReading!),
				'牌阵已复制',
			);
		});
		this.appendFavoriteToolbarBtn(toolbar, this.tarotRecordId);

		const remain = remainingTarotDeck(this.tarotSessionUsedIds).length;
		if (this.tarotSessionUsedIds.length > 0) {
			stage.createDiv({
				cls: 'tianji-tarot-session-hint',
				text: `本局已用 ${this.tarotSessionUsedIds.length} 张 · 剩余 ${remain} 张可继续提问`,
			});
		}
		const board = stage.createDiv({ cls: 'tianji-tarot-board' });
		board.createEl('h3', {
			text: `${this.tarotReading.spreadName} · ${getDeckInfo(this.tarotReading.deckId).name}`,
		});
		const subject =
			this.tarotReading.question.trim()
				? `${this.tarotReading.subject || this.tarotSubject || '问事'}（${this.tarotReading.question.trim()}）`
				: this.tarotReading.subject || this.tarotSubject || '问事';
		board.createDiv({
			cls: 'tianji-tarot-board-meta',
			text: `占测事由：${subject}`,
		});
		this.renderTarotSpread(board, this.tarotReading);
		this.renderTarotMeaningList(board, this.tarotReading);
		this.appendReadingNoteSection(stage, this.tarotRecordId);
	}

	/** 牌阵页：按正/逆位列出每张牌的对应说明 */
	private renderTarotMeaningList(
		parent: HTMLElement,
		reading: TarotReading,
	): void {
		const box = parent.createDiv({ cls: 'tianji-tarot-meaning-list' });
		box.createEl('h4', {
			cls: 'tianji-tarot-meaning-list-title',
			text: '牌义说明',
		});
		reading.cards.forEach((drawn, i) => {
			const orient = drawn.reversed ? '逆位' : '正位';
			const meaning = getOrientMeaning(drawn.card, drawn.reversed);
			const row = box.createDiv({ cls: 'tianji-tarot-meaning-item' });
			row.createDiv({
				cls: 'tianji-tarot-meaning-item-head',
				text: `${i + 1}. ${drawn.positionLabel} · ${drawn.card.name}（${orient}）`,
			});
			if (drawn.card.keywords.length) {
				row.createDiv({
					cls: 'tianji-tarot-meaning-item-keys',
					text: drawn.card.keywords.join(' · '),
				});
			}
			row.createDiv({
				cls: 'tianji-tarot-meaning-item-body',
				text: meaning || '（暂无该方位说明）',
			});
		});
	}

	private ensureTarotDraft(): void {
		if (isFlexibleSpread(this.tarotSpreadId)) {
			this.tarotDraft = this.tarotDraft.filter(
				(p): p is TarotSlotPick => !!p,
			);
			return;
		}
		const n = getSpread(this.tarotSpreadId).positions.length;
		if (this.tarotDraft.length !== n) {
			this.tarotDraft = Array.from({ length: n }, () => null);
		}
	}

	private resetTarotDraft(): void {
		if (isFlexibleSpread(this.tarotSpreadId)) {
			this.tarotDraft = [];
			return;
		}
		const n = getSpread(this.tarotSpreadId).positions.length;
		this.tarotDraft = Array.from({ length: n }, () => null);
	}

	private tarotSpreadNeedCount(): number {
		if (isFlexibleSpread(this.tarotSpreadId)) {
			return Math.max(1, Math.floor(this.tarotCustomCount) || 1);
		}
		return getSpread(this.tarotSpreadId).positions.length;
	}

	/** 本局剩余牌是否够当前牌阵 */
	private ensureTarotRemainingForSpread(): boolean {
		const need = this.tarotSpreadNeedCount();
		const remain = remainingTarotDeck(this.tarotSessionUsedIds).length;
		if (remain < need) {
			new Notice(
				`剩余牌不足：需 ${need} 张，仅剩 ${remain} 张。请换更少张的牌阵，或「新开一局」。`,
			);
			return false;
		}
		return true;
	}

	/** 牌阵页：继续提问，从剩余牌组再抽 */
	private continueTarotSession(): void {
		const remain = remainingTarotDeck(this.tarotSessionUsedIds).length;
		if (remain <= 0) {
			new Notice('本局牌已抽完，请返回抽牌开始新一局');
			return;
		}
		this.tarotQuestion = '';
		this.resetTarotDraft();
		this.tarotPanel = 'cast';
		new Notice(`继续提问 · 剩余 ${remain} 张`);
		this.render();
	}

	/** 整副重洗，清空本局已用牌 */
	private startFreshTarotSession(): void {
		this.tarotSessionUsedIds = [];
		this.tarotSubject = '问事';
		this.tarotQuestion = '';
		this.tarotReading = null;
		this.tarotRecordId = null;
		this.resetTarotDraft();
		this.tarotPanel = 'cast';
	}

	/** 确认排盘后把本阵牌记入本局已用 */
	private rememberTarotSessionCards(reading: TarotReading): void {
		const used = new Set(this.tarotSessionUsedIds);
		for (const c of reading.cards) {
			used.add(c.card.id);
		}
		this.tarotSessionUsedIds = [...used];
	}

	private annotateTarotFollowUp(reading: TarotReading): TarotReading {
		if (this.tarotSessionUsedIds.length === 0) return reading;
		const remainAfter =
			TAROT_DECK.length -
			this.tarotSessionUsedIds.length -
			reading.cards.length;
		const prefix = `【续问】从剩余牌组抽取（抽前已用 ${this.tarotSessionUsedIds.length} 张，抽后约剩 ${Math.max(0, remainAfter)} 张）\n\n`;
		return {
			...reading,
			chartText: prefix + reading.chartText,
		};
	}

	private applyReadingToDraft(reading: TarotReading): void {
		this.tarotDraft = reading.cards.map((c) => ({
			cardId: c.card.id,
			reversed: c.reversed,
		}));
		if (isFlexibleSpread(reading.spreadId)) {
			this.tarotCustomCount = Math.max(1, reading.cards.length);
		}
		this.render();
	}

	/** 抽牌页底部：牌阵空位（点选 1 张）+ 开始排盘 */
	private renderTarotSpreadPreview(parent: HTMLElement): void {
		this.ensureTarotDraft();
		const spread = getSpread(this.tarotSpreadId);
		const flexible = isFlexibleSpread(spread);
		const filled = this.tarotDraft.filter(Boolean).length;
		const remain = remainingTarotDeck([
			...this.tarotSessionUsedIds,
			...this.tarotDraft
				.map((p) => p?.cardId ?? null)
				.filter((id): id is string => !!id),
		]).length;

		const box = parent.createDiv({ cls: 'tianji-spread-preview' });
		const head = box.createDiv({ cls: 'tianji-spread-preview-head' });
		head.createEl('h3', {
			cls: 'tianji-spread-preview-title',
			text: spread.name,
		});
		head.createDiv({
			cls: 'tianji-spread-preview-meta',
			text: flexible
				? `已选 ${filled} 张 · 点 + 添加卡牌`
				: `已选 ${filled}/${spread.positions.length} · 点击空位选 1 张`,
		});

		const layout = box.createDiv({
			cls: `tianji-spread-preview-grid tianji-spread-preview-${spread.id}`,
		});

		const midHost =
			spread.id === 'celtic-cross'
				? layout.createDiv({
						cls: 'tianji-celtic-mid',
						attr: { 'data-pos': 'mid' },
					})
				: null;

		const renderFilledSlot = (
			host: HTMLElement,
			posKey: string,
			posLabel: string,
			posHint: string,
			i: number,
			pick: TarotSlotPick | null,
			opts?: { removable?: boolean },
		) => {
			const card = pick
				? TAROT_DECK.find((c) => c.id === pick.cardId)
				: undefined;

			const slot = host.createDiv({
				cls: `tianji-spread-preview-slot${pick ? ' is-filled' : ''}`,
				attr: {
					'data-pos': posKey,
					role: 'button',
					tabindex: '0',
					title: pick && card
						? `更换「${posLabel}」· ${card.name}${pick.reversed ? ' · 逆' : ''}`
						: `为「${posLabel}」选牌 · ${posHint}`,
				},
			});

			slot.createDiv({
				cls: 'tianji-spread-preview-label',
				text: posLabel,
			});

			const face = slot.createDiv({
				cls: `tianji-spread-preview-face${pick?.reversed ? ' is-reversed' : ''}`,
			});
			if (card && pick) {
				const img = face.createEl('img', {
					cls: 'tianji-spread-preview-img',
					attr: { alt: card.nameEn, loading: 'lazy' },
				});
				void this.plugin.tarotImages
					.ensure(card)
					.then((url) => {
						img.src = url;
					})
					.catch(() => {
						img.remove();
						face.setText(card.name.slice(0, 2));
					});
			} else {
				face.setText(String(i + 1));
			}

			if (opts?.removable && pick) {
				const remove = slot.createEl('button', {
					cls: 'tianji-spread-preview-remove',
					type: 'button',
					attr: {
						title: '移除这张',
						'aria-label': '移除这张',
					},
				});
				setIcon(remove, 'x');
				remove.addEventListener('click', (ev) => {
					ev.preventDefault();
					ev.stopPropagation();
					this.tarotDraft.splice(i, 1);
					this.ensureTarotDraft();
					this.render();
				});
			}

			const openPick = () => this.openTarotSlotPick(i);
			slot.addEventListener('click', openPick);
			slot.addEventListener('keydown', (ev) => {
				if (ev.key === 'Enter' || ev.key === ' ') {
					ev.preventDefault();
					openPick();
				}
			});
		};

		if (flexible) {
			this.tarotDraft.forEach((pick, i) => {
				if (!pick) return;
				renderFilledSlot(
					layout,
					`c${i + 1}`,
					`第 ${i + 1} 张`,
					'自定义位置',
					i,
					pick,
					{ removable: true },
				);
			});

			const canAdd = remain > 0;
			const addSlot = layout.createDiv({
				cls: `tianji-spread-preview-slot tianji-spread-preview-add${canAdd ? '' : ' is-disabled'}`,
				attr: {
					role: 'button',
					tabindex: canAdd ? '0' : '-1',
					title: canAdd ? '添加一张牌' : '没有剩余牌可添加',
					'aria-label': '添加一张牌',
				},
			});
			addSlot.createDiv({
				cls: 'tianji-spread-preview-label',
				text: '添加',
			});
			const addFace = addSlot.createDiv({
				cls: 'tianji-spread-preview-face tianji-spread-preview-add-face',
			});
			setIcon(addFace, 'plus');
			const addCard = () => {
				if (!canAdd) {
					new Notice('剩余牌不足，无法继续添加');
					return;
				}
				this.openTarotAddCustomCard();
			};
			addSlot.addEventListener('click', addCard);
			addSlot.addEventListener('keydown', (ev) => {
				if (ev.key === 'Enter' || ev.key === ' ') {
					ev.preventDefault();
					addCard();
				}
			});
		} else {
			spread.positions.forEach((pos, i) => {
				const pick = this.tarotDraft[i] ?? null;
				const host =
					midHost && (pos.key === 'p1' || pos.key === 'p2')
						? midHost
						: layout;
				renderFilledSlot(
					host,
					pos.key,
					pos.label,
					pos.hint,
					i,
					pick,
				);
			});
		}

		const actions = box.createDiv({ cls: 'tianji-spread-preview-actions' });
		const clearBtn = actions.createEl('button', {
			cls: 'tianji-btn',
			type: 'button',
			text: '清空选牌',
		});
		clearBtn.disabled = filled === 0;
		clearBtn.addEventListener('click', () => {
			this.resetTarotDraft();
			this.render();
		});

		const startBtn = actions.createEl('button', {
			cls: 'tianji-btn tianji-btn-primary',
			type: 'button',
			text: '开始排盘',
		});
		startBtn.disabled = flexible
			? filled < 1
			: filled < spread.positions.length;
		startBtn.addEventListener('click', () => {
			void this.commitTarotDraft();
		});
	}

	private openTarotAddCustomCard(): void {
		this.ensureTarotDraft();
		const excludeIds = [
			...this.tarotSessionUsedIds,
			...this.tarotDraft
				.map((p) => p?.cardId ?? null)
				.filter((id): id is string => !!id),
		];
		if (
			remainingTarotDeck(excludeIds).length < 1
		) {
			new Notice('剩余牌不足，无法继续添加');
			return;
		}
		const nextIndex = this.tarotDraft.length;
		new TarotSlotPickModal(this.app, {
			positionLabel: `第 ${nextIndex + 1} 张`,
			allowReversed: this.tarotAllowReversed,
			excludeIds,
			images: this.plugin.tarotImages,
			onPick: (pick) => {
				this.ensureTarotDraft();
				this.tarotDraft.push(pick);
				this.tarotCustomCount = Math.max(
					this.tarotCustomCount,
					this.tarotDraft.length,
				);
				this.render();
			},
		}).open();
	}

	private openTarotSlotPick(posIndex: number): void {
		this.ensureTarotDraft();
		const flexible = isFlexibleSpread(this.tarotSpreadId);
		if (flexible) {
			const pick = this.tarotDraft[posIndex];
			if (!pick) {
				this.openTarotAddCustomCard();
				return;
			}
			const excludeIds = [
				...this.tarotSessionUsedIds,
				...this.tarotDraft
					.map((p, i) => (i !== posIndex && p ? p.cardId : null))
					.filter((id): id is string => !!id),
			];
			new TarotSlotPickModal(this.app, {
				positionLabel: `第 ${posIndex + 1} 张`,
				allowReversed: this.tarotAllowReversed,
				excludeIds,
				images: this.plugin.tarotImages,
				onPick: (next) => {
					this.ensureTarotDraft();
					this.tarotDraft[posIndex] = next;
					this.render();
				},
			}).open();
			return;
		}

		const spread = getSpread(this.tarotSpreadId);
		const pos = spread.positions[posIndex];
		if (!pos) return;

		const excludeIds = [
			...this.tarotSessionUsedIds,
			...this.tarotDraft
				.map((p, i) => (i !== posIndex && p ? p.cardId : null))
				.filter((id): id is string => !!id),
		];

		new TarotSlotPickModal(this.app, {
			positionLabel: pos.label,
			allowReversed: this.tarotAllowReversed,
			excludeIds,
			images: this.plugin.tarotImages,
			onPick: (pick) => {
				this.ensureTarotDraft();
				this.tarotDraft[posIndex] = pick;
				this.render();
			},
		}).open();
	}

	private async commitTarotDraft(): Promise<void> {
		if (!this.requireTarotQuestion()) return;
		this.ensureTarotDraft();
		const flexible = isFlexibleSpread(this.tarotSpreadId);
		const picks = this.tarotDraft.filter((p): p is TarotSlotPick => !!p);
		if (flexible) {
			if (picks.length < 1) {
				new Notice('请至少添加 1 张牌');
				return;
			}
		} else {
			const missing = this.tarotDraft.findIndex((p) => !p);
			if (missing >= 0) {
				new Notice(`请先为第 ${missing + 1} 个位置选牌`);
				return;
			}
		}
		const used = new Set(this.tarotSessionUsedIds);
		const overlap = picks.find((p) => used.has(p.cardId));
		if (overlap) {
			new Notice('草稿含本局已用牌，请从剩余牌组重新选牌');
			return;
		}
		try {
			const reading = buildManualTarot({
				spreadId: this.tarotSpreadId,
				deckId: this.tarotDeckId,
				subject: this.tarotSubject,
				question: this.tarotQuestion,
				picks: picks.map((p) => ({
					cardId: p.cardId,
					reversed: p.reversed,
				})),
			});
			await this.saveTarotReading(reading, '手动选牌');
		} catch (e) {
			new Notice(String(e));
		}
	}

	private renderTarotSpread(parent: HTMLElement, reading: TarotReading): void {
		const layout = parent.createDiv({
			cls: `tianji-tarot-spread tianji-spread-${reading.spreadId}`,
		});

		const isCeltic = reading.spreadId === 'celtic-cross';
		const midHost = isCeltic
			? layout.createDiv({
					cls: 'tianji-celtic-mid',
					attr: { 'data-pos': 'mid' },
				})
			: null;

		reading.cards.forEach((drawn, i) => {
			const isMidCard =
				isCeltic &&
				(drawn.positionKey === 'p1' || drawn.positionKey === 'p2');
			const host = isMidCard && midHost ? midHost : layout;
			const slot = host.createDiv({
				cls: 'tianji-tarot-slot',
				attr: { 'data-pos': drawn.positionKey },
			});
			slot.createDiv({
				cls: 'tianji-tarot-pos',
				text: `${i + 1}. ${drawn.positionLabel}`,
			});
			slot.createDiv({
				cls: 'tianji-tarot-hint',
				text: drawn.positionHint,
			});
			this.renderTarotCard(slot, drawn, reading.deckId);
		});
	}

	private renderTarotCard(
		parent: HTMLElement,
		drawn: DrawnCard,
		deckId: DeckId,
	): void {
		const wrap = parent.createDiv({
			cls: `tianji-tarot-card is-clickable${drawn.reversed ? ' is-reversed' : ''}`,
			attr: {
				role: 'button',
				tabindex: '0',
				title: '点击查看牌意详解',
			},
		});
		const face = wrap.createDiv({
			cls: `tianji-tarot-face${drawn.reversed ? ' is-reversed' : ''}`,
			attr: {
				'data-pos-face': drawn.positionKey,
			},
		});
		const img = face.createEl('img', {
			cls: 'tianji-tarot-img',
			attr: {
				alt: drawn.card.nameEn,
				loading: 'lazy',
			},
		});
		void this.plugin.tarotImages
			.ensure(drawn.card)
			.then((url) => {
				img.src = url;
			})
			.catch(() => {
				img.remove();
				this.fillDrawnFace(face, drawn, deckId);
			});
		img.addEventListener('error', () => {
			img.remove();
			this.fillDrawnFace(face, drawn, deckId);
		});

		const cap = wrap.createDiv({ cls: 'tianji-tarot-caption' });
		cap.createDiv({
			cls: 'tianji-tarot-card-name',
			text: drawn.card.name,
		});
		cap.createDiv({
			cls: 'tianji-tarot-orient',
			text: drawn.reversed ? '逆位' : '正位',
		});
		cap.createDiv({
			cls: 'tianji-tarot-keywords',
			text: drawn.card.keywords.join(' · '),
		});

		const openDetail = () => {
			new TarotCardDetailModal(this.app, this.plugin.tarotImages, {
				card: drawn.card,
				reversed: drawn.reversed,
			}).open();
		};
		wrap.addEventListener('click', openDetail);
		wrap.addEventListener('keydown', (ev) => {
			if (ev.key === 'Enter' || ev.key === ' ') {
				ev.preventDefault();
				openDetail();
			}
		});
	}

	private fillDrawnFace(
		face: HTMLElement,
		drawn: DrawnCard,
		_deckId: DeckId,
	): void {
		face.empty();
		face.addClass('is-fallback');
		face.style.setProperty('--tarot-accent', suitAccent(drawn.card.suit));
		face.createDiv({
			cls: 'tianji-tarot-face-num',
			text:
				drawn.card.arcana === 'major'
					? String(drawn.card.number)
					: drawn.card.number === 1
						? 'A'
						: drawn.card.number <= 10
							? String(drawn.card.number)
							: ['P', 'Kn', 'Q', 'K'][drawn.card.number - 11]!,
		});
		face.createDiv({
			cls: 'tianji-tarot-face-title',
			text: drawn.card.name,
		});
		face.createDiv({
			cls: 'tianji-tarot-face-en',
			text: drawn.card.nameEn,
		});
		if (drawn.card.suit) {
			const suitNames: Record<string, string> = {
				wands: '权杖',
				cups: '圣杯',
				swords: '宝剑',
				pentacles: '星币',
			};
			face.createDiv({
				cls: 'tianji-tarot-face-suit',
				text: suitNames[drawn.card.suit] ?? '',
			});
		} else {
			face.createDiv({
				cls: 'tianji-tarot-face-suit',
				text: '大阿卡纳',
			});
		}
	}

	private openTarotShuffleModal(): void {
		if (!this.requireTarotQuestion()) return;
		if (!this.ensureTarotRemainingForSpread()) return;
		new TarotShuffleModal(this.app, {
			deckId: this.tarotDeckId,
			spreadId: this.tarotSpreadId,
			allowReversed: this.tarotAllowReversed,
			subject: this.tarotSubject,
			question: this.tarotQuestion,
			excludeIds: this.tarotSessionUsedIds,
			cardCount: isFlexibleSpread(this.tarotSpreadId)
				? this.tarotSpreadNeedCount()
				: undefined,
			onConfirm: (reading) => {
				this.applyReadingToDraft(reading);
				new Notice(`已选好 ${reading.cards.length} 张，可点「开始排盘」`);
			},
		}).open();
	}

	private openTarotPickModal(initialPos = 0): void {
		if (!this.requireTarotQuestion()) return;
		if (!this.ensureTarotRemainingForSpread()) return;
		new TarotPickModal(this.app, {
			deckId: this.tarotDeckId,
			spreadId: this.tarotSpreadId,
			allowReversed: this.tarotAllowReversed,
			subject: this.tarotSubject,
			question: this.tarotQuestion,
			images: this.plugin.tarotImages,
			excludeIds: this.tarotSessionUsedIds,
			cardCount: isFlexibleSpread(this.tarotSpreadId)
				? this.tarotSpreadNeedCount()
				: undefined,
			initialPos,
			onConfirm: (reading) => {
				this.applyReadingToDraft(reading);
				new Notice(`已选好 ${reading.cards.length} 张，可点「开始排盘」`);
			},
		}).open();
	}

	private async runTarotDraw(): Promise<void> {
		if (this.tarotShuffling) return;
		if (!this.requireTarotQuestion()) return;
		if (!this.ensureTarotRemainingForSpread()) return;
		this.tarotShuffling = true;
		this.render();
		await new Promise((r) => setTimeout(r, 420));

		try {
			const reading = drawTarot({
				spreadId: this.tarotSpreadId,
				deckId: this.tarotDeckId,
				subject: this.tarotSubject,
				question: this.tarotQuestion,
				allowReversed: this.tarotAllowReversed,
				excludeIds: this.tarotSessionUsedIds,
				cardCount: isFlexibleSpread(this.tarotSpreadId)
					? this.tarotSpreadNeedCount()
					: undefined,
			});
			this.applyReadingToDraft(reading);
			new Notice(`已选好 ${reading.cards.length} 张，可点「开始排盘」`);
		} catch (e) {
			new Notice(String(e));
		} finally {
			this.tarotShuffling = false;
			this.render();
		}
	}

	private requireTarotQuestion(): boolean {
		if (this.tarotQuestion.trim()) return true;
		new Notice('占测问题不能为空');
		return false;
	}

	private async saveTarotReading(
		reading: TarotReading,
		methodLabel: string,
	): Promise<void> {
		if (!this.requireTarotQuestion()) return;
		const saved = this.annotateTarotFollowUp(reading);
		this.rememberTarotSessionCards(saved);
		this.tarotReading = saved;
		this.tarotPanel = 'chart';
		this.resetTarotDraft();
		const title =
			this.tarotSubject.trim() ||
			this.tarotQuestion.trim().slice(0, 24) ||
			`${saved.spreadName}${methodLabel}`;
		try {
			this.tarotRecordId = await this.plugin.db.insertReading({
				type: 'tarot',
				title,
				inputJson: JSON.stringify({
					deckId: this.tarotDeckId,
					spreadId: this.tarotSpreadId,
					subject: this.tarotSubject,
					question: this.tarotQuestion,
					allowReversed: this.tarotAllowReversed,
					method: methodLabel,
					sessionUsedIds: this.tarotSessionUsedIds,
				}),
				resultJson: JSON.stringify(saved),
			});
			new Notice(
				`已确认 ${saved.cards.length} 张 · ${saved.spreadName}（${methodLabel}）· 剩余 ${remainingTarotDeck(this.tarotSessionUsedIds).length} 张`,
			);
		} catch (e) {
			new Notice(`牌阵已出，存档失败：${String(e)}`);
		}
		this.render();
	}

	/* -------------------- 梅花易数 -------------------- */

	private renderMeihua(container: HTMLElement): void {
		const workTop =
			this.meihuaPanel === 'chart'
				? container.createDiv({ cls: 'tianji-work-top' })
				: container;
		this.renderPanelSwitch(workTop, {
			mode: this.meihuaPanel,
			castLabel: '起卦',
			chartLabel: '排盘',
			libraryLabel: '卦例库',
			type: 'meihua',
			onChange: (m) => {
				this.meihuaPanel = m;
				this.render();
			},
		});
		if (this.meihuaPanel === 'library') {
			this.renderTypeLibrary(container, {
				type: 'meihua',
				emptyText: '暂无梅花易数卦例。起卦排盘后将自动写入卦例库。',
			});
			return;
		}
		if (this.meihuaPanel === 'chart') {
			this.renderMeihuaChart(container, workTop);
			return;
		}
		this.renderMeihuaCast(container);
	}

	private renderMeihuaCast(container: HTMLElement): void {
		const stage = container.createDiv({ cls: 'tianji-stage' });
		const form = stage.createDiv({ cls: 'tianji-form tianji-cast-card' });

		const top = form.createDiv({ cls: 'tianji-cast-row' });
		this.field(top, '占测事由', (el) => {
			const input = el.createEl('input', {
				type: 'text',
				cls: 'tianji-input',
				placeholder: '如：事业、感情、财运…',
				value: this.meihuaSubject,
			});
			input.addEventListener('input', () => {
				this.meihuaSubject = input.value;
			});
		});
		this.field(top, '起卦时间', (el) => {
			const input = el.createEl('input', {
				type: 'datetime-local',
				cls: 'tianji-input',
				value: this.normalizeDatetimeLocal(this.meihuaCastLocal),
			});
			input.step = '1';
			input.addEventListener('change', () => {
				this.meihuaCastLocal = this.normalizeDatetimeLocal(input.value);
				input.value = this.meihuaCastLocal;
			});
			const nowBtn = el.createEl('button', {
				cls: 'tianji-btn',
				text: '此刻',
			});
			nowBtn.addEventListener('click', () => {
				this.meihuaCastLocal = this.toDatetimeLocal(new Date());
				input.value = this.meihuaCastLocal;
			});
		});

		this.field(form, '占测问题（必填）', (el) => {
			const ta = el.createEl('textarea', {
				cls: 'tianji-textarea',
				placeholder: '请描述您的具体问题（必填）',
				attr: { required: 'true' },
			});
			ta.value = this.meihuaQuestion;
			ta.rows = 3;
			ta.addEventListener('input', () => {
				this.meihuaQuestion = ta.value;
			});
		});

		this.field(form, '起卦方式', (el) => {
			const wrap = el.createDiv({ cls: 'tianji-radio-row' });
			(Object.keys(MEIHUA_METHOD_LABELS) as MeihuaMethod[]).forEach(
				(id) => {
					this.radio(
						wrap,
						MEIHUA_METHOD_LABELS[id],
						this.meihuaMethod === id,
						() => {
							if (this.meihuaMethod === id) return;
							this.meihuaMethod = id;
							this.render();
						},
					);
				},
			);
		});

		if (this.meihuaMethod === 'numbers' || this.meihuaMethod === 'three') {
			const row = form.createDiv({ cls: 'tianji-cast-row is-2' });
			this.field(row, '上卦数（必填）', (el) => {
				const input = el.createEl('input', {
					type: 'number',
					cls: 'tianji-input',
					placeholder: '正整数',
					attr: { min: '1', step: '1' },
					value: this.meihuaNum1,
				});
				input.addEventListener('input', () => {
					this.meihuaNum1 = input.value;
				});
			});
			this.field(row, '下卦数（必填）', (el) => {
				const input = el.createEl('input', {
					type: 'number',
					cls: 'tianji-input',
					placeholder: '正整数',
					attr: { min: '1', step: '1' },
					value: this.meihuaNum2,
				});
				input.addEventListener('input', () => {
					this.meihuaNum2 = input.value;
				});
			});
		}
		if (this.meihuaMethod === 'three') {
			this.field(form, '动爻数（必填）', (el) => {
				const input = el.createEl('input', {
					type: 'number',
					cls: 'tianji-input',
					placeholder: '正整数，取余定动爻',
					attr: { min: '1', step: '1' },
					value: this.meihuaNum3,
				});
				input.addEventListener('input', () => {
					this.meihuaNum3 = input.value;
				});
			});
		}

		const notes = form.createEl('details', { cls: 'tianji-notes' });
		notes.createEl('summary', { text: '起卦说明' });
		const ul = notes.createEl('ul');
		const tips: Record<MeihuaMethod, string[]> = {
			time: [
				'农历年支数（子1…亥12）+ 月 + 日，除 8 取余得上卦；再加时支数得下卦与动爻（除 6 取余）。',
				'先天数：1乾 2兑 3离 4震 5巽 6坎 7艮 8坤；余 0 作 8 / 6。',
			],
			numbers: [
				'两数分别除 8 取余为上、下卦；两数之和除 6 取余为动爻。',
				'动爻在下卦（初–三）则下为用、上为体；在上卦（四–上）则上为用、下为体。',
			],
			three: [
				'三数分别定上卦、下卦、动爻（除 8 / 8 / 6 取余）。',
				'排盘含本卦、互卦、变卦与体用五行生克。',
			],
		};
		for (const tip of tips[this.meihuaMethod]) {
			ul.createEl('li', { text: tip });
		}

		const actions = form.createDiv({
			cls: 'tianji-actions tianji-cast-actions',
		});
		const btn = actions.createEl('button', {
			cls: 'tianji-btn tianji-btn-primary',
			text: '起卦排盘',
		});
		btn.addEventListener('click', () => {
			void this.runMeihuaCast();
		});
	}

	private requireMeihuaQuestion(): boolean {
		if (this.meihuaQuestion.trim()) return true;
		new Notice('占测问题不能为空');
		return false;
	}

	private parseMeihuaCastTime(): Date {
		const d = new Date(this.normalizeDatetimeLocal(this.meihuaCastLocal));
		return Number.isNaN(d.getTime()) ? new Date() : d;
	}

	private parseMeihuaInt(raw: string, label: string): number | null {
		const n = Number(raw);
		if (!Number.isFinite(n) || n < 1 || !Number.isInteger(n)) {
			new Notice(`${label}须为正整数`);
			return null;
		}
		return n;
	}

	private async runMeihuaCast(): Promise<void> {
		if (!this.requireMeihuaQuestion()) return;
		let num1: number | undefined;
		let num2: number | undefined;
		let num3: number | undefined;
		if (this.meihuaMethod === 'numbers' || this.meihuaMethod === 'three') {
			const a = this.parseMeihuaInt(this.meihuaNum1, '上卦数');
			const b = this.parseMeihuaInt(this.meihuaNum2, '下卦数');
			if (a == null || b == null) return;
			num1 = a;
			num2 = b;
		}
		if (this.meihuaMethod === 'three') {
			const c = this.parseMeihuaInt(this.meihuaNum3, '动爻数');
			if (c == null) return;
			num3 = c;
		}
		try {
			const cast = castMeihua({
				method: this.meihuaMethod,
				castTime: this.parseMeihuaCastTime(),
				num1,
				num2,
				num3,
			});
			const result = buildMeihuaResult({
				cast,
				subject: this.meihuaSubject,
				question: this.meihuaQuestion,
			});
			await this.saveMeihuaCast(result);
		} catch (e) {
			new Notice(String(e));
		}
	}

	private async saveMeihuaCast(result: MeihuaResult): Promise<void> {
		if (!this.requireMeihuaQuestion()) return;
		this.meihuaResult = result;
		this.meihuaPanel = 'chart';
		const title =
			this.meihuaSubject.trim() ||
			this.meihuaQuestion.trim().slice(0, 20) ||
			'梅花易数';
		try {
			this.meihuaRecordId = await this.plugin.db.insertReading({
				type: 'meihua',
				title,
				inputJson: JSON.stringify({
					subject: this.meihuaSubject,
					question: this.meihuaQuestion,
					method: this.meihuaMethod,
					methodLabel: result.methodLabel,
					castTime: result.castTime,
					num1: result.num1,
					num2: result.num2,
					num3: result.num3,
				}),
				resultJson: JSON.stringify(result),
			});
			new Notice(`已排盘：${result.methodLabel}`);
		} catch (e) {
			new Notice(`排盘已出，存档失败：${String(e)}`);
		}
		this.render();
	}

	private renderMeihuaChart(
		container: HTMLElement,
		topBar?: HTMLElement,
	): void {
		const stage = container.createDiv({
			cls: 'tianji-stage tianji-chart-stage',
		});
		if (!this.meihuaResult) {
			this.renderChartEmpty(
				stage,
				'尚未起卦。请先在「起卦」完成排盘。',
				'去起卦',
				() => {
					this.meihuaPanel = 'cast';
					this.render();
				},
			);
			return;
		}

		const r = this.meihuaResult;
		const toolbar = (topBar ?? stage).createDiv({
			cls: 'tianji-chart-toolbar',
		});
		const backBtn = toolbar.createEl('button', {
			cls: 'tianji-btn',
			text: '返回起卦',
		});
		backBtn.addEventListener('click', () => {
			this.meihuaPanel = 'cast';
			this.render();
		});
		const copyBtn = toolbar.createEl('button', {
			cls: 'tianji-btn tianji-btn-primary',
			text: '复制排盘',
		});
		copyBtn.addEventListener('click', () => {
			void this.copyText(formatMeihuaChartText(r), '排盘已复制');
		});
		this.appendFavoriteToolbarBtn(toolbar, this.meihuaRecordId);

		const card = stage.createDiv({
			cls: 'tianji-result-card tianji-mh-result',
		});
		const info = card.createDiv({ cls: 'tianji-mh-info' });
		info.createEl('h4', { text: '基本信息' });
		const infoGrid = info.createDiv({ cls: 'tianji-mh-info-grid' });
		const subject = r.question.trim()
			? `${r.subject || '问事'}（${r.question.trim()}）`
			: r.subject || '问事';
		this.addInfoCell(infoGrid, '占测事由', subject);
		this.addInfoCell(infoGrid, '起卦方式', r.methodLabel);
		this.addInfoCell(infoGrid, '公历', r.solarText);
		this.addInfoCell(infoGrid, '农历', r.lunarText);
		this.addInfoCell(infoGrid, '时辰', `${r.hourBranch}时`);
		if (r.method === 'numbers') {
			this.addInfoCell(infoGrid, '报数', `上${r.num1} / 下${r.num2}`);
		}
		if (r.method === 'three') {
			this.addInfoCell(
				infoGrid,
				'三数',
				`上${r.num1} / 下${r.num2} / 动${r.num3}`,
			);
		}
		this.addInfoCell(infoGrid, '动爻', `${r.movingLineName}（第${r.movingLine}爻）`);
		this.addInfoCell(
			infoGrid,
			'体用',
			`体${r.ti.name}${r.ti.nature} · 用${r.yong.name}${r.yong.nature}`,
		);
		this.addInfoCell(
			infoGrid,
			'生克',
			`${r.relation}（体${r.ti.wuxing} / 用${r.yong.wuxing}）`,
		);

		const board = card.createDiv({ cls: 'tianji-mh-board' });
		board.createEl('h4', { text: '本卦 · 互卦 · 变卦' });
		const pair = board.createDiv({ cls: 'tianji-mh-pair' });
		this.renderMeihuaGuaCard(pair, '本卦', r.original, r, 'original');
		this.renderMeihuaGuaCard(pair, '互卦', r.mutual, r, 'mutual');
		this.renderMeihuaGuaCard(pair, '变卦', r.changed, r, 'changed');

		this.appendReadingNoteSection(stage, this.meihuaRecordId);
	}

	private renderMeihuaGuaCard(
		parent: HTMLElement,
		title: string,
		gua: {
			index: number;
			name: string;
			alias: string;
			binary: string;
			nature: string;
		},
		r: MeihuaResult,
		kind: 'original' | 'mutual' | 'changed',
	): void {
		const card = parent.createDiv({ cls: 'tianji-mh-gua' });
		card.createDiv({ cls: 'tianji-mh-gua-title', text: title });
		card.createDiv({
			cls: 'tianji-mh-gua-name',
			text: gua.alias || gua.name,
		});
		card.createDiv({
			cls: 'tianji-mh-gua-meta',
			text: `第${gua.index}卦 · ${gua.nature || '—'}`,
		});

		const lines = card.createDiv({ cls: 'tianji-mh-yao-lines' });
		for (let display = 5; display >= 0; display--) {
			const pos = display + 1;
			const yang = gua.binary[display] === '1';
			const isMoving = kind === 'original' && pos === r.movingLine;
			const isChangedMark = kind === 'changed' && pos === r.movingLine;
			const row = lines.createDiv({
				cls: `tianji-mh-yao-row${isMoving ? ' is-moving' : ''}`,
			});
			row.createSpan({
				cls: 'tianji-mh-yao-pos',
				text: ['初', '二', '三', '四', '五', '上'][display]!,
			});
			this.renderYaoBar(row, {
				yang,
				moving: isMoving || isChangedMark,
			});
			if (isMoving) {
				row.createSpan({ cls: 'tianji-mh-yao-mark', text: '动' });
			} else if (isChangedMark) {
				row.createSpan({ cls: 'tianji-mh-yao-mark', text: '变' });
			} else {
				row.createSpan({ cls: 'tianji-mh-yao-mark', text: '' });
			}
		}

		const trigrams = card.createDiv({ cls: 'tianji-mh-trigrams' });
		if (kind === 'original') {
			const upperRole = r.movingInUpper
				? r.yong.id === r.upper.id
					? '用'
					: '体'
				: r.ti.id === r.upper.id
					? '体'
					: '用';
			const lowerRole = !r.movingInUpper
				? r.yong.id === r.lower.id
					? '用'
					: '体'
				: r.ti.id === r.lower.id
					? '体'
					: '用';
			trigrams.createSpan({
				text: `上${r.upper.name}${r.upper.nature}（${upperRole}） · ${r.upper.wuxing}`,
			});
			trigrams.createSpan({
				text: `下${r.lower.name}${r.lower.nature}（${lowerRole}） · ${r.lower.wuxing}`,
			});
		} else if (kind === 'mutual') {
			trigrams.createSpan({
				text: '取本卦二三四为下、三四五为上',
			});
		}
	}

	private restoreMeihua(rec: ReadingRecord): void {
		const result = JSON.parse(rec.resultJson) as MeihuaResult;
		let input: {
			subject?: string;
			question?: string;
			method?: MeihuaMethod;
			castTime?: string;
			num1?: number | null;
			num2?: number | null;
			num3?: number | null;
		} = {};
		try {
			input = JSON.parse(rec.inputJson) as typeof input;
		} catch {
			/* ignore */
		}

		this.meihuaSubject = input.subject ?? result.subject ?? '问事';
		this.meihuaQuestion = input.question ?? result.question ?? '';
		this.meihuaMethod = input.method ?? result.method ?? 'time';
		this.meihuaNum1 =
			input.num1 != null
				? String(input.num1)
				: result.num1 != null
					? String(result.num1)
					: '';
		this.meihuaNum2 =
			input.num2 != null
				? String(input.num2)
				: result.num2 != null
					? String(result.num2)
					: '';
		this.meihuaNum3 =
			input.num3 != null
				? String(input.num3)
				: result.num3 != null
					? String(result.num3)
					: '';
		if (input.castTime || result.castTime) {
			const d = new Date(input.castTime || result.castTime);
			if (!Number.isNaN(d.getTime())) {
				this.meihuaCastLocal = this.toDatetimeLocal(d);
			}
		}
		this.meihuaResult = result;
		if (!result.mutual?.binary && result.original?.binary) {
			result.mutual = getHexagramByBinary(
				mutualBinary(result.original.binary),
			);
		}
		this.meihuaRecordId = rec.id;
		this.meihuaPanel = 'chart';
		this.activeTab = 'meihua';
		this.persistActiveTab('meihua');
	}

	/* -------------------- 小六壬 -------------------- */

	private renderXiaoliuren(container: HTMLElement): void {
		const workTop =
			this.xiaoliurenPanel === 'chart'
				? container.createDiv({ cls: 'tianji-work-top' })
				: container;
		this.renderPanelSwitch(workTop, {
			mode: this.xiaoliurenPanel,
			castLabel: '起卦',
			chartLabel: '排盘',
			libraryLabel: '课例库',
			type: 'xiaoliuren',
			onChange: (m) => {
				this.xiaoliurenPanel = m;
				this.render();
			},
		});
		if (this.xiaoliurenPanel === 'library') {
			this.renderTypeLibrary(container, {
				type: 'xiaoliuren',
				emptyText: '暂无小六壬课例。起卦排盘后将自动写入课例库。',
			});
			return;
		}
		if (this.xiaoliurenPanel === 'chart') {
			this.renderXiaoliurenChart(container, workTop);
			return;
		}
		this.renderXiaoliurenCast(container);
	}

	private renderXiaoliurenCast(container: HTMLElement): void {
		const stage = container.createDiv({ cls: 'tianji-stage' });
		const form = stage.createDiv({ cls: 'tianji-form tianji-cast-card' });

		const top = form.createDiv({ cls: 'tianji-cast-row' });
		this.field(top, '占测事由', (el) => {
			const input = el.createEl('input', {
				type: 'text',
				cls: 'tianji-input',
				placeholder: '如：事业、感情、财运…',
				value: this.xiaoliurenSubject,
			});
			input.addEventListener('input', () => {
				this.xiaoliurenSubject = input.value;
			});
		});
		this.field(top, '起卦时间', (el) => {
			const input = el.createEl('input', {
				type: 'datetime-local',
				cls: 'tianji-input',
				value: this.normalizeDatetimeLocal(this.xiaoliurenCastLocal),
			});
			input.step = '1';
			input.addEventListener('change', () => {
				this.xiaoliurenCastLocal = this.normalizeDatetimeLocal(
					input.value,
				);
				input.value = this.xiaoliurenCastLocal;
			});
			const nowBtn = el.createEl('button', {
				cls: 'tianji-btn',
				text: '此刻',
			});
			nowBtn.addEventListener('click', () => {
				this.xiaoliurenCastLocal = this.toDatetimeLocal(new Date());
				input.value = this.xiaoliurenCastLocal;
			});
		});

		this.field(form, '占测问题（必填）', (el) => {
			const ta = el.createEl('textarea', {
				cls: 'tianji-textarea',
				placeholder: '请描述您的具体问题（必填）',
				attr: { required: 'true' },
			});
			ta.value = this.xiaoliurenQuestion;
			ta.rows = 3;
			ta.addEventListener('input', () => {
				this.xiaoliurenQuestion = ta.value;
			});
		});

		this.field(form, '起卦方式', (el) => {
			const wrap = el.createDiv({ cls: 'tianji-radio-row' });
			(
				Object.keys(XIAOLIUREN_METHOD_LABELS) as XiaoliurenMethod[]
			).forEach((id) => {
				this.radio(
					wrap,
					XIAOLIUREN_METHOD_LABELS[id],
					this.xiaoliurenMethod === id,
					() => {
						if (this.xiaoliurenMethod === id) return;
						this.xiaoliurenMethod = id;
						this.render();
					},
				);
			});
		});

		if (this.xiaoliurenMethod === 'number') {
			this.field(form, '报数（必填）', (el) => {
				const input = el.createEl('input', {
					type: 'number',
					cls: 'tianji-input',
					placeholder: '请报一个正整数',
					attr: { min: '1', step: '1' },
					value: this.xiaoliurenNumber,
				});
				input.addEventListener('input', () => {
					this.xiaoliurenNumber = input.value;
				});
			});
		}

		const notes = form.createEl('details', { cls: 'tianji-notes' });
		notes.createEl('summary', { text: '起卦说明' });
		const ul = notes.createEl('ul');
		const tips: Record<XiaoliurenMethod, string[]> = {
			'day-hour': [
				'按农历日自大安顺数得日宫，再自日宫起子时顺数到当前时辰得时宫（身宫）。',
				'排盘含安地支、排六亲、取六神、排五星。',
			],
			'hour-ke': [
				'自大安起子时得时宫；再自时宫起子刻（每 10 分钟一刻）得刻宫。',
				'身宫为时宫；五星自时宫起木星。',
			],
			number: [
				'报数除以 6 取余（余 0 作 6）自大安起数宫，再自数宫起时得时宫（身宫）。',
				'五星自数宫起木星。',
			],
		};
		for (const tip of tips[this.xiaoliurenMethod]) {
			ul.createEl('li', { text: tip });
		}

		const actions = form.createDiv({
			cls: 'tianji-actions tianji-cast-actions',
		});
		const btn = actions.createEl('button', {
			cls: 'tianji-btn tianji-btn-primary',
			text: '起卦排盘',
		});
		btn.addEventListener('click', () => {
			void this.runXiaoliurenCast();
		});
	}

	private requireXiaoliurenQuestion(): boolean {
		if (this.xiaoliurenQuestion.trim()) return true;
		new Notice('占测问题不能为空');
		return false;
	}

	private parseXiaoliurenCastTime(): Date {
		const d = new Date(
			this.normalizeDatetimeLocal(this.xiaoliurenCastLocal),
		);
		return Number.isNaN(d.getTime()) ? new Date() : d;
	}

	private async runXiaoliurenCast(): Promise<void> {
		if (!this.requireXiaoliurenQuestion()) return;
		if (this.xiaoliurenMethod === 'number') {
			const n = Number(this.xiaoliurenNumber);
			if (!Number.isFinite(n) || n < 1 || !Number.isInteger(n)) {
				new Notice('请输入大于 0 的正整数报数');
				return;
			}
		}
		try {
			const cast = castXiaoliuren({
				method: this.xiaoliurenMethod,
				castTime: this.parseXiaoliurenCastTime(),
				number:
					this.xiaoliurenMethod === 'number'
						? Number(this.xiaoliurenNumber)
						: undefined,
			});
			const result = buildXiaoliurenResult({
				cast,
				subject: this.xiaoliurenSubject,
				question: this.xiaoliurenQuestion,
			});
			await this.saveXiaoliurenCast(result);
		} catch (e) {
			new Notice(String(e));
		}
	}

	private async saveXiaoliurenCast(
		result: XiaoliurenResult,
	): Promise<void> {
		if (!this.requireXiaoliurenQuestion()) return;
		this.xiaoliurenResult = result;
		this.xiaoliurenTaijiPalace = null;
		this.xiaoliurenPanel = 'chart';
		const title =
			this.xiaoliurenSubject.trim() ||
			this.xiaoliurenQuestion.trim().slice(0, 20) ||
			'小六壬';
		try {
			this.xiaoliurenRecordId = await this.plugin.db.insertReading({
				type: 'xiaoliuren',
				title,
				inputJson: JSON.stringify({
					subject: this.xiaoliurenSubject,
					question: this.xiaoliurenQuestion,
					method: this.xiaoliurenMethod,
					methodLabel: result.methodLabel,
					castTime: result.castTime,
					number: result.inputNumber,
				}),
				resultJson: JSON.stringify(result),
			});
			new Notice(`已排盘：${result.methodLabel}`);
		} catch (e) {
			new Notice(`排盘已出，存档失败：${String(e)}`);
		}
		this.render();
	}

	private renderXiaoliurenChart(
		container: HTMLElement,
		topBar?: HTMLElement,
	): void {
		const stage = container.createDiv({
			cls: 'tianji-stage tianji-chart-stage',
		});
		if (!this.xiaoliurenResult) {
			this.renderChartEmpty(
				stage,
				'尚未起卦。请先在「起卦」完成排盘。',
				'去起卦',
				() => {
					this.xiaoliurenPanel = 'cast';
					this.render();
				},
			);
			return;
		}

		const r = this.xiaoliurenResult;
		const toolbar = (topBar ?? stage).createDiv({
			cls: 'tianji-chart-toolbar',
		});
		const backBtn = toolbar.createEl('button', {
			cls: 'tianji-btn',
			text: '返回起卦',
		});
		backBtn.addEventListener('click', () => {
			this.xiaoliurenPanel = 'cast';
			this.render();
		});
		const copyBtn = toolbar.createEl('button', {
			cls: 'tianji-btn tianji-btn-primary',
			text: '复制排盘',
		});
		copyBtn.addEventListener('click', () => {
			void this.copyText(
				formatXiaoliurenChartText(r, this.xiaoliurenTaijiPalace),
				'排盘已复制',
			);
		});
		this.appendFavoriteToolbarBtn(toolbar, this.xiaoliurenRecordId);

		const card = stage.createDiv({
			cls: 'tianji-result-card tianji-xlr-result',
		});
		const info = card.createDiv({ cls: 'tianji-xlr-info' });
		info.createEl('h4', { text: '基本信息' });
		const infoGrid = info.createDiv({ cls: 'tianji-xlr-info-grid' });
		const subject =
			r.question.trim()
				? `${r.subject || '问事'}（${r.question.trim()}）`
				: r.subject || '问事';
		this.addInfoCell(infoGrid, '占测事由', subject);
		this.addInfoCell(infoGrid, '起卦方式', r.methodLabel);
		this.addInfoCell(infoGrid, '公历', r.solarText);
		this.addInfoCell(infoGrid, '农历', r.lunarText);
		this.addInfoCell(infoGrid, '时辰', `${r.hourBranch}时`);
		if (r.method === 'hour-ke') {
			this.addInfoCell(infoGrid, '刻', `${r.keBranch}刻`);
		}
		if (r.method === 'number' && r.inputNumber != null) {
			this.addInfoCell(infoGrid, '报数', String(r.inputNumber));
		}
		if (r.dayPalace) this.addInfoCell(infoGrid, '日宫', r.dayPalace);
		if (r.numberPalace) this.addInfoCell(infoGrid, '数宫', r.numberPalace);
		this.addInfoCell(infoGrid, '时宫', r.hourPalace);
		if (r.kePalace) this.addInfoCell(infoGrid, '刻宫', r.kePalace);
		this.addInfoCell(infoGrid, '身宫', r.bodyPalace);

		const board = card.createDiv({ cls: 'tianji-xlr-board' });
		board.createEl('h4', { text: '课盘' });
		const taiji = this.xiaoliurenTaijiPalace;
		const displayCells = withTaijiRelations(r, taiji);
		const grid = board.createDiv({ cls: 'tianji-xlr-grid' });
		for (const cell of displayCells) {
			this.renderXiaoliurenCell(grid, cell);
		}

		const taijiBar = board.createDiv({ cls: 'tianji-xlr-taiji' });
		taijiBar.createSpan({
			cls: 'tianji-xlr-taiji-label',
			text: '立太极',
		});
		const chips = taijiBar.createDiv({ cls: 'tianji-xlr-taiji-chips' });
		for (const palace of PALACES_GRID) {
			const btn = chips.createEl('button', {
				cls: `tianji-xlr-taiji-chip${taiji === palace ? ' is-active' : ''}`,
				type: 'button',
				text: palace,
			});
			btn.addEventListener('click', () => {
				this.xiaoliurenTaijiPalace =
					this.xiaoliurenTaijiPalace === palace ? null : palace;
				this.render();
			});
		}
		taijiBar.createDiv({
			cls: 'tianji-xlr-taiji-hint',
			text: taiji
				? `当前太极：${taiji}${taiji === r.bodyPalace ? '（身宫）' : ''}（再点取消）`
				: '未立太极（点宫位立太极，六亲按该宫重排）',
		});

		this.appendReadingNoteSection(stage, this.xiaoliurenRecordId);
	}

	private renderXiaoliurenCell(
		parent: HTMLElement,
		cell: XiaoliurenCell,
	): void {
		const el = parent.createDiv({
			cls: 'tianji-xlr-cell',
			attr: { 'data-palace': cell.palace },
		});

		// 立太极后「自身」跟太极宫；未立时跟身宫（relation 已是自身）
		const isSelf = cell.relation === '自身';

		el.createSpan({
			cls: 'tianji-xlr-star',
			text: cell.star,
		});
		el.createSpan({
			cls: 'tianji-xlr-spirit',
			text: cell.spirit,
		});
		el.createSpan({
			cls: 'tianji-xlr-branch',
			text: cell.branch,
		});

		// 自身居中；右侧为「自身六亲」（地支 vs 地盘），同为红色
		if (isSelf) {
			el.createSpan({
				cls: 'tianji-xlr-self',
				text: '自身',
			});
			const side =
				cell.bodySideRelation ??
				getBodySideRelation(cell.branch, cell.palace);
			el.createSpan({
				cls: 'tianji-xlr-relation tianji-xlr-relation-self',
				text: side,
			});
		} else if (cell.relation) {
			el.createSpan({
				cls: 'tianji-xlr-relation',
				text: cell.relation,
			});
		}

		// 身宫若非当前「自身」，左下角补「身」标记
		const footMarks = this.formatXiaoliurenFootMarks(cell.marks, {
			includeShen: cell.marks.includes('身') && !isSelf,
		});
		if (footMarks) {
			el.createSpan({
				cls: 'tianji-xlr-foot-marks',
				text: footMarks,
			});
		}

		el.createSpan({
			cls: 'tianji-xlr-palace',
			text: cell.palace,
		});
	}

	/** 左下角标记：时+刻 → 时刻；身仅在非「自身」展示时保留 */
	private formatXiaoliurenFootMarks(
		marks: string[],
		opts?: { includeShen?: boolean },
	): string {
		const includeShen = opts?.includeShen ?? false;
		const set = new Set(
			marks.filter((m) => includeShen || m !== '身'),
		);
		const parts: string[] = [];
		if (set.has('日')) parts.push('日');
		if (set.has('数')) parts.push('数');
		if (set.has('时') && set.has('刻')) {
			parts.push('时刻');
			set.delete('时');
			set.delete('刻');
		} else {
			if (set.has('时')) parts.push('时');
			if (set.has('刻')) parts.push('刻');
		}
		if (includeShen && set.has('身')) parts.push('身');
		return parts.join('');
	}

	private restoreXiaoliuren(rec: ReadingRecord): void {
		const result = JSON.parse(rec.resultJson) as XiaoliurenResult;
		let input: {
			subject?: string;
			question?: string;
			method?: XiaoliurenMethod;
			castTime?: string;
			number?: number | null;
		} = {};
		try {
			input = JSON.parse(rec.inputJson) as typeof input;
		} catch {
			/* ignore */
		}

		this.xiaoliurenSubject = input.subject ?? result.subject ?? '问事';
		this.xiaoliurenQuestion = input.question ?? result.question ?? '';
		this.xiaoliurenMethod = input.method ?? result.method ?? 'day-hour';
		this.xiaoliurenNumber =
			input.number != null
				? String(input.number)
				: result.inputNumber != null
					? String(result.inputNumber)
					: '';
		if (input.castTime || result.castTime) {
			const d = new Date(input.castTime || result.castTime);
			if (!Number.isNaN(d.getTime())) {
				this.xiaoliurenCastLocal = this.toDatetimeLocal(d);
			}
		}
		this.xiaoliurenResult = result;
		this.xiaoliurenTaijiPalace = null;
		this.xiaoliurenRecordId = rec.id;
		this.xiaoliurenPanel = 'chart';
		this.activeTab = 'xiaoliuren';
		this.persistActiveTab('xiaoliuren');
	}

	/* -------------------- 分类型库 -------------------- */

	private renderPanelSwitch(
		container: HTMLElement,
		opts: {
			mode: PanelMode;
			castLabel: string;
			chartLabel: string;
			libraryLabel: string;
			type: DivinationType;
			onChange: (mode: PanelMode) => void;
		},
	): void {
		const count = this.plugin.db?.isReady()
			? this.plugin.db.countReadings(opts.type)
			: 0;
		const bar = container.createDiv({ cls: 'tianji-panel-switch' });
		const mk = (mode: PanelMode, label: string) => {
			const btn = bar.createEl('button', {
				cls: `tianji-panel-btn${opts.mode === mode ? ' is-active' : ''}`,
				type: 'button',
				text: label,
			});
			btn.addEventListener('click', () => opts.onChange(mode));
		};
		mk('cast', opts.castLabel);
		mk('chart', opts.chartLabel);
		mk('library', `${opts.libraryLabel}${count ? ` · ${count}` : ''}`);
	}

	private renderTypeLibrary(
		container: HTMLElement,
		opts: {
			type: DivinationType;
			emptyText: string;
		},
	): void {
		const favoritesOnly = this.libraryFilter === 'favorites';
		const list = this.plugin.db.listReadings(opts.type, 300, favoritesOnly);
		const favoriteCount = this.plugin.db.countReadings(opts.type, true);
		renderLibraryGrid(container, list, {
			emptyText: opts.emptyText,
			favoritesEmptyText: '暂无收藏。点击星标即可收藏。',
			filter: this.libraryFilter,
			layout: this.plugin.settings.libraryLayout ?? 'table',
			favoriteCount,
			query: this.libraryQuery,
			onFilterChange: (f) => {
				this.libraryFilter = f;
				this.render();
			},
			onLayoutChange: (layout) => {
				this.plugin.settings.libraryLayout = layout;
				void this.plugin.saveSettings();
				this.render();
			},
			onQueryChange: (q) => {
				this.libraryQuery = q;
			},
			onRestore: (rec) => this.restoreReading(rec),
			onToggleFavorite: (rec) => {
				void this.toggleFavorite(rec.id, !rec.isFavorite);
			},
			onEditNote: (rec) => this.openReadingNote(rec),
			onDelete: (id) => this.confirmDeleteReading(id),
			onCopy: (text, tip) => void this.copyText(text, tip),
		});
	}

	private confirmDeleteReading(id: number): void {
		const rec = this.plugin.db.getReading(id);
		const title = rec?.title?.trim() || '该记录';
		const hasNote = rec ? readingHasNote(rec) : false;
		const message = hasNote
			? `确定删除「${title}」？关联的笔记文件不会被删除。此操作不可撤销。`
			: `确定删除「${title}」？此操作不可撤销。`;

		new ConfirmModal(this.app, {
			title: '删除记录',
			message,
			confirmText: '删除',
			danger: true,
			onConfirm: async () => {
				await this.plugin.db.deleteReading(id);
				new Notice('已删除');
				this.render();
			},
		}).open();
	}

	private openReadingNote(rec: ReadingRecord): void {
		void this.openReadingNoteWithConfirm(rec);
	}

	/** 已绑定且文件存在 → 直接打开；否则确认创建（可开自动创建） */
	private async openReadingNoteWithConfirm(
		rec: ReadingRecord,
	): Promise<void> {
		try {
			// 用库里最新记录，避免删除后仍拿着旧 noteUid
			const latest = this.plugin.db.getReading(rec.id) ?? rec;
			const existing = await resolveReadingNoteFile(this.plugin, latest);
			const linked = Boolean(latest.noteUid?.trim());
			const autoCreate = this.plugin.settings.noteAutoCreate;

			if (existing && linked) {
				if (latest.noteUid !== existing.uid) {
					await this.plugin.db.updateNoteUid(latest.id, existing.uid);
				}
				await this.openNoteFile(existing.file, latest);
				return;
			}

			const notePath = buildNoteVaultPathForReading(
				this.plugin.settings,
				latest,
			);
			const noteName = notePath.includes('/')
				? notePath.slice(notePath.lastIndexOf('/') + 1)
				: notePath;

			if (existing && !linked) {
				if (autoCreate) {
					await this.plugin.db.updateNoteUid(latest.id, existing.uid);
					await this.openNoteFile(existing.file, latest);
					return;
				}
				new ConfirmModal(this.app, {
					title: '打开笔记',
					message: `发现未关联的笔记「${existing.file.basename}」，是否重新打开？`,
					confirmText: '打开',
					onConfirm: async () => {
						await this.plugin.db.updateNoteUid(
							latest.id,
							existing.uid,
						);
						await this.openNoteFile(existing.file, latest);
					},
				}).open();
				return;
			}

			if (autoCreate) {
				void this.openReadingNoteAsync(latest);
				return;
			}

			new ConfirmModal(this.app, {
				title: '创建笔记',
				message: `「${latest.title}」还没有笔记，是否创建「${noteName}」？`,
				confirmText: '创建',
				onConfirm: () => {
					void this.openReadingNoteAsync(latest);
				},
			}).open();
		} catch (e) {
			console.error(e);
			new Notice(`打开笔记失败：${String(e)}`);
		}
	}

	private async openReadingNoteAsync(rec: ReadingRecord): Promise<void> {
		try {
			const { file, created } = await ensureReadingNoteFile(
				this.plugin,
				rec,
			);
			if (created) {
				new Notice('已创建笔记');
			}
			await this.openNoteFile(file, rec);
		} catch (e) {
			console.error(e);
			new Notice(`打开笔记失败：${String(e)}`);
		}
	}

	private async openNoteFile(
		file: TFile,
		rec: ReadingRecord,
	): Promise<void> {
		const mode = this.plugin.settings.noteOpenMode ?? 'modal';
		if (mode === 'tab') {
			await openNoteInTab(this.app, file);
			this.render();
			return;
		}
		new FileNoteModal(this.app, {
			file,
			mode: 'source',
			onClose: () => this.render(),
			onDeleteNote: async () => {
				await this.plugin.db.updateNoteUid(rec.id, '');
				await this.plugin.db.updateNote(rec.id, '');
			},
		}).open();
	}

	/** 排盘页展示 / 编辑当前记录的 Markdown 笔记 */
	private appendReadingNoteSection(
		parent: HTMLElement,
		recordId: number | null,
	): void {
		if (recordId == null) return;
		const rec = this.plugin.db.getReading(recordId);
		if (!rec) return;

		const block = parent.createDiv({ cls: 'tianji-reading-note' });
		const head = block.createDiv({ cls: 'tianji-reading-note-head' });
		head.createDiv({
			cls: 'tianji-analysis-block-title',
			text: '笔记注释',
		});
		const hasNote = readingHasNote(rec);
		const editBtn = head.createEl('button', {
			cls: 'tianji-btn',
			type: 'button',
			text: hasNote ? '打开笔记' : '添加笔记',
		});
		editBtn.addEventListener('click', () => this.openReadingNote(rec));

		const body = block.createDiv({
			cls: 'tianji-reading-note-body markdown-preview-view',
		});

		if (hasNote) {
			void this.renderReadingNotePreview(body, rec);
		} else {
			body.createDiv({
				cls: 'tianji-empty-hint',
				text: '暂无笔记。将保存为库内 Markdown 文件。',
			});
		}
	}

	private async renderReadingNotePreview(
		body: HTMLElement,
		rec: ReadingRecord,
	): Promise<void> {
		try {
			let md = '';
			let sourcePath = '';
			if (rec.noteUid.trim()) {
				const file = await findReadingNoteFile(
					this.app,
					this.plugin.settings,
					rec.noteUid,
				);
				if (!file) {
					body.createDiv({
						cls: 'tianji-empty-hint',
						text: '未找到关联笔记文件（可点击打开以重新创建）。',
					});
					return;
				}
				md = await readNoteBody(this.app, file);
				sourcePath = file.path;
			} else {
				md = rec.noteMd;
			}
			if (!md.trim()) {
				body.createDiv({
					cls: 'tianji-empty-hint',
					text: '笔记文件为空。',
				});
				return;
			}
			await MarkdownRenderer.render(this.app, md, body, sourcePath, this);
		} catch (e) {
			body.createDiv({
				cls: 'tianji-empty-hint',
				text: `无法加载笔记：${String(e)}`,
			});
		}
	}

	private async toggleFavorite(
		id: number,
		favorite: boolean,
	): Promise<void> {
		try {
			await this.plugin.db.setFavorite(id, favorite);
			new Notice(favorite ? '已收藏' : '已取消收藏');
			this.render();
		} catch (e) {
			new Notice(`收藏失败：${String(e)}`);
		}
	}

	/** 排盘/牌阵工具栏：当前记录可收藏 */
	private appendFavoriteToolbarBtn(
		toolbar: HTMLElement,
		recordId: number | null,
	): void {
		if (recordId == null) return;
		const rec = this.plugin.db.getReading(recordId);
		if (!rec) return;
		const btn = toolbar.createEl('button', {
			cls: `tianji-btn tianji-fav-toolbar${rec.isFavorite ? ' is-active' : ''}`,
			type: 'button',
			attr: {
				title: rec.isFavorite ? '取消收藏' : '收藏',
				'aria-label': rec.isFavorite ? '取消收藏' : '收藏',
			},
		});
		const icon = btn.createSpan({ cls: 'tianji-btn-icon' });
		setIcon(icon, 'star');
		btn.createSpan({
			cls: 'tianji-btn-label',
			text: rec.isFavorite ? '已收藏' : '收藏',
		});
		btn.addEventListener('click', () => {
			void this.toggleFavorite(rec.id, !rec.isFavorite);
		});
	}

	private restoreReading(rec: ReadingRecord): void {
		try {
			if (rec.type === 'liuyao') this.restoreLiuyao(rec);
			else if (rec.type === 'xiaoliuren') this.restoreXiaoliuren(rec);
			else if (rec.type === 'meihua') this.restoreMeihua(rec);
			else if (rec.type === 'bazi') this.restoreBazi(rec);
			else this.restoreTarot(rec);
			new Notice('已打开排盘');
			this.render();
		} catch (e) {
			new Notice(`打开失败：${String(e)}`);
		}
	}

	private restoreLiuyao(rec: ReadingRecord): void {
		const result = JSON.parse(rec.resultJson) as LiuyaoResult;
		let input: {
			subject?: string;
			gender?: Gender;
			question?: string;
			method?: LiuyaoMethod;
			castTime?: string;
		} = {};
		try {
			input = JSON.parse(rec.inputJson) as typeof input;
		} catch {
			/* ignore */
		}

		this.liuyaoSubject = input.subject ?? result.subject ?? '问事';
		this.liuyaoGender = input.gender ?? result.gender ?? 'male';
		this.liuyaoQuestion = input.question ?? result.question ?? '';
		this.liuyaoMethod = input.method ?? result.method ?? 'manual';
		this.liuyaoLines = [...(result.lines ?? [7, 7, 7, 7, 7, 7])] as YaoValue[];
		this.liuyaoCoinIndex = 6;
		if (input.castTime || result.castTime) {
			const d = new Date(input.castTime || result.castTime);
			if (!Number.isNaN(d.getTime())) {
				this.liuyaoCastLocal = this.toDatetimeLocal(d);
			}
		}
		this.liuyaoResult = result;
		this.liuyaoRecordId = rec.id;
		this.liuyaoPanel = 'chart';
		this.activeTab = 'liuyao';
		this.persistActiveTab('liuyao');
	}

	private restoreBazi(rec: ReadingRecord): void {
		const chart = JSON.parse(rec.resultJson) as BaziProfessionalChart;
		let input: {
			name?: string;
			relation?: string;
			gender?: Gender;
			calendar?: CalendarType;
			leapMonth?: boolean;
			date?: string;
			time?: string;
			city?: string;
			trueSolar?: boolean;
			question?: string;
		} = {};
		try {
			input = JSON.parse(rec.inputJson) as typeof input;
		} catch {
			/* ignore */
		}

		this.baziName = input.name ?? '';
		this.baziRelation = input.relation ?? '本人';
		this.baziGender = input.gender ?? chart.gender ?? 'male';
		this.baziCalendar = input.calendar ?? chart.calendar ?? 'solar';
		this.baziLeapMonth = input.leapMonth ?? false;
		this.baziDate = input.date ?? '';
		this.baziTime = input.time ?? '12:00';
		this.baziCity = input.city ?? chart.cityName ?? '未知/不校正';
		this.baziTrueSolar = input.trueSolar ?? false;
		this.baziQuestion = input.question ?? '';
		this.baziChart = chart;
		const idx = chart.dayun?.findIndex((d) => d.liuNian?.length) ?? -1;
		this.baziSelectedDayun =
			idx >= 0 ? idx : Math.min(1, (chart.dayun?.length ?? 1) - 1);
		this.baziSelectedLiunian = 0;
		this.baziRecordId = rec.id;
		this.baziPanel = 'chart';
		this.activeTab = 'bazi';
		this.persistActiveTab('bazi');
	}

	private restoreTarot(rec: ReadingRecord): void {
		const reading = JSON.parse(rec.resultJson) as TarotReading;
		let input: {
			deckId?: DeckId;
			spreadId?: string;
			subject?: string;
			question?: string;
			allowReversed?: boolean;
			sessionUsedIds?: string[];
		} = {};
		try {
			input = JSON.parse(rec.inputJson) as typeof input;
		} catch {
			/* ignore */
		}

		this.tarotDeckId = DEFAULT_DECK_ID;
		this.tarotSpreadId = input.spreadId ?? reading.spreadId ?? 'three-time';
		this.tarotSubject =
			input.subject ?? reading.subject ?? '问事';
		this.tarotQuestion =
			input.question ?? reading.question ?? '';
		this.tarotAllowReversed = input.allowReversed !== false;
		this.tarotReading = reading;
		this.tarotRecordId = rec.id;
		this.tarotShuffling = false;
		this.tarotSessionUsedIds =
			input.sessionUsedIds?.length
				? [...input.sessionUsedIds]
				: reading.cards.map((c) => c.card.id);
		if (isFlexibleSpread(this.tarotSpreadId)) {
			this.tarotCustomCount = Math.max(1, reading.cards.length);
		}
		this.resetTarotDraft();
		this.tarotPanel = 'chart';
		this.activeTab = 'tarot';
		this.persistActiveTab('tarot');
	}

	/* -------------------- helpers -------------------- */

	private renderChartEmpty(
		parent: HTMLElement,
		title: string,
		cta: string,
		onGo: () => void,
	): void {
		const empty = parent.createDiv({ cls: 'tianji-empty tianji-empty-cta' });
		empty.createDiv({ cls: 'tianji-empty-title', text: title });
		const btn = empty.createEl('button', {
			cls: 'tianji-btn tianji-btn-primary',
			text: cta,
		});
		btn.addEventListener('click', onGo);
	}

	private async copyText(text: string, okMsg: string): Promise<void> {
		try {
			await navigator.clipboard.writeText(text);
			new Notice(okMsg);
		} catch {
			// fallback
			const ta = document.createElement('textarea');
			ta.value = text;
			ta.style.position = 'fixed';
			ta.style.left = '-9999px';
			document.body.appendChild(ta);
			ta.select();
			document.execCommand('copy');
			ta.remove();
			new Notice(okMsg);
		}
	}

	private field(
		parent: HTMLElement,
		label: string,
		build: (el: HTMLElement) => void,
	): void {
		const row = parent.createDiv({ cls: 'tianji-field' });
		row.createDiv({ cls: 'tianji-label', text: label });
		const control = row.createDiv({ cls: 'tianji-control' });
		build(control);
	}

	private radio(
		parent: HTMLElement,
		label: string,
		checked: boolean,
		onClick: () => void,
	): void {
		const btn = parent.createEl('button', {
			cls: `tianji-chip${checked ? ' is-active' : ''}`,
			type: 'button',
			text: label,
			attr: { 'data-chip': label },
		});
		btn.addEventListener('click', onClick);
	}

	private syncChipRow(row: HTMLElement, activeLabel: string): void {
		row.querySelectorAll('button.tianji-chip').forEach((btn) => {
			btn.toggleClass(
				'is-active',
				btn.getAttribute('data-chip') === activeLabel,
			);
		});
	}
}

function splitNajiaText(text: string): { liuqin: string; ganzhi: string } {
	const tags = ['父母', '兄弟', '子孙', '妻财', '官鬼'] as const;
	for (const tag of tags) {
		if (text.startsWith(tag)) {
			return { liuqin: tag, ganzhi: text.slice(tag.length) };
		}
	}
	return { liuqin: '', ganzhi: text };
}
