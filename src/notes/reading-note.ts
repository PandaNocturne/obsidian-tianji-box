import {
	App,
	TFile,
	TFolder,
	moment,
	normalizePath,
	parseYaml,
} from 'obsidian';
import type TianjiPlugin from '../main';
import type { DivinationType, ReadingRecord, TianjiSettings } from '../types';

/** Obsidian 将 moment 导出为 namespace；运行时可调用 */
const mom = moment as unknown as (inp?: Date | string | number) => {
	format: (fmt: string) => string;
};

/** 默认文件名：类型/日期_事由 */
export const DEFAULT_NOTE_FILENAME_TEMPLATE = '{{type}}/{{date:YYMMDD}}_{{title}}';

/** {{date}} 默认格式（起卦时间） */
const DEFAULT_DATE_FORMAT = 'YYYYMMDDHHmmss';

export interface NoteFilenameContext {
	uid: string;
	title: string;
	type: DivinationType;
	/** 起卦 / 排盘时间 */
	when: Date;
}

export function noteTypeLabel(type: DivinationType): string {
	switch (type) {
		case 'liuyao':
			return '六爻';
		case 'xiaoliuren':
			return '小六壬';
		case 'meihua':
			return '梅花';
		case 'tarot':
			return '塔罗牌';
		case 'bazi':
			return '八字';
	}
}

/**
 * 将卦例数字 id 编码为笔记 UID（非明文自增号）。
 * 格式：base64url(`tj:{id}`)
 */
export function encodeNoteUid(id: number): string {
	const raw = `tj:${id}`;
	return btoa(raw)
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/g, '');
}

/** 解码笔记 UID；非法则返回 null */
export function decodeNoteUid(uid: string): number | null {
	const s = uid.trim();
	if (!s) return null;
	try {
		const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
		const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
		const raw = atob(b64 + pad);
		const m = /^tj:(\d+)$/.exec(raw);
		if (!m) return null;
		const n = Number(m[1]);
		return Number.isFinite(n) ? n : null;
	} catch {
		return null;
	}
}

/**
 * 卦例唯一笔记 UID：由记录 id 编码得到，创建时不随机生成。
 * 保证一卦一例、路径可复现。
 */
export function readingNoteUid(rec: ReadingRecord): string {
	return encodeNoteUid(rec.id);
}

/** 用于文件名时间戳：起卦/排盘时间，否则存档时间 */
export function readingNoteTime(rec: ReadingRecord): Date {
	const fromJson = (raw: string): Date | null => {
		try {
			const obj = JSON.parse(raw) as Record<string, unknown>;
			for (const key of ['castTime', 'solarText', 'birthTime']) {
				const v = obj[key];
				if (typeof v === 'string' && v.trim()) {
					const d = new Date(v);
					if (!Number.isNaN(d.getTime())) return d;
				}
			}
		} catch {
			/* ignore */
		}
		return null;
	};

	return (
		fromJson(rec.resultJson) ??
		fromJson(rec.inputJson) ??
		(() => {
			const d = new Date(rec.createdAt);
			return Number.isNaN(d.getTime()) ? new Date(0) : d;
		})()
	);
}

/** 记录是否已有关联笔记（已绑定 UID、旧版内联，或库内已有对应文件） */
export function readingHasNote(rec: ReadingRecord): boolean {
	return Boolean(rec.noteUid?.trim()) || Boolean(rec.noteMd?.trim());
}

/**
 * 解析文件名模板。
 * 支持 {{uid}} {{title}} {{type}} {{date}} / {{date:FORMAT}}，
 * 以及剩余 Moment 片段；可用 / 嵌套目录。
 * {{date}} 使用起卦时间，默认 YYYYMMDDHHmmss。
 */
export function resolveNoteFilename(
	template: string,
	ctx: NoteFilenameContext,
): string {
	let raw = template.trim() || DEFAULT_NOTE_FILENAME_TEMPLATE;

	raw = raw.replace(/\{\{date:([^}]+)\}\}/gi, (_m, fmt: string) =>
		mom(ctx.when).format(String(fmt).trim() || DEFAULT_DATE_FORMAT),
	);
	raw = raw.replace(
		/\{\{date\}\}/gi,
		mom(ctx.when).format(DEFAULT_DATE_FORMAT),
	);
	raw = raw.replace(/\{\{uid\}\}/gi, ctx.uid);
	raw = raw.replace(
		/\{\{title\}\}/gi,
		sanitizePathSegment(ctx.title) || '未命名',
	);
	raw = raw.replace(/\{\{type\}\}/gi, noteTypeLabel(ctx.type));

	const cleaned = raw
		.replace(/\\/g, '/')
		.split('/')
		.map((seg) => {
			const s = seg.trim();
			if (!s) return '';
			// 剩余 Moment 片段（不含中文，含日期格式字符）
			if (
				/[Yy]{2}|M{1,4}|[Dd]{1,4}|H{1,2}|h{1,2}|mm|ss/.test(s) &&
				!/[\u4e00-\u9fff]/.test(s)
			) {
				return sanitizePathSegment(mom(ctx.when).format(s));
			}
			return sanitizePathSegment(s);
		})
		.filter(Boolean)
		.join('/');
	return cleaned || ctx.uid;
}

