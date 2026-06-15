/**
 * dialogueSystem.js - 对话系统
 * 赛博朋克侦探叙事游戏
 *
 * 负责管理游戏中的对话展示、选项交互和对话历史。
 * 支持预设对话和 AI 动态对话。
 */

import { addDialogueToHistory, getDialogueHistory as getStateHistory } from './gameState.js';

// ====================
// DOM 元素引用
// ====================
let _elements = {};

// ====================
// 对话队列
// ====================
let _dialogueQueue = [];
let _isPlaying = false;
let _currentCallback = null;

// 打字机效果状态
let _typewriterTimer = null;
let _typewriterResolve = null;
let _isTyping = false;

// ====================
// 初始化
// ====================

/**
 * 初始化对话系统（获取 DOM 元素引用）
 */
export function initDialogueSystem() {
  _elements = {
    overlay: document.getElementById('dialogue-overlay'),
    speakerName: document.getElementById('speaker-name'),
    dialogueText: document.getElementById('dialogue-text'),
    indicator: document.getElementById('dialogue-indicator'),
    optionsContainer: document.getElementById('options-container')
  };

  // 点击对话框或指示器推进对话
  _elements.overlay.addEventListener('click', _handleDialogueClick);
  _elements.indicator.addEventListener('click', _handleDialogueClick);

  console.log('[dialogueSystem] 对话系统初始化完成');
}

// ====================
// 对话展示
// ====================

/**
 * 显示对话内容（单条）
 * @param {Object} dialogue - 对话数据
 *   @prop {string} speaker - 说话者 ID 或 'detective'/'system'
 *   @prop {string} text - 文本内容
 *   @prop {string} type - 'normal' | 'thought' | 'narration' | 'ai_generated'
 *   @prop {string} emotion - 情绪标签（AI 生成时传入）
 * @param {Object} options - 可选配置
 *   @prop {boolean} typewriter - 是否启用打字机效果（默认 true）
 *   @prop {number} typewriterSpeed - 打字机速度 ms/字（默认 30）
 * @returns {Promise<void>} 对话显示完毕后 resolve
 */
export function showDialogue(dialogue, options = {}) {
  const {
    typewriter = true,
    typewriterSpeed = 30
  } = options;

  return new Promise((resolve) => {
    // 显示对话框
    _elements.overlay.classList.remove('hidden');
    _elements.optionsContainer.innerHTML = '';

    // 设置说话者名称
    _setSpeakerName(dialogue.speaker, dialogue.emotion);

    // 设置文本类型样式
    _elements.dialogueText.className = 'dialogue-text';
    if (dialogue.type) {
      _elements.dialogueText.classList.add(dialogue.type);
    }

    // 隐藏指示器（打字过程中）
    _elements.indicator.style.display = 'none';

    if (typewriter && dialogue.text) {
      _typewriterResolve = resolve;
      _startTypewriter(dialogue.text, typewriterSpeed);
    } else {
      _elements.dialogueText.textContent = dialogue.text || '';
      _elements.indicator.style.display = 'block';
      resolve();
    }

    // 记录到对话历史
    const role = dialogue.speaker === 'detective' ? 'user' : 'assistant';
    addDialogueToHistory(role, dialogue.text);
  });
}

/**
 * 显示对话序列（多条对话依次播放）
 * @param {Array<Object>} dialogues - 对话数据数组
 * @param {Object} options - 传给 showDialogue 的选项
 * @returns {Promise<void>} 全部对话播放完毕后 resolve
 */
export async function showDialogueSequence(dialogues, options = {}) {
  for (const dialogue of dialogues) {
    await showDialogue(dialogue, options);
    // 等待玩家点击继续
    await _waitForContinue();
  }
}

/**
 * 显示选项按钮
 * @param {Array<Object>} options
 *   @prop {string} text - 选项文本
 *   @prop {string} action - 'continue' | 'investigate' | 'interrogate' | 'present_evidence' | 'custom'
 *   @prop {string} target - 目标 ID（场景/嫌疑人/证据）
 *   @prop {Function} callback - 自定义回调
 * @returns {Promise<Object>} 玩家选择的选项
 */
export function showOptions(options) {
  return new Promise((resolve) => {
    _elements.optionsContainer.innerHTML = '';

    // 隐藏继续指示器
    _elements.indicator.style.display = 'none';

    options.forEach((option, index) => {
      const btn = document.createElement('button');
      btn.className = 'option-btn';
      btn.textContent = option.text;
      btn.dataset.index = index;
      btn.addEventListener('click', () => {
        // 添加选中动画
        btn.style.borderColor = 'var(--neon-magenta)';
        btn.style.background = 'rgba(255, 0, 229, 0.1)';

        // 清空选项容器
        _elements.optionsContainer.innerHTML = '';

        // 记录玩家选择
        addDialogueToHistory('user', option.text);

        resolve(option);
      });

      _elements.optionsContainer.appendChild(btn);

      // 渐入动画
      btn.style.opacity = '0';
      btn.style.transform = 'translateY(10px)';
      setTimeout(() => {
        btn.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
        btn.style.opacity = '1';
        btn.style.transform = 'translateY(0)';
      }, index * 80);
    });
  });
}

