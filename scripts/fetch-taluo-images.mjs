/**
 * 开发用：从 taluo.net 下载 78 张牌面到 assets/tarot/rider-waite/，随插件离线分发。
 * 运行时不会联网；仅在更新牌面资源时执行。
 * 用法：node scripts/fetch-taluo-images.mjs
 */
import { mkdirSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '../assets/tarot/rider-waite');
const UA =
	'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

const SUITS = [
	{ slug: 'cup' },
	{ slug: 'sword' },
	{ slug: 'wand' },
	{ slug: 'pentacle' },
];

function allSlugs() {
	const slugs = [];
	for (let n = 0; n <= 21; n++) slugs.push(`major_${n}`);
	for (const s of SUITS) {
		for (let i = 0; i <= 13; i++) slugs.push(`${s.slug}_${i}`);
	}
	return slugs;
}

async function download(slug) {
	const url = `https://taluo.net/image/${slug}.jpg`;
	const res = await fetch(url, {
		headers: { 'User-Agent': UA, Accept: 'image/jpeg,image/*,*/*' },
	});
	if (!res.ok) throw new Error(`HTTP ${res.status}`);
	const buf = Buffer.from(await res.arrayBuffer());
	if (buf.byteLength < 200) throw new Error('file too small');
	return buf;
}

function sleep(ms) {
	return new Promise((r) => setTimeout(r, ms));
}

async function main() {
	mkdirSync(OUT_DIR, { recursive: true });

	// 清掉旧 Sacred Texts 命名，避免继续命中旧封面
	const legacy = readdirSync(OUT_DIR).filter(
		(f) =>
			/^(ar|wa|cu|sw|pe)/i.test(f) &&
			f.toLowerCase().endsWith('.jpg'),
	);
	for (const f of legacy) {
		unlinkSync(join(OUT_DIR, f));
		console.log(`removed legacy ${f}`);
	}

	const slugs = allSlugs();
	console.log(`Downloading ${slugs.length} images from taluo.net…`);
	let done = 0;
	for (const slug of slugs) {
		let attempt = 0;
		while (true) {
			try {
				const buf = await download(slug);
				writeFileSync(join(OUT_DIR, `${slug}.jpg`), buf);
				done += 1;
				console.log(`[${done}/${slugs.length}] ${slug}.jpg (${buf.byteLength} bytes)`);
				break;
			} catch (e) {
				attempt += 1;
				if (attempt >= 3) {
					console.error(`FAIL ${slug}:`, e.message ?? e);
					break;
				}
				console.warn(`retry ${slug} (${attempt})`, e.message ?? e);
				await sleep(600 * attempt);
			}
		}
		await sleep(80);
	}

	const left = readdirSync(OUT_DIR).filter((f) => f.endsWith('.jpg'));
	console.log(`Done. ${left.length} jpg files in ${OUT_DIR}`);
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
