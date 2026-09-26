/** 常用城市经度（东经），用于真太阳时校正；标准经线 120° */
export interface CityInfo {
	name: string;
	longitude: number;
	province?: string;
}

export const CITIES: CityInfo[] = [
	{ name: '未知/不校正', longitude: 120 },
	{ name: '北京', longitude: 116.4, province: '北京' },
	{ name: '天津', longitude: 117.2, province: '天津' },
	{ name: '上海', longitude: 121.47, province: '上海' },
	{ name: '重庆', longitude: 106.55, province: '重庆' },
	{ name: '哈尔滨', longitude: 126.63, province: '黑龙江' },
	{ name: '长春', longitude: 125.32, province: '吉林' },
	{ name: '沈阳', longitude: 123.43, province: '辽宁' },
	{ name: '呼和浩特', longitude: 111.75, province: '内蒙古' },
	{ name: '石家庄', longitude: 114.48, province: '河北' },
	{ name: '太原', longitude: 112.55, province: '山西' },
	{ name: '济南', longitude: 117.0, province: '山东' },
	{ name: '郑州', longitude: 113.65, province: '河南' },
	{ name: '西安', longitude: 108.93, province: '陕西' },
	{ name: '兰州', longitude: 103.82, province: '甘肃' },
	{ name: '西宁', longitude: 101.78, province: '青海' },
	{ name: '银川', longitude: 106.27, province: '宁夏' },
	{ name: '乌鲁木齐', longitude: 87.62, province: '新疆' },
	{ name: '南京', longitude: 118.78, province: '江苏' },
	{ name: '杭州', longitude: 120.15, province: '浙江' },
	{ name: '合肥', longitude: 117.25, province: '安徽' },
	{ name: '福州', longitude: 119.3, province: '福建' },
	{ name: '南昌', longitude: 115.85, province: '江西' },
	{ name: '武汉', longitude: 114.3, province: '湖北' },
	{ name: '长沙', longitude: 112.93, province: '湖南' },
	{ name: '广州', longitude: 113.27, province: '广东' },
	{ name: '深圳', longitude: 114.05, province: '广东' },
	{ name: '南宁', longitude: 108.37, province: '广西' },
	{ name: '海口', longitude: 110.32, province: '海南' },
	{ name: '成都', longitude: 104.07, province: '四川' },
	{ name: '贵阳', longitude: 106.71, province: '贵州' },
	{ name: '昆明', longitude: 102.72, province: '云南' },
	{ name: '拉萨', longitude: 91.11, province: '西藏' },
	{ name: '香港', longitude: 114.17, province: '香港' },
	{ name: '澳门', longitude: 113.55, province: '澳门' },
	{ name: '台北', longitude: 121.5, province: '台湾' },
];

export function findCity(name: string): CityInfo {
	return CITIES.find((c) => c.name === name) ?? CITIES[0]!;
}
