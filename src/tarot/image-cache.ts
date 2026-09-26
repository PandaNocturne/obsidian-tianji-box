import { requestUrl, type Plugin } from 'obsidian';
import { TAROT_DECK, type TarotCardDef } from './cards';
import { getRiderWaiteFilename, getRiderWaiteImageUrl } from './decks';

const CONCURRENCY = 4;

/**
 * 将韦特公版牌面下载到插件目录并本地复用。
 * 路径：{plugin}/assets/tarot/rider-waite/*.jpg
 */
export class TarotImageCache {
	private readonly dir: string;
	private readonly inflight = new Map<string, Promise<string>>();
	private dirReady: Promise<void> | null = null;
	private prefetching: Promise<void> | null = null;

	constructor(private plugin: Plugin) {
		this.dir = `${plugin.manifest.dir}/assets/tarot/rider-waite`;
	}

	/** 若本地已有则返回资源 URL，否则下载后返回 */
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

	/** 后台补全全部 78 张（幂等） */
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
		const path = `${this.dir}/${getRiderWaiteFilename(card)}`;

		if (await adapter.exists(path)) {
			return adapter.getResourcePath(path);
		}

		await this.ensureDir();
		const remote = getRiderWaiteImageUrl(card);
		const res = await requestUrl({ url: remote });
		const data = res.arrayBuffer;
		if (!data || data.byteLength < 200) {
			throw new Error(`下载牌面失败：${card.name}`);
		}
		await adapter.writeBinary(path, data);
		return adapter.getResourcePath(path);
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
