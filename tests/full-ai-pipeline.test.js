/**
 * 全链路 AI 测试：多案件切换时 Prompt 变量替换正确性
 * 
 * 测试范围：
 * 1. Prompt 模板变量替换 — 5个模板 × 4个案件
 * 2. 离线预设对话覆盖 — 10个嫌疑人 × 3种情绪态
 * 3. 证据组合推理回退 — 所有有效证据对
 * 4. 数据完整性 — 角色/证据/案件的交叉引用
 * 5. AI 接口变量构建 — interrogateAI/evidenceCombineAI/investigateAI/generateEndingAI/plotNarrateAI
 */

import { readFileSync, readdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', 'cyber-detective');

// ==================== 工具函数 ====================

let passCount = 0;
let failCount = 0;
const failures = [];

function assert(condition, msg) {
  if (condition) {
    passCount++;
  } else {
    failCount++;
    failures.push(msg);
    console.log(`  ❌ FAIL: ${msg}`);
  }
}

function assertNoUnreplacedVars(text, context) {
  const unreplaced = text.match(/\{\{(\w+)\}\}/g);
  assert(!unreplaced, `${context} — 存在未替换的变量: ${unreplaced?.join(', ')}`);
}

function assertNotEmpty(value, context) {
  assert(value && String(value).trim().length > 0, `${context} — 值为空`);
}

// 模拟 aiEngine.js 的 loadPrompt 变量替换逻辑
function replaceVariables(template, variables) {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return variables[key] !== undefined ? variables[key] : match;
  });
}

// ==================== 加载数据 ====================

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━');
console.log('  全链路 AI 测试 · 多案件 Prompt 变量替换');
console.log('━━━━━━━━━━━━━━━━━━━━━━━\n');

// 加载案件数据
const cases = {};
const caseFiles = ['case_001.json', 'case_002.json', 'case_003.json', 'case_004.json'];
for (const f of caseFiles) {
  const data = JSON.parse(readFileSync(join(ROOT, 'data', 'cases', f), 'utf8'));
  cases[data.caseId] = data;
}

// 加载角色数据
const charactersData = JSON.parse(readFileSync(join(ROOT, 'data', 'characters.json'), 'utf8'));

// 加载证据数据
const evidenceData = JSON.parse(readFileSync(join(ROOT, 'data', 'evidence.json'), 'utf8'));

// 加载 Prompt 模板
const promptTemplates = {};
const promptFiles = ['interrogation.txt', 'evidenceCombine.txt', 'sceneInvestigate.txt', 'ending.txt', 'plotNarration.txt'];
for (const f of promptFiles) {
  promptTemplates[f.replace('.txt', '')] = readFileSync(join(ROOT, 'prompts', f), 'utf8');
}

// 加载 aiEngine.js 中的预设数据（直接用正则提取，避免 import 依赖）
const aiEngineSrc = readFileSync(join(ROOT, 'modules', 'aiEngine.js'), 'utf8');

console.log(`数据加载完成: ${Object.keys(cases).length} 案件, ${charactersData.characters.length} 角色, ${evidenceData.evidence.length} 证据, ${Object.keys(promptTemplates).length} Prompt模板\n`);

// ==================== 测试 1: 数据完整性 ====================

console.log('═══ 测试 1: 数据完整性 ═══\n');

// 1a. 每个案件的嫌疑人都在 characters.json 中
for (const [caseId, caseData] of Object.entries(cases)) {
  for (const sid of caseData.suspects) {
    const ch = charactersData.characters.find(c => c.id === sid);
    assert(!!ch, `[${caseId}] 嫌疑人 ${sid} 在 characters.json 中不存在`);
    if (ch) {
      assertNotEmpty(ch.name, `[${caseId}] ${sid}.name`);
      assertNotEmpty(ch.identity, `[${caseId}] ${sid}.identity`);
      assertNotEmpty(ch.personality, `[${caseId}] ${sid}.personality`);
      assertNotEmpty(ch.secretKnowledge, `[${caseId}] ${sid}.secretKnowledge`);
      assert(Array.isArray(ch.lies) && ch.lies.length > 0, `[${caseId}] ${sid}.lies 非空数组`);
    }
  }
}

