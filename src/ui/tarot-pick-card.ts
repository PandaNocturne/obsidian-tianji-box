import { Notice, setIcon, type App } from 'obsidian';
import type { TarotCardDef } from '../tarot/cards';
import { suitAccent } from '../tarot/decks';
import type { TarotImageCache } from '../tarot/image-cache';
import { TarotCardDetailModal } from './tarot-card-modal';

export interface TarotPickCardCellOpts {
	app: App;
	images: TarotImageCache;
	card: TarotCardDef;
	reversed: boolean;
	taken: boolean;
	allowReversed: boolean;
	/** 切换该牌正/逆位后回调（用于同步 Map） */
	onToggleReversed: (next: boolean) => void;
	/** 点选该牌 */
	onSelect: () => void;
}

/** 选牌网格中的统一牌格：封面 + 正逆位 + 详解 + 关键词 */
export function renderTarotPickCardCell(
	parent: HTMLElement,
	opts: TarotPickCardCellOpts,
): HTMLElement {
	const { card, taken, allowReversed } = opts;
	let reversed = opts.reversed;

	const cell = parent.createDiv({
		cls: `tianji-pick-card${taken ? ' is-taken' : ''}${reversed ? ' is-reversed' : ''}`,
	});

	const media = cell.createDiv({ cls: 'tianji-pick-card-media' });
	renderMiniFace(media, opts.images, card, reversed);

	cell.createDiv({ cls: 'tianji-pick-card-name', text: card.name });
	cell.createDiv({ cls: 'tianji-pick-card-en', text: card.nameEn });
	if (card.keywords.length) {
		cell.createDiv({
			cls: 'tianji-pick-card-keywords',
			text: card.keywords.join(' · '),
		});
	}

	if (allowReversed && !taken) {
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
			reversed = !reversed;
			opts.onToggleReversed(reversed);
			cell.toggleClass('is-reversed', reversed);
			flip.toggleClass('is-reversed', reversed);
			flip.setAttr('title', reversed ? '切换为正位' : '切换为逆位');
			flip.setAttr(
				'aria-label',
				reversed ? '切换为正位' : '切换为逆位',
			);
			const face = media.querySelector('.tianji-pick-mini-face');
			face?.toggleClass('is-reversed', reversed);
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
		new TarotCardDetailModal(opts.app, opts.images, {
			card,
			reversed,
		}).open();
	});

	if (taken) {
		cell.createDiv({ cls: 'tianji-pick-taken-tag', text: '已选' });
	}

	cell.addEventListener('click', () => {
		if (taken) {
			new Notice('该牌已被其他位置选用');
			return;
		}
		opts.onSelect();
	});

	return cell;
}

function renderMiniFace(
	parent: HTMLElement,
	images: TarotImageCache,
	card: TarotCardDef,
	reversed: boolean,
): void {
	const face = parent.createDiv({
		cls: `tianji-pick-mini-face${reversed ? ' is-reversed' : ''}`,
	});
	const img = face.createEl('img', {
		attr: { alt: card.nameEn, loading: 'lazy' },
	});
	void images
		.ensure(card)
		.then((url) => {
			img.src = url;
		})
		.catch(() => {
			img.remove();
			fillMiniText(face, card);
		});
	img.addEventListener('error', () => {
		img.remove();
		fillMiniText(face, card);
	});
}

function fillMiniText(face: HTMLElement, card: TarotCardDef): void {
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
