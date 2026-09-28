/** 小六壬六宫（顺时针自大安） */
export type XiaoliurenPalace =
	| '大安'
	| '留连'
	| '速喜'
	| '赤口'
	| '小吉'
	| '空亡';

export const PALACES_CLOCKWISE: XiaoliurenPalace[] = [
	'大安',
	'留连',
	'速喜',
	'赤口',
	'小吉',
	'空亡',
];

/**
 * 盘面 2×3 展示顺序（对齐掌诀图）：
 * 留连 | 速喜 | 赤口
 * 大安 | 空亡 | 小吉
 */
export const PALACES_GRID: XiaoliurenPalace[] = [
	'留连',
	'速喜',
	'赤口',
	'大安',
	'空亡',
	'小吉',
];

export type Dizhi =
	| '子'
	| '丑'
	| '寅'
	| '卯'
	| '辰'
	| '巳'
	| '午'
	| '未'
	| '申'
	| '酉'
	| '戌'
	| '亥';

export const DIZHI_LIST: Dizhi[] = [
	'子',
	'丑',
	'寅',
	'卯',
	'辰',
	'巳',
	'午',
	'未',
	'申',
	'酉',
	'戌',
	'亥',
];

export type WuXing = '木' | '火' | '土' | '金' | '水';

export const DIZHI_WUXING: Record<Dizhi, WuXing> = {
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

export type LiuQin =
	| '自身'
	| '父母'
	| '兄弟'
	| '子孙'
	| '妻财'
	| '官鬼';

export type LiuShen =
	| '青龙'
	| '朱雀'
	| '勾陈'
	| '白虎'
	| '玄武'
	| '腾蛇';

export const LIU_SHEN_ORDER: LiuShen[] = [
	'青龙',
	'朱雀',
	'勾陈',
	'白虎',
	'玄武',
	'腾蛇',
];

export type WuXingStar =
	| '木星'
	| '火星'
	| '土星'
	| '金星'
	| '水星'
	| '天空';

export const WU_XING_STAR_ORDER: WuXingStar[] = [
	'木星',
	'火星',
	'土星',
	'金星',
	'水星',
	'天空',
];

export function palaceIndex(palace: XiaoliurenPalace): number {
	return PALACES_CLOCKWISE.indexOf(palace);
}

/** 自大安起，步数 n（1-based：大安=1）落宫 */
export function palaceFromSteps(steps: number): XiaoliurenPalace {
	const n = ((Math.floor(steps) - 1) % 6 + 6) % 6;
	return PALACES_CLOCKWISE[n]!;
}

/** 自 start 宫起子（index 0），顺数到 targetIndex（0=子） */
export function palaceFromStartByBranchIndex(
	start: XiaoliurenPalace,
	branchIndex: number,
): XiaoliurenPalace {
	const startIdx = palaceIndex(start);
	const idx = (startIdx + ((branchIndex % 12) + 12) % 12) % 6;
	return PALACES_CLOCKWISE[idx]!;
}

/** 顺时针下 n 宫（n>=0） */
export function nextPalace(
	palace: XiaoliurenPalace,
	steps = 1,
): XiaoliurenPalace {
	const idx = (palaceIndex(palace) + steps) % 6;
	return PALACES_CLOCKWISE[idx]!;
}

/**
 * 时钟时辰地支下标。
 * 23–1 子，1–3 丑 … 21–23 亥
 */
export function hourBranchIndex(date: Date): number {
	const hour = date.getHours();
	if (hour === 23 || hour === 0) return 0;
	return Math.floor((hour + 1) / 2);
}

export function hourBranch(date: Date): Dizhi {
	return DIZHI_LIST[hourBranchIndex(date)]!;
}

/**
 * 时辰内刻：每 10 分钟一刻，子=第 1 个十分钟 … 亥=第 12 个。
 * 返回 0–11（子=0）
 */
export function keBranchIndex(date: Date): number {
	const hour = date.getHours();
	const minute = date.getMinutes();
	let minutesIntoShichen: number;
	if (hour === 23) {
		minutesIntoShichen = minute;
	} else if (hour === 0) {
		minutesIntoShichen = 60 + minute;
	} else {
		const shichenStartHour = hourBranchIndex(date) * 2 - 1;
		minutesIntoShichen = (hour - shichenStartHour) * 60 + minute;
	}
	const ke = Math.min(11, Math.floor(minutesIntoShichen / 10));
	return ke;
}

export function keBranch(date: Date): Dizhi {
	return DIZHI_LIST[keBranchIndex(date)]!;
}
