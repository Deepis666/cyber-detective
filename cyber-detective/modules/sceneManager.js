/**
 * sceneManager.js - 场景管理
 * 赛博朋克侦探叙事游戏
 *
 * 负责场景切换、调查场景热点渲染、审讯场景布局。
 * 场景数据从 data/ 目录加载。
 */

import { setPhase, setCurrentScene, setCurrentSuspect, addEvidence, getFlag, setFlag, getState, addStress, addScore, getStress, getEmotion, setEnding, loadGame, resetState, setGamePhase, getGamePhase, startNewCase, recordCaseResult, checkHiddenCaseUnlock, getCurrentCaseIndex, getCasesResults, getCaseResult, initSuspectStress, isAllMainCasesCompleted, getFinalEndingType, getSettings, updateSettings } from './gameState.js';
import { showDialogue, showDialogueSequence, showOptions, hideDialogueOverlay, showDialogueOverlay, resetDialogueState, isDialogueBusy } from './dialogueSystem.js';
import { getEvidenceData, presentEvidence as evidencePresent, combineEvidence as evidenceCombine, selectEvidence, getSelectedEvidence, clearSelectedEvidence, renderEvidenceBar } from './evidenceSystem.js';
import { interrogateAI, investigateAI, isAPIAvailable, setAIEngineCaseContext, setAIEnabled } from './aiEngine.js';
import { playBGM, playSFX, setMusicEnabled } from './audioManager.js';
import { initPlotManager, getPlotData, getCurrentHubDialogue, getAllNewsFeed, getNextCaseIndex, shouldEnterFinalEnding, getFinalEnding, evaluateBranch, getHubDialogue, getNewsFeed } from './plotManager.js';

// ====================
// 数据缓存
// ====================
let _scenesData = null;
let _caseData = null;          // 当前激活的案件数据
let _evidenceData = null;      // 证据数据（用于结案扣分检查）
let _plotData = null;          // 主线剧情数据
let _caseLoader = null;        // 案件数据加载器（由 main.js 注入）
const _casesCache = {};        // 案件数据缓存 { caseId: caseData }

// 案件文件名映射
const CASE_FILES = ['case_001', 'case_002', 'case_003', 'case_004'];
const CASE_TITLES = ['霓虹公寓谋杀案', '数据深渊', '义体战争', '最后的真相'];

// ====================
// 当前场景热点
// ====================
let _currentHotspots = [];

// Hub 对话延迟播放定时器（可取消，避免离开 Hub 后仍弹出）
let _hubDialogueTimer = null;

// ====================
// DOM 引用
// ====================
let _elements = {};

// ====================
// 初始化
// ====================

/**
 * 初始化场景管理器
 * @param {Object} scenesData - 场景数据
 * @param {Object} caseData - 案件数据
 * @param {Object} plotData - 主线剧情数据（可选，多案件扩展）
 * @param {Function} caseLoader - 案件数据加载器 (caseId) => Promise<caseData>（可选）
 * @param {Object} evidenceData - 证据数据（可选，用于结案扣分检查）
 */
export function initSceneManager(scenesData, caseData, plotData = null, caseLoader = null, evidenceData = null) {
  _scenesData = scenesData;
  _caseData = caseData;
  _evidenceData = evidenceData;
  _plotData = plotData;
  _caseLoader = caseLoader;

  // 缓存初始案件
  if (caseData?.caseId) {
    _casesCache[caseData.caseId] = caseData;
  }

  // 初始化主线剧情管理器
  if (plotData) {
    initPlotManager(plotData);
  }

  _elements = {
    loadingScreen: document.getElementById('loading-screen'),
    menuScreen: document.getElementById('menu-screen'),
    briefingScreen: document.getElementById('briefing-screen'),
    investigateScreen: document.getElementById('investigate-screen'),
    interrogationScreen: document.getElementById('interrogation-screen'),
    hubScreen: document.getElementById('hub-screen'),
    endingScreen: document.getElementById('ending-screen'),
    finalEndingScreen: document.getElementById('final-ending-screen'),
    sceneImage: document.getElementById('scene-image'),
    sceneHotspots: document.getElementById('scene-hotspots'),
    characterPortrait: document.getElementById('character-portrait'),
    stressBarFill: document.getElementById('stress-bar-fill'),
    stressValue: document.getElementById('stress-value'),
    emotionTag: document.getElementById('emotion-tag'),
    caseTitle: document.getElementById('case-title'),
    briefingSetting: document.getElementById('briefing-setting'),
    briefingVictim: document.getElementById('briefing-victim'),
  };

  _bindGlobalActions();
  console.log('[sceneManager] 场景管理器初始化完成, plotData:', plotData ? '已加载' : '无');
}

// ====================
// 场景切换
// ====================

/**
 * 切换到指定画面
 * @param {string} screenName - 'loading'|'menu'|'briefing'|'investigate'|'interrogation'|'hub'|'ending'|'final_ending'
 */
export function switchScreen(screenName) {
  const screenMap = {
    'loading': _elements.loadingScreen,
    'menu': _elements.menuScreen,
    'briefing': _elements.briefingScreen,
    'investigate': _elements.investigateScreen,
    'interrogation': _elements.interrogationScreen,
    'hub': _elements.hubScreen,
    'ending': _elements.endingScreen,
    'final_ending': _elements.finalEndingScreen,
  };

  // 隐藏所有画面
  Object.values(screenMap).forEach(screen => {
    if (screen) screen.classList.remove('active');
  });

  // 显示目标画面
  const target = screenMap[screenName];
  if (target) {
    target.classList.add('active');
  } else {
    console.warn(`[sceneManager] 未知画面: ${screenName}`);
  }
}

/**
 * 切换调查场景
 * @param {string} sceneId - 场景 ID
 */
export async function switchScene(sceneId) {
  if (!_scenesData || !_scenesData[sceneId]) {
    console.error(`[sceneManager] 场景数据不存在: ${sceneId}`);
    return;
  }

  setCurrentScene(sceneId);
  setPhase('investigate');
  switchScreen('investigate');

  // 播放调查场景BGM（案件2/3使用专属BGM）
  const caseIdx = getCurrentCaseIndex();
  const investigationBGM = caseIdx >= 1 ? `investigation_case${caseIdx + 1}` : 'investigation';
  playBGM(investigationBGM);

  const scene = _scenesData[sceneId];

  // 设置场景背景
  _renderSceneBackground(scene);

  // 渲染热点
  _renderHotspots(scene.hotspots || []);

  // 隐藏对话框
  hideDialogueOverlay();

  // 显示场景描述（仅首次进入该场景时显示，避免重复）
  if (scene.description && !getFlag(`scene_visited_${sceneId}`)) {
    setFlag(`scene_visited_${sceneId}`, true);
    // 等待玩家看完场景描述并点击关闭
    await showDialogue({
      speaker: 'narration',
      text: scene.description,
      type: 'narration'
    });
    // 玩家点击推进后隐藏对话框，不阻挡调查交互
    hideDialogueOverlay();
  }
}

// ====================
// 场景渲染
// ====================

/**
 * 渲染场景背景
 */
function _renderSceneBackground(scene) {
  if (scene.bgImage) {
    _elements.sceneImage.style.backgroundImage = `url(${scene.bgImage})`;
  } else {
    // 默认赛博朋克渐变背景
    _elements.sceneImage.style.backgroundImage = 'none';
    _elements.sceneImage.style.background = 'linear-gradient(135deg, #0a0a12 0%, #1a0a2e 50%, #0a0a12 100%)';
  }
}

/**
 * 渲染调查热点
 * @param {Array} hotspots - 热点数据
 *   @prop {string} id
 *   @prop {string} label - 热点名称
 *   @prop {Object} position - { top, left, width, height } 百分比
 *   @prop {string} type - 'examine' | 'talk' | 'evidence' | 'move'
 *   @prop {string} evidenceId - 获得的证据 ID（type=evidence 时）
 *   @prop {string} targetScene - 移动目标场景 ID（type=move 时）
 *   @prop {string} characterId - 对话角色 ID（type=talk 时）
 *   @prop {Array} dialogues - 调查对话数据
 */
export function renderHotspots(hotspots) {
  _renderHotspots(hotspots);
}

