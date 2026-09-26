import { Modal, Notice, setIcon } from 'obsidian';
import { TAROT_DECK, type Suit, type TarotCardDef } from '../tarot/cards';
import {
	getDeckInfo,
	suitAccent,
	type DeckId,
} from '../tarot/decks';
import type { TarotImageCache } from '../tarot/image-cache';
import { getSpread } from '../tarot/spreads';
import { buildManualTarot, type TarotReading } from '../tarot/draw';
import { TarotCardDetailModal } from './tarot-card-modal';

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
		},
	) {
		super(app);
		this.deckId = opts.deckId;
		this.spreadId = opts.spreadId;
		this.allowReversed = opts.allowReversed;
		this.question = opts.question;
		this.images = opts.images;
		this.onConfirm = opts.onConfirm;

		const spread = getSpread(this.spreadId);
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

		const spread = getSpread(this.spreadId);
		const deck = getDeckInfo(this.deckId);

		contentEl.createEl('h2', { text: '手动选牌' });
		contentEl.createEl('p', {
			cls: 'tianji-pick-meta',
			text: this.allowReversed
				? `${spread.name} · ${deck.name} · 共 ${spread.positions.length} 张 · 卡片角上可切换正/逆位`
				: `${spread.name} · ${deck.name} · 共 ${spread.positions.length} 张`,
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
		const spread = getSpread(this.spreadId);

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

			const infoBtn = media.createEl('button', {
				cls: 'tianji-pick-info-btn',
				type: 'button',
				attr: {
					title: '查看牌意详解',
					'aria-label': '查看牌意详解',
				},
			});
			setIcon(infoBtn, 'info');
			infoBtn.addEventListener('click', (ev) => {
				ev.preventDefault();
				ev.stopPropagation();
				new TarotCardDetailModal(this.app, this.images, {
					card,
					reversed,
				}).open();
			});

			cell.createDiv({
				cls: 'tianji-pick-card-name',
				text: card.name,
			});
			cell.createDiv({
				cls: 'tianji-pick-card-en',
				text: card.nameEn,
			});
			if (taken) {
				cell.createDiv({
					cls: 'tianji-pick-taken-tag',
					text: '已选',
				});
			}
			cell.addEventListener('click', () => {
				if (taken) {
					new Notice('该牌已被其他位置选用');
					return;
				}
				this.assignCard(card);
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
			attr: {
				alt: card.nameEn,
				loading: 'lazy',
			},
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
