import { TAROT_DECK, type TarotCardDef } from './cards';
import { getDeckInfo, type DeckId } from './decks';
import {
	getSpread,
	isFlexibleSpread,
	resolveSpread,
	type TarotSpread,
} from './spreads';

export interface DrawnCard {
	card: TarotCardDef;
	reversed: boolean;
	positionKey: string;
	positionLabel: string;
	positionHint: string;
}

export interface TarotReading {
	deckId: DeckId;
	spreadId: string;
	spreadName: string;
	question: string;
	drawnAt: string;
	cards: DrawnCard[];
	chartText: string;
}

function shuffle<T>(arr: T[]): T[] {
	const a = [...arr];
	for (let i = a.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[a[i], a[j]] = [a[j]!, a[i]!];
	}
	return a;
}

/** 排除已用牌后的剩余牌组 */
export function remainingTarotDeck(excludeIds?: Iterable<string>): TarotCardDef[] {
	const exclude = new Set(excludeIds ?? []);
	if (exclude.size === 0) return [...TAROT_DECK];
	return TAROT_DECK.filter((c) => !exclude.has(c.id));
}

export function drawTarot(params: {
	spreadId: string;
	deckId: DeckId;
	question: string;
	/** 是否允许逆位 */
	allowReversed?: boolean;
	/** 本局已用牌，从剩余牌组抽取 */
	excludeIds?: Iterable<string>;
	/** 自定义牌阵张数 */
	cardCount?: number;
}): TarotReading {
	const base = getSpread(params.spreadId);
	const need = isFlexibleSpread(base)
		? Math.max(1, Math.floor(params.cardCount ?? 1))
		: base.positions.length;
	const spread: TarotSpread = resolveSpread(params.spreadId, need);
	const allowReversed = params.allowReversed !== false;
	const pool = shuffle(remainingTarotDeck(params.excludeIds));
	if (pool.length < need) {
		throw new Error(
			`剩余牌不足（需 ${need} 张，剩 ${pool.length} 张）`,
		);
	}

	const cards: DrawnCard[] = spread.positions.map((pos, i) => {
		const card = pool[i]!;
		return {
			card,
			reversed: allowReversed ? Math.random() < 0.5 : false,
			positionKey: pos.key,
			positionLabel: pos.label,
			positionHint: pos.hint,
		};
	});

	return finalizeReading({
		deckId: params.deckId,
		spread,
		question: params.question,
		cards,
	});
}

/** 手动指定每张牌 */
export function buildManualTarot(params: {
	spreadId: string;
	deckId: DeckId;
	question: string;
	picks: Array<{ cardId: string; reversed: boolean }>;
}): TarotReading {
	const base = getSpread(params.spreadId);
	if (isFlexibleSpread(base)) {
		if (params.picks.length < 1) {
			throw new Error('请至少选择 1 张牌');
		}
	} else if (params.picks.length !== base.positions.length) {
		throw new Error('选牌数量与牌阵位置不符');
	}
	const spread = resolveSpread(params.spreadId, params.picks.length);
	const seen = new Set<string>();
	const cards: DrawnCard[] = spread.positions.map((pos, i) => {
		const pick = params.picks[i]!;
		if (seen.has(pick.cardId)) throw new Error('同一张牌不能重复选用');
		seen.add(pick.cardId);
		const card = TAROT_DECK.find((c) => c.id === pick.cardId);
		if (!card) throw new Error(`未知牌面：${pick.cardId}`);
		return {
			card,
			reversed: pick.reversed,
			positionKey: pos.key,
			positionLabel: pos.label,
			positionHint: pos.hint,
		};
	});

	return finalizeReading({
		deckId: params.deckId,
		spread,
		question: params.question,
		cards,
	});
}

function finalizeReading(p: {
	deckId: DeckId;
	spread: TarotSpread;
	question: string;
	cards: DrawnCard[];
}): TarotReading {
	const drawnAt = new Date().toISOString();
	const chartText = formatTarotChart({
		deckId: p.deckId,
		spread: p.spread,
		question: p.question,
		drawnAt,
		cards: p.cards,
	});
	return {
		deckId: p.deckId,
		spreadId: p.spread.id,
		spreadName: p.spread.name,
		question: p.question,
		drawnAt,
		cards: p.cards,
		chartText,
	};
}

export function formatTarotChart(p: {
	deckId: DeckId;
	spread: TarotSpread;
	question: string;
	drawnAt: string;
	cards: DrawnCard[];
}): string {
	const lines = [
		`【塔罗牌阵】${p.spread.name}`,
		`牌组：${getDeckInfo(p.deckId).name}`,
		`时间：${new Date(p.drawnAt).toLocaleString()}`,
		`问题：${p.question.trim() || '（未填写）'}`,
		``,
	];
	if (p.spread.id === 'celtic-cross') {
		lines.push(
			`说明：前六张成十字，后四张成竖列。读牌先看十字再看竖列；第十张表示当下趋势，并非确定结局。`,
			``,
		);
	}
	for (const c of p.cards) {
		const orient = c.reversed ? '逆位' : '正位';
		const meaning = c.reversed ? c.card.reversed : c.card.upright;
		lines.push(
			`${c.positionLabel}（${c.positionHint}）：${c.card.name} / ${c.card.nameEn}　${orient}`,
			`  关键词：${c.card.keywords.join('、')}`,
			`  含义：${meaning}`,
			``,
		);
	}
	return lines.join('\n').trim();
}

export function formatTarotForAi(reading: TarotReading): string {
	return [
		reading.chartText,
		``,
		`请结合牌阵位置关系，给出整体故事线与可执行建议。`,
	].join('\n');
}