/**
 * 清空对话框
 */
export function clearDialogue() {
  _elements.dialogueText.textContent = '';
  _elements.speakerName.textContent = '';
  _elements.speakerName.className = 'speaker-name';
  _elements.dialogueText.className = 'dialogue-text';
  _elements.optionsContainer.innerHTML = '';
  _elements.indicator.style.display = 'none';

  // 停止打字机
  _stopTypewriter();
}

/**
 * 隐藏对话覆盖层
 */
export function hideDialogueOverlay() {
  _elements.overlay.classList.add('hidden');
  clearDialogue();
}

/**
 * 显示对话覆盖层
 */
export function showDialogueOverlay() {
  _elements.overlay.classList.remove('hidden');
}

/**
 * 获取当前对话历史（用于 API 请求）
 * @returns {Array<{role: string, content: string}>}
 */
export function getHistory() {
  return getStateHistory();
}

// ====================
// 内部方法
// ====================

/**
 * 设置说话者名称
 */
function _setSpeakerName(speaker, emotion) {
  const nameMap = {
    'system': '系统',
    'detective': '你',
    'narration': '旁白',
    'ai_assistant': '赛博义眼'
  };

  // 尝试从角色数据中获取名字（后续由外部注入）
  const displayName = nameMap[speaker] || speaker || '???';

  _elements.speakerName.textContent = displayName;
  _elements.speakerName.className = 'speaker-name';

  if (speaker === 'detective') {
    _elements.speakerName.classList.add('detective');
  } else if (speaker === 'system' || speaker === 'narration') {
    _elements.speakerName.classList.add('system');
  }
}

/**
 * 打字机效果
 */
function _startTypewriter(text, speed) {
  _stopTypewriter();
  _isTyping = true;
  _elements.dialogueText.textContent = '';

  let charIndex = 0;
  _typewriterTimer = setInterval(() => {
    if (charIndex < text.length) {
      _elements.dialogueText.textContent += text[charIndex];
      charIndex++;
    } else {
      _stopTypewriter();
      _elements.indicator.style.display = 'block';
      if (_typewriterResolve) {
        _typewriterResolve();
        _typewriterResolve = null;
      }
    }
  }, speed);
}

function _stopTypewriter() {
  if (_typewriterTimer) {
    clearInterval(_typewriterTimer);
    _typewriterTimer = null;
  }
  _isTyping = false;
}

/**
 * 处理对话框点击（推进对话/跳过打字机）
 */
function _handleDialogueClick(e) {
  // 如果正在打字，点击则完成打字
  if (_isTyping) {
    _stopTypewriter();
    // 显示完整文本
    // (文本已在 _currentFullText 中，但我们需从外部获取)
    _elements.indicator.style.display = 'block';
    if (_typewriterResolve) {
      _typewriterResolve();
      _typewriterResolve = null;
    }
    e.stopPropagation();
    return;
  }
}

/**
 * 等待玩家点击继续
 */
function _waitForContinue() {
  return new Promise((resolve) => {
    const handler = (e) => {
      // 确保不是点击选项按钮
      if (e.target.closest('.option-btn')) return;

      _elements.overlay.removeEventListener('click', handler);

      // 清空当前对话文本，准备下一条
      resolve();
    };

    _elements.overlay.addEventListener('click', handler);
  });
}

/**
 * 设置角色名称映射（供外部注入角色名字）
 * @param {Object} map - { speakerId: displayName }
 */
let _speakerNameMap = {};

export function setSpeakerNameMap(map) {
  _speakerNameMap = { ..._speakerNameMap, ...map };
}

// 覆盖 _setSpeakerName 中的 nameMap 逻辑
const _originalSetSpeakerName = _setSpeakerName;
// 重新导出增强版
export function _setSpeakerNameEnhanced(speaker, emotion) {
  const defaultNames = {
    'system': '系统',
    'detective': '你',
    'narration': '旁白',
    'ai_assistant': '赛博义眼'
  };

  const displayName = _speakerNameMap[speaker] || defaultNames[speaker] || speaker || '???';

  _elements.speakerName.textContent = displayName;
  _elements.speakerName.className = 'speaker-name';

  if (speaker === 'detective') {
    _elements.speakerName.classList.add('detective');
  } else if (speaker === 'system' || speaker === 'narration') {
    _elements.speakerName.classList.add('system');
  }
}
