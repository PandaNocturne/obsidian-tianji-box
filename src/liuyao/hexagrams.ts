import type { HexagramInfo } from '../types';

/** 文王序 64 卦：binary 自下而上，1=阳 0=阴 */
const HEXAGRAM_DATA: Array<Omit<HexagramInfo, 'binary'> & { binary: string }> = [
	{ index: 1, name: '乾', alias: '乾为天', binary: '111111', nature: '刚健中正' },
	{ index: 2, name: '坤', alias: '坤为地', binary: '000000', nature: '厚德载物' },
	{ index: 3, name: '屯', alias: '水雷屯', binary: '100010', nature: '始生艰难' },
	{ index: 4, name: '蒙', alias: '山水蒙', binary: '010001', nature: '启蒙求学' },
	{ index: 5, name: '需', alias: '水天需', binary: '111010', nature: '待时而进' },
	{ index: 6, name: '讼', alias: '天水讼', binary: '010111', nature: '争讼宜止' },
	{ index: 7, name: '师', alias: '地水师', binary: '010000', nature: '众志成城' },
	{ index: 8, name: '比', alias: '水地比', binary: '000010', nature: '亲比辅佐' },
	{ index: 9, name: '小畜', alias: '风天小畜', binary: '111011', nature: '积小成大' },
	{ index: 10, name: '履', alias: '天泽履', binary: '110111', nature: '履礼而行' },
	{ index: 11, name: '泰', alias: '地天泰', binary: '111000', nature: '通泰安和' },
	{ index: 12, name: '否', alias: '天地否', binary: '000111', nature: '闭塞不通' },
	{ index: 13, name: '同人', alias: '天火同人', binary: '101111', nature: '和同于人' },
	{ index: 14, name: '大有', alias: '火天大有', binary: '111101', nature: '大有所获' },
	{ index: 15, name: '谦', alias: '地山谦', binary: '001000', nature: '谦恭受益' },
	{ index: 16, name: '豫', alias: '雷地豫', binary: '000100', nature: '和乐顺动' },
	{ index: 17, name: '随', alias: '泽雷随', binary: '100110', nature: '随时而动' },
	{ index: 18, name: '蛊', alias: '山风蛊', binary: '011001', nature: '整治革新' },
	{ index: 19, name: '临', alias: '地泽临', binary: '110000', nature: '临民以德' },
	{ index: 20, name: '观', alias: '风地观', binary: '000011', nature: '观摩省察' },
	{ index: 21, name: '噬嗑', alias: '火雷噬嗑', binary: '100101', nature: '咬合决断' },
	{ index: 22, name: '贲', alias: '山火贲', binary: '101001', nature: '文饰之美' },
	{ index: 23, name: '剥', alias: '山地剥', binary: '000001', nature: '剥落消蚀' },
	{ index: 24, name: '复', alias: '地雷复', binary: '100000', nature: '阴极生阳' },
	{ index: 25, name: '无妄', alias: '天雷无妄', binary: '100111', nature: '无妄而动' },
	{ index: 26, name: '大畜', alias: '山天大畜', binary: '111001', nature: '积蓄厚德' },
	{ index: 27, name: '颐', alias: '山雷颐', binary: '100001', nature: '颐养自守' },
	{ index: 28, name: '大过', alias: '泽风大过', binary: '011110', nature: '过刚宜慎' },
	{ index: 29, name: '坎', alias: '坎为水', binary: '010010', nature: '险陷重重' },
	{ index: 30, name: '离', alias: '离为火', binary: '101101', nature: '光明附丽' },
	{ index: 31, name: '咸', alias: '泽山咸', binary: '001110', nature: '感应相通' },
	{ index: 32, name: '恒', alias: '雷风恒', binary: '011100', nature: '恒久有常' },
	{ index: 33, name: '遁', alias: '天山遁', binary: '001111', nature: '退避保全' },
	{ index: 34, name: '大壮', alias: '雷天大壮', binary: '111100', nature: '壮盛宜节' },
	{ index: 35, name: '晋', alias: '火地晋', binary: '000101', nature: '晋升光明' },
	{ index: 36, name: '明夷', alias: '地火明夷', binary: '101000', nature: '光明受损' },
	{ index: 37, name: '家人', alias: '风火家人', binary: '101011', nature: '家庭和睦' },
	{ index: 38, name: '睽', alias: '火泽睽', binary: '110101', nature: '背离乖异' },
	{ index: 39, name: '蹇', alias: '水山蹇', binary: '001010', nature: '艰难险阻' },
	{ index: 40, name: '解', alias: '雷水解', binary: '010100', nature: '舒解困难' },
	{ index: 41, name: '损', alias: '山泽损', binary: '110001', nature: '损益得宜' },
	{ index: 42, name: '益', alias: '风雷益', binary: '100011', nature: '增益进取' },
	{ index: 43, name: '夬', alias: '泽天夬', binary: '111110', nature: '决断果行' },
	{ index: 44, name: '姤', alias: '天风姤', binary: '011111', nature: '邂逅相遇' },
	{ index: 45, name: '萃', alias: '泽地萃', binary: '000110', nature: '荟萃聚合' },
	{ index: 46, name: '升', alias: '地风升', binary: '011000', nature: '上升进展' },
	{ index: 47, name: '困', alias: '泽水困', binary: '010110', nature: '困顿守正' },
	{ index: 48, name: '井', alias: '水风井', binary: '011010', nature: '井养不穷' },
	{ index: 49, name: '革', alias: '泽火革', binary: '101110', nature: '变革更新' },
	{ index: 50, name: '鼎', alias: '火风鼎', binary: '011101', nature: '鼎新立业' },
	{ index: 51, name: '震', alias: '震为雷', binary: '100100', nature: '震动奋发' },
	{ index: 52, name: '艮', alias: '艮为山', binary: '001001', nature: '止静安守' },
	{ index: 53, name: '渐', alias: '风山渐', binary: '001011', nature: '循序渐进' },
	{ index: 54, name: '归妹', alias: '雷泽归妹', binary: '110100', nature: '归妹姻缘' },
	{ index: 55, name: '丰', alias: '雷火丰', binary: '101100', nature: '丰盛光明' },
	{ index: 56, name: '旅', alias: '火山旅', binary: '001101', nature: '羁旅漂泊' },
	{ index: 57, name: '巽', alias: '巽为风', binary: '011011', nature: '巽顺入微' },
	{ index: 58, name: '兑', alias: '兑为泽', binary: '110110', nature: '喜悦沟通' },
	{ index: 59, name: '涣', alias: '风水涣', binary: '010011', nature: '涣散重聚' },
	{ index: 60, name: '节', alias: '水泽节', binary: '110010', nature: '节制有度' },
	{ index: 61, name: '中孚', alias: '风泽中孚', binary: '110011', nature: '诚信感通' },
	{ index: 62, name: '小过', alias: '雷山小过', binary: '001100', nature: '小有过越' },
	{ index: 63, name: '既济', alias: '水火既济', binary: '101010', nature: '事已既成' },
	{ index: 64, name: '未济', alias: '火水未济', binary: '010101', nature: '事尚未成' },
];