function _renderHotspots(hotspots) {
  // 清空旧热点
  _elements.sceneHotspots.innerHTML = '';
  _currentHotspots = [];

  // 同时渲染调查线索列表（不依赖背景图位置）
  const cluesEl = document.getElementById('investigation-clues');
  if (cluesEl) cluesEl.innerHTML = '';

  const state = getState();

  // 按类型定义图标和样式
  const HOTSPOT_ICONS = {
    evidence: '🔍',
    move: '🚪',
    talk: '💬',
    examine: '🔎'
  };

  hotspots.forEach(hotspot => {
    // 检查是否已被获取（证据类热点）
    if (hotspot.type === 'evidence' && state.evidenceObtained.includes(hotspot.evidenceId)) {
      return; // 已获取，不再显示
    }

    // 检查是否需要标记（一次性热点）
    if (hotspot.once && getFlag(`hotspot_used_${hotspot.id}`)) {
      return;
    }

    // 1. 渲染绝对定位热点（保留，但仅作为背景图上的视觉标记）
    const el = document.createElement('div');
    el.className = `hotspot hotspot-${hotspot.type}`;
    el.dataset.id = hotspot.id;
    el.dataset.type = hotspot.type;

    if (hotspot.position) {
      el.style.top = hotspot.position.top;
      el.style.left = hotspot.position.left;
      el.style.width = hotspot.position.width;
      el.style.height = hotspot.position.height;
    } else {
      el.style.top = '30%';
      el.style.left = '30%';
      el.style.width = '80px';
      el.style.height = '80px';
    }

    const icon = HOTSPOT_ICONS[hotspot.type] || '🔍';
    el.innerHTML = `<span class="hotspot-icon">${icon}</span>`;
    if (hotspot.label) {
      el.title = hotspot.label;
      el.setAttribute('aria-label', hotspot.label);
      const labelEl = document.createElement('span');
      labelEl.className = 'hotspot-label';
      labelEl.textContent = hotspot.label;
      el.appendChild(labelEl);
    }

    el.addEventListener('click', () => _handleHotspotClick(hotspot));
    _elements.sceneHotspots.appendChild(el);
    _currentHotspots.push(hotspot);

    // 2. 渲染调查线索列表项（可靠的可点击区域，不依赖背景图）
    if (cluesEl) {
      const clueBtn = document.createElement('button');
      clueBtn.className = `clue-btn clue-${hotspot.type}`;
      clueBtn.innerHTML = `<span class="clue-icon">${icon}</span><span class="clue-text">${hotspot.label || hotspot.id}</span>`;
      clueBtn.addEventListener('click', () => _handleHotspotClick(hotspot));
      cluesEl.appendChild(clueBtn);
    }
  });
}

/**
 * 清理对话系统残留状态（场景切换前调用）
 */
function _continueResolveCleanup() {
  resetDialogueState();
}

/**
 * 渲染审讯场景
 * @param {Object} suspect - 嫌疑人数据（来自 characters.json 的角色对象）
 */
export async function renderInterrogationScene(suspect) {
  console.log(`[DEBUG] renderInterrogationScene: 进入, suspect=`, suspect);
  if (!suspect) return;

  // 兼容 suspects 为 ID 字符串的情况（从 caseData.suspects 查找完整对象）
  if (typeof suspect === 'string') {
    suspect = _caseData?.suspects?.find(s => (typeof s === 'object' ? s.id === suspect : s === suspect)) || { id: suspect, name: suspect };
  }

  setCurrentSuspect(suspect.id);
  setPhase('interrogation');
  switchScreen('interrogation');

  // 清理旧对话框和残留的 _continueResolve，避免上一轮对话未关闭导致冲突
  _continueResolveCleanup();
  hideDialogueOverlay();

  // 播放审讯场景BGM
  // 播放审讯BGM（案件2/3使用专属BGM）
  const caseIdx = getCurrentCaseIndex();
  const interrogationBGM = caseIdx >= 1 ? `interrogation_case${caseIdx + 1}` : 'interrogation';
  playBGM(interrogationBGM);

  // 设置角色立绘
  if (suspect.portrait) {
    _elements.characterPortrait.src = suspect.portrait;
    _elements.characterPortrait.style.display = 'block';
  } else {
    _elements.characterPortrait.style.display = 'none';
  }

  // 更新压力条
  _updateStressDisplay(suspect.id);

  // 渲染嫌疑人选择器
  _renderSuspectSelector(suspect.id);

  // 刷新嫌疑人档案面板
  _renderSuspectBio(suspect);

  // await 开场对话，确保完成后玩家才能操作
  console.log(`[DEBUG] renderInterrogationScene: 开始播放开场白`);
  await _playInterrogationOpening(suspect.id);
  console.log(`[DEBUG] renderInterrogationScene: 开场白播放完毕`);

  console.log(`[sceneManager] 进入审讯: ${suspect.name || suspect.id}`);
}

function _renderSuspectSelector(currentSuspectId) {
  const selectorEl = document.getElementById('suspect-selector');
  if (!selectorEl || !_caseData?.suspects) return;

  selectorEl.innerHTML = '<span class="selector-label">切换嫌疑人：</span>';

  _caseData.suspects.forEach(suspect => {
    const btn = document.createElement('button');
    btn.className = `cyber-btn-sm suspect-btn ${suspect.id === currentSuspectId ? 'active' : ''}`;
    btn.textContent = suspect.name || suspect.id;
    btn.dataset.suspectId = suspect.id;
    btn.dataset.action = 'switch-suspect';
    selectorEl.appendChild(btn);
  });
}

/**
 * 渲染嫌疑人档案面板（右侧）
 * @param {Object} suspect - 嫌疑人数据对象
 */
function _renderSuspectBio(suspect) {
  const nameEl = document.getElementById('bio-name');
  const identityEl = document.getElementById('bio-identity');
  const personalityEl = document.getElementById('bio-personality');
  const secretEl = document.getElementById('bio-secret');
  if (!nameEl) return;

  nameEl.textContent = suspect.name || '—';
  identityEl.textContent = suspect.identity || '—';

  if (suspect.personality) {
    personalityEl.textContent = suspect.personality.replace(/[。；]/g, '。\n').split('\n').slice(0, 3).join('\n');
  } else {
    personalityEl.textContent = '—';
  }

  if (suspect.secretKnowledge) {
    secretEl.textContent = '证据充足时可解锁机密信息';
    secretEl.style.color = 'var(--text-dim)';
    secretEl.style.fontStyle = 'italic';
  } else {
    secretEl.textContent = '—';
  }
}

async function _playInterrogationOpening(suspectId) {
  console.log(`[DEBUG] _playInterrogationOpening: suspectId=${suspectId}`);
  // 优先从全局 dialoguesData 中获取开场白
  if (typeof window._dialoguesData !== 'undefined' && window._dialoguesData.dialogues?.interrogation_opening?.[suspectId]) {
    const openingDialogues = window._dialoguesData.dialogues.interrogation_opening[suspectId];
    console.log(`[DEBUG] _playInterrogationOpening: 找到预设开场白, 数量=${openingDialogues.length}`);
    await showDialogueSequence(openingDialogues);
    console.log(`[DEBUG] _playInterrogationOpening: 预设开场白播放完毕`);
    return;
  }

  // 多案件联调兜底：无预设开场白时，从 character 数据生成通用开场
  const suspect = _caseData?.suspects?.find(s => s.id === suspectId);
  console.log(`[DEBUG] _playInterrogationOpening: 无预设开场白, 使用兜底, suspect=`, suspect);
  if (suspect) {
    await showDialogue({
      speaker: suspectId,
      text: `${suspect.name || suspectId}坐到了审讯室的对面。${suspect.identity || ''}。`,
      type: 'normal',
      emotion: 'calm'
    });
    console.log(`[DEBUG] _playInterrogationOpening: 兜底开场白播放完毕`);
  }
}

