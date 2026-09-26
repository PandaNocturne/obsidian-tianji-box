import { Modal, Notice, setIcon } from 'obsidian';
import { TAROT_DECK, type TarotCardDef } from '../tarot/cards';
import { getDeckInfo, type DeckId } from '../tarot/decks';
import { getSpread } from '../tarot/spreads';
import { buildManualTarot, type TarotReading } from '../tarot/draw';

interface BackSlot {
	/** index into shuffled deck; null = empty */
	deckIndex: number | null;
	reversed: boolean;
}

type ShuffleLayout = 'grid' | 'stack';

function shuffleDeck(): TarotCardDef[] {
	const a = [...TAROT_DECK];
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
	private onConfirm: (reading: TarotReading) => void;

	private shuffled: TarotCardDef[] = [];
	private slots: BackSlot[] = [];
	private activePos = 0;
	private layoutMode: ShuffleLayout = 'stack';
	private bodyEl!: HTMLElement;

	constructor(
		app: ConstructorParameters<typeof Modal>[0],
		opts: {
			deckId: DeckId;
			spreadId: string;
			allowReversed: boolean;
			question: string;
			onConfirm: (reading: TarotReading) => void;
		},
	) {
		super(app);
		this.deckId = opts.deckId;
		this.spreadId = opts.spreadId;
		this.allowReversed = opts.allowReversed;
		this.question = opts.question;
		this.onConfirm = opts.onConfirm;

		const spread = getSpread(this.spreadId);
		this.slots = spread.positions.map(() => ({
			deckIndex: null,
			reversed: false,
		}));
		this.shuffled = shuffleDeck();
	}

	onOpen(): void {
		this.modalEl.addClass('tianji-tarot-pick-modal');
		this.modalEl.addClass('tianji-tarot-shuffle-modal');
		const { contentEl } = this;
		contentEl.empty();

		const spread = getSpread(this.spreadId);
		const deck = getDeckInfo(this.deckId);

		contentEl.createEl('h2', { text: '洗牌抽牌' });
		contentEl.createEl('p', {
			cls: 'tianji-pick-meta',
			text: this.allowReversed
				? `${spread.name} · ${deck.name} · 牌背已洗匀，凭直觉点选 ${spread.positions.length} 张（正/逆位随抽牌随机）`
				: `${spread.name} · ${deck.name} · 牌背已洗匀，凭直觉点选 ${spread.positions.length} 张`,
		});

		this.bodyEl = contentEl.createDiv({ cls: 'tianji-pick-body' });
		this.paint();

		const footer = contentEl.createDiv({ cls: 'tianji-pick-footer' });

		const reshuffle = footer.createEl('button', {
			cls: 'tianji-btn',
			text: '重新洗牌',
		});
		reshuffle.addEventListener('click', () => {
			this.shuffled = shuffleDeck();
			this.slots = this.slots.map(() => ({
				deckIndex: null,
				reversed: false,
			}));
			this.activePos = 0;
			this.paint();
			new Notice('已重新洗牌');
		});

		const cancel = footer.createEl('button', {
			cls: 'tianji-btn',
			text: '取消',
		});
		cancel.addEventListener('click', () => this.close());

		const ok = footer.createEl('button', {
			cls: 'tianji-btn tianji-btn-primary',
			text: '翻开确认',
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
				if (taken) {
					new Notice('这张牌背已被选过');
					return;
				}
				this.assignBack(i);
			});
		});

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
