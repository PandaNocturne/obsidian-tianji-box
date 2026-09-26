import { App, PluginSettingTab, Setting } from 'obsidian';
import type TianjiPlugin from './main';
import type { OpenLocation, TianjiSettings } from './types';

export const DEFAULT_SETTINGS: TianjiSettings = {
	openLocation: 'sidebar-right',
	libraryLayout: 'table',
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

		new Setting(containerEl).setName('天机占卜').setHeading();

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
	}
}