// Day3：提问处理 - 接入 AI 引擎
async function _handleAskQuestion() {
  const state = getState();
  const suspectId = state.currentSuspect;

  console.log(`[DEBUG] _handleAskQuestion: suspectId=${suspectId}`);

  if (!suspectId) {
    console.log('[DEBUG] _handleAskQuestion: 无当前嫌疑人，返回');
    return;
  }

  // 获取该嫌疑人的问题列表（优先 dialogues.json，兜底从 character.lies 动态生成）
  let questions = [];
  if (typeof window._dialoguesData !== 'undefined' && window._dialoguesData.dialogues?.interrogation_questions?.[suspectId]) {
    questions = window._dialoguesData.dialogues.interrogation_questions[suspectId];
  }

  // 多案件联调兜底：若 dialogues.json 无该嫌疑人预设问题，从 character.lies 动态生成
  if (!questions || questions.length === 0) {
    const suspect = _caseData?.suspects?.find(s => s.id === suspectId);
    if (suspect?.lies?.length > 0) {
      questions = suspect.lies.map((lie, idx) => ({
        id: `auto_q_${idx}`,
        text: lie.topic,
        category: 'secret',
        requiresEvidence: lie.counterEvidence || null
      }));
    }
    // 追加通用问题（不要求证据）
    questions = [
      { id: 'auto_alibi', text: '案发时段你在哪里？', category: 'alibi' },
      { id: 'auto_relation', text: '你和死者是什么关系？', category: 'relationship' },
      ...questions
    ];
  }

  console.log(`[DEBUG] _handleAskQuestion: questions=`, questions);
  console.log(`[DEBUG] _handleAskQuestion: evidenceObtained=`, state.evidenceObtained);

  // 过滤需要证据才能解锁的问题
  const availableQuestions = questions.filter(q => {
    if (!q.requiresEvidence) return true;
    return state.evidenceObtained.includes(q.requiresEvidence);
  });

  console.log(`[DEBUG] _handleAskQuestion: availableQuestions=`, availableQuestions);

  if (availableQuestions.length === 0) {
    await showDialogue({
      speaker: 'system',
      text: '暂时没有可问的问题。也许你需要收集更多证据。',
      type: 'normal'
    });
    return;
  }

  // 显示问题选项
  const options = availableQuestions.map(q => ({
    text: q.text,
    action: 'custom',
    target: q.id,
    category: q.category
  }));

  console.log(`[DEBUG] _handleAskQuestion: 调用 showOptions, options=`, options);
  const choice = await showOptions(options);
  console.log(`[DEBUG] _handleAskQuestion: showOptions 返回, choice=`, choice);

  // Day3: 优先使用 AI 引擎
  if (isAPIAvailable()) {
    try {
      const aiResult = await interrogateAI({
        suspectId,
        action: 'question',
        content: choice.text
      });

      if (aiResult && aiResult.response) {
        // 应用压力变化
        if (aiResult.stressDelta) {
          addStress(suspectId, aiResult.stressDelta);
        }
        if (aiResult.hasContradiction) {
          addScore(7);
        }
        _updateStressDisplay(suspectId);

        await showDialogue({
          speaker: suspectId,
          text: aiResult.response,
          type: 'ai_generated',
          emotion: aiResult.emotion
        });

        if (aiResult.hasContradiction) {
          await showDialogue({
            speaker: 'system',
            text: `【关键信息揭露！压力 ${aiResult.stressDelta > 0 ? '+' : ''}${aiResult.stressDelta || 0}】`,
            type: 'narration'
          });
        }

        if (aiResult.newClue) {
          await showDialogue({
            speaker: 'system',
            text: `【新线索发现：${aiResult.newClue}】`,
            type: 'normal'
          });
        }

        _checkEndingCondition(getState());
        return;
      }
    } catch (e) {
      console.warn('[sceneManager] AI 提问失败，使用预设逻辑:', e);
    }
  }

  // 离线模式：使用预设逻辑
  await _generateQuestionResponse(suspectId, choice, state);
}

// Day3：施压处理 - 接入 AI 引擎
async function _handlePressure() {
  const state = getState();
  const suspectId = state.currentSuspect;

  if (!suspectId) return;

  // 施压次数限制：每名嫌疑人最多施压 3 次
  const pressureCount = getFlag(`pressure_count_${suspectId}`) || 0;
  if (pressureCount >= 3) {
    await showDialogue({
      speaker: 'system',
      text: '该嫌疑人已经承受了多次施压，继续施压不会有更多效果。尝试用证据来突破防线吧。',
      type: 'normal'
    });
    return;
  }

  const stress = state.stressLevel[suspectId] || 0;

  await showDialogue({
    speaker: 'detective',
    text: '我给你最后一次机会，说出真相！',
    type: 'normal'
  });

  // Day3: 优先使用 AI 引擎
  if (isAPIAvailable()) {
    try {
      const aiResult = await interrogateAI({
        suspectId,
        action: 'pressure',
        content: '侦探施压，要求嫌疑人说出真相'
      });

      if (aiResult && aiResult.response) {
        if (aiResult.stressDelta) {
          addStress(suspectId, aiResult.stressDelta);
        }
        _updateStressDisplay(suspectId);

        await showDialogue({
          speaker: suspectId,
          text: aiResult.response,
          type: 'ai_generated',
          emotion: aiResult.emotion
        });

        const newStress = getStress(suspectId);
        await showDialogue({
          speaker: 'system',
          text: `【压力值 ${stress} → ${newStress}】`,
          type: 'narration'
        });

        _checkEndingCondition(getState());
        return;
      }
    } catch (e) {
      console.warn('[sceneManager] AI 施压失败，使用预设逻辑:', e);
    }
  }

  // 离线模式：预设施压逻辑
  addStress(suspectId, 10);
  playSFX('stress_up');
  _updateStressDisplay(suspectId);

  let emotion = 'calm';
  let responseText = '';
  const newStress = Math.min(100, stress + 10);

  if (newStress >= 70) {
    emotion = 'broken';
    responseText = '你...你别逼我！我说...我什么都说了！';
  } else if (newStress >= 30) {
    emotion = 'nervous';
    responseText = '你...你在说什么？我不明白你的意思！';
  } else {
    emotion = 'calm';
    responseText = '侦探先生，你的指控没有任何根据。';
  }

  await showDialogue({
    speaker: suspectId,
    text: responseText,
    type: 'ai_generated',
    emotion
  });

  await showDialogue({
    speaker: 'system',
    text: `【压力值 ${stress} → ${newStress}】（剩余施压次数：${2 - pressureCount}）`,
    type: 'narration'
  });

  // 记录施压次数
  setFlag(`pressure_count_${suspectId}`, pressureCount + 1);

  _checkEndingCondition(state);
}

// Day2：生成问题的预设回应
async function _generateQuestionResponse(suspectId, question, state) {
  // 获取嫌疑人信息
  const suspect = _caseData.suspects?.find(s => s.id === suspectId);
  if (!suspect) return;

  // 检查是否有谎言被戳穿
  const lie = suspect.lies?.find(l => l.topic === question.text || l.counterEvidence === question.requiresEvidence);
  const hasCounterEvidence = question.requiresEvidence && state.evidenceObtained.includes(question.requiresEvidence);
  const stress = state.stressLevel[suspectId] || 0;

  let responseText = '';
  let emotion = 'calm';
  let stressDelta = 5; // 默认少量压力

  if (lie && hasCounterEvidence) {
    // 玩家持有戳穿证据
    emotion = 'nervous';
    stressDelta = 20;
    responseText = `${lie.truthText}（声音明显颤抖，不敢直视你的眼睛）`;
  } else if (question.category === 'evidence') {
    emotion = 'nervous';
    stressDelta = 10;
    responseText = '这...这个我不能随便回答。你到底想套什么话？';
  } else if (question.category === 'alibi') {
    emotion = 'calm';
    stressDelta = 3;
    responseText = lie?.lieText || '案发当晚我一直待在自己的位置上，没有离开过。';
  } else {
    emotion = 'calm';
    stressDelta = 5;
    responseText = `关于这件事，我没什么好说的。${suspect.name || '我'}问心无愧。`;
  }

  // 应用压力变化
  addStress(suspectId, stressDelta);
  updateStressDisplay(suspectId);

  await showDialogue({
    speaker: suspectId,
    text: responseText,
    type: 'ai_generated',
    emotion
  });

  if (hasCounterEvidence && lie) {
    await showDialogue({
      speaker: 'system',
      text: `【关键信息揭露！压力 +${stressDelta}】`,
      type: 'narration'
    });
    addScore(12); // 戳穿谎言加分
  }

  // 检查结局
  _checkEndingCondition(getState());
}

// Day4：根据当前评分计算应触发的结局
function _calculateEnding(state) {
  const score = state.score || 0;
  const endings = _caseData?.endings || {};

  // 从 endings 的 condition 字段解析阈值（如 "score >= 80"）
  const getThreshold = (endingId) => {
    const cond = endings[endingId]?.condition || '';
    const match = cond.match(/score\s*>=\s*(\d+)/);
    return match ? parseInt(match[1]) : null;
  };

  const goodThreshold = getThreshold('ending_good') ?? 120;
  const normalThreshold = getThreshold('ending_normal') ?? 60;

  if (score >= goodThreshold) return 'ending_good';
  if (score >= normalThreshold) return 'ending_normal';
  return 'ending_bad';
}

// Day2/Day4：检查结局触发条件
function _checkEndingCondition(state) {
  const score = state.score || 0;
  const stress = state.stressLevel[state.currentSuspect] || 0;
  const endings = _caseData?.endings || {};
  const cond = endings.ending_good?.condition || '';
  const match = cond.match(/score\s*>=\s*(\d+)/);
  const goodThreshold = match ? parseInt(match[1]) : 120;

  // 如果推理评分足够高且当前嫌疑人崩溃，自动触发好结局
  if (score >= goodThreshold && stress >= 80) {
    const endingId = _calculateEnding(state);
    setTimeout(() => _triggerEnding(endingId, score), 500);
  }
}

