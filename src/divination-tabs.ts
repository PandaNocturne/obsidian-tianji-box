import type { DivinationTabConfig, DivinationType, TianjiSettings } from './types';

export const ALL_DIVINATION_TYPES: DivinationType[] = [
	'liuyao',
	'tarot',
	'bazi',
];

export const DIVINATION_TAB_META: Record<
	DivinationType,
	{ label: string; shortLabel: string; icon: string }
> = {
	liuyao: { label: '六爻占卜', shortLabel: '六爻', icon: 'hexagon' },
	tarot: { label: '塔罗牌', shortLabel: '塔罗', icon: 'layout-grid' },
	bazi: { label: '八字分析', shortLabel: '八字', icon: 'calendar' },
};

/** 默认：六爻 > 塔罗牌 > 八字 */
export const DEFAULT_DIVINATION_TABS: DivinationTabConfig[] = [
	{ id: 'liuyao', enabled: true },
	{ id: 'tarot', enabled: true },
	{ id: 'bazi', enabled: true },
];

export function normalizeDivinationTabs(
	raw: unknown,
): DivinationTabConfig[] {
	const byId = new Map<DivinationType, boolean>();
	const order: DivinationType[] = [];

	if (Array.isArray(raw)) {
		for (const item of raw) {
			if (!item || typeof item !== 'object') continue;
			const id = (item as { id?: unknown }).id;
			if (
				id !== 'liuyao' &&
				id !== 'tarot' &&
				id !== 'bazi'
			) {
				continue;
			}
			if (byId.has(id)) continue;
			const enabled =
				typeof (item as { enabled?: unknown }).enabled === 'boolean'
					? (item as { enabled: boolean }).enabled
					: true;
			byId.set(id, enabled);
			order.push(id);
		}
	}

	for (const id of ALL_DIVINATION_TYPES) {
		if (!byId.has(id)) {
			const fallback = DEFAULT_DIVINATION_TABS.find((t) => t.id === id)!;
			byId.set(id, fallback.enabled);
			order.push(id);
		}
	}

	const tabs = order.map((id) => ({
		id,
		enabled: byId.get(id) ?? true,
	}));

	if (!tabs.some((t) => t.enabled)) {
		tabs[0]!.enabled = true;
	}

	return tabs;
}

export function getEnabledTabIds(
	settings: TianjiSettings,
): DivinationType[] {
	return settings.divinationTabs
		.filter((t) => t.enabled)
		.map((t) => t.id);
}

export function isTabEnabled(
	settings: TianjiSettings,
	id: DivinationType,
): boolean {
	return settings.divinationTabs.some((t) => t.id === id && t.enabled);
}

export function moveTabInOrder(
	tabs: DivinationTabConfig[],
	id: DivinationType,
	direction: -1 | 1,
): DivinationTabConfig[] {
	const next = tabs.map((t) => ({ ...t }));
	const index = next.findIndex((t) => t.id === id);
	if (index < 0) return next;
	const target = index + direction;
	if (target < 0 || target >= next.length) return next;
	const tmp = next[index]!;
	next[index] = next[target]!;
	next[target] = tmp;
	return next;
}
