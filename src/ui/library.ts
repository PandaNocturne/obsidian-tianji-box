import { setIcon } from 'obsidian';
import type {
	DivinationType,
	LibraryLayout,
	LiuyaoMethod,
	ReadingRecord,
} from '../types';
import {
	formatBaziChartText,
	type BaziProfessionalChart,
} from '../bazi/pillars';
import { formatTarotReadingChart, type TarotReading } from '../tarot/draw';
import { readingHasNote } from '../notes/reading-note';

export type LibraryFilter = 'all' | 'favorites';
export type { LibraryLayout };

export interface LibraryRenderOpts {
	emptyText: string;
	favoritesEmptyText?: string;
	filter: LibraryFilter;
	layout: LibraryLayout;
	favoriteCount: number;
	query: string;
	onFilterChange: (filter: LibraryFilter) => void;
	onLayoutChange: (layout: LibraryLayout) => void;
	onQueryChange: (query: string) => void;
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
	/** 完整复制文本（含正/逆位说明等） */
	chartCopyText: string;
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

	const searchRow = container.createDiv({ cls: 'tianji-library-search' });
	const searchInput = searchRow.createEl('input', {
		cls: 'tianji-input tianji-library-search-input',
		type: 'search',
		attr: {
			placeholder: '搜索事由、问题、方式、排盘、笔记…',
			spellcheck: 'false',
			enterkeyhint: 'search',
		},
	});
	searchInput.value = opts.query;

	const clearBtn = searchRow.createEl('button', {
		cls: 'tianji-library-search-clear',
		type: 'button',
		attr: {
			title: '清空搜索',
			'aria-label': '清空搜索',
		},
	});
	setIcon(clearBtn, 'x');
	clearBtn.toggleClass('is-visible', Boolean(opts.query.trim()));

	const results = container.createDiv({ cls: 'tianji-library-results' });

	const paint = (query: string) => {
		results.empty();
		const filtered = filterLibraryList(list, query);

		if (list.length === 0) {
			const emptyText =
				opts.filter === 'favorites'
					? (opts.favoritesEmptyText ??
						'暂无收藏。点击星标即可收藏。')
					: opts.emptyText;
			const hint =
				opts.filter === 'favorites'
					? '收藏的卦例会优先显示，并在此筛选中查看。'
					: undefined;
			renderLibraryEmpty(results, emptyText, hint);
			return;
		}

		if (filtered.length === 0) {
			renderLibraryEmpty(
				results,
				'没有匹配的记录',
				'试试其他关键词，或清空搜索。',
			);
			return;
		}

		if (opts.layout === 'table') {
			renderLibraryTable(results, filtered, opts);
		} else {
			const grid = results.createDiv({ cls: 'tianji-library-grid' });
			for (const rec of filtered) {
				renderLibraryCard(grid, rec, opts);
			}
		}
	};

	paint(opts.query);

	searchInput.addEventListener('input', () => {
		const q = searchInput.value;
		clearBtn.toggleClass('is-visible', Boolean(q.trim()));
		opts.onQueryChange(q);
		paint(q);
	});

	clearBtn.addEventListener('click', () => {
		searchInput.value = '';
		clearBtn.toggleClass('is-visible', false);
		opts.onQueryChange('');
		paint('');
		searchInput.focus();
	});
}

