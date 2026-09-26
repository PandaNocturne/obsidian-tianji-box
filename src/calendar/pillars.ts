import type { BaziPillar } from '../types';

const STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'] as const;
const BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'] as const;

const JIEQI_DAY: number[] = [6, 4, 6, 5, 6, 6, 7, 8, 8, 8, 7, 7];

export function getYearPillar(date: Date): BaziPillar {
	let year = date.getFullYear();
	const month = date.getMonth() + 1;
	const day = date.getDate();
	if (month < 2 || (month === 2 && day < 4)) {
		year -= 1;
	}
	const stem = STEMS[((year - 4) % 10 + 10) % 10]!;
	const branch = BRANCHES[((year - 4) % 12 + 12) % 12]!;
	return { stem, branch, label: `${stem}${branch}` };
}

export function getMonthPillar(date: Date, yearStem: string): BaziPillar {
	const month = date.getMonth() + 1;
	const day = date.getDate();

	let yinIndex: number;
	if (month === 1 || (month === 2 && day < (JIEQI_DAY[1] ?? 4))) {
		yinIndex = 12;
	} else {
		yinIndex = month - 1;
		if (day < (JIEQI_DAY[month - 1] ?? 6) && month >= 3) {
			yinIndex = month - 2;
		}
		if (yinIndex <= 0) yinIndex = 12;
	}

	const branch = BRANCHES[(yinIndex + 1) % 12]!;
	const yearStemIdx = STEMS.indexOf(yearStem as (typeof STEMS)[number]);
	const monthStemStart = [2, 4, 6, 8, 0][yearStemIdx % 5]!;
	const stem = STEMS[(monthStemStart + yinIndex - 1) % 10]!;
	return { stem, branch, label: `${stem}${branch}` };
}

export function getDayPillar(date: Date): BaziPillar {
	const utc = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
	const ref = Date.UTC(1900, 0, 1);
	const days = Math.floor((utc - ref) / 86400000);
	const stem = STEMS[((0 + days) % 10 + 10) % 10]!;
	const branch = BRANCHES[((10 + days) % 12 + 12) % 12]!;
	return { stem, branch, label: `${stem}${branch}` };
}

export function getHourPillar(date: Date, dayStem: string): BaziPillar {
	const hour = date.getHours();
	let branchIdx: number;
	if (hour === 23 || hour === 0) branchIdx = 0;
	else branchIdx = Math.floor((hour + 1) / 2);

	const branch = BRANCHES[branchIdx]!;
	const dayStemIdx = STEMS.indexOf(dayStem as (typeof STEMS)[number]);
	const hourStemStart = [0, 2, 4, 6, 8][dayStemIdx % 5]!;
	const stem = STEMS[(hourStemStart + branchIdx) % 10]!;
	return { stem, branch, label: `${stem}${branch}` };
}

export function getFourPillars(date: Date): {
	year: BaziPillar;
	month: BaziPillar;
	day: BaziPillar;
	hour: BaziPillar;
} {
	const year = getYearPillar(date);
	const month = getMonthPillar(date, year.stem);
	const day = getDayPillar(date);
	const hour = getHourPillar(date, day.stem);
	return { year, month, day, hour };
}

export function formatSolar(date: Date): string {
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

/**
 * 按日柱干支求旬空。
 * 甲子旬空戌亥、甲戌旬空申酉、甲申旬空午未、
 * 甲午旬空辰巳、甲辰旬空寅卯、甲寅旬空子丑
 */
export function getXunKongByGanZhi(stem: string, branch: string): string {
	const stemIdx = STEMS.indexOf(stem as (typeof STEMS)[number]);
	const branchIdx = BRANCHES.indexOf(branch as (typeof BRANCHES)[number]);
	if (stemIdx < 0 || branchIdx < 0) return '';

	const xunHead = ((branchIdx - stemIdx) % 12 + 12) % 12;
	const map: Record<number, string> = {
		0: '戌亥',
		10: '申酉',
		8: '午未',
		6: '辰巳',
		4: '寅卯',
		2: '子丑',
	};
	return map[xunHead] ?? '';
}

export { STEMS, BRANCHES };
