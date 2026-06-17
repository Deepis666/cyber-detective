/**
 * aiEngine.js - AI 引擎
 * 赛博朋克侦探叙事游戏
 *
 * 负责与大模型 API 交互，包括审讯对话、证据组合推理、场景调查。
 * 由 A 封装接口，B 提供 Prompt 模板。
 * Day3: 完整接入混元 OpenAI 兼容 API + 离线回退。
 */

import { getEmotion, getStress, getDialogueHistory as getStateHistory, getState, addDialogueToHistory, addStress, addScore, setFlag, addEvidence } from './gameState.js';

// ====================
// AI 配置
// ====================
const AI_CONFIG = {
  apiUrl: import.meta.env.VITE_HUNYUAN_API_URL || 'https://api.hunyuan.cloud.tencent.com/v1/chat/completions',
  apiKey: import.meta.env.VITE_HUNYUAN_API_KEY || '',
  model: 'hunyuan-lite',
  maxRetries: 2,
  timeout: 12000
};

// ====================
// 数据缓存（由 main.js 注入）
// ====================
let _charactersData = null;
let _evidenceData = null;
let _caseData = null;

/**
 * 初始化 AI 引擎（注入游戏数据）
 * @param {Object} charactersData
 * @param {Object} evidenceData
 * @param {Object} caseData
 */
export function initAIEngine(charactersData, evidenceData, caseData) {
  _charactersData = charactersData;
  _evidenceData = evidenceData;
  _caseData = caseData;
  console.log('[aiEngine] AI 引擎初始化完成, API Key:', AI_CONFIG.apiKey ? '已配置' : '未配置（将使用离线模式）');
}

/**
 * 动态切换案件上下文（多案件扩展）
 * 在 startCase 时调用，更新 AI 引擎当前引用的案件数据
 * @param {Object} caseData - 新案件数据
 */
export function setAIEngineCaseContext(caseData) {
  _caseData = caseData;
  console.log(`[aiEngine] 案件上下文已切换: ${caseData?.caseId || '未知'}`);
}

/**
 * 检查 API 是否可用
 * @returns {boolean}
 */
export function isAPIAvailable() {
  return !!AI_CONFIG.apiKey;
}