// Day4：手动结束案件
async function _handleEndCase() {
  const state = getState();
  const score = state.score || 0;
  const endingId = _calculateEnding(state);

  // 检查未收集的证据（扣分惩罚）
  const totalEvidenceIds = _evidenceData?.evidence
    ?.filter(ev => ev.obtainedFrom && ev.obtainedFrom !== '组合解锁')
    ?.map(ev => ev.id) || [];
  const missingEvidence = totalEvidenceIds.filter(id => !state.evidenceObtained.includes(id));
  const penalty = missingEvidence.length * 5;
  const effectiveScore = score - penalty;

  let penaltyText = '';
  if (missingEvidence.length > 0) {
    penaltyText = `（警告：还有 ${missingEvidence.length} 条线索未调查，将扣除 ${penalty} 分）`;
  }

  // 显示确认提示
  await showDialogue({
    speaker: 'system',
    text: `当前推理评分为 ${score}${penalty > 0 ? `，草草结案将有 ${penalty} 分扣减` : ''}。你确定要结束案件并做出最终裁定吗？`,
    type: 'normal'
  });

  const choice = await showOptions([
    { text: '确认结案', action: 'custom', target: 'confirm' },
    { text: '继续调查', action: 'custom', target: 'cancel' }
  ]);

  if (choice.target === 'confirm') {
    // 应用扣分
    if (penalty > 0) {
      for (let i = 0; i < missingEvidence.length; i++) {
        addScore(-5);
      }
      const newScore = getState().score || 0;
      await showDialogue({
        speaker: 'system',
        text: `因线索不完整，推理评分 ${score} → ${newScore}`,
        type: 'narration'
      });
    }
    const finalScore = getState().score || 0;
    const finalEndingId = _calculateEnding(getState());
    _triggerEnding(finalEndingId, finalScore);
  }
}

// 多案件扩展：Hub 画面"开始调查"按钮处理
async function _handleNextFromHub() {
  const nextIdx = getNextCaseIndex();
  if (nextIdx >= 0) {
    await startCase(nextIdx);
  } else {
    // 全部案件完成，进入最终结局
    await renderFinalEnding();
  }
}

// 多案件扩展：回顾已结案件卷宗
async function _handleReviewCases() {
  const results = getCasesResults();
  const completed = results.map((r, idx) => r ? `${CASE_TITLES[idx] || '案件' + (idx + 1)}：${r.ending === 'ending_good' ? '真相大白' : r.ending === 'ending_bad' ? '错判冤案' : '疑案悬置'}（评分 ${r.score}）` : null).filter(Boolean);

  if (completed.length === 0) {
    await showDialogue({ speaker: 'system', text: '尚无已结案的卷宗可供回顾。', type: 'normal' });
    return;
  }

  await showDialogue({
    speaker: 'ai_assistant',
    text: `侦探，这是目前已结案件的卷宗摘要：\n${completed.join('\n')}`,
    type: 'ai_generated'
  });
}

// Day2/Day4：触发结局
function _triggerEnding(endingId, score) {
  if (!_caseData?.endings?.[endingId]) return;

  const ending = _caseData.endings[endingId];
  setEnding(endingId);

  // 多案件扩展：立即记录案件结果，避免玩家从 ending 画面直接返回主菜单时丢失结果
  const caseIndex = getCurrentCaseIndex();
  const existingResult = getCaseResult(caseIndex);
  if (caseIndex >= 0 && !existingResult) {
    recordCaseResult({
      caseId: _caseData?.caseId,
      ending: endingId,
      score: score,
      keyFlags: { ...getState().flags }
    });
    checkHiddenCaseUnlock();
  }

  renderEnding({ title: ending.title, text: ending.description, score });
}

/**
 * 更新压力条显示
 * @param {string} suspectId
 */
export function updateStressDisplay(suspectId) {
  _updateStressDisplay(suspectId);
}

/**
 * 更新推理评分显示
 */
export function updateScoreDisplay(score) {
  const value = typeof score === 'number' ? score : (getState().score || 0);
  const el1 = document.getElementById('score-value');
  const el2 = document.getElementById('score-value-interrogation');
  if (el1) el1.textContent = value;
  if (el2) el2.textContent = value;
}

/**
 * 更新压力条显示（内部实现）
 * @param {string} suspectId
 */
function _updateStressDisplay(suspectId) {
  const state = getState();
  const stress = state.stressLevel[suspectId] || 0;

  // 更新压力条
  if (_elements.stressBarFill) {
    _elements.stressBarFill.style.width = `${stress}%`;
  }

  // Day3: 更新压力条发光效果
  const stressGlow = document.getElementById('stress-bar-glow');
  if (stressGlow) {
    stressGlow.style.opacity = stress > 60 ? '1' : stress > 30 ? '0.5' : '0';
  }

  if (_elements.stressValue) {
    _elements.stressValue.textContent = stress;
  }

  // 更新情绪标签
  let emotion = '冷静';
  let emotionClass = '';
  if (stress >= 67) {
    emotion = '崩溃';
    emotionClass = 'broken';
  } else if (stress >= 34) {
    emotion = '紧张';
    emotionClass = 'nervous';
  }

  if (_elements.emotionTag) {
    _elements.emotionTag.textContent = emotion;
    _elements.emotionTag.className = 'emotion-tag';
    if (emotionClass) _elements.emotionTag.classList.add(emotionClass);
  }

  // Day3: 更新心理指标面板
  const defenseEl = document.getElementById('defense-level');
  const contradictionEl = document.getElementById('contradiction-level');

  if (defenseEl) {
    // 防御等级：压力越低防御越高
    const defenseLevel = Math.max(0, 4 - Math.floor(stress / 25));
    defenseEl.textContent = '█'.repeat(defenseLevel) + '░'.repeat(4 - defenseLevel);
    defenseEl.className = `psych-metric-value defense-${defenseLevel}`;
  }

  if (contradictionEl) {
    // 矛盾等级：压力越高矛盾越多
    const contradictionLevel = Math.min(4, Math.floor(stress / 25));
    contradictionEl.textContent = '█'.repeat(contradictionLevel) + '░'.repeat(4 - contradictionLevel);
    contradictionEl.className = `psych-metric-value contradiction-${contradictionLevel}`;
  }

  // 嫌疑人崩溃时解锁机密档案
  const secretEl = document.getElementById('bio-secret');
  if (secretEl && stress >= 70) {
    const suspect = _caseData?.suspects?.find(s => s.id === suspectId);
    if (suspect?.secretKnowledge) {
      secretEl.textContent = suspect.secretKnowledge;
      secretEl.style.color = 'var(--neon-yellow)';
      secretEl.style.fontStyle = 'normal';
    }
  }
}

/**
 * 渲染案件简报
 */
export function renderBriefing() {
  if (!_caseData) return;

  setPhase('intro');
  switchScreen('briefing');

  if (_elements.caseTitle) {
    _elements.caseTitle.textContent = _caseData.title || '未知案件';
  }
  if (_elements.briefingSetting) {
    const setting = _caseData.setting || {};
    _elements.briefingSetting.innerHTML = `
      <h4>案件背景</h4>
      <p class="briefing-meta">${setting.time || ''} · ${setting.location || ''}</p>
      <p>${setting.background || ''}</p>
    `;
  }
  if (_elements.briefingVictim) {
    const victim = _caseData.victim || {};
    _elements.briefingVictim.innerHTML = `
      <h4>受害者</h4>
      <p class="briefing-meta">${victim.name || ''} · ${victim.identity || ''}</p>
      <p>${victim.description || ''}</p>
    `;
  }

  // 操作指引提示
  const guideEl = document.getElementById('briefing-guide');
  if (guideEl) {
    guideEl.innerHTML = `
      <div class="briefing-guide-item"><span class="guide-icon">🔍</span> 点击场景中发光的标记调查证据</div>
      <div class="briefing-guide-item"><span class="guide-icon">🚪</span> 黄色标记可切换到其他场景</div>
      <div class="briefing-guide-item"><span class="guide-icon">📋</span> 收集完证据后点击「开始审讯」</div>
    `;
  }
}

/**
 * 渲染结局
 * @param {Object} ending - 结局数据
 *   @prop {string} title
 *   @prop {string} text
 *   @prop {number} score
 */
export function renderEnding(ending) {
  setPhase('ending');
  setGamePhase('ending');
  switchScreen('ending');

  // 播放结局BGM
  playBGM('ending');

  const titleEl = document.getElementById('ending-title');
  const textEl = document.getElementById('ending-text');
  const scoreEl = document.getElementById('ending-score');

  if (titleEl) titleEl.textContent = ending.title || '结局';
  if (textEl) textEl.textContent = ending.text || '';
  if (scoreEl) scoreEl.textContent = `推理评分: ${ending.score || 0}`;
}

// ====================
// 多案件扩展：Hub 画面 / 案件切换 / 最终结局
// ====================

