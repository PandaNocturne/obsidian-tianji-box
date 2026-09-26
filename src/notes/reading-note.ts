import {
	App,
	TFile,
	TFolder,
	moment,
	normalizePath,
	parseYaml,
} from 'obsidian';
import type TianjiPlugin from '../main';
import type { NoteFilenameMode, ReadingRecord, TianjiSettings } from '../types';

/** Obsidian 将 moment 导出为 namespace；运行时可调用 */
const mom = moment as unknown as (inp?: Date | string | number) => {
	format: (fmt: string) => string;
};

const DEFAULT_TIMESTAMP_TEMPLATE = 'YYYYMMDDHHmmss';
const DEFAULT_UID_TEMPLATE = '{{uid}}';

export function defaultFilenameTemplate(mode: NoteFilenameMode): string {
	return mode === 'uid' ? DEFAULT_UID_TEMPLATE : DEFAULT_TIMESTAMP_TEMPLATE;
}

/**
 * 卦例唯一笔记 UID：固定为记录 id，不在「创建笔记」时生成。
 * 保证一卦一例、路径可复现。
 */
export function readingNoteUid(rec: ReadingRecord): string {
	return String(rec.id);
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
 * 解析文件名模板：Moment 语法 + {{uid}}，可用 / 嵌套目录。
 * when 应为卦例时间，而非「点击创建」的当前时刻。
 */
export function resolveNoteFilename(
	template: string,
	uid: string,
	when: Date = new Date(),
): string {
	const raw = template.trim() || DEFAULT_TIMESTAMP_TEMPLATE;
	const parts = raw.split(/\{\{uid\}\}/i);
	const joined = parts
		.map((part) => (part ? mom(when).format(part) : ''))
		.join(uid);
	const cleaned = joined
		.replace(/\\/g, '/')
		.split('/')
		.map((seg) => sanitizePathSegment(seg))
		.filter(Boolean)
		.join('/');
	return cleaned || uid;
}

function sanitizePathSegment(seg: string): string {
	return seg
		.replace(/[<>:"|?*\u0000-\u001f]/g, '_')
		.replace(/\.+$/g, '')
		.trim();
}

export function buildNoteVaultPath(
	settings: TianjiSettings,
	uid: string,
	when?: Date,
): string {
	const folder = normalizePath(settings.noteFolder.trim() || '天机匣/笔记');
	const name = resolveNoteFilename(
		settings.noteFilenameTemplate ||
			defaultFilenameTemplate(settings.noteFilenameMode),
		uid,
		when,
	);
	const withExt = name.toLowerCase().endsWith('.md') ? name : `${name}.md`;
	return normalizePath(`${folder}/${withExt}`);
}

/** 由卦例稳定算出笔记路径（同一卦永远同一路径） */
export function buildNoteVaultPathForReading(
	settings: TianjiSettings,
	rec: ReadingRecord,
): string {
	return buildNoteVaultPath(
		settings,
		readingNoteUid(rec),
		readingNoteTime(rec),
	);
}

export function buildNoteFileContent(
	settings: TianjiSettings,
	rec: ReadingRecord,
	uid: string,
): string {
	const uidKey = settings.noteUidKey.trim() || 'tianji_uid';
	const when = readingNoteTime(rec);
	const fm: Record<string, string> = {
		[uidKey]: uid,
		title: rec.title,
		type: rec.type,
		tianji_id: String(rec.id),
	};
	const fmLines = Object.entries(fm)
		.map(([k, v]) => `${k}: ${yamlScalar(v)}`)
		.join('\n');

	const body = applyContentTemplate(
		settings.noteContentTemplate ?? '',
		rec,
		uid,
		when,
	);
	const legacy = rec.noteMd?.trim() ?? '';
	const parts = [body, legacy].filter(Boolean);
	const text = parts.join(parts.length > 1 ? '\n\n' : '');
	return `---\n${fmLines}\n---\n${text ? `\n${text}\n` : '\n'}`;
}

function yamlScalar(v: string): string {
	if (/[:#\[\]{},&*?|>!%@`]/.test(v) || /^\s|\s$/.test(v) || v === '') {
		return JSON.stringify(v);
	}
	return v;
}

function applyContentTemplate(
	template: string,
	rec: ReadingRecord,
	uid: string,
	when: Date,
): string {
	if (!template) return '';
	const m = mom(when);
	return template
		.replace(/\{\{title\}\}/gi, rec.title)
		.replace(/\{\{uid\}\}/gi, uid)
		.replace(/\{\{type\}\}/gi, rec.type)
		.replace(/\{\{date\}\}/gi, m.format('YYYY-MM-DD'))
		.replace(/\{\{time\}\}/gi, m.format('HH:mm'))
		.replace(/\{\{created\}\}/gi, rec.createdAt);
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
		// 兼容：用 tianji_id 对齐卦例 id
		if (fm.tianji_id != null && String(fm.tianji_id) === uid) {
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
			if (data.tianji_id != null && String(data.tianji_id) === uid) {
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
 * 顺序：UID / tianji_id → 稳定路径 → 旧版 noteUid。
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
	const content = buildNoteFileContent(settings, rec, uid);
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
