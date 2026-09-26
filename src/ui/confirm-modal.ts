import { App, Modal } from 'obsidian';

export class ConfirmModal extends Modal {
	private titleText: string;
	private message: string;
	private confirmText: string;
	private cancelText: string;
	private danger: boolean;
	private onConfirm: () => void | Promise<void>;

	constructor(
		app: App,
		opts: {
			title: string;
			message: string;
			confirmText?: string;
			cancelText?: string;
			danger?: boolean;
			onConfirm: () => void | Promise<void>;
		},
	) {
		super(app);
		this.titleText = opts.title;
		this.message = opts.message;
		this.confirmText = opts.confirmText ?? '确定';
		this.cancelText = opts.cancelText ?? '取消';
		this.danger = opts.danger ?? false;
		this.onConfirm = opts.onConfirm;
	}

	onOpen(): void {
		this.modalEl.addClass('tianji-confirm-modal');
		this.setTitle(this.titleText);

		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl('p', {
			cls: 'tianji-confirm-message',
			text: this.message,
		});

		const footer = contentEl.createDiv({ cls: 'tianji-confirm-footer' });
		const cancel = footer.createEl('button', {
			cls: 'tianji-btn',
			type: 'button',
			text: this.cancelText,
		});
		cancel.addEventListener('click', () => this.close());

		const ok = footer.createEl('button', {
			cls: `tianji-btn tianji-btn-primary${this.danger ? ' tianji-btn-danger' : ''}`,
			type: 'button',
			text: this.confirmText,
		});
		ok.addEventListener('click', async () => {
			ok.setAttribute('disabled', 'true');
			try {
				await this.onConfirm();
				this.close();
			} catch {
				ok.removeAttribute('disabled');
			}
		});
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
