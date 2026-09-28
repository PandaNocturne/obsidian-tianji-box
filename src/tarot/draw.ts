import { TAROT_DECK, type TarotCardDef } from './cards';
import { getDeckInfo, type DeckId } from './decks';
import {
	getSpread,
	isFlexibleSpread,
	resolveSpread,
	type TarotSpread,
} from './spreads';
import { getTaluoLore } from './taluo';

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
	/** 占测事由（如事业、感情） */
	subject: string;
	question: string;
	drawnAt: string;
	cards: DrawnCard[];
	chartText: string;
}

/** 取该牌当前正/逆位对应的说明（优先 Taluo 详解） */
export function getOrientMeaning(
	card: TarotCardDef,
	reversed: boolean,
): string {
	const lore = getTaluoLore(card.id);
	if (reversed) {
		return (lore?.reversed || card.reversed || '').trim();
	}
	return (lore?.upright || card.upright || '').trim();
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
	subject?: string;
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
		subject: params.subject,
		question: params.question,
		cards,
	});
}

/** 手动指定每张牌 */
export function buildManualTarot(params: {
	spreadId: string;
	deckId: DeckId;
	subject?: string;
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
		subject: params.subject,
		question: params.question,
		cards,
	});
}

function finalizeReading(p: {
	deckId: DeckId;
	spread: TarotSpread;
	subject?: string;
	question: string;
	cards: DrawnCard[];
}): TarotReading {
	const drawnAt = new Date().toISOString();
	const subject = (p.subject ?? '').trim() || '问事';
	const chartText = formatTarotChart({
		deckId: p.deckId,
		spread: p.spread,
		subject,
		question: p.question,
		drawnAt,
		cards: p.cards,
	});
	return {
		deckId: p.deckId,
		spreadId: p.spread.id,
		spreadName: p.spread.name,
		subject,
		question: p.question,
		drawnAt,
		cards: p.cards,
		chartText,
	};
}

export function formatTarotChart(p: {
	deckId: DeckId;
	spread: TarotSpread;
	subject?: string;
	question: string;
	drawnAt: string;
	cards: DrawnCard[];
}): string {
	const subject = (p.subject ?? '').trim() || '问事';
	const question = p.question.trim();
	const lines = [
		`【塔罗牌阵】${p.spread.name}`,
		`牌组：${getDeckInfo(p.deckId).name}`,
		`时间：${new Date(p.drawnAt).toLocaleString()}`,
		`占测事由：${subject}`,
		`占测问题：${question || '（未填写）'}`,
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
		const meaning = getOrientMeaning(c.card, c.reversed);
		lines.push(
			`${c.positionLabel}（${c.positionHint}）：${c.card.name} / ${c.card.nameEn}　${orient}`,
			`  关键词：${c.card.keywords.join('、')}`,
		);
		if (meaning) {
			lines.push(`  ${orient}说明：${meaning}`);
		}
		lines.push(``);
	}
	return lines.join('\n').trim();
}

/** 由完整牌阵结果重建复制文本（含当前正/逆位说明） */
export function formatTarotReadingChart(reading: TarotReading): string {
	const spread = resolveSpread(reading.spreadId, reading.cards.length);
	const body = formatTarotChart({
		deckId: reading.deckId,
		spread: {
			...spread,
			name: reading.spreadName || spread.name,
		},
		subject: reading.subject,
		question: reading.question,
		drawnAt: reading.drawnAt,
		cards: reading.cards,
	});
	// 保留续问前缀（若有）
	if (reading.chartText.startsWith('【续问】')) {
		const head = reading.chartText.split(/\n\n/)[0];
		if (head) return `${head}\n\n${body}`;
	}
	return body;
}

export function formatTarotForAi(reading: TarotReading): string {
	return [
		formatTarotReadingChart(reading),
		``,
		`请结合牌阵位置关系，给出整体故事线与可执行建议。`,
	].join('\n');
}
