import type { XiaoliurenCastCore } from './casting';
import { XIAOLIUREN_METHOD_LABELS } from './casting';
import {
	DIZHI_LIST,
	DIZHI_WUXING,
	LIU_SHEN_ORDER,
	PALACES_CLOCKWISE,
	PALACES_GRID,
	PALACE_DIPAN_WUXING,
	WU_XING_STAR_ORDER,
	nextPalace,
	palaceIndex,
	type Dizhi,
	type LiuQin,
	type LiuShen,
	type WuXing,
	type WuXingStar,
	type XiaoliurenPalace,
} from './palaces';

export type XiaoliurenMark = '日' | '时' | '身' | '刻' | '数';

export interface XiaoliurenCell {
	palace: XiaoliurenPalace;
	star: WuXingStar;
	spirit: LiuShen;
	branch: Dizhi;
	relation: LiuQin;
	/** 身宫右侧：自身地支 vs 地盘五行 */
	bodySideRelation: LiuQin | null;
	marks: XiaoliurenMark[];
}

export interface XiaoliurenResult {
	method: XiaoliurenCastCore['method'];
	methodLabel: string;
	subject: string;
	question: string;
	castTime: string;
	solarText: string;
	lunarText: string;
	hourBranch: Dizhi;
	keBranch: Dizhi;
	bodyBranch: Dizhi;
	lunarDay: number;
	inputNumber: number | null;
	dayPalace: XiaoliurenPalace | null;
	hourPalace: XiaoliurenPalace;
	kePalace: XiaoliurenPalace | null;
	numberPalace: XiaoliurenPalace | null;
	bodyPalace: XiaoliurenPalace;
	starStartPalace: XiaoliurenPalace;
	/** 顺时针序六宫 */
	cells: XiaoliurenCell[];
	/** 展示网格序 */
	gridCells: XiaoliurenCell[];
	chartText: string;
}

/** 生克：other 相对 me */
function relationOf(me: WuXing, other: WuXing): LiuQin {
	if (me === other) return '兄弟';
	const shengWo: Record<WuXing, WuXing> = {
		木: '水',
		火: '木',
		土: '火',
		金: '土',
		水: '金',
	};
	const woSheng: Record<WuXing, WuXing> = {
		木: '火',
		火: '土',
		土: '金',
		金: '水',
		水: '木',
	};
	const keWo: Record<WuXing, WuXing> = {
		木: '金',
		火: '水',
		土: '木',
		金: '火',
		水: '土',
	};
	const woKe: Record<WuXing, WuXing> = {
		木: '土',
		火: '金',
		土: '水',
		金: '木',
		水: '火',
	};
	if (shengWo[me] === other) return '父母';
	if (woSheng[me] === other) return '子孙';
	if (keWo[me] === other) return '官鬼';
	if (woKe[me] === other) return '妻财';
	return '兄弟';
}

/** 安地支：自身地支安身宫，顺时针隔位排（全阴或全阳） */
export function placeBranches(
	bodyPalace: XiaoliurenPalace,
	bodyBranch: Dizhi,
): Record<XiaoliurenPalace, Dizhi> {
	const startBranchIdx = DIZHI_LIST.indexOf(bodyBranch);
	const startPalaceIdx = palaceIndex(bodyPalace);
	const map = {} as Record<XiaoliurenPalace, Dizhi>;
	for (let i = 0; i < 6; i++) {
		const palace = PALACES_CLOCKWISE[(startPalaceIdx + i) % 6]!;
		const branch = DIZHI_LIST[(startBranchIdx + i * 2) % 12]!;
		map[palace] = branch;
	}
	return map;
}

/** 排六亲：以身宫地支五行为我；兄弟取身宫顺时针第一土 */
export function placeRelations(
	branches: Record<XiaoliurenPalace, Dizhi>,
	bodyPalace: XiaoliurenPalace,
): Record<XiaoliurenPalace, LiuQin> {
	const bodyBranch = branches[bodyPalace]!;
	const me = DIZHI_WUXING[bodyBranch];
	const map = {} as Record<XiaoliurenPalace, LiuQin>;

	for (const palace of PALACES_CLOCKWISE) {
		if (palace === bodyPalace) {
			map[palace] = '自身';
			continue;
		}
		map[palace] = relationOf(me, DIZHI_WUXING[branches[palace]!]);
	}

	// 先定兄弟：身宫起顺时针第一个土支宫为兄弟（身宫本身除外）
	let cur = nextPalace(bodyPalace);
	for (let i = 0; i < 6; i++) {
		if (DIZHI_WUXING[branches[cur]!] === '土') {
			map[cur] = '兄弟';
			break;
		}
		cur = nextPalace(cur);
	}

	return map;
}

/**
 * 取自身六亲：身宫地支五行 vs 该宫地盘五行。
 * 例：未土在大安（木）→ 木克土 → 官鬼；土在赤口（金）→ 土生金 → 子孙。
 */
export function getBodySideRelation(
	bodyBranch: Dizhi,
	bodyPalace: XiaoliurenPalace,
): LiuQin {
	return relationOf(
		DIZHI_WUXING[bodyBranch],
		PALACE_DIPAN_WUXING[bodyPalace],
	);
}

/** 青龙起宫：按身宫地支 */
function qinglongStartPalace(bodyBranch: Dizhi): XiaoliurenPalace {
	switch (bodyBranch) {
		case '子':
		case '午':
			return '大安';
		case '丑':
		case '未':
			return '留连';
		case '寅':
		case '申':
			return '速喜';
		case '卯':
		case '酉':
			return '赤口';
		case '辰':
		case '戌':
			return '小吉';
		case '巳':
		case '亥':
			return '空亡';
	}
}

