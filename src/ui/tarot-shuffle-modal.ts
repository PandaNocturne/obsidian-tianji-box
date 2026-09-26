import { Modal, Notice, setIcon } from 'obsidian';
import { TAROT_DECK, type TarotCardDef } from '../tarot/cards';
import { getDeckInfo, type DeckId } from '../tarot/decks';
import { isFlexibleSpread, resolveSpread } from '../tarot/spreads';
import { buildManualTarot, type TarotReading } from '../tarot/draw';

interface BackSlot {
	/** index into shuffled deck; null = empty */
	deckIndex: number | null;
	reversed: boolean;
}

type ShuffleLayout = 'grid' | 'stack';

function shuffleDeck(excludeIds?: Iterable<string>): TarotCardDef[] {
	const exclude = new Set(excludeIds ?? []);
	const a = TAROT_DECK.filter((c) => !exclude.has(c.id));
	for (let i = a.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[a[i], a[j]] = [a[j]!, a[i]!];
	}
	return a;
}

/** 洗牌后以牌背展示，由用户点选 */
export class TarotShuffleModal extends Modal {
	private deckId: DeckId;
	private spreadId: string;
	private allowReversed: boolean;
	private question: string;
	private excludeIds: Set<string>;
	private cardCount: number | null;
	private onConfirm: (reading: TarotReading) => void;

	private shuffled: TarotCardDef[] = [];
	private slots: BackSlot[] = [];
	private activePos = 0;
	private layoutMode: ShuffleLayout = 'stack';
	private bodyEl!: HTMLElement;
	private shuffling = false;
	private settleAfterPaint = false;
	private shuffleTimer: number | null = null;

