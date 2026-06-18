/**
 * gameState.js - 全局状态管理（双层状态架构）
 * 赛博朋克侦探叙事游戏
 *
 * 状态分为两层：
 *   - 跨案件层（持久化，不随案件切换重置）：gamePhase / currentCaseIndex / casesResults / unlockedHiddenCase / globalFlags
 *   - 单案件层（切换案件时重置）：currentPhase / currentScene / currentSuspect / evidenceObtained / stressLevel / score ...
 *
 * 状态变更通过 updateState/专用方法进行，支持 LocalStorage 持久化。
 */

// ====================
// 常量
// ====================
const STORAGE_KEY = 'cyber_detective_save';
const STRESS_EMOTION_THRESHOLD = {
  calm: { min: 0, max: 33 },
  nervous: { min: 34, max: 66 },
  broken: { min: 67, max: 100 }
};

// 主线案件数量（不含隐藏案件）
const TOTAL_MAIN_CASES = 3;
// 好结局分数阈值
const GOOD_ENDING_SCORE = 80;

// ====================
// 单案件层默认状态（切换案件时重置为此）
// ====================
const defaultSingleCaseState = {
  currentPhase: 'intro',       // 'intro' | 'investigate' | 'interrogation' | 'ending'
  currentScene: null,          // 当前调查场景 ID
  currentSuspect: null,        // 当前审讯嫌疑人 ID
  evidenceObtained: [],        // 已获得证据 ID 列表
  evidenceExamined: [],        // 已查看证据 ID 列表
  dialogueHistory: [],         // 对话历史（用于 AI 上下文）
  stressLevel: {},             // 各嫌疑人压力值 0-100（按案件动态填充）
  score: 0,                    // 推理评分
  endingTriggered: null,       // 触发的结局 ID
  flags: {}                    // 单案件剧情标记
};

// ====================
// 完整默认状态（跨案件层 + 单案件层）
// ====================
const defaultState = {
  // === 跨案件层 ===
  gamePhase: 'menu',           // 'menu'|'briefing'|'investigate'|'interrogation'|'hub'|'ending'|'final_ending'
  currentCaseIndex: -1,        // 当前案件序号 0/1/2/3（-1 表示未开始）
  casesResults: [],            // [{ caseId, ending, score, keyFlags }]
  unlockedHiddenCase: false,   // 是否解锁隐藏案件
  globalFlags: {},             // 跨案件剧情标记

  // === 单案件层 ===
  ...JSON.parse(JSON.stringify(defaultSingleCaseState))
};

// ====================
// 内部状态（深拷贝自 defaultState）
// ====================
let _state = JSON.parse(JSON.stringify(defaultState));

// ====================
// 状态变更监听器
// ====================
const _listeners = [];

/**
 * 注册状态变更监听器
 * @param {Function} callback - 回调函数，接收 (newState, patch) 参数
 * @returns {Function} 取消监听函数
 */
export function onStateChange(callback) {
  _listeners.push(callback);
  return () => {
    const idx = _listeners.indexOf(callback);
    if (idx > -1) _listeners.splice(idx, 1);
  };
}

function _notify(patch) {
  const snapshot = getState();
  _listeners.forEach(fn => {
    try { fn(snapshot, patch); }
    catch (e) { console.error('[gameState] listener error:', e); }
  });
}

// ====================
// 深拷贝工具
// ====================
function _deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

// ====================
// Public API - 基础读写
// ====================

/**
 * 获取当前完整状态（深拷贝，外部修改不影响内部）
 * @returns {Object} state
 */
export function getState() {
  return _deepClone(_state);
}

/**
 * 更新状态（支持局部合并）
 * @param {Object} patch - 要合并的状态片段
 * @returns {Object} 更新后的完整状态
 */
