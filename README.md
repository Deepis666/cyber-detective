# 🕵️ 霓虹侦探 · NEON DETECTIVE

> AI 驱动的赛博朋克侦探叙事游戏 | 腾讯云黑客松 2025 参赛作品

## 🎮 游戏简介

《霓虹侦探》是一款以 DeepSeek 大模型驱动叙事的赛博朋克侦探推理游戏。玩家扮演 2045 年新上海的侦探，通过场景调查收集线索、自由组合证据触发 AI 推理、对嫌疑人进行审讯施压戳穿谎言，最终揭露真相。

### 核心玩法

**① 场景调查** — 在案发现场移动，点击热点收集线索

**② 证据推理** — 自由组合两件证据，AI 分析逻辑关联，推理成功解锁新证据

**③ AI 实时审讯** — 对嫌疑人提问/施压/出示证据，嫌疑人有三档情绪状态：
- 😐 冷静 (0-29)：滴水不漏
- 😰 紧张 (30-69)：言辞闪烁
- 😱 崩溃 (70-100)：露出破绽

**④ 结局判定** — 根据评分决定结局（≥120 好结局 / 60-119 普通结局 / <60 坏结局）

### 核心亮点

- 🌟 **AI 双轨引擎**：在线模式 DeepSeek API 实时生成对话，离线模式无 API Key 也能完整运行
- 🌟 **谎言戳穿闭环**：每个嫌疑人有隐藏谎言，找到对应证据戳穿谎言，压力值飙升
- 🌟 **多案件主线叙事**：4 个独立案件串联，前 3 案全部好结局解锁隐藏案件
- 🌟 **赛博朋克沉浸式 UI**：霓虹光效主题、打字机对话、高压审讯心理面板、原创 BGM

---

## 🚀 快速体验

### 方式一：CNB 一键体验（推荐）

点击仓库页面的**橙色「云原生开发」按钮**，系统自动构建并直接打开游戏预览页面，无需任何配置。

### 方式二：本地运行

```bash
cd cyber-detective
npm install
npm run dev
```

浏览器打开 `http://localhost:3000` 即可游玩。

### 方式三：构建部署

```bash
cd cyber-detective
npm install
npm run build
serve dist -p 3000
```

---

## 🛠️ 技术架构

| 项目 | 详情 |
|------|------|
| 技术栈 | Vanilla JS + Vite + CSS 纯前端 |
| AI 模型 | DeepSeek Chat (V3) |
| 代码行数 | ~3000+ 行 |
| 核心模块 | gameState / sceneManager / evidenceSystem / dialogueSystem / aiEngine / audioManager / plotManager |
| 案件数量 | 4 个（含 1 个隐藏案件） |

### 项目结构

```
cyber-detective/
├── index.html          # 入口页面
├── main.js             # 主逻辑入口
├── style.css           # 赛博朋克霓虹主题样式
├── modules/            # 8 个核心模块
├── data/               # 案件/角色/证据/对话数据
├── prompts/            # 5 个 AI Prompt 模板
├── assets/             # 图片/音频资源
├── vite.config.js      # Vite 构建配置
└── package.json
```

### AI 配置

游戏支持在线/离线双轨运行：

- **在线模式**：在 `cyber-detective/.env` 中配置 DeepSeek API Key
  ```
  DEEPSEEK_API_KEY=your_api_key_here
  ```
- **离线模式**：无需 API Key，自动使用预设对话池，完整可玩

---

## 📖 游戏世界观

2045 年的新上海，霓虹灯与全息广告淹没街道，科技公司掌控一切。一名侦探在"霓虹公寓"接到离奇谋杀案，随着调查深入，背后牵扯出更大的阴谋……

4 个独立案件通过"事务所 Hub"串联，结局由 AI 根据玩家表现动态生成。

---

## 📄 开源地址

- **GitHub**: https://github.com/Deepis666/cyber-detective
- **CNB**: https://cnb.cool/vbgame-2026/CyberDetective

---

## 👥 团队

**乡下人** — 腾讯黑客松游戏开发参赛队伍

---

*本项目为腾讯云黑客松 2025 参赛作品，基于 DeepSeek 大模型驱动的赛博朋克侦探推理游戏。*