// ====================
// 离线模式预设回应
// ====================
const PRESET_RESPONSES = {
  interrogation: {
    suspect_001: {
      calm: [
        { response: "我那天确实在仓库里，你可以去查监控...虽然那一片的监控经常坏。", emotion: "calm", stressDelta: 0, hasContradiction: false, newClue: null },
        { response: "老师对我很好，教了我很多技术。我没有理由伤害他。", emotion: "calm", stressDelta: 0, hasContradiction: false, newClue: null },
        { response: "我只是他的助手，每天的工作就是准备器械、整理数据。其他的我不清楚。", emotion: "calm", stressDelta: 0, hasContradiction: false, newClue: null },
        { response: "师傅的病人很多，来来往往的人不少。我可没留意谁来了谁走了。", emotion: "calm", stressDelta: 0, hasContradiction: false, newClue: null }
      ],
      nervous: [
        { response: "我...我没必要回答这个问题。你们应该去查查赵明月，她才是和老师有秘密交易的人！", emotion: "nervous", stressDelta: 5, hasContradiction: true, newClue: "赵明月与陈老九有秘密交易" },
        { response: "那块芯片...那只是普通的数据备份！LXB只是...只是内部编号系统！", emotion: "nervous", stressDelta: 10, hasContradiction: true, newClue: null },
        { response: "焊接器？我怎么知道焊接器去哪了？也许老师自己收起来了！", emotion: "nervous", stressDelta: 8, hasContradiction: true, newClue: null },
        { response: "你们别一直盯着我看...我没做错什么！那些数据都是师傅自己的！", emotion: "nervous", stressDelta: 6, hasContradiction: true, newClue: null }
      ],
      broken: [
        { response: "好...好吧。我承认芯片是我的。但我没有杀师傅！我只是...我只是想保护自己。那些数据如果流出，我会变成替罪羊...", emotion: "broken", stressDelta: -5, hasContradiction: true, newClue: "林小北害怕成为替罪羊" },
        { response: "我确实在诊所里...我看到了师傅在联系买家，他要卖掉涅槃项目的数据。我求他不要这么做，但他根本不听...", emotion: "broken", stressDelta: -10, hasContradiction: true, newClue: "陈老九意图出售涅槃项目数据" },
        { response: "焊接器是我拿的...但不是用来杀人的！我只是...只是想用来改装一个信号屏蔽器...我害怕那些数据泄露...", emotion: "broken", stressDelta: -8, hasContradiction: true, newClue: "林小北拿走了焊接器" }
      ]
    },
    suspect_002: {
      calm: [
        { response: "我是一名企业高管，我的行程都有记录。那晚我在锐义科技总部加班，监控系统可以作证。", emotion: "calm", stressDelta: 0, hasContradiction: false, newClue: null },
        { response: "陈医生只是我偶尔光顾的义体维护师。你知道，企业级别的义体需要定期保养。仅此而已。", emotion: "calm", stressDelta: 0, hasContradiction: false, newClue: null },
        { response: "我对下城区的事情没什么兴趣。我的生活圈子在尖塔区，和这里的世界完全不同。", emotion: "calm", stressDelta: 0, hasContradiction: false, newClue: null }
      ],
      nervous: [
        { response: "涅槃？我不...我不知道你在说什么。那只是个概念代号，不是真实的项目！", emotion: "nervous", stressDelta: 10, hasContradiction: true, newClue: "赵明月否认涅槃项目" },
        { response: "那份合同...一定是伪造的！你凭什么认为那上面我的签名是真的？", emotion: "nervous", stressDelta: 15, hasContradiction: true, newClue: null },
        { response: "我的义眼闪烁只是散热系统的正常运作，和情绪没关系。别用那种眼神看我。", emotion: "nervous", stressDelta: 5, hasContradiction: true, newClue: null }
      ],
      broken: [
        { response: "好吧，涅槃是我的项目。但陈老九的死和我没有关系！我只是出资方，动手的事从来不是我做的！你们应该去查他的助手——林小北！", emotion: "broken", stressDelta: -5, hasContradiction: true, newClue: "赵明月承认涅槃项目存在" },
        { response: "是...我让陈老九做实验。但'意识覆盖'是技术突破，不是犯罪！只要不被人发现...可那个蠢货竟然要把数据卖掉！我没有杀他，但我承认...我松了一口气。", emotion: "broken", stressDelta: -10, hasContradiction: true, newClue: "赵明月在陈老九死后感到如释重负" }
      ]
    },
    suspect_003: {
      calm: [
        { response: "陈老九是我的老主顾了，我们合作有五年多了。他这人手艺不错，就是嘴巴不太严。", emotion: "calm", stressDelta: 0, hasContradiction: false, newClue: null },
        { response: "下城区的生意嘛，你懂的，大家都在灰色地带讨生活。但我从没碰过带血的钱。", emotion: "calm", stressDelta: 0, hasContradiction: false, newClue: null },
        { response: "你是说那批神经接口？就是普通的二手货，我进货都有记录的。不信你自己看。", emotion: "calm", stressDelta: 0, hasContradiction: false, newClue: null }
      ],
      nervous: [
        { response: "军...军用级？你开玩笑吧？那种东西我一个小小的零件贩子怎么可能搞得到？", emotion: "nervous", stressDelta: 10, hasContradiction: true, newClue: "钱一鸣否认经手军用级零件" },
        { response: "陈老九要的那批货...好吧，确实有点特殊。但他只说是给大客户备的，我哪知道他要用来干嘛？", emotion: "nervous", stressDelta: 8, hasContradiction: true, newClue: "陈老九曾向钱一鸣订购特殊神经接口组件" },
        { response: "新人类集团？我没和他们打过交道...好吧，偶尔有几个跑单帮的业务员找我拿过货，但就这些。", emotion: "nervous", stressDelta: 6, hasContradiction: true, newClue: "钱一鸣与新人类集团有间接业务往来" }
      ],
      broken: [
        { response: "行，我认了。那批货是从新人类的废品仓里流出来的——军用级神经接口组件。陈老九给的价钱让我没法拒绝...但我真不知道他要用那个杀人！我只是个做买卖的！", emotion: "broken", stressDelta: -5, hasContradiction: true, newClue: "钱一鸣承认提供军用级零件" },
        { response: "他死前两天来找过我，说需要一批'特殊规格'的电磁脉冲模块。我告诉他那种东西被盯得很紧...但他执意要，还给了我双倍的钱。我...我当时缺钱，就没多问。", emotion: "broken", stressDelta: -10, hasContradiction: true, newClue: "陈老九案发前向钱一鸣购买电磁脉冲模块" }
      ]
    }
  },
  evidence: {
    irrelevant: {
      isRelevant: false,
      insight: "这两件证据之间似乎没有直接的逻辑关联。也许换一种组合方式会有新的发现。",
      unlocksEvidence: null
    }
  }
};

