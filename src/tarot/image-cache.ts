import type { Plugin } from 'obsidian';
import type { TarotCardDef } from './cards';
import {
	getRiderWaiteFilename,
	getTaluoFilename,
} from './decks';

/**
 * 牌面本地资源（离线）。
 * 只读取插件目录内已打包的图片，不发起网络请求。
 * 路径：{plugin}/assets/tarot/rider-waite/
 */
export class TarotImageCache {
	private readonly dir: string;
	private readonly inflight = new Map<string, Promise<string>>();

	constructor(private plugin: Plugin) {
		this.dir = `${plugin.manifest.dir}/assets/tarot/rider-waite`;
	}

	async ensure(card: TarotCardDef): Promise<string> {
		const existing = this.inflight.get(card.id);
		if (existing) return existing;

		const task = this.resolveLocal(card);
		this.inflight.set(card.id, task);
		try {
			return await task;
		} finally {
			this.inflight.delete(card.id);
		}
	}

	private async resolveLocal(card: TarotCardDef): Promise<string> {
		const adapter = this.plugin.app.vault.adapter;
		const taluoPath = `${this.dir}/${getTaluoFilename(card)}`;
		const legacyPath = `${this.dir}/${getRiderWaiteFilename(card)}`;

		if (await adapter.exists(taluoPath)) {
			return adapter.getResourcePath(taluoPath);
		}
		if (await adapter.exists(legacyPath)) {
			return adapter.getResourcePath(legacyPath);
		}
		throw new Error(`本地牌面缺失：${getTaluoFilename(card)}`);
	}
}
