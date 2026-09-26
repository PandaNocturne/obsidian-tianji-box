import { Modal, setIcon, type App } from 'obsidian';
import type { TarotCardDef } from '../tarot/cards';
import { suitAccent } from '../tarot/decks';
import type { TarotImageCache } from '../tarot/image-cache';
import {
	getTaluoLore,
	getTaluoPageUrl,
	type TaluoCardLore,
} from '../tarot/taluo';

export class TarotCardDetailModal extends Modal {
	private card: TarotCardDef;
	private reversed: boolean;
	private images: TarotImageCache;
	private lore: TaluoCardLore | undefined;

	constructor(
		app: App,
		images: TarotImageCache,
		opts: { card: TarotCardDef; reversed?: boolean },
	) {
		super(app);
		this.images = images;
		this.card = opts.card;
		this.reversed = opts.reversed ?? false;
		this.lore = getTaluoLore(opts.card.id);
	}

	onOpen(): void {
		this.modalEl.addClass('tianji-card-detail-modal');
		const { contentEl } = this;
		contentEl.empty();

		const head = contentEl.createDiv({ cls: 'tianji-card-detail-head' });
		head.createEl('h2', {
			text: this.card.name,
			cls: 'tianji-card-detail-title',
		});
		head.createDiv({
			cls: 'tianji-card-detail-en',
			text: this.card.nameEn,
		});
		const metaBits = [
			this.card.arcana === 'major' ? '大阿卡纳' : '小阿卡纳',
			this.lore?.element,
			this.lore?.astrology,
		].filter(Boolean);
		if (metaBits.length) {
			head.createDiv({
				cls: 'tianji-card-detail-meta',
				text: metaBits.join(' · '),
			});
		}

		const body = contentEl.createDiv({ cls: 'tianji-card-detail-body' });
		const media = body.createDiv({ cls: 'tianji-card-detail-media' });
		const face = media.createDiv({
			cls: `tianji-card-detail-face${this.reversed ? ' is-reversed' : ''}`,
		});
		const img = face.createEl('img', {
			cls: 'tianji-card-detail-img',
			attr: { alt: this.card.nameEn },
		});
		void this.images
			.ensure(this.card)
			.then((url) => {
				img.src = url;
			})
			.catch(() => {
				img.remove();
				face.addClass('is-fallback');
				face.style.setProperty(
					'--tarot-accent',
					suitAccent(this.card.suit),
				);
				face.createDiv({
					cls: 'tianji-tarot-face-title',
					text: this.card.name,
				});
			});

		if (this.reversed) {
			media.createDiv({
				cls: 'tianji-card-detail-orient',
				text: '当前为逆位',
			});
		}

		const info = body.createDiv({ cls: 'tianji-card-detail-info' });
		if (this.card.keywords.length) {
			info.createDiv({
				cls: 'tianji-card-detail-keywords',
				text: this.card.keywords.join(' · '),
			});
		}

		this.addSection(
			info,
			'正位含义',
			this.lore?.upright || this.card.upright,
			!this.reversed,
		);
		this.addSection(
			info,
			'逆位含义',
			this.lore?.reversed || this.card.reversed,
			this.reversed,
		);

		if (this.lore?.love) this.addSection(info, '爱情运势', this.lore.love);
		if (this.lore?.career)
			this.addSection(info, '事业运势', this.lore.career);
		if (this.lore?.money)
			this.addSection(info, '财运解读', this.lore.money);
		if (this.lore?.advice)
			this.addSection(info, '给您的建议', this.lore.advice);
		if (this.lore?.affirmation) {
			const quote = info.createDiv({
				cls: 'tianji-card-detail-affirmation',
			});
			quote.createDiv({
				cls: 'tianji-card-detail-sec-title',
				text: '今日肯定语',
			});
			quote.createDiv({
				cls: 'tianji-card-detail-quote',
				text: `「${this.lore.affirmation}」`,
			});
		}

		const footer = contentEl.createDiv({
			cls: 'tianji-card-detail-footer',
		});
		footer.createDiv({
			cls: 'tianji-card-detail-credit',
			text: '释义来源：Taluo.net',
		});

		const openBtn = footer.createEl('button', {
			cls: 'tianji-btn tianji-btn-primary',
			type: 'button',
		});
		const icon = openBtn.createSpan({ cls: 'tianji-btn-icon' });
		setIcon(icon, 'external-link');
		openBtn.createSpan({ text: '在 Taluo.net 查看' });
		openBtn.addEventListener('click', () => {
			window.open(getTaluoPageUrl(this.card), '_blank');
		});

		const closeBtn = footer.createEl('button', {
			cls: 'tianji-btn',
			type: 'button',
			text: '关闭',
		});
		closeBtn.addEventListener('click', () => this.close());
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private addSection(
		parent: HTMLElement,
		title: string,
		text: string,
		highlight = false,
	): void {
		if (!text.trim()) return;
		const sec = parent.createDiv({
			cls: `tianji-card-detail-sec${highlight ? ' is-active' : ''}`,
		});
		sec.createDiv({ cls: 'tianji-card-detail-sec-title', text: title });
		sec.createDiv({ cls: 'tianji-card-detail-sec-body', text });
	}
}
