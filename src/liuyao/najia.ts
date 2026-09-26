/**
 * 京房纳甲 · 六亲六神世应
 */

export type Element = '木' | '火' | '土' | '金' | '水';
export type LiuQin = '父母' | '兄弟' | '子孙' | '妻财' | '官鬼';
export type LiuShen = '青龙' | '朱雀' | '勾陈' | '螣蛇' | '白虎' | '玄武';
export type Trigram = '乾' | '兑' | '离' | '震' | '巽' | '坎' | '艮' | '坤';

export interface NajiaYao {
	/** 0-5 初到上 */
	pos: number;
	stem: string;
	branch: string;
	element: Element;
	liuqin: LiuQin;
	text: string; // 如 父母辛卯木
}

/** 八卦纳甲：初→上 六爻干支 */
const TRIGRAM_NAJIA: Record<Trigram, string[]> = {
	乾: ['甲子', '甲寅', '甲辰', '壬午', '壬申', '壬戌'],
	坤: ['乙未', '乙巳', '乙卯', '癸丑', '癸亥', '癸酉'],
	震: ['庚子', '庚寅', '庚辰', '庚午', '庚申', '庚戌'],
	巽: ['辛丑', '辛亥', '辛酉', '辛未', '辛巳', '辛卯'],
	坎: ['戊寅', '戊辰', '戊午', '戊申', '戊戌', '戊子'],
	离: ['己卯', '己丑', '己亥', '己酉', '己未', '己巳'],
	艮: ['丙辰', '丙午', '丙申', '丙戌', '丙子', '丙寅'],
	兑: ['丁巳', '丁卯', '丁丑', '丁亥', '丁酉', '丁未'],
};

const TRIGRAM_ELEMENT: Record<Trigram, Element> = {
	乾: '金',
	兑: '金',
	离: '火',
	震: '木',
	巽: '木',
	坎: '水',
	艮: '土',
	坤: '土',
};

const BRANCH_ELEMENT: Record<string, Element> = {
	子: '水',
	丑: '土',
	寅: '木',
	卯: '木',
	辰: '土',
	巳: '火',
	午: '火',
	未: '土',
	申: '金',
	酉: '金',
	戌: '土',
	亥: '水',
};

const LIU_SHEN_ORDER: LiuShen[] = [
	'青龙',
	'朱雀',
	'勾陈',
	'螣蛇',
	'白虎',
	'玄武',
];

/** binary 三位 → 卦 */
export function trigramFromBinary(bits: string): Trigram {
	const map: Record<string, Trigram> = {
		'111': '乾',
		'110': '兑',
		'101': '离',
		'100': '震',
		'011': '巽',
		'010': '坎',
		'001': '艮',
		'000': '坤',
	};
	return map[bits] ?? '坤';
}

/**
 * 八宫：本宫世在六，一世世在一…五世世在五，游魂世在四，归魂世在三
 * 值 = 世爻位置 1-6
 */
const SHI_BY_NAME: Record<string, number> = {
	// 乾宫
	乾: 6, 姤: 1, 遁: 2, 否: 3, 观: 4, 剥: 5, 晋: 4, 大有: 3,
	// 坤宫
	坤: 6, 复: 1, 临: 2, 泰: 3, 大壮: 4, 夬: 5, 需: 4, 比: 3,
	// 震宫
	震: 6, 豫: 1, 解: 2, 恒: 3, 升: 4, 井: 5, 大过: 4, 随: 3,
	// 巽宫
	巽: 6, 小畜: 1, 家人: 2, 益: 3, 无妄: 4, 噬嗑: 5, 颐: 4, 蛊: 3,
	// 坎宫
	坎: 6, 节: 1, 屯: 2, 既济: 3, 革: 4, 丰: 5, 明夷: 4, 师: 3,
	// 离宫
	离: 6, 旅: 1, 鼎: 2, 未济: 3, 蒙: 4, 涣: 5, 讼: 4, 同人: 3,
	// 艮宫
	艮: 6, 贲: 1, 大畜: 2, 损: 3, 睽: 4, 履: 5, 中孚: 4, 渐: 3,
	// 兑宫
	兑: 6, 困: 1, 萃: 2, 咸: 3, 蹇: 4, 谦: 5, 小过: 4, 归妹: 3,
};