/** 取六神 */
export function placeSpirits(
	bodyBranch: Dizhi,
): Record<XiaoliurenPalace, LiuShen> {
	const start = qinglongStartPalace(bodyBranch);
	const startIdx = palaceIndex(start);
	const map = {} as Record<XiaoliurenPalace, LiuShen>;
	for (let i = 0; i < 6; i++) {
		const palace = PALACES_CLOCKWISE[(startIdx + i) % 6]!;
		map[palace] = LIU_SHEN_ORDER[i]!;
	}
	return map;
}

/** 排五星：自星起点（对宫/日参考宫）起木星 */
export function placeStars(
	starStart: XiaoliurenPalace,
): Record<XiaoliurenPalace, WuXingStar> {
	const startIdx = palaceIndex(starStart);
	const map = {} as Record<XiaoliurenPalace, WuXingStar>;
	for (let i = 0; i < 6; i++) {
		const palace = PALACES_CLOCKWISE[(startIdx + i) % 6]!;
		map[palace] = WU_XING_STAR_ORDER[i]!;
	}
	return map;
}

function buildMarks(
	cast: XiaoliurenCastCore,
): Record<XiaoliurenPalace, XiaoliurenMark[]> {
	const marks: Record<XiaoliurenPalace, XiaoliurenMark[]> = {
		大安: [],
		留连: [],
		速喜: [],
		赤口: [],
		小吉: [],
		空亡: [],
	};
	const push = (p: XiaoliurenPalace | null, m: XiaoliurenMark) => {
		if (!p) return;
		if (!marks[p].includes(m)) marks[p].push(m);
	};
	push(cast.dayPalace, '日');
	push(cast.numberPalace, '数');
	push(cast.hourPalace, '时');
	push(cast.kePalace, '刻');
	push(cast.bodyPalace, '身');
	return marks;
}

function formatChartText(
	result: Omit<XiaoliurenResult, 'chartText' | 'gridCells'>,
): string {
	const lines: string[] = [
		`【小六壬】${result.methodLabel}`,
		`公历：${result.solarText}`,
		`农历：${result.lunarText}`,
		`时辰：${result.hourBranch}时`,
	];
	if (result.method === 'hour-ke') {
		lines.push(`刻：${result.keBranch}刻`);
	}
	if (result.method === 'number' && result.inputNumber != null) {
		lines.push(`报数：${result.inputNumber}`);
	}
	lines.push(
		`占测事由：${result.subject.trim() || '问事'}`,
		`占测问题：${result.question.trim() || '（未填写）'}`,
		``,
	);
	if (result.dayPalace) lines.push(`日宫：${result.dayPalace}`);
	if (result.numberPalace) lines.push(`数宫：${result.numberPalace}`);
	lines.push(`时宫：${result.hourPalace}`);
	if (result.kePalace) lines.push(`刻宫：${result.kePalace}`);
	lines.push(
		`身宫：${result.bodyPalace}（${result.bodyBranch}）`,
		``,
		`—— 排盘 ——`,
	);

	for (const palace of PALACES_GRID) {
		const cell = result.cells.find((c) => c.palace === palace)!;
		const mark =
			cell.marks.length > 0 ? ` [${cell.marks.join('')}]` : '';
		const side =
			cell.bodySideRelation != null
				? ` · 自身六亲:${cell.bodySideRelation}`
				: '';
		lines.push(
			`${palace}${mark}：${cell.star} · ${cell.spirit} · ${cell.branch} · ${cell.relation}${side}`,
		);
	}
	return lines.join('\n');
}

export function buildXiaoliurenResult(params: {
	cast: XiaoliurenCastCore;
	subject: string;
	question: string;
}): XiaoliurenResult {
	const { cast, subject, question } = params;
	const branches = placeBranches(cast.bodyPalace, cast.bodyBranch);
	const relations = placeRelations(branches, cast.bodyPalace);
	const spirits = placeSpirits(cast.bodyBranch);
	const stars = placeStars(cast.starStartPalace);
	const marks = buildMarks(cast);
	const bodySide = getBodySideRelation(cast.bodyBranch, cast.bodyPalace);

	const cells: XiaoliurenCell[] = PALACES_CLOCKWISE.map((palace) => ({
		palace,
		star: stars[palace]!,
		spirit: spirits[palace]!,
		branch: branches[palace]!,
		relation: relations[palace]!,
		bodySideRelation: palace === cast.bodyPalace ? bodySide : null,
		marks: marks[palace]!,
	}));

	const partial = {
		method: cast.method,
		methodLabel: XIAOLIUREN_METHOD_LABELS[cast.method],
		subject,
		question,
		castTime: cast.castTime,
		solarText: cast.solarText,
		lunarText: cast.lunarText,
		hourBranch: cast.hourBranch,
		keBranch: cast.keBranch,
		bodyBranch: cast.bodyBranch,
		lunarDay: cast.lunarDay,
		inputNumber: cast.inputNumber,
		dayPalace: cast.dayPalace,
		hourPalace: cast.hourPalace,
		kePalace: cast.kePalace,
		numberPalace: cast.numberPalace,
		bodyPalace: cast.bodyPalace,
		starStartPalace: cast.starStartPalace,
		cells,
	};

	const gridCells = PALACES_GRID.map(
		(p) => cells.find((c) => c.palace === p)!,
	);

	return {
		...partial,
		gridCells,
		chartText: formatChartText(partial),
	};
}