/**
 * 设置当前激活的案件数据（切换案件上下文）
 * @param {Object} caseData
 */
export function setCaseData(caseData) {
  _caseData = caseData;
  _scenesData = caseData?.scenes || null;
  if (caseData?.caseId) {
    _casesCache[caseData.caseId] = caseData;
  }

  // 数据集成：将案件中的嫌疑人 ID 列表与 characters.json 合并为完整对象
  if (caseData && Array.isArray(caseData.suspects) && typeof window._charactersData !== 'undefined') {
    caseData.suspects = caseData.suspects.map(id => {
      if (typeof id === 'object') return id; // 已是对象则跳过
      const character = window._charactersData.characters?.find(c => c.id === id);
      return character || { id, name: id };
    });
  }

  // 同步更新 AI 引擎和证据系统的案件上下文
  setAIEngineCaseContext(caseData);
  console.log(`[sceneManager] 案件上下文已切换: ${caseData?.caseId}`);
}

/**
 * 按需加载案件数据
 * @param {number} caseIndex
 * @returns {Promise<Object>}
 */
async function _loadCase(caseIndex) {
  const caseId = CASE_FILES[caseIndex];
  if (!caseId) throw new Error(`无效案件序号: ${caseIndex}`);

  // 命中缓存
  if (_casesCache[caseId]) return _casesCache[caseId];

  // 通过注入的加载器或 fetch 加载
  if (_caseLoader) {
    const data = await _caseLoader(caseId);
    _casesCache[caseId] = data;
    return data;
  }

  // 默认 fetch
  const res = await fetch(`/data/cases/${caseId}.json`);
  if (!res.ok) throw new Error(`加载案件失败: ${caseId} (${res.status})`);
  const data = await res.json();
  _casesCache[caseId] = data;
  return data;
}

/**
 * 开始指定案件
 * @param {number} caseIndex - 案件序号 0/1/2/3
 */
export async function startCase(caseIndex) {
  try {
    const caseData = await _loadCase(caseIndex);
    setCaseData(caseData);

    // 重置单案件状态（保留跨案件层）
    startNewCase(caseIndex);

    // 初始化嫌疑人压力值
    if (Array.isArray(caseData.suspects)) {
      // suspects 可能是 ID 数组或对象数组，统一提取 ID
      const suspectIds = caseData.suspects.map(s => typeof s === 'string' ? s : s.id);
      initSuspectStress(suspectIds);
    }

    setGamePhase('briefing');
    renderBriefing();

    // 播放案件切换音效 + 调查BGM（案件2/3使用专属BGM）
    playSFX('case_switch');
    const investigationBGM = caseIndex >= 1 ? `investigation_case${caseIndex + 1}` : 'investigation';
    playBGM(investigationBGM);

    console.log(`[sceneManager] 开始案件 ${caseIndex}: ${caseData.title}`);
  } catch (e) {
    console.error('[sceneManager] 加载案件失败:', e);
    await showDialogue({
      speaker: 'system',
      text: `案件数据加载失败: ${e.message}。请稍后重试或联系开发人员。`,
      type: 'normal'
    });
  }
}

/**
 * 结案后返回事务所 Hub
 * 记录案件结果、检查隐藏案件解锁、渲染 Hub 画面
 */
export async function endCaseAndReturnHub() {
  const state = getState();
  const caseIndex = getCurrentCaseIndex();

  // 案件结果已在 _triggerEnding 中记录，此处仅做兜底（如未记录则补记）
  const existingResult = getCaseResult(caseIndex);
  if (caseIndex >= 0 && !existingResult) {
    const endingId = state.endingTriggered || _calculateEnding(state);
    recordCaseResult({
      caseId: _caseData?.caseId,
      ending: endingId,
      score: state.score || 0,
      keyFlags: { ...state.flags }
    });
    checkHiddenCaseUnlock();
  }

  // 切换到 Hub 画面
  setGamePhase('hub');
  switchScreen('hub');
  playSFX('case_switch');
  playBGM('hub'); // Hub 专属BGM（C组已提供 bgm_hub.mp3）

  await _renderHub();

  console.log('[sceneManager] 已返回事务所 Hub');
}

/**
 * 渲染事务所 Hub 画面
 * 根据 casesResults 显示 AI 对话、新闻简报、案件进度
 */
async function _renderHub() {
  const state = getState();
  const results = getCasesResults();

  // 0. 接入 Hub 事务所背景图（C组已提供 hub_office.png）
  const hubBgEl = document.querySelector('#hub-screen .hub-bg');
  if (hubBgEl) {
    hubBgEl.style.backgroundImage = 'url(assets/bg/hub_office.png)';
    hubBgEl.style.backgroundSize = 'cover';
    hubBgEl.style.backgroundPosition = 'center';
    hubBgEl.style.backgroundBlendMode = 'overlay';
  }

  // 1. 渲染案件进度指示器
  _renderCaseIndicator(results);

  // 2. 渲染新闻简报
  _renderNewsFeed(results);

  // 3. 播放 AI 助手对话（基于最近结案结果）
  const hubDialogues = getCurrentHubDialogue();
  const aiDialogueEl = document.getElementById('hub-ai-dialogue');

  // 清除上一次未播放完的 Hub 对话定时器
  if (_hubDialogueTimer) {
    clearTimeout(_hubDialogueTimer);
    _hubDialogueTimer = null;
  }

  if (hubDialogues && hubDialogues.length > 0) {
    // 静态显示第一条对话
    if (aiDialogueEl) {
      aiDialogueEl.textContent = hubDialogues[0].text || '';
    }
    // 若有多条对话，延迟播放剩余序列（从第二条开始，避免与静态文本重复）
    if (hubDialogues.length > 1) {
      _hubDialogueTimer = setTimeout(async () => {
        _hubDialogueTimer = null;
        // 确认仍处于 Hub 画面才播放
        if (getGamePhase() === 'hub') {
          await showDialogueSequence(hubDialogues.slice(1));
        }
      }, 800);
    }
  } else {
    // 占位对话（B 组未填充时的保底）
    if (aiDialogueEl) {
      const nextIdx = getNextCaseIndex();
      if (nextIdx >= 0) {
        aiDialogueEl.textContent = `侦探，新的案件卷宗已送达。${CASE_TITLES[nextIdx] || '下一个案件'}正等着你。`;
      } else {
        aiDialogueEl.textContent = '所有案件都已了结。是时候做个最终总结了。';
      }
    }
  }

  // 4. 配置"开始调查"按钮
  const nextBtn = document.getElementById('hub-next-btn');
  const nextIdx = getNextCaseIndex();
  if (nextBtn) {
    if (nextIdx >= 0) {
      nextBtn.disabled = false;
      nextBtn.textContent = nextIdx === 3 ? '进入隐藏案件' : '开始下一个案件';
    } else {
      // 全部案件完成，进入最终结局
      nextBtn.disabled = false;
      nextBtn.textContent = '查看最终结局';
    }
  }

  // 5. 更新进度标签
  const progressLabel = document.getElementById('hub-progress-label');
  if (progressLabel) {
    const completed = results.filter(r => r).length;
    progressLabel.textContent = `案件进度：${completed} / 3 已结案`;
  }
}

/**
 * 渲染案件进度指示器
 */
function _renderCaseIndicator(results) {
  const container = document.getElementById('hub-case-indicator');
  if (!container) return;

  container.innerHTML = '';

  for (let i = 0; i < 3; i++) {
    const result = results[i];
    const node = document.createElement('div');
    node.className = 'hub-case-node';

    if (result) {
      if (result.ending === 'ending_good') node.classList.add('good', 'active');
      else if (result.ending === 'ending_bad') node.classList.add('bad', 'active');
      else node.classList.add('normal', 'active');
    }

    const dot = document.createElement('div');
    dot.className = 'hub-case-dot';
    // 使用 C 组提供的 UI 图标（case_progress_good/bad/locked.png）
    if (result) {
      if (result.ending === 'ending_good') {
        dot.style.backgroundImage = 'url(assets/ui/case_progress_good.png)';
      } else if (result.ending === 'ending_bad') {
        dot.style.backgroundImage = 'url(assets/ui/case_progress_bad.png)';
      } else {
        dot.textContent = '—';
      }
    } else {
      dot.style.backgroundImage = 'url(assets/ui/case_progress_locked.png)';
      dot.classList.add('locked');
    }
    dot.style.backgroundSize = 'contain';
    dot.style.backgroundRepeat = 'no-repeat';
    dot.style.backgroundPosition = 'center';
    node.appendChild(dot);

    const label = document.createElement('div');
    label.className = 'hub-case-label';
    label.textContent = CASE_TITLES[i] || `案件${i + 1}`;
    node.appendChild(label);

    container.appendChild(node);

    // 添加连接线（最后一个除外）
    if (i < 2) {
      const connector = document.createElement('div');
      connector.className = 'hub-case-connector';
      if (result) connector.classList.add('active');
      container.appendChild(connector);
    }
  }

  // 隐藏案件节点（如果已解锁）
  if (getState().unlockedHiddenCase) {
    const hiddenResult = results[3];
    const connector = document.createElement('div');
    connector.className = 'hub-case-connector active';
    container.appendChild(connector);

    const node = document.createElement('div');
    node.className = 'hub-case-node' + (hiddenResult ? ' good active' : ' locked active');
    const dot = document.createElement('div');
    dot.className = 'hub-case-dot';
    if (hiddenResult) {
      dot.style.backgroundImage = 'url(assets/ui/case_progress_good.png)';
    } else {
      dot.style.backgroundImage = 'url(assets/ui/case_progress_locked.png)';
      dot.classList.add('locked');
    }
    dot.style.backgroundSize = 'contain';
    dot.style.backgroundRepeat = 'no-repeat';
    dot.style.backgroundPosition = 'center';
    node.appendChild(dot);
    const label = document.createElement('div');
    label.className = 'hub-case-label';
    label.textContent = '隐藏案件';
    node.appendChild(label);
    container.appendChild(node);
  }
}

