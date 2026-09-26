import {
	App,
	Component,
	MarkdownRenderer,
	Modal,
	Notice,
} from 'obsidian';

export class ReadingNoteModal extends Modal {
	private titleText: string;
	private noteMd: string;
	private onSave: (noteMd: string) => Promise<void> | void;
	private mode: 'edit' | 'preview' = 'edit';
	private previewHost: HTMLElement | null = null;
	private textarea: HTMLTextAreaElement | null = null;
	private previewComponent = new Component();

	constructor(
		app: App,
		opts: {
			title: string;
			noteMd: string;
			onSave: (noteMd: string) => Promise<void> | void;
		},
	) {
		super(app);
		this.titleText = opts.title;
		this.noteMd = opts.noteMd;
		this.onSave = opts.onSave;
		this.mode = opts.noteMd.trim() ? 'preview' : 'edit';
	}

	onOpen(): void {
		this.modalEl.addClass('tianji-note-modal');
		this.paint();
	}

	onClose(): void {
		this.previewComponent.unload();
		this.contentEl.empty();
	}

	private paint(): void {
		const { contentEl } = this;
		contentEl.empty();
		this.previewComponent.unload();
		this.previewComponent = new Component();
		this.previewComponent.load();

		contentEl.createEl('h2', { text: '笔记注释' });
		contentEl.createEl('p', {
			cls: 'tianji-note-meta',
			text: this.titleText,
		});

		const tabs = contentEl.createDiv({ cls: 'tianji-note-tabs' });
		const editTab = tabs.createEl('button', {
			cls: `tianji-chip${this.mode === 'edit' ? ' is-active' : ''}`,
			type: 'button',
			text: '编辑',
		});
		const previewTab = tabs.createEl('button', {
			cls: `tianji-chip${this.mode === 'preview' ? ' is-active' : ''}`,
			type: 'button',
			text: '预览',
		});
		editTab.addEventListener('click', () => {
			this.syncFromTextarea();
			this.mode = 'edit';
			this.paint();
		});
		previewTab.addEventListener('click', () => {
			this.syncFromTextarea();
			this.mode = 'preview';
			this.paint();
		});

		const body = contentEl.createDiv({ cls: 'tianji-note-body' });
		if (this.mode === 'edit') {
			this.textarea = body.createEl('textarea', {
				cls: 'tianji-textarea tianji-note-textarea',
				attr: {
					placeholder:
						'支持 Markdown：标题、列表、加粗、链接等…',
				},
			});
			this.textarea.value = this.noteMd;
			this.textarea.rows = 14;
			this.previewHost = null;
		} else {
			this.textarea = null;
			this.previewHost = body.createDiv({ cls: 'tianji-note-preview markdown-preview-view' });
			const md = this.noteMd.trim() || '_暂无笔记_';
			void MarkdownRenderer.render(
				this.app,
				md,
				this.previewHost,
				'',
				this.previewComponent,
			);
		}

		const footer = contentEl.createDiv({ cls: 'tianji-note-footer' });
		const cancel = footer.createEl('button', {
			cls: 'tianji-btn',
			text: '取消',
			type: 'button',
		});
		cancel.addEventListener('click', () => this.close());
		const save = footer.createEl('button', {
			cls: 'tianji-btn tianji-btn-primary',
			text: '保存',
			type: 'button',
		});
		save.addEventListener('click', async () => {
			this.syncFromTextarea();
			try {
				await this.onSave(this.noteMd);
				new Notice('笔记已保存');
				this.close();
			} catch (e) {
				new Notice(`保存失败：${String(e)}`);
			}
		});
	}

	private syncFromTextarea(): void {
		if (this.textarea) {
			this.noteMd = this.textarea.value;
		}
	}
}
