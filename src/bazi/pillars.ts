import { Solar, Lunar } from 'lunar-javascript';
import type { Gender } from '../types';
import { STEMS, BRANCHES, getXunKongByGanZhi } from '../calendar/pillars';
import { applyTrueSolarTime } from './solar-time';
import { findCity } from './cities';

export type WuXing = '木' | '火' | '土' | '金' | '水';
export type CalendarType = 'solar' | 'lunar';

export interface HiddenStem {
	stem: string;
	shiShen: string;
	element: WuXing;
}

export interface PillarDetail {
	stem: string;
	branch: string;
	label: string;
	stemElement: WuXing;
	branchElement: WuXing;
	mainStar: string;
	hidden: HiddenStem[];
	nayin: string;
	xunkong: string;
	changsheng: string;
	shensha: string[];
}

export interface LiuYueItem {
	/** 1-12 寅月起 */
	index: number;
	label: string;
	shiShen: string;
}

export interface LiuNianItem {
	year: number;
	age: number;
	label: string;
	shiShen: string;
	liuYue: LiuYueItem[];
}

export interface DayunItem {
	label: string;
	stem: string;
	branch: string;
	shiShen: string;
	startAge: number;
	startYear: number;
	endYear: number;
	liuNian: LiuNianItem[];
}

export interface BaziInput {
	gender: Gender;
	calendar: CalendarType;
	/** 年 */
	year: number;
	/** 月 1-12；农历闰月传负值如 -4 */
	month: number;
	day: number;
	hour: number;
	minute: number;
	/** 出生地城市名 */
	cityName?: string;
	/** 是否用真太阳时 */
	useTrueSolar?: boolean;
}

export interface BaziProfessionalChart {
	gender: Gender;
	calendar: CalendarType;
	birthTime: string;
	solarText: string;
	lunarText: string;
	cityName: string;
	trueSolarText: string;
	trueSolarDetail: string;
	year: PillarDetail;
	month: PillarDetail;
	day: PillarDetail;
	hour: PillarDetail;
	dayMaster: string;
	dayMasterElement: WuXing;
	wuxing: Record<WuXing, number>;
	wuxingText: string;
	taiyuan: string;
	minggong: string;
	shengong: string;
	qiyunText: string;
	dayun: DayunItem[];
	summary: string;
	chartText: string;
}

const STEM_WX: Record<string, WuXing> = {
	甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土',
	己: '土', 庚: '金', 辛: '金', 壬: '水', 癸: '水',
};

const BRANCH_WX: Record<string, WuXing> = {
	子: '水', 丑: '土', 寅: '木', 卯: '木', 辰: '土', 巳: '火',
	午: '火', 未: '土', 申: '金', 酉: '金', 戌: '土', 亥: '水',
};

/** 天干或地支单字取五行；非干支返回 null */
export function wuxingOfChar(ch: string): WuXing | null {
	return STEM_WX[ch] ?? BRANCH_WX[ch] ?? null;
}

const YANG_STEMS = new Set(['甲', '丙', '戊', '庚', '壬']);
const SHENG: Record<WuXing, WuXing> = {
	木: '火', 火: '土', 土: '金', 金: '水', 水: '木',
};
const KE: Record<WuXing, WuXing> = {
	木: '土', 土: '水', 水: '火', 火: '金', 金: '木',
};

export function getShiShen(dayMaster: string, other: string): string {
	if (!other) return '';
	if (dayMaster === other) return '比肩';
	const me = STEM_WX[dayMaster];
	const ot = STEM_WX[other];
	if (!me || !ot) return '';
	const samePolarity = YANG_STEMS.has(dayMaster) === YANG_STEMS.has(other);
	if (me === ot) return samePolarity ? '比肩' : '劫财';
	if (SHENG[me] === ot) return samePolarity ? '食神' : '伤官';
	if (KE[me] === ot) return samePolarity ? '偏财' : '正财';
	if (KE[ot] === me) return samePolarity ? '七杀' : '正官';
	if (SHENG[ot] === me) return samePolarity ? '偏印' : '正印';
	return '';
}