function sanitizePathSegment(seg: string): string {
	return seg
		.replace(/[<>:"|?*\u0000-\u001f]/g, '_')
		.replace(/[/\\]/g, '_')
		.replace(/\.+$/g, '')
		.trim();
}

export function buildNoteVaultPath(
	settings: TianjiSettings,
	ctx: NoteFilenameContext,
): string {
	const folder = normalizePath(settings.noteFolder.trim() || '天机匣/笔记');
	const name = resolveNoteFilename(
		settings.noteFilenameTemplate || DEFAULT_NOTE_FILENAME_TEMPLATE,
		ctx,
	);
	const withExt = name.toLowerCase().endsWith('.md') ? name : `${name}.md`;
	return normalizePath(`${folder}/${withExt}`);
}

/** 由卦例稳定算出笔记路径（同一卦永远同一路径） */
export function buildNoteVaultPathForReading(
	settings: TianjiSettings,
	rec: ReadingRecord,
): string {
	return buildNoteVaultPath(settings, {
		uid: readingNoteUid(rec),
		title: rec.title,
		type: rec.type,
		when: readingNoteTime(rec),
	});
}

export async function buildNoteFileContent(
	app: App,
	settings: TianjiSettings,
	rec: ReadingRecord,
	uid: string,
): Promise<string> {
	const uidKey = settings.noteUidKey.trim() || 'tianji_uid';
	const fm: Record<string, string> = {
		[uidKey]: uid,
		title: rec.title,
		type: rec.type,
	};
	const fmLines = Object.entries(fm)
		.map(([k, v]) => `${k}: ${yamlScalar(v)}`)
		.join('\n');

	const fromTemplate = await readNoteTemplateBody(
		app,
		settings.noteTemplateFile,
	);
	const legacy = rec.noteMd?.trim() ?? '';
	const parts = [fromTemplate, legacy].filter(Boolean);
	const text = parts.join(parts.length > 1 ? '\n\n' : '');
	return `---\n${fmLines}\n---\n${text ? `\n${text}\n` : '\n'}`;
}

/** 读取库内模板文件正文（去掉 frontmatter），不做变量替换 */
export async function readNoteTemplateBody(
	app: App,
	templatePath: string,
): Promise<string> {
	const path = normalizePath(templatePath.trim());
	if (!path) return '';
	const file = app.vault.getAbstractFileByPath(path);
	if (!(file instanceof TFile)) return '';
	try {
		const raw = await app.vault.cachedRead(file);
		return stripFrontmatter(raw).replace(/^\n+/, '').replace(/\n+$/, '');
	} catch {
		return '';
	}
}

function yamlScalar(v: string): string {
	if (/[:#\[\]{},&*?|>!%@`]/.test(v) || /^\s|\s$/.test(v) || v === '') {
		return JSON.stringify(v);
	}
	return v;
}

/** 按 frontmatter UID 在库中查找笔记 */
export function findNoteFileByUid(
	app: App,
	settings: TianjiSettings,
	uid: string,
): TFile | null {
	if (!uid.trim()) return null;
	const uidKey = settings.noteUidKey.trim() || 'tianji_uid';
	const folder = normalizePath(settings.noteFolder.trim() || '天机匣/笔记');
	const folderPrefix = folder === '/' || folder === '.' ? '' : folder;

	for (const file of app.vault.getMarkdownFiles()) {
		if (folderPrefix) {
			const inFolder =
				file.path === folderPrefix ||
				file.path.startsWith(`${folderPrefix}/`);
			if (!inFolder) continue;
		}
		const cache = app.metadataCache.getFileCache(file);
		const fm = cache?.frontmatter;
		if (!fm) continue;
		if (fm[uidKey] != null && String(fm[uidKey]) === uid) {
			return file;
		}
	}

	return null;
}

/** 按 frontmatter UID 在库中查找笔记（含 cachedRead 回退） */
export async function findReadingNoteFile(
	app: App,
	settings: TianjiSettings,
	uid: string,
): Promise<TFile | null> {
	const cached = findNoteFileByUid(app, settings, uid);
	if (cached) return cached;

	const uidKey = settings.noteUidKey.trim() || 'tianji_uid';
	const folder = normalizePath(settings.noteFolder.trim() || '天机匣/笔记');
	const folderPrefix = folder === '/' || folder === '.' ? '' : folder;

	for (const file of app.vault.getMarkdownFiles()) {
		if (folderPrefix) {
			const inFolder =
				file.path === folderPrefix ||
				file.path.startsWith(`${folderPrefix}/`);
			if (!inFolder) continue;
		}
		try {
			const raw = await app.vault.cachedRead(file);
			const data = parseFrontmatter(raw);
			if (!data) continue;
			if (data[uidKey] != null && String(data[uidKey]) === uid) {
				return file;
			}
		} catch {
			/* skip */
		}
	}
	return null;
}

function parseFrontmatter(
	content: string,
): Record<string, unknown> | null {
	if (!content.startsWith('---')) return null;
	const end = content.indexOf('\n---', 3);
	if (end < 0) return null;
	const block = content.slice(3, end).trim();
	try {
		return parseYaml(block) as Record<string, unknown> | null;
	} catch {
		return null;
	}
}

export async function ensureFolderPath(
	app: App,
	filePath: string,
): Promise<void> {
	const normalized = normalizePath(filePath);
	const dir = normalized.includes('/')
		? normalized.slice(0, normalized.lastIndexOf('/'))
		: '';
	if (!dir) return;

	const parts = dir.split('/');
	let cur = '';
	for (const part of parts) {
		cur = cur ? `${cur}/${part}` : part;
		const existing = app.vault.getAbstractFileByPath(cur);
		if (existing instanceof TFolder) continue;
		if (existing) {
			throw new Error(`路径被占用，无法创建文件夹：${cur}`);
		}
		await app.vault.createFolder(cur);
	}
}

/**
 * 仅查找卦例对应笔记（不创建）。
 * 顺序：编码 UID → 稳定路径 → 旧版 noteUid。
 */
export async function resolveReadingNoteFile(
	plugin: TianjiPlugin,
	rec: ReadingRecord,
): Promise<{ file: TFile; uid: string } | null> {
	const settings = plugin.settings;
	const uid = readingNoteUid(rec);
	const path = buildNoteVaultPathForReading(settings, rec);

	let existing = await findReadingNoteFile(plugin.app, settings, uid);

	if (!existing) {
		const atPath = plugin.app.vault.getAbstractFileByPath(path);
		if (atPath instanceof TFile) existing = atPath;
	}

	const legacyUid = rec.noteUid?.trim() ?? '';
	if (!existing && legacyUid && legacyUid !== uid) {
		existing = await findReadingNoteFile(plugin.app, settings, legacyUid);
	}

	if (!existing) return null;
	return { file: existing, uid };
}

/**
 * 确保记录对应的库内笔记存在。
 * 路径/UID 由卦例 id 与起卦时间决定，同一卦不会创建第二份。
 */
export async function ensureReadingNoteFile(
	plugin: TianjiPlugin,
	rec: ReadingRecord,
): Promise<{ file: TFile; uid: string; created: boolean }> {
	const settings = plugin.settings;
	const uid = readingNoteUid(rec);
	const path = buildNoteVaultPathForReading(settings, rec);

	const resolved = await resolveReadingNoteFile(plugin, rec);
	if (resolved) {
		if (rec.noteUid !== resolved.uid) {
			await plugin.db.updateNoteUid(rec.id, resolved.uid);
		}
		return { file: resolved.file, uid: resolved.uid, created: false };
	}

	await ensureFolderPath(plugin.app, path);
	const content = await buildNoteFileContent(
		plugin.app,
		settings,
		rec,
		uid,
	);
	const file = await plugin.app.vault.create(path, content);
	await plugin.db.updateNoteUid(rec.id, uid);
	if (rec.noteMd.trim()) {
		await plugin.db.updateNote(rec.id, '');
	}
	return { file, uid, created: true };
}

/** 读取笔记正文（去掉 frontmatter），用于预览 / 弹窗 */
export async function readNoteBody(app: App, file: TFile): Promise<string> {
	const raw = await app.vault.read(file);
	return stripFrontmatter(raw);
}

export function stripFrontmatter(content: string): string {
	if (!content.startsWith('---')) return content;
	const end = content.indexOf('\n---', 3);
	if (end < 0) return content;
	let body = content.slice(end + 4);
	if (body.startsWith('\n')) body = body.slice(1);
	return body;
}

/** 写回正文，保留原 frontmatter；若无则补上 UID */
export async function writeNoteBody(
	app: App,
	file: TFile,
	body: string,
	settings: TianjiSettings,
	uid: string,
): Promise<void> {
	const raw = await app.vault.read(file);
	const uidKey = settings.noteUidKey.trim() || 'tianji_uid';
	if (raw.startsWith('---')) {
		const end = raw.indexOf('\n---', 3);
		if (end >= 0) {
			const fm = raw.slice(0, end + 4);
			const next = `${fm}\n${body.replace(/^\n+/, '')}`;
			await app.vault.modify(
				file,
				next.endsWith('\n') ? next : `${next}\n`,
			);
			return;
		}
	}
	const fm = `---\n${uidKey}: ${yamlScalar(uid)}\n---\n\n${body}`;
	await app.vault.modify(file, fm.endsWith('\n') ? fm : `${fm}\n`);
}

export async function openNoteInTab(app: App, file: TFile): Promise<void> {
	const leaf = app.workspace.getLeaf('tab');
	await leaf.openFile(file, { active: true });
}
