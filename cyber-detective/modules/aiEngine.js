/**
 * aiEngine.js - AI 引擎
 * 赛博朋克侦探叙事游戏
 *
 * 负责与大模型 API 交互，包括审讯对话、证据组合推理、场景调查。
 * 由 A 封装接口，B 提供 Prompt 模板。
 * Day3: 完整接入混元 OpenAI 兼容 API + 离线回退。
 */

import { getEmotion, getStress, getDialogueHistory as getStateHistory, getState, addDialogueToHistory, addStress, addScore, setFlag, addEvidence } from './gameState.js';

// ====================
// AI 配置
// ====================
const AI_CONFIG = {
  apiUrl: import.meta.env.VITE_HUNYUAN_API_URL || 'https://api.hunyuan.cloud.tencent.com/v1/chat/completions',
  apiKey: import.meta.env.VITE_HUNYUAN_API_KEY || '',
  model: 'hunyuan-lite',
  maxRetries: 2,
  timeout: 12000
};

// ====================
// 数据缓存（由 main.js 注入）
// ====================
let _charactersData = null;
let _evidenceData = null;
let _caseData = null;

/**
 * 初始化 AI 引擎（注入游戏数据）
 * @param {Object} charactersData
 * @param {Object} evidenceData
 * @param {Object} caseData
 */
export function initAIEngine(charactersData, evidenceData, caseData) {
  _charactersData = charactersData;
  _evidenceData = evidenceData;
  _caseData = caseData;
  console.log('[aiEngine] AI 引擎初始化完成, API Key:', AI_CONFIG.apiKey ? '已配置' : '未配置（将使用离线模式）');
}

/**
 * 动态切换案件上下文（多案件扩展）
 * 在 startCase 时调用，更新 AI 引擎当前引用的案件数据
 * @param {Object} caseData - 新案件数据
 */
export function setAIEngineCaseContext(caseData) {
  _caseData = caseData;
  console.log(`[aiEngine] 案件上下文已切换: ${caseData?.caseId || '未知'}`);
}

/**
 * 检查 API 是否可用
 * @returns {boolean}
 */
export function isAPIAvailable() {
  return !!AI_CONFIG.apiKey;
}

