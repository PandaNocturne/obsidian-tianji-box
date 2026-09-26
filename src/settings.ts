import { App, PluginSettingTab, Setting, ToggleComponent, setIcon } from 'obsidian';
import {
	DEFAULT_DIVINATION_TABS,
	DIVINATION_TAB_META,
	moveTabInOrder,
} from './divination-tabs';
import type TianjiPlugin from './main';
import { defaultFilenameTemplate } from './notes/reading-note';
import type {
	DivinationType,
	NoteFilenameMode,
	NoteOpenMode,
	OpenLocation,
	TianjiSettings,
} from './types';

export const DEFAULT_SETTINGS: TianjiSettings = {
	openLocation: 'sidebar-right',
	libraryLayout: 'table',
	divinationTabs: DEFAULT_DIVINATION_TABS.map((t) => ({ ...t })),
	lastActiveTab: null,
	noteFolder: '天机匣/笔记',
	noteFilenameMode: 'timestamp',
	noteFilenameTemplate: 'YYYYMMDDHHmmss',
	noteContentTemplate: '',
	noteUidKey: 'tianji_uid',
	noteOpenMode: 'modal',
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

		this.displayNoteSettings(containerEl);
	}

	private displayNoteSettings(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setName('笔记')
			.setDesc(
				'每条卦例对应唯一一篇 Markdown 笔记；文件名由卦例 id 或起卦时间决定，不随「创建」时刻变化。',
			)
			.setHeading();

		new Setting(containerEl)
			.setName('笔记文件夹')
			.setDesc('库内相对路径，例如 天机匣/笔记。')
			.addText((text) => {
				text
					.setPlaceholder('天机匣/笔记')
					.setValue(this.plugin.settings.noteFolder)
					.onChange(async (value) => {
						this.plugin.settings.noteFolder = value.trim() || '天机匣/笔记';
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName('文件名模式')
			.setDesc(
				'时间戳：按该卦起卦/存档时间套用 Moment；UID：使用卦例数据库 id。同一卦始终对应同一文件名。',
			)
			.addDropdown((dropdown) => {
				dropdown
					.addOption('timestamp', '时间戳（卦例时间）')
					.addOption('uid', 'UID（卦例 id）')
					.setValue(this.plugin.settings.noteFilenameMode)
					.onChange(async (value) => {
						const mode = value as NoteFilenameMode;
						this.plugin.settings.noteFilenameMode = mode;
						this.plugin.settings.noteFilenameTemplate =
							defaultFilenameTemplate(mode);
						await this.plugin.saveSettings();
						this.display();
					});
			});

		new Setting(containerEl)
			.setName('文件名模板')
			.setDesc(
				'不含 .md。支持 Moment（相对卦例时间）与 {{uid}}（卦例 id）；用 / 可建嵌套目录。例：YYYY/MM/DD-HHmmss、{{uid}}、YYYY/MM/{{uid}}',
			)
			.addText((text) => {
				text
					.setPlaceholder(
						defaultFilenameTemplate(
							this.plugin.settings.noteFilenameMode,
						),
					)
					.setValue(this.plugin.settings.noteFilenameTemplate)
					.onChange(async (value) => {
						this.plugin.settings.noteFilenameTemplate =
							value.trim() ||
							defaultFilenameTemplate(
								this.plugin.settings.noteFilenameMode,
							);
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName('笔记正文模板')
			.setDesc(
				'新建笔记时的正文，默认为空。可用 {{title}}、{{uid}}、{{type}}、{{date}}、{{time}}。',
			)
			.addTextArea((area) => {
				area
					.setPlaceholder('（空）')
					.setValue(this.plugin.settings.noteContentTemplate)
					.onChange(async (value) => {
						this.plugin.settings.noteContentTemplate = value;
						await this.plugin.saveSettings();
					});
				area.inputEl.rows = 4;
				area.inputEl.addClass('tianji-settings-template');
			});

		new Setting(containerEl)
			.setName('UID 属性名')
			.setDesc(
				'写入笔记 frontmatter 的字段，值为卦例数据库 id，用于唯一查找。默认 tianji_uid。',
			)
			.addText((text) => {
				text
					.setPlaceholder('tianji_uid')
					.setValue(this.plugin.settings.noteUidKey)
					.onChange(async (value) => {
						this.plugin.settings.noteUidKey =
							value.trim() || 'tianji_uid';
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName('打开笔记方式')
			.setDesc(
				'标签页：在主编辑区打开。弹窗：在模态窗口中嵌入 Obsidian 编辑器（参考 Modal Opener），双击边框可还原为标签页。',
			)
			.addDropdown((dropdown) => {
				dropdown
					.addOption('modal', '弹窗')
					.addOption('tab', '标签页')
					.setValue(this.plugin.settings.noteOpenMode)
					.onChange(async (value) => {
						this.plugin.settings.noteOpenMode =
							value as NoteOpenMode;
						await this.plugin.saveSettings();
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