const PALACE_BY_NAME: Record<string, Trigram> = {
	乾: '乾', 姤: '乾', 遁: '乾', 否: '乾', 观: '乾', 剥: '乾', 晋: '乾', 大有: '乾',
	坤: '坤', 复: '坤', 临: '坤', 泰: '坤', 大壮: '坤', 夬: '坤', 需: '坤', 比: '坤',
	震: '震', 豫: '震', 解: '震', 恒: '震', 升: '震', 井: '震', 大过: '震', 随: '震',
	巽: '巽', 小畜: '巽', 家人: '巽', 益: '巽', 无妄: '巽', 噬嗑: '巽', 颐: '巽', 蛊: '巽',
	坎: '坎', 节: '坎', 屯: '坎', 既济: '坎', 革: '坎', 丰: '坎', 明夷: '坎', 师: '坎',
	离: '离', 旅: '离', 鼎: '离', 未济: '离', 蒙: '离', 涣: '离', 讼: '离', 同人: '离',
	艮: '艮', 贲: '艮', 大畜: '艮', 损: '艮', 睽: '艮', 履: '艮', 中孚: '艮', 渐: '艮',
	兑: '兑', 困: '兑', 萃: '兑', 咸: '兑', 蹇: '兑', 谦: '兑', 小过: '兑', 归妹: '兑',
};

export function getShiYing(hexName: string): { shi: number; ying: number } {
	const shi = SHI_BY_NAME[hexName] ?? 6;
	const ying = ((shi - 1 + 3) % 6) + 1;
	return { shi, ying };
}

export function getPalaceElement(hexName: string): Element {
	const palace = PALACE_BY_NAME[hexName] ?? '乾';
	return TRIGRAM_ELEMENT[palace];
}

/** 生克：我(宫) vs 爻五行 → 六亲 */
export function getLiuQin(self: Element, other: Element): LiuQin {
	if (self === other) return '兄弟';
	if (generates(self, other)) return '子孙'; // 我生
	if (generates(other, self)) return '父母'; // 生我
	if (controls(self, other)) return '妻财'; // 我克
	return '官鬼'; // 克我
}

function generates(a: Element, b: Element): boolean {
	const map: Record<Element, Element> = {
		木: '火',
		火: '土',
		土: '金',
		金: '水',
		水: '木',
	};
	return map[a] === b;
}

function controls(a: Element, b: Element): boolean {
	const map: Record<Element, Element> = {
		木: '土',
		土: '水',
		水: '火',
		火: '金',
		金: '木',
	};
	return map[a] === b;
}

/**
 * 按日干安六神（初爻→上爻）
 * 甲乙青龙、丙丁朱雀、戊勾陈、己螣蛇、庚辛白虎、壬癸玄武
 */
export function getLiuShenByDayStem(dayStem: string): LiuShen[] {
	const startMap: Record<string, number> = {
		甲: 0,
		乙: 0,
		丙: 1,
		丁: 1,
		戊: 2,
		己: 3,
		庚: 4,
		辛: 4,
		壬: 5,
		癸: 5,
	};
	const start = startMap[dayStem] ?? 0;
	return [0, 1, 2, 3, 4, 5].map(
		(i) => LIU_SHEN_ORDER[(start + i) % 6]!,
	);
}

/** 取本卦六爻纳甲（相对 palaceElement 定六亲） */
export function buildNajiaLines(
	binary: string,
	palaceElement: Element,
): NajiaYao[] {
	const lower = trigramFromBinary(binary.slice(0, 3));
	const upper = trigramFromBinary(binary.slice(3, 6));
	const lowerNajia = TRIGRAM_NAJIA[lower];
	const upperNajia = TRIGRAM_NAJIA[upper];

	const lines: NajiaYao[] = [];
	for (let i = 0; i < 6; i++) {
		const ganZhi =
			i < 3 ? lowerNajia[i]! : upperNajia[i]!;
		const stem = ganZhi[0]!;
		const branch = ganZhi[1]!;
		const element = BRANCH_ELEMENT[branch] ?? '土';
		const liuqin = getLiuQin(palaceElement, element);
		lines.push({
			pos: i,
			stem,
			branch,
			element,
			liuqin,
			text: `${liuqin}${stem}${branch}${element}`,
		});
	}
	return lines;
}