// ====================
// Prompt 模板加载
// ====================

/**
 * 加载 Prompt 模板并进行变量替换
 * @param {string} templateName - 模板名称
 * @param {Object} variables - 变量键值对
 * @returns {Promise<string>} 替换后的 Prompt 文本
 */
async function loadPrompt(templateName, variables) {
  try {
    const response = await fetch(`/prompts/${templateName}.txt`);
    if (!response.ok) throw new Error(`加载模板失败: ${templateName}`);
    let template = await response.text();

    // 替换变量
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return variables[key] !== undefined ? variables[key] : match;
    });
  } catch (e) {
    console.error('[aiEngine] 加载 Prompt 模板失败:', e);
    return '';
  }
}

// ====================
// API 调用封装
// ====================

/**
 * 调用大模型 API（混元 OpenAI 兼容接口）
 * @param {string} prompt - 完整的 system prompt
 * @param {Array} history - 对话历史 [{role, content}]
 * @returns {Promise<Object|null>} 解析后的 JSON 响应，失败返回 null
 */
async function callAPI(prompt, history = []) {
  if (!AI_CONFIG.apiKey) {
    console.warn('[aiEngine] API Key 未配置，使用离线模式');
    return null;
  }

  const messages = [
    { role: 'system', content: prompt },
    ...history.slice(-10) // 保留最近10条对话作为上下文
  ];

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AI_CONFIG.timeout);

  for (let attempt = 0; attempt <= AI_CONFIG.maxRetries; attempt++) {
    try {
      const response = await fetch(AI_CONFIG.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${AI_CONFIG.apiKey}`
        },
        body: JSON.stringify({
          model: AI_CONFIG.model,
          messages,
          temperature: 0.7,
          max_tokens: 500,
          response_format: { type: 'json_object' }
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        throw new Error(`API 返回错误 ${response.status}: ${errText.slice(0, 200)}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        throw new Error('API 返回内容为空');
      }

      // 尝试解析 JSON
      try {
        return JSON.parse(content);
      } catch {
        // 尝试从文本中提取 JSON
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
        throw new Error('无法解析 API 返回的 JSON');
      }

    } catch (e) {
      console.warn(`[aiEngine] API 调用失败 (尝试 ${attempt + 1}/${AI_CONFIG.maxRetries + 1}):`, e.message);

      if (attempt === AI_CONFIG.maxRetries) {
        console.warn('[aiEngine] API 调用全部失败，使用离线模式');
        return null;
      }

      // 指数退避重试
      await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
    }
  }

  clearTimeout(timeoutId);
  return null;
}

// ====================
// Public API
// ====================

