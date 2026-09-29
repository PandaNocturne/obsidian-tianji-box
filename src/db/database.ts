import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js';
import type { Plugin } from 'obsidian';
import type { DivinationType, ReadingRecord } from '../types';
import embeddedWasm from 'sql.js/dist/sql-wasm.wasm';

const READING_COLS =
	'id, type, title, input_json, result_json, ai_response, ai_thinking, note_md, note_uid, is_favorite, created_at';

export class TianjiDatabase {
	private SQL: SqlJsStatic | null = null;
	private db: Database | null = null;
	private dbPath: string;

	constructor(private plugin: Plugin) {
		this.dbPath = `${plugin.manifest.dir}/tianji.db`;
	}

	/**
	 * 优先使用打包进 main.js 的 wasm（BRAT 只下发 main.js 时也能用），
	 * 其次读插件目录下的 sql-wasm.wasm。不依赖外网 CDN。
	 */
	async init(): Promise<void> {
		const wasmBinary = await this.resolveWasmBinary();
		if (!wasmBinary || wasmBinary.byteLength === 0) {
			throw new Error(
				'缺少 sql-wasm.wasm：请使用含完整资源的 Release / 重新构建插件。',
			);
		}

		this.SQL = await initSqlJs({ wasmBinary });

		try {
			const existing = await this.plugin.app.vault.adapter.readBinary(
				this.dbPath,
			);
			this.db = new this.SQL.Database(new Uint8Array(existing));
		} catch {
			this.db = new this.SQL.Database();
		}

		this.db.run(`
			CREATE TABLE IF NOT EXISTS readings (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				type TEXT NOT NULL,
				title TEXT NOT NULL,
				input_json TEXT NOT NULL,
				result_json TEXT NOT NULL,
				ai_response TEXT NOT NULL DEFAULT '',
				ai_thinking TEXT NOT NULL DEFAULT '',
				note_md TEXT NOT NULL DEFAULT '',
				note_uid TEXT NOT NULL DEFAULT '',
				is_favorite INTEGER NOT NULL DEFAULT 0,
				created_at TEXT NOT NULL
			);
		`);
		this.migrate();
		await this.persist();
	}

	isReady(): boolean {
		return this.db !== null;
	}

	private async resolveWasmBinary(): Promise<ArrayBuffer | undefined> {
		if (embeddedWasm?.byteLength) {
			return embeddedWasm.buffer.slice(
				embeddedWasm.byteOffset,
				embeddedWasm.byteOffset + embeddedWasm.byteLength,
			) as ArrayBuffer;
		}

		const wasmPath = `${this.plugin.manifest.dir}/sql-wasm.wasm`;
		try {
			return await this.plugin.app.vault.adapter.readBinary(wasmPath);
		} catch {
			return undefined;
		}
	}

	private migrate(): void {
		const db = this.ensureDb();
		const info = db.exec('PRAGMA table_info(readings)');
		const cols = new Set(
			(info[0]?.values ?? []).map((row) => String(row[1])),
		);
		if (!cols.has('ai_thinking')) {
			db.run(
				`ALTER TABLE readings ADD COLUMN ai_thinking TEXT NOT NULL DEFAULT ''`,
			);
		}
		if (!cols.has('note_md')) {
			db.run(
				`ALTER TABLE readings ADD COLUMN note_md TEXT NOT NULL DEFAULT ''`,
			);
		}
		if (!cols.has('note_uid')) {
			db.run(
				`ALTER TABLE readings ADD COLUMN note_uid TEXT NOT NULL DEFAULT ''`,
			);
		}
		if (!cols.has('is_favorite')) {
			db.run(
				`ALTER TABLE readings ADD COLUMN is_favorite INTEGER NOT NULL DEFAULT 0`,
			);
		}
	}

	private ensureDb(): Database {
		if (!this.db) {
			throw new Error('数据库未初始化');
		}
		return this.db;
	}

	async persist(): Promise<void> {
		const db = this.ensureDb();
		const data = db.export();
		await this.plugin.app.vault.adapter.writeBinary(
			this.dbPath,
			data.buffer.slice(
				data.byteOffset,
				data.byteOffset + data.byteLength,
			) as ArrayBuffer,
		);
	}