// ====================
// 离线模式预设回应
// ====================
const PRESET_RESPONSES = {
  interrogation: {
    suspect_001: {
      calm: [
        { response: "我那天确实在仓库里，你可以去查监控...虽然那一片的监控经常坏。", emotion: "calm", stressDelta: 0, hasContradiction: false, newClue: null },
        { response: "老师对我很好，教了我很多技术。我没有理由伤害他。", emotion: "calm", stressDelta: 0, hasContradiction: false, newClue: null },
        { response: "我只是他的助手，每天的工作就是准备器械、整理数据。其他的我不清楚。", emotion: "calm", stressDelta: 0, hasContradiction: false, newClue: null },
        { response: "师傅的病人很多，来来往往的人不少。我可没留意谁来了谁走了。", emotion: "calm", stressDelta: 0, hasContradiction: false, newClue: null }
      ],
      nervous: [
        { response: "我...我没必要回答这个问题。你们应该去查查赵明月，她才是和老师有秘密交易的人！", emotion: "nervous", stressDelta: 5, hasContradiction: true, newClue: "赵明月与陈老九有秘密交易" },
        { response: "那块芯片...那只是普通的数据备份！LXB只是...只是内部编号系统！", emotion: "nervous", stressDelta: 10, hasContradiction: true, newClue: null },
        { response: "焊接器？我怎么知道焊接器去哪了？也许老师自己收起来了！", emotion: "nervous", stressDelta: 8, hasContradiction: true, newClue: null },
        { response: "你们别一直盯着我看...我没做错什么！那些数据都是师傅自己的！", emotion: "nervous", stressDelta: 6, hasContradiction: true, newClue: null }
      ],
      broken: [
        { response: "好...好吧。我承认芯片是我的。但我没有杀师傅！我只是...我只是想保护自己。那些数据如果流出，我会变成替罪羊...", emotion: "broken", stressDelta: -5, hasContradiction: true, newClue: "林小北害怕成为替罪羊" },
        { response: "我确实在诊所里...我看到了师傅在联系买家，他要卖掉涅槃项目的数据。我求他不要这么做，但他根本不听...", emotion: "broken", stressDelta: -10, hasContradiction: true, newClue: "陈老九意图出售涅槃项目数据" },
        { response: "那晚...那晚他跟我说要把我从实验记录里抹掉。三年了，我帮他做了所有的事，他说抹就抹？我的义体里还留着他写的代码...我只是一时...", emotion: "broken", stressDelta: -8, hasContradiction: true, newClue: "林小北因被威胁而失控" },
        { response: "焊接器是我拿的...但不是用来杀人的！我只是...只是想用来改装一个信号屏蔽器...我害怕那些数据泄露...", emotion: "broken", stressDelta: -8, hasContradiction: true, newClue: "林小北拿走了焊接器" }
      ]
    },
    suspect_002: {
      calm: [
        { response: "我是一名企业高管，我的行程都有记录。那晚我在锐义科技总部加班，监控系统可以作证。", emotion: "calm", stressDelta: 0, hasContradiction: false, newClue: null },
        { response: "陈医生只是我偶尔光顾的义体维护师。你知道，企业级别的义体需要定期保养。仅此而已。", emotion: "calm", stressDelta: 0, hasContradiction: false, newClue: null },
        { response: "你可以去查我的所有通讯记录和财务流水。我和陈老九之间没有任何超出正常医患关系的往来。锐义科技不需要通过非法手段获取技术。", emotion: "calm", stressDelta: 0, hasContradiction: false, newClue: null },
        { response: "我对下城区的事情没什么兴趣。我的生活圈子在尖塔区，和这里的世界完全不同。", emotion: "calm", stressDelta: 0, hasContradiction: false, newClue: null }
      ],
      nervous: [
        { response: "涅槃？我不...我不知道你在说什么。那只是个概念代号，不是真实的项目！", emotion: "nervous", stressDelta: 10, hasContradiction: true, newClue: "赵明月否认涅槃项目" },
        { response: "那份合同...一定是伪造的！你凭什么认为那上面我的签名是真的？", emotion: "nervous", stressDelta: 15, hasContradiction: true, newClue: null },
        { response: "即使我资助过某些...实验研究，那也是合法的企业研发行为。你把黑市医生和企业投资混为一谈，这是诽谤。", emotion: "nervous", stressDelta: 8, hasContradiction: true, newClue: null },
        { response: "我的义眼闪烁只是散热系统的正常运作，和情绪没关系。别用那种眼神看我。", emotion: "nervous", stressDelta: 5, hasContradiction: true, newClue: null }
      ],
      broken: [
        { response: "好吧，涅槃是我的项目。但陈老九的死和我没有关系！我只是出资方，动手的事从来不是我做的！你们应该去查他的助手——林小北！", emotion: "broken", stressDelta: -5, hasContradiction: true, newClue: "赵明月承认涅槃项目存在" },
        { response: "我承认我出钱让陈老九做意识覆盖实验。但我没让他死！他拿着实验数据来勒索我...我是说，他想要更多的资金。然后他就死了。这和我没关系。", emotion: "broken", stressDelta: -8, hasContradiction: true, newClue: "赵明月承认出资+勒索关系" },
        { response: "是...我让陈老九做实验。但'意识覆盖'是技术突破，不是犯罪！只要不被人发现...可那个蠢货竟然要把数据卖掉！我没有杀他，但我承认...我松了一口气。", emotion: "broken", stressDelta: -10, hasContradiction: true, newClue: "赵明月在陈老九死后感到如释重负" }
      ]
    },
    suspect_003: {
      calm: [
        { response: "陈老九是我的老主顾了，我们合作有五年多了。他这人手艺不错，就是嘴巴不太严。", emotion: "calm", stressDelta: 0, hasContradiction: false, newClue: null },
        { response: "下城区的生意嘛，你懂的，大家都在灰色地带讨生活。但我从没碰过带血的钱。", emotion: "calm", stressDelta: 0, hasContradiction: false, newClue: null },
        { response: "你是说那批神经接口？就是普通的二手货，我进货都有记录的。不信你自己看。", emotion: "calm", stressDelta: 0, hasContradiction: false, newClue: null }
      ],
      nervous: [
        { response: "军...军用级？你开玩笑吧？那种东西我一个小小的零件贩子怎么可能搞得到？", emotion: "nervous", stressDelta: 10, hasContradiction: true, newClue: "钱一鸣否认经手军用级零件" },
        { response: "陈老九要的那批货...好吧，确实有点特殊。但他只说是给大客户备的，我哪知道他要用来干嘛？", emotion: "nervous", stressDelta: 8, hasContradiction: true, newClue: "陈老九曾向钱一鸣订购特殊神经接口组件" },
        { response: "新人类集团？我没和他们打过交道...好吧，偶尔有几个跑单帮的业务员找我拿过货，但就这些。", emotion: "nervous", stressDelta: 6, hasContradiction: true, newClue: "钱一鸣与新人类集团有间接业务往来" }
      ],
      broken: [
        { response: "行，我认了。那批货是从新人类的废品仓里流出来的——军用级神经接口组件。陈老九给的价钱让我没法拒绝...但我真不知道他要用那个杀人！我只是个做买卖的！", emotion: "broken", stressDelta: -5, hasContradiction: true, newClue: "钱一鸣承认提供军用级零件" },
        { response: "他死前两天来找过我，说需要一批'特殊规格'的电磁脉冲模块。我告诉他那种东西被盯得很紧...但他执意要，还给了我双倍的钱。我...我当时缺钱，就没多问。", emotion: "broken", stressDelta: -10, hasContradiction: true, newClue: "陈老九案发前向钱一鸣购买电磁脉冲模块" }
      ]
    },
    // ===== 案件2：数据深渊 =====
    suspect_201: {
      calm: [
        { response: "我那晚在46层办公室处理季度报告，门禁记录可以证明。47层的数据中心不在我的职责巡视范围内。", emotion: "calm", stressDelta: 0, hasContradiction: false, newClue: null },
        { response: "钱总是个优秀的同事。我们之间没有私交，但互相尊重。他的数据安全权限是他独立负责的领域。", emotion: "calm", stressDelta: 0, hasContradiction: false, newClue: null },
        { response: "机房的物理接口柜？每个数据中心都有。那是系统维护用的标准配置，没有任何特殊之处。", emotion: "calm", stressDelta: 0, hasContradiction: false, newClue: null },
        { response: "你说的'蓝屏'……我只知道那是一种神经接口的罕见不良反应。钱总生前确实提过这类风险。仅此而已。", emotion: "calm", stressDelta: 0, hasContradiction: false, newClue: null }
      ],
      nervous: [
        { response: "46和47层之间没有……我指的是没有常规通道。建筑结构图你可以去查物业档案。", emotion: "nervous", stressDelta: 8, hasContradiction: true, newClue: "方明辉否认46-47层间有通道" },
        { response: "我办公室后面的房间？那是消防通道，建筑规范要求的。什么生物锁？你在编故事吧。", emotion: "nervous", stressDelta: 12, hasContradiction: true, newClue: "方明辉否认隐蔽房间的存在" },
        { response: "蜂巢？那是钱总的私人AI助手。他关闭外部访问后，我对蜂巢的状态一无所知。", emotion: "nervous", stressDelta: 10, hasContradiction: true, newClue: null },
        { response: "安保盲区是系统故障。如果你暗示我利用了什么漏洞，请拿出证据而不是推测。", emotion: "nervous", stressDelta: 6, hasContradiction: true, newClue: null }
      ],
      broken: [
        { response: "……你找到了接口柜上的痕迹。是，我进过机房。但我没有杀人——我进去是为了销毁数据，不是杀人。钱致远已经死了，我只是……只是清理。", emotion: "broken", stressDelta: -5, hasContradiction: true, newClue: "方明辉承认进入机房" },
        { response: "好，保险箱里的东西你看到了。创世纪……那不是我一个人的决定。韩总批准了每一个阶段，我只是执行者。钱致远发现了，他要举报，我能怎么办？整个公司都会完！", emotion: "broken", stressDelta: -10, hasContradiction: true, newClue: "方明辉承认创世纪存在并指向韩世昌" },
        { response: "蓝屏病毒……是我写的。三行代码，通过物理接口注入，绕过所有防火墙。钱致远连痛苦都没有感觉到——至少这点，我尽了力。", emotion: "broken", stressDelta: -8, hasContradiction: true, newClue: "方明辉承认制造并注入蓝屏病毒" }
      ]
    },
    suspect_202: {
      calm: [
        { response: "4分钟的安保盲区是系统负载过高导致的临时故障。数据中心的监控系统压力一直是全楼最大的，我已经提交了故障报告。", emotion: "calm", stressDelta: 0, hasContradiction: false, newClue: null },
        { response: "我的工作是确保安保系统正常运行。出了故障，我负责修复，不是负责为故障辩护。你还有其他问题吗？", emotion: "calm", stressDelta: 0, hasContradiction: false, newClue: null },
        { response: "监控室进出人员很多，操作台上的东西我不可能一一核实。你说的U盘，我第一次听说。", emotion: "calm", stressDelta: 0, hasContradiction: false, newClue: null }
      ],
      nervous: [
        { response: "压力测试……那是CTO方明辉要求的标准操作流程。我只是在执行上级的指令，安保系统的手动切换需要CTO级别的授权。", emotion: "nervous", stressDelta: 8, hasContradiction: true, newClue: "刘小薇称安保盲区是方明辉授权的压力测试" },
        { response: "我不清楚钱总为什么关闭蜂巢的外部权限。我和他没有直接的工作交集——我管安保，他管数据。", emotion: "nervous", stressDelta: 5, hasContradiction: true, newClue: null },
        { response: "U盘……也许是我疏忽了。监控室确实会有人临时放置设备，我通常不做检查，除非接到安全警报。", emotion: "nervous", stressDelta: 10, hasContradiction: true, newClue: null }
      ],
      broken: [
        { response: "是我关的安保系统。方总说是压力测试，让我关4分钟。4分钟之后钱致远就死了……我是个当过兵的人，我知道那不是测试。但我能怎么办？拒绝CTO的指令？", emotion: "broken", stressDelta: -8, hasContradiction: true, newClue: "刘小薇承认手动关闭安保系统" },
        { response: "U盘是我放的。我在钱总死后查了系统日志，发现蜂巢在死前被强制迁移了数据。我把最后的备份拷了下来……我知道这样做违反规定，但那是钱总最后的痕迹。", emotion: "broken", stressDelta: -10, hasContradiction: true, newClue: "刘小薇承认故意留下蜂巢U盘" }
      ]
    },
    suspect_203: {
      calm: [
        { response: "蜂巢是钱总的私人AI助手，我负责日常维护和升级。它只是一个高级日程管理系统，没有什么特别的数据。", emotion: "calm", stressDelta: 0, hasContradiction: false, newClue: null },
        { response: "钱总关闭外部访问后，蜂巢进入休眠模式。我只保留了本地维护权限，没有任何数据操作。", emotion: "calm", stressDelta: 0, hasContradiction: false, newClue: null },
        { response: "我和钱总的关系？工作关系。他是个好老板，技术要求高但尊重专业人士。仅此而已。", emotion: "calm", stressDelta: 0, hasContradiction: false, newClue: null }
      ],
      nervous: [
        { response: "迁移数据？我只是执行钱总的……执行标准的系统维护操作。关闭外部访问后，本地备份是标准流程。", emotion: "nervous", stressDelta: 8, hasContradiction: true, newClue: "唐芸否认数据迁移的特殊性" },
        { response: "钱总和我……我们的关系很专业。他信任我的技术能力，我也尊重他的领导风格。没有更多了。", emotion: "nervous", stressDelta: 10, hasContradiction: true, newClue: null },
        { response: "保险箱？我不知道什么保险箱。钱总的个人物品我不了解，我只管蜂巢系统。", emotion: "nervous", stressDelta: 6, hasContradiction: true, newClue: null }
      ],
      broken: [
        { response: "……钱总给我留了一道加密指令。如果他在48小时内没有重新开放蜂巢权限，就把核心数据迁移到指定的物理保险箱。我执行了。他知道自己可能回不来了。", emotion: "broken", stressDelta: -10, hasContradiction: true, newClue: "唐芸承认执行钱致远的加密迁移指令" },
        { response: "他不只是我的老板。最后那条通讯……他说'小芸，对不起，连累你了。记住，数据比人重要。'……他知道自己要死了，还在想着保护证据。我怎么能让他白死？", emotion: "broken", stressDelta: -8, hasContradiction: true, newClue: "唐芸与钱致远有私人感情" }
      ]
    },
    // ===== 案件3：义体战争 =====
    suspect_301: {
      calm: [
        { response: "周铁手是我，铁手的铁，铁手的手。我在锐义科技做外部顾问，负责渠道对接，合法生意。", emotion: "calm", stressDelta: 0, hasContradiction: false, newClue: null },
        { response: "马三？听说是下城区一个黑市义体师。我这种人不会去下城区，我的办公室在尖塔区。", emotion: "calm", stressDelta: 0, hasContradiction: false, newClue: null },
        { response: "义体零件的供应链？我只负责企业级别的采购对接，不碰消费品和二手市场。", emotion: "calm", stressDelta: 0, hasContradiction: false, newClue: null }
      ],
      nervous: [
        { response: "孙婉清？我知道这个名字，是做义体耗材的中间人。但我跟她没有直接业务往来——顶多在一个行业活动上见过面。", emotion: "nervous", stressDelta: 8, hasContradiction: true, newClue: "周铁手否认与孙婉清有业务往来" },
        { response: "控制模块？你是什么意思？义体零件有内置芯片是行业标准，不是什么'隐藏'功能。你在搞阴谋论。", emotion: "nervous", stressDelta: 12, hasContradiction: true, newClue: null },
        { response: "马三的死跟我没有半毛钱关系。暴走事件那么混乱，死了人也不奇怪。你该去查那些暴走的改造者。", emotion: "nervous", stressDelta: 10, hasContradiction: true, newClue: null }
      ],
      broken: [
        { response: "行，零件是我供的。通过孙婉清中间走货，运到马三的诊所。但那些零件是锐义科技的正规产品，我只是在清库存……我不知道里面有什么控制模块。", emotion: "broken", stressDelta: -5, hasContradiction: true, newClue: "周铁手承认通过孙婉清向马三供应零件" },
        { response: "马三那个蠢货，他发现了模块还来勒索我。他以为拿到把柄就能拿捏我？我给过他机会的——闭嘴，拿钱，大家相安无事。是他自己选了死路。", emotion: "broken", stressDelta: -8, hasContradiction: true, newClue: "周铁手承认马三勒索未遂" },
        { response: "……是我激活的。远程激活他义体里的控制模块，让他的脑干过载关机。很简单，按一个键的事。创世纪需要干净的供应链，马三是个污染源，必须清除。", emotion: "broken", stressDelta: -10, hasContradiction: true, newClue: "周铁手承认远程激活杀死马三" }
      ]
    },
    suspect_302: {
      calm: [
        { response: "我、我就是马师傅的帮工，打杂的。搬搬东西、消消毒，不太懂技术。", emotion: "calm", stressDelta: 0, hasContradiction: false, newClue: null },
        { response: "诊所的零件都是马师傅自己进的货，我、我只管搬到冰柜里。从不过问来源，也不敢问。", emotion: "calm", stressDelta: 0, hasContradiction: false, newClue: null },
        { response: "那天晚上的事……我吓坏了，就跑了。马师傅平时对我挺好的，我不想他出事。", emotion: "calm", stressDelta: 0, hasContradiction: false, newClue: null }
      ],
      nervous: [
        { response: "那些货箱上……好像是有标签的。不是马师傅写的，是打印的，方方正正的。我、我没仔细看内容，真的！", emotion: "nervous", stressDelta: 8, hasContradiction: true, newClue: "阿七看到过打印标签的货箱" },
        { response: "密室……什么密室？诊所哪有什么密室？你、你别吓我，我什么都不知道。", emotion: "nervous", stressDelta: 10, hasContradiction: true, newClue: "阿七否认知道密室存在" },
        { response: "暴走之前……马师傅好像收到过消息，脸色特别差。他让我把……让我把一些文件收到下面仓库去。说是以防万一。", emotion: "nervous", stressDelta: 6, hasContradiction: true, newClue: "阿七承认马三让他转移文件" }
      ],
      broken: [
        { response: "好吧……好吧我全说。暴走之前三天，有个手是铁的人来找马师傅，他们在密室吵了一架。马师傅说'零件有鬼，你得加钱'，那人走了以后马师傅就让我把出货记录藏到B4层。他说……他说要是他出事了，就把记录交给下城区的线人。", emotion: "broken", stressDelta: -8, hasContradiction: true, newClue: "阿七目击马三与周铁手争吵" },
        { response: "马师傅是唯一对我好的人……他教我认字、教我修义体、给我饭吃。他不该死的……那些零件有问题是真的人家不知道吗？我不信。他们就是不管下城区的人死活……", emotion: "broken", stressDelta: -10, hasContradiction: true, newClue: "阿七透露马三知道零件有问题" }
      ]
    },
    suspect_303: {
      calm: [
        { response: "孙婉清就是我。我帮下城区的诊所对接正规供应商，做的是合法采购代理。手续费不高，图个安稳。", emotion: "calm", stressDelta: 0, hasContradiction: false, newClue: null },
        { response: "马三的诊所？我帮他采购过一些常规耗材，民用级别的消毒液、缝合线之类。量不大，月均一两单。", emotion: "calm", stressDelta: 0, hasContradiction: false, newClue: null },
        { response: "控制模块？我是做采购的，不是做技术的。零件买来什么样就是什么样，我只管走账。", emotion: "calm", stressDelta: 0, hasContradiction: false, newClue: null }
      ],
      nervous: [
        { response: "特供零件？我不太明白你在说什么。马三的订单里没有标注'特供'的条目，你可以查采购记录。", emotion: "nervous", stressDelta: 8, hasContradiction: true, newClue: "孙婉清否认经手特供零件" },
        { response: "周铁手……我听说过，锐义科技的顾问。但我没有跟他直接合作过。我只是个中间人，不是供应链经理。", emotion: "nervous", stressDelta: 10, hasContradiction: true, newClue: null },
        { response: "模块兼容性测试……那只是供应商要求的标准质检流程，确保零件与常见义体系统兼容。没有特殊含义。", emotion: "nervous", stressDelta: 12, hasContradiction: true, newClue: "孙婉清声称模块测试是标准流程" }
      ],
      broken: [
        { response: "好吧，我经手过那批零件。周铁手提供货源，我负责伪装成合法采购运到马三那里。运费按单结算，每单抽15%。但你以为我有选择吗？周铁手那种人，说不合作就真的不会跟你商量第二次。", emotion: "broken", stressDelta: -5, hasContradiction: true, newClue: "孙婉清承认是周铁手和马三的中间人" },
        { response: "我知道零件里有'额外功能'。激活频率校准？是，我帮周铁手确认过模块与中继器的频率匹配。但我从没亲眼见过模块被激活……直到暴走事件发生后，我才意识到那些'额外功能'到底是什么。", emotion: "broken", stressDelta: -10, hasContradiction: true, newClue: "孙婉清承认知道隐藏模块并参与频率校准" }
      ]
    },
    // ===== 案件4：最后的真相 =====
    suspect_401: {
      calm: [
        { response: "侦探，我等这一天已经很久了。请坐，茶还是咖啡？我们有很多时间。", emotion: "calm", stressDelta: 0, hasContradiction: false, newClue: null },
        { response: "创世纪不是犯罪，是进化。意识可以被量化、复制、传输——这是人类文明的下一个台阶。你看到的那些'受害者'，是迈出第一步的先行者。", emotion: "calm", stressDelta: 0, hasContradiction: false, newClue: null },
        { response: "三起命案？我深表遗憾。但任何伟大的进步都有代价。你用电力的时候，不会为第一座发电厂的事故默哀，对吧？", emotion: "calm", stressDelta: 0, hasContradiction: false, newClue: null },
        { response: "法律？法律永远落后于技术。今天你定义为'窃取'的行为，五十年后会被写进教科书叫'意识数字化突破'。", emotion: "calm", stressDelta: 0, hasContradiction: false, newClue: null }
      ],
      nervous: [
        { response: "执行层面的越权行为，我无法逐一监管。陈老九、方明辉、周铁手……他们是成年人，他们的行为由他们自己负责。", emotion: "nervous", stressDelta: 5, hasContradiction: true, newClue: "韩世昌将责任推给执行层" },
        { response: "知情同意书？当然有。每一份都经过法务审核。你说他们不知道模块的存在？那就说明法务流程需要改进，不是创世纪本身有问题。", emotion: "nervous", stressDelta: 8, hasContradiction: true, newClue: null },
        { response: "授权签名……你在架构图里看到的那些签名，是项目阶段审批，不是杀人授权。不要混淆概念。", emotion: "nervous", stressDelta: 10, hasContradiction: true, newClue: "韩世昌否认签名为杀人授权" }
      ],
      broken: [
        { response: "你以为抓住我就结束了？侦探，你关掉的不是一台机器——你关掉的是人类的未来。没有创世纪，这些人永远活在底层，永远负担不起好的义体。我让他们用得起，我让他们进化，我有错吗？", emotion: "broken", stressDelta: -5, hasContradiction: true, newClue: "韩世昌承认创世纪利用了下城区居民" },
        { response: "是，我签了每一个阶段的审批。'清除威胁源'——这四个字，我写的。但你不明白的是……我从来不需要亲自动手，因为系统在替我运转。我是设计者，不是操作员。区别很大吗？……也许没有。", emotion: "broken", stressDelta: -10, hasContradiction: true, newClue: "韩世昌承认签批'清除威胁源'指令" }
      ]
    }
  },
  evidence: {
    irrelevant: {
      isRelevant: false,
      insight: "这两件证据之间似乎没有直接的逻辑关联。也许换一种组合方式会有新的发现。",
      unlocksEvidence: null
    },
    relevant_chip_contract: {
      isRelevant: true,
      insight: "加密数据芯片（LXB-003）与撕碎的合同存在关键关联：芯片上的编号'LXB'与林小北名字缩写吻合，而合同中'涅槃'项目的实验日志可能就存储在这块芯片中。赵明月作为出资方的签名进一步证实了这条资金链——林小北执行实验，赵明月提供资源。",
      unlocksEvidence: "evidence_005"
    },
    relevant_interface_welder: {
      isRelevant: true,
      insight: "破损的神经接口上的电磁灼烧痕迹，与工具架上缺失的电磁脉冲焊接器形成物理因果链——焊接器经过改装后可以定向释放高能脉冲，精确烧毁神经接口而不留下外部创伤。这正是陈老九的死因。而能够接触到这把工具的人，只有经常在诊所工作的内部人员。",
      unlocksEvidence: null
    },
    // ===== 案件2：数据深渊 =====
    relevant_201_202: {
      isRelevant: true,
      insight: "物理接口柜上残留的'蓝屏'病毒激活签名，与方明辉办公室隐蔽房间里的数据保险箱形成完整的因果链——方明辉通过物理接口注入病毒灭口钱致远，而保险箱中存储的正是钱致远试图保护的'创世纪'核心证据。生物锁只对方明辉开放，证明他既知道保险箱的存在，也控制着机房物理接口的访问权。",
      unlocksEvidence: null
    },
    relevant_201_203: {
      isRelevant: true,
      insight: "物理接口柜的病毒残留与蜂巢U盘的备份数据揭示了完整的时间线——方明辉在钱致远死前72小时曾试图通过外部接口访问'蜂巢'系统但被拒绝（钱致远已关闭外部权限），随后他利用4分钟安保盲区通过物理接口注入'蓝屏'病毒。刘小薇'遗忘'的U盘恰好保存了这段关键日志。",
      unlocksEvidence: null
    },
    relevant_202_203: {
      isRelevant: true,
      insight: "数据保险箱与蜂巢最终备份拼成了钱致远的完整反击计划——他关闭蜂巢外部权限后，通过加密指令让唐芸将核心数据迁移到只有方明辉能打开的保险箱。这是一个精妙的陷阱：方明辉必须打开保险箱才能销毁证据，但打开保险箱的神经信号会被记录，成为他知晓'创世纪'的铁证。",
      unlocksEvidence: null
    },
    // ===== 案件3：义体战争 =====
    relevant_301_302: {
      isRelevant: true,
      insight: "冰柜中锐义科技编号的义体零件与密室中的信号中继器形成供应链闭环——零件上的编号证明它们来自锐义科技工厂，而信号中继器证明这些零件不只是被安装，还在被实时监控。神经信号数据被转发至锐义科技总部，这不是质量问题，这是有组织的大规模意识信号采集。",
      unlocksEvidence: null
    },
    relevant_301_303: {
      isRelevant: true,
      insight: "锐义科技编号的义体零件与隐藏控制模块的关系如同枪与子弹——零件是合法外衣，模块是隐藏的杀机。每一个'特价升级'的义体改造者都成了一枚可被远程引爆的活体炸弹。马三的死因与控制模块的过载模式完全一致：这不是意外，是精确的远程灭口。",
      unlocksEvidence: null
    },
    relevant_302_303: {
      isRelevant: true,
      insight: "信号中继器与隐藏控制模块构成了'创世纪'第三阶段的技术核心——模块负责采集和执行，中继器负责传输和调度。六组实时神经信号波形意味着至少六个人正在被远程监控和控制。马三发现这套系统后试图勒索，他不知道自己掌中的不是筹码，而是自己的死亡开关。",
      unlocksEvidence: null
    }
  }
};

