import type {
	DivinationType,
	LibraryLayout,
	LiuyaoMethod,
	ReadingRecord,
} from '../types';

export type LibraryFilter = 'all' | 'favorites';
export type { LibraryLayout };

export interface LibraryRenderOpts {
	emptyText: string;
	favoritesEmptyText?: string;
	viewBtn: string;
	copyBtn: string;
	filter: LibraryFilter;
	layout: LibraryLayout;
	favoriteCount: number;
	onFilterChange: (filter: LibraryFilter) => void;
	onLayoutChange: (layout: LibraryLayout) => void;
	onRestore: (rec: ReadingRecord) => void;
	onToggleFavorite: (rec: ReadingRecord) => void;
	onEditNote: (rec: ReadingRecord) => void;
	onDelete: (id: number) => void;
	onCopy: (text: string, tip: string) => void;
}

interface LibraryRowData {
	subject: string;
	question: string;
	method: string;
	chartSnippet: string;
	castTime: string;
	castTimeRaw: string;
}

export function renderLibraryEmpty(
	container: HTMLElement,
	text: string,
	hint?: string,
): void {
	const empty = container.createDiv({ cls: 'tianji-empty tianji-empty-cta' });
	empty.createDiv({ cls: 'tianji-empty-title', text });
	empty.createDiv({
		cls: 'tianji-empty-hint',
		text: hint ?? '完成排盘或抽牌后会自动保存在此。',
	});
}

export function renderLibraryGrid(
	container: HTMLElement,
	list: ReadingRecord[],
	opts: LibraryRenderOpts,
): void {
	const filterBar = container.createDiv({ cls: 'tianji-library-filter' });
	const left = filterBar.createDiv({ cls: 'tianji-library-filter-left' });
	const mkFilter = (id: LibraryFilter, label: string) => {
		const btn = left.createEl('button', {
			cls: `tianji-chip${opts.filter === id ? ' is-active' : ''}`,
			type: 'button',
			text: label,
		});
		btn.addEventListener('click', () => opts.onFilterChange(id));
	};
	mkFilter('all', '全部');
	mkFilter(
		'favorites',
		opts.favoriteCount ? `收藏 · ${opts.favoriteCount}` : '收藏',
	);

	const right = filterBar.createDiv({ cls: 'tianji-library-filter-right' });
	const mkLayout = (id: LibraryLayout, label: string) => {
		const btn = right.createEl('button', {
			cls: `tianji-chip${opts.layout === id ? ' is-active' : ''}`,
			type: 'button',
			text: label,
		});
		btn.addEventListener('click', () => opts.onLayoutChange(id));
	};
	mkLayout('table', '表格');
	mkLayout('cards', '卡片');

	if (list.length === 0) {
		const emptyText =
			opts.filter === 'favorites'
				? (opts.favoritesEmptyText ??
					'暂无收藏。点击 ★ 即可收藏。')
				: opts.emptyText;
		const hint =
			opts.filter === 'favorites'
				? '收藏的卦例会优先显示，并在此筛选中查看。'
				: undefined;
		renderLibraryEmpty(container, emptyText, hint);
		return;
	}

	if (opts.layout === 'table') {
		renderLibraryTable(container, list, opts);
	} else {
		const grid = container.createDiv({ cls: 'tianji-library-grid' });
		for (const rec of list) {
			renderLibraryCard(grid, rec, opts);
		}
	}
}