function wxFromPair(wuxingStr: string): { stem: WuXing; branch: WuXing } {
	// e.g. "金火" or "火土"
	const a = (wuxingStr[0] as WuXing) || '土';
	const b = (wuxingStr[1] as WuXing) || a;
	return { stem: a, branch: b };
}

function getShenSha(
	dayStem: string,
	dayBranch: string,
	branch: string,
): string[] {
	const list: string[] = [];
	const tianyi: Record<string, string[]> = {
		甲: ['丑', '未'], 戊: ['丑', '未'],
		乙: ['子', '申'], 己: ['子', '申'],
		丙: ['亥', '酉'], 丁: ['亥', '酉'],
		庚: ['丑', '未'], 辛: ['寅', '午'],
		壬: ['卯', '巳'], 癸: ['卯', '巳'],
	};
	if (tianyi[dayStem]?.includes(branch)) list.push('天乙');
	const wenchang: Record<string, string> = {
		甲: '巳', 乙: '午', 丙: '申', 丁: '酉', 戊: '申',
		己: '酉', 庚: '亥', 辛: '子', 壬: '寅', 癸: '卯',
	};
	if (wenchang[dayStem] === branch) list.push('文昌');
	const yima: Record<string, string> = {
		寅: '申', 午: '申', 戌: '申', 申: '寅', 子: '寅', 辰: '寅',
		巳: '亥', 酉: '亥', 丑: '亥', 亥: '巳', 卯: '巳', 未: '巳',
	};
	if (yima[dayBranch] === branch) list.push('驿马');
	const taohua: Record<string, string> = {
		寅: '卯', 午: '卯', 戌: '卯', 申: '酉', 子: '酉', 辰: '酉',
		巳: '午', 酉: '午', 丑: '午', 亥: '子', 卯: '子', 未: '子',
	};
	if (taohua[dayBranch] === branch) list.push('桃花');
	const huagai: Record<string, string> = {
		寅: '戌', 午: '戌', 戌: '戌', 申: '辰', 子: '辰', 辰: '辰',
		巳: '丑', 酉: '丑', 丑: '丑', 亥: '未', 卯: '未', 未: '未',
	};
	if (huagai[dayBranch] === branch) list.push('华盖');
	const yangren: Record<string, string> = {
		甲: '卯', 丙: '午', 戊: '午', 庚: '酉', 壬: '子',
	};
	if (yangren[dayStem] === branch) list.push('羊刃');
	return list;
}

function splitGanZhi(gz: string): { stem: string; branch: string } {
	return { stem: gz[0] ?? '', branch: gz[1] ?? '' };
}

function buildPillarFromEightChar(
	label: string,
	stem: string,
	branch: string,
	mainStar: string,
	hideGan: string[],
	hideShen: string[],
	nayin: string,
	dishi: string,
	xunkong: string,
	wuxingStr: string,
	dayStem: string,
	dayBranch: string,
): PillarDetail {
	const { stem: se, branch: be } = wxFromPair(wuxingStr);
	const hidden: HiddenStem[] = hideGan.map((s, i) => ({
		stem: s,
		shiShen: hideShen[i] ?? getShiShen(dayStem, s),
		element: STEM_WX[s] ?? '土',
	}));
	return {
		stem,
		branch,
		label,
		stemElement: STEM_WX[stem] ?? se,
		branchElement: BRANCH_WX[branch] ?? be,
		mainStar,
		hidden,
		nayin,
		xunkong: xunkong || getXunKongByGanZhi(stem, branch),
		changsheng: dishi,
		shensha: getShenSha(dayStem, dayBranch, branch),
	};
}

function countWuxing(pillars: PillarDetail[]): Record<WuXing, number> {
	const c: Record<WuXing, number> = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 };
	for (const p of pillars) {
		c[p.stemElement] += 1;
		c[p.branchElement] += 1;
		for (const h of p.hidden) c[h.element] += 0.5;
	}
	return c;
}

