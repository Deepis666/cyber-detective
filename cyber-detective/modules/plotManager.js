/**
 * plotManager.js - 主线剧情管理
 * 赛博朋克侦探叙事游戏
 *
 * 负责加载 plot.json、根据前案结果计算剧情分支、
 * 提供事务所 Hub 对话序列、新闻简报、最终结局文本。
 *
 * 数据依赖：data/plot.json（由 B 组填充内容，A 组已定义结构）
 */

import { getCasesResults, getCurrentCaseIndex, getFinalEndingType, checkHiddenCaseUnlock, isAllMainCasesCompleted, getState } from './gameState.js';

// ====================
// 剧情数据缓存
// ====================
let _plotData = null;

// 案件序号 → Hub 对话/新闻 key 映射
const CASE_HUB_KEY = ['after_case_001', 'after_case_002', 'after_case_003'];

// ====================
// 初始化
// ====================

/**
 * 初始化主线剧情管理器
 * @param {Object} plotData - data/plot.json 数据
 */
export function initPlotManager(plotData) {
  _plotData = plotData;
  console.log('[plotManager] 主线剧情管理器初始化完成');
}

/**
 * 获取 plot 数据
 * @returns {Object|null}
 */
export function getPlotData() {
  return _plotData;
}

// ====================
// Hub 对话
// ====================

/**
 * 根据案件序号和结局类型获取 Hub 对话序列
 * @param {number} caseIndex - 刚结束的案件序号 (0/1/2/3)
 * @param {string} endingType - 'good' | 'normal' | 'bad'
 * @returns {Array} 对话数组 [{ speaker, text, type }]
 */
export function getHubDialogue(caseIndex, endingType) {
  if (!_plotData?.hubDialogues) return [];

  const key = CASE_HUB_KEY[caseIndex];
  if (!key) return [];

  const dialogues = _plotData.hubDialogues[key]?.[endingType];
  return dialogues || [];
}

/**
 * 获取当前应播放的 Hub 对话（基于最近结案的结果）
 * @returns {Array}
 */
export function getCurrentHubDialogue() {
  const results = getCasesResults();
  // 找到最近一个有结果且非 null 的案件
  let lastCaseIndex = -1;
  let lastEnding = 'normal';
  for (let i = results.length - 1; i >= 0; i--) {
    if (results[i]) {
      lastCaseIndex = i;
      lastEnding = _endingToType(results[i].ending);
      break;
    }
  }

  if (lastCaseIndex < 0) return [];
  return getHubDialogue(lastCaseIndex, lastEnding);
}

// ====================
// 新闻简报
// ====================

/**
 * 获取指定案件结束后的新闻简报
 * @param {number} caseIndex
 * @returns {Array} 新闻数组 [{ headline, source, time }]
 */
export function getNewsFeed(caseIndex) {
  if (!_plotData?.newsFeed) return [];
  const key = CASE_HUB_KEY[caseIndex];
  if (!key) return [];
  return _plotData.newsFeed[key] || [];
}

/**
 * 获取所有已结案件的累计新闻
 * @returns {Array}
 */
export function getAllNewsFeed() {
  if (!_plotData?.newsFeed) return [];
  const results = getCasesResults();
  const allNews = [];
  results.forEach((r, idx) => {
    if (r) {
      allNews.push(...getNewsFeed(idx));
    }
  });
  return allNews;
}

// ====================
// 分支判断
// ====================

/**
 * 评估当前剧情分支
 * @returns {Object} { branchId, effect, description, shouldUnlockHidden }
 */
export function evaluateBranch() {
  const results = getCasesResults();
  const mainResults = results.slice(0, 3);

  // 检查是否全部主线案件完成
  const allCompleted = mainResults.every(r => r !== null && r !== undefined);
  if (!allCompleted) {
    return {
      branchId: 'in_progress',
      effect: 'continue',
      description: '主线案件进行中',
      shouldUnlockHidden: false
    };
  }

  const allGood = mainResults.every(r => r.ending === 'ending_good');
  const allBad = mainResults.every(r => r.ending === 'ending_bad');

  if (allGood) {
    return {
      branchId: 'branch_all_good',
      effect: 'unlock_hidden_case',
      description: '全部主线案件达成好结局，解锁隐藏案件',
      shouldUnlockHidden: true
    };
  }

  if (allBad) {
    return {
      branchId: 'branch_all_bad',
      effect: 'final_ending_bad',
      description: '全部失败，进入坏结局',
      shouldUnlockHidden: false
    };
  }

  return {
    branchId: 'branch_mixed',
    effect: 'final_ending_mixed',
    description: '混合结局，进入普通最终结局',
    shouldUnlockHidden: false
  };
}

/**
 * 检查是否应该解锁隐藏案件
 * @returns {boolean}
 */
export function shouldUnlockHiddenCase() {
  return evaluateBranch().shouldUnlockHidden;
}

// ====================
// 下一个案件
// ====================

/**
 * 获取下一个应进行的案件序号
 * @returns {number} 案件序号，-1 表示无更多案件（应进入最终结局）
 */
export function getNextCaseIndex() {
  const results = getCasesResults();
  const state = getState();

  // 如果隐藏案件已解锁且未完成
  if (state.unlockedHiddenCase) {
    const hiddenResult = results[3];
    if (!hiddenResult) return 3; // 隐藏案件序号
  }

  // 找到第一个未完成的主线案件
  for (let i = 0; i < 3; i++) {
    if (!results[i]) return i;
  }

  // 全部主线案件完成
  return -1;
}

/**
 * 判断是否进入最终结局阶段
 * @returns {boolean}
 */
export function shouldEnterFinalEnding() {
  // 隐藏案件已完成，或全部主线完成但未解锁隐藏案件
  const results = getCasesResults();
  const allMainDone = isAllMainCasesCompleted();

  if (!allMainDone) return false;

  // 如果解锁了隐藏案件，需要等隐藏案件完成
  if (results[3] !== undefined && results[3] !== null) {
    return true;
  }

  // 未解锁隐藏案件，全部主线完成即进入最终结局
  return !shouldUnlockHiddenCase();
}

// ====================
// 最终结局
// ====================

/**
 * 获取最终结局文本
 * @returns {Object} { title, text }
 */
export function getFinalEnding() {
  if (!_plotData?.finalEndings) {
    return { title: '结局', text: '案件终于落下帷幕...' };
  }

  const type = getFinalEndingType();
  const ending = _plotData.finalEndings[type] || _plotData.finalEndings.mixed;

  return {
    title: ending.title || '最终结局',
    text: ending.text || '新香港下城区的霓虹灯依旧闪烁。'
  };
}

// ====================
// NPC 交互
// ====================

/**
 * 获取事务所内 AI 助手交互选项
 * @returns {Array}
 */
export function getNPCOptions() {
  if (!_plotData?.npcInteractions?.options) return [];
  return _plotData.npcInteractions.options;
}

// ====================
// 内部工具
// ====================

/**
 * 将结局 ID 转换为类型字符串
 * @param {string} endingId - 'ending_good' | 'ending_normal' | 'ending_bad'
 * @returns {string} 'good' | 'normal' | 'bad'
 */
function _endingToType(endingId) {
  if (endingId === 'ending_good') return 'good';
  if (endingId === 'ending_bad') return 'bad';
  return 'normal';
}
