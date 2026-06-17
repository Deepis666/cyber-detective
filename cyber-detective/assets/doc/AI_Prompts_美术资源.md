# AI 绘图 Prompt 模板 — 赛博朋克侦探游戏美术资源

> 用于 `nano-banana-pro` (AI绘图) 或 `openai-image-gen` (批量绘图)
> 需要 API Key: `GEMINI_API_KEY` 或 `OPENAI_API_KEY`

---

## 一、角色立绘

### 1. 林小北 (suspect_001) — 死者助手

**角色设定**：25岁，出身下城区贫民家庭，义体改造率40%（基础感知增强）。沉默寡言，内向谨慎。跟随陈老九学习义体技术3年。

**Prompt（中文）**：
```
赛博朋克风格角色立绘，一位25岁的亚洲男性，身材瘦削，穿着破旧的深色工装服。
他的右眼是发光的青色机械义眼，左臂有外露的金属接口。
表情阴沉，眼神回避但偶尔直视，带着底层人的倔强和隐藏的不安。
背景是昏暗的霓虹灯光下的地下诊所，紫色和青色的霓虹光从侧面打在脸上。
高品质游戏立绘，半身像，正面微侧，暗调光影，精细的义体细节，赛博朋克美学，8k渲染
```

**Prompt（英文，OpenAI推荐）**：
```
Cyberpunk character portrait, a 25-year-old Asian male, lean build, wearing worn dark work clothes.
His right eye is a glowing cyan cybernetic implant, left arm has exposed metal ports.
Brooding expression, evasive gaze but occasionally direct eye contact, showing defiance and hidden anxiety of someone from the lower class.
Background: dim neon-lit underground clinic, purple and cyan neon light casting from the side.
High-quality game portrait, half-body, front-facing slightly turned, low-key lighting, detailed cybernetic details, cyberpunk aesthetic, 8k render
```

**保存路径**：`assets/characters/lin_xiaobei.png`

---

### 2. 赵明月 (suspect_002) — 义体公司高管

**角色设定**：35岁，锐义科技高级研发主管，义体改造率75%（增强型视觉义眼和神经加速器）。穿着考究，企业精英气场。

**Prompt（中文）**：
```
赛博朋克风格角色立绘，一位35岁的亚洲女性，精明干练，穿着高级定制的深色西装外套，内搭发光的神经接口背心。
她的双眼是锐义科技的高级视觉义眼，瞳孔发出淡金色的微光。
表情冷静而强势，嘴角带着轻蔑的微笑，但眼神深处有一丝冷酷。
背景是高科技企业办公室的全息投影窗外，城市霓虹夜景，冷色调与暖色点缀对比。
高品质游戏立绘，半身像，正面微侧，精英气质，精细的义体细节，赛博朋克美学，8k渲染
```

**Prompt（英文）**：
```
Cyberpunk character portrait, a 35-year-old Asian woman, sharp and capable, wearing a high-end tailored dark blazer over a glowing neural interface vest.
Her eyes are advanced corporate cybernetic optics from "Ruiyi Tech", pupils emitting faint golden light.
Cold and commanding expression, slightly contemptuous smirk, but with underlying cruelty in her gaze.
Background: high-tech corporate office with holographic window showing city neon nightscape, cold tones with warm accents.
High-quality game portrait, half-body, front-facing slightly turned, elite demeanor, detailed cybernetic details, cyberpunk aesthetic, 8k render
```

**保存路径**：`assets/characters/zhao_mingyue.png`

---

## 二、场景背景

### 1. 手术台区域 (scene_body) — 犯罪现场

**Prompt（中文）**：
```
赛博朋克风格犯罪现场背景，一间昏暗的地下诊所手术室。
中央是一张金属手术椅，周围散落着各种义体手术工具和零件。
手术灯从上方照射出惨白的光线，与周围的紫色和青色霓虹灯光形成强烈对比。
地板上有拖拽的痕迹，空气中仿佛弥漫着焦糊味。
墙壁上有简陋的金属面板和闪烁的监控屏幕，整体氛围阴森而紧张。
宽屏游戏背景，16:9比例，暗调光影，高细节，赛博朋克美学，电影级构图
```

