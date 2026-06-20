/**
 * main.js - 入口逻辑
 * 赛博朋克侦探叙事游戏
 *
 * 负责初始化所有模块、加载数据、启动游戏主循环。
 */

// ====================
// 模块导入
// ====================
import { initDialogueSystem, showDialogue, showDialogueSequence, showOptions, hideDialogueOverlay, setSpeakerNameMap } from './modules/dialogueSystem.js';
import { getState, onStateChange, resetState, hasSaveData, loadGame, saveGame, setPhase, addEvidence, getFlag, setFlag, addScore, getStress, getEmotion, addStress, getSettings, updateSettings } from './modules/gameState.js';
import { initSceneManager, switchScreen, switchScene, renderBriefing, renderInterrogationScene, renderEnding, updateStressDisplay, updateScoreDisplay } from './modules/sceneManager.js';
import { initEvidenceSystem, renderEvidenceBar, combineEvidence, presentEvidence, selectEvidence, getSelectedEvidence, clearSelectedEvidence, getEvidenceData } from './modules/evidenceSystem.js';
import { initAudioManager, playBGM, playSFX, stopAllAudio, setMusicEnabled } from './modules/audioManager.js';
import { initAIEngine, interrogateAI, evidenceCombineAI, showAIThinking, fallbackResponse, isAPIAvailable, setAIEnabled } from './modules/aiEngine.js';

// ====================
// 游戏数据
// ====================
let _caseData = null;
let _charactersData = null;
let _evidenceData = null;
let _dialoguesData = null;
let _plotData = null;

// ====================
// 资源加载进度
// ====================
let _loadingProgress = 0;
const _totalResources = 5;

// ====================
// 初始化
// ====================

async function init() {
  console.log('[main] 游戏初始化开始');

  // 加载所有数据文件
  try {
    const [caseRes, charRes, evidenceRes, dialoguesRes, plotRes] = await Promise.all([
      fetch('/data/cases/case_001.json'),
      fetch('/data/characters.json'),
      fetch('/data/evidence.json'),
      fetch('/data/dialogues.json'),
      fetch('/data/plot.json')
    ]);

    _caseData = await caseRes.json();
    _loadingProgress++;
    updateLoadingBar();

    _charactersData = await charRes.json();
    _loadingProgress++;
    updateLoadingBar();

    _evidenceData = await evidenceRes.json();
    _loadingProgress++;
    updateLoadingBar();

    _dialoguesData = await dialoguesRes.json();
    _loadingProgress++;
    updateLoadingBar();

    _plotData = await plotRes.json();
    _loadingProgress++;
    updateLoadingBar();

    // Day2: 将对话数据暴露到全局，供 sceneManager 审讯模块使用
    window._dialoguesData = _dialoguesData;
    window._caseData = _caseData;
    window._charactersData = _charactersData;

    // 数据集成：将 case.json 中的嫌疑人 ID 列表与 characters.json 合并为完整对象
    if (_caseData && _charactersData?.characters && Array.isArray(_caseData.suspects)) {
      _caseData.suspects = _caseData.suspects.map(id => {
        const character = _charactersData.characters.find(c => c.id === id);
        if (!character) {
          console.warn(`[main] 未找到嫌疑人数据: ${id}`);
        }
        return character || { id, name: id };
      });
    }

    console.log('[main] 数据文件加载完成');
  } catch (e) {
    console.error('[main] 数据文件加载失败:', e);
    return;
  }

  // 初始化各模块
  initDialogueSystem();

  // 多案件扩展：案件数据按需加载器
  const caseLoader = async (caseId) => {
    const res = await fetch(`/data/cases/${caseId}.json`);
    if (!res.ok) throw new Error(`加载案件 ${caseId} 失败: ${res.status}`);
    return res.json();
  };

  initSceneManager(_caseData.scenes, _caseData, _plotData, caseLoader, _evidenceData);
  initEvidenceSystem(_evidenceData);
  initAudioManager();

  // Day3: 初始化 AI 引擎（注入游戏数据）
  initAIEngine(_charactersData, _evidenceData, _caseData);
  console.log('[main] AI 引擎状态:', isAPIAvailable() ? '在线模式' : '离线模式（未配置 API Key）');

  // 应用玩家设置（音乐开关、AI 开关）
  const settings = getSettings();
  setMusicEnabled(settings.musicEnabled);
  setAIEnabled(settings.aiEnabled);
  console.log('[main] 玩家设置:', settings);

  // 设置角色名称映射
  const nameMap = {};
  if (_charactersData?.characters) {
    _charactersData.characters.forEach(char => {
      nameMap[char.id] = char.name;
    });
  }
  nameMap['ai_assistant'] = '赛博义眼';
  setSpeakerNameMap(nameMap);

  // 注册状态变更监听
  onStateChange((state, patch) => {
    _onStateChange(state, patch);
  });

  // 检查存档
  if (hasSaveData()) {
    const continueBtn = document.querySelector('[data-action="continue"]');
    if (continueBtn) continueBtn.disabled = false;
  }

  // 延迟切换到主菜单
  setTimeout(() => {
    switchScreen('menu');
    playBGM('menu');
  }, 1500);

  console.log('[main] 游戏初始化完成');
}

// ====================
// 加载进度条
// ====================

function updateLoadingBar() {
  const fill = document.querySelector('.loading-bar-fill');
  if (fill) {
    const progress = (_loadingProgress / _totalResources) * 100;
    fill.style.width = `${progress}%`;
  }
}

// ====================
// 状态变更处理
// ====================

function _onStateChange(state, patch) {
  // 更新证据栏
  if (patch.evidenceObtained) {
    renderEvidenceBar(state.evidenceObtained);
  }

  // 更新压力条显示
  if (patch.stressLevel) {
    const suspectId = state.currentSuspect;
    if (suspectId) {
      updateStressDisplay(suspectId);
    }
  }

  // 更新推理评分显示
  if (patch.score !== undefined) {
    updateScoreDisplay(state.score);
  }

  // 自动存档（仅在非标题/简报阶段，避免覆盖正常进度）
  if (state.currentPhase && state.currentPhase !== 'intro') {
    saveGame();
  }
}

// ====================
// 启动
// ====================

// 等待 DOM 加载完成
document.addEventListener('DOMContentLoaded', () => {
  init();
});