/**
 * 审讯嫌疑人（核心 AI 接口）
 * @param {Object} params
 *   @prop {string} suspectId - 嫌疑人 ID
 *   @prop {string} action - 'question' | 'present_evidence' | 'pressure'
 *   @prop {string} content - 玩家输入内容或证据描述
 * @returns {Promise<Object>}
 */
export async function interrogateAI(params) {
  const { suspectId, action, content } = params;
  const currentStress = getStress(suspectId);
  const currentEmotion = getEmotion(suspectId);
  const history = getStateHistory();

  // 查找角色数据
  const character = _charactersData?.characters?.find(c => c.id === suspectId);

  // 构建变量
  const caseTruth = _caseData?.truth
    ? `凶手：${_caseData.truth.killerId === suspectId ? '就是此嫌疑人' : '不是此嫌疑人'}。动机：${_caseData.truth.motive}。凶器：${_caseData.truth.weapon}。时间线：${_caseData.truth.timeline}`
    : '陈老九被林小北用改装电磁脉冲注射器击杀';

  const variables = {
    caseTruth,
    suspectName: character?.name || suspectId,
    suspectIdentity: character?.identity || '未知',
    suspectPersonality: character?.personality || '未知',
    suspectKnowledge: character?.secretKnowledge || '未知',
    suspectLies: character?.lies?.map(l => `关于"${l.topic}"：${l.lieText}（真相：${l.truthText}，反证：${l.counterEvidence}）`).join('\n') || '无',
    currentStress: String(currentStress),
    currentEmotion,
    dialogueHistory: history.slice(-10).map(h => `${h.role === 'user' ? '侦探' : character?.name || '嫌疑人'}: ${h.content}`).join('\n'),
    actionType: action,
    playerContent: content
  };

  // 显示 AI 思考动画
  showAIThinking(true);

  const prompt = await loadPrompt('interrogation', variables);
  const aiResult = await callAPI(prompt, history.slice(-10).map(h => ({ role: h.role, content: h.content })));

  showAIThinking(false);

  if (aiResult && aiResult.response) {
    // 校验 AI 返回的数据完整性
    return _validateInterrogationResult(aiResult, suspectId);
  }

  // 离线模式回退
  return fallbackResponse('interrogation', { suspectId, currentEmotion });
}

/**
 * 证据组合推理（AI 接口）
 * @param {Object} params
 *   @prop {string} ev1 - 证据1 ID
 *   @prop {string} ev2 - 证据2 ID
 * @returns {Promise<Object>}
 */
export async function evidenceCombineAI(params) {
  const { ev1, ev2 } = params;
  const state = getState();

  const ev1Data = _evidenceData?.evidence?.find(e => e.id === ev1);
  const ev2Data = _evidenceData?.evidence?.find(e => e.id === ev2);

  const variables = {
    caseBackground: `案件：${_caseData?.title || '霓虹公寓谋杀案'}。${_caseData?.setting?.background || ''}`,
    obtainedEvidence: state.evidenceObtained.map(id => {
      const ev = _evidenceData?.evidence?.find(e => e.id === id);
      return ev ? `${ev.name}(${ev.type})` : id;
    }).join('、'),
    ev1Name: ev1Data?.name || ev1,
    ev1Desc: ev1Data?.description || '无描述',
    ev2Name: ev2Data?.name || ev2,
    ev2Desc: ev2Data?.description || '无描述'
  };

  showAIThinking(true);

  const prompt = await loadPrompt('evidenceCombine', variables);
  const aiResult = await callAPI(prompt);

  showAIThinking(false);

  if (aiResult && aiResult.insight !== undefined) {
    // 检查是否解锁了新证据
    if (aiResult.unlocksEvidence && !state.evidenceObtained.includes(aiResult.unlocksEvidence)) {
      addEvidence(aiResult.unlocksEvidence);
    }
    return _validateEvidenceCombineResult(aiResult);
  }

  // 离线模式回退
  return fallbackResponse('evidence', { ev1, ev2 });
}

