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
}

/** 精选常用牌阵（布局与释义对齐常见牌阵手册） */
export const TAROT_SPREADS: TarotSpread[] = [
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
		desc: '经典十牌全方位解读',
		positions: [
			{ key: 'p1', label: '现状', hint: '当前处境' },
			{ key: 'p2', label: '挑战', hint: '交叉阻力' },
			{ key: 'p3', label: '过去', hint: '根基/过去' },
			{ key: 'p4', label: '未来', hint: '可能到来' },
			{ key: 'p5', label: '目标', hint: '意识目标' },
			{ key: 'p6', label: '潜意', hint: '潜意识' },
			{ key: 'p7', label: '自我', hint: '你的态度' },
			{ key: 'p8', label: '环境', hint: '周围影响' },
			{ key: 'p9', label: '希望', hint: '希望恐惧' },
			{ key: 'p10', label: '结果', hint: '最终结果' },
		],
	},
];

export function getSpread(id: string): TarotSpread {
	return TAROT_SPREADS.find((s) => s.id === id) ?? TAROT_SPREADS[0]!;
}
