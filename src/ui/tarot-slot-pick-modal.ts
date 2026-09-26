import { Modal, Notice, setIcon } from 'obsidian';
import { TAROT_DECK, type Suit, type TarotCardDef } from '../tarot/cards';
import { suitAccent } from '../tarot/decks';
import type { TarotImageCache } from '../tarot/image-cache';

type FilterId = 'all' | 'major' | Suit;

export interface TarotSlotPick {
	cardId: string;
	reversed: boolean;
}

/** 为牌阵某一位置选择 1 张牌 */
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
				? '点选 1 张牌即可；卡片角上可切换正/逆位。'
				: '点选 1 张牌即可，不会立刻进入牌阵。',
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
			attr: { placeholder: '搜索牌名…' },
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
				card.nameEn.toLowerCase().includes(q)
			);
		});

		for (const card of list) {
			const taken = this.excludeIds.has(card.id);
			const reversed = this.allowReversed
				? (this.cardReversed.get(card.id) ?? false)
				: false;

			const cell = grid.createDiv({
				cls: `tianji-pick-card${taken ? ' is-taken' : ''}${reversed ? ' is-reversed' : ''}`,
			});

			const media = cell.createDiv({ cls: 'tianji-pick-card-media' });
			this.renderMiniFace(media, card, reversed);

			if (this.allowReversed && !taken) {
				const flip = media.createEl('button', {
					cls: `tianji-pick-orient-btn${reversed ? ' is-reversed' : ''}`,
					type: 'button',
					attr: {
						title: reversed ? '切换为正位' : '切换为逆位',
						'aria-label': reversed ? '切换为正位' : '切换为逆位',
					},
				});
				setIcon(flip, 'rotate-cw');
				flip.addEventListener('click', (ev) => {
					ev.preventDefault();
					ev.stopPropagation();
					const cur = this.cardReversed.get(card.id) ?? false;
					const next = !cur;
					this.cardReversed.set(card.id, next);
					cell.toggleClass('is-reversed', next);
					flip.toggleClass('is-reversed', next);
					flip.setAttr('title', next ? '切换为正位' : '切换为逆位');
					flip.setAttr(
						'aria-label',
						next ? '切换为正位' : '切换为逆位',
					);
					const face = media.querySelector('.tianji-pick-mini-face');
					face?.toggleClass('is-reversed', next);
				});
			}

			cell.createDiv({ cls: 'tianji-pick-card-name', text: card.name });
			cell.createDiv({ cls: 'tianji-pick-card-en', text: card.nameEn });
			if (taken) {
				cell.createDiv({ cls: 'tianji-pick-taken-tag', text: '已选' });
			}

			cell.addEventListener('click', () => {
				if (taken) {
					new Notice('该牌已被其他位置选用');
					return;
				}
				this.onPick({
					cardId: card.id,
					reversed: this.allowReversed
						? (this.cardReversed.get(card.id) ?? false)
						: false,
				});
				this.close();
			});
		}
	}

	private renderMiniFace(
		parent: HTMLElement,
		card: TarotCardDef,
		reversed: boolean,
	): void {
		const face = parent.createDiv({
			cls: `tianji-pick-mini-face${reversed ? ' is-reversed' : ''}`,
		});
		const img = face.createEl('img', {
			attr: { alt: card.nameEn, loading: 'lazy' },
		});
		void this.images
			.ensure(card)
			.then((url) => {
				img.src = url;
			})
			.catch(() => {
				img.remove();
				this.fillMiniText(face, card);
			});
		img.addEventListener('error', () => {
			img.remove();
			this.fillMiniText(face, card);
		});
	}

	private fillMiniText(face: HTMLElement, card: TarotCardDef): void {
		face.empty();
		face.addClass('is-text');
		face.style.setProperty('--tarot-accent', suitAccent(card.suit));
		face.createSpan({
			text:
				card.arcana === 'major'
					? String(card.number)
					: card.number === 1
						? 'A'
						: String(card.number <= 10 ? card.number : card.name[0]),
		});
	}
}