function filterLibraryList(
	list: ReadingRecord[],
	query: string,
): ReadingRecord[] {
	const tokens = query
		.trim()
		.toLowerCase()
		.split(/\s+/)
		.filter(Boolean);
	if (tokens.length === 0) return list;

	return list.filter((rec) => {
		const data = parseLibraryRow(rec);
		const hay = [
			data.subject,
			data.question,
			data.method,
			data.chartSnippet,
			data.castTime,
			rec.title,
			rec.noteMd,
			rec.noteUid,
			typeFallbackTitle(rec.type),
		]
			.join('\n')
			.toLowerCase();
		return tokens.every((t) => hay.includes(t));
	});
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
		const link = subjectTd.createSpan({
			cls: 'tianji-lib-link',
			text: data.subject,
			attr: { role: 'button', tabindex: '0' },
		});
		const openRec = () => opts.onRestore(rec);
		link.addEventListener('click', openRec);
		link.addEventListener('keydown', (e) => {
			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault();
				openRec();
			}
		});

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
		const hasNote = readingHasNote(rec);
		const noteBtn = noteTd.createEl('button', {
			cls: `tianji-lib-icon-btn tianji-lib-note-btn${
				hasNote ? ' has-note' : ''
			}`,
			type: 'button',
			attr: {
				title: hasNote ? '打开笔记' : '添加笔记',
				'aria-label': hasNote ? '打开笔记' : '添加笔记',
			},
		});
		setIcon(noteBtn, hasNote ? 'file-text' : 'file-plus');
		noteBtn.addEventListener('click', () => opts.onEditNote(rec));

		const ops = tr.createEl('td', { cls: 'tianji-lib-col-ops' });
		const favBtn = ops.createEl('button', {
			cls: `tianji-fav-btn${rec.isFavorite ? ' is-active' : ''}`,
			type: 'button',
			attr: {
				title: rec.isFavorite ? '取消收藏' : '收藏',
				'aria-label': rec.isFavorite ? '取消收藏' : '收藏',
			},
		});
		setIcon(favBtn, 'star');
		favBtn.addEventListener('click', () => opts.onToggleFavorite(rec));

		const delBtn = ops.createEl('button', {
			cls: 'tianji-lib-icon-btn is-danger',
			type: 'button',
			attr: {
				title: '删除',
				'aria-label': '删除',
			},
		});
		setIcon(delBtn, 'trash-2');
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
	});
	setIcon(favBtn, 'star');
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
	const left = row.createDiv({ cls: 'tianji-history-actions-left' });
	const right = row.createDiv({ cls: 'tianji-history-actions-right' });

	const viewBtn = left.createEl('button', {
		cls: 'tianji-btn tianji-btn-primary',
		text: '查看',
	});
	viewBtn.addEventListener('click', () => opts.onRestore(rec));

	const noteBtn = left.createEl('button', {
		cls: 'tianji-btn',
		text: '笔记',
		attr: {
			title: readingHasNote(rec) ? '打开笔记' : '添加笔记',
		},
	});
	noteBtn.addEventListener('click', () => opts.onEditNote(rec));

	if (data.chartCopyText || data.chartSnippet) {
		const copyChart = right.createEl('button', {
			cls: 'tianji-btn',
			text: '复制',
		});
		copyChart.addEventListener('click', () => {
			opts.onCopy(data.chartCopyText || data.chartSnippet, '已复制');
		});
	}

	const delBtn = right.createEl('button', {
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
	let chartCopyText = chartRaw;
	if (rec.type === 'bazi' && Array.isArray(result.dayun)) {
		try {
			chartCopyText = formatBaziChartText(
				result as unknown as BaziProfessionalChart,
			);
		} catch {
			/* 回退已存 chartText */
		}
	}
	if (rec.type === 'tarot' && Array.isArray(result.cards)) {
		try {
			chartCopyText = formatTarotReadingChart(
				result as unknown as TarotReading,
			);
		} catch {
			/* 回退已存 chartText */
		}
	}

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
		chartCopyText,
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
	if (type === 'xiaoliuren') {
		return (
			str(result.methodLabel) ||
			str(input.methodLabel) ||
			method ||
			'小六壬'
		);
	}
	if (type === 'meihua') {
		return (
			str(result.methodLabel) ||
			str(input.methodLabel) ||
			method ||
			'梅花易数'
		);
	}
	return '';
}

function typeFallbackTitle(type: DivinationType): string {
	switch (type) {
		case 'liuyao':
			return '六爻占卜';
		case 'xiaoliuren':
			return '小六壬';
		case 'meihua':
			return '梅花易数';
		case 'bazi':
			return '四柱八字';
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
