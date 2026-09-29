import { App, PluginSettingTab, Setting, TextComponent, ToggleComponent, setIcon } from 'obsidian';
import {
	DEFAULT_DIVINATION_TABS,
	DIVINATION_TAB_META,
	moveTabInOrder,
} from './divination-tabs';
import type TianjiPlugin from './main';
import { DEFAULT_NOTE_FILENAME_TEMPLATE } from './notes/reading-note';
import type {
	DivinationType,
	NoteOpenMode,
	OpenLocation,
	TianjiSettings,
} from './types';

export const DEFAULT_SUBJECT_SUGGESTIONS: string[] = [
	'财运',
	'事业',
	'合作',
	'婚姻',
	'疾病',
	'学业',
	'出行',
	'失物',
	'争讼',
	'考试',
	'比赛',
	'天气',
];

export const DEFAULT_SETTINGS: TianjiSettings = {
	openLocation: 'sidebar-right',
	libraryLayout: 'table',
	subjectSuggestions: [...DEFAULT_SUBJECT_SUGGESTIONS],
	divinationTabs: DEFAULT_DIVINATION_TABS.map((t) => ({ ...t })),
	lastActiveTab: null,
	noteFolder: '天机匣/笔记',
	noteFilenameTemplate: DEFAULT_NOTE_FILENAME_TEMPLATE,
	noteTemplateFile: '',
	noteUidKey: 'tianji_uid',
	noteOpenMode: 'modal',
	noteAutoCreate: false,
};

/** 去空、去重、保序；全空时回退默认列表 */
export function normalizeSubjectSuggestions(
	raw: unknown,
): string[] {
	const list = Array.isArray(raw)
		? raw
		: typeof raw === 'string'
			? raw.split(/[,，]/)
			: [];
	const seen = new Set<string>();
	const out: string[] = [];
	for (const item of list) {
		if (typeof item !== 'string') continue;
		const t = item.trim();
		if (!t || seen.has(t)) continue;
		seen.add(t);
		out.push(t);
	}
	return out.length > 0 ? out : [...DEFAULT_SUBJECT_SUGGESTIONS];
}

export function formatSubjectSuggestions(list: string[]): string {
	return normalizeSubjectSuggestions(list).join('，');
}

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
			text: '本插件仅提供六爻、小六壬、梅花易数、八字、塔罗的本地排盘与存档。如需解读，请复制排盘文本，自行到其他 AI 服务中分析。',
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
				// 仅禁止关掉「最后一个已启用」模块；已关闭的仍可随时重新打开
				.setDisabled(tab.enabled && enabledCount <= 1)
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

		this.displaySubjectSuggestions(containerEl);
		this.displayNoteSettings(containerEl);
	}

	private displaySubjectSuggestions(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setName('占测事由提示')
			.setDesc('用中文逗号「，」或英文逗号「,」分隔。起卦表单可点选，也可自由输入。')
			.setHeading();

		const wrap = containerEl.createDiv({
			cls: 'tianji-settings-subject-box',
		});
		const ta = wrap.createEl('textarea', {
			cls: 'tianji-settings-subject-textarea',
			attr: {
				rows: '4',
				spellcheck: 'false',
				placeholder: formatSubjectSuggestions(DEFAULT_SUBJECT_SUGGESTIONS),
			},
		});
		ta.value = formatSubjectSuggestions(
			this.plugin.settings.subjectSuggestions,
		);
		ta.addEventListener('change', async () => {
			this.plugin.settings.subjectSuggestions =
				normalizeSubjectSuggestions(ta.value);
			ta.value = formatSubjectSuggestions(
				this.plugin.settings.subjectSuggestions,
			);
			await this.plugin.saveSettings();
		});

		new Setting(containerEl).addButton((btn) => {
			btn.setButtonText('恢复默认').onClick(async () => {
				this.plugin.settings.subjectSuggestions = [
					...DEFAULT_SUBJECT_SUGGESTIONS,
				];
				await this.plugin.saveSettings();
				this.display();
			});
		});
	}

	private displayNoteSettings(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setName('笔记')
			.setDesc(
				'每条卦例对应唯一一篇 Markdown 笔记；默认以编码后的 {{uid}} 命名。',
			)
			.setHeading();

		const bindNoteInput = (
			text: TextComponent,
			opts: {
				placeholder: string;
				value: string;
				onChange: (value: string) => void | Promise<void>;
			},
		) => {
			text.inputEl.addClass('tianji-settings-input');
			text.inputEl.setAttribute('spellcheck', 'false');
			text.setPlaceholder(opts.placeholder).setValue(opts.value);
			text.onChange((value) => {
				void opts.onChange(value);
			});
		};

		new Setting(containerEl)
			.setName('笔记文件夹')
			.setDesc('库内相对路径，例如 天机匣/笔记。')
			.addText((text) => {
				bindNoteInput(text, {
					placeholder: '天机匣/笔记',
					value: this.plugin.settings.noteFolder,
					onChange: async (value) => {
						this.plugin.settings.noteFolder =
							value.trim() || '天机匣/笔记';
						await this.plugin.saveSettings();
					},
				});
			});

		new Setting(containerEl)
			.setName('文件名模板')
			.setDesc(
				'可用 {{uid}} {{title}} {{type}} {{date}}（起卦时间，可写 {{date:YYYY-MM-DD}}）；支持 / 嵌套。',
			)
			.addText((text) => {
				bindNoteInput(text, {
					placeholder: DEFAULT_NOTE_FILENAME_TEMPLATE,
					value: this.plugin.settings.noteFilenameTemplate,
					onChange: async (value) => {
						this.plugin.settings.noteFilenameTemplate =
							value.trim() || DEFAULT_NOTE_FILENAME_TEMPLATE;
						await this.plugin.saveSettings();
					},
				});
			});

		new Setting(containerEl)
			.setName('笔记模板文件')
			.setDesc('库内模板路径，按原文复制正文；可配合 Templates / Templater。')
			.addText((text) => {
				bindNoteInput(text, {
					placeholder: 'Templates/天机笔记.md',
					value: this.plugin.settings.noteTemplateFile,
					onChange: async (value) => {
						this.plugin.settings.noteTemplateFile = value.trim();
						await this.plugin.saveSettings();
					},
				});
			});

		new Setting(containerEl)
			.setName('UID 属性名')
			.setDesc('frontmatter 字段名，值为卦例 id 编码。默认 tianji_uid。')
			.addText((text) => {
				bindNoteInput(text, {
					placeholder: 'tianji_uid',
					value: this.plugin.settings.noteUidKey,
					onChange: async (value) => {
						this.plugin.settings.noteUidKey =
							value.trim() || 'tianji_uid';
						await this.plugin.saveSettings();
					},
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

		new Setting(containerEl)
			.setName('自动创建笔记')
			.setDesc('开启后，若卦例尚无笔记将直接创建并打开，不再询问。')
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.noteAutoCreate)
					.onChange(async (value) => {
						this.plugin.settings.noteAutoCreate = value;
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
