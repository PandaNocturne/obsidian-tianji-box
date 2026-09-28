/**
 * 校验小六壬排盘（对照昭烈等软件）
 * 用法：node scripts/verify-xiaoliuren.mjs
 */
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// 用 tsx 也可；此处内联复算关键用例，避免依赖编译产物
import { Solar } from 'lunar-javascript';

const PALACES = ['大安', '留连', '速喜', '赤口', '小吉', '空亡'];
const DIZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const STARS = ['木星', '火星', '土星', '金星', '水星', '天空'];
const SPIRITS = ['青龙', '朱雀', '勾陈', '白虎', '玄武', '腾蛇'];
const WX = {
	子: '水', 丑: '土', 寅: '木', 卯: '木', 辰: '土', 巳: '火',
	午: '火', 未: '土', 申: '金', 酉: '金', 戌: '土', 亥: '水',
};
const DIPAN = {
	大安: '木', 留连: '水', 速喜: '火', 赤口: '金', 小吉: '水', 空亡: '土',
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
function keBranchIndex(date) {
	const hour = date.getHours();
	const minute = date.getMinutes();
	let minutesIntoShichen;
	if (hour === 23) minutesIntoShichen = minute;
	else if (hour === 0) minutesIntoShichen = 60 + minute;
	else {
		const start = hourBranchIndex(hour) * 2 - 1;
		minutesIntoShichen = (hour - start) * 60 + minute;
	}
	return Math.min(11, Math.floor(minutesIntoShichen / 10));
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

function build(bodyPalace, bodyBranch, starStart) {
	const branches = {};
	const sp = PALACES.indexOf(bodyPalace);
	const sb = DIZHI.indexOf(bodyBranch);
	for (let i = 0; i < 6; i++) {
		branches[PALACES[(sp + i) % 6]] = DIZHI[(sb + i * 2) % 12];
	}
	const me = WX[bodyBranch];
	const relations = {};
	for (const p of PALACES) {
		relations[p] = p === bodyPalace ? '自身' : relation(me, WX[branches[p]]);
	}
	let cur = nextP(bodyPalace);
	for (let i = 0; i < 6; i++) {
		if (WX[branches[cur]] === '土') {
			relations[cur] = '兄弟';
			break;
		}
		cur = nextP(cur);
	}
	const spirits = {};
	const qs = PALACES.indexOf(qinglongStart(bodyBranch));
	for (let i = 0; i < 6; i++) spirits[PALACES[(qs + i) % 6]] = SPIRITS[i];
	const stars = {};
	const ss = PALACES.indexOf(starStart);
	for (let i = 0; i < 6; i++) stars[PALACES[(ss + i) % 6]] = STARS[i];
	const bodySide = relation(me, DIPAN[bodyPalace]);
	return { branches, relations, spirits, stars, bodySide };
}

// —— 用例1：时刻 2026-09-28 22:15（昭烈截图）——
const d1 = new Date(2026, 8, 28, 22, 15, 0);
const h1 = hourBranchIndex(d1.getHours());
const k1 = keBranchIndex(d1);
const hourPalace1 = fromStart('大安', h1);
const kePalace1 = fromStart(hourPalace1, k1);
const r1 = build(kePalace1, DIZHI[k1], hourPalace1);

const expect1 = {
	hour: '亥',
	ke: '未',
	hourPalace: '空亡',
	kePalace: '大安',
	branches: { 大安: '未', 留连: '酉', 速喜: '亥', 赤口: '丑', 小吉: '卯', 空亡: '巳' },
	relations: { 大安: '自身', 留连: '子孙', 速喜: '妻财', 赤口: '兄弟', 小吉: '官鬼', 空亡: '父母' },
	spirits: { 留连: '青龙', 速喜: '朱雀', 赤口: '勾陈', 小吉: '白虎', 空亡: '玄武', 大安: '腾蛇' },
	stars: { 空亡: '木星', 大安: '火星', 留连: '土星', 速喜: '金星', 赤口: '水星', 小吉: '天空' },
	bodySide: '官鬼',
};

let ok = true;
const check = (name, got, exp) => {
	if (JSON.stringify(got) !== JSON.stringify(exp)) {
		console.error('FAIL', name, { got, exp });
		ok = false;
	}
};

check('1.hour', DIZHI[h1], expect1.hour);
check('1.ke', DIZHI[k1], expect1.ke);
check('1.hourPalace', hourPalace1, expect1.hourPalace);
check('1.kePalace', kePalace1, expect1.kePalace);
check('1.branches', r1.branches, expect1.branches);
check('1.relations', r1.relations, expect1.relations);
check('1.spirits', r1.spirits, expect1.spirits);
check('1.stars', r1.stars, expect1.stars);
check('1.bodySide', r1.bodySide, expect1.bodySide);

// —— 用例2：日时 农历初六戌时 ——
let found = null;
for (const y of [2024, 2025, 2026]) {
	for (let m = 1; m <= 12 && !found; m++) {
		for (let d = 1; d <= 28 && !found; d++) {
			const lunar = Solar.fromYmd(y, m, d).getLunar();
			if (lunar.getDay() === 6) found = { y, m, d, day: lunar.getDay() };
		}
	}
}
const dayPalace2 = palaceFromSteps(found.day);
const hourPalace2 = fromStart(dayPalace2, hourBranchIndex(19)); // 戌
const r2 = build(hourPalace2, '戌', dayPalace2);
check('2.dayPalace', dayPalace2, '空亡');
check('2.hourPalace', hourPalace2, '赤口');
check('2.branches.赤口', r2.branches['赤口'], '戌');
check('2.relations.赤口', r2.relations['赤口'], '自身');
check('2.spirits.小吉', r2.spirits['小吉'], '青龙');
check('2.stars.空亡', r2.stars['空亡'], '木星');

console.log(ok ? 'PASS' : 'FAIL');
