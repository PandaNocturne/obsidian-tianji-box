import type { Suit, TarotCardDef } from './cards';
import { getTaluoSlug } from './taluo';

export type DeckId = 'rider-waite';

export interface TarotDeckInfo {
	id: DeckId;
	name: string;
	desc: string;
	hasImages: boolean;
	backGradient: string;
}

export const TAROT_DECKS: TarotDeckInfo[] = [
	{
		id: 'rider-waite',
		name: '韦特牌组',
		desc: '经典 Rider–Waite 图；释义与牌面均已离线打包',
		hasImages: true,
		backGradient:
			'linear-gradient(145deg, #1a2744 0%, #3d2b6b 55%, #1a2744 100%)',
	},
];

export const DEFAULT_DECK_ID: DeckId = 'rider-waite';

export function getDeckInfo(id?: DeckId): TarotDeckInfo {
	return TAROT_DECKS.find((d) => d.id === id) ?? TAROT_DECKS[0]!;
}

/** 本地牌面文件名（与 assets/tarot/rider-waite/ 一致） */
export function getTaluoFilename(card: TarotCardDef): string {
	return `${getTaluoSlug(card)}.jpg`;
}

/** Sacred Texts 旧命名，兼容历史本地文件 */
export function getRiderWaiteFilename(card: TarotCardDef): string {
	if (card.arcana === 'major') {
		return `ar${String(card.number).padStart(2, '0')}.jpg`;
	}
	const suitCode: Record<Suit, string> = {
		wands: 'wa',
		cups: 'cu',
		swords: 'sw',
		pentacles: 'pe',
	};
	const code = suitCode[card.suit!];
	const rank =
		card.number === 1
			? 'ac'
			: card.number === 11
				? 'pa'
				: card.number === 12
					? 'kn'
					: card.number === 13
						? 'qu'
						: card.number === 14
							? 'ki'
							: String(card.number).padStart(2, '0');
	return `${code}${rank}.jpg`;
}

export function suitAccent(suit?: Suit): string {
	switch (suit) {
		case 'wands':
			return '#c45c26';
		case 'cups':
			return '#2a6fdb';
		case 'swords':
			return '#5b6b7a';
		case 'pentacles':
			return '#2f9e44';
		default:
			return 'var(--interactive-accent)';
	}
}
