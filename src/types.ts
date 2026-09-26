export type DivinationType = 'liuyao' | 'bazi' | 'tarot';

export type Gender = 'male' | 'female';

export type LiuyaoMethod = 'auto' | 'coin' | 'manual';

/** 爻值：6老阴 7少阳 8少阴 9老阳 */
export type YaoValue = 6 | 7 | 8 | 9;

/** 打开位置：右侧边栏 / 左侧边栏 / 主区标签页 */
export type OpenLocation = 'sidebar-right' | 'sidebar-left' | 'tab';

/** 卦例库布局 */
export type LibraryLayout = 'table' | 'cards';

/** 笔记打开方式 */
export type NoteOpenMode = 'tab' | 'modal';

/** 笔记文件名模式：Moment 时间戳 / UID */
export type NoteFilenameMode = 'timestamp' | 'uid';

/** 占卜标签页：顺序即显示顺序，enabled 控制是否出现 */
export interface DivinationTabConfig {
	id: DivinationType;
	enabled: boolean;
}

/** 插件设置（排盘与存档不依赖外部服务） */
export interface TianjiSettings {
	/** 新建视图时的打开位置，默认右侧边栏 */
	openLocation: OpenLocation;
	/** 卦例库 / 命理库 / 牌阵库列表布局 */
	libraryLayout: LibraryLayout;
	/**
	 * 占卜模块启用与排序。
	 * 默认顺序：六爻 > 塔罗牌 > 八字。
	 */
	divinationTabs: DivinationTabConfig[];
	/** 上次打开的占卜标签；重载后优先恢复，无效则落到第一个已启用模块 */
	lastActiveTab: DivinationType | null;
	/** 笔记 Markdown 所在文件夹（库内相对路径） */
	noteFolder: string;
	/** 文件名模式：时间戳（Moment）或 UID */
	noteFilenameMode: NoteFilenameMode;
	/**
	 * 文件名模板（不含 .md）。
	 * 支持 Moment 语法与 {{uid}}；可用 / 创建嵌套目录。
	 * 例：YYYY/MM/DD-HHmmss、{{uid}}、YYYY/MM/{{uid}}
	 */
	noteFilenameTemplate: string;
	/** 新建笔记正文模板，默认为空；可用 {{title}} {{uid}} {{type}} {{date}} {{time}} */
	noteContentTemplate: string;
	/** frontmatter 中的 UID 字段名，用于查找笔记 */
	noteUidKey: string;
	/** 添加/打开笔记：标签页或弹窗 */
	noteOpenMode: NoteOpenMode;
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
	/**
	 * 旧版内联 Markdown（迁移前）。
	 * 新笔记以库内 .md 为准，通过 noteUid 关联。
	 */
	noteMd: string;
	/** 关联库内笔记的 UID（写入 frontmatter） */
	noteUid: string;
	isFavorite: boolean;
	createdAt: string;
}