export function updateState(patch) {
  if (!patch || typeof patch !== 'object') {
    console.warn('[gameState] updateState: patch must be an object');
    return getState();
  }

  // 特殊处理数组字段：替换而非合并
  const arrayKeys = ['evidenceObtained', 'evidenceExamined', 'dialogueHistory', 'casesResults'];
  for (const key of arrayKeys) {
    if (patch[key] !== undefined) {
      _state[key] = patch[key];
      delete patch[key];
    }
  }

  // 特殊处理嵌套对象：浅合并
  const objectKeys = ['stressLevel', 'flags', 'globalFlags'];
  for (const key of objectKeys) {
    if (patch[key] !== undefined && typeof patch[key] === 'object') {
      _state[key] = { ..._state[key], ...patch[key] };
      delete patch[key];
    }
  }

  // 其余字段直接覆盖
  Object.assign(_state, patch);

  _notify(patch);
  return getState();
}

// ====================
// Public API - 单案件层操作
// ====================

/**
 * 添加证据
 * @param {string} evidenceId
 * @returns {boolean} 是否新增成功（已存在返回 false）
 */
export function addEvidence(evidenceId) {
  if (!evidenceId) return false;
  if (_state.evidenceObtained.includes(evidenceId)) return false;

  _state.evidenceObtained.push(evidenceId);
  _notify({ evidenceObtained: _state.evidenceObtained });
  return true;
}

/**
 * 标记证据已查看
 * @param {string} evidenceId
 * @returns {boolean}
 */
export function markEvidenceExamined(evidenceId) {
  if (!evidenceId) return false;
  if (_state.evidenceExamined.includes(evidenceId)) return false;

  _state.evidenceExamined.push(evidenceId);
  _notify({ evidenceExamined: _state.evidenceExamined });
  return true;
}

/**
 * 增加嫌疑人压力值
 * @param {string} suspectId
 * @param {number} delta - 增量（可负）
 * @returns {number} 更新后的压力值
 */
export function addStress(suspectId, delta) {
  if (!_state.stressLevel.hasOwnProperty(suspectId)) {
    _state.stressLevel[suspectId] = 0;
  }

  _state.stressLevel[suspectId] = Math.max(0, Math.min(100,
    _state.stressLevel[suspectId] + delta
  ));

  _notify({ stressLevel: { [suspectId]: _state.stressLevel[suspectId] } });
  return _state.stressLevel[suspectId];
}

/**
 * 获取嫌疑人当前情绪标签
 * @param {string} suspectId
 * @returns {string} 'calm' | 'nervous' | 'broken'
 */
export function getEmotion(suspectId) {
  const stress = _state.stressLevel[suspectId] || 0;

  if (stress >= STRESS_EMOTION_THRESHOLD.broken.min) return 'broken';
  if (stress >= STRESS_EMOTION_THRESHOLD.nervous.min) return 'nervous';
  return 'calm';
}

/**
 * 获取嫌疑人压力值
 * @param {string} suspectId
 * @returns {number}
 */
export function getStress(suspectId) {
  return _state.stressLevel[suspectId] || 0;
}

/**
 * 推进评分
 * @param {number} delta
 * @returns {number} 更新后的分数
 */
export function addScore(delta) {
  _state.score = Math.max(0, _state.score + delta);
  _notify({ score: _state.score });
  return _state.score;
}

/**
 * 设置单案件剧情标记
 * @param {string} flag
 * @param {any} value
 */
export function setFlag(flag, value) {
  _state.flags[flag] = value;
  _notify({ flags: { [flag]: value } });
}

/**
 * 获取单案件剧情标记
 * @param {string} flag
 * @returns {any}
 */
export function getFlag(flag) {
  return _state.flags[flag];
}

/**
 * 设置跨案件剧情标记
 * @param {string} flag
 * @param {any} value
 */
export function setGlobalFlag(flag, value) {
  _state.globalFlags[flag] = value;
  _notify({ globalFlags: { [flag]: value } });
}

/**
 * 获取跨案件剧情标记
 * @param {string} flag
 * @returns {any}
 */
export function getGlobalFlag(flag) {
  return _state.globalFlags[flag];
}

/**
 * 添加对话到历史（用于 AI 上下文）
 * @param {string} role - 'user' | 'assistant' | 'system'
 * @param {string} content
 */