// ====================
// Prompt 模板加载
// ====================

/**
 * 加载 Prompt 模板并进行变量替换
 * @param {string} templateName - 模板名称
 * @param {Object} variables - 变量键值对
 * @returns {Promise<string>} 替换后的 Prompt 文本
 */
async function loadPrompt(templateName, variables) {
  try {
    const response = await fetch(`/prompts/${templateName}.txt`);
    if (!response.ok) throw new Error(`加载模板失败: ${templateName}`);
    let template = await response.text();

    // 替换变量
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return variables[key] !== undefined ? variables[key] : match;
    });
  } catch (e) {
    console.error('[aiEngine] 加载 Prompt 模板失败:', e);
    return '';
  }
}

// ====================
// API 调用封装
// ====================

/**
 * 调用大模型 API（混元 OpenAI 兼容接口）
 * @param {string} prompt - 完整的 system prompt
 * @param {Array} history - 对话历史 [{role, content}]
 * @returns {Promise<Object|null>} 解析后的 JSON 响应，失败返回 null
 */
async function callAPI(prompt, history = []) {
  if (!AI_CONFIG.apiKey) {
    console.warn('[aiEngine] API Key 未配置，使用离线模式');
    return null;
  }

  const messages = [
    { role: 'system', content: prompt },
    ...history.slice(-10) // 保留最近10条对话作为上下文
  ];

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AI_CONFIG.timeout);

  for (let attempt = 0; attempt <= AI_CONFIG.maxRetries; attempt++) {
    try {
      const response = await fetch(AI_CONFIG.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${AI_CONFIG.apiKey}`
        },
        body: JSON.stringify({
          model: AI_CONFIG.model,
          messages,
          temperature: 0.7,
          max_tokens: 500,
          response_format: { type: 'json_object' }
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        throw new Error(`API 返回错误 ${response.status}: ${errText.slice(0, 200)}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        throw new Error('API 返回内容为空');
      }

      // 尝试解析 JSON
      try {
        return JSON.parse(content);
      } catch {
        // 尝试从文本中提取 JSON
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
        throw new Error('无法解析 API 返回的 JSON');
      }

    } catch (e) {
      console.warn(`[aiEngine] API 调用失败 (尝试 ${attempt + 1}/${AI_CONFIG.maxRetries + 1}):`, e.message);

      if (attempt === AI_CONFIG.maxRetries) {
        console.warn('[aiEngine] API 调用全部失败，使用离线模式');
        return null;
      }

      // 指数退避重试
      await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
    }
  }

  clearTimeout(timeoutId);
  return null;
}

