/**
 * evidenceSystem.js - 证据系统
 * 赛博朋克侦探叙事游戏
 *
 * 负责证据的收集、查看、组合和出示。
 */

import {
  addEvidence,
  markEvidenceExamined,
  addStress,
  addScore,
  getFlag,
  setFlag,
  getState
} from './gameState.js';
import { showDialogue, showOptions } from './dialogueSystem.js';

// ====================
// 证据数据缓存
// ====================
let _evidenceData = null;
let _selectedEvidence = []; // 当前选中的证据（用于组合/出示）

// ====================
// 初始化
// ====================

/**
 * 初始化证据系统
 * @param {Object} evidenceData - 证据定义数据 (data/evidence.json)
 */
export function initEvidenceSystem(evidenceData) {
  _evidenceData = evidenceData;
  console.log('[evidenceSystem] 证据系统初始化完成');
}

// ====================
// 证据栏渲染
// ====================

/**
 * 渲染证据栏 UI
 * @param {Array<string>} evidenceIds - 已获得的证据 ID 列表
 */
export function renderEvidenceBar(evidenceIds) {
  const listEl = document.getElementById('evidence-list');
  if (!listEl || !_evidenceData) return;

  listEl.innerHTML = '';

  if (evidenceIds.length === 0) {
    listEl.innerHTML = '<p style="color: var(--text-dim); grid-column: 1/-1; text-align: center;">尚未获得证据</p>';
    return;
  }

  evidenceIds.forEach(evidenceId => {
    const evData = _findEvidence(evidenceId);
    const item = document.createElement('div');
    item.className = 'evidence-item';
    item.dataset.evidenceId = evidenceId;

    // 是否已选中
    if (_selectedEvidence.includes(evidenceId)) {
      item.classList.add('selected');
    }

    item.innerHTML = `
      <div class="evidence-item-icon">${evData ? evData.icon : '📋'}</div>
      <div class="evidence-item-name">${evData ? evData.name : evidenceId}</div>
    `;

    item.addEventListener('click', () => showEvidenceDetail(evidenceId));
    listEl.appendChild(item);
  });
}

// ====================
// 证据详情
// ====================

/**
 * 查看证据详情
 * @param {string} evidenceId
 */
export function showEvidenceDetail(evidenceId) {
  const detailEl = document.getElementById('evidence-detail');
  const nameEl = document.getElementById('evidence-detail-name');
  const descEl = document.getElementById('evidence-detail-desc');

  if (!detailEl) return;

  const evData = _findEvidence(evidenceId);

  detailEl.classList.remove('hidden');

  if (nameEl) nameEl.textContent = evData ? evData.name : evidenceId;
  if (descEl) descEl.textContent = evData ? evData.description : '证据详情暂缺';

  // 标记已查看
  markEvidenceExamined(evidenceId);
}

// ====================
// 证据选择
// ====================

/**
 * 选择证据（用于出示或组合）
 * @param {string} evidenceId
 * @returns {boolean} 是否选中成功
 */
export function selectEvidence(evidenceId) {
  if (_selectedEvidence.includes(evidenceId)) {
    // 取消选择
    _selectedEvidence = _selectedEvidence.filter(id => id !== evidenceId);
    return false;
  }

  if (_selectedEvidence.length >= 2) {
    // 最多选 2 件
    _selectedEvidence.shift();
  }

  _selectedEvidence.push(evidenceId);
  return true;
}

/**
 * 获取当前选中的证据列表
 * @returns {Array<string>}
 */
export function getSelectedEvidence() {
  return [..._selectedEvidence];
}

/**
 * 清空选中状态
 */
export function clearSelectedEvidence() {
  _selectedEvidence = [];
}

// ====================
// 证据组合
// ====================

/**
 * 组合两件证据
 * @param {string} ev1 - 证据1 ID
 * @param {string} ev2 - 证据2 ID
 * @returns {Promise<Object>} 组合结果
 *   @prop {boolean} isRelevant - 是否相关
 *   @prop {string} insight - 推理文本
 *   @prop {string|null} unlocksEvidence - 解锁的新证据 ID
 */
export async function combineEvidence(ev1, ev2) {
  const ev1Data = _findEvidence(ev1);
  const ev2Data = _findEvidence(ev2);

  if (!ev1Data || !ev2Data) {
    return {
      isRelevant: false,
      insight: '证据数据缺失，无法进行组合分析。',
      unlocksEvidence: null
    };
  }

  // 检查是否可组合
  const canCombine = _canCombine(ev1Data, ev2Data);

  // TODO: Day3 接入 AI 证据组合推理
  // 目前使用预设逻辑

  if (canCombine) {
    // 检查是否解锁新证据
    const unlockedEvidence = _checkUnlockEvidence(ev1, ev2);

    addScore(10); // 组合成功加 10 分

    return {
      isRelevant: true,
      insight: _generatePresetInsight(ev1Data, ev2Data, unlockedEvidence),
      unlocksEvidence: unlockedEvidence
    };
  }

  return {
    isRelevant: false,
    insight: `将${ev1Data.name}和${ev2Data.name}放在一起审视...似乎没有发现直接的逻辑关联。也许需要换一种组合方式。`,
    unlocksEvidence: null
  };
}