	constructor(
		app: ConstructorParameters<typeof Modal>[0],
		opts: {
			deckId: DeckId;
			spreadId: string;
			allowReversed: boolean;
			question: string;
			/** 本局已用牌，仅展示剩余牌背 */
			excludeIds?: Iterable<string>;
			/** 自定义牌阵张数 */
			cardCount?: number;
			onConfirm: (reading: TarotReading) => void;
		},
	) {
		super(app);
		this.deckId = opts.deckId;
		this.spreadId = opts.spreadId;
		this.allowReversed = opts.allowReversed;
		this.question = opts.question;
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
			deckIndex: null,
			reversed: false,
		}));
		this.shuffled = shuffleDeck(this.excludeIds);
	}

	onOpen(): void {
		this.modalEl.addClass('tianji-tarot-pick-modal');
		this.modalEl.addClass('tianji-tarot-shuffle-modal');
		const { contentEl } = this;
		contentEl.empty();

		const spread = resolveSpread(
			this.spreadId,
			isFlexibleSpread(this.spreadId)
				? (this.cardCount ?? this.slots.length)
				: undefined,
		);
		const deck = getDeckInfo(this.deckId);
		const remain = this.shuffled.length;
		const need = spread.positions.length;
		if (need < 1 || remain < need) {
			contentEl.createEl('h2', { text: '洗牌抽牌' });
			contentEl.createEl('p', {
				cls: 'tianji-pick-meta',
				text:
					need < 1
						? '请先设定要抽的张数。'
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

		contentEl.createEl('h2', { text: '洗牌抽牌' });
		const remainHint =
			this.excludeIds.size > 0
				? ` · 剩余 ${remain} 张`
				: '';
		contentEl.createEl('p', {
			cls: 'tianji-pick-meta',
			text: this.allowReversed
				? `${spread.name} · ${deck.name}${remainHint} · 牌背已洗匀，凭直觉点选 ${need} 张（正/逆位随抽牌随机）`
				: `${spread.name} · ${deck.name}${remainHint} · 牌背已洗匀，凭直觉点选 ${need} 张`,
		});

		this.bodyEl = contentEl.createDiv({ cls: 'tianji-pick-body' });
		this.paint();

		const footer = contentEl.createDiv({ cls: 'tianji-pick-footer' });

		const cancel = footer.createEl('button', {
			cls: 'tianji-btn',
			text: '取消',
		});
		cancel.addEventListener('click', () => this.close());

		const ok = footer.createEl('button', {
			cls: 'tianji-btn tianji-btn-primary',
			text: '确认',
		});
		ok.addEventListener('click', () => this.submit());
	}

	onClose(): void {
		if (this.shuffleTimer != null) {
			window.clearTimeout(this.shuffleTimer);
			this.shuffleTimer = null;
		}
		this.shuffling = false;
		this.contentEl.empty();
	}

	private paint(): void {
		const root = this.bodyEl;
		root.empty();
		const spread = resolveSpread(this.spreadId, this.slots.length);
		const deck = getDeckInfo(this.deckId);

		const layout = root.createDiv({
			cls: 'tianji-pick-layout tianji-shuffle-layout',
		});

		const picker = layout.createDiv({ cls: 'tianji-pick-picker' });
		const head = picker.createDiv({ cls: 'tianji-shuffle-picker-head' });
		const active = spread.positions[this.activePos];
		const picked = this.slots.filter((s) => s.deckIndex != null).length;
		head.createDiv({
			cls: 'tianji-pick-section-title',
			text: active
				? `为「${active.label}」选一张牌背（已选 ${picked}/${spread.positions.length}）`
				: '选牌背',
		});

		const modeRow = head.createDiv({ cls: 'tianji-shuffle-layout-switch' });
		const modes: Array<{ id: ShuffleLayout; label: string }> = [
			{ id: 'stack', label: '堆叠' },
			{ id: 'grid', label: '网格' },
		];
		for (const m of modes) {
			const btn = modeRow.createEl('button', {
				cls: `tianji-chip${this.layoutMode === m.id ? ' is-active' : ''}`,
				type: 'button',
				text: m.label,
			});
			btn.addEventListener('click', () => {
				if (this.layoutMode === m.id) return;
				this.layoutMode = m.id;
				this.paint();
			});
		}

		const backs = picker.createDiv({
			cls:
				this.layoutMode === 'stack'
					? 'tianji-shuffle-stack'
					: 'tianji-shuffle-grid',
		});
		const used = new Set(
			this.slots
				.map((s) => s.deckIndex)
				.filter((v): v is number => v != null),
		);

		this.shuffled.forEach((_, i) => {
			const taken = used.has(i);
			const cell = backs.createDiv({
				cls: `tianji-shuffle-back${taken ? ' is-taken' : ''}`,
				attr: { style: `--shuffle-i: ${i}` },
			});
			const face = cell.createDiv({ cls: 'tianji-shuffle-back-face' });
			face.style.background = deck.backGradient;
			face.createSpan({ text: 'TAROT' });
			if (taken) {
				const order = this.slots.findIndex((s) => s.deckIndex === i);
				cell.createDiv({
					cls: 'tianji-pick-taken-tag',
					text: order >= 0 ? String(order + 1) : '已选',
				});
			}
			cell.addEventListener('click', () => {
				if (this.shuffling) return;
				if (taken) {
					new Notice('这张牌背已被选过');
					return;
				}
				this.assignBack(i);
			});
		});

		if (this.settleAfterPaint) {
			this.settleAfterPaint = false;
			backs.addClass('is-settling');
			window.setTimeout(() => {
				backs.removeClass('is-settling');
			}, 720);
		}

		const reshuffle = picker.createEl('button', {
			cls: 'tianji-btn tianji-shuffle-reshuffle-btn',
			type: 'button',
			text: '重新洗牌',
		});
		reshuffle.disabled = this.shuffling;
		reshuffle.addEventListener('click', () => this.reshuffle());

		const side = layout.createDiv({
			cls: 'tianji-pick-slots tianji-shuffle-slots',
		});
		side.createDiv({ cls: 'tianji-pick-section-title', text: '牌阵位置' });

		const slotRow = side.createDiv({ cls: 'tianji-shuffle-slot-row' });
		spread.positions.forEach((pos, i) => {
			const slot = this.slots[i]!;
			const row = slotRow.createDiv({
				cls: `tianji-pick-slot${this.activePos === i ? ' is-active' : ''}${slot.deckIndex != null ? ' is-filled' : ''}`,
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
				text:
					slot.deckIndex != null
						? `已选牌背 #${slot.deckIndex + 1}`
						: '点上方牌背选取',
			});
			row.addEventListener('click', () => {
				this.activePos = i;
				this.paint();
			});

			if (slot.deckIndex != null) {
				const reselect = row.createEl('button', {
					cls: 'tianji-shuffle-reselect-btn',
					type: 'button',
					attr: {
						title: '重选此位',
						'aria-label': '重选此位',
					},
				});
				setIcon(reselect, 'refresh-cw');
				reselect.addEventListener('click', (e) => {
					e.stopPropagation();
					slot.deckIndex = null;
					slot.reversed = false;
					this.activePos = i;
					this.paint();
				});
			}
		});
	}

	private reshuffle(): void {
		if (this.shuffling) return;
		this.shuffling = true;

		const backs = this.bodyEl.querySelector(
			'.tianji-shuffle-stack, .tianji-shuffle-grid',
		);
		const btn = this.bodyEl.querySelector(
			'.tianji-shuffle-reshuffle-btn',
		) as HTMLButtonElement | null;
		if (btn) btn.disabled = true;
		backs?.addClass('is-shuffling');

		if (this.shuffleTimer != null) {
			window.clearTimeout(this.shuffleTimer);
		}
		this.shuffleTimer = window.setTimeout(() => {
			this.shuffleTimer = null;
			this.reshuffleUnusedBacks();
			this.shuffling = false;
			this.settleAfterPaint = true;
			this.paint();
			new Notice('已重新洗牌');
		}, 720);
	}

	/** 只打乱未选牌背，保留已选位置与正/逆位 */
	private reshuffleUnusedBacks(): void {
		const taken = new Set(
			this.slots
				.map((s) => s.deckIndex)
				.filter((v): v is number => v != null),
		);
		const freeIdx: number[] = [];
		const freeCards: TarotCardDef[] = [];
		for (let i = 0; i < this.shuffled.length; i++) {
			if (taken.has(i)) continue;
			freeIdx.push(i);
			freeCards.push(this.shuffled[i]!);
		}
		for (let i = freeCards.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[freeCards[i], freeCards[j]] = [freeCards[j]!, freeCards[i]!];
		}
		freeIdx.forEach((idx, n) => {
			this.shuffled[idx] = freeCards[n]!;
		});
	}

	private assignBack(deckIndex: number): void {
		const slot = this.slots[this.activePos];
		if (!slot) return;
		slot.deckIndex = deckIndex;
		/* 正/逆位随抽牌随机产生，不可手动指定 */
		slot.reversed = this.allowReversed ? Math.random() < 0.5 : false;

		const nextEmpty = this.slots.findIndex(
			(s, i) => i > this.activePos && s.deckIndex == null,
		);
		if (nextEmpty >= 0) this.activePos = nextEmpty;
		else {
			const firstEmpty = this.slots.findIndex((s) => s.deckIndex == null);
			if (firstEmpty >= 0) this.activePos = firstEmpty;
		}
		this.paint();
	}

	private submit(): void {
		const missing = this.slots.findIndex((s) => s.deckIndex == null);
		if (missing >= 0) {
			this.activePos = missing;
			this.paint();
			new Notice(`请先为第 ${missing + 1} 个位置选一张牌背`);
			return;
		}
		try {
			const reading = buildManualTarot({
				spreadId: this.spreadId,
				deckId: this.deckId,
				question: this.question,
				picks: this.slots.map((s) => {
					const card = this.shuffled[s.deckIndex!]!;
					return {
						cardId: card.id,
						reversed: s.reversed,
					};
				}),
			});
			this.onConfirm(reading);
			this.close();
		} catch (e) {
			new Notice(String(e));
		}
	}
}