// ====================
// Public API
// ====================

/**
 * 审讯嫌疑人（核心 AI 接口）
 * @param {Object} params
 *   @prop {string} suspectId - 嫌疑人 ID
 *   @prop {string} action - 'question' | 'present_evidence' | 'pressure'
 *   @prop {string} content - 玩家输入内容或证据描述
 * @returns {Promise<Object>}
 */
export async function interrogateAI(params) {
  const { suspectId, action, content } = params;
  const currentStress = getStress(suspectId);
  const currentEmotion = getEmotion(suspectId);
  const history = getStateHistory();

  // 查找角色数据
  const character = _charactersData?.characters?.find(c => c.id === suspectId);

  // 构建变量
  const caseTruth = _caseData?.truth
    ? `凶手：${_caseData.truth.killerId === suspectId ? '就是此嫌疑人' : '不是此嫌疑人'}。动机：${_caseData.truth.motive}。凶器：${_caseData.truth.weapon}。关键证据：${_caseData.truth.keyEvidence?.join('、') || '未知'}`
    : '案件真相数据缺失';

  const variables = {
    caseTruth,
    suspectName: character?.name || suspectId,
    suspectIdentity: character?.identity || '未知',
    suspectPersonality: character?.personality || '未知',
    suspectKnowledge: character?.secretKnowledge || '未知',
    suspectLies: character?.lies?.map(l => `关于"${l.topic}"：${l.lieText}（真相：${l.truthText}，反证：${l.counterEvidence}）`).join('\n') || '无',
    currentStress: String(currentStress),
    currentEmotion,
    dialogueHistory: history.slice(-10).map(h => `${h.role === 'user' ? '侦探' : character?.name || '嫌疑人'}: ${h.content}`).join('\n'),
    actionType: action,
    playerContent: content
  };

  // 显示 AI 思考动画
  showAIThinking(true);

  const prompt = await loadPrompt('interrogation', variables);
  const aiResult = await callAPI(prompt, history.slice(-10).map(h => ({ role: h.role, content: h.content })));

  showAIThinking(false);

  if (aiResult && aiResult.response) {
    // 校验 AI 返回的数据完整性
    return _validateInterrogationResult(aiResult, suspectId);
  }

  // 离线模式回退
  return fallbackResponse('interrogation', { suspectId, currentEmotion });
}

