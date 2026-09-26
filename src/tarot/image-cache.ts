import { requestUrl, type Plugin } from 'obsidian';
import { TAROT_DECK, type TarotCardDef } from './cards';
import {
	getRiderWaiteFilename,
	getSacredTextsImageUrl,
	getTaluoFilename,
} from './decks';
import { getTaluoImageUrl } from './taluo';

const CONCURRENCY = 4;

/**
 * 牌面本地缓存。优先使用已有文件；缺失时先从 Taluo.net 下载，失败再回退 Sacred Texts。
 * 路径：{plugin}/assets/tarot/rider-waite/
 */
export class TarotImageCache {
	private readonly dir: string;
	private readonly inflight = new Map<string, Promise<string>>();
	private dirReady: Promise<void> | null = null;
	private prefetching: Promise<void> | null = null;

	constructor(private plugin: Plugin) {
		this.dir = `${plugin.manifest.dir}/assets/tarot/rider-waite`;
	}

	async ensure(card: TarotCardDef): Promise<string> {
		const existing = this.inflight.get(card.id);
		if (existing) return existing;

		const task = this.ensureInner(card);
		this.inflight.set(card.id, task);
		try {
			return await task;
		} finally {
			this.inflight.delete(card.id);
		}
	}

	prefetchAll(
		onProgress?: (done: number, total: number) => void,
	): Promise<void> {
		if (this.prefetching) return this.prefetching;
		this.prefetching = this.runPrefetch(onProgress).finally(() => {
			this.prefetching = null;
		});
		return this.prefetching;
	}

	private async runPrefetch(
		onProgress?: (done: number, total: number) => void,
	): Promise<void> {
		const total = TAROT_DECK.length;
		let done = 0;
		let cursor = 0;

		const worker = async () => {
			while (cursor < total) {
				const i = cursor++;
				const card = TAROT_DECK[i]!;
				try {
					await this.ensure(card);
				} catch (e) {
					console.warn('Tianji tarot image cache failed', card.id, e);
				}
				done += 1;
				onProgress?.(done, total);
			}
		};

		await Promise.all(
			Array.from({ length: Math.min(CONCURRENCY, total) }, () =>
				worker(),
			),
		);
	}

	private async ensureInner(card: TarotCardDef): Promise<string> {
		const adapter = this.plugin.app.vault.adapter;
		const taluoPath = `${this.dir}/${getTaluoFilename(card)}`;
		const legacyPath = `${this.dir}/${getRiderWaiteFilename(card)}`;

		// 优先 Taluo 命名；不再优先旧 Sacred Texts 文件，避免挡住新封面
		if (await adapter.exists(taluoPath)) {
			return adapter.getResourcePath(taluoPath);
		}

		await this.ensureDir();

		try {
			await this.downloadTo(taluoPath, getTaluoImageUrl(card));
			return adapter.getResourcePath(taluoPath);
		} catch (e) {
			console.warn('Taluo image failed, fallback Sacred Texts', card.id, e);
			// 回退仍写入 Taluo 文件名，统一缓存命名
			if (await adapter.exists(legacyPath)) {
				return adapter.getResourcePath(legacyPath);
			}
			await this.downloadTo(taluoPath, getSacredTextsImageUrl(card));
			return adapter.getResourcePath(taluoPath);
		}
	}

	private async downloadTo(path: string, remote: string): Promise<void> {
		const res = await requestUrl({ url: remote });
		const data = res.arrayBuffer;
		if (!data || data.byteLength < 200) {
			throw new Error(`下载牌面失败：${remote}`);
		}
		await this.plugin.app.vault.adapter.writeBinary(path, data);
	}

	private ensureDir(): Promise<void> {
		if (!this.dirReady) {
			this.dirReady = (async () => {
				const adapter = this.plugin.app.vault.adapter;
				const parts = this.dir.split('/');
				let cur = '';
				for (const part of parts) {
					if (!part) continue;
					cur = cur ? `${cur}/${part}` : part;
					if (!(await adapter.exists(cur))) {
						await adapter.mkdir(cur);
					}
				}
			})();
		}
		return this.dirReady;
	}
}