const byBinary = new Map<string, HexagramInfo>();
for (const h of HEXAGRAM_DATA) {
	byBinary.set(h.binary, h);
}

export function getHexagramByBinary(binary: string): HexagramInfo {
	const found = byBinary.get(binary);
	if (!found) {
		return {
			index: 0,
			name: '未知',
			alias: '未知卦',
			binary,
			nature: '',
		};
	}
	return found;
}

export function linesToBinary(yangFlags: boolean[]): string {
	return yangFlags.map((y) => (y ? '1' : '0')).join('');
}

export const YAO_LABELS: Record<
	number,
	{ name: string; symbol: string; yang: boolean; changing: boolean }
> = {
	/** 动阴 → 变少阳 */
	6: { name: '老阴', symbol: '▅▅　▅▅✕', yang: false, changing: true },
	/** 静阳 */
	7: { name: '少阳', symbol: '▅▅▅▅▅', yang: true, changing: false },
	/** 静阴 */
	8: { name: '少阴', symbol: '▅▅　▅▅', yang: false, changing: false },
	/** 动阳 → 变少阴 */
	9: { name: '老阳', symbol: '▅▅▅▅▅○', yang: true, changing: true },
};

export const YAO_POSITION_NAMES = ['初爻', '二爻', '三爻', '四爻', '五爻', '上爻'];

export function getAllHexagrams(): HexagramInfo[] {
	return [...HEXAGRAM_DATA];
}