/**
 * 证据组合推理（AI 接口）
 * @param {Object} params
 *   @prop {string} ev1 - 证据1 ID
 *   @prop {string} ev2 - 证据2 ID
 * @returns {Promise<Object>}
 */
export async function evidenceCombineAI(params) {
  const { ev1, ev2 } = params;
  const state = getState();

  const ev1Data = _evidenceData?.evidence?.find(e => e.id === ev1);
  const ev2Data = _evidenceData?.evidence?.find(e => e.id === ev2);

  const variables = {
    caseBackground: `${_caseData?.title || '未知案件'}：${_caseData?.setting?.background || '案件背景缺失'}`,
    obtainedEvidence: state.evidenceObtained.map(id => {
      const ev = _evidenceData?.evidence?.find(e => e.id === id);
      return ev ? `${ev.name}(${ev.type})` : id;
    }).join('、'),
    ev1Name: ev1Data?.name || ev1,
    ev1Desc: ev1Data?.description || '无描述',
    ev2Name: ev2Data?.name || ev2,
    ev2Desc: ev2Data?.description || '无描述'
  };

  showAIThinking(true);

  const prompt = await loadPrompt('evidenceCombine', variables);
  const aiResult = await callAPI(prompt);

  showAIThinking(false);

  if (aiResult && aiResult.insight !== undefined) {
    // 检查是否解锁了新证据
    if (aiResult.unlocksEvidence && !state.evidenceObtained.includes(aiResult.unlocksEvidence)) {
      addEvidence(aiResult.unlocksEvidence);
    }
    return _validateEvidenceCombineResult(aiResult);
  }

  // 离线模式回退
  return fallbackResponse('evidence', { ev1, ev2 });
}

