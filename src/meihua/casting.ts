import { Solar } from 'lunar-javascript';
import {
	mod6,
	mod8,
	trigramFromNumber,
	type MeihuaTrigram,
} from './trigrams';

export type MeihuaMethod = 'time' | 'numbers' | 'three';

export const MEIHUA_METHOD_LABELS: Record<MeihuaMethod, string> = {
	time: '时间起卦',
	numbers: '数字起卦',
	three: '三数起卦',
};

export interface MeihuaCastInput {
	method: MeihuaMethod;
	castTime: Date;
	/** 数字起卦：上卦数 */
	num1?: number;
	/** 数字起卦：下卦数；三数起卦：下卦数 */
	num2?: number;
	/** 三数起卦：动爻数 */
	num3?: number;
}

export interface MeihuaCastCore {
	method: MeihuaMethod;
	castTime: string;
	solarText: string;
	lunarText: string;
	/** 农历年支数 1–12 */
	yearZhiNum: number;
	lunarMonth: number;
	lunarDay: number;
	/** 时支数 1–12 */
	hourZhiNum: number;
	hourBranch: string;
	yearBranch: string;
	upper: MeihuaTrigram;
	lower: MeihuaTrigram;
	/** 动爻 1–6 */
	movingLine: number;
	num1: number | null;
	num2: number | null;
	num3: number | null;
}

const ZHI = [
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
] as const;

function pad(n: number): string {
	return String(n).padStart(2, '0');
}

function formatSolarLocal(date: Date): string {
	return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

/** 时辰地支序：子=1 … 亥=12（23–1 子，1–3 丑…） */
export function hourZhiIndex(date: Date): number {
	const h = date.getHours();
	if (h === 23 || h === 0) return 1;
	return Math.floor((h + 1) / 2) + 1;
}

function requirePositiveInt(n: number | undefined, label: string): number {
	if (n == null || !Number.isFinite(n) || n < 1 || !Number.isInteger(n)) {
		throw new Error(`${label}须为正整数`);
	}
	return n;
}

/**
 * 梅花起卦核心：
 * - time：(年支+月+日)%8 上；(年支+月+日+时)%8 下；(年支+月+日+时)%6 动
 * - numbers：n1%8 上，n2%8 下，(n1+n2)%6 动
 * - three：n1%8 上，n2%8 下，n3%6 动
 */
export function castMeihua(input: MeihuaCastInput): MeihuaCastCore {
	const date = input.castTime;
	const solar = Solar.fromYmdHms(
		date.getFullYear(),
		date.getMonth() + 1,
		date.getDate(),
		date.getHours(),
		date.getMinutes(),
		date.getSeconds(),
	);
	const lunar = solar.getLunar();
	const yearGanZhi = lunar.getYearInGanZhi();
	const yearBranch = yearGanZhi.slice(-1);
	const yearZhiNum = ZHI.indexOf(yearBranch as (typeof ZHI)[number]) + 1;
	const lunarMonth = Math.abs(lunar.getMonth());
	const lunarDay = lunar.getDay();
	const hourZhiNum = hourZhiIndex(date);
	const hourBranch = ZHI[hourZhiNum - 1]!;

	let upperNum: number;
	let lowerNum: number;
	let movingRaw: number;
	let num1: number | null = null;
	let num2: number | null = null;
	let num3: number | null = null;

	if (input.method === 'time') {
		const base = yearZhiNum + lunarMonth + lunarDay;
		upperNum = mod8(base);
		lowerNum = mod8(base + hourZhiNum);
		movingRaw = mod6(base + hourZhiNum);
	} else if (input.method === 'numbers') {
		num1 = requirePositiveInt(input.num1, '上卦数');
		num2 = requirePositiveInt(input.num2, '下卦数');
		upperNum = mod8(num1);
		lowerNum = mod8(num2);
		movingRaw = mod6(num1 + num2);
	} else {
		num1 = requirePositiveInt(input.num1, '上卦数');
		num2 = requirePositiveInt(input.num2, '下卦数');
		num3 = requirePositiveInt(input.num3, '动爻数');
		upperNum = mod8(num1);
		lowerNum = mod8(num2);
		movingRaw = mod6(num3);
	}

	const monthName = lunar.getMonthInChinese();
	const dayName = lunar.getDayInChinese();

	return {
		method: input.method,
		castTime: date.toISOString(),
		solarText: formatSolarLocal(date),
		lunarText: `${yearGanZhi}年${monthName}月${dayName}`,
		yearZhiNum: yearZhiNum || 1,
		lunarMonth,
		lunarDay,
		hourZhiNum,
		hourBranch,
		yearBranch: yearBranch || '子',
		upper: trigramFromNumber(upperNum),
		lower: trigramFromNumber(lowerNum),
		movingLine: movingRaw,
		num1,
		num2,
		num3,
	};
}