// 1b. 每个案件的 truth.keyEvidence 都在 evidence.json 中
for (const [caseId, caseData] of Object.entries(cases)) {
  for (const eid of (caseData.truth.keyEvidence || [])) {
    const ev = evidenceData.evidence.find(e => e.id === eid);
    assert(!!ev, `[${caseId}] 关键证据 ${eid} 在 evidence.json 中不存在`);
  }
}

// 1c. 证据的 canCombineWith 引用都存在
for (const ev of evidenceData.evidence) {
  for (const cid of (ev.canCombineWith || [])) {
    const target = evidenceData.evidence.find(e => e.id === cid);
    assert(!!target, `证据 ${ev.id} 的 canCombineWith ${cid} 不存在`);
    // 双向引用检查
    const reciprocal = target.canCombineWith?.includes(ev.id);
    assert(reciprocal, `证据 ${ev.id}↔${cid} 不是双向引用（${cid}.canCombineWith 缺少 ${ev.id}）`);
  }
}

// 1d. 案件场景中的 evidenceId 都在 evidence.json 中
for (const [caseId, caseData] of Object.entries(cases)) {
  for (const [sceneId, scene] of Object.entries(caseData.scenes || {})) {
    for (const hs of (scene.hotspots || [])) {
      if (hs.type === 'evidence' && hs.evidenceId) {
        const ev = evidenceData.evidence.find(e => e.id === hs.evidenceId);
        assert(!!ev, `[${caseId}/${sceneId}] 热点证据 ${hs.evidenceId} 在 evidence.json 中不存在`);
      }
    }
  }
}

// 1e. 角色谎言的 counterEvidence 引用检查
for (const ch of charactersData.characters) {
  for (const lie of (ch.lies || [])) {
    if (lie.counterEvidence) {
      const ev = evidenceData.evidence.find(e => e.id === lie.counterEvidence);
      assert(!!ev, `角色 ${ch.id} 谎言[${lie.topic}] 的 counterEvidence ${lie.counterEvidence} 不存在`);
    }
  }
}

console.log(`  数据完整性: ✅ ${passCount} 通过, ❌ ${failCount} 失败\n`);

// ==================== 测试 2: 审讯 Prompt 变量替换 ====================

let prevFails = failCount;
console.log('═══ 测试 2: 审讯 Prompt 变量替换（interrogation.txt）═══\n');

const interrogationTemplate = promptTemplates.interrogation;

for (const [caseId, caseData] of Object.entries(cases)) {
  console.log(`  --- ${caseId}: ${caseData.title} ---`);
  
  for (const suspectId of caseData.suspects) {
    const character = charactersData.characters.find(c => c.id === suspectId);
    
    // 模拟 interrogateAI 构建的变量
    const caseTruth = caseData.truth
      ? `凶手：${caseData.truth.killerId === suspectId ? '就是此嫌疑人' : '不是此嫌疑人'}。动机：${caseData.truth.motive}。凶器：${caseData.truth.weapon}。关键证据：${caseData.truth.keyEvidence?.join('、') || '未知'}`
      : '案件真相数据缺失';
    
    const variables = {
      caseTruth,
      suspectName: character?.name || suspectId,
      suspectIdentity: character?.identity || '未知',
      suspectPersonality: character?.personality || '未知',
      suspectKnowledge: character?.secretKnowledge || '未知',
      suspectLies: character?.lies?.map(l => `关于"${l.topic}"：${l.lieText}（真相：${l.truthText}，反证：${l.counterEvidence}）`).join('\n') || '无',
      currentStress: '25',
      currentEmotion: 'calm',
      dialogueHistory: '侦探: 你那天晚上在哪里？\n嫌疑人: 我在工坊里。',
      actionType: 'question',
      playerContent: '你那晚到底去了哪里？'
    };
    
    const result = replaceVariables(interrogationTemplate, variables);
    assertNoUnreplacedVars(result, `[${caseId}] interrogation/${suspectId}`);
    
    // 检查关键变量确实被替换了（而非保持原样）
    assert(result.includes(character?.name || suspectId), `[${caseId}] interrogation/${suspectId} — suspectName 未正确注入`);
    assert(result.includes(character?.identity || ''), `[${caseId}] interrogation/${suspectId} — suspectIdentity 未正确注入`);
  }
}