/**
 * 场景调查（AI 接口）
 * @param {Object} params
 *   @prop {string} sceneId - 场景 ID
 *   @prop {string} action - 玩家调查动作
 * @returns {Promise<Object>}
 */
export async function investigateAI(params) {
  const { sceneId, action } = params;
  const state = getState();

  const scene = _caseData?.scenes?.[sceneId];

  const variables = {
    caseBackground: `${_caseData?.title || '未知案件'}：${_caseData?.setting?.background || '案件背景缺失'}`,
    sceneName: scene?.name || sceneId,
    sceneDescription: scene?.description || '一间阴暗的房间',
    playerAction: action,
    obtainedEvidence: state.evidenceObtained.map(id => {
      const ev = _evidenceData?.evidence?.find(e => e.id === id);
      return ev ? ev.name : id;
    }).join('、')
  };

  showAIThinking(true);

  const prompt = await loadPrompt('sceneInvestigate', variables);
  const aiResult = await callAPI(prompt);

  showAIThinking(false);

  if (aiResult && aiResult.description) {
    // 如果 AI 发现了证据，自动添加
    if (aiResult.foundEvidence && Array.isArray(aiResult.foundEvidence)) {
      aiResult.foundEvidence.forEach(evId => {
        addEvidence(evId);
      });
    }
    return aiResult;
  }

  // 离线模式回退
  return fallbackResponse('investigate', { sceneId, action });
}