// ====================
// 出示证据
// ====================

/**
 * 向嫌疑人出示证据
 * @param {string} suspectId
 * @param {string} evidenceId
 * @returns {Promise<Object>} 嫌疑人回应
 *   @prop {string} response - 回应文本
 *   @prop {number} stressDelta - 压力变化
 *   @prop {boolean} isContradiction - 是否触发矛盾
 */
export async function presentEvidence(suspectId, evidenceId) {
  const evData = _findEvidence(evidenceId);
  if (!evData) {
    return {
      response: '你出示了一个不明物品...',
      stressDelta: 0,
      isContradiction: false
    };
  }

  // TODO: Day3 接入 AI 审讯引擎
  // 目前使用预设逻辑

  // 检查证据是否与嫌疑人相关
  const isRelated = evData.relatedTo && evData.relatedTo.includes(suspectId);

  if (isRelated) {
    // 关键证据，增加压力
    const stressDelta = 20;
    addStress(suspectId, stressDelta);
    addScore(15); // 出示关键证据加分

    return {
      response: `（嫌疑人看到${evData.name}后明显动摇）这...这不能说明什么！你凭什么...`,
      stressDelta,
      isContradiction: true
    };
  }

  // 无关证据
  return {
    response: `（嫌疑人看了一眼${evData.name}）这和我有什么关系？你在浪费时间。`,
    stressDelta: 0,
    isContradiction: false
  };
}

// ====================
// 内部方法
// ====================

function _findEvidence(evidenceId) {
  if (!_evidenceData || !_evidenceData.evidence) return null;
  return _evidenceData.evidence.find(ev => ev.id === evidenceId);
}

function _canCombine(ev1Data, ev2Data) {
  // 检查互相是否在对方的 canCombineWith 列表中
  const ev1CanCombine = ev1Data.canCombineWith || [];
  const ev2CanCombine = ev2Data.canCombineWith || [];

  return ev1CanCombine.includes(ev2Data.id) || ev2CanCombine.includes(ev1Data.id);
}

function _checkUnlockEvidence(ev1, ev2) {
  // 特殊组合：evidence_001 + evidence_003 解锁 evidence_005
  const combo1 = ['evidence_001', 'evidence_003'];
  if (combo1.includes(ev1) && combo1.includes(ev2)) {
    const state = getState();
    if (!state.evidenceObtained.includes('evidence_005')) {
      addEvidence('evidence_005');
      return 'evidence_005';
    }
  }

  return null;
}

function _generatePresetInsight(ev1Data, ev2Data, unlockedEvidence) {
  // 预设的推理文本
  const insights = {
    'evidence_001+evidence_002': '神经接口的灼烧痕迹是电磁脉冲造成的，而注射器中的阻断剂让死者在被攻击前完全丧失了抵抗能力。这是一套精心设计的组合攻击——先用阻断剂，再用脉冲致命。凶手不仅了解义体医学，还非常熟悉陈老九的神经接口结构。',
    'evidence_001+evidence_005': '林小北的日志中透露了他对师傅出售数据的恐惧。结合神经接口被精准攻击的事实——只有近距离接触过陈老九手术过程的人，才知道接口的精确位置和弱点。林小北作为助手，完全具备这个条件。',
    'evidence_003+evidence_004': '数据芯片上的LXB编号与林小北的姓名缩写吻合，而合同文件显示赵明月是涅槃项目的甲方。这两份证据揭示了案件背后的完整利益链条：赵明月出资，陈老九提供场地和技术，林小北负责实施。当陈老九威胁出售数据时，这条链上的每个人都面临着灭顶之灾。'
  };

  const key1 = `${ev1Data.id}+${ev2Data.id}`;
  const key2 = `${ev2Data.id}+${ev1Data.id}`;

  if (insights[key1]) return insights[key1];
  if (insights[key2]) return insights[key2];

  // 通用推理
  let result = `将${ev1Data.name}和${ev2Data.name}关联分析：`;
  if (unlockedEvidence) {
    result += `组合分析揭示了新的线索！`;
  } else {
    result += `两者存在某种联系，但还需要更多证据来构建完整的推理链。`;
  }
  return result;
}

/**
 * 获取证据数据
 * @param {string} evidenceId
 * @returns {Object|null}
 */
export function getEvidenceData(evidenceId) {
  return _findEvidence(evidenceId);
}
