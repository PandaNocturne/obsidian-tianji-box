import type {
	Gender,
	LiuyaoMethod,
	LiuyaoResult,
	LiuyaoYaoRow,
	YaoValue,
} from '../types';
import {
	formatSolar,
	getFourPillars,
	getXunKongByGanZhi,
} from '../calendar/pillars';
import {
	YAO_LABELS,
	YAO_POSITION_NAMES,
	getHexagramByBinary,
	linesToBinary,
} from './hexagrams';
import {
	buildNajiaLines,
	getLiuShenByDayStem,
	getPalaceElement,
	getShiYing,
} from './najia';

/** 三枚铜钱：字=3（阳）背=2（阴），和为 6/7/8/9 */
export type CoinFace = 'yang' | 'yin';

export function throwThreeCoins(): YaoValue {
	return throwThreeCoinsDetailed().value;
}

export function throwThreeCoinsDetailed(): {
	value: YaoValue;
	faces: [CoinFace, CoinFace, CoinFace];
} {
	const faces: [CoinFace, CoinFace, CoinFace] = [
		Math.random() < 0.5 ? 'yin' : 'yang',
		Math.random() < 0.5 ? 'yin' : 'yang',
		Math.random() < 0.5 ? 'yin' : 'yang',
	];
	const sum =
		(faces[0] === 'yang' ? 3 : 2) +
		(faces[1] === 'yang' ? 3 : 2) +
		(faces[2] === 'yang' ? 3 : 2);
	return { value: sum as YaoValue, faces };
}

export function autoCastLines(): YaoValue[] {
	return Array.from({ length: 6 }, () => throwThreeCoins());
}

export function isYang(value: YaoValue): boolean {
	return YAO_LABELS[value]?.yang ?? false;
}

export function isChanging(value: YaoValue): boolean {
	return YAO_LABELS[value]?.changing ?? false;
}

export function changedLine(value: YaoValue): boolean {
	if (value === 6) return true;
	if (value === 9) return false;
	return isYang(value);
}

function yaoMark(value: YaoValue): string {
	return chartYaoBar(value);
}

function movingMark(value: YaoValue): string {
	return chartMoveMark(value);
}

export function buildLiuyaoResult(params: {
	lines: YaoValue[];
	method: LiuyaoMethod;
	subject: string;
	gender: Gender;
	question: string;
	castTime?: Date | string;
}): LiuyaoResult {
	const { lines, method, subject, gender, question } = params;
	if (lines.length !== 6) {
		throw new Error('六爻须有六爻');
	}

	const castDate =
		params.castTime instanceof Date
			? params.castTime
			: params.castTime
				? new Date(params.castTime)
				: new Date();

	const originalBinary = linesToBinary(lines.map(isYang));
	const original = getHexagramByBinary(originalBinary);

	const movingPositions: number[] = [];
	lines.forEach((v, i) => {
		if (isChanging(v)) movingPositions.push(i + 1);
	});

	let changed = null;
	let changedBinary: string | null = null;
	if (movingPositions.length > 0) {
		changedBinary = linesToBinary(lines.map(changedLine));
		changed = getHexagramByBinary(changedBinary);
	}

	const pillars = getFourPillars(castDate);
	const xunKong = getXunKongByGanZhi(pillars.day.stem, pillars.day.branch);
	const palaceEl = getPalaceElement(original.name);
	const { shi, ying } = getShiYing(original.name);
	const liuShen = getLiuShenByDayStem(pillars.day.stem);
	const benNajia = buildNajiaLines(originalBinary, palaceEl);
	const bianNajia = changedBinary
		? buildNajiaLines(changedBinary, palaceEl)
		: null;

	const yaoRows: LiuyaoYaoRow[] = lines.map((value, i) => {
		const ben = benNajia[i]!;
		const bian = bianNajia?.[i];
		const pos = i + 1;
		return {
			pos,
			posName: YAO_POSITION_NAMES[i]!,
			value,
			liuShen: liuShen[i]!,
			benText: ben.text,
			bianText: bian?.text ?? '',
			isShi: pos === shi,
			isYing: pos === ying,
			isMoving: isChanging(value),
			yaoSymbol: yaoMark(value),
			moveSymbol: movingMark(value),
		};
	});

	const ganZhiText = `${pillars.year.label}年 ${pillars.month.label}月 ${pillars.day.label}日 ${pillars.hour.label}时(旬空：${xunKong || '无'})`;
	const solarText = formatSolar(castDate);

	let titleLine: string;
	if (changed) {
		titleLine = `得         ${original.alias}之${changed.alias}`;
	} else {
		titleLine = `得         ${original.alias}`;
	}

	const genderLabel = gender === 'male' ? '男' : '女';
	const subjectPart = subject.trim() || '问事';
	const questionPart = question.trim();
	const header = questionPart
		? `${genderLabel}测: ${subjectPart}(${questionPart})`
		: `${genderLabel}测: ${subjectPart}`;

	const chartLines: string[] = [
		header,
		`公历：${solarText}`,
		`干支：${ganZhiText}`,
		titleLine,
	];

	const hasChanged = Boolean(changed);
	for (let i = 5; i >= 0; i--) {
		chartLines.push(formatChartYaoLine(yaoRows[i]!, hasChanged));
	}

	const chartText = chartLines.join('\n');

	return {
		lines,
		method,
		subject,
		gender,
		question,
		castTime: castDate.toISOString(),
		solarText,
		ganZhiText,
		original,
		changed,
		movingPositions,
		shi,
		ying,
		yaoRows,
		chartText,
	};
}

