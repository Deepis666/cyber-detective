# UI + BGM 完成计划与执行报告

## 项目：赛博朋克侦探叙事游戏 (cyber-detective)
## 日期：2026-06-16
## 执行标准：黑客松文档（Day 4 美术&声音资产集成）

---

## 一、已完成内容（✅ 立即可用）

### 1. BGM 音频资源（4条）

| 文件名 | 时长 | 风格 | 场景 |
|--------|------|------|------|
| `bgm_menu.wav` | 25s | 赛博朋克氛围，Cm9和弦，慢速，神秘 | 主菜单 |
| `bgm_investigation.wav` | 20s | 紧张悬疑，D小调，心跳脉冲 | 调查场景 |
| `bgm_interrogation.wav` | 20s | 节奏紧张，滴答时钟，不协和音 | 审讯场景 |
| `bgm_ending.wav` | 15s | 缓慢下行和弦，庄重反思 | 结局画面 |

### 2. 音效资源（5种）

| 文件名 | 时长 | 触发场景 |
|--------|------|----------|
| `sfx_click.wav` | 0.15s | 所有按钮点击 |
| `sfx_evidence.wav` | 1.5s | 获取证据 |
| `sfx_combine.wav` | 1.2s | 组合证据成功 |
| `sfx_contradiction.wav` | 1.5s | 发现矛盾 |
| `sfx_stress.wav` | 1.0s | 压力上升 |

### 3. SVG UI 资源

| 文件名 | 用途 |
|--------|------|
| `ui/favicon.svg` | 网站图标（32x32） |
| `ui/logo.svg` | 游戏Logo（256x256） |
| `bg/scene_body.svg` | 手术台场景背景（1920x1080） |
| `bg/scene_desk.svg` | 工作台场景背景（1920x1080） |

### 4. 代码集成

- [x] `audioManager.js`：路径更新为 `.wav` 格式
- [x] `sceneManager.js`：
  - 导入 `playBGM` / `playSFX`
  - 调查场景切换时播放 `investigation` BGM
  - 审讯场景切换时播放 `interrogation` BGM
  - 结局画面播放 `ending` BGM
  - 按钮点击播放 `click` 音效
  - 获取证据播放 `evidence_obtain` 音效
  - 发现矛盾播放 `contradiction` 音效
  - 组合证据播放 `evidence_combine` 音效
  - 施压时播放 `stress_up` 音效
- [x] `case.json`：场景背景路径更新为 SVG

---

## 二、待完成（需 AI 绘图 API Key）

### 角色立绘（2张）

| 角色 | 路径 | 状态 |
|------|------|------|
| 林小北 | `assets/characters/lin_xiaobei.png` | ❌ 待生成 |
| 赵明月 | `assets/characters/zhao_mingyue.png` | ❌ 待生成 |

### 场景背景（2张，可替换当前SVG）

| 场景 | 路径 | 状态 |
|------|------|------|
| 手术台区域 | `assets/bg/scene_body.png` | ❌ 待生成（SVG已就位） |
| 工作台区域 | `assets/bg/scene_desk.png` | ❌ 待生成（SVG已就位） |

### 配音（2个）

| 角色 | 路径 | 状态 |
|------|------|------|
| 林小北开场白 | `assets/audio/voice_lin_opening.wav` | ❌ 待生成 |
| 赵明月开场白 | `assets/audio/voice_zhao_opening.wav` | ❌ 待生成 |

---

## 三、AI 工具推荐与使用指南

### 已安装技能

| 技能 | 用途 | 状态 |
|------|------|------|
| `nano-banana-pro` (AI绘图) | 文生图（Gemini 3 Pro） | 已安装 |
| `openai-image-gen` (批量绘图) | 批量文生图（OpenAI） | 已安装 |
| `多模态内容生成` (内置) | 视频/3D特效 | 已就绪 |

### 需要安装的额外工具

| 工具 | 用途 | 安装命令 |
|------|------|----------|
| 配音工具 | 角色语音克隆 | 暂无内置技能，建议使用在线TTS或剪映配音 |
| 背景音乐增强 | 更高质量BGM | 建议使用 Suno / Udio / 腾讯音乐AI |

### 执行命令（参考 `AI_Prompts_美术资源.md`）

```bash
# 生成角色立绘（需 GEMINI_API_KEY）
uv run ~/.workbuddy/skills/skill_2053082421296758784/scripts/generate_image.py \
  --prompt "赛博朋克角色立绘，25岁亚洲男性..." \
  --filename "lin_xiaobei.png" --resolution 2K

# 生成场景背景（需 GEMINI_API_KEY）
uv run ~/.workbuddy/skills/skill_2053082421296758784/scripts/generate_image.py \
  --prompt "赛博朋克犯罪现场背景..." \
  --filename "scene_body.png" --resolution 2K
```

---

## 四、风险与替代方案

| 风险 | 替代方案 |
|------|----------|
| 无 API Key 无法生成 AI 图片 | 当前 SVG 背景已可用，立绘可先用剪影/占位图替代 |
| 无配音工具 | 已预留 `voice_*.wav` 路径，可先用文字提示替代 |
| BGM 质量不够高 | 当前程序化音频足够 Demo 使用，可后期替换为 Suno 生成音乐 |
| 部署时音频文件过大 | 可用 ffmpeg 压缩为 MP3：`ffmpeg -i input.wav -codec:a libmp3lame -qscale:a 2 output.mp3` |

---

## 五、下一步行动清单

1. [ ] 提供 `GEMINI_API_KEY` 或 `OPENAI_API_KEY`，生成 4 张 AI 图片
2. [ ] 将生成的 PNG 放入对应目录
3. [ ] 如需替换 SVG 背景，将 `case.json` 中的 `.svg` 改为 `.png`
4. [ ] 生成角色配音（或使用在线 TTS 工具）
5. [ ] 运行 `npm run build` 构建项目
6. [ ] 部署到 CloudStudio / EdgeOne Pages

---

*报告生成完毕。当前已完成 80% 的音频和 UI 基础工作，剩余 20% 为 AI 图片和配音，待 API Key 就绪后可快速完成。*
