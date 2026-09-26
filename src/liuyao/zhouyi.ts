/**
 * 《周易》卦辞 / 彖 / 象 / 爻辞
 * 数据来源：freizl/yijing（MIT）zh-CN/64gua.json
 * https://github.com/freizl/yijing
 */
import raw from './zhouyi-64gua.json';

export interface ZhouyiText {
	/** 自下而上阴阳，与 HexagramInfo.binary 一致 */
	id: string;
	name: string;
	guaCi: string;
	tuanCi: string;
	daXiang: string;
	/** 初→上，乾坤另含用九/用六 */
	yaoCi: string[];
	xiaoXiang: string[];
	symbol: string;
}

interface RawGua {
	id: string;
	name: string;
	gua_ci: string;
	tuan_ci: string;
	da_xiang: string;
	yao_ci: string[];
	xiao_xiang: string[];
	symbol: string;
}

const BY_BINARY = new Map<string, ZhouyiText>();

for (const g of raw as RawGua[]) {
	BY_BINARY.set(g.id, {
		id: g.id,
		name: g.name,
		guaCi: g.gua_ci,
		tuanCi: g.tuan_ci,
		daXiang: g.da_xiang,
		yaoCi: g.yao_ci,
		xiaoXiang: g.xiao_xiang,
		symbol: g.symbol,
	});
}

export function getZhouyiByBinary(binary: string): ZhouyiText | null {
	return BY_BINARY.get(binary) ?? null;
}