export function addDialogueToHistory(role, content) {
  _state.dialogueHistory.push({ role, content, timestamp: Date.now() });
  // 限制历史长度，保留最近 50 条
  if (_state.dialogueHistory.length > 50) {
    _state.dialogueHistory = _state.dialogueHistory.slice(-50);
  }
  _notify({ dialogueHistory: _state.dialogueHistory });
}

/**
 * 获取对话历史（用于 API 请求）
 * @returns {Array<{role: string, content: string}>}
 */
export function getDialogueHistory() {
  return _state.dialogueHistory.map(({ role, content }) => ({ role, content }));
}

/**
 * 清空对话历史
 */
export function clearDialogueHistory() {
  _state.dialogueHistory = [];
  _notify({ dialogueHistory: [] });
}

/**
 * 设置当前阶段（单案件层）
 * @param {string} phase - 'intro' | 'investigate' | 'interrogation' | 'ending'
 */
export function setPhase(phase) {
  _state.currentPhase = phase;
  _notify({ currentPhase: phase });
}

/**
 * 设置当前场景
 * @param {string|null} sceneId
 */
export function setCurrentScene(sceneId) {
  _state.currentScene = sceneId;
  _notify({ currentScene: sceneId });
}

/**
 * 设置当前审讯嫌疑人
 * @param {string|null} suspectId
 */
export function setCurrentSuspect(suspectId) {
  _state.currentSuspect = suspectId;
  _notify({ currentSuspect: suspectId });
}

/**
 * 设置触发的结局
 * @param {string|null} endingId
 */
export function setEnding(endingId) {
  _state.endingTriggered = endingId;
  _notify({ endingTriggered: endingId });
}

// ====================
// Public API - 跨案件层操作（多案件扩展新增）
// ====================

/**
 * 设置游戏全局阶段（跨案件层）
 * @param {string} phase - 'menu'|'briefing'|'investigate'|'interrogation'|'hub'|'ending'|'final_ending'
 */
export function setGamePhase(phase) {
  _state.gamePhase = phase;
  _notify({ gamePhase: phase });
}

/**
 * 获取游戏全局阶段
 * @returns {string}
 */
export function getGamePhase() {
  return _state.gamePhase;
}

/**
 * 获取当前案件序号
 * @returns {number}
 */
export function getCurrentCaseIndex() {
  return _state.currentCaseIndex;
}

/**
 * 获取所有案件结果
 * @returns {Array}
 */
export function getCasesResults() {
  return _deepClone(_state.casesResults);
}

/**
 * 获取指定案件结果
 * @param {number} caseIndex
 * @returns {Object|null}
 */
export function getCaseResult(caseIndex) {
  return _state.casesResults[caseIndex] || null;
}

/**
 * 初始化新案件的嫌疑人压力值
 * @param {Array<string>} suspectIds
 */
export function initSuspectStress(suspectIds) {
  _state.stressLevel = {};
  suspectIds.forEach(id => {
    _state.stressLevel[id] = 0;
  });
  _notify({ stressLevel: _state.stressLevel });
}

/**
 * 开始一个新案件（重置单案件层，保留跨案件层）
 * @param {number} caseIndex - 案件序号 0/1/2/3
 * @returns {Object} 重置后的完整状态
 */
export function startNewCase(caseIndex) {
  // 保留跨案件层字段
  const crossCase = {
    gamePhase: _state.gamePhase,
    currentCaseIndex: caseIndex,
    casesResults: _state.casesResults,
    unlockedHiddenCase: _state.unlockedHiddenCase,
    globalFlags: _state.globalFlags
  };

  // 重置单案件层
  _state = {
    ...crossCase,
    ...JSON.parse(JSON.stringify(defaultSingleCaseState))
  };

  console.log(`[gameState] 开始新案件: caseIndex=${caseIndex}`);
  _notify({});
  return getState();
}

/**
 * 记录当前案件结果（结案时调用）
 * @param {Object} result - { caseId, ending, score, keyFlags }
 * @returns {Object} 更新后的 casesResults
 */
