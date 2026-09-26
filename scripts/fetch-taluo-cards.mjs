/**
 * 从 taluo.net 抓取 78 张牌释义，生成 src/tarot/taluo-lore.json
 * 用法：node scripts/fetch-taluo-cards.mjs
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '../src/tarot/taluo-lore.json');
const UA =
	'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

const MAJORS = [
	'愚者',
	'魔术师',
	'女祭司',
	'女皇',
	'皇帝',
	'教皇',
	'恋人',
	'战车',
	'力量',
	'隐者',
	'命运之轮',
	'正义',
	'倒吊人',
	'死神',
	'节制',
	'恶魔',
	'高塔',
	'星星',
	'月亮',
	'太阳',
	'审判',
	'世界',
];

const SUITS = [
	{ key: 'cups', slug: 'cup', ourId: 'cups' },
	{ key: 'swords', slug: 'sword', ourId: 'swords' },
	{ key: 'wands', slug: 'wand', ourId: 'wands' },
	{ key: 'pentacles', slug: 'pentacle', ourId: 'pentacles' },
];

function stripTags(html) {
	return html
		.replace(/<script[\s\S]*?<\/script>/gi, '')
		.replace(/<style[\s\S]*?<\/style>/gi, '')
		.replace(/<[^>]+>/g, ' ')
		.replace(/&nbsp;/g, ' ')
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/\s+/g, ' ')
		.trim();
}

function cleanMeaning(text, heading) {
	let t = text;
	if (heading) t = t.replace(new RegExp(`^${heading}\\s*`), '');
	t = t
		.replace(/想知道如何[\s\S]*$/, '')
		.replace(/逆位往往带来更深层的功课[\s\S]*$/, '')
		.replace(/解牌入门指南[\s\S]*$/, '')
		.replace(/塔罗冥想[\s\S]*$/, '')
		.replace(/三张牌牌阵[\s\S]*$/, '')
		.replace(/凯尔特十字[\s\S]*$/, '')
		.trim();
	return t;
}

function extractSection(html, id) {
	const re = new RegExp(
		`id="${id}"[^>]*>([\\s\\S]*?)</section>`,
		'i',
	);
	const m = html.match(re);
	return m ? stripTags(m[1]) : '';
}

function extractEssenceKeywords(html) {
	const m = html.match(/class="card-essence"[^>]*>([\s\S]*?)<\/div>/i);
	if (!m) return [];
	const text = stripTags(m[1]);
	// "牌意速览 正位 新的开始、纯真、冒险精神、无限可能"
	const km = text.match(/正位\s*(.+)$/);
	if (!km) return [];
	return km[1]
		.split(/[、，,]/)
		.map((s) => s.trim())
		.filter(Boolean);
}

function extractMeta(html) {
	const m = html.match(/class="card-meta"[^>]*>([\s\S]*?)<\/div>/i);
	if (!m) return { element: '', astrology: '' };
	const text = stripTags(m[1]);
	// e.g. "大阿卡纳 第0号牌 风元素 天王星"
	const parts = text.split(/\s+/).filter(Boolean);
	const element = parts.find((p) => p.includes('元素')) ?? '';
	const astrology =
		parts.find(
			(p) =>
				!p.includes('阿卡纳') &&
				!p.includes('号牌') &&
				!p.includes('元素') &&
				p.length >= 2,
		) ?? '';
	return { element, astrology };
}

function extractDimensions(html) {
	const m = html.match(
		/class="card-detail-section dimensions-section"[^>]*>([\s\S]*?)<\/section>/i,
	);
	if (!m) return { love: '', career: '', money: '' };
	const text = stripTags(m[1]);
	const love = (
		text.match(/爱情运势\s*([^事财]+?)(?=事业运势|财运解读|$)/) ?? []
	)[1];
	const career = (
		text.match(/事业运势\s*([^财]+?)(?=财运解读|$)/) ?? []
	)[1];
	const money = (text.match(/财运解读\s*(.+)$/) ?? [])[1];
	const scrub = (s) =>
		(s ?? '')
			.replace(/恋情发展牌阵[\s\S]*$/, '')
			.replace(/爱情金字塔[\s\S]*$/, '')
			.replace(/关系牌阵[\s\S]*$/, '')
			.replace(/事业规划牌阵[\s\S]*$/, '')
			.replace(/决策牌阵[\s\S]*$/, '')
			.replace(/三张牌牌阵[\s\S]*$/, '')
			.replace(/每日一抽[\s\S]*$/, '')
			.trim();
	return {
		love: scrub(love),
		career: scrub(career),
		money: scrub(money),
	};
}

function extractAdvice(html) {
	// 找「给您的建议」标题后的段落
	const m = html.match(
		/>给您的建议<\/h[23]>([\s\S]*?)(?:<h[23]|<\/section>)/i,
	);
	return m ? stripTags(m[1]) : '';
}

function extractAffirmation(html) {
	const m = html.match(
		/>今日肯定语<\/h[23]>([\s\S]*?)(?:<h[23]|<\/section>)/i,
	);
	return m ? stripTags(m[1]).replace(/^["「]|["」]$/g, '').trim() : '';
}

async function fetchCard(slug) {
	const url = `https://taluo.net/cards/${slug}`;
	const res = await fetch(url, {
		headers: { 'User-Agent': UA, Accept: 'text/html' },
	});
	if (!res.ok) throw new Error(`${slug} HTTP ${res.status}`);
	const html = await res.text();
	if (html.includes('security verification') && html.length < 5000) {
		throw new Error(`${slug} blocked by Cloudflare`);
	}
	const uprightRaw = extractSection(html, 'upright');
	const reversedRaw = extractSection(html, 'reversed');
	const dims = extractDimensions(html);
	const meta = extractMeta(html);
	return {
		slug,
		sourceUrl: url,
		imageUrl: `https://taluo.net/image/${slug}.jpg`,
		keywords: extractEssenceKeywords(html),
		upright: cleanMeaning(uprightRaw, '正位含义'),
		reversed: cleanMeaning(reversedRaw, '逆位含义'),
		love: dims.love,
		career: dims.career,
		money: dims.money,
		advice: extractAdvice(html),
		affirmation: extractAffirmation(html),
		element: meta.element,
		astrology: meta.astrology,
	};
}

function sleep(ms) {
	return new Promise((r) => setTimeout(r, ms));
}

async function main() {
	/** @type {Record<string, object>} */
	const lore = {};
	const jobs = [];

	for (let n = 0; n <= 21; n++) {
		jobs.push({
			cardId: `major-${n}`,
			slug: `major_${n}`,
			name: MAJORS[n],
		});
	}
	for (const suit of SUITS) {
		for (let i = 0; i <= 13; i++) {
			jobs.push({
				cardId: `${suit.ourId}-${i + 1}`,
				slug: `${suit.slug}_${i}`,
			});
		}
	}

	console.log(`Fetching ${jobs.length} cards from taluo.net…`);
	let done = 0;
	for (const job of jobs) {
		let attempt = 0;
		while (true) {
			try {
				const data = await fetchCard(job.slug);
				lore[job.cardId] = data;
				done += 1;
				console.log(`[${done}/${jobs.length}] ${job.cardId} ok`);
				break;
			} catch (e) {
				attempt += 1;
				if (attempt >= 3) {
					console.error(`FAIL ${job.cardId}:`, e);
					break;
				}
				console.warn(`retry ${job.cardId} (${attempt})`, e.message);
				await sleep(800 * attempt);
			}
		}
		await sleep(120);
	}

	const missing = jobs.filter((j) => !lore[j.cardId]);
	if (missing.length) {
		console.error(
			`Missing ${missing.length}:`,
			missing.map((m) => m.cardId).join(', '),
		);
	}

	mkdirSync(dirname(OUT), { recursive: true });
	writeFileSync(
		OUT,
		JSON.stringify(
			{
				source: 'https://taluo.net/',
				fetchedAt: new Date().toISOString(),
				cards: lore,
			},
			null,
			'\t',
		),
		'utf8',
	);
	console.log(`Wrote ${Object.keys(lore).length} cards → ${OUT}`);
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