console.log(`  审讯变量替换: ✅ ${failCount - prevFails === 0 ? '全部通过' : `${failCount - prevFails} 失败`}\n`);

// ==================== 测试 3: 证据组合 Prompt 变量替换 ====================

prevFails = failCount;
console.log('═══ 测试 3: 证据组合 Prompt 变量替换（evidenceCombine.txt）═══\n');

const evidenceTemplate = promptTemplates.evidenceCombine;

for (const [caseId, caseData] of Object.entries(cases)) {
  console.log(`  --- ${caseId}: ${caseData.title} ---`);
  
  // 收集该案件的证据
  const caseEvidenceIds = new Set();
  for (const [sceneId, scene] of Object.entries(caseData.scenes || {})) {
    for (const hs of (scene.hotspots || [])) {
      if (hs.type === 'evidence' && hs.evidenceId) {
        caseEvidenceIds.add(hs.evidenceId);
      }
    }
  }
  
  // 对每对可组合的证据测试变量替换
  for (const eid of caseEvidenceIds) {
    const ev = evidenceData.evidence.find(e => e.id === eid);
    if (!ev?.canCombineWith?.length) continue;
    
    for (const targetId of ev.canCombineWith) {
      const targetEv = evidenceData.evidence.find(e => e.id === targetId);
      
      // 模拟 evidenceCombineAI 构建的变量
      const variables = {
        caseBackground: `${caseData.title}：${caseData.setting?.background || '案件背景缺失'}`,
        obtainedEvidence: Array.from(caseEvidenceIds).map(id => {
          const e = evidenceData.evidence.find(ev => ev.id === id);
          return e ? `${e.name}(${e.type})` : id;
        }).join('、'),
        ev1Name: ev?.name || eid,
        ev1Desc: ev?.description || '无描述',
        ev2Name: targetEv?.name || targetId,
        ev2Desc: targetEv?.description || '无描述'
      };
      
      const result = replaceVariables(evidenceTemplate, variables);
      assertNoUnreplacedVars(result, `[${caseId}] evidenceCombine/${eid}+${targetId}`);
      assert(result.includes(ev?.name || eid), `[${caseId}] evidenceCombine/${eid}+${targetId} — ev1Name 未注入`);
      assert(result.includes(targetEv?.name || targetId), `[${caseId}] evidenceCombine/${eid}+${targetId} — ev2Name 未注入`);
    }
  }
}

console.log(`  证据组合变量替换: ✅ ${failCount - prevFails === 0 ? '全部通过' : `${failCount - prevFails} 失败`}\n`);

// ==================== 测试 4: 场景调查 Prompt 变量替换 ====================

prevFails = failCount;
console.log('═══ 测试 4: 场景调查 Prompt 变量替换（sceneInvestigate.txt）═══\n');

const sceneTemplate = promptTemplates.sceneInvestigate;

for (const [caseId, caseData] of Object.entries(cases)) {
  console.log(`  --- ${caseId}: ${caseData.title} ---`);
  
  for (const [sceneId, scene] of Object.entries(caseData.scenes || {})) {
    // 模拟 investigateAI 构建的变量
    const variables = {
      caseBackground: `${caseData.title}：${caseData.setting?.background || '案件背景缺失'}`,
      sceneName: scene?.name || sceneId,
      sceneDescription: scene?.description || '一间阴暗的房间',
      playerAction: '仔细检查房间角落',
      obtainedEvidence: '陈老九的账本(physical)、监控记录碎片(digital)'
    };
    
    const result = replaceVariables(sceneTemplate, variables);
    assertNoUnreplacedVars(result, `[${caseId}] sceneInvestigate/${sceneId}`);
    assert(result.includes(scene?.name || ''), `[${caseId}] sceneInvestigate/${sceneId} — sceneName 未注入`);
  }
}

console.log(`  场景调查变量替换: ✅ ${failCount - prevFails === 0 ? '全部通过' : `${failCount - prevFails} 失败`}\n`);

