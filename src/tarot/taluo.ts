import type { TarotCardDef } from './cards';
import taluoPack from './taluo-lore.json';

export interface TaluoCardLore {
	slug: string;
	sourceUrl: string;
	imageUrl: string;
	keywords: string[];
	upright: string;
	reversed: string;
	love: string;
	career: string;
	money: string;
	advice: string;
	affirmation: string;
	element: string;
	astrology: string;
}

export const TALUO_SOURCE = 'https://taluo.net/';
export const TALUO_FETCHED_AT = (taluoPack as { fetchedAt?: string }).fetchedAt ?? '';

const CARDS = (taluoPack as { cards: Record<string, TaluoCardLore> }).cards;

export function getTaluoSlug(card: TarotCardDef): string {
	if (card.arcana === 'major') {
		return `major_${card.number}`;
	}
	const suitSlug: Record<string, string> = {
		cups: 'cup',
		swords: 'sword',
		wands: 'wand',
		pentacles: 'pentacle',
	};
	return `${suitSlug[card.suit!]}_${card.number - 1}`;
}

export function getTaluoPageUrl(card: TarotCardDef): string {
	return `https://taluo.net/cards/${getTaluoSlug(card)}`;
}

export function getTaluoImageUrl(card: TarotCardDef): string {
	return `https://taluo.net/image/${getTaluoSlug(card)}.jpg`;
}

export function getTaluoLore(cardId: string): TaluoCardLore | undefined {
	return CARDS[cardId];
}

/** 用 Taluo.net 释义覆盖牌面短释义 */
export function enrichCardWithTaluo(card: TarotCardDef): TarotCardDef {
	const lore = getTaluoLore(card.id);
	if (!lore) return card;
	return {
		...card,
		keywords: lore.keywords.length ? lore.keywords : card.keywords,
		upright: lore.upright || card.upright,
		reversed: lore.reversed || card.reversed,
	};
}
