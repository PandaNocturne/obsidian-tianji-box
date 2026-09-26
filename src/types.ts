export type DivinationType = 'liuyao' | 'bazi' | 'tarot';

export type Gender = 'male' | 'female';

export type LiuyaoMethod = 'auto' | 'coin' | 'manual';

/** 爻值：6老阴 7少阳 8少阴 9老阳 */
export type YaoValue = 6 | 7 | 8 | 9;

/** 打开位置：右侧边栏 / 左侧边栏 / 主区标签页 */
export type OpenLocation = 'sidebar-right' | 'sidebar-left' | 'tab';

/** 卦例库布局 */
export type LibraryLayout = 'table' | 'cards';

/** 插件设置（排盘与存档不依赖外部服务） */
export interface TianjiSettings {
	/** 新建视图时的打开位置，默认右侧边栏 */
	openLocation: OpenLocation;
	/** 卦例库 / 命理库 / 牌阵库列表布局 */
	libraryLayout: LibraryLayout;
}

export interface HexagramInfo {
	/** 1-64 文王序 */
	index: number;
	name: string;
	alias: string;
	/** 自下而上六爻，1=阳 0=阴 */
	binary: string;
	nature: string;
}

export interface LiuyaoYaoRow {
	/** 1-6 初到上 */
	pos: number;
	posName: string;
	value: YaoValue;
	liuShen: string;
	benText: string;
	bianText: string;
	isShi: boolean;
	isYing: boolean;
	isMoving: boolean;
	yaoSymbol: string;
	moveSymbol: string;
}

export interface LiuyaoResult {
	lines: YaoValue[];
	method: LiuyaoMethod;
	subject: string;
	gender: Gender;
	question: string;
	castTime: string;
	solarText: string;
	ganZhiText: string;
	original: HexagramInfo;
	changed: HexagramInfo | null;
	movingPositions: number[];
	shi: number;
	ying: number;
	yaoRows: LiuyaoYaoRow[];
	/** 可复制的标准排盘文本 */
	chartText: string;
}

export interface BaziPillar {
	stem: string;
	branch: string;
	label: string;
}

/** 完整类型见 bazi/pillars.ts；此处保留兼容字段 */
export interface BaziChart {
	gender: Gender;
	birthTime: string;
	year: BaziPillar;
	month: BaziPillar;
	day: BaziPillar;
	hour: BaziPillar;
	dayMaster: string;
	summary: string;
	chartText?: string;
}

export interface ReadingRecord {
	id: number;
	type: DivinationType;
	title: string;
	inputJson: string;
	resultJson: string;
	aiResponse: string;
	aiThinking: string;
	/** Markdown 笔记 / 注释 */
	noteMd: string;
	isFavorite: boolean;
	createdAt: string;
}