**Prompt（英文）**：
```
Cyberpunk crime scene background, a dim underground clinic operating room.
Center: a metal surgical chair surrounded by scattered cybernetic surgery tools and parts.
Surgical lamp casting harsh white light from above, contrasting with purple and cyan neon ambient lighting.
Floor with drag marks, atmosphere suggesting scorched odors.
Walls with crude metal panels and flickering monitoring screens. Overall mood: sinister and tense.
Widescreen game background, 16:9 ratio, low-key lighting, high detail, cyberpunk aesthetic, cinematic composition
```

**保存路径**：`assets/bg/scene_body.png`

---

### 2. 工作台区域 (scene_desk) — 诊所工作台

**Prompt（中文）**：
```
赛博朋克风格室内场景背景，一间地下诊所的工作室。
中央是一张堆满义体零件、工具和电子设备的旧木工作台，上面有一台改装过的终端机，屏幕发出幽蓝的微光。
桌角有一个碎纸篓，旁边的工具架上缺少了一件工具。
墙上有霓虹灯管（青色和品红色），照亮了整个房间。
背景中可以看到 shelves 上摆放的各种义体零件和药品容器。
宽屏游戏背景，16:9比例，暗调光影，高细节，赛博朋克美学，电影级构图
```

**Prompt（英文）**：
```
Cyberpunk interior scene background, an underground clinic workshop.
Center: an old wooden workbench cluttered with cybernetic parts, tools, and electronic devices. A modified terminal on the desk emits faint blue glow.
Corner: a trash bin with shredded paper. Tool rack on the wall with one tool missing.
Neon tubes on walls (cyan and magenta) illuminate the room.
Background shelves with various cybernetic parts and medicine containers.
Widescreen game background, 16:9 ratio, low-key lighting, high detail, cyberpunk aesthetic, cinematic composition
```

**保存路径**：`assets/bg/scene_desk.png`

---

## 三、执行命令

### 使用 nano-banana-pro (AI绘图)

```bash
# 林小北立绘
uv run ~/.workbuddy/skills/skill_2053082421296758784/scripts/generate_image.py \
  --prompt "赛博朋克风格角色立绘，一位25岁的亚洲男性..." \
  --filename "lin_xiaobei.png" \
  --resolution 2K \
  --api-key YOUR_GEMINI_API_KEY

# 赵明月立绘
uv run ~/.workbuddy/skills/skill_2053082421296758784/scripts/generate_image.py \
  --prompt "赛博朋克风格角色立绘，一位35岁的亚洲女性..." \
  --filename "zhao_mingyue.png" \
  --resolution 2K \
  --api-key YOUR_GEMINI_API_KEY

# 手术台场景
uv run ~/.workbuddy/skills/skill_2053082421296758784/scripts/generate_image.py \
  --prompt "赛博朋克风格犯罪现场背景..." \
  --filename "scene_body.png" \
  --resolution 2K \
  --api-key YOUR_GEMINI_API_KEY

# 工作台场景
uv run ~/.workbuddy/skills/skill_2053082421296758784/scripts/generate_image.py \
  --prompt "赛博朋克风格室内场景背景..." \
  --filename "scene_desk.png" \
  --resolution 2K \
  --api-key YOUR_GEMINI_API_KEY
```

### 使用 openai-image-gen (批量绘图)

```bash
# 设置环境变量
export OPENAI_API_KEY=your_key_here

# 运行批量生成（需自定义 prompts）
python3 ~/.workbuddy/skills/skill_2053082508268802048/scripts/gen.py \
  --prompt "Cyberpunk character portrait, 25-year-old Asian male..." \
  --count 4 --size 1536x1024 --quality high \
  --out-dir ./assets/characters
```

---

## 四、风格统一建议

为确保 4 张图风格统一，建议在 Prompt 中固定以下关键词：
- **统一前缀**：`Cyberpunk aesthetic, dark neon-lit, cinematic lighting, 8k render, game background art`
- **色调约束**：`purple and cyan neon color palette, dark atmosphere`
- **参考图**：先生成 1 张最满意的图，用 `--input-image` 进行 img2img 风格迁移

---

*Prompt 模板已就绪，提供 API Key 后可直接执行生成。*