export function formatLiuyaoForAi(result: LiuyaoResult): string {
	return [
		result.chartText,
		``,
		`【补充】起卦方式：${methodLabel(result.method)}`,
		`本卦：第${result.original.index}卦 ${result.original.alias}——${result.original.nature}`,
		result.changed
			? `变卦：第${result.changed.index}卦 ${result.changed.alias}——${result.changed.nature}`
			: '变卦：无（静卦）',
	].join('\n');
}

function formatChartYaoLine(row: LiuyaoYaoRow, hasChanged: boolean): string {
	const bar = chartYaoBar(row.value);
	const move = chartMoveMark(row.value);
	const role = row.isShi ? '世' : row.isYing ? '应' : '';

	// 标记区：如「○  世」「应」；无则留白，保证变卦列大致对齐
	let marks = '';
	if (move && role) marks = `${move}  ${role}`;
	else if (move) marks = move;
	else if (role) marks = role;

	const parts = [
		padEndWidth(row.posName, 4),
		padEndWidth(row.liuShen, 4),
		// 纳甲与爻画紧挨：父母辛卯木一 / 子孙辛未土- -
		padEndWidth(row.benText + bar, 12),
		padEndWidth(marks, 6),
	];
	if (hasChanged) {
		parts.push(row.bianText || '');
	}
	return parts.join('　');
}

/** 排盘文本爻画：阳「一」阴「- -」 */
function chartYaoBar(value: YaoValue): string {
	return value === 7 || value === 9 ? '一' : '- -';
}

/** 动爻标记：老阳 ○、老阴 × */
function chartMoveMark(value: YaoValue): string {
	if (value === 9) return '○';
	if (value === 6) return '×';
	return '';
}

/** 显示宽度：CJK/全角≈2，其余≈1 */
function displayWidth(s: string): number {
	let w = 0;
	for (const ch of s) {
		const cp = ch.codePointAt(0) ?? 0;
		if (cp <= 0x1f) continue;
		w += isWideChar(cp) ? 2 : 1;
	}
	return w;
}

function isWideChar(cp: number): boolean {
	return (
		(cp >= 0x1100 && cp <= 0x115f) ||
		(cp >= 0x2e80 && cp <= 0xa4cf) ||
		(cp >= 0xac00 && cp <= 0xd7a3) ||
		(cp >= 0xf900 && cp <= 0xfaff) ||
		(cp >= 0xfe10 && cp <= 0xfe6f) ||
		(cp >= 0xff00 && cp <= 0xff60) ||
		(cp >= 0xffe0 && cp <= 0xffe6) ||
		(cp >= 0x20000 && cp <= 0x3fffd) ||
		cp === 0x2585 || // ▅
		cp === 0x25cb || // ○
		cp === 0x2715 // ✕
	);
}

function padEndWidth(s: string, width: number): string {
	const cur = displayWidth(s);
	if (cur >= width) return s;
	let out = s;
	let w = cur;
	while (w + 2 <= width) {
		out += '　';
		w += 2;
	}
	if (w < width) {
		out += ' ';
	}
	return out;
}

function methodLabel(method: LiuyaoMethod): string {
	switch (method) {
		case 'auto':
			return '天机起卦（一键排盘）';
		case 'coin':
			return '铜钱起卦';
		case 'manual':
			return '手动起卦';
	}
}

export function describeLine(value: YaoValue): string {
	const meta = YAO_LABELS[value];
	return meta ? `${meta.name} ${meta.symbol}` : String(value);
}