function renderLibraryTable(
	container: HTMLElement,
	list: ReadingRecord[],
	opts: LibraryRenderOpts,
): void {
	const wrap = container.createDiv({ cls: 'tianji-library-table-wrap' });
	const table = wrap.createEl('table', { cls: 'tianji-library-table' });
	const thead = table.createEl('thead');
	const headRow = thead.createEl('tr');
	for (const h of [
		'占测事由',
		'占测问题',
		'起卦方式',
		'排盘',
		'起卦时间',
		'笔记',
		'操作',
	]) {
		headRow.createEl('th', { text: h });
	}

	const tbody = table.createEl('tbody');
	for (const rec of list) {
		const data = parseLibraryRow(rec);
		const tr = tbody.createEl('tr', {
			cls: rec.isFavorite ? 'is-favorite' : '',
		});

		const subjectTd = tr.createEl('td', { cls: 'tianji-lib-col-subject' });
		const link = subjectTd.createEl('button', {
			cls: 'tianji-lib-link',
			type: 'button',
			text: data.subject,
		});
		link.addEventListener('click', () => opts.onRestore(rec));
		if (rec.isFavorite) {
			subjectTd.createSpan({ cls: 'tianji-lib-fav-mark', text: '★' });
		}

		tr.createEl('td', {
			cls: 'tianji-lib-col-question',
			text: data.question || '—',
		});
		tr.createEl('td', {
			cls: 'tianji-lib-col-method',
			text: data.method || '—',
		});
		tr.createEl('td', {
			cls: 'tianji-lib-col-chart',
			text: data.chartSnippet || '—',
		});
		tr.createEl('td', {
			cls: 'tianji-lib-col-time',
			text: data.castTime,
		});

		const noteTd = tr.createEl('td', { cls: 'tianji-lib-col-note' });
		const noteBtn = noteTd.createEl('button', {
			cls: `tianji-lib-op tianji-lib-note-btn${
				rec.noteMd.trim() ? ' has-note' : ''
			}`,
			type: 'button',
			text: rec.noteMd.trim() ? '有笔记' : '添加',
			attr: { title: 'Markdown 笔记注释' },
		});
		noteBtn.addEventListener('click', () => opts.onEditNote(rec));

		const ops = tr.createEl('td', { cls: 'tianji-lib-col-ops' });
		const favBtn = ops.createEl('button', {
			cls: `tianji-lib-op${rec.isFavorite ? ' is-fav' : ''}`,
			type: 'button',
			text: rec.isFavorite ? '★' : '☆',
			attr: {
				title: rec.isFavorite ? '取消收藏' : '收藏',
				'aria-label': rec.isFavorite ? '取消收藏' : '收藏',
			},
		});
		favBtn.addEventListener('click', () => opts.onToggleFavorite(rec));

		const delBtn = ops.createEl('button', {
			cls: 'tianji-lib-op is-danger',
			type: 'button',
			text: '删除',
		});
		delBtn.addEventListener('click', () => opts.onDelete(rec.id));
	}
}

function renderLibraryCard(
	container: HTMLElement,
	rec: ReadingRecord,
	opts: LibraryRenderOpts,
): void {
	const data = parseLibraryRow(rec);
	const card = container.createDiv({
		cls: `tianji-history-card${rec.isFavorite ? ' is-favorite' : ''}`,
	});
	const top = card.createDiv({ cls: 'tianji-history-top' });

	const favBtn = top.createEl('button', {
		cls: `tianji-fav-btn${rec.isFavorite ? ' is-active' : ''}`,
		type: 'button',
		attr: {
			'aria-label': rec.isFavorite ? '取消收藏' : '收藏',
			title: rec.isFavorite ? '取消收藏' : '收藏',
		},
		text: rec.isFavorite ? '★' : '☆',
	});
	favBtn.addEventListener('click', (e) => {
		e.stopPropagation();
		opts.onToggleFavorite(rec);
	});

	top.createSpan({
		cls: 'tianji-history-title',
		text: data.subject,
	});
	top.createSpan({
		cls: 'tianji-history-time',
		text: data.castTime,
	});

	const preview = card.createEl('pre', {
		cls: 'tianji-history-preview',
		text: data.chartSnippet
			? data.chartSnippet.slice(0, 360) +
				(data.chartSnippet.length > 360 ? '…' : '')
			: '（无排盘文本）',
	});

	const row = card.createDiv({ cls: 'tianji-history-actions' });
	const viewBtn = row.createEl('button', {
		cls: 'tianji-btn tianji-btn-primary',
		text: opts.viewBtn,
	});
	viewBtn.addEventListener('click', () => opts.onRestore(rec));

	const noteBtn = row.createEl('button', {
		cls: 'tianji-btn',
		text: rec.noteMd.trim() ? '编辑笔记' : '添加笔记',
	});
	noteBtn.addEventListener('click', () => opts.onEditNote(rec));

	if (data.chartSnippet) {
		const copyChart = row.createEl('button', {
			cls: 'tianji-btn',
			text: opts.copyBtn,
		});
		copyChart.addEventListener('click', () => {
			opts.onCopy(data.chartSnippet, '已复制');
		});
	}

	const delBtn = row.createEl('button', {
		cls: 'tianji-btn tianji-btn-danger',
		text: '删除',
	});
	delBtn.addEventListener('click', () => {
		opts.onDelete(rec.id);
	});
}

