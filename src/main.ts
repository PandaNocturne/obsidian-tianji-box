import { Notice, Plugin, WorkspaceLeaf } from 'obsidian';
import { TianjiDatabase } from './db/database';
import {
	DIVINATION_TAB_META,
	getEnabledTabIds,
	isTabEnabled,
	normalizeDivinationTabs,
} from './divination-tabs';
import { DEFAULT_SETTINGS, TianjiSettingTab } from './settings';
import type { DivinationType, TianjiSettings } from './types';
import { TarotImageCache } from './tarot/image-cache';
import { TIANJI_VIEW_TYPE, TianjiView, type TabId } from './ui/tianji-view';

export default class TianjiPlugin extends Plugin {
	settings!: TianjiSettings;
	db!: TianjiDatabase;
	tarotImages!: TarotImageCache;

	async onload() {
		await this.loadSettings();

		this.db = new TianjiDatabase(this);
		try {
			await this.db.init();
		} catch (e) {
			console.error('Tianji DB init failed', e);
			new Notice(`天机数据库初始化失败: ${String(e)}`);
		}

		this.tarotImages = new TarotImageCache(this);
		void this.tarotImages.prefetchAll();

		this.registerView(
			TIANJI_VIEW_TYPE,
			(leaf) => new TianjiView(leaf, this),
		);

		this.addRibbonIcon('dices', '打开天机匣', () => {
			void this.activateView();
		});

		this.addCommand({
			id: 'open-tianji',
			name: '打开天机匣',
			callback: () => {
				void this.activateView();
			},
		});

		this.addCommand({
			id: 'open-tianji-liuyao',
			name: '打开六爻占卜',
			callback: () => {
				void this.activateView('liuyao');
			},
		});

		this.addCommand({
			id: 'open-tianji-bazi',
			name: '打开八字分析',
			callback: () => {
				void this.activateView('bazi');
			},
		});

		this.addCommand({
			id: 'open-tianji-tarot',
			name: '打开塔罗牌',
			callback: () => {
				void this.activateView('tarot');
			},
		});

		this.addSettingTab(new TianjiSettingTab(this.app, this));
	}

	onunload() {
		this.db?.close();
	}

	async activateView(tab?: TabId): Promise<void> {
		if (tab && !isTabEnabled(this.settings, tab)) {
			const label = DIVINATION_TAB_META[tab].label;
			new Notice(`${label}已在设置中关闭`);
			tab = undefined;
		}

		const { workspace } = this.app;
		const leaves = workspace.getLeavesOfType(TIANJI_VIEW_TYPE);
		let leaf: WorkspaceLeaf | null =
			leaves.length > 0 ? leaves[0]! : null;

		if (leaf && !this.leafMatchesOpenLocation(leaf)) {
			leaf.detach();
			leaf = null;
		}

		if (!leaf) {
			leaf = this.createLeafForLocation();
			await leaf.setViewState({
				type: TIANJI_VIEW_TYPE,
				active: true,
			});
		}

		workspace.revealLeaf(leaf);
		const view = leaf.view;
		if (view instanceof TianjiView) {
			if (tab) {
				view.setTab(tab);
			} else {
				view.ensureValidTab();
			}
		}
	}

	/** 设置变更后重建已打开的天机视图标签栏 */
	refreshOpenViews(): void {
		const leaves = this.app.workspace.getLeavesOfType(TIANJI_VIEW_TYPE);
		for (const leaf of leaves) {
			const view = leaf.view;
			if (view instanceof TianjiView) {
				view.applyTabSettings();
			}
		}
	}

	/** 现有视图是否已在设置指定的区域 */
	private leafMatchesOpenLocation(leaf: WorkspaceLeaf): boolean {
		const loc = this.settings.openLocation ?? 'sidebar-right';
		const root = leaf.getRoot();
		const { workspace } = this.app;
		const inLeft = root === workspace.leftSplit;
		const inRight = root === workspace.rightSplit;

		if (loc === 'sidebar-left') return inLeft;
		if (loc === 'sidebar-right') return inRight;
		return !inLeft && !inRight;
	}

	/** 按设置选择新建叶位置；侧边栏不可用时回退到主区标签 */
	private createLeafForLocation(): WorkspaceLeaf {
		const { workspace } = this.app;
		const loc = this.settings.openLocation ?? 'sidebar-right';

		if (loc === 'sidebar-left') {
			const leaf = workspace.getLeftLeaf(false);
			if (leaf) return leaf;
		} else if (loc === 'sidebar-right') {
			const leaf = workspace.getRightLeaf(false);
			if (leaf) return leaf;
		}

		return workspace.getLeaf('tab');
	}

	async loadSettings() {
		const loaded = (await this.loadData()) as Partial<TianjiSettings> | null;
		this.settings = Object.assign({}, DEFAULT_SETTINGS, loaded ?? {});
		this.settings.divinationTabs = normalizeDivinationTabs(
			loaded?.divinationTabs ?? DEFAULT_SETTINGS.divinationTabs,
		);
	}

	async saveSettings() {
		this.settings.divinationTabs = normalizeDivinationTabs(
			this.settings.divinationTabs,
		);
		await this.saveData(this.settings);
	}

	getEnabledTabs(): DivinationType[] {
		return getEnabledTabIds(this.settings);
	}
}