/**
 * 渲染新闻简报
 */
function _renderNewsFeed(results) {
  const listEl = document.getElementById('hub-news-list');
  if (!listEl) return;

  listEl.innerHTML = '';

  // 收集所有已结案件的新闻
  const allNews = [];
  results.forEach((r, idx) => {
    if (r) {
      const news = getNewsFeed(idx);
      allNews.push(...news);
    }
  });

  if (allNews.length === 0) {
    // 保底新闻
    listEl.innerHTML = `
      <div class="hub-news-item" style="animation-delay: 0.1s; opacity:1;">
        <div class="hub-news-headline">新香港下城区夜间发生义体医生命案，警方已介入调查。</div>
        <div class="hub-news-meta"><span>新香港晨报</span><span>2087.11.16</span></div>
      </div>`;
    return;
  }

  allNews.forEach((news, idx) => {
    const item = document.createElement('div');
    item.className = 'hub-news-item';
    item.style.animationDelay = `${0.1 * (idx + 1)}s`;
    item.innerHTML = `
      <div class="hub-news-headline">${news.headline}</div>
      <div class="hub-news-meta">
        <span>${news.source || '未知来源'}</span>
        <span>${news.time || ''}</span>
      </div>
    `;
    listEl.appendChild(item);
  });
}

/**
 * 渲染最终结局
 */
export async function renderFinalEnding() {
  setGamePhase('final_ending');
  switchScreen('final_ending');
  playBGM('ending');

  const ending = getFinalEnding();

  const titleEl = document.getElementById('final-ending-title');
  const textEl = document.getElementById('final-ending-text');
  const scoreEl = document.getElementById('final-ending-score');

  if (titleEl) titleEl.textContent = ending.title;
  if (textEl) textEl.textContent = ending.text;

  // 累计评分
  const results = getCasesResults();
  const totalScore = results.reduce((sum, r) => sum + (r?.score || 0), 0);
  if (scoreEl) scoreEl.textContent = `总推理评分: ${totalScore}`;

  console.log('[sceneManager] 渲染最终结局:', getFinalEndingType());
}

/**
 * Day4: 从存档恢复游戏状态与画面
 */
export async function restoreFromSave() {
  return await _restoreFromSave();
}

async function _restoreFromSave() {
  const data = loadGame();
  if (!data || !data.state) {
    console.warn('[sceneManager] 无存档或读档失败');
    return false;
  }

  const state = data.state;
  // 应用存档中的设置
  if (state.settings) {
    setMusicEnabled(state.settings.musicEnabled);
    setAIEnabled(state.settings.aiEnabled);
  }

  const gamePhase = state.gamePhase || 'menu';
  console.log('[sceneManager] 从存档恢复，gamePhase:', gamePhase, 'currentPhase:', state.currentPhase);

  // 优先按 gamePhase（跨案件层）恢复
  if (gamePhase === 'hub') {
    switchScreen('hub');
    playBGM('menu');
    await _renderHub();
    return true;
  }

  if (gamePhase === 'final_ending') {
    renderFinalEnding();
    return true;
  }

  // 按单案件阶段恢复（需确保案件数据已加载）
  if (state.currentCaseIndex >= 0 && state.currentCaseIndex !== undefined) {
    try {
      const caseData = await _loadCase(state.currentCaseIndex);
      setCaseData(caseData);
    } catch (e) {
      console.warn('[sceneManager] 恢复时加载案件失败，回退到主菜单:', e);
      switchScreen('menu');
      return false;
    }
  }

  // 根据阶段恢复画面
  switch (state.currentPhase) {
    case 'intro':
      switchScreen('briefing');
      renderBriefing();
      break;

    case 'investigate':
      if (state.currentScene && _scenesData && _scenesData[state.currentScene]) {
        switchScene(state.currentScene);
      } else if (_scenesData) {
        const firstSceneId = Object.keys(_scenesData)[0];
        switchScene(firstSceneId);
      } else {
        switchScreen('menu');
      }
      break;

    case 'interrogation':
      if (state.currentSuspect && _caseData) {
        const suspect = _caseData.suspects?.find(s => (typeof s === 'string' ? s === state.currentSuspect : s.id === state.currentSuspect));
        if (suspect) {
          await renderInterrogationScene(suspect);
        } else {
          switchScreen('menu');
        }
      } else {
        switchScreen('menu');
      }
      break;

    case 'ending':
      if (state.endingTriggered && _caseData?.endings?.[state.endingTriggered]) {
        const ending = _caseData.endings[state.endingTriggered];
        renderEnding({ title: ending.title, text: ending.description, score: state.score || 0 });
      } else {
        switchScreen('menu');
      }
      break;

    default:
      switchScreen('menu');
      break;
  }

  // 恢复 UI 状态
  updateScoreDisplay(state.score || 0);
  if (state.currentSuspect) {
    updateStressDisplay(state.currentSuspect);
  }
  if (state.evidenceObtained) {
    renderEvidenceBar(state.evidenceObtained);
  }

  return true;
}

async function _handleHotspotClick(hotspot) {
  // 标记已使用
  if (hotspot.once) {
    setFlag(`hotspot_used_${hotspot.id}`, true);
  }

  // 显示对话
  if (hotspot.dialogues && hotspot.dialogues.length > 0) {
    await showDialogueSequence(hotspot.dialogues);
  }

  // 根据热点类型执行动作
  switch (hotspot.type) {
    case 'evidence':
      if (hotspot.evidenceId) {
        const added = addEvidence(hotspot.evidenceId);
        if (added) {
          playSFX('evidence_obtain');
          const evData = getEvidenceData(hotspot.evidenceId);
          await showDialogue({
            speaker: 'system',
            text: `获得证据：${evData?.name || hotspot.evidenceId}`,
            type: 'normal'
          });
        }
      }
      break;

    case 'move':
      if (hotspot.targetScene) {
        playSFX('click');
        switchScene(hotspot.targetScene);
      }
      break;

    case 'talk':
      // 对话交互由 dialogueSystem + aiEngine 处理
      if (hotspot.characterId) {
        await _handleCharacterTalk(hotspot);
      }
      break;

    case 'examine':
      // Day3: 尝试使用 AI 增强场景调查
      if (isAPIAvailable() && hotspot.label) {
        try {
          const currentScene = getState().currentScene;
          const aiResult = await investigateAI({
            sceneId: currentScene,
            action: hotspot.label
          });
          if (aiResult && aiResult.description) {
            await showDialogue({
              speaker: 'narration',
              text: aiResult.description,
              type: 'narration'
            });
            if (aiResult.atmosphere) {
              await showDialogue({
                speaker: 'narration',
                text: aiResult.atmosphere,
                type: 'narration'
              });
            }
            // 如果 AI 发现了证据
            if (aiResult.foundEvidence && aiResult.foundEvidence.length > 0) {
              for (const evId of aiResult.foundEvidence) {
                const added = addEvidence(evId);
                if (added) {
                  const evData = getEvidenceData(evId);
                  await showDialogue({
                    speaker: 'system',
                    text: `获得证据：${evData?.name || evId}`,
                    type: 'normal'
                  });
                }
              }
            }
            break;
          }
        } catch (e) {
          console.warn('[sceneManager] AI 场景调查失败，使用预设对话:', e);
        }
      }
      // 离线模式：纯调查对话，已在上方显示
      break;
  }

  // 重新渲染热点（更新已获取证据的显示）
  const currentScene = getState().currentScene;
  if (currentScene && _scenesData[currentScene]) {
    _renderHotspots(_scenesData[currentScene].hotspots || []);
  }

  // 检查当前案件所有证据是否已收集完毕
  _checkAllEvidenceCollected();
}