	async insertReading(params: {
		type: DivinationType;
		title: string;
		inputJson: string;
		resultJson: string;
		aiResponse?: string;
		aiThinking?: string;
	}): Promise<number> {
		const db = this.ensureDb();
		const createdAt = new Date().toISOString();
		db.run(
			`INSERT INTO readings (type, title, input_json, result_json, ai_response, ai_thinking, note_md, note_uid, is_favorite, created_at)
			 VALUES (?, ?, ?, ?, ?, ?, '', '', 0, ?)`,
			[
				params.type,
				params.title,
				params.inputJson,
				params.resultJson,
				params.aiResponse ?? '',
				params.aiThinking ?? '',
				createdAt,
			],
		);
		const res = db.exec('SELECT last_insert_rowid() as id');
		const id = Number(res[0]?.values[0]?.[0] ?? 0);
		await this.persist();
		return id;
	}

	async setFavorite(id: number, favorite: boolean): Promise<void> {
		const db = this.ensureDb();
		db.run(`UPDATE readings SET is_favorite = ? WHERE id = ?`, [
			favorite ? 1 : 0,
			id,
		]);
		await this.persist();
	}

	async updateNote(id: number, noteMd: string): Promise<void> {
		const db = this.ensureDb();
		db.run(`UPDATE readings SET note_md = ? WHERE id = ?`, [noteMd, id]);
		await this.persist();
	}

	async updateNoteUid(id: number, noteUid: string): Promise<void> {
		const db = this.ensureDb();
		db.run(`UPDATE readings SET note_uid = ? WHERE id = ?`, [noteUid, id]);
		await this.persist();
	}

	listReadings(
		type?: DivinationType,
		limit = 50,
		favoritesOnly = false,
	): ReadingRecord[] {
		if (!this.db) return [];
		const db = this.db;
		const favClause = favoritesOnly ? ' AND is_favorite = 1' : '';
		const order = 'ORDER BY is_favorite DESC, id DESC LIMIT ?';

		const stmt = type
			? db.prepare(
					`SELECT ${READING_COLS} FROM readings WHERE type = ?${favClause} ${order}`,
				)
			: db.prepare(
					`SELECT ${READING_COLS} FROM readings WHERE 1=1${favClause} ${order}`,
				);

		if (type) {
			stmt.bind([type, limit]);
		} else {
			stmt.bind([limit]);
		}

		const rows: ReadingRecord[] = [];
		while (stmt.step()) {
			const row = stmt.getAsObject() as Record<string, unknown>;
			rows.push(this.mapRow(row));
		}
		stmt.free();
		return rows;
	}

	countReadings(type: DivinationType, favoritesOnly = false): number {
		if (!this.db) return 0;
		const stmt = this.db.prepare(
			favoritesOnly
				? `SELECT COUNT(*) as c FROM readings WHERE type = ? AND is_favorite = 1`
				: `SELECT COUNT(*) as c FROM readings WHERE type = ?`,
		);
		stmt.bind([type]);
		stmt.step();
		const row = stmt.getAsObject() as { c?: number };
		stmt.free();
		return Number(row.c ?? 0);
	}

	getReading(id: number): ReadingRecord | null {
		if (!this.db) return null;
		const stmt = this.db.prepare(
			`SELECT ${READING_COLS} FROM readings WHERE id = ?`,
		);
		stmt.bind([id]);
		if (!stmt.step()) {
			stmt.free();
			return null;
		}
		const row = stmt.getAsObject() as Record<string, unknown>;
		stmt.free();
		return this.mapRow(row);
	}

	private mapRow(row: Record<string, unknown>): ReadingRecord {
		return {
			id: Number(row.id),
			type: String(row.type) as DivinationType,
			title: String(row.title),
			inputJson: String(row.input_json),
			resultJson: String(row.result_json),
			aiResponse: String(row.ai_response),
			aiThinking: String(row.ai_thinking ?? ''),
			noteMd: String(row.note_md ?? ''),
			noteUid: String(row.note_uid ?? ''),
			isFavorite: Number(row.is_favorite ?? 0) === 1,
			createdAt: String(row.created_at),
		};
	}

	async deleteReading(id: number): Promise<void> {
		const db = this.ensureDb();
		db.run(`DELETE FROM readings WHERE id = ?`, [id]);
		await this.persist();
	}

	close(): void {
		this.db?.close();
		this.db = null;
	}
}
