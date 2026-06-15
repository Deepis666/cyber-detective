/**
 * gameState.js - 全局状态管理
 * 赛博朋克侦探叙事游戏
 *
 * 负责管理游戏所有运行时状态，提供统一的读写接口。
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

// ====================
// 默认状态
// ====================
const defaultState = {
  currentPhase: 'intro',       // 'intro' | 'investigate' | 'interrogation' | 'ending'
  currentScene: null,          // 当前调查场景 ID
  currentSuspect: null,        // 当前审讯嫌疑人 ID
  evidenceObtained: [],        // 已获得证据 ID 列表
  evidenceExamined: [],        // 已查看证据 ID 列表
  dialogueHistory: [],         // 对话历史（用于 AI 上下文）
  stressLevel: {               // 各嫌疑人压力值 0-100
    suspect_001: 0,
    suspect_002: 0
  },
  score: 0,                    // 推理评分
  endingTriggered: null,       // 触发的结局 ID
  flags: {}                    // 剧情标记
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
// Public API
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
  const arrayKeys = ['evidenceObtained', 'evidenceExamined', 'dialogueHistory'];
  for (const key of arrayKeys) {
    if (patch[key] !== undefined) {
      _state[key] = patch[key];
      delete patch[key];
    }
  }

  // 特殊处理嵌套对象：浅合并
  const objectKeys = ['stressLevel', 'flags'];
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
    console.warn(`[gameState] addStress: unknown suspect ${suspectId}`);
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
 * 设置剧情标记
 * @param {string} flag
 * @param {any} value
 */
export function setFlag(flag, value) {
  _state.flags[flag] = value;
  _notify({ flags: { [flag]: value } });
}

/**
 * 获取剧情标记
 * @param {string} flag
 * @returns {any}
 */
export function getFlag(flag) {
  return _state.flags[flag];
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
 * 设置当前阶段
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

/**
 * 重置状态到默认
 */
export function resetState() {
  _state = JSON.parse(JSON.stringify(defaultState));
  _notify({});
}

// ====================
// 存档 / 读档
// ====================

/**
 * 存档到 LocalStorage
 * @returns {boolean} 是否成功
 */
export function saveGame() {
  try {
    const data = {
      state: _deepClone(_state),
      savedAt: new Date().toISOString()
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    console.log('[gameState] 游戏已存档');
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
      _state = data.state;
      _notify({});
      console.log('[gameState] 读档成功，存档时间:', data.savedAt);
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
