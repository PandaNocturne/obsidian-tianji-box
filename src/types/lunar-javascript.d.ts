declare module 'lunar-javascript' {
	export class Solar {
		static fromYmdHms(
			y: number,
			m: number,
			d: number,
			h: number,
			mi: number,
			s: number,
		): Solar;
		static fromYmd(y: number, m: number, d: number): Solar;
		getYear(): number;
		getMonth(): number;
		getDay(): number;
		getHour(): number;
		getMinute(): number;
		getSecond(): number;
		getLunar(): Lunar;
		toYmd(): string;
		toFullString(): string;
	}

	export class Lunar {
		static fromYmdHms(
			y: number,
			m: number,
			d: number,
			h: number,
			mi: number,
			s: number,
		): Lunar;
		static fromYmd(y: number, m: number, d: number): Lunar;
		getSolar(): Solar;
		getEightChar(): EightChar;
		/** 农历日 1–30 */
		getDay(): number;
		getMonth(): number;
		getYear(): number;
		getMonthInChinese(): string;
		getDayInChinese(): string;
		getYearInGanZhi(): string;
		toString(): string;
	}

	export class EightChar {
		getYear(): string;
		getYearGan(): string;
		getYearZhi(): string;
		getYearHideGan(): string[];
		getYearWuXing(): string;
		getYearNaYin(): string;
		getYearShiShenGan(): string;
		getYearShiShenZhi(): string[];
		getYearDiShi(): string;
		getYearXunKong(): string;
		getMonth(): string;
		getMonthGan(): string;
		getMonthZhi(): string;
		getMonthHideGan(): string[];
		getMonthWuXing(): string;
		getMonthNaYin(): string;
		getMonthShiShenGan(): string;
		getMonthShiShenZhi(): string[];
		getMonthDiShi(): string;
		getMonthXunKong(): string;
		getDay(): string;
		getDayGan(): string;
		getDayZhi(): string;
		getDayHideGan(): string[];
		getDayWuXing(): string;
		getDayNaYin(): string;
		getDayShiShenGan(): string;
		getDayShiShenZhi(): string[];
		getDayDiShi(): string;
		getDayXunKong(): string;
		getTime(): string;
		getTimeGan(): string;
		getTimeZhi(): string;
		getTimeHideGan(): string[];
		getTimeWuXing(): string;
		getTimeNaYin(): string;
		getTimeShiShenGan(): string;
		getTimeShiShenZhi(): string[];
		getTimeDiShi(): string;
		getTimeXunKong(): string;
		getTaiYuan(): string;
		getMingGong(): string;
		getShenGong(): string;
		getYun(gender: number, sect?: number): Yun;
	}

	export class Yun {
		getStartYear(): number;
		getStartMonth(): number;
		getStartDay(): number;
		getDaYun(): DaYun[];
	}

	export class DaYun {
		getGanZhi(): string;
		getStartYear(): number;
		getEndYear(): number;
		getStartAge(): number;
		getLiuNian(n?: number): LiuNian[];
	}

	export class LiuNian {
		getGanZhi(): string;
		getYear(): number;
		getAge(): number;
		getLiuYue(): LiuYue[];
	}

	export class LiuYue {
		getGanZhi(): string;
	}
}
