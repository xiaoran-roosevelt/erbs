# 二百四 HTML → 微信小程序 转换报告

**日期**: 2026-05-12  
**源文件**: `erbs.html` (1932行，单文件HTML扑克牌游戏，已归档于 `v0.1-web` tag)  
**当前**: 纯微信小程序项目（根目录即小程序项目）

---

## 转换概述

将原桌面端单文件HTML扑克牌游戏《二百四》完整迁移为微信小程序，适配16:9手机竖屏。游戏逻辑保持不动，渲染层和交互层完全重写。

## 文件变更

### 新增

| 文件 | 说明 |
|------|------|
| `CLAUDE.md` | 项目文档，供AI辅助开发使用 |
| `erbs-mp/app.js` | 小程序入口，全局数据（跨局累计分） |
| `erbs-mp/app.json` | 页面注册，自定义导航栏配置 |
| `erbs-mp/app.wxss` | 全局主题变量（暗色CSS变量系统） |
| `erbs-mp/project.config.json` | 微信开发者工具项目配置 |
| `erbs-mp/sitemap.json` | 站点地图配置 |
| `erbs-mp/pages/game/game.js` | 主页面逻辑（状态管理 + 生命周期 + 游戏流程控制） |
| `erbs-mp/pages/game/game.wxml` | WXML模板（大厅/游戏面板/结算界面三段式） |
| `erbs-mp/pages/game/game.wxss` | 页面样式（rpx单位手机适配） |
| `erbs-mp/pages/game/game.json` | 页面配置（自定义组件注册） |
| `erbs-mp/components/playing-card/playing-card.js` | 可复用卡牌组件逻辑 |
| `erbs-mp/components/playing-card/playing-card.wxml` | 卡牌组件模板（正面/背面/4种尺寸） |
| `erbs-mp/components/playing-card/playing-card.wxss` | 卡牌组件样式 |
| `erbs-mp/components/playing-card/playing-card.json` | 卡牌组件配置 |
| `erbs-mp/utils/game-logic.js` | 纯游戏逻辑（模块3-10，19个导出函数） |
| `erbs-mp/utils/audio.js` | WAV数据URI音效系统（7种音效） |

### 修改

无（原 `erbs.html` 保持不变）

## 架构对比

| 维度 | 原HTML | 微信小程序 |
|------|--------|-----------|
| 文件数 | 1 | 15 |
| 渲染方式 | 直接DOM操作 | 数据驱动（setData + WXML绑定） |
| 布局单位 | px（桌面端） | rpx（750rpx=屏宽，手机适配） |
| 音效 | Web Audio API oscillator | WAV数据URI + wx.createInnerAudioContext |
| 事件 | onclick属性 | bindtap事件 |
| 列表渲染 | appendChild循环 | wx:for |
| 条件显示 | classList.add('hide') | wx:if / wx:elif |
| 组件化 | 无 | playing-card自定义组件 |

## 关键技术决策

1. **单页面架构**: 大厅/游戏/结算三段通过phase状态切换，避免页面跳转延迟
2. **两层状态分离**: `this.G`存权威游戏状态（不在data中），`this.data`仅存展示数据，减少setData开销
3. **playing-card组件化**: 牌在4个玩家区+中央出牌区5处复用，组件封装尺寸/朝向/状态
4. **scroll-view水平手牌**: 21张牌无法在375px屏宽平铺，水平滚动是移动端标准做法
5. **WAV数据URI**: 替代Web Audio API，7个音效约10-50KB，纯JS端生成

## 手机布局方案

```
┌──────────────────────────┐
│  顶栏 (标题 + 分数胶囊)    │  64rpx
├──────────────────────────┤
│     AI二 (顶位)           │  112rpx
│  名牌 · 手牌数 · 小背面牌   │
├──────────────────────────┤
│ A │    中央区域          │ A │
│ I │  状态栏 + 出牌展示    │ I │
│ 三 │  CSS Grid 2列      │ 一 │
│   │  喊牌/反牌浮层       │   │
├──────────────────────────┤
│     你 (底位)             │  ~330rpx
│  名牌 · 操作栏 · 水平滚动  │
│  手牌 76×108rpx, 点击选中  │
└──────────────────────────┘
```

卡牌尺寸:
- 人类手牌: 76×108rpx
- 中央出牌展示: 64×92rpx
- AI顶部牌: 32×48rpx
- AI侧面牌: 48×32rpx

## 代码行数统计

| 文件 | 行数 |
|------|------|
| `utils/game-logic.js` | ~400 |
| `utils/audio.js` | ~160 |
| `pages/game/game.js` | ~700 |
| `pages/game/game.wxml` | ~160 |
| `pages/game/game.wxss` | ~280 |
| `components/playing-card/*` | ~150 |
| 配置/入口文件 | ~60 |
| **总计** | **~1910** |

与原始 `erbs.html`（1932行）规模相当。

## 使用方式

1. 打开微信开发者工具
2. 导入 `erbs-mp/` 目录
3. 编译运行（模拟器或真机预览）
