import { App, PluginSettingTab, Setting, ToggleComponent, setIcon } from 'obsidian';
import {
	DEFAULT_DIVINATION_TABS,
	DIVINATION_TAB_META,
	moveTabInOrder,
} from './divination-tabs';
import type TianjiPlugin from './main';
import type { DivinationType, OpenLocation, TianjiSettings } from './types';

export const DEFAULT_SETTINGS: TianjiSettings = {
	openLocation: 'sidebar-right',
	libraryLayout: 'table',
	divinationTabs: DEFAULT_DIVINATION_TABS.map((t) => ({ ...t })),
};

export class TianjiSettingTab extends PluginSettingTab {
	plugin: TianjiPlugin;

	constructor(app: App, plugin: TianjiPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl).setName('天机匣').setHeading();

		containerEl.createEl('p', {
			cls: 'setting-item-description',
			text: '本插件仅提供六爻、八字、塔罗的本地排盘与存档。如需解读，请复制排盘文本，自行到其他 AI 服务中分析。',
		});

		new Setting(containerEl)
			.setName('打开位置')
			.setDesc(
				'新建或重新打开天机视图时的位置。若当前已打开且位置与设置不一致，再次打开会按新位置重建。',
			)
			.addDropdown((dropdown) => {
				dropdown
					.addOption('sidebar-right', '右侧边栏')
					.addOption('sidebar-left', '左侧边栏')
					.addOption('tab', '主编辑区标签页')
					.setValue(this.plugin.settings.openLocation)
					.onChange(async (value) => {
						this.plugin.settings.openLocation =
							value as OpenLocation;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName('占卜模块')
			.setDesc('开关控制是否显示；上下箭头调整标签页顺序。至少保留一项启用。')
			.setHeading();

		const list = containerEl.createDiv({ cls: 'tianji-settings-tabs' });
		const tabs = this.plugin.settings.divinationTabs;
		const enabledCount = tabs.filter((t) => t.enabled).length;

		tabs.forEach((tab, index) => {
			const meta = DIVINATION_TAB_META[tab.id];
			const row = list.createDiv({
				cls: 'tianji-settings-tab-row',
				attr: { 'data-tab': tab.id },
			});

			const left = row.createDiv({ cls: 'tianji-settings-tab-left' });
			const iconWrap = left.createSpan({
				cls: 'tianji-settings-tab-icon',
			});
			setIcon(iconWrap, meta.icon);
			left.createSpan({
				cls: 'tianji-settings-tab-label',
				text: meta.label,
			});

			const actions = row.createDiv({
				cls: 'tianji-settings-tab-actions',
			});

			const upBtn = actions.createEl('button', {
				cls: 'clickable-icon tianji-settings-tab-btn',
				type: 'button',
				attr: { 'aria-label': '上移' },
			});
			setIcon(upBtn, 'chevron-up');
			upBtn.disabled = index === 0;
			upBtn.addEventListener('click', () => {
				void this.moveTab(tab.id, -1);
			});

			const downBtn = actions.createEl('button', {
				cls: 'clickable-icon tianji-settings-tab-btn',
				type: 'button',
				attr: { 'aria-label': '下移' },
			});
			setIcon(downBtn, 'chevron-down');
			downBtn.disabled = index === tabs.length - 1;
			downBtn.addEventListener('click', () => {
				void this.moveTab(tab.id, 1);
			});

			const toggleHost = actions.createDiv({
				cls: 'tianji-settings-tab-toggle',
			});
			new ToggleComponent(toggleHost)
				.setValue(tab.enabled)
				.setDisabled(!tab.enabled && enabledCount <= 1)
				.onChange(async (value) => {
					if (!value && enabledCount <= 1) {
						this.display();
						return;
					}
					const target = this.plugin.settings.divinationTabs.find(
						(t) => t.id === tab.id,
					);
					if (!target) return;
					target.enabled = value;
					await this.plugin.saveSettings();
					this.plugin.refreshOpenViews();
					this.display();
				});
		});
	}

	private async moveTab(
		id: DivinationType,
		direction: -1 | 1,
	): Promise<void> {
		this.plugin.settings.divinationTabs = moveTabInOrder(
			this.plugin.settings.divinationTabs,
			id,
			direction,
		);
		await this.plugin.saveSettings();
		this.plugin.refreshOpenViews();
		this.display();
	}
}
