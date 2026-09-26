import {
	App,
	MarkdownView,
	Modal,
	Notice,
	Scope,
	TFile,
	WorkspaceLeaf,
	setIcon,
} from 'obsidian';
import { openNoteInTab } from '../notes/reading-note';
import { ConfirmModal } from './confirm-modal';

/**
 * 在 Modal 中嵌入真实 Markdown 编辑/预览视图。
 * 实现参考：https://github.com/likemuuxi/obsidian-modal-opener
 * （隐藏 leaf + openFile，再把 view.containerEl 挂到 modal）
 */
export class FileNoteModal extends Modal {
	private file: TFile;
	private editMode: 'source' | 'preview';
	private onClosed?: () => void;
	private onDeleteNote?: () => void | Promise<void>;
	private modalLeaf?: WorkspaceLeaf;
	private prevActiveLeaf?: WorkspaceLeaf;
	private boundDblClick: (ev: MouseEvent) => void;
	private toggleBtn: HTMLElement | null = null;

	constructor(
		app: App,
		opts: {
			file: TFile;
			/** 默认 source，便于直接编辑 */
			mode?: 'source' | 'preview';
			onClose?: () => void;
			/** 确认删除笔记文件后回调（清空关联等） */
			onDeleteNote?: () => void | Promise<void>;
		},
	) {
		super(app);
		this.file = opts.file;
		this.editMode = opts.mode ?? 'source';
		this.onClosed = opts.onClose;
		this.onDeleteNote = opts.onDeleteNote;
		// 允许 App 级命令在弹窗内生效（与 modal-opener 一致）
		this.scope = new Scope(this.app.scope);
		this.boundDblClick = this.handleBorderDblClick.bind(this);
	}

	async onOpen(): Promise<void> {
		this.modalEl.addClass('tianji-file-note-modal');
		const bg = this.containerEl.querySelector('.modal-bg');
		bg?.addClass('tianji-file-note-modal-bg');

		this.prevActiveLeaf =
			this.app.workspace.getMostRecentLeaf() ?? undefined;

		this.modalLeaf = this.app.workspace.createLeafInParent(
			this.app.workspace.rootSplit,
			0,
		);
		const leafEl = (this.modalLeaf as WorkspaceLeaf & {
			containerEl?: HTMLElement;
		}).containerEl;
		if (leafEl) {
			leafEl.style.display = 'none';
		}

		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('tianji-file-note-content');
		contentEl.setAttribute('data-src', this.file.path);

		const host = contentEl.createDiv({ cls: 'tianji-file-note-host' });

		await this.modalLeaf.openFile(this.file, {
			state: { mode: this.editMode },
		});
		host.appendChild(this.modalLeaf.view.containerEl);

		this.addFloatingButtons(contentEl);

		this.scope.register([], 'Escape', (evt: KeyboardEvent) => {
			evt.preventDefault();
			this.close();
		});

		this.modalEl.addEventListener('dblclick', this.boundDblClick);

		contentEl.tabIndex = -1;
		contentEl.focus();
		this.focusEditor();
		this.syncToggleIcon();
	}

	onClose(): void {
		this.modalEl.removeEventListener('dblclick', this.boundDblClick);
		this.contentEl.empty();
		this.toggleBtn = null;

		if (this.modalLeaf) {
			this.modalLeaf.detach();
			this.modalLeaf = undefined;
		}

		if (this.prevActiveLeaf) {
			try {
				this.app.workspace.setActiveLeaf(this.prevActiveLeaf, {
					focus: true,
				});
			} catch {
				/* leaf may already be gone */
			}
		}

		this.onClosed?.();
	}

