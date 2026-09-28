import { Solar } from 'lunar-javascript';
import {
	DIZHI_LIST,
	hourBranch,
	hourBranchIndex,
	keBranch,
	keBranchIndex,
	palaceFromStartByBranchIndex,
	palaceFromSteps,
	type Dizhi,
	type XiaoliurenPalace,
} from './palaces';

export type XiaoliurenMethod = 'day-hour' | 'hour-ke' | 'number';

export const XIAOLIUREN_METHOD_LABELS: Record<XiaoliurenMethod, string> = {
	'day-hour': '日时起卦',
	'hour-ke': '时刻起卦',
	number: '数字起卦',
};

export interface XiaoliurenCastInput {
	method: XiaoliurenMethod;
	castTime: Date;
	/** 数字起卦报数（正整数） */
	number?: number;
}

export interface XiaoliurenCastCore {
	method: XiaoliurenMethod;
	castTime: string;
	/** 农历日（初几，1–30） */
	lunarDay: number;
	lunarText: string;
	solarText: string;
	hourBranch: Dizhi;
	keBranch: Dizhi;
	/** 日时：日宫；其它方法为空 */
	dayPalace: XiaoliurenPalace | null;
	/** 时辰落宫 */
	hourPalace: XiaoliurenPalace;
	/** 时刻：刻宫 */
	kePalace: XiaoliurenPalace | null;
	/** 数字：数宫 */
	numberPalace: XiaoliurenPalace | null;
	/** 身宫 = 时辰落宫 */
	bodyPalace: XiaoliurenPalace;
	/** 排五星起点宫（日参考宫） */
	starStartPalace: XiaoliurenPalace;
	/** 报数（数字起卦） */
	inputNumber: number | null;
}

function pad(n: number): string {
	return String(n).padStart(2, '0');
}

function formatSolarLocal(date: Date): string {
	return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function lunarInfo(date: Date): { day: number; text: string } {
	const solar = Solar.fromYmdHms(
		date.getFullYear(),
		date.getMonth() + 1,
		date.getDate(),
		date.getHours(),
		date.getMinutes(),
		date.getSeconds(),
	);
	const lunar = solar.getLunar();
	const day = lunar.getDay();
	const monthName = lunar.getMonthInChinese();
	const dayName = lunar.getDayInChinese();
	const yearGanZhi = lunar.getYearInGanZhi();
	return {
		day,
		text: `${yearGanZhi}年${monthName}月${dayName}`,
	};
}

/**
 * 三种起卦：仅定位宫位，不装盘。
 * - 日时：大安起日 → 日上起时
 * - 时刻：大安起时 → 时上起刻
 * - 数字：大安起数(n%6,0→6) → 数上起时
 */
export function castXiaoliuren(input: XiaoliurenCastInput): XiaoliurenCastCore {
	const date = input.castTime;
	const lunar = lunarInfo(date);
	const hIdx = hourBranchIndex(date);
	const hBranch = hourBranch(date);
	const kBranch = keBranch(date);
	const kIdx = keBranchIndex(date);

	let dayPalace: XiaoliurenPalace | null = null;
	let hourPalace: XiaoliurenPalace;
	let kePalace: XiaoliurenPalace | null = null;
	let numberPalace: XiaoliurenPalace | null = null;
	let starStartPalace: XiaoliurenPalace;
	let inputNumber: number | null = null;

	if (input.method === 'day-hour') {
		dayPalace = palaceFromSteps(lunar.day);
		hourPalace = palaceFromStartByBranchIndex(dayPalace, hIdx);
		starStartPalace = dayPalace;
	} else if (input.method === 'hour-ke') {
		hourPalace = palaceFromStartByBranchIndex('大安', hIdx);
		kePalace = palaceFromStartByBranchIndex(hourPalace, kIdx);
		starStartPalace = hourPalace;
	} else {
		const raw = Math.floor(Number(input.number));
		if (!Number.isFinite(raw) || raw < 1) {
			throw new Error('请输入大于 0 的正整数');
		}
		inputNumber = raw;
		const rem = raw % 6;
		const steps = rem === 0 ? 6 : rem;
		numberPalace = palaceFromSteps(steps);
		hourPalace = palaceFromStartByBranchIndex(numberPalace, hIdx);
		starStartPalace = numberPalace;
	}

	return {
		method: input.method,
		castTime: date.toISOString(),
		lunarDay: lunar.day,
		lunarText: lunar.text,
		solarText: formatSolarLocal(date),
		hourBranch: hBranch,
		keBranch: kBranch,
		dayPalace,
		hourPalace,
		kePalace,
		numberPalace,
		bodyPalace: hourPalace,
		starStartPalace,
		inputNumber,
	};
}

export function dizhiLabel(idx: number): Dizhi {
	return DIZHI_LIST[((idx % 12) + 12) % 12]!;
}
