/**
 * audioManager.js - 音频管理
 * 赛博朋克侦探叙事游戏
 *
 * 负责背景音乐、音效和角色配音的播放控制。
 * Day1 仅实现骨架，Day4 集成实际音频资源。
 */

// ====================
// 音频实例缓存
// ====================
const _audioCache = {};
let _currentBGM = null;
let _musicEnabled = true;     // 音乐开关状态
let _currentBGMTrackId = null; // 记录当前应播放的 BGM 轨道，用于静音恢复

// ====================
// 音频配置
// ====================
const AUDIO_CONFIG = {
  bgmVolume: 0.4,
  sfxVolume: 0.6,
  voiceVolume: 0.8,
  fadeInDuration: 1500,
  fadeOutDuration: 1000
};

// ====================
// 音频资源路径映射
// ====================
const AUDIO_MAP = {
  bgm: {
    investigation: '/audio/bgm_investigation.wav',
    investigation_case2: '/audio/bgm_investigate.mp3',
    investigation_case3: '/audio/bgm_investigate.mp3',
    interrogation: '/audio/bgm_interrogation.wav',
    interrogation_case2: '/audio/bgm_interrogation.mp3',
    interrogation_case3: '/audio/bgm_interrogation.mp3',
    menu: '/audio/bgm_menu.wav',
    ending: '/audio/bgm_ending.wav',
    hub: '/audio/bgm_hub.mp3'
  },
  sfx: {
    evidence_obtain: '/audio/sfx_evidence.wav',
    evidence_combine: '/audio/sfx_combine.wav',
    click: '/audio/sfx_click.wav',
    contradiction: '/audio/sfx_contradiction.wav',
    stress_up: '/audio/sfx_stress.wav',
    case_switch: '/audio/sfx_case_switch.wav'
  },
  voice: {
    suspect_001_opening: '/audio/voice_lin_opening.wav',
    suspect_002_opening: '/audio/voice_zhao_opening.wav'
  }
};

// ====================
// 初始化
// ====================

/**
 * 初始化音频管理器
 */
export function initAudioManager() {
  // 预加载 BGM
  Object.entries(AUDIO_MAP.bgm).forEach(([key, path]) => {
    const audio = new Audio(path);
    audio.loop = true;
    audio.volume = 0; // 初始静音，播放时渐入
    _audioCache[`bgm_${key}`] = audio;
  });

  // 预加载音效
  Object.entries(AUDIO_MAP.sfx).forEach(([key, path]) => {
    const audio = new Audio(path);
    audio.volume = AUDIO_CONFIG.sfxVolume;
    _audioCache[`sfx_${key}`] = audio;
  });

  console.log('[audioManager] 音频管理器初始化完成');
}

// ====================
// BGM 播放
// ====================

/**
 * 播放背景音乐
 * @param {string} trackId - BGM ID
 * @param {Object} options - { loop: true, volume: 0.4 }
 */
export function playBGM(trackId, options = {}) {
  const { loop = true, volume = AUDIO_CONFIG.bgmVolume } = options;

  // 停止当前 BGM
  if (_currentBGM) {
    _fadeStopBGM();
  }

  _currentBGMTrackId = trackId;

  // 如果音乐已关闭，仅记录轨道，不实际播放
  if (!_musicEnabled) {
    if (_currentBGM) {
      _fadeStopBGM();
    }
    return;
  }

  const audio = _audioCache[`bgm_${trackId}`];
  if (!audio) {
    console.warn(`[audioManager] BGM 不存在: ${trackId}`);
    return;
  }

  audio.loop = loop;
  audio.volume = 0;
  _currentBGM = audio;

  // 渐入播放
  audio.play().catch(e => {
    console.warn('[audioManager] BGM 播放失败（可能需要用户交互）:', e.message);
  });

  _fadeIn(audio, volume, AUDIO_CONFIG.fadeInDuration);
}

/**
 * 停止当前 BGM
 */
export function stopBGM() {
  if (_currentBGM) {
    _fadeStopBGM();
  }
}

function _fadeStopBGM() {
  if (!_currentBGM) return;

  const audio = _currentBGM;
  _fadeOut(audio, AUDIO_CONFIG.fadeOutDuration, () => {
    audio.pause();
    audio.currentTime = 0;
  });

  _currentBGM = null;
}

// ====================
// 音效播放
// ====================

/**
 * 播放音效
 * @param {string} sfxId - 音效 ID
 */
export function playSFX(sfxId) {
  const audio = _audioCache[`sfx_${sfxId}`];
  if (!audio) {
    console.warn(`[audioManager] 音效不存在: ${sfxId}`);
    return;
  }

  // 重置播放位置
  audio.currentTime = 0;
  audio.volume = AUDIO_CONFIG.sfxVolume;
  audio.play().catch(() => {});
}

// ====================
// 角色配音
// ====================

/**
 * 播放角色配音
 * @param {string} characterId - 角色 ID
 * @param {string} lineId - 台词 ID
 */
export function playVoice(characterId, lineId) {
  const key = `${characterId}_${lineId}`;
  const path = AUDIO_MAP.voice[key];

  if (!path) {
    console.warn(`[audioManager] 配音不存在: ${key}`);
    return;
  }

  // 创建新实例（允许多个配音同时播放）
  const audio = new Audio(path);
  audio.volume = AUDIO_CONFIG.voiceVolume;
  audio.play().catch(() => {});
}

// ====================
// 全局控制
// ====================

/**
 * 停止所有音频
 */
export function stopAllAudio() {
  Object.values(_audioCache).forEach(audio => {
    audio.pause();
    audio.currentTime = 0;
  });
  _currentBGM = null;
}

/**
 * 设置音乐开关
 * @param {boolean} enabled
 */
export function setMusicEnabled(enabled) {
  _musicEnabled = enabled;

  if (!_musicEnabled) {
    // 关闭音乐：停止当前 BGM
    stopBGM();
  } else if (_currentBGMTrackId) {
    // 开启音乐：恢复当前应播放的 BGM
    playBGM(_currentBGMTrackId);
  }
}

/**
 * 获取当前音乐开关状态
 * @returns {boolean}
 */
export function isMusicEnabled() {
  return _musicEnabled;
}

/**
 * 设置全局音量
 * @param {number} volume - 0 到 1
 */
export function setMasterVolume(volume) {
  const v = Math.max(0, Math.min(1, volume));

  if (_currentBGM) {
    _currentBGM.volume = v * AUDIO_CONFIG.bgmVolume;
  }

  Object.values(_audioCache).forEach(audio => {
    if (!audio.loop) {
      audio.volume = v * AUDIO_CONFIG.sfxVolume;
    }
  });
}

// ====================
// 渐入/渐出工具
// ====================

function _fadeIn(audio, targetVolume, duration) {
  const stepTime = 50;
  const steps = duration / stepTime;
  const volumeStep = targetVolume / steps;
  let currentStep = 0;

  const timer = setInterval(() => {
    currentStep++;
    audio.volume = Math.min(targetVolume, currentStep * volumeStep);

    if (currentStep >= steps) {
      clearInterval(timer);
    }
  }, stepTime);
}

function _fadeOut(audio, duration, callback) {
  const stepTime = 50;
  const steps = duration / stepTime;
  const startVolume = audio.volume;
  const volumeStep = startVolume / steps;
  let currentStep = 0;

  const timer = setInterval(() => {
    currentStep++;
    audio.volume = Math.max(0, startVolume - currentStep * volumeStep);

    if (currentStep >= steps) {
      clearInterval(timer);
      audio.volume = 0;
      if (callback) callback();
    }
  }, stepTime);
}
