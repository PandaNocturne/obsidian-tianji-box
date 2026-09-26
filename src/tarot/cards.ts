export type Arcana = 'major' | 'minor';
export type Suit = 'wands' | 'cups' | 'swords' | 'pentacles';

export interface TarotCardDef {
	id: string;
	name: string;
	nameEn: string;
	arcana: Arcana;
	suit?: Suit;
	/** 0-21 major；1-14 minor (1=Ace … 11=Page 12=Knight 13=Queen 14=King) */
	number: number;
	keywords: string[];
	upright: string;
	reversed: string;
}

const MAJOR: Array<Omit<TarotCardDef, 'arcana' | 'id'>> = [
	{ name: '愚者', nameEn: 'The Fool', number: 0, keywords: ['开始', '自由', '潜能'], upright: '新旅程、纯真、冒险', reversed: '鲁莽、停滞、逃避' },
	{ name: '魔术师', nameEn: 'The Magician', number: 1, keywords: ['意志', '创造', '技巧'], upright: '能力显现、专注行动', reversed: '操纵、分散、才华浪费' },
	{ name: '女祭司', nameEn: 'The High Priestess', number: 2, keywords: ['直觉', '神秘', '潜意识'], upright: '倾听内在、洞察隐情', reversed: '秘密压抑、忽视直觉' },
	{ name: '女皇', nameEn: 'The Empress', number: 3, keywords: ['丰盛', '滋养', '美感'], upright: '创造与收获、温柔力量', reversed: '依赖、创造力受阻' },
	{ name: '皇帝', nameEn: 'The Emperor', number: 4, keywords: ['秩序', '权威', '结构'], upright: '稳定领导、规则与责任', reversed: '僵化、控制欲过强' },
	{ name: '教皇', nameEn: 'The Hierophant', number: 5, keywords: ['传统', '指引', '信仰'], upright: '学习传统、寻求导师', reversed: '叛逆教条、另辟蹊径' },
	{ name: '恋人', nameEn: 'The Lovers', number: 6, keywords: ['选择', '结合', '价值'], upright: '重要抉择、和谐关系', reversed: '失衡、犹豫、价值观冲突' },
	{ name: '战车', nameEn: 'The Chariot', number: 7, keywords: ['意志', '胜利', '前进'], upright: '掌控方向、克服阻碍', reversed: '失控、方向摇摆' },
	{ name: '力量', nameEn: 'Strength', number: 8, keywords: ['勇气', '耐心', '柔韧'], upright: '内在力量、温和坚韧', reversed: '自我怀疑、蛮力' },
	{ name: '隐者', nameEn: 'The Hermit', number: 9, keywords: ['独处', '智慧', '寻路'], upright: '沉淀反思、寻求真理', reversed: '孤立、逃避社交' },
	{ name: '命运之轮', nameEn: 'Wheel of Fortune', number: 10, keywords: ['转折', '周期', '机遇'], upright: '运势转动、把握时机', reversed: '阻力、循环未破' },
	{ name: '正义', nameEn: 'Justice', number: 11, keywords: ['公平', '因果', '诚实'], upright: '公正裁决、承担责任', reversed: '偏见、逃避后果' },
	{ name: '倒吊人', nameEn: 'The Hanged Man', number: 12, keywords: ['牺牲', '换角', '等待'], upright: '换位思考、主动放下', reversed: '无谓拖延、抗拒改变' },
	{ name: '死神', nameEn: 'Death', number: 13, keywords: ['结束', '转化', '重生'], upright: '旧局结束、迎接新生', reversed: '抗拒结束、停滞不前' },
	{ name: '节制', nameEn: 'Temperance', number: 14, keywords: ['平衡', '调和', '耐心'], upright: '融合各方、循序渐进', reversed: '失衡、极端、急躁' },
	{ name: '恶魔', nameEn: 'The Devil', number: 15, keywords: ['欲望', '束缚', '执念'], upright: '觉察成瘾与依附', reversed: '松绑、重获自由' },
	{ name: '高塔', nameEn: 'The Tower', number: 16, keywords: ['突变', '崩塌', '觉醒'], upright: '旧结构崩解、真相冲击', reversed: '延宕危机、恐惧变化' },
	{ name: '星星', nameEn: 'The Star', number: 17, keywords: ['希望', '疗愈', '灵感'], upright: '信心恢复、愿景清晰', reversed: '失望、信心不足' },
	{ name: '月亮', nameEn: 'The Moon', number: 18, keywords: ['幻象', '不安', '潜意识'], upright: '情绪波动、探查隐忧', reversed: '拨云见日、焦虑减轻' },
	{ name: '太阳', nameEn: 'The Sun', number: 19, keywords: ['成功', '活力', '清晰'], upright: '光明顺利、喜悦滋长', reversed: '延迟兑现、短暂低落' },
	{ name: '审判', nameEn: 'Judgement', number: 20, keywords: ['觉醒', '召唤', '清算'], upright: '自我审视、回应召唤', reversed: '自我批判、拒绝反省' },
	{ name: '世界', nameEn: 'The World', number: 21, keywords: ['完成', '整合', '圆满'], upright: '阶段性圆满、整合收获', reversed: '未竟之事、差一点闭环' },
];