function parseLibraryRow(rec: ReadingRecord): LibraryRowData {
	let input: Record<string, unknown> = {};
	let result: Record<string, unknown> = {};
	try {
		input = JSON.parse(rec.inputJson) as Record<string, unknown>;
	} catch {
		/* ignore */
	}
	try {
		result = JSON.parse(rec.resultJson) as Record<string, unknown>;
	} catch {
		/* ignore */
	}

	const subject =
		str(result.subject) ||
		str(input.subject) ||
		str(input.name) ||
		rec.title ||
		typeFallbackTitle(rec.type);
	const questionParts = [
		rec.type === 'bazi' ? str(input.relation) : '',
		str(result.question) || str(input.question),
	].filter(Boolean);
	const question = questionParts.join(' · ');
	const method = methodLabel(
		rec.type,
		str(result.method) || str(input.method),
		result,
		input,
	);
	const chartRaw =
		str(result.chartText) || str(result.summary) || '';
	const chartSnippet = chartRaw
		? chartRaw.replace(/\s+/g, ' ').trim().slice(0, 120) +
			(chartRaw.length > 120 ? '…' : '')
		: '';

	const castTimeRaw =
		str(result.castTime) ||
		str(input.castTime) ||
		str(result.solarText) ||
		rec.createdAt;
	return {
		subject,
		question,
		method,
		chartSnippet,
		castTime: formatCastTime(castTimeRaw),
		castTimeRaw,
	};
}

function methodLabel(
	type: DivinationType,
	method: string,
	result: Record<string, unknown>,
	input: Record<string, unknown>,
): string {
	if (type === 'liuyao') {
		switch (method as LiuyaoMethod) {
			case 'auto':
				return '天机起卦';
			case 'coin':
				return '铜钱起卦';
			case 'manual':
				return '手动起卦';
			default:
				return method || '六爻';
		}
	}
	if (type === 'bazi') {
		const cal = str(result.calendar) || str(input.calendar);
		return cal === 'lunar' ? '农历排盘' : '八字排盘';
	}
	if (type === 'tarot') {
		const spread =
			str(result.spreadName) ||
			str(input.spreadName) ||
			str(input.spreadId);
		return spread || '塔罗';
	}
	return '';
}

function typeFallbackTitle(type: DivinationType): string {
	switch (type) {
		case 'liuyao':
			return '六爻占卜';
		case 'bazi':
			return '八字排盘';
		case 'tarot':
			return '塔罗抽牌';
	}
}

function formatCastTime(raw: string): string {
	if (!raw) return '—';
	const d = new Date(raw);
	if (!Number.isNaN(d.getTime())) {
		const pad = (n: number) => String(n).padStart(2, '0');
		return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
	}
	return raw;
}

function str(v: unknown): string {
	return typeof v === 'string' ? v.trim() : '';
}
