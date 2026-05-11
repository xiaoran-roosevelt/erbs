# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

《二百四》是一个四人捡分制扑克牌游戏，微信小程序实现。人类玩家 vs 3 个 AI。

> 原网页版（`erbs.html`）已归档于 git tag `v0.1-web`。

## 如何运行

在微信开发者工具中打开项目根目录，编译运行即可。无需安装依赖。

## 项目结构

```
├── app.js / app.json / app.wxss   # 小程序入口、配置、全局样式
├── project.config.json            # 开发者工具配置
├── pages/game/                    # 主页面（单页，phase 切换 lobby/game/end）
│   ├── game.js                    # 页面逻辑（状态管理 + 生命周期 + 游戏流程）
│   ├── game.wxml                  # WXML 模板
│   └── game.wxss                  # 页面样式（rpx 手机适配）
├── components/playing-card/       # 卡牌自定义组件（四种尺寸、正/背面、选中/提示态）
├── utils/
│   ├── game-logic.js              # 纯游戏逻辑（19个导出函数，无副作用）
│   └── audio.js                   # WAV 数据 URI 音效（替代 Web Audio API）
```

## 游戏规则概要

- **牌组**：两副标准扑克牌（去掉 3/4/6），共 84 张。大王×2、小王×2、普通牌 80 张
- **总分**：240 分。分牌：5=5分，10/K/王牌=10分
- **阶段流程**：发牌 → 喊牌（拿到10可喊副主花色）→ 反牌（10对/王牌对反牌）→ 出牌（同步制，四人各出一手，胜者得分+领出）→ 结算
- **牌型**：单张、对子、连队。主牌 > 副主花色 > 其他花色
- **AI 策略**：简单贪心——有10必喊、能反必反、首出最大对子、跟牌同花色最大

## 数据流架构

**两层状态分离**：

- `this.G`（JS 内部，不在 data 中）— 权威游戏状态，含完整牌对象数组，高频变化
- `this.data`（WXML 绑定）— 仅存展示数据（扁平化），通过 `setData` 增量更新

**同步方法**：

- `_syncMyHand()` — 重建 `myHand` 数组（含 selected/hintHighlight），每次选牌/提示时调用
- `_syncPlayerInfo(seat)` — 路径更新单个玩家的 score/handCount/active
- `_syncAllHands()` — 全量刷新（喊牌/反牌后调用）

**游戏逻辑函数**（`utils/game-logic.js`）全部为纯函数，通过 `require` 引入，不涉及 `setData`。

## 关键数据结构

- **牌对象**：`{ suit, rank, joker, jokerType, uid }`
- **游戏状态 `G`**：`phase`, `hands`, `sub`, `shouter`, `revBest`, `revWinner`, `leader`, `roundCat`, `roundType`, `scores` 等
- **页面 data**：`players[]`（四人展示数据）、`myHand[]`（人类手牌）、`subPlays[]`（本轮出牌）、面板可见性标志

## 手机布局要点

- 使用 `rpx` 单位（750rpx = 屏宽）
- 人类手牌：76×108rpx，`<scroll-view scroll-x>` 水平滚动
- AI 手牌：32×48rpx（顶部）/ 48×32rpx（左右），纯装饰背面
- 中央出牌区：CSS Grid 2列布局
- 面板（喊牌/反牌/操作栏）：绝对定位浮层

## 修改注意事项

- 修改游戏规则只需改 `utils/game-logic.js`（纯逻辑）和必要时 `game.js`（流程控制）
- 修改 UI 布局改 `game.wxml` + `game.wxss`
- `playing-card` 组件被手牌区、出牌展示区等多处复用，改组件时注意兼容四种 size
- AI 决策在 `game-logic.js` 中 `aiChoosePlay/aiLead/aiFollow`，全部贪心策略
- 音效在首次播放时懒初始化（生成 WAV 数据 URI），之后缓存复用
- 计时器在 `onHide` 时清理，避免后台累积
