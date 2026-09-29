/** 先天八卦序数：1乾 2兑 3离 4震 5巽 6坎 7艮 8坤 */

export type MeihuaWuXing = '金' | '木' | '水' | '火' | '土';

export type MeihuaTrigramId =
	| 'qian'
	| 'dui'
	| 'li'
	| 'zhen'
	| 'xun'
	| 'kan'
	| 'gen'
	| 'kun';

export interface MeihuaTrigram {
	id: MeihuaTrigramId;
	/** 1–8 */
	number: number;
	name: string;
	nature: string;
	wuxing: MeihuaWuXing;
	/** 自下而上三爻，1=阳 0=阴 */
	binary: string;
}

export type TiYongRole = 'ti' | 'yong';

/** 体用五行关系标签 */
export type TiYongRelation =
	| '比和'
	| '体生用'
	| '用生体'
	| '体克用'
	| '用克体';

export const MEIHUA_TRIGRAMS: MeihuaTrigram[] = [
	{ id: 'qian', number: 1, name: '乾', nature: '天', wuxing: '金', binary: '111' },
	{ id: 'dui', number: 2, name: '兑', nature: '泽', wuxing: '金', binary: '110' },
	{ id: 'li', number: 3, name: '离', nature: '火', wuxing: '火', binary: '101' },
	{ id: 'zhen', number: 4, name: '震', nature: '雷', wuxing: '木', binary: '100' },
	{ id: 'xun', number: 5, name: '巽', nature: '风', wuxing: '木', binary: '011' },
	{ id: 'kan', number: 6, name: '坎', nature: '水', wuxing: '水', binary: '010' },
	{ id: 'gen', number: 7, name: '艮', nature: '山', wuxing: '土', binary: '001' },
	{ id: 'kun', number: 8, name: '坤', nature: '地', wuxing: '土', binary: '000' },
];

const byNumber = new Map(MEIHUA_TRIGRAMS.map((t) => [t.number, t]));

/** 余数 1–8；0 → 8 */
export function mod8(n: number): number {
	const r = ((Math.trunc(n) % 8) + 8) % 8;
	return r === 0 ? 8 : r;
}

/** 余数 1–6；0 → 6 */
export function mod6(n: number): number {
	const r = ((Math.trunc(n) % 6) + 6) % 6;
	return r === 0 ? 6 : r;
}

export function trigramFromNumber(n: number): MeihuaTrigram {
	return byNumber.get(mod8(n))!;
}

/** 六爻 binary：下卦三爻 + 上卦三爻（自下而上） */
export function hexagramBinary(
	lower: MeihuaTrigram,
	upper: MeihuaTrigram,
): string {
	return lower.binary + upper.binary;
}

/**
 * 动爻在下卦（1–3）→ 下为用、上为体；
 * 动爻在上卦（4–6）→ 上为用、下为体。
 */
export function resolveTiYong(
	movingLine: number,
	upper: MeihuaTrigram,
	lower: MeihuaTrigram,
): { ti: MeihuaTrigram; yong: MeihuaTrigram; movingInUpper: boolean } {
	const movingInUpper = movingLine >= 4;
	if (movingInUpper) {
		return { ti: lower, yong: upper, movingInUpper: true };
	}
	return { ti: upper, yong: lower, movingInUpper: false };
}

const SHENG: Record<MeihuaWuXing, MeihuaWuXing> = {
	木: '火',
	火: '土',
	土: '金',
	金: '水',
	水: '木',
};

const KE: Record<MeihuaWuXing, MeihuaWuXing> = {
	木: '土',
	土: '水',
	水: '火',
	火: '金',
	金: '木',
};

export function tiYongRelation(
	ti: MeihuaWuXing,
	yong: MeihuaWuXing,
): TiYongRelation {
	if (ti === yong) return '比和';
	if (SHENG[ti] === yong) return '体生用';
	if (SHENG[yong] === ti) return '用生体';
	if (KE[ti] === yong) return '体克用';
	if (KE[yong] === ti) return '用克体';
	return '比和';
}

/** 翻转本卦某一爻（1=初 … 6=上）得变卦 binary */
export function flipLineBinary(binary: string, movingLine: number): string {
	const chars = binary.split('');
	const idx = movingLine - 1;
	if (idx < 0 || idx >= chars.length) return binary;
	chars[idx] = chars[idx] === '1' ? '0' : '1';
	return chars.join('');
}

/**
 * 互卦：取本卦二三四爻为下、三四五爻为上（binary 自下而上长度 6）。
 */
export function mutualBinary(binary: string): string {
	if (binary.length !== 6) return binary;
	const lower = binary.slice(1, 4);
	const upper = binary.slice(2, 5);
	return lower + upper;
}

export const YAO_POS_NAMES = ['初爻', '二爻', '三爻', '四爻', '五爻', '上爻'];