	/** 右下角悬浮按钮（参考 modal-opener floating-button） */
	private addFloatingButtons(container: HTMLElement): void {
		const wrap = container.createDiv({
			cls: 'tianji-file-note-fab',
		});

		this.toggleBtn = wrap.createEl('button', {
			cls: 'tianji-file-note-fab-btn',
			type: 'button',
			attr: {
				title: '切换编辑/阅读',
				'aria-label': '切换编辑/阅读',
			},
		});
		setIcon(this.toggleBtn, 'book-open');
		this.toggleBtn.addEventListener('click', (e) => {
			e.preventDefault();
			e.stopPropagation();
			void this.togglePreview();
		});

		const openTabBtn = wrap.createEl('button', {
			cls: 'tianji-file-note-fab-btn',
			type: 'button',
			attr: {
				title: '在标签页打开',
				'aria-label': '在标签页打开',
			},
		});
		setIcon(openTabBtn, 'app-window');
		openTabBtn.addEventListener('click', (e) => {
			e.preventDefault();
			e.stopPropagation();
			void this.promoteToTab();
		});

		const delBtn = wrap.createEl('button', {
			cls: 'tianji-file-note-fab-btn is-danger',
			type: 'button',
			attr: {
				title: '删除笔记',
				'aria-label': '删除笔记',
			},
		});
		setIcon(delBtn, 'trash-2');
		delBtn.addEventListener('click', (e) => {
			e.preventDefault();
			e.stopPropagation();
			this.confirmDeleteNote();
		});
	}

	private confirmDeleteNote(): void {
		new ConfirmModal(this.app, {
			title: '删除笔记',
			message: `确定删除笔记「${this.file.basename}」？此操作不可撤销。`,
			confirmText: '删除',
			danger: true,
			onConfirm: async () => {
				await this.deleteNoteFile();
			},
		}).open();
	}

	private async deleteNoteFile(): Promise<void> {
		const file = this.file;
		try {
			// 先解除关联并卸下编辑视图，避免关闭时自动保存把文件写回
			await this.onDeleteNote?.();
			if (this.modalLeaf) {
				this.modalLeaf.detach();
				this.modalLeaf = undefined;
			}
			const still = this.app.vault.getAbstractFileByPath(file.path);
			if (still instanceof TFile) {
				try {
					await this.app.fileManager.trashFile(still);
				} catch {
					await this.app.vault.delete(still, true);
				}
			}
			// 确认路径已清空
			if (this.app.vault.getAbstractFileByPath(file.path)) {
				const again = this.app.vault.getAbstractFileByPath(file.path);
				if (again instanceof TFile) {
					await this.app.vault.delete(again, true);
				}
			}
			new Notice('笔记已删除');
			this.close();
		} catch (e) {
			console.error(e);
			new Notice(`删除失败：${String(e)}`);
		}
	}

	private syncToggleIcon(): void {
		if (!this.toggleBtn) return;
		const view = this.modalLeaf?.view;
		const isSource =
			view instanceof MarkdownView && view.getMode() === 'source';
		setIcon(this.toggleBtn, isSource ? 'book-open' : 'pencil');
		this.toggleBtn.setAttribute(
			'title',
			isSource ? '切换到阅读' : '切换到编辑',
		);
		this.toggleBtn.setAttribute(
			'aria-label',
			isSource ? '切换到阅读' : '切换到编辑',
		);
	}

	private focusEditor(): void {
		const view = this.modalLeaf?.view;
		if (view instanceof MarkdownView) {
			view.editor?.focus();
		}
	}

	private async togglePreview(): Promise<void> {
		const view = this.modalLeaf?.view;
		if (!(view instanceof MarkdownView)) return;
		const next = view.getMode() === 'source' ? 'preview' : 'source';
		await view.setState(
			{ ...view.getState(), mode: next },
			{ history: false },
		);
		this.syncToggleIcon();
		if (next === 'source') {
			this.focusEditor();
		}
	}

	private handleBorderDblClick(event: MouseEvent): void {
		const target = event.target as HTMLElement;
		if (!this.isBorderClick(target)) return;
		event.preventDefault();
		event.stopPropagation();
		void this.promoteToTab();
	}

	/** 双击弹窗边框（非正文区域）→ 恢复到标签页，同 modal-opener */
	private isBorderClick(element: HTMLElement): boolean {
		if (element === this.modalEl || element.parentElement === this.modalEl) {
			return true;
		}
		if (element.closest('.tianji-file-note-fab')) {
			return false;
		}
		if (this.contentEl.contains(element)) {
			return false;
		}
		if (
			element.closest(
				'.workspace-leaf-content, .markdown-preview-view, .cm-editor, .tianji-file-note-host',
			)
		) {
			return false;
		}
		return true;
	}

	private async promoteToTab(): Promise<void> {
		const file = this.file;
		this.close();
		await openNoteInTab(this.app, file);
	}
}