/**
 * 生成结局文本（AI 接口）
 * @param {Object} params
 *   @prop {string} endingType - 'ending_good' | 'ending_normal' | 'ending_bad'
 *   @prop {string} endingTitle - 结局标题
 *   @prop {number} finalScore - 最终评分
 *   @prop {string} playerChoices - 玩家关键选择描述
 * @returns {Promise<Object>}
 */
export async function generateEndingAI(params) {
  const { endingType, endingTitle, finalScore, playerChoices } = params;
  const state = getState();

  // 构建嫌疑人摘要
  const suspectsSummary = _caseData?.suspects?.map(sid => {
    const ch = _charactersData?.characters?.find(c => c.id === sid);
    if (!ch) return `${sid}: 未知`;
    const isKiller = _caseData?.truth?.killerId === sid;
    return `${ch.name}（${ch.identity}）${isKiller ? '【真凶】' : ''}：${ch.personality || ''}`;
  }).join('\n') || '嫌疑人数据缺失';

  // 构建案件真相
  const caseTruth = _caseData?.truth
    ? `真凶：${_caseData.truth.killerId}。动机：${_caseData.truth.motive}。凶器/手段：${_caseData.truth.weapon}。关键证据：${_caseData.truth.keyEvidence?.join('、') || '未知'}`
    : '案件真相数据缺失';

  const variables = {
    caseTruth,
    suspectsSummary,
    endingType: endingType || 'ending_normal',
    endingTitle: endingTitle || '未知结局',
    finalScore: String(finalScore || 0),
    playerChoices: playerChoices || '玩家完成了调查。'
  };

  const prompt = await loadPrompt('ending', variables);
  const aiResult = await callAPI(prompt);

  if (aiResult && aiResult.endingText) {
    return aiResult;
  }

  // 离线模式回退
  return {
    endingText: '案件终于落下帷幕。无论结果如何，新香港的霓虹灯依旧闪烁，而下城区的人们继续在阴影中前行。',
    epilogue: '新香港下城区某条加密频道：案件已归档。'
  };
}