const SUIT_META: Record<
	Suit,
	{ name: string; nameEn: string; theme: string }
> = {
	wands: { name: '权杖', nameEn: 'Wands', theme: '行动、热情、事业动力' },
	cups: { name: '圣杯', nameEn: 'Cups', theme: '情感、关系、直觉' },
	swords: { name: '宝剑', nameEn: 'Swords', theme: '思维、冲突、决策' },
	pentacles: { name: '星币', nameEn: 'Pentacles', theme: '物质、现实、成果' },
};

const RANK_NAMES: Record<number, { name: string; nameEn: string }> = {
	1: { name: '王牌', nameEn: 'Ace' },
	2: { name: '二', nameEn: 'Two' },
	3: { name: '三', nameEn: 'Three' },
	4: { name: '四', nameEn: 'Four' },
	5: { name: '五', nameEn: 'Five' },
	6: { name: '六', nameEn: 'Six' },
	7: { name: '七', nameEn: 'Seven' },
	8: { name: '八', nameEn: 'Eight' },
	9: { name: '九', nameEn: 'Nine' },
	10: { name: '十', nameEn: 'Ten' },
	11: { name: '侍从', nameEn: 'Page' },
	12: { name: '骑士', nameEn: 'Knight' },
	13: { name: '王后', nameEn: 'Queen' },
	14: { name: '国王', nameEn: 'King' },
};

function buildMinor(): TarotCardDef[] {
	const suits = Object.keys(SUIT_META) as Suit[];
	const cards: TarotCardDef[] = [];
	for (const suit of suits) {
		const meta = SUIT_META[suit];
		for (let n = 1; n <= 14; n++) {
			const rank = RANK_NAMES[n]!;
			const name =
				n <= 10 && n > 1
					? `${meta.name}${rank.name}`
					: n === 1
						? `${meta.name}${rank.name}`
						: `${meta.name}${rank.name}`;
			cards.push({
				id: `${suit}-${n}`,
				name,
				nameEn: `${rank.nameEn} of ${meta.nameEn}`,
				arcana: 'minor',
				suit,
				number: n,
				keywords: [meta.theme.split('、')[0]!, rank.nameEn],
				upright: `${meta.theme}方向的正向展开（${rank.name}）`,
				reversed: `${meta.theme}方向受阻或过度（${rank.name}逆位）`,
			});
		}
	}
	return cards;
}

export const TAROT_DECK: TarotCardDef[] = [
	...MAJOR.map((m) => ({
		...m,
		id: `major-${m.number}`,
		arcana: 'major' as const,
	})),
	...buildMinor(),
];

export function getCardById(id: string): TarotCardDef | undefined {
	return TAROT_DECK.find((c) => c.id === id);
}

export { SUIT_META };
