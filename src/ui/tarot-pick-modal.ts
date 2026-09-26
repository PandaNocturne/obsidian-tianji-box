import { Modal, Notice } from 'obsidian';
import { TAROT_DECK, type Suit, type TarotCardDef } from '../tarot/cards';
import {
	getDeckInfo,
	type DeckId,
} from '../tarot/decks';
import type { TarotImageCache } from '../tarot/image-cache';
import { isFlexibleSpread, resolveSpread } from '../tarot/spreads';
import { buildManualTarot, type TarotReading } from '../tarot/draw';
import { renderTarotPickCardCell } from './tarot-pick-card';

type FilterId = 'all' | 'major' | Suit;

interface PickSlot {
	cardId: string | null;
	reversed: boolean;
}

export class TarotPickModal extends Modal {
	private deckId: DeckId;
	private spreadId: string;
	private allowReversed: boolean;
	private question: string;
	private images: TarotImageCache;
	private excludeIds: Set<string>;
	private cardCount: number | null;
	private onConfirm: (reading: TarotReading) => void;

	private slots: PickSlot[] = [];
	private activePos = 0;
	private filter: FilterId = 'all';
	private query = '';
	/** 牌库中每张牌的预览逆位（悬浮按钮切换） */
	private cardReversed = new Map<string, boolean>();
	private bodyEl!: HTMLElement;
	private gridEl: HTMLElement | null = null;

	constructor(
		app: ConstructorParameters<typeof Modal>[0],
		opts: {
			deckId: DeckId;
			spreadId: string;
			allowReversed: boolean;
			question: string;
			images: TarotImageCache;
			onConfirm: (reading: TarotReading) => void;
			/** 打开时预选的牌位下标 */
			initialPos?: number;
			/** 本局已用牌，仅展示剩余牌 */
			excludeIds?: Iterable<string>;
			/** 自定义牌阵张数 */
			cardCount?: number;
		},
	) {
		super(app);
		this.deckId = opts.deckId;
		this.spreadId = opts.spreadId;
		this.allowReversed = opts.allowReversed;
		this.question = opts.question;
		this.images = opts.images;
		this.excludeIds = new Set(opts.excludeIds ?? []);
		this.cardCount =
			opts.cardCount != null ? Math.max(1, Math.floor(opts.cardCount)) : null;
		this.onConfirm = opts.onConfirm;

		const spread = resolveSpread(
			this.spreadId,
			isFlexibleSpread(this.spreadId)
				? (this.cardCount ?? 1)
				: undefined,
		);
		this.slots = spread.positions.map(() => ({
			cardId: null,
			reversed: false,
		}));
		const pos = opts.initialPos ?? 0;
		this.activePos = Math.max(0, Math.min(pos, spread.positions.length - 1));
	}