function resolveBirthDate(input: BaziInput): {
	clock: Date;
	solar: InstanceType<typeof Solar>;
	lunar: InstanceType<typeof Lunar>;
} {
	let solar: InstanceType<typeof Solar>;
	if (input.calendar === 'lunar') {
		const lunar = Lunar.fromYmdHms(
			input.year,
			input.month,
			input.day,
			input.hour,
			input.minute,
			0,
		);
		solar = lunar.getSolar();
	} else {
		solar = Solar.fromYmdHms(
			input.year,
			input.month,
			input.day,
			input.hour,
			input.minute,
			0,
		);
	}

	const clock = new Date(
		solar.getYear(),
		solar.getMonth() - 1,
		solar.getDay(),
		solar.getHour(),
		solar.getMinute(),
		0,
	);

	return { clock, solar, lunar: solar.getLunar() };
}

export function calculateBazi(input: BaziInput): BaziProfessionalChart {
	const city = findCity(input.cityName ?? '未知/不校正');
	const { clock, solar: clockSolar } = resolveBirthDate(input);

	let usedSolar = clockSolar;
	let trueSolarText = '';
	let trueSolarDetail = '未启用真太阳时（按北京时间）';

	if (input.useTrueSolar && city.name !== '未知/不校正') {
		const { trueSolar, detail } = applyTrueSolarTime(clock, city.longitude);
		usedSolar = Solar.fromYmdHms(
			trueSolar.getFullYear(),
			trueSolar.getMonth() + 1,
			trueSolar.getDate(),
			trueSolar.getHours(),
			trueSolar.getMinutes(),
			trueSolar.getSeconds(),
		);
		const pad = (n: number) => String(n).padStart(2, '0');
		trueSolarText = `${trueSolar.getFullYear()}/${pad(trueSolar.getMonth() + 1)}/${pad(trueSolar.getDate())} ${pad(trueSolar.getHours())}:${pad(trueSolar.getMinutes())}`;
		trueSolarDetail = `${city.name}（东经${city.longitude}°） ${detail}`;
	}

	const lunar = usedSolar.getLunar();
	const ec = lunar.getEightChar();
	const dayStem = ec.getDayGan() as string;
	const dayBranch = ec.getDayZhi() as string;
	const dayMasterElement = STEM_WX[dayStem] ?? '土';

	const y = buildPillarFromEightChar(
		ec.getYear(),
		ec.getYearGan(),
		ec.getYearZhi(),
		ec.getYearShiShenGan(),
		ec.getYearHideGan(),
		ec.getYearShiShenZhi(),
		ec.getYearNaYin(),
		ec.getYearDiShi(),
		ec.getYearXunKong(),
		ec.getYearWuXing(),
		dayStem,
		dayBranch,
	);
	const m = buildPillarFromEightChar(
		ec.getMonth(),
		ec.getMonthGan(),
		ec.getMonthZhi(),
		ec.getMonthShiShenGan(),
		ec.getMonthHideGan(),
		ec.getMonthShiShenZhi(),
		ec.getMonthNaYin(),
		ec.getMonthDiShi(),
		ec.getMonthXunKong(),
		ec.getMonthWuXing(),
		dayStem,
		dayBranch,
	);
	const d = buildPillarFromEightChar(
		ec.getDay(),
		ec.getDayGan(),
		ec.getDayZhi(),
		ec.getDayShiShenGan(),
		ec.getDayHideGan(),
		ec.getDayShiShenZhi(),
		ec.getDayNaYin(),
		ec.getDayDiShi(),
		ec.getDayXunKong(),
		ec.getDayWuXing(),
		dayStem,
		dayBranch,
	);
	const h = buildPillarFromEightChar(
		ec.getTime(),
		ec.getTimeGan(),
		ec.getTimeZhi(),
		ec.getTimeShiShenGan(),
		ec.getTimeHideGan(),
		ec.getTimeShiShenZhi(),
		ec.getTimeNaYin(),
		ec.getTimeDiShi(),
		ec.getTimeXunKong(),
		ec.getTimeWuXing(),
		dayStem,
		dayBranch,
	);

	const genderCode = input.gender === 'male' ? 1 : 0;
	const yun = ec.getYun(genderCode);
	const qiyunText = `起运 ${yun.getStartYear()}年${yun.getStartMonth()}个月${yun.getStartDay()}天 · 交运约 ${yun.getStartYear()} 岁起`;

	const daYunList = yun.getDaYun() as Array<{
		getGanZhi: () => string;
		getStartYear: () => number;
		getEndYear: () => number;
		getStartAge: () => number;
		getLiuNian: () => Array<{
			getGanZhi: () => string;
			getYear: () => number;
			getAge: () => number;
			getLiuYue: () => Array<{ getGanZhi: () => string }>;
		}>;
	}>;

	const dayun: DayunItem[] = [];
	for (let i = 0; i < daYunList.length; i++) {
		const du = daYunList[i]!;
		const gz = du.getGanZhi();
		if (!gz || gz.length < 2) continue;
		// 第 0 步常为起运前，仍保留有干支的大运
		const { stem, branch } = splitGanZhi(gz);
		const liuNianRaw = du.getLiuNian() ?? [];
		const liuNian: LiuNianItem[] = liuNianRaw.map((ln) => {
			const lngz = ln.getGanZhi();
			const { stem: lns } = splitGanZhi(lngz);
			const liuYue = (ln.getLiuYue() ?? []).map((ly, idx) => {
				const lygz = ly.getGanZhi();
				const { stem: lys } = splitGanZhi(lygz);
				return {
					index: idx + 1,
					label: lygz,
					shiShen: getShiShen(dayStem, lys),
				};
			});
			return {
				year: ln.getYear(),
				age: ln.getAge(),
				label: lngz,
				shiShen: getShiShen(dayStem, lns),
				liuYue,
			};
		});

		dayun.push({
			label: gz,
			stem,
			branch,
			shiShen: getShiShen(dayStem, stem),
			startAge: du.getStartAge(),
			startYear: du.getStartYear(),
			endYear: du.getEndYear(),
			liuNian,
		});
	}

	const wuxing = countWuxing([y, m, d, h]);
	const wuxingText = (['木', '火', '土', '金', '水'] as WuXing[])
		.map((el) => `${el}${wuxing[el].toFixed(1).replace(/\.0$/, '')}`)
		.join(' ');

	const pad = (n: number) => String(n).padStart(2, '0');
	const solarText = `${usedSolar.getYear()}/${pad(usedSolar.getMonth())}/${pad(usedSolar.getDay())} ${pad(usedSolar.getHour())}:${pad(usedSolar.getMinute())}`;
	const lunarText = lunar.toString();
	const birthTime = solarText.replace(/\//g, '-');

	const taiyuan = ec.getTaiYuan();
	const minggong = ec.getMingGong();
	const shengong = ec.getShenGong();

	const summary = [
		`性别：${input.gender === 'male' ? '男' : '女'}`,
		`历法：${input.calendar === 'lunar' ? '农历' : '公历'}`,
		`公历：${solarText}`,
		`农历：${lunarText}`,
		`出生地：${city.name}`,
		trueSolarText ? `真太阳时：${trueSolarText}（${trueSolarDetail}）` : trueSolarDetail,
		`四柱：${y.label} ${m.label} ${d.label} ${h.label}`,
		`日主：${dayStem}${dayMasterElement}`,
		`五行：${wuxingText}`,
		`起运：${qiyunText}`,
	].join('\n');

	const chartText = formatProfessionalChart({
		gender: input.gender,
		solarText,
		lunarText,
		cityName: city.name,
		trueSolarText,
		trueSolarDetail,
		y,
		m,
		d,
		h,
		dayMaster: dayStem,
		dayMasterElement,
		wuxingText,
		taiyuan,
		minggong,
		shengong,
		qiyunText,
		dayun,
	});

	return {
		gender: input.gender,
		calendar: input.calendar,
		birthTime,
		solarText,
		lunarText,
		cityName: city.name,
		trueSolarText,
		trueSolarDetail,
		year: y,
		month: m,
		day: d,
		hour: h,
		dayMaster: dayStem,
		dayMasterElement,
		wuxing,
		wuxingText,
		taiyuan,
		minggong,
		shengong,
		qiyunText,
		dayun,
		summary,
		chartText,
	};
}

function formatProfessionalChart(p: {
	gender: Gender;
	solarText: string;
	lunarText: string;
	cityName: string;
	trueSolarText: string;
	trueSolarDetail: string;
	y: PillarDetail;
	m: PillarDetail;
	d: PillarDetail;
	h: PillarDetail;
	dayMaster: string;
	dayMasterElement: WuXing;
	wuxingText: string;
	taiyuan: string;
	minggong: string;
	shengong: string;
	qiyunText: string;
	dayun: DayunItem[];
}): string {
	const cols = [p.y, p.m, p.d, p.h];
	const labels = ['年柱', '月柱', '日柱', '时柱'];
	const row = (name: string, cells: string[]) =>
		`${name.padEnd(4, '　')}${cells.map((c) => c.padEnd(8, '　')).join('')}`;

	const lines = [
		`【基本信息】`,
		`性别：${p.gender === 'male' ? '男' : '女'}　出生地：${p.cityName}`,
		`公历：${p.solarText}`,
		`农历：${p.lunarText}`,
		p.trueSolarText
			? `真太阳时：${p.trueSolarText}（${p.trueSolarDetail}）`
			: p.trueSolarDetail,
		`日主：${p.dayMaster}${p.dayMasterElement}　五行：${p.wuxingText}`,
		`胎元：${p.taiyuan}　命宫：${p.minggong}　身宫：${p.shengong}`,
		`起运：${p.qiyunText}`,
		``,
		`【基本命盘】`,
		row('　', labels),
		row('主星', cols.map((c) => c.mainStar)),
		row('天干', cols.map((c) => `${c.stem}${c.stemElement}`)),
		row('地支', cols.map((c) => `${c.branch}${c.branchElement}`)),
		row(
			'藏干',
			cols.map((c) =>
				c.hidden.map((h) => `${h.stem}${h.shiShen}`).join(''),
			),
		),
		row('纳音', cols.map((c) => c.nayin)),
		row('星运', cols.map((c) => c.changsheng)),
		row('空亡', cols.map((c) => c.xunkong)),
		row('神煞', cols.map((c) => c.shensha.join('') || '—')),
		``,
		`【专业细盘 · 大运】`,
		...p.dayun.map(
			(du) =>
				`${du.startAge}岁 ${du.startYear}-${du.endYear}　${du.label}（${du.shiShen}）`,
		),
	];

	// 全量大运的流年、流月（含十神）
	for (const du of p.dayun) {
		if (!du.liuNian.length) continue;
		lines.push(
			``,
			`【流年 · ${du.label}运 ${du.startYear}-${du.endYear}】`,
		);
		for (const ln of du.liuNian) {
			lines.push(
				`${ln.year}年 ${ln.age}岁 ${ln.label}（${ln.shiShen}）`,
			);
			if (ln.liuYue.length) {
				lines.push(
					`　流月：${ln.liuYue.map((ly) => `${ly.label}(${ly.shiShen})`).join(' ')}`,
				);
			}
		}
	}

	return lines.join('\n');
}

/** 由命盘对象即时生成排盘全文（含全部流年流月），供复制与入库文本。 */
export function formatBaziChartText(chart: BaziProfessionalChart): string {
	return formatProfessionalChart({
		gender: chart.gender,
		solarText: chart.solarText,
		lunarText: chart.lunarText,
		cityName: chart.cityName,
		trueSolarText: chart.trueSolarText,
		trueSolarDetail: chart.trueSolarDetail,
		y: chart.year,
		m: chart.month,
		d: chart.day,
		h: chart.hour,
		dayMaster: chart.dayMaster,
		dayMasterElement: chart.dayMasterElement,
		wuxingText: chart.wuxingText,
		taiyuan: chart.taiyuan,
		minggong: chart.minggong,
		shengong: chart.shengong,
		qiyunText: chart.qiyunText,
		dayun: chart.dayun,
	});
}

export function formatBaziForAi(
	chart: BaziProfessionalChart,
	question?: string,
	selectedDayunIndex?: number,
): string {
	const lines = [formatBaziChartText(chart)];
	if (
		selectedDayunIndex != null &&
		chart.dayun[selectedDayunIndex]
	) {
		const du = chart.dayun[selectedDayunIndex]!;
		lines.push(
			``,
			`【当前选中大运】${du.label}（${du.startYear}-${du.endYear}）`,
		);
	}
	if (question?.trim()) {
		lines.push(``, `重点关注：${question.trim()}`);
	}
	return lines.join('\n');
}

export type BaziChart = BaziProfessionalChart;
export { STEMS, BRANCHES };
