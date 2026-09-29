import type { Gender, HexagramInfo } from '../types';
import { getHexagramByBinary } from '../liuyao/hexagrams';
import { MEIHUA_METHOD_LABELS, type MeihuaCastCore } from './casting';
import {
	YAO_POS_NAMES,
	flipLineBinary,
	hexagramBinary,
	mutualBinary,
	resolveTiYong,
	tiYongRelation,
	type MeihuaTrigram,
	type TiYongRelation,
} from './trigrams';

export interface MeihuaResult {
	method: MeihuaCastCore['method'];
	methodLabel: string;
	subject: string;
	gender: Gender;
	question: string;
	castTime: string;
	solarText: string;
	lunarText: string;
	yearBranch: string;
	yearZhiNum: number;
	lunarMonth: number;
	lunarDay: number;
	hourBranch: string;
	hourZhiNum: number;
	upper: MeihuaTrigram;
	lower: MeihuaTrigram;
	movingLine: number;
	movingLineName: string;
	original: HexagramInfo;
	/** 互卦（本卦二三四 / 三四五） */
	mutual: HexagramInfo;
	changed: HexagramInfo;
	ti: MeihuaTrigram;
	yong: MeihuaTrigram;
	relation: TiYongRelation;
	movingInUpper: boolean;
	num1: number | null;
	num2: number | null;
	num3: number | null;
	chartText: string;
}

export function buildMeihuaResult(params: {
	cast: MeihuaCastCore;
	subject: string;
	gender: Gender;
	question: string;
}): MeihuaResult {
	const { cast, subject, gender, question } = params;
	const benBinary = hexagramBinary(cast.lower, cast.upper);
	const original = getHexagramByBinary(benBinary);
	const mutual = getHexagramByBinary(mutualBinary(benBinary));
	const bianBinary = flipLineBinary(benBinary, cast.movingLine);
	const changed = getHexagramByBinary(bianBinary);
	const { ti, yong, movingInUpper } = resolveTiYong(
		cast.movingLine,
		cast.upper,
		cast.lower,
	);
	const relation = tiYongRelation(ti.wuxing, yong.wuxing);
	const movingLineName =
		YAO_POS_NAMES[cast.movingLine - 1] ?? `第${cast.movingLine}爻`;

	const result: MeihuaResult = {
		method: cast.method,
		methodLabel: MEIHUA_METHOD_LABELS[cast.method],
		subject,
		gender,
		question,
		castTime: cast.castTime,
		solarText: cast.solarText,
		lunarText: cast.lunarText,
		yearBranch: cast.yearBranch,
		yearZhiNum: cast.yearZhiNum,
		lunarMonth: cast.lunarMonth,
		lunarDay: cast.lunarDay,
		hourBranch: cast.hourBranch,
		hourZhiNum: cast.hourZhiNum,
		upper: cast.upper,
		lower: cast.lower,
		movingLine: cast.movingLine,
		movingLineName,
		original,
		mutual,
		changed,
		ti,
		yong,
		relation,
		movingInUpper,
		num1: cast.num1,
		num2: cast.num2,
		num3: cast.num3,
		chartText: '',
	};
	result.chartText = formatMeihuaChartText(result);
	return result;
}

function guaLine(g: HexagramInfo): string {
	return `${g.alias || g.name}（第${g.index}卦）`;
}

function trigramLine(t: MeihuaTrigram, role?: string): string {
	const rolePart = role ? `${role}·` : '';
	return `${rolePart}${t.name}${t.nature}（${t.number}·${t.wuxing}）`;
}

export function formatMeihuaChartText(r: MeihuaResult): string {
	const genderLabel = r.gender === 'female' ? '女' : '男';
	const subjectPart = r.subject.trim() || '问事';
	const questionPart = r.question.trim();
	const header = questionPart
		? `${genderLabel}测: ${subjectPart}(${questionPart})`
		: `${genderLabel}测: ${subjectPart}`;

	const lines: string[] = [
		'【梅花易数排盘】',
		header,
		`起卦：${r.methodLabel}`,
		`公历：${r.solarText}`,
		`农历：${r.lunarText}`,
		`时辰：${r.hourBranch}时`,
	];

	if (r.method === 'time') {
		lines.push(
			`取数：年支${r.yearBranch}${r.yearZhiNum} + 月${r.lunarMonth} + 日${r.lunarDay} + 时${r.hourZhiNum}`,
		);
	}
	if (r.method === 'numbers') {
		lines.push(`报数：上${r.num1} / 下${r.num2}`);
	}
	if (r.method === 'three') {
		lines.push(`三数：上${r.num1} / 下${r.num2} / 动${r.num3}`);
	}

	lines.push(
		`上卦：${trigramLine(r.upper)}`,
		`下卦：${trigramLine(r.lower)}`,
		`动爻：${r.movingLineName}（第${r.movingLine}爻）`,
		`本卦：${guaLine(r.original)}`,
		`互卦：${guaLine(r.mutual)}`,
		`变卦：${guaLine(r.changed)}`,
		`体卦：${trigramLine(r.ti)}`,
		`用卦：${trigramLine(r.yong)}`,
		`体用：${r.relation}（体${r.ti.wuxing} · 用${r.yong.wuxing}）`,
	);

	return lines.join('\n');
}
