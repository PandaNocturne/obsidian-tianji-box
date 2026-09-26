import { Modal } from 'obsidian';
import { TAROT_DECK, type Suit } from '../tarot/cards';
import type { TarotImageCache } from '../tarot/image-cache';
import { renderTarotPickCardCell } from './tarot-pick-card';

type FilterId = 'all' | 'major' | Suit;

export interface TarotSlotPick {
	cardId: string;
	reversed: boolean;
}

/** 为牌阵某一位置选择 1 张牌（与手动选牌共用牌格：关键词 + 释义 + 详解） */
export class TarotSlotPickModal extends Modal {
	private positionLabel: string;
	private allowReversed: boolean;
	private excludeIds: Set<string>;
	private images: TarotImageCache;
	private onPick: (pick: TarotSlotPick) => void;

	/** 每张牌各自的逆位状态（由悬浮按钮切换） */
	private cardReversed = new Map<string, boolean>();
	private filter: FilterId = 'all';
	private query = '';
	private bodyEl!: HTMLElement;

	constructor(
		app: ConstructorParameters<typeof Modal>[0],
		opts: {
			positionLabel: string;
			allowReversed: boolean;
			excludeIds?: string[];
			images: TarotImageCache;
			onPick: (pick: TarotSlotPick) => void;
		},
	) {
		super(app);
		this.positionLabel = opts.positionLabel;
		this.allowReversed = opts.allowReversed;
		this.excludeIds = new Set(opts.excludeIds ?? []);
		this.images = opts.images;
		this.onPick = opts.onPick;
	}

	onOpen(): void {
		this.modalEl.addClass('tianji-tarot-pick-modal');
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl('h2', { text: `选择「${this.positionLabel}」` });
		contentEl.createEl('p', {
			cls: 'tianji-pick-meta',
			text: this.allowReversed
				? '点选 1 张即可；点 info 看详解，角标切换正/逆位。'
				: '点选 1 张即可；点 info 可查看牌意详解。',
		});

		this.bodyEl = contentEl.createDiv({ cls: 'tianji-pick-body' });
		this.paint();

		const footer = contentEl.createDiv({ cls: 'tianji-pick-footer' });
		const cancel = footer.createEl('button', {
			cls: 'tianji-btn',
			type: 'button',
			text: '取消',
		});
		cancel.addEventListener('click', () => this.close());
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private paint(): void {
		const root = this.bodyEl;
		root.empty();

		const tools = root.createDiv({ cls: 'tianji-pick-tools' });
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
				cls: `tianji-chip${this.filter === f.id ? ' is-active' : ''}`,
				type: 'button',
				text: f.label,
			});
			btn.addEventListener('click', () => {
				this.filter = f.id;
				this.paint();
			});
		}
		const search = tools.createEl('input', {
			cls: 'tianji-pick-search',
			type: 'search',
			attr: { placeholder: '搜索牌名 / 关键词…' },
		});
		search.value = this.query;
		search.addEventListener('input', () => {
			this.query = search.value;
			this.paintGrid();
		});

		const grid = root.createDiv({
			cls: 'tianji-pick-grid tianji-slot-pick-grid',
		});
		this.paintGrid(grid);
	}

	private paintGrid(gridEl?: HTMLElement): void {
		const grid =
			gridEl ??
			(this.bodyEl.querySelector(
				'.tianji-slot-pick-grid',
			) as HTMLElement | null);
		if (!grid) return;
		grid.empty();

		const q = this.query.trim().toLowerCase();
		const list = TAROT_DECK.filter((card) => {
			if (this.filter === 'major' && card.arcana !== 'major') return false;
			if (
				this.filter !== 'all' &&
				this.filter !== 'major' &&
				card.suit !== this.filter
			) {
				return false;
			}
			if (!q) return true;
			return (
				card.name.toLowerCase().includes(q) ||
				card.nameEn.toLowerCase().includes(q) ||
				card.keywords.some((k) => k.toLowerCase().includes(q))
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
			const taken = this.excludeIds.has(card.id);
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
				onSelect: () => {
					this.onPick({
						cardId: card.id,
						reversed: this.allowReversed
							? (this.cardReversed.get(card.id) ?? false)
							: false,
					});
					this.close();
				},
			});
		}
	}
}