/**
 * 检查当前案件所有证据是否收集完毕，完毕则提示玩家
 */
function _checkAllEvidenceCollected() {
  if (!_caseData?.scenes) return;
  const state = getState();

  // 收集当前案件所有场景中的证据 ID
  const allEvidenceIds = new Set();
  Object.values(_caseData.scenes).forEach(scene => {
    (scene.hotspots || []).forEach(h => {
      if (h.type === 'evidence' && h.evidenceId) {
        allEvidenceIds.add(h.evidenceId);
      }
    });
  });

  if (allEvidenceIds.size === 0) return;

  // 检查是否全部已获得
  const allCollected = [...allEvidenceIds].every(id => state.evidenceObtained.includes(id));
  if (allCollected && !getFlag('all_evidence_collected')) {
    setFlag('all_evidence_collected', true);
    setTimeout(async () => {
      await showDialogue({
        speaker: 'system',
        text: '【所有证据已收集完毕】你可以前往审讯室对嫌疑人进行审讯了。',
        type: 'normal'
      });
    }, 500);
  }
}

async function _handleCharacterTalk(hotspot) {
  // TODO: Day3 接入 AI 对话引擎后替换为动态对话
  // 目前使用预设对话
  const options = [
    { text: '继续调查', action: 'continue' },
  ];
  await showOptions(options);
  hideDialogueOverlay();
}

function _openSettings() {
  const overlay = document.getElementById('settings-overlay');
  if (!overlay) return;

  const settings = getSettings();
  const musicInput = document.getElementById('setting-music');
  const aiInput = document.getElementById('setting-ai');
  if (musicInput) musicInput.checked = settings.musicEnabled;
  if (aiInput) aiInput.checked = settings.aiEnabled;

  _updateSettingsStatus();
  overlay.classList.remove('hidden');
}

function _closeSettings() {
  const overlay = document.getElementById('settings-overlay');
  if (overlay) overlay.classList.add('hidden');
}

function _updateSettingsStatus() {
  const statusEl = document.getElementById('settings-status');
  if (!statusEl) return;
  const available = isAPIAvailable();
  statusEl.textContent = available ? 'AI 状态：在线（DeepSeek）' : 'AI 状态：离线（预设对话）';
  statusEl.style.color = available ? 'var(--neon-green)' : 'var(--neon-yellow)';
}

// ====================
// 全局按钮绑定
// ====================

function _bindGlobalActions() {
  // 使用事件委托处理所有 data-action 按钮
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;

    const action = btn.dataset.action;
    console.log(`[DEBUG] _bindGlobalActions 点击: action=${action}, btn=`, btn);
    playSFX('click');
    _handleGlobalAction(action, btn);
  });

  // 设置面板开关绑定
  const musicInput = document.getElementById('setting-music');
  const aiInput = document.getElementById('setting-ai');
  if (musicInput) {
    musicInput.addEventListener('change', (e) => {
      const enabled = e.target.checked;
      updateSettings({ musicEnabled: enabled });
      setMusicEnabled(enabled);
    });
  }
  if (aiInput) {
    aiInput.addEventListener('change', (e) => {
      const enabled = e.target.checked;
      updateSettings({ aiEnabled: enabled });
      setAIEnabled(enabled);
      _updateSettingsStatus();
    });
  }
}

async function _handleGlobalAction(action, btn) {
  console.log(`[DEBUG] _handleGlobalAction 进入: action=${action}, isDialogueBusy=${isDialogueBusy()}`);

  // 审讯相关操作：如果对话正在进行（如开场白），忽略点击避免冲突
  const interrogationActions = ['ask-question', 'pressure', 'present-evidence', 'combine-evidence', 'switch-suspect'];
  if (interrogationActions.includes(action) && isDialogueBusy()) {
    console.log(`[DEBUG] action=${action} 被拦截：对话进行中`);
    return;
  }

  switch (action) {
    case 'new-game':
      // 多案件扩展：从案件1开始全新流程
      resetState();
      await startCase(0);
      break;

    case 'continue':
      // 从存档继续游戏（支持多案件 gamePhase）
      _restoreFromSave();
      break;

    case 'start-investigation':
      // 进入第一个调查场景
      if (_scenesData) {
        const firstSceneId = Object.keys(_scenesData)[0];
        switchScene(firstSceneId);
      }
      break;

    case 'open-evidence':
      _toggleEvidenceOverlay(true);
      break;

    case 'close-evidence':
      _toggleEvidenceOverlay(false);
      break;

    case 'go-interrogation':
      // 进入审讯场景
      if (_caseData && _caseData.suspects && _caseData.suspects.length > 0) {
        await renderInterrogationScene(_caseData.suspects[0]);
      }
      break;

    case 'back-investigate': {
      // 返回调查场景
      const currentScene = getState().currentScene;
      if (currentScene) {
        switchScene(currentScene);
      }
      break;
    }

    case 'back-menu':
      switchScreen('menu');
      playBGM('menu');
      break;

    case 'quit-game':
      // 尝试关闭窗口（浏览器可能阻止，则提示玩家手动关闭）
      window.close();
      await showDialogue({
        speaker: 'system',
        text: '如果窗口没有自动关闭，请手动关闭浏览器标签页。感谢游玩！',
        type: 'normal'
      });
      break;

    case 'settings':
      _openSettings();
      break;

    case 'close-settings':
      _closeSettings();
      break;

    case 'back-hub':
      // 案件结局后返回事务所 Hub
      await endCaseAndReturnHub();
      break;

    case 'next-case':
      // Hub 画面"开始调查"按钮：进入下一个案件或最终结局
      await _handleNextFromHub();
      break;

    case 'review-case':
      // 回顾已结案件卷宗（显示简要摘要）
      await _handleReviewCases();
      break;

    case 'present-evidence':
      // Day2 已实现：出示证据功能
      _handlePresentEvidence();
      break;

    case 'combine-evidence':
      // Day2 已实现：组合证据功能
      _handleCombineEvidence();
      break;

    case 'ask-question':
      // Day2 已实现：审讯提问
      await _handleAskQuestion();
      break;

    case 'pressure':
      // Day2 已实现：施压嫌疑人
      await _handlePressure();
      break;

    case 'switch-suspect': {
      // 切换嫌疑人
      const targetId = btn?.dataset?.suspectId;
      console.log(`[DEBUG] switch-suspect: targetId=${targetId}, suspects=`, _caseData?.suspects?.map(s => typeof s === 'object' ? s.id : s));
      if (targetId && _caseData?.suspects) {
        const suspect = _caseData.suspects.find(s =>
          typeof s === 'object' ? s.id === targetId : s === targetId
        );
        console.log(`[DEBUG] switch-suspect: 找到嫌疑人=`, suspect);
        if (suspect) await renderInterrogationScene(suspect);
      } else {
        console.log(`[DEBUG] switch-suspect: targetId 或 suspects 为空`);
      }
      break;
    }

    case 'end-case':
      // Day4: 手动结束案件，根据当前评分触发结局
      await _handleEndCase();
      break;
  }
}

function _toggleEvidenceOverlay(show) {
  const overlay = document.getElementById('evidence-overlay');
  if (!overlay) return;

  if (show) {
    overlay.classList.remove('hidden');
    _renderEvidenceList();
  } else {
    overlay.classList.add('hidden');
  }
}

function _renderEvidenceList() {
  const listEl = document.getElementById('evidence-list');
  const state = getState();

  if (!listEl) return;

  listEl.innerHTML = '';

  if (state.evidenceObtained.length === 0) {
    listEl.innerHTML = '<p style="color: var(--text-dim); grid-column: 1/-1; text-align: center;">尚未获得证据</p>';
    return;
  }

  // 从 evidence.json 加载证据详情
  state.evidenceObtained.forEach(evidenceId => {
    const evData = getEvidenceData(evidenceId);
    const item = document.createElement('div');
    item.className = 'evidence-item';
    item.dataset.evidenceId = evidenceId;
    // icon 字段是图片路径，用 <img> 渲染
    const iconHtml = evData?.icon
      ? `<img class="evidence-item-icon" src="${evData.icon}" alt="${evData.name}" onerror="this.style.display='none';this.nextElementSibling.style.display='inline'"><span class="evidence-item-icon-fallback" style="display:none">📋</span>`
      : `<span class="evidence-item-icon">📋</span>`;
    item.innerHTML = `
      ${iconHtml}
      <div class="evidence-item-name">${evData ? evData.name : evidenceId}</div>
    `;
    item.addEventListener('click', () => _showEvidenceDetail(evidenceId));
    listEl.appendChild(item);
  });
}