// ==================== 测试 5: 结局 Prompt 变量替换 ====================

prevFails = failCount;
console.log('═══ 测试 5: 结局 Prompt 变量替换（ending.txt）═══\n');

const endingTemplate = promptTemplates.ending;

for (const [caseId, caseData] of Object.entries(cases)) {
  console.log(`  --- ${caseId}: ${caseData.title} ---`);
  
  for (const [endingKey, ending] of Object.entries(caseData.endings || {})) {
    // 模拟 generateEndingAI 构建的变量
    const suspectsSummary = caseData.suspects?.map(sid => {
      const ch = charactersData.characters.find(c => c.id === sid);
      if (!ch) return `${sid}: 未知`;
      const isKiller = caseData?.truth?.killerId === sid;
      return `${ch.name}（${ch.identity}）${isKiller ? '【真凶】' : ''}：${ch.personality || ''}`;
    }).join('\n') || '嫌疑人数据缺失';
    
    const caseTruth = caseData.truth
      ? `真凶：${caseData.truth.killerId}。动机：${caseData.truth.motive}。凶器/手段：${caseData.truth.weapon}。关键证据：${caseData.truth.keyEvidence?.join('、') || '未知'}`
      : '案件真相数据缺失';
    
    const variables = {
      caseTruth,
      suspectsSummary,
      endingType: endingKey,
      endingTitle: ending.title || '未知结局',
      finalScore: '85',
      playerChoices: '玩家找到了关键证据链并正确指认了真凶。'
    };
    
    const result = replaceVariables(endingTemplate, variables);
    assertNoUnreplacedVars(result, `[${caseId}] ending/${endingKey}`);
    assert(result.includes(ending.title || ''), `[${caseId}] ending/${endingKey} — endingTitle 未注入`);
  }
}

console.log(`  结局变量替换: ✅ ${failCount - prevFails === 0 ? '全部通过' : `${failCount - prevFails} 失败`}\n`);

// ==================== 测试 6: 主线旁白 Prompt 变量替换 ====================

prevFails = failCount;
console.log('═══ 测试 6: 主线旁白 Prompt 变量替换（plotNarration.txt）═══\n');

const plotTemplate = promptTemplates.plotNarration;

// 模拟不同进度的旁白
const scenarios = [
  { situation: '侦探刚结案1，回到事务所。', summary: '案件1：霓虹公寓谋杀案 — 真相大白(85分)' },
  { situation: '侦探刚结案2，发现案件间的联系。', summary: '案件1：霓虹公寓谋杀案 — 真相大白(85分)\n案件2：数据深渊 — 数据坟场(90分)' },
  { situation: '侦探准备进入最终案件。', summary: '案件1-3全部好结局，隐藏案件已解锁。' }
];

for (const scenario of scenarios) {
  const variables = {
    currentSituation: scenario.situation,
    casesSummary: scenario.summary
  };
  
  const result = replaceVariables(plotTemplate, variables);
  assertNoUnreplacedVars(result, `plotNarration/场景:${scenario.situation.slice(0, 15)}...`);
}

console.log(`  主线旁白变量替换: ✅ ${failCount - prevFails === 0 ? '全部通过' : `${failCount - prevFails} 失败`}\n`);

// ==================== 测试 7: 离线预设对话覆盖 ====================

prevFails = failCount;
console.log('═══ 测试 7: 离线预设对话覆盖 ═══\n');

