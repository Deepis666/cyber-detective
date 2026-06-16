/**
 * aiEngine.js - AI 引擎
 * 赛博朋克侦探叙事游戏
 *
 * 负责与大模型 API 交互，包括审讯对话、证据组合推理、场景调查。
 * 由 A 封装接口，B 提供 Prompt 模板。
 * Day3 接入，Day1 仅实现骨架和离线模式。
 */

import { getEmotion, getStress, getDialogueHistory as getStateHistory, getState } from './gameState.js';

// ====================
// AI 配置
// ====================
const AI_CONFIG = {
  apiUrl: import.meta.env.VITE_HUNYUAN_API_URL || 'https://hunyuan.tencentcloudapi.com/',
  apiKey: import.meta.env.VITE_HUNYUAN_API_KEY || '',
  model: 'hunyuan-lite',
  maxRetries: 2,
  timeout: 8000
};

// ====================
// 离线模式预设回应
// ====================
const PRESET_RESPONSES = {
  interrogation: {
    suspect_001: {
      calm: [
        { response: "我那天确实在仓库里，你可以去查监控...虽然那一片的监控经常坏。", emotion: "calm", stressDelta: 0, hasContradiction: false, newClue: null },
        { response: "老师对我很好，教了我很多技术。我没有理由伤害他。", emotion: "calm", stressDelta: 0, hasContradiction: false, newClue: null },
        { response: "我只是他的助手，每天的工作就是准备器械、整理数据。其他的我不清楚。", emotion: "calm", stressDelta: 0, hasContradiction: false, newClue: null }
      ],
      nervous: [
        { response: "我...我没必要回答这个问题。你们应该去查查赵明月，她才是和老师有秘密交易的人！", emotion: "nervous", stressDelta: 5, hasContradiction: true, newClue: "赵明月与陈老九有秘密交易" },
        { response: "那块芯片...那只是普通的数据备份！LXB只是...只是内部编号系统！", emotion: "nervous", stressDelta: 10, hasContradiction: true, newClue: null },
        { response: "焊接器？我怎么知道焊接器去哪了？也许老师自己收起来了！", emotion: "nervous", stressDelta: 8, hasContradiction: true, newClue: null }
      ],
      broken: [
        { response: "好...好吧。我承认芯片是我的。但我没有杀师傅！我只是...我只是想保护自己。那些数据如果流出，我会变成替罪羊...", emotion: "broken", stressDelta: -5, hasContradiction: true, newClue: "林小北害怕成为替罪羊" },
        { response: "我确实在诊所里...我看到了师傅在联系买家，他要卖掉涅槃项目的数据。我求他不要这么做，但他根本不听...", emotion: "broken", stressDelta: -10, hasContradiction: true, newClue: "陈老九意图出售涅槃项目数据" },
        { response: "那晚...那晚他跟我说要把我从实验记录里抹掉。三年了，我帮他做了所有的事，他说抹就抹？我的义体里还留着他写的代码...我只是一时...", emotion: "broken", stressDelta: -8, hasContradiction: true, newClue: "林小北因被威胁而失控" }
      ]
    },
    suspect_002: {
      calm: [
        { response: "我是一名企业高管，我的行程都有记录。那晚我在锐义科技总部加班，监控系统可以作证。", emotion: "calm", stressDelta: 0, hasContradiction: false, newClue: null },
        { response: "陈医生只是我偶尔光顾的义体维护师。你知道，企业级别的义体需要定期保养。仅此而已。", emotion: "calm", stressDelta: 0, hasContradiction: false, newClue: null },
        { response: "你可以去查我的所有通讯记录和财务流水。我和陈老九之间没有任何超出正常医患关系的往来。锐义科技不需要通过非法手段获取技术。", emotion: "calm", stressDelta: 0, hasContradiction: false, newClue: null }
      ],
      nervous: [
        { response: "涅槃？我不...我不知道你在说什么。那只是个概念代号，不是真实的项目！", emotion: "nervous", stressDelta: 10, hasContradiction: true, newClue: "赵明月否认涅槃项目" },
        { response: "那份合同...一定是伪造的！你凭什么认为那上面我的签名是真的？", emotion: "nervous", stressDelta: 15, hasContradiction: true, newClue: null },
        { response: "即使我资助过某些...实验研究，那也是合法的企业研发行为。你把黑市医生和企业投资混为一谈，这是诽谤。", emotion: "nervous", stressDelta: 8, hasContradiction: true, newClue: null }
      ],
      broken: [
        { response: "好吧，涅槃是我的项目。但陈老九的死和我没有关系！我只是出资方，动手的事从来不是我做的！你们应该去查他的助手——林小北！", emotion: "broken", stressDelta: -5, hasContradiction: true, newClue: "赵明月承认涅槃项目存在" },
        { response: "我承认我出钱让陈老九做意识覆盖实验。但我没让他死！他拿着实验数据来勒索我...我是说，他想要更多的资金。然后他就死了。这和我没关系。", emotion: "broken", stressDelta: -8, hasContradiction: true, newClue: "赵明月承认出资+勒索关系" }
      ]
    }
  },
  evidence: {
    irrelevant: {
      isRelevant: false,
      insight: "这两件证据之间似乎没有直接的逻辑关联。也许换一种组合方式会有新的发现。",
      unlocksEvidence: null
    },
    relevant_chip_contract: {
      isRelevant: true,
      insight: "加密数据芯片（LXB-003）与撕碎的合同存在关键关联：芯片上的编号'LXB'与林小北名字缩写吻合，而合同中'涅槃'项目的实验日志可能就存储在这块芯片中。赵明月作为出资方的签名进一步证实了这条资金链——林小北执行实验，赵明月提供资源。",
      unlocksEvidence: "evidence_005"
    },
    relevant_interface_welder: {
      isRelevant: true,
      insight: "破损的神经接口上的电磁灼烧痕迹，与工具架上缺失的电磁脉冲焊接器形成物理因果链——焊接器经过改装后可以定向释放高能脉冲，精确烧毁神经接口而不留下外部创伤。这正是陈老九的死因。而能够接触到这把工具的人，只有经常在诊所工作的内部人员。",
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
 * 调用大模型 API
 * @param {string} prompt - 完整的 Prompt
 * @param {Array} history - 对话历史
 * @returns {Promise<Object>} 解析后的 JSON 响应
 */
async function callAPI(prompt, history = []) {
  if (!AI_CONFIG.apiKey) {
    console.warn('[aiEngine] API Key 未配置，使用离线模式');
    return null;
  }

  const messages = [
    { role: 'system', content: prompt },
    ...history
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
        throw new Error(`API 返回错误: ${response.status}`);
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

      // 等待后重试
      await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
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
 *   @prop {string} content - 玩家输入内容或证据 ID
 *   @param {Object} charactersData - 角色数据
 * @returns {Promise<Object>}
 */
export async function interrogateAI(params, charactersData) {
  const { suspectId, action, content } = params;
  const currentStress = getStress(suspectId);
  const currentEmotion = getEmotion(suspectId);
  const history = getStateHistory();

  // 查找角色数据
  const character = charactersData?.characters?.find(c => c.id === suspectId);

  // 尝试调用 AI
  const variables = {
    caseTruth: '陈老九被林小北用改装电磁脉冲注射器击杀，动机是阻止数据出售',
    suspectName: character?.name || suspectId,
    suspectIdentity: character?.identity || '未知',
    suspectPersonality: character?.personality || '未知',
    suspectKnowledge: character?.secretKnowledge || '未知',
    suspectLies: character?.lies?.map(l => l.lieText).join('；') || '无',
    currentStress: String(currentStress),
    currentEmotion,
    dialogueHistory: history.map(h => `${h.role}: ${h.content}`).join('\n'),
    actionType: action,
    playerContent: content
  };

  const prompt = await loadPrompt('interrogation', variables);
  const aiResult = await callAPI(prompt, history);

  if (aiResult && aiResult.response) {
    return aiResult;
  }

  // 离线模式回退
  return fallbackResponse('interrogation', { suspectId, currentEmotion });
}

/**
 * 证据组合推理（AI 接口）
 * @param {Object} params
 *   @prop {string} ev1 - 证据1 ID
 *   @prop {string} ev2 - 证据2 ID
 *   @param {Object} evidenceData - 证据数据
 * @returns {Promise<Object>}
 */
export async function evidenceCombineAI(params, evidenceData) {
  const { ev1, ev2 } = params;
  const state = getState();

  const ev1Data = evidenceData?.evidence?.find(e => e.id === ev1);
  const ev2Data = evidenceData?.evidence?.find(e => e.id === ev2);

  const variables = {
    caseBackground: '陈老九黑市义体医生谋杀案，两名嫌疑人：助手林小北和锐义科技高管赵明月',
    obtainedEvidence: state.evidenceObtained.join(', '),
    ev1Name: ev1Data?.name || ev1,
    ev1Desc: ev1Data?.description || '无描述',
    ev2Name: ev2Data?.name || ev2,
    ev2Desc: ev2Data?.description || '无描述'
  };

  const prompt = await loadPrompt('evidenceCombine', variables);
  const aiResult = await callAPI(prompt);

  if (aiResult && aiResult.insight) {
    return aiResult;
  }

  // 离线模式回退
  return fallbackResponse('evidence', { ev1, ev2 });
}

/**
 * 场景调查（轻量 AI 接口，可选）
 * @param {Object} params
 * @returns {Promise<Object>}
 */
export async function investigateAI(params) {
  // Day1 骨架，Day3 实现
  return {
    description: '你仔细调查了周围的环境，没有发现特别之处。',
    foundEvidence: [],
    atmosphere: '空气中弥漫着电子设备的热量。'
  };
}

/**
 * 生成结局文本（AI 接口）
 * @param {Object} params
 * @returns {Promise<Object>}
 */
export async function generateEndingAI(params) {
  // Day1 骨架，Day4 实现
  return {
    endingText: '案件终于落下帷幕...',
    epilogue: '新香港下城区的霓虹灯依旧闪烁。'
  };
}

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
      // 随机选择一条预设回应
      const idx = Math.floor(Math.random() * presetPool.length);
      return presetPool[idx];
    }

    // 通用回退
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
    description: '调查未发现异常。',
    foundEvidence: [],
    atmosphere: '安静。'
  };
}

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
