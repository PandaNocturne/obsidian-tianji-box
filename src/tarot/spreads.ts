export interface SpreadPosition {
	key: string;
	label: string;
	hint: string;
}

export interface TarotSpread {
	id: string;
	name: string;
	desc: string;
	positions: SpreadPosition[];
	/** 自定义：张数不固定，由选牌时动态生成位置 */
	flexible?: boolean;
}

export const CUSTOM_SPREAD_ID = 'custom';

/** 精选常用牌阵（布局与释义对齐常见牌阵手册） */
export const TAROT_SPREADS: TarotSpread[] = [
	{
		id: CUSTOM_SPREAD_ID,
		name: '自定义',
		desc: '任意张数，点 + 自选卡牌',
		positions: [],
		flexible: true,
	},
	{
		id: 'single',
		name: '单牌启示',
		desc: '一牌直指当下核心讯息',
		positions: [{ key: 'core', label: '核心', hint: '此刻最需要看见的' }],
	},
	{
		id: 'three-time',
		name: '时间流',
		desc: '过去 · 现在 · 未来（3 张）',
		positions: [
			{ key: 'past', label: '过去', hint: '已发生的影响' },
			{ key: 'present', label: '现在', hint: '当前状态' },
			{ key: 'future', label: '未来', hint: '可能走向' },
		],
	},
	{
		id: 'lovers-pyramid',
		name: '恋人金字塔',
		desc: '双方看法与关系发展（4 张）',
		positions: [
			{ key: 'you', label: '你看对方', hint: '你对对方的看法' },
			{ key: 'other', label: '对方看你', hint: '对方对你的看法' },
			{ key: 'relation', label: '关系现状', hint: '双方关系的现状' },
			{ key: 'path', label: '关系发展', hint: '双方关系的发展' },
		],
	},
	{
		id: 'love-cross',
		name: '爱情十字',
		desc: '看法 · 现状 · 发展 · 结果（5 张）',
		positions: [
			{ key: 'you', label: '你看对方', hint: '你对对方的看法' },
			{ key: 'other', label: '对方看你', hint: '对方对你的看法' },
			{ key: 'now', label: '关系现状', hint: '双方关系的现状' },
			{ key: 'path', label: '关系发展', hint: '双方关系的发展' },
			{ key: 'result', label: '关系结果', hint: '双方关系的结果' },
		],
	},
	{
		id: 'two-choice',
		name: '二选一',
		desc: '现状分叉，对照 A / B（5 张）',
		positions: [
			{ key: 'now', label: '现状', hint: '当前处境与问题核心' },
			{ key: 'aNear', label: '选 A 近期', hint: '选择 A 的近期发展' },
			{ key: 'bNear', label: '选 B 近期', hint: '选择 B 的近期发展' },
			{ key: 'aOut', label: '选 A 结果', hint: '选择 A 的最终结果' },
			{ key: 'bOut', label: '选 B 结果', hint: '选择 B 的最终结果' },
		],
	},
	{
		id: 'relation-six',
		name: '关系发展',
		desc: '双方视角对照（6 张）',
		positions: [
			{ key: 'youView', label: '你看对方', hint: '你对对方的看法' },
			{ key: 'otherView', label: '对方看你', hint: '对方对你的看法' },
			{ key: 'youRel', label: '你看关系', hint: '你对目前关系的看法' },
			{ key: 'otherRel', label: '对方看关系', hint: '对方对目前关系的看法' },
			{ key: 'youHope', label: '你的期望', hint: '你对关系发展的期望' },
			{ key: 'otherHope', label: '对方期望', hint: '对方对关系发展的期望' },
		],
	},
	{
		id: 'holy-triangle',
		name: '圣三角',
		desc: '原因 · 现况 · 结果（3 张）',
		positions: [
			{ key: 'cause', label: '原因', hint: '问题的起因' },
			{ key: 'now', label: '现况', hint: '当下状态' },
			{ key: 'result', label: '结果', hint: '可能结果' },
		],
	},
	{
		id: 'hexagram-seven',
		name: '问题六芒星',
		desc: '七牌深层解析',
		positions: [
			{ key: 'past', label: '过去', hint: '过去影响' },
			{ key: 'now', label: '现况', hint: '当前核心' },
			{ key: 'future', label: '未来', hint: '未来趋势' },
			{ key: 'guide', label: '指引', hint: '建议与指引' },
			{ key: 'env', label: '环境', hint: '外部环境' },
			{ key: 'hope', label: '期望', hint: '期望与顾虑' },
			{ key: 'result', label: '结果', hint: '综合结果' },
		],
	},
	{
		id: 'career-five',
		name: '事业五牌',
		desc: '工作与决策参考',
		positions: [
			{ key: 'now', label: '现状', hint: '当前事业局面' },
			{ key: 'strength', label: '优势', hint: '可依靠的力量' },
			{ key: 'block', label: '阻碍', hint: '需要面对的问题' },
			{ key: 'action', label: '行动', hint: '建议行动' },
			{ key: 'result', label: '前景', hint: '可能结果' },
		],
	},
	{
		id: 'celtic-cross',
		name: '凯尔特十字',
		desc: '前六张成十字，后四张成竖列；第十张为当下趋势',
		positions: [
			{ key: 'p1', label: '当前处境', hint: '此时此地的核心状态' },
			{ key: 'p2', label: '挑战或帮助', hint: '横跨其上的助力或阻力' },
			{ key: 'p3', label: '根基', hint: '事情的根基与深层基础' },
			{ key: 'p4', label: '过去', hint: '刚刚过去、仍有影响的因素' },
			{
				key: 'p5',
				label: '目标或显意识方向',
				hint: '显意识中的目标与方向',
			},
			{ key: 'p6', label: '不久的未来', hint: '即将到来的发展趋势' },
			{ key: 'p7', label: '自身态度', hint: '你对此事的态度与状态' },
			{ key: 'p8', label: '周围或他人', hint: '环境与他人的影响' },
			{ key: 'p9', label: '希望与担忧', hint: '内心的希望与担忧' },
			{
				key: 'p10',
				label: '结局',
				hint: '当下趋势，并非确定结局',
			},
		],
	},
];

export function getSpread(id: string): TarotSpread {
	return TAROT_SPREADS.find((s) => s.id === id) ?? TAROT_SPREADS[1]!;
}

export function isFlexibleSpread(
	spread: TarotSpread | string | null | undefined,
): boolean {
	if (!spread) return false;
	if (typeof spread === 'string') {
		return (
			spread === CUSTOM_SPREAD_ID || getSpread(spread).flexible === true
		);
	}
	return spread.flexible === true || spread.id === CUSTOM_SPREAD_ID;
}

/** 按张数生成自定义牌位 */
export function buildCustomPositions(count: number): SpreadPosition[] {
	const n = Math.max(0, Math.floor(count));
	return Array.from({ length: n }, (_, i) => ({
		key: `c${i + 1}`,
		label: `第 ${i + 1} 张`,
		hint: '自定义位置',
	}));
}

/** 解析牌阵；自定义时按 cardCount 填充位置 */
export function resolveSpread(id: string, cardCount?: number): TarotSpread {
	const base = getSpread(id);
	if (!isFlexibleSpread(base)) return base;
	const n = Math.max(0, cardCount ?? 0);
	return {
		...base,
		positions: buildCustomPositions(n),
	};
}