/**
 * 主线剧情旁白（AI 接口）
 * @param {Object} params
 *   @prop {string} currentSituation - 当前局势描述
 *   @prop {string} casesSummary - 已结案件摘要
 * @returns {Promise<Object>}
 */
export async function plotNarrateAI(params) {
  const { currentSituation, casesSummary } = params;

  const variables = {
    currentSituation: currentSituation || '侦探正在事务所中整理线索。',
    casesSummary: casesSummary || '尚无已结案件。'
  };

  const prompt = await loadPrompt('plotNarration', variables);
  const aiResult = await callAPI(prompt);

  if (aiResult && aiResult.narration) {
    return aiResult;
  }

  // 离线模式回退
  return {
    narration: '事务所的终端机安静地运转着，等待下一个案件的简报。',
    suggestion: '查看是否有新的案件可以接受。'
  };
}

// ====================
// 离线模式回退
// ====================

/**
 * 离线模式回退
 * @param {string} type - 'interrogation' | 'evidence' | 'investigate'
 * @param {Object} context
 * @returns {Object} 与 AI 返回格式一致的对象
 */
export function fallbackResponse(type, context) {
  if (type === 'interrogation') {
    const { suspectId, currentEmotion } = context;
    const emotion = currentEmotion || 'calm';
    const presetPool = PRESET_RESPONSES.interrogation[suspectId]?.[emotion];

    if (presetPool && presetPool.length > 0) {
      const idx = Math.floor(Math.random() * presetPool.length);
      return presetPool[idx];
    }

    return {
      response: "我没什么好说的。你们应该去查查其他人。",
      emotion: "calm",
      stressDelta: 0,
      hasContradiction: false,
      newClue: null
    };
  }

  if (type === 'evidence') {
    const { ev1, ev2 } = context;
    // 尝试按证据ID对查找预设推理（双向匹配）
    const key1 = `relevant_${ev1}_${ev2}`;
    const key2 = `relevant_${ev2}_${ev1}`;
    const preset = PRESET_RESPONSES.evidence[key1] || PRESET_RESPONSES.evidence[key2];
    return preset || PRESET_RESPONSES.evidence.irrelevant;
  }

  return {
    description: '你仔细调查了周围的环境，没有发现特别的线索。',
    foundEvidence: [],
    atmosphere: '空气中弥漫着电子设备的热量。'
  };
}

// ====================
// 数据校验
// ====================

function _validateInterrogationResult(result, suspectId) {
  return {
    response: String(result.response || '...'),
    emotion: ['calm', 'nervous', 'broken'].includes(result.emotion) ? result.emotion : 'calm',
    stressDelta: Number(result.stressDelta) || 0,
    hasContradiction: Boolean(result.hasContradiction),
    newClue: result.newClue || null
  };
}

function _validateEvidenceCombineResult(result) {
  return {
    isRelevant: Boolean(result.isRelevant),
    insight: String(result.insight || '无法确定关联性。'),
    unlocksEvidence: result.unlocksEvidence || null
  };
}

// ====================
// UI 辅助
// ====================

/**
 * 显示/隐藏 AI 思考动画
 * @param {boolean} show
 */
export function showAIThinking(show) {
  const el = document.getElementById('ai-thinking');
  if (!el) return;

  if (show) {
    el.classList.remove('hidden');
  } else {
    el.classList.add('hidden');
  }
}
