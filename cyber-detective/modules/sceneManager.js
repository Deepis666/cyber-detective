/**
 * sceneManager.js - 场景管理
 * 赛博朋克侦探叙事游戏
 *
 * 负责场景切换、调查场景热点渲染、审讯场景布局。
 * 场景数据从 data/ 目录加载。
 */

import { setPhase, setCurrentScene, setCurrentSuspect, addEvidence, getFlag, setFlag, getState } from './gameState.js';
import { showDialogue, showDialogueSequence, showOptions, hideDialogueOverlay, showDialogueOverlay } from './dialogueSystem.js';
import { getEvidenceData, presentEvidence as evidencePresent, combineEvidence as evidenceCombine, selectEvidence, getSelectedEvidence, clearSelectedEvidence, renderEvidenceBar } from './evidenceSystem.js';

// ====================
// 场景数据缓存
// ====================
let _scenesData = null;
let _caseData = null;

// ====================
// 当前场景热点
// ====================
let _currentHotspots = [];

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
 */
export function initSceneManager(scenesData, caseData) {
  _scenesData = scenesData;
  _caseData = caseData;

  _elements = {
    loadingScreen: document.getElementById('loading-screen'),
    menuScreen: document.getElementById('menu-screen'),
    briefingScreen: document.getElementById('briefing-screen'),
    investigateScreen: document.getElementById('investigate-screen'),
    interrogationScreen: document.getElementById('interrogation-screen'),
    endingScreen: document.getElementById('ending-screen'),
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
  console.log('[sceneManager] 场景管理器初始化完成');
}

// ====================
// 场景切换
// ====================

/**
 * 切换到指定画面
 * @param {string} screenName - 'loading' | 'menu' | 'briefing' | 'investigate' | 'interrogation' | 'ending'
 */
export function switchScreen(screenName) {
  const screenMap = {
    'loading': _elements.loadingScreen,
    'menu': _elements.menuScreen,
    'briefing': _elements.briefingScreen,
    'investigate': _elements.investigateScreen,
    'interrogation': _elements.interrogationScreen,
    'ending': _elements.endingScreen,
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
export function switchScene(sceneId) {
  if (!_scenesData || !_scenesData[sceneId]) {
    console.error(`[sceneManager] 场景数据不存在: ${sceneId}`);
    return;
  }

  setCurrentScene(sceneId);
  setPhase('investigate');
  switchScreen('investigate');

  const scene = _scenesData[sceneId];

  // 设置场景背景
  _renderSceneBackground(scene);

  // 渲染热点
  _renderHotspots(scene.hotspots || []);

  // 隐藏对话框
  hideDialogueOverlay();

  // 显示场景描述
  if (scene.description) {
    showDialogue({
      speaker: 'narration',
      text: scene.description,
      type: 'narration'
    });
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

  const state = getState();

  hotspots.forEach(hotspot => {
    // 检查是否已被获取（证据类热点）
    if (hotspot.type === 'evidence' && state.evidenceObtained.includes(hotspot.evidenceId)) {
      return; // 已获取，不再显示
    }

    // 检查是否需要标记（一次性热点）
    if (hotspot.once && getFlag(`hotspot_used_${hotspot.id}`)) {
      return;
    }

    const el = document.createElement('div');
    el.className = 'hotspot';
    el.dataset.id = hotspot.id;
    el.dataset.type = hotspot.type;

    // 定位
    if (hotspot.position) {
      el.style.top = hotspot.position.top;
      el.style.left = hotspot.position.left;
      el.style.width = hotspot.position.width;
      el.style.height = hotspot.position.height;
    } else {
      // 默认位置
      el.style.top = '30%';
      el.style.left = '30%';
      el.style.width = '80px';
      el.style.height = '80px';
    }

    // 标签
    if (hotspot.label) {
      el.title = hotspot.label;
      el.setAttribute('aria-label', hotspot.label);
    }

    // 点击事件
    el.addEventListener('click', () => _handleHotspotClick(hotspot));

    _elements.sceneHotspots.appendChild(el);
    _currentHotspots.push(hotspot);
  });
}

/**
 * 渲染审讯场景
 * @param {Object} suspect - 嫌疑人数据（来自 characters.json 的角色对象）
 */
export function renderInterrogationScene(suspect) {
  if (!suspect) return;

  setCurrentSuspect(suspect.id);
  setPhase('interrogation');
  switchScreen('interrogation');

  // 设置角色立绘
  if (suspect.portrait) {
    _elements.characterPortrait.src = suspect.portrait;
    _elements.characterPortrait.style.display = 'block';
  } else {
    _elements.characterPortrait.style.display = 'none';
  }

  // 更新压力条
  _updateStressDisplay(suspect.id);

  // Day2 已实现：渲染嫌疑人选择器 + 审讯开场对话
  _renderSuspectSelector(suspect.id);

  // 播放审讯开场对话（使用 dialogues.json 数据）
  _playInterrogationOpening(suspect.id);

  console.log(`[sceneManager] 进入审讯: ${suspect.name}`);
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

async function _playInterrogationOpening(suspectId) {
  // 尝试从全局 dialoguesData 中获取开场白
  // 通过 main.js 注入的数据访问（使用 _caseData 或全局方式）
  if (typeof window._dialoguesData !== 'undefined' && window._dialoguesData.dialogues?.interrogation_opening?.[suspectId]) {
    const openingDialogues = window._dialoguesData.dialogues.interrogation_opening[suspectId];
    await showDialogueSequence(openingDialogues);
  }
}

// Day2：提问处理
async function _handleAskQuestion() {
  const state = getState();
  const suspectId = state.currentSuspect;

  if (!suspectId) return;

  // 获取该嫌疑人的问题列表
  if (typeof window._dialoguesData !== 'undefined' && window._dialoguesData.dialogues?.interrogation_questions?.[suspectId]) {
    const questions = window._dialoguesData.dialogues.interrogation_questions[suspectId];

    // 过滤需要证据才能解锁的问题
    const availableQuestions = questions.filter(q => {
      if (!q.requiresEvidence) return true;
      return state.evidenceObtained.includes(q.requiresEvidence);
    });

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

    const choice = await showOptions(options);

    // 根据问题类型生成回应（Day2 使用预设回应）
    await _generateQuestionResponse(suspectId, choice, state);
  }
}

// Day2：施压处理
async function _handlePressure() {
  const state = getState();
  const suspectId = state.currentSuspect;

  if (!suspectId) return;

  const stress = state.stressLevel[suspectId] || 0;

  await showDialogue({
    speaker: 'detective',
    text: '我给你最后一次机会，说出真相！',
    type: 'normal'
  });

  // 施压增加压力值
  addStress(suspectId, 15);
  updateStressDisplay(suspectId);

  // 根据压力等级给出不同回应
  let emotion = 'calm';
  let responseText = '';
  const newStress = Math.min(100, stress + 15);

  if (newStress >= 67) {
    emotion = 'broken';
    responseText = '你...你别逼我！我说...我什么都说了！';
  } else if (newStress >= 34) {
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
    text: `【压力值 ${stress} → ${newStress}】`,
    type: 'narration'
  });

  // 检查是否触发结局条件
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
    stressDelta = 25;
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
    responseText = '我和陈医生的关系就是普通的师徒关系。他教我技术，我帮他干活。就这么简单。';
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
    addScore(20); // 戳穿谎言加分
  }

  // 检查结局
  _checkEndingCondition(getState());
}

// Day2：检查结局触发条件
function _checkEndingCondition(state) {
  const score = state.score || 0;
  const stress = state.stressLevel[state.currentSuspect] || 0;

  // 如果推理评分足够高且嫌疑人崩溃
  if (score >= 80 && stress >= 67) {
    // 触发好结局
    setTimeout(() => _triggerEnding('ending_good', score), 500);
  } else if (score < 40 && stress < 34) {
    // 触发坏结局（玩家操作太差或没有进展）
    // 不自动触发，等用户主动结束
  }
}

// Day2：触发结局
async function _triggerEnding(endingId, score) {
  if (!_caseData?.endings?.[endingId]) return;

  const ending = _caseData.endings[endingId];
  renderEnding({ title: ending.title, text: ending.description, score });
}

/**
 * 更新压力条显示
 * @param {string} suspectId
 */
export function updateStressDisplay(suspectId) {
  _updateStressDisplay(suspectId);
}

function _updateStressDisplay(suspectId) {
  const state = getState();
  const stress = state.stressLevel[suspectId] || 0;

  if (_elements.stressBarFill) {
    _elements.stressBarFill.style.width = `${stress}%`;
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
    _elements.briefingSetting.innerHTML = `
      <h4>案件背景</h4>
      <p>${_caseData.setting || ''}</p>
    `;
  }
  if (_elements.briefingVictim) {
    _elements.briefingVictim.innerHTML = `
      <h4>受害者</h4>
      <p>${_caseData.victim || ''}</p>
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
  switchScreen('ending');

  const titleEl = document.getElementById('ending-title');
  const textEl = document.getElementById('ending-text');
  const scoreEl = document.getElementById('ending-score');

  if (titleEl) titleEl.textContent = ending.title || '结局';
  if (textEl) textEl.textContent = ending.text || '';
  if (scoreEl) scoreEl.textContent = `推理评分: ${ending.score || 0}`;
}

// ====================
// 热点交互
// ====================

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
          await showDialogue({
            speaker: 'system',
            text: `获得证据：${hotspot.evidenceName || hotspot.evidenceId}`,
            type: 'normal'
          });
        }
      }
      break;

    case 'move':
      if (hotspot.targetScene) {
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
      // 纯调查对话，已在上方显示
      break;
  }

  // 重新渲染热点（更新已获取证据的显示）
  const currentScene = getState().currentScene;
  if (currentScene && _scenesData[currentScene]) {
    _renderHotspots(_scenesData[currentScene].hotspots || []);
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

// ====================
// 全局按钮绑定
// ====================

function _bindGlobalActions() {
  // 使用事件委托处理所有 data-action 按钮
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;

    const action = btn.dataset.action;
    _handleGlobalAction(action, btn);
  });
}

async function _handleGlobalAction(action, btn) {
  switch (action) {
    case 'new-game':
      switchScreen('briefing');
      renderBriefing();
      break;

    case 'continue':
      // TODO: 从存档继续
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
        renderInterrogationScene(_caseData.suspects[0]);
      }
      break;

    case 'back-investigate':
      // 返回调查场景
      const currentScene = getState().currentScene;
      if (currentScene) {
        switchScene(currentScene);
      }
      break;

    case 'back-menu':
      switchScreen('menu');
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

    case 'switch-suspect':
      // 切换嫌疑人
      const targetId = btn?.dataset?.suspectId;
      if (targetId && _caseData) {
        const suspect = _caseData.suspects?.find(s => s.id === targetId);
        if (suspect) renderInterrogationScene(suspect);
      }
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

  // TODO: 从 evidence.json 加载证据详情 - Day2 已修复
  state.evidenceObtained.forEach(evidenceId => {
    const evData = getEvidenceData(evidenceId);
    const item = document.createElement('div');
    item.className = 'evidence-item';
    item.dataset.evidenceId = evidenceId;
    item.innerHTML = `
      <div class="evidence-item-icon">${evData ? evData.icon : '📋'}</div>
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
    item.innerHTML = `
      <div class="evidence-item-icon">${evData ? evData.icon : '📋'}</div>
      <div class="evidence-item-name">${evData ? evData.name : evId}</div>
      <div class="evidence-item-hint">点击出示</div>
    `;
    item.addEventListener('click', async () => {
      await _doPresentEvidence(suspectId, evId);
      // 关闭证据面板
      _toggleEvidenceOverlay(false);
    });
    listEl.appendChild(item);
  });
}

async function _doPresentEvidence(suspectId, evidenceId) {
  await showDialogue({
    speaker: 'detective',
    text: `出示证据：${getEvidenceData(evidenceId)?.name || evidenceId}`,
    type: 'normal'
  });

  // 调用 evidenceSystem 的 presentEvidence
  const result = await evidencePresent(suspectId, evidenceId);

  // 显示嫌疑人回应
  await showDialogue({
    speaker: suspectId,
    text: result.response,
    type: 'ai_generated',
    emotion: result.isContradiction ? 'nervous' : undefined
  });

  // 如果触发矛盾，显示提示
  if (result.isContradiction) {
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
  hintEl.textContent = '🔗 选择两件证据进行组合推理...';

  state.evidenceObtained.forEach(evId => {
    const evData = getEvidenceData(evId);
    const item = document.createElement('div');
    item.className = 'evidence-item';
    item.dataset.evidenceId = evId;
    item.innerHTML = `
      <div class="evidence-item-icon">${evData ? evData.icon : '📋'}</div>
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

  // 显示推理结果
  await showDialogue({
    speaker: 'ai_assistant',
    text: result.insight,
    type: 'ai_generated'
  });

  // 如果解锁了新证据
  if (result.unlocksEvidence) {
    const newEvData = getEvidenceData(result.unlocksEvidence);
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