function _showEvidenceDetail(evidenceId) {
  const detailEl = document.getElementById('evidence-detail');
  const nameEl = document.getElementById('evidence-detail-name');
  const descEl = document.getElementById('evidence-detail-desc');

  if (!detailEl) return;

  const evData = getEvidenceData(evidenceId);

  detailEl.classList.remove('hidden');

  // Day2 已修复：从 evidence.json 获取真实数据
  if (nameEl) nameEl.textContent = evData ? evData.name : evidenceId;
  if (descEl) descEl.textContent = evData ? evData.description : '证据详情暂缺';
}

// ====================
// 出示证据 & 组合证据（Day2 实现）
// ====================

async function _handlePresentEvidence() {
  const state = getState();
  const suspectId = state.currentSuspect;

  if (!suspectId) {
    await showDialogue({ speaker: 'system', text: '当前没有审讯对象。请先选择一名嫌疑人进行审讯。', type: 'normal' });
    return;
  }

  // 打开证据选择界面
  const overlay = document.getElementById('evidence-overlay');
  if (overlay) overlay.classList.remove('hidden');

  const listEl = document.getElementById('evidence-list');
  if (!listEl) return;

  // 渲染证据列表为可选择状态
  listEl.innerHTML = '';

  if (state.evidenceObtained.length === 0) {
    listEl.innerHTML = '<p style="color: var(--text-dim); grid-column: 1/-1; text-align: center;">尚未获得证据</p>';
    return;
  }

  state.evidenceObtained.forEach(evId => {
    const evData = getEvidenceData(evId);
    const item = document.createElement('div');
    item.className = 'evidence-item selectable';
    item.dataset.evidenceId = evId;
    const iconHtml = evData?.icon
      ? `<img class="evidence-item-icon" src="${evData.icon}" alt="${evData.name}" onerror="this.style.display='none';this.nextElementSibling.style.display='inline'"><span class="evidence-item-icon-fallback" style="display:none">📋</span>`
      : `<span class="evidence-item-icon">📋</span>`;
    item.innerHTML = `
      ${iconHtml}
      <div class="evidence-item-name">${evData ? evData.name : evId}</div>
      <div class="evidence-item-hint">点击出示</div>
    `;
    item.addEventListener('click', async () => {
      // 先关闭证据面板，再显示对话
      _toggleEvidenceOverlay(false);
      await _doPresentEvidence(suspectId, evId);
    });
    listEl.appendChild(item);
  });
}

async function _doPresentEvidence(suspectId, evidenceId) {
  // 去重检查：同一证据对同一嫌疑人只能出示一次
  const presentedFlag = `presented_${suspectId}_${evidenceId}`;
  if (getFlag(presentedFlag)) {
    await showDialogue({
      speaker: 'system',
      text: '这件证据已经向该嫌疑人出示过了，再出示也不会有新反应。',
      type: 'normal'
    });
    return;
  }

  await showDialogue({
    speaker: 'detective',
    text: `出示证据：${getEvidenceData(evidenceId)?.name || evidenceId}`,
    type: 'normal'
  });

  // 调用 evidenceSystem 的 presentEvidence
  const result = await evidencePresent(suspectId, evidenceId);

  // 标记已出示
  setFlag(presentedFlag, true);

  // 显示嫌疑人回应
  await showDialogue({
    speaker: suspectId,
    text: result.response,
    type: 'ai_generated',
    emotion: result.isContradiction ? 'nervous' : undefined
  });

  // 如果触发矛盾，显示提示
  if (result.isContradiction) {
    playSFX('contradiction');
    await showDialogue({
      speaker: 'system',
      text: `【压力值 +${result.stressDelta}】嫌疑人明显动摇了！`,
      type: 'narration'
    });
  }
}

async function _handleCombineEvidence() {
  const state = getState();

  if ((state.evidenceObtained?.length || 0) < 2) {
    await showDialogue({ speaker: 'system', text: '至少需要两件证据才能进行组合分析。', type: 'normal' });
    return;
  }

  // 打开证据选择界面，进入组合模式
  const overlay = document.getElementById('evidence-overlay');
  if (overlay) overlay.classList.remove('hidden');

  const listEl = document.getElementById('evidence-list');
  const detailEl = document.getElementById('evidence-detail');
  if (detailEl) detailEl.classList.add('hidden');

  // 显示组合提示
  const hintEl = document.getElementById('evidence-combine-hint') || (() => {
    const el = document.createElement('div');
    el.id = 'evidence-combine-hint';
    el.style.cssText = 'grid-column: 1/-1; color: var(--neon-cyan); font-size: 14px; margin-bottom: 8px;';
    return el;
  })();

  clearSelectedEvidence();

  // 重新渲染证据列表
  listEl.innerHTML = '';
  listEl.parentNode.insertBefore(hintEl, listEl);
  hintEl.innerHTML = '🔗 <strong>组合证据推理</strong>：选择两件证据，AI 会分析它们之间的关联并给出推理。成功的组合可加分并解锁新线索。';

  state.evidenceObtained.forEach(evId => {
    const evData = getEvidenceData(evId);
    const item = document.createElement('div');
    item.className = 'evidence-item';
    item.dataset.evidenceId = evId;
    const iconHtml = evData?.icon
      ? `<img class="evidence-item-icon" src="${evData.icon}" alt="${evData.name}" onerror="this.style.display='none';this.nextElementSibling.style.display='inline'"><span class="evidence-item-icon-fallback" style="display:none">📋</span>`
      : `<span class="evidence-item-icon">📋</span>`;
    item.innerHTML = `
      ${iconHtml}
      <div class="evidence-item-name">${evData ? evData.name : evId}</div>
      <div class="evidence-select-check">☐</div>
    `;

    item.addEventListener('click', () => {
      const selected = selectEvidence(evId);

      // 更新选中样式
      if (selected) {
        item.classList.add('selected');
        item.querySelector('.evidence-select-check').textContent = '✅';
      } else {
        item.classList.remove('selected');
        item.querySelector('.evidence-select-check').textContent = '☐';
      }

      // 检查是否已选够两件
      const selectedList = getSelectedEvidence();
      if (selectedList.length === 2) {
        hintEl.textContent = `🔗 已选：${getEvidenceData(selectedList[0])?.name} + ${getEvidenceData(selectedList[1])?.name} → 点击任意处确认组合`;
        // 延迟自动执行组合
        setTimeout(() => _doCombineEvidence(selectedList[0], selectedList[1]), 500);
      }
    });

    listEl.appendChild(item);
  });

  // 添加取消按钮
  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'option-btn';
  cancelBtn.textContent = '取消';
  cancelBtn.style.cssText = 'margin-top: 12px; grid-column: 1/-1;';
  cancelBtn.addEventListener('click', () => {
    _toggleEvidenceOverlay(false);
  });
  listEl.appendChild(cancelBtn);
}

async function _doCombineEvidence(ev1, ev2) {
  // 关闭证据面板
  _toggleEvidenceOverlay(false);

  const ev1Data = getEvidenceData(ev1);
  const ev2Data = getEvidenceData(ev2);

  await showDialogue({
    speaker: 'detective',
    text: `将${ev1Data?.name}和${ev2Data?.name}放在一起思考...`,
    type: 'thought'
  });

  // 调用 evidenceSystem 的 combineEvidence
  const result = await evidenceCombine(ev1, ev2);

  // 根据组合是否成功播放不同音效
  if (result.isRelevant) {
    playSFX('contradiction');
  } else {
    playSFX('click');
  }

  // 显示推理结果（成功/失败有明确标识）
  await showDialogue({
    speaker: 'ai_assistant',
    text: result.isRelevant
      ? `🔗 【组合成功】${result.insight}`
      : `🔗 【无关联】${result.insight}`,
    type: 'ai_generated'
  });

  // 成功组合显示加分提示
  if (result.isRelevant) {
    await showDialogue({
      speaker: 'system',
      text: '【推理评分 +7】证据之间的关联被揭示。',
      type: 'narration'
    });
  }

  // 如果解锁了新证据
  if (result.unlocksEvidence) {
    const newEvData = getEvidenceData(result.unlocksEvidence);
    playSFX('evidence_obtain');
    await showDialogue({
      speaker: 'system',
      text: `🔓 发现新证据：${newEvData?.name || result.unlocksEvidence}`,
      type: 'normal'
    });
  }
}

// ====================
// 获取场景列表
// ====================

/**
 * 获取所有场景 ID
 * @returns {string[]}
 */
export function getSceneIds() {
  return _scenesData ? Object.keys(_scenesData) : [];
}

/**
 * 获取指定场景数据
 * @param {string} sceneId
 * @returns {Object|null}
 */
export function getScene(sceneId) {
  return _scenesData ? _scenesData[sceneId] || null : null;
}
