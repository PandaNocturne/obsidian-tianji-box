# 天机匣（Obsidian 插件）

本地六爻、八字、塔罗排盘与历史存档的小玩具。不内置 AI 解读——复制排盘文本后，可自行到任意 AI 服务中分析。

## 免责声明

本插件**仅供娱乐与学习参考，请勿当真**，亦不可作为人生、健康、财务或任何重大决策的依据。

排盘结果只是一种象征性的可能性叙事，并非预言或定论。命运掌握在自己手中——愿您以开放心态看待这些信息，同时把注意力放回现实生活中的选择、责任与机遇。

## 功能

- **六爻**：天机起卦 / 铜钱 / 手动，排盘与卦例库
- **八字**：公历/农历生辰排盘，真太阳时，命理库
- **塔罗**：韦特牌组本地缓存，多种牌阵，牌阵库；点击牌面可查看详解
- **收藏**：历史记录可收藏筛选
- **数据**：本地 SQLite（`sql.js` → `tianji.db`）

## 外部服务说明

- **塔罗释义**：正逆位与运势文案来自 [Taluo.net](https://taluo.net/)，已打包进 `src/tarot/taluo-lore.json`，运行时离线读取。详情弹窗可跳转该站原文。
- **塔罗牌面**：78 张图随插件分发于 `assets/tarot/rider-waite/`，运行时只读本地文件，**不会联网下载**。

开发时更新释义 / 牌面（仅构建机联网，产物再打包进插件）：

```bash
node scripts/fetch-taluo-cards.mjs
node scripts/fetch-taluo-images.mjs
```

## 开发

```bash
npm install
npm run dev
npm run build
```

产物：`main.js`、`manifest.json`、`styles.css`、`sql-wasm.wasm`、`assets/tarot/`（牌面）

## 使用

1. 在 Obsidian **设置 → 社区插件** 中启用「天机匣」
2. 点击左侧丝带图标或命令「打开天机匣」
3. 排盘后可复制文本，到外部 AI 解读