// 提取 aiEngine.js 中 PRESET_RESPONSES.interrogation 的所有嫌疑人 ID
const presetSuspectIds = [];
const presetRegex = /suspect_\d{3}:\s*\{/g;
let match;
while ((match = presetRegex.exec(aiEngineSrc)) !== null) {
  const id = match[0].match(/(suspect_\d{3})/)[1];
  presetSuspectIds.push(id);
}

console.log(`  预设中发现的嫌疑人ID: ${presetSuspectIds.join(', ')}`);

// 检查所有案件嫌疑人都有预设
for (const [caseId, caseData] of Object.entries(cases)) {
  for (const sid of caseData.suspects) {
    assert(presetSuspectIds.includes(sid), `[${caseId}] 嫌疑人 ${sid} 无离线预设对话`);
  }
}

// 检查每个预设嫌疑人都有 3 种情绪态
const emotionTypes = ['calm', 'nervous', 'broken'];
for (const sid of presetSuspectIds) {
  for (const emotion of emotionTypes) {
    // 检查源码中是否包含该嫌疑人的该情绪态
    const emotionRegex = new RegExp(`${sid}[\\s\\S]*?${emotion}:\\s*\\[`, 'm');
    assert(emotionRegex.test(aiEngineSrc), `嫌疑人 ${sid} 缺少 ${emotion} 态预设对话`);
  }
}

// 检查预设对话数据完整性（每条必须有 response/emotion/stressDelta/hasContradiction）
// 用简单方式检查：数一下每个情绪态的 response 出现次数
for (const sid of presetSuspectIds) {
  for (const emotion of emotionTypes) {
    // 提取该嫌疑人该情绪态的区块
    const blockRegex = new RegExp(`${sid}[\\s\\S]*?${emotion}:\\s*\\[([\\s\\S]*?)\\]`, 'm');
    const blockMatch = aiEngineSrc.match(blockRegex);
    if (blockMatch) {
      const block = blockMatch[1];
      const responseCount = (block.match(/response:/g) || []).length;
      assert(responseCount >= 2, `嫌疑人 ${sid}/${emotion} 预设对话数不足(${responseCount}条，至少2条)`);
    }
  }
}

console.log(`  离线预设覆盖: ✅ ${failCount - prevFails === 0 ? '全部通过' : `${failCount - prevFails} 失败`}\n`);

// ==================== 测试 8: 证据组合推理预设覆盖 ====================

prevFails = failCount;
console.log('═══ 测试 8: 证据组合推理预设覆盖 ═══\n');

// 提取 aiEngine.js 中的证据组合预设 key
const evidencePresetKeys = [];
const evPresetRegex = /relevant_\w+:\s*\{/g;
while ((match = evPresetRegex.exec(aiEngineSrc)) !== null) {
  const key = match[0].match(/(relevant_\w+)/)[1];
  evidencePresetKeys.push(key);
}

console.log(`  预设证据组合: ${evidencePresetKeys.join(', ')}`);

// 对每个案件的证据对，检查是否有对应的预设
for (const [caseId, caseData] of Object.entries(cases)) {
  // 收集案件的证据
  const caseEvidenceIds = [];
  for (const [sceneId, scene] of Object.entries(caseData.scenes || {})) {
    for (const hs of (scene.hotspots || [])) {
      if (hs.type === 'evidence' && hs.evidenceId) {
        caseEvidenceIds.push(hs.evidenceId);
      }
    }
  }
  
// 对每个证据的 canCombineWith，检查预设覆盖
  for (const eid of caseEvidenceIds) {
    const ev = evidenceData.evidence.find(e => e.id === eid);
    if (!ev?.canCombineWith?.length) continue;
    
    for (const targetId of ev.canCombineWith) {
      // 预设key格式：relevant_201_202（不含 evidence_ 前缀）
      const num1 = eid.replace('evidence_', '');
      const num2 = targetId.replace('evidence_', '');
      const key1 = `relevant_${num1}_${num2}`;
      const key2 = `relevant_${num2}_${num1}`;
      const hasPreset = evidencePresetKeys.includes(key1) || evidencePresetKeys.includes(key2);
      // 案件1用语义化key，跳过ID格式检查
      if (caseId === 'case_001') continue;
      assert(hasPreset, `[${caseId}] 证据对 ${eid}+${targetId} 无预设推理(${key1}/${key2})`);
    }
  }
}

// 测试 fallbackResponse 的双向匹配逻辑
// 模拟：relevant_201_202 和 relevant_202_201 应该互为回退
const testPairs = [
  ['evidence_201', 'evidence_202'],
  ['evidence_201', 'evidence_203'],
  ['evidence_202', 'evidence_203'],
  ['evidence_301', 'evidence_302'],
  ['evidence_301', 'evidence_303'],
  ['evidence_302', 'evidence_303'],
  ['evidence_004', 'evidence_001']  // case_001 的旧预设 relevant_chip_contract
];

// 注意：case_001 的预设用的是语义化 key (relevant_chip_contract, relevant_interface_welder)
// 这些不会被 ID 匹配逻辑覆盖，但 case_001 的证据需要单独检查
const case1Pairs = [
  ['evidence_001', 'evidence_004'],  // chip + contract (relevant_chip_contract)
  ['evidence_005', 'evidence_004'],  // injector + chip
];

console.log(`  检查案件1特殊预设key...`);
// 案件1用的是语义化 key，检查它们存在
assert(evidencePresetKeys.includes('relevant_chip_contract'), '案件1 预设 relevant_chip_contract 存在');
assert(evidencePresetKeys.includes('relevant_interface_welder'), '案件1 预设 relevant_interface_welder 存在');

console.log(`  证据组合预设覆盖: ✅ ${failCount - prevFails === 0 ? '全部通过' : `${failCount - prevFails} 失败`}\n`);

// ==================== 测试 9: 案件切换时变量隔离性 ====================

prevFails = failCount;
console.log('═══ 测试 9: 案件切换时变量隔离性 ═══\n');

// 模拟：先加载 case_001 构建变量，再加载 case_002 构建变量
// 确保不同案件的变量不会混入

const caseOrder = ['case_001', 'case_002', 'case_003', 'case_004'];
for (let i = 0; i < caseOrder.length - 1; i++) {
  const case1 = cases[caseOrder[i]];
  const case2 = cases[caseOrder[i + 1]];
  
  // 模拟 interrogateAI 构建 case1 的变量
  const sid1 = case1.suspects[0];
  const ch1 = charactersData.characters.find(c => c.id === sid1);
  const vars1 = {
    caseTruth: `凶手：${case1.truth.killerId === sid1 ? '是' : '否'}。动机：${case1.truth.motive}`,
    suspectName: ch1?.name || sid1,
    suspectIdentity: ch1?.identity || '未知',
    suspectPersonality: ch1?.personality || '未知',
    suspectKnowledge: ch1?.secretKnowledge || '未知',
    suspectLies: ch1?.lies?.map(l => l.lieText).join('; ') || '无',
    currentStress: '10',
    currentEmotion: 'calm',
    dialogueHistory: '',
    actionType: 'question',
    playerContent: '测试问题'
  };
  
  // 模拟切换到 case2
  const sid2 = case2.suspects[0];
  const ch2 = charactersData.characters.find(c => c.id === sid2);
  const vars2 = {
    caseTruth: `凶手：${case2.truth.killerId === sid2 ? '是' : '否'}。动机：${case2.truth.motive}`,
    suspectName: ch2?.name || sid2,
    suspectIdentity: ch2?.identity || '未知',
    suspectPersonality: ch2?.personality || '未知',
    suspectKnowledge: ch2?.secretKnowledge || '未知',
    suspectLies: ch2?.lies?.map(l => l.lieText).join('; ') || '无',
    currentStress: '50',
    currentEmotion: 'nervous',
    dialogueHistory: '',
    actionType: 'pressure',
    playerContent: '施压测试'
  };
  
  // 验证两套变量确实不同
  assert(vars1.suspectName !== vars2.suspectName, `${caseOrder[i]}→${caseOrder[i+1]} 切换后 suspectName 不同`);
  assert(vars1.caseTruth !== vars2.caseTruth, `${caseOrder[i]}→${caseOrder[i+1]} 切换后 caseTruth 不同`);
  
  // 验证变量替换后结果不包含另一案件的嫌疑人名
  // 注意：case_004的truth会引用其他案件角色名（by design），所以只在 caseTruth 之外的变量中检查
  const result1 = replaceVariables(interrogationTemplate, vars1);
  const result2 = replaceVariables(interrogationTemplate, vars2);
  
  // 检查 suspectName/suspectIdentity 等角色专属字段是否正确隔离
  // 从模板中抽取「姓名：{{suspectName}}」和「身份：{{suspectIdentity}}」区域验证
  const nameLine1 = result1.match(/姓名：(.+)/)?.[1] || '';
  const nameLine2 = result2.match(/姓名：(.+)/)?.[1] || '';
  assert(!nameLine2.includes(ch1?.name), `${caseOrder[i]}→${caseOrder[i+1]} case2的嫌疑人姓名不应包含case1嫌疑人名`);
  assert(!nameLine1.includes(ch2?.name), `${caseOrder[i]}→${caseOrder[i+1]} case1的嫌疑人姓名不应包含case2嫌疑人名`);
}

console.log(`  案件切换隔离性: ✅ ${failCount - prevFails === 0 ? '全部通过' : `${failCount - prevFails} 失败`}\n`);

// ==================== 测试 10: evidenceCombine 的 fallbackResponse 逻辑验证 ====================

prevFails = failCount;
console.log('═══ 测试 10: fallbackResponse 证据回退逻辑 ═══\n');

// 模拟 fallbackResponse 的证据回退逻辑（与 aiEngine.js 一致）
function simulateFallbackEvidenceResponse(ev1, ev2) {
  // 预设key格式：relevant_201_202（不含 evidence_ 前缀）
  const num1 = ev1.replace('evidence_', '');
  const num2 = ev2.replace('evidence_', '');
  const key1 = `relevant_${num1}_${num2}`;
  const key2 = `relevant_${num2}_${num1}`;
  
  // 从源码中检查是否存在对应的预设 key
  const hasKey1 = aiEngineSrc.includes(key1 + ':');
  const hasKey2 = aiEngineSrc.includes(key2 + ':');
  
  if (hasKey1 || hasKey2) {
    return { isRelevant: true, matchedKey: hasKey1 ? key1 : key2 };
  }
  return { isRelevant: false, matchedKey: null };
}

// 测试所有有效证据对
const testEvidencePairs = [
  // 案件1（语义化 key，不会被ID格式匹配）
  { ev1: 'evidence_001', ev2: 'evidence_004', expectMatch: false, note: '案件1用语义化key' },
  { ev1: 'evidence_005', ev2: 'evidence_004', expectMatch: false, note: '案件1用语义化key' },
  // 案件2
  { ev1: 'evidence_201', ev2: 'evidence_202', expectMatch: true },
  { ev1: 'evidence_201', ev2: 'evidence_203', expectMatch: true },
  { ev1: 'evidence_202', ev2: 'evidence_203', expectMatch: true },
  // 案件3
  { ev1: 'evidence_301', ev2: 'evidence_302', expectMatch: true },
  { ev1: 'evidence_301', ev2: 'evidence_303', expectMatch: true },
  { ev1: 'evidence_302', ev2: 'evidence_303', expectMatch: true },
  // 无关对
  { ev1: 'evidence_001', ev2: 'evidence_201', expectMatch: false, note: '跨案件不相关' },
  { ev1: 'evidence_201', ev2: 'evidence_301', expectMatch: false, note: '跨案件不相关' },
];

for (const pair of testEvidencePairs) {
  const result = simulateFallbackEvidenceResponse(pair.ev1, pair.ev2);
  const label = `${pair.ev1}+${pair.ev2}${pair.note ? ` (${pair.note})` : ''}`;
  assert(result.isRelevant === pair.expectMatch, `fallbackResponse ${label} 期望 ${pair.expectMatch}，得到 ${result.isRelevant}`);
}

console.log(`  证据回退逻辑: ✅ ${failCount - prevFails === 0 ? '全部通过' : `${failCount - prevFails} 失败`}\n`);

// ==================== 汇总 ====================

console.log('━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`  测试完成: ✅ ${passCount} 通过, ❌ ${failCount} 失败`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━');

if (failures.length > 0) {
  console.log('\n失败详情:');
  failures.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));
}

// 写入结果文件
const report = [
  '━━━━━━━━━━━━━━━━━━━━━━━',
  `  测试完成: ✅ ${passCount} 通过, ❌ ${failCount} 失败`,
  '━━━━━━━━━━━━━━━━━━━━━━━',
  '',
  failures.length > 0 ? '失败详情:' : '无失败项',
  ...failures.map((f, i) => `  ${i + 1}. ${f}`)
].join('\n');

writeFileSync(join(__dirname, 'test-result.txt'), report, 'utf8');
console.log(report);

process.exit(failCount > 0 ? 1 : 0);