export function recordCaseResult(result) {
  const caseIndex = _state.currentCaseIndex;
  // 确保 casesResults 数组长度足够
  while (_state.casesResults.length <= caseIndex) {
    _state.casesResults.push(null);
  }
  _state.casesResults[caseIndex] = {
    caseId: result.caseId,
    ending: result.ending,
    score: result.score || _state.score,
    keyFlags: result.keyFlags || {},
    completedAt: new Date().toISOString()
  };

  _notify({ casesResults: _state.casesResults });
  console.log(`[gameState] 记录案件结果: case ${caseIndex} => ${result.ending} (score ${result.score})`);
  return getCasesResults();
}

/**
 * 检查是否解锁隐藏案件（前3个主线案件全部达成好结局）
 * @returns {boolean} 是否解锁
 */
export function checkHiddenCaseUnlock() {
  // 检查前 TOTAL_MAIN_CASES 个案件是否全部达成好结局
  if (_state.casesResults.length < TOTAL_MAIN_CASES) {
    _state.unlockedHiddenCase = false;
    return false;
  }

  const allGood = _state.casesResults
    .slice(0, TOTAL_MAIN_CASES)
    .every(r => r && r.ending === 'ending_good' && r.score >= GOOD_ENDING_SCORE);

  _state.unlockedHiddenCase = allGood;
  _notify({ unlockedHiddenCase: allGood });
  console.log(`[gameState] 隐藏案件解锁检查: ${allGood ? '已解锁' : '未达成'}`);
  return allGood;
}

/**
 * 获取最终结局类型（根据全部案件结果累积）
 * @returns {string} 'all_good' | 'mixed' | 'all_bad'
 */
export function getFinalEndingType() {
  const results = _state.casesResults.slice(0, TOTAL_MAIN_CASES);
  if (results.length < TOTAL_MAIN_CASES) return 'mixed';

  const allGood = results.every(r => r && r.ending === 'ending_good');
  const allBad = results.every(r => r && r.ending === 'ending_bad');

  if (allGood) return 'all_good';
  if (allBad) return 'all_bad';
  return 'mixed';
}

/**
 * 判断是否已通关全部主线案件
 * @returns {boolean}
 */
export function isAllMainCasesCompleted() {
  return _state.casesResults.slice(0, TOTAL_MAIN_CASES).every(r => r !== null);
}

// ====================
// 存档 / 读档
// ====================

/**
 * 重置状态到默认（完全重置，新游戏）
 */
export function resetState() {
  _state = JSON.parse(JSON.stringify(defaultState));
  _notify({});
}

/**
 * 存档到 LocalStorage
 * @returns {boolean} 是否成功
 */
export function saveGame() {
  try {
    const data = {
      state: _deepClone(_state),
      savedAt: new Date().toISOString(),
      version: 2
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    console.error('[gameState] 存档失败:', e);
    return false;
  }
}

/**
 * 从 LocalStorage 读档
 * @returns {Object|null} 存档数据（含 state 和 savedAt），无存档返回 null
 */
export function loadGame() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const data = JSON.parse(raw);
    if (data && data.state) {
      // 兼容旧版存档：补充缺失的跨案件层字段
      const merged = {
        ...JSON.parse(JSON.stringify(defaultState)),
        ...data.state
      };
      // 确保跨案件层字段存在
      if (!merged.gamePhase) merged.gamePhase = 'menu';
      if (!Array.isArray(merged.casesResults)) merged.casesResults = [];
      if (!merged.globalFlags) merged.globalFlags = {};
      _state = merged;
      _notify({});
      console.log('[gameState] 读档成功，gamePhase:', _state.gamePhase, '存档时间:', data.savedAt);
      return data;
    }
    return null;
  } catch (e) {
    console.error('[gameState] 读档失败:', e);
    return null;
  }
}

/**
 * 检查是否有存档
 * @returns {boolean}
 */
export function hasSaveData() {
  return !!localStorage.getItem(STORAGE_KEY);
}

/**
 * 删除存档
 */
export function deleteSave() {
  localStorage.removeItem(STORAGE_KEY);
  console.log('[gameState] 存档已删除');
}
