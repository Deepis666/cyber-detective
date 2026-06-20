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
// 打字机效果状态
let _typewriterTimer = null;
let _typewriterResolve = null;
let _isTyping = false;
let _currentFullText = '';
let _continueResolve = null;
let _isDialogueBusy = false;  // 对话进行中标志（防止审讯按钮在开场白期间被触发）

// 角色名称映射（由外部注入）
let _speakerNameMap = {};

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

  // 点击对话框区域推进对话/跳过打字机（注册在 dialogue-box 而非 overlay，因 overlay 设为 pointer-events:none）
  const dialogueBox = _elements.overlay.querySelector('.dialogue-box');
  if (dialogueBox) {
    dialogueBox.addEventListener('click', _handleAdvance);
  }
  // 点击 indicator 也推进
  if (_elements.indicator) {
    _elements.indicator.addEventListener('click', _handleAdvance);
  }

  // 键盘支持：空格/回车推进对话
  document.addEventListener('keydown', (e) => {
    // 仅在对话框可见时响应
    if (_elements.overlay.classList.contains('hidden')) return;
    // 选项面板有内容时不拦截（让玩家点选项）
    if (_elements.optionsContainer.children.length > 0) return;
    if (e.code === 'Space' || e.code === 'Enter') {
      e.preventDefault();
      _handleAdvance();
    }
  });

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
    typewriterSpeed = 30,
    waitForClick = true   // 默认打字完成后等待玩家点击再 resolve
  } = options;

  return new Promise((resolve) => {
    // 显示对话框
    _elements.overlay.classList.remove('hidden');
    _elements.optionsContainer.innerHTML = '';
    _isDialogueBusy = true;

    // 设置说话者名称
    _setSpeakerName(dialogue.speaker, dialogue.emotion);

    // 设置文本类型样式
    _elements.dialogueText.className = 'dialogue-text';
    if (dialogue.type) {
      _elements.dialogueText.classList.add(dialogue.type);
    }

    // 隐藏指示器（打字过程中）
    _elements.indicator.style.display = 'none';

    // 打字完成后的回调：等待玩家点击再 resolve
    const onTypewriterDone = () => {
      if (waitForClick) {
        // 等待玩家点击/按键推进
        _continueResolve = () => {
          _elements.indicator.style.display = 'none';
          _continueResolve = null;
          _isDialogueBusy = false;
          resolve();
        };
        _elements.indicator.style.display = 'block';
      } else {
        _isDialogueBusy = false;
        resolve();
      }
    };

    if (typewriter && dialogue.text) {
      _typewriterResolve = onTypewriterDone;
      _startTypewriter(dialogue.text, typewriterSpeed);
    } else {
      _elements.dialogueText.textContent = dialogue.text || '';
      onTypewriterDone();
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
    // showDialogue 已内置 waitForClick，打字完成后等待玩家点击再 resolve
    await showDialogue(dialogue, options);
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
    console.log(`[DEBUG] showOptions: 开始, options数量=${options.length}, overlay.hidden=${_elements.overlay.classList.contains('hidden')}`);
    _elements.optionsContainer.innerHTML = '';

    // 显示对话框覆盖层（确保选项可见可点击）
    _elements.overlay.classList.remove('hidden');

    // 隐藏继续指示器
    _elements.indicator.style.display = 'none';
    _isDialogueBusy = true;

    options.forEach((option, index) => {
      const btn = document.createElement('button');
      btn.className = 'option-btn';
      btn.textContent = option.text;
      btn.dataset.index = index;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        console.log(`[DEBUG] showOptions: 选项被点击, option=`, option);
        // 添加选中动画
        btn.style.borderColor = 'var(--neon-magenta)';
        btn.style.background = 'rgba(255, 0, 229, 0.1)';

        // 清空选项容器
        _elements.optionsContainer.innerHTML = '';
        // 注意：不在此处清除 _isDialogueBusy，由后续 showDialogue 或调用方管理

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
  _isDialogueBusy = false;
  clearDialogue();
}

/**
 * 重置对话系统状态（清理残留的 resolve 回调和打字机）
 * 用于场景切换时强制中断未完成的对话
 */
export function resetDialogueState() {
  _stopTypewriter();
  _isTyping = false;
  _typewriterResolve = null;
  _currentFullText = '';
  _isDialogueBusy = false;
  if (_continueResolve) {
    const r = _continueResolve;
    _continueResolve = null;
    r();
  }
  clearDialogue();
}

/**
 * 检查对话是否正在进行中（用于防止审讯按钮在开场白期间被触发）
 * @returns {boolean}
 */
export function isDialogueBusy() {
  return _isDialogueBusy;
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
 * 设置说话者名称（支持外部注入的角色名称映射）
 */
function _setSpeakerName(speaker, emotion) {
  const defaultNames = {
    'system': '系统',
    'detective': '你',
    'narration': '旁白',
    'ai_assistant': '赛博义眼'
  };

  // Day2 已修复：优先使用外部注入的名称映射
  const displayName = _speakerNameMap[speaker] || defaultNames[speaker] || speaker || '???';

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
  _currentFullText = text;
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
 * 统一处理对话推进（点击/键盘）
 * - 打字中：跳过打字，显示完整文本
 * - 等待继续：resolve _continueResolve 推进下一条
 */
function _handleAdvance(e) {
  console.log(`[DEBUG] _handleAdvance: 被调用, _isTyping=${_isTyping}, _continueResolve=${!!_continueResolve}, optionsChildren=${_elements.optionsContainer.children.length}`);

  // 确保不是点击选项按钮
  if (e && e.target && e.target.closest('.option-btn')) {
    console.log('[DEBUG] _handleAdvance: 点击的是选项按钮，跳过');
    return;
  }

  // 选项面板有内容时（showOptions 正在等待选择），不推进/隐藏对话框
  if (_elements.optionsContainer.children.length > 0) {
    console.log('[DEBUG] _handleAdvance: 选项面板有内容，跳过');
    return;
  }

  if (_isTyping) {
    // 跳过打字机：显示完整文本
    _stopTypewriter();
    _elements.dialogueText.textContent = _currentFullText;
    _elements.indicator.style.display = 'block';
    if (_typewriterResolve) {
      _typewriterResolve();
      _typewriterResolve = null;
    }
    return;
  }

  // 非打字状态：推进到下一条对话
  if (_continueResolve) {
    _elements.indicator.style.display = 'none';
    const r = _continueResolve;
    _continueResolve = null;
    r();
  } else {
    // 无后续对话：隐藏对话框，不阻挡场景交互
    hideDialogueOverlay();
  }
}

/**
 * 等待玩家点击/按键继续
 */
function _waitForContinue() {
  return new Promise((resolve) => {
    _continueResolve = resolve;
    _elements.indicator.style.display = 'block';
  });
}

/**
 * 设置角色名称映射（供外部注入角色名字）
 * @param {Object} map - { speakerId: displayName }
 */
export function setSpeakerNameMap(map) {
  _speakerNameMap = { ..._speakerNameMap, ...map };
}
