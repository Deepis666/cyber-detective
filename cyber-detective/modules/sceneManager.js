/**
 * sceneManager.js - 场景管理
 * 赛博朋克侦探叙事游戏
 *
 * 负责场景切换、调查场景热点渲染、审讯场景布局。
 * 场景数据从 data/ 目录加载。
 */

import { setPhase, setCurrentScene, setCurrentSuspect, addEvidence, getFlag, setFlag, getState } from './gameState.js';
import { showDialogue, showDialogueSequence, showOptions, hideDialogueOverlay, showDialogueOverlay } from './dialogueSystem.js';

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
 * @param {Object} suspect - 嫌疑人数据
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

  console.log(`[sceneManager] 进入审讯: ${suspect.name}`);
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
      // TODO: Day3 实现证据出示逻辑
      console.log('[sceneManager] 出示证据（待实现）');
      break;

    case 'combine-evidence':
      // TODO: Day3 实现证据组合逻辑
      console.log('[sceneManager] 组合证据（待实现）');
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

  // TODO: 从 evidence.json 加载证据详情
  state.evidenceObtained.forEach(evidenceId => {
    const item = document.createElement('div');
    item.className = 'evidence-item';
    item.dataset.evidenceId = evidenceId;
    item.innerHTML = `
      <div class="evidence-item-icon">📋</div>
      <div class="evidence-item-name">${evidenceId}</div>
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

  detailEl.classList.remove('hidden');

  // TODO: 从 evidence.json 获取真实数据
  if (nameEl) nameEl.textContent = evidenceId;
  if (descEl) descEl.textContent = '证据详情待填充...';
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
