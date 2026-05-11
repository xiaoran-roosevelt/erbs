# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

《二百四》是一个四人捡分制扑克牌游戏，单文件实现（`erbs.html`），纯前端，无框架，无构建工具。人类玩家 vs 3 个 AI。

## 如何运行

直接在浏览器中打开 `erbs.html`。无需服务器、无需安装依赖。

## 游戏规则概要

- **牌组**：两副标准扑克牌（去掉 3/4/6），共 84 张。包含大王×2、小王×2、普通牌 80 张（A/2/5/7/8/9/10/J/Q/K 四花色各两张）
- **总分**：240 分。分牌：5=5分，10/K/王牌=10分
- **阶段流程**：发牌 → 喊牌（有人拿到10时可喊副主花色）→ 反牌（其他人可用10对/王牌对反牌，改变副主或打正主）→ 出牌（同步出牌制，四人各出一手，胜者得分+领出下一轮）→ 结算
- **牌型**：单张、对子、连队（连续rank的多个对子）。主牌（王牌+所有2+所有10+副主花色的普通牌）> 副主花色牌 > 其他花色
- **出牌限制**：跟牌必须由同花色、同牌型、同对数的牌，否则为"填牌"（默认输，且不能主动出分值牌填）
- **AI 策略**：简单贪心——有10必喊副主、能反必反、首出最大对子、跟牌优先同花色最大

## 代码架构（模块划分）

`erbs.html` 共约 1932 行，按 `// ━━` 注释分隔为 20 个模块：

| 模块 | 位置区域 | 功能 |
|------|---------|------|
| 一 | CSS 变量 + 通用布局 | 暗色主题配色、按钮系统、网格布局 |
| 二 | 音效系统 | Web Audio API 合成音效（tone 函数 + SFX 集合） |
| 三 | 牌组生成 | `makeDeck()` 生成84张牌，`shuffle()` Fisher-Yates 洗牌 |
| 四 | 对子与连队检测 | `isPair()`, `findPairs()`, `findAllSeqs()` |
| 五 | 牌型识别 | `getPlayType()` 识别 single/pair/fill 三种牌型 |
| 六 | 出牌比较 | `comparePlay()` 按花色类别→rank→顺序比较 |
| 七 | 手牌排序 | `sortHand()`：main > ♠ > ♥ > ♣ > ♦，同类别 rank 降序 |
| 八 | 填牌辅助 | `pickFillN()`：按弃子优先级选填牌 |
| 九 | AI 决策 | `aiShout/aiReverse/aiLead/aiFollow` 四个决策函数 |
| 十 | 出牌验证 | `validatePlay()`：三步验证（同花色约束→对子约束→分值牌约束） |
| 十一 | 游戏状态管理 | 全局 `G` 对象 + `startGame()` / `newRound()` 生命周期 |
| 十二 | 发牌阶段 | `doDeals()` 逐张发牌，不暂停（喊牌面板实时更新） |
| 十三 | 反牌阶段 | `enterReverse()` → 轮询 → `finishReverse()` |
| 十四 | 出牌阶段 | 同步出牌制，逐人调度，`commitPlay()` 记录 |
| 十五 | 子轮结算 | `resolveSubRound()` 比较+计分+胜者领下轮 |
| 十六 | 提示系统 | `doHint()` 循环显示合法出牌 |
| 十七 | 局结算 | `endRound()` 计算差值，高分者下局首出 |
| 十八 | 渲染系统 | `mkCard()` 创建牌元素、手牌增量/全量渲染 |
| 十九 | Toast 系统 | 浮动提示，支持金/红/绿三种语义颜色 |
| 二十 | 结算界面 | 得分表 + 胜负 emoji + 再来一局/返回大厅 |

## 关键数据结构

- **牌对象**：`{ suit, rank, joker, jokerType, uid }`
- **游戏状态 `G`**：包含 `phase`, `hands`, `sub`（副主花色）, `shouter`, `revBest`, `revWinner`, `leader`, `roundCat`, `roundType`, `scores` 等。使用 `Object.assign(G, {...})` 重置各局状态（保留 `highScore`）
- **全局变量**：`cumScores`（跨局累积）, `roundNum`, `sel`（选中牌 uid 数组）, `hintList`

## 核心函数

- `cardRank(c, sub)` — 计算牌权值，有 sub 和 无 sub 两套权值表
- `cardCat(c, sub)` — 判断花色类别（main / 具体花色）
- `cardScore(c)` — 计算分值为 0/5/10
- `getPlayType(cards, sub)` — 牌型识别 {type, cat, rank, len}
- `validatePlay(cards, G)` — 人类出牌合法性验证（最复杂的验证逻辑）

## 修改注意事项

- 所有代码在一个文件中，CSS（行9-215）、HTML（行217-351）、JS（行352-1929）
- HTML 使用内联 `onclick` 绑定事件处理器，不走事件委托
- DOM 元素 ID 使用短命名（如 `z-top`, `pt-0`, `hc-2`），修改时注意 CSS 选择器同步
- AI 决策全部是贪心策略，修改出牌逻辑需同时更新 `aiChoosePlay`, `aiLead`, `aiFollow`
