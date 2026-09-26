/**
 * 真太阳时：经度差 + 均时差（近似）
 * 中国标准时间以东经 120° 为基准。
 */

/** 均时差（分钟），Spencer 近似公式 */
export function equationOfTimeMinutes(date: Date): number {
	const start = Date.UTC(date.getFullYear(), 0, 0);
	const now = Date.UTC(
		date.getFullYear(),
		date.getMonth(),
		date.getDate(),
	);
	const dayOfYear = Math.floor((now - start) / 86400000);
	const b = ((2 * Math.PI) / 365) * (dayOfYear - 81);
	return 9.87 * Math.sin(2 * b) - 7.53 * Math.cos(b) - 1.5 * Math.sin(b);
}

/** 经度改正（分钟）：(λ - 120) × 4 */
export function longitudeCorrectionMinutes(longitude: number): number {
	return (longitude - 120) * 4;
}

export function applyTrueSolarTime(
	clock: Date,
	longitude: number,
): { trueSolar: Date; offsetMinutes: number; detail: string } {
	const eot = equationOfTimeMinutes(clock);
	const lon = longitudeCorrectionMinutes(longitude);
	const offsetMinutes = lon + eot;
	const trueSolar = new Date(clock.getTime() + offsetMinutes * 60 * 1000);
	const detail = `经度改正 ${lon.toFixed(1)} 分 + 均时差 ${eot.toFixed(1)} 分 = ${offsetMinutes.toFixed(1)} 分`;
	return { trueSolar, offsetMinutes, detail };
}