/**
 * 场景调查（AI 接口）
 * @param {Object} params
 *   @prop {string} sceneId - 场景 ID
 *   @prop {string} action - 玩家调查动作
 * @returns {Promise<Object>}
 */
export async function investigateAI(params) {
  const { sceneId, action } = params;
  const state = getState();

  const scene = _caseData?.scenes?.[sceneId];

  const variables = {
    caseBackground: `案件：${_caseData?.title || '霓虹公寓谋杀案'}。${_caseData?.setting?.background || ''}`,
    sceneName: scene?.name || sceneId,
    sceneDescription: scene?.description || '一间阴暗的房间',
    playerAction: action,
    obtainedEvidence: state.evidenceObtained.map(id => {
      const ev = _evidenceData?.evidence?.find(e => e.id === id);
      return ev ? ev.name : id;
    }).join('、')
  };

  showAIThinking(true);

  const prompt = await loadPrompt('sceneInvestigate', variables);
  const aiResult = await callAPI(prompt);

  showAIThinking(false);

  if (aiResult && aiResult.description) {
    // 如果 AI 发现了证据，自动添加
    if (aiResult.foundEvidence && Array.isArray(aiResult.foundEvidence)) {
      aiResult.foundEvidence.forEach(evId => {
        addEvidence(evId);
      });
    }
    return aiResult;
  }

  // 离线模式回退
  return fallbackResponse('investigate', { sceneId, action });
}

/**
 * 生成结局文本（AI 接口，Day4 完善）
 * @param {Object} params
 * @returns {Promise<Object>}
 */
export async function generateEndingAI(params) {
  // Day4 完整实现
  return {
    endingText: '案件终于落下帷幕...',
    epilogue: '新香港下城区的霓虹灯依旧闪烁。'
  };
}

// ====================
// 离线模式回退
// ====================

/**
 * 离线模式回退
 * @param {string} type - 'interrogation' | 'evidence' | 'investigate'
 * @param {Object} context
 * @returns {Object} 与 AI 返回格式一致的对象
 */
export function fallbackResponse(type, context) {
  if (type === 'interrogation') {
    const { suspectId, currentEmotion } = context;
    const emotion = currentEmotion || 'calm';
    const presetPool = PRESET_RESPONSES.interrogation[suspectId]?.[emotion];

    if (presetPool && presetPool.length > 0) {
      const idx = Math.floor(Math.random() * presetPool.length);
      return presetPool[idx];
    }

    return {
      response: "我没什么好说的。你们应该去查查其他人。",
      emotion: "calm",
      stressDelta: 0,
      hasContradiction: false,
      newClue: null
    };
  }

  if (type === 'evidence') {
    return PRESET_RESPONSES.evidence.irrelevant;
  }

  return {
    description: '你仔细调查了周围的环境，没有发现特别的线索。',
    foundEvidence: [],
    atmosphere: '空气中弥漫着电子设备的热量。'
  };
}

// ====================
// 数据校验
// ====================

function _validateInterrogationResult(result, suspectId) {
  return {
    response: String(result.response || '...'),
    emotion: ['calm', 'nervous', 'broken'].includes(result.emotion) ? result.emotion : 'calm',
    stressDelta: Number(result.stressDelta) || 0,
    hasContradiction: Boolean(result.hasContradiction),
    newClue: result.newClue || null
  };
}

function _validateEvidenceCombineResult(result) {
  return {
    isRelevant: Boolean(result.isRelevant),
    insight: String(result.insight || '无法确定关联性。'),
    unlocksEvidence: result.unlocksEvidence || null
  };
}

// ====================
// UI 辅助
// ====================

/**
 * 显示/隐藏 AI 思考动画
 * @param {boolean} show
 */
export function showAIThinking(show) {
  const el = document.getElementById('ai-thinking');
  if (!el) return;

  if (show) {
    el.classList.remove('hidden');
  } else {
    el.classList.add('hidden');
  }
}
