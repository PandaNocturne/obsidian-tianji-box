/**
 * 校验小六壬教程用例（不依赖 TS 源码编译）
 * 用法：node scripts/verify-xiaoliuren.mjs
 */
import { Solar } from 'lunar-javascript';

const PALACES = ['大安', '留连', '速喜', '赤口', '小吉', '空亡'];
const DIZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const STARS = ['木星', '火星', '土星', '金星', '水星', '天空'];
const SPIRITS = ['青龙', '朱雀', '勾陈', '白虎', '玄武', '腾蛇'];
const WX = {
	子: '水', 丑: '土', 寅: '木', 卯: '木', 辰: '土', 巳: '火',
	午: '火', 未: '土', 申: '金', 酉: '金', 戌: '土', 亥: '水',
};

function palaceFromSteps(steps) {
	return PALACES[((steps - 1) % 6 + 6) % 6];
}
function fromStart(start, branchIdx) {
	return PALACES[(PALACES.indexOf(start) + branchIdx) % 6];
}
function hourBranchIndex(h) {
	if (h === 23 || h === 0) return 0;
	return Math.floor((h + 1) / 2);
}
function nextP(p) {
	return PALACES[(PALACES.indexOf(p) + 1) % 6];
}
function relation(me, other) {
	if (me === other) return '兄弟';
	const shengWo = { 木: '水', 火: '木', 土: '火', 金: '土', 水: '金' };
	const woSheng = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
	const keWo = { 木: '金', 火: '水', 土: '木', 金: '火', 水: '土' };
	const woKe = { 木: '土', 火: '金', 土: '水', 金: '木', 水: '火' };
	if (shengWo[me] === other) return '父母';
	if (woSheng[me] === other) return '子孙';
	if (keWo[me] === other) return '官鬼';
	if (woKe[me] === other) return '妻财';
	return '兄弟';
}
function qinglongStart(b) {
	if (b === '子' || b === '午') return '大安';
	if (b === '丑' || b === '未') return '留连';
	if (b === '寅' || b === '申') return '速喜';
	if (b === '卯' || b === '酉') return '赤口';
	if (b === '辰' || b === '戌') return '小吉';
	return '空亡';
}

let found = null;
for (const y of [2024, 2025, 2026]) {
	for (let m = 1; m <= 12 && !found; m++) {
		for (let d = 1; d <= 28 && !found; d++) {
			const lunar = Solar.fromYmd(y, m, d).getLunar();
			if (lunar.getDay() === 6) found = { y, m, d, text: lunar.toString(), day: lunar.getDay() };
		}
	}
}

const h = 19; // 戌
const dayPalace = palaceFromSteps(found.day);
const hIdx = hourBranchIndex(h);
const hourPalace = fromStart(dayPalace, hIdx);
const hourBranch = DIZHI[hIdx];

const branches = {};
const sp = PALACES.indexOf(hourPalace);
const sb = DIZHI.indexOf(hourBranch);
for (let i = 0; i < 6; i++) {
	branches[PALACES[(sp + i) % 6]] = DIZHI[(sb + i * 2) % 12];
}

const me = WX[branches[hourPalace]];
const relations = {};
for (const p of PALACES) {
	relations[p] = p === hourPalace ? '自身' : relation(me, WX[branches[p]]);
}

const spirits = {};
const qs = PALACES.indexOf(qinglongStart(branches[hourPalace]));
for (let i = 0; i < 6; i++) spirits[PALACES[(qs + i) % 6]] = SPIRITS[i];

const stars = {};
const ss = PALACES.indexOf(dayPalace);
for (let i = 0; i < 6; i++) stars[PALACES[(ss + i) % 6]] = STARS[i];

const expectBranches = { 赤口: '戌', 小吉: '子', 空亡: '寅', 大安: '辰', 留连: '午', 速喜: '申' };
const expectRel = { 赤口: '自身', 小吉: '妻财', 空亡: '官鬼', 大安: '兄弟', 留连: '父母', 速喜: '子孙' };
const expectSpirit = { 小吉: '青龙', 空亡: '朱雀', 大安: '勾陈', 留连: '白虎', 速喜: '玄武', 赤口: '腾蛇' };
const expectStar = { 空亡: '木星', 大安: '火星', 留连: '土星', 速喜: '金星', 赤口: '水星', 小吉: '天空' };

let ok = dayPalace === '空亡' && hourPalace === '赤口';
for (const [p, b] of Object.entries(expectBranches)) if (branches[p] !== b) ok = false;
for (const [p, r] of Object.entries(expectRel)) if (relations[p] !== r) ok = false;
for (const [p, s] of Object.entries(expectSpirit)) if (spirits[p] !== s) ok = false;
for (const [p, s] of Object.entries(expectStar)) if (stars[p] !== s) ok = false;

const numPalace = palaceFromSteps(3);
const numHour = fromStart(numPalace, hourBranchIndex(15));
if (numPalace !== '速喜' || numHour !== '小吉') ok = false;

console.log(ok ? 'PASS' : 'FAIL');
console.log({ found: found.text, dayPalace, hourPalace, hourBranch, branches, relations, spirits, stars, numPalace, numHour });