	onOpen(): void {
		this.modalEl.addClass('tianji-tarot-pick-modal');
		const { contentEl } = this;
		contentEl.empty();

		const spread = resolveSpread(
			this.spreadId,
			isFlexibleSpread(this.spreadId)
				? (this.cardCount ?? this.slots.length)
				: undefined,
		);
		const deck = getDeckInfo(this.deckId);
		const remain = TAROT_DECK.length - this.excludeIds.size;
		const need = spread.positions.length;
		if (need < 1 || remain < need) {
			contentEl.createEl('h2', { text: '手动选牌' });
			contentEl.createEl('p', {
				cls: 'tianji-pick-meta',
				text:
					need < 1
						? '请先设定要选的张数。'
						: `剩余牌不足：需 ${need} 张，仅剩 ${remain} 张。请换更少张的牌阵，或返回后「新开一局」。`,
			});
			const footer = contentEl.createDiv({ cls: 'tianji-pick-footer' });
			const close = footer.createEl('button', {
				cls: 'tianji-btn tianji-btn-primary',
				text: '关闭',
			});
			close.addEventListener('click', () => this.close());
			return;
		}

		contentEl.createEl('h2', { text: '手动选牌' });
		const remainHint =
			this.excludeIds.size > 0 ? ` · 剩余 ${remain} 张` : '';
		contentEl.createEl('p', {
			cls: 'tianji-pick-meta',
			text: this.allowReversed
				? `${spread.name} · ${deck.name}${remainHint} · 共选 ${need} 张 · 点 info 看详解，角标切换正/逆位`
				: `${spread.name} · ${deck.name}${remainHint} · 共选 ${need} 张 · 点 info 看详解`,
		});

		this.bodyEl = contentEl.createDiv({ cls: 'tianji-pick-body' });
		this.paint();

		const footer = contentEl.createDiv({ cls: 'tianji-pick-footer' });
		const cancel = footer.createEl('button', {
			cls: 'tianji-btn',
			text: '取消',
		});
		cancel.addEventListener('click', () => this.close());

		const clear = footer.createEl('button', {
			cls: 'tianji-btn',
			text: '清空',
		});
		clear.addEventListener('click', () => {
			this.slots = this.slots.map(() => ({
				cardId: null,
				reversed: false,
			}));
			this.cardReversed.clear();
			this.activePos = 0;
			this.paint();
		});

		const ok = footer.createEl('button', {
			cls: 'tianji-btn tianji-btn-primary',
			text: '确认牌阵',
		});
		ok.addEventListener('click', () => this.submit());
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private paint(): void {
		const root = this.bodyEl;
		root.empty();
		const spread = resolveSpread(this.spreadId, this.slots.length);

		const layout = root.createDiv({ cls: 'tianji-pick-layout' });

		const picker = layout.createDiv({ cls: 'tianji-pick-picker' });
		const active = spread.positions[this.activePos];
		picker.createDiv({
			cls: 'tianji-pick-section-title',
			text: active
				? `为「${active.label}」选牌（${this.activePos + 1}/${spread.positions.length}）`
				: '选牌',
		});

		const tools = picker.createDiv({ cls: 'tianji-pick-tools' });
		const filters: Array<{ id: FilterId; label: string }> = [
			{ id: 'all', label: '全部' },
			{ id: 'major', label: '大阿卡纳' },
			{ id: 'wands', label: '权杖' },
			{ id: 'cups', label: '圣杯' },
			{ id: 'swords', label: '宝剑' },
			{ id: 'pentacles', label: '星币' },
		];
		const filterRow = tools.createDiv({ cls: 'tianji-pick-filters' });
		for (const f of filters) {
			const btn = filterRow.createEl('button', {
				cls: `tianji-pick-filter${this.filter === f.id ? ' is-active' : ''}`,
				text: f.label,
				type: 'button',
			});
			btn.addEventListener('click', () => {
				this.filter = f.id;
				this.paint();
			});
		}

		const search = tools.createEl('input', {
			cls: 'tianji-input tianji-pick-search',
			type: 'search',
			placeholder: '搜索牌名…',
			value: this.query,
		});
		search.addEventListener('input', () => {
			this.query = search.value.trim();
			if (this.gridEl) this.paintGrid(this.gridEl);
		});

		this.gridEl = picker.createDiv({ cls: 'tianji-pick-grid' });
		this.paintGrid(this.gridEl);

		const side = layout.createDiv({ cls: 'tianji-pick-slots' });
		side.createDiv({ cls: 'tianji-pick-section-title', text: '牌阵位置' });
		const slotRow = side.createDiv({ cls: 'tianji-pick-slot-row' });

		spread.positions.forEach((pos, i) => {
			const slot = this.slots[i]!;
			const card = slot.cardId
				? TAROT_DECK.find((c) => c.id === slot.cardId)
				: undefined;
			const row = slotRow.createDiv({
				cls: `tianji-pick-slot${this.activePos === i ? ' is-active' : ''}${slot.cardId ? ' is-filled' : ''}`,
			});
			row.createDiv({
				cls: 'tianji-pick-slot-idx',
				text: String(i + 1),
			});
			const info = row.createDiv({ cls: 'tianji-pick-slot-info' });
			info.createDiv({
				cls: 'tianji-pick-slot-label',
				text: pos.label,
			});
			info.createDiv({
				cls: 'tianji-pick-slot-hint',
				text: pos.hint,
			});
			info.createDiv({
				cls: 'tianji-pick-slot-card',
				text: card
					? `${card.name}${slot.reversed ? ' · 逆位' : ' · 正位'}`
					: '点上方牌库选取',
			});
			row.addEventListener('click', () => {
				this.activePos = i;
				this.paint();
			});
		});
	}

	private paintGrid(grid: HTMLElement): void {
		grid.empty();
		const used = new Set(
			this.slots.map((s) => s.cardId).filter(Boolean) as string[],
		);
		const q = this.query.toLowerCase();

		const list = TAROT_DECK.filter((c) => {
			if (this.excludeIds.has(c.id)) return false;
			if (this.filter === 'major' && c.arcana !== 'major') return false;
			if (
				this.filter !== 'all' &&
				this.filter !== 'major' &&
				c.suit !== this.filter
			) {
				return false;
			}
			if (!q) return true;
			return (
				c.name.toLowerCase().includes(q) ||
				c.nameEn.toLowerCase().includes(q) ||
				c.keywords.some((k) => k.toLowerCase().includes(q))
			);
		});

		if (list.length === 0) {
			grid.createDiv({
				cls: 'tianji-empty',
				text: '没有匹配的牌',
			});
			return;
		}

		for (const card of list) {
			const taken = used.has(card.id);
			const reversed = this.allowReversed
				? (this.cardReversed.get(card.id) ?? false)
				: false;

			renderTarotPickCardCell(grid, {
				app: this.app,
				images: this.images,
				card,
				reversed,
				taken,
				allowReversed: this.allowReversed,
				onToggleReversed: (next) => {
					this.cardReversed.set(card.id, next);
				},
				onSelect: () => this.assignCard(card),
			});
		}
	}

	private assignCard(card: TarotCardDef): void {
		const slot = this.slots[this.activePos];
		if (!slot) return;
		slot.cardId = card.id;
		slot.reversed = this.allowReversed
			? (this.cardReversed.get(card.id) ?? false)
			: false;

		const nextEmpty = this.slots.findIndex(
			(s, i) => i > this.activePos && !s.cardId,
		);
		if (nextEmpty >= 0) this.activePos = nextEmpty;
		else {
			const firstEmpty = this.slots.findIndex((s) => !s.cardId);
			if (firstEmpty >= 0) this.activePos = firstEmpty;
		}
		this.paint();
	}

	private submit(): void {
		const missing = this.slots.findIndex((s) => !s.cardId);
		if (missing >= 0) {
			this.activePos = missing;
			this.paint();
			new Notice(`请先为第 ${missing + 1} 个位置选牌`);
			return;
		}
		try {
			const reading = buildManualTarot({
				spreadId: this.spreadId,
				deckId: this.deckId,
				question: this.question,
				picks: this.slots.map((s) => ({
					cardId: s.cardId!,
					reversed: s.reversed,
				})),
			});
			this.onConfirm(reading);
			this.close();
		} catch (e) {
			new Notice(String(e));
		}
	}
}
