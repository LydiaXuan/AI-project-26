/* 默认数据集 —— 首次打开时写入 localStorage，之后所有编辑都基于本地副本。
   来源：飞书多维表格「AI 提效场景」156 条记录，过滤安卓小游戏方向后保留的 93 条。 */
const DEFAULT_DATA = {
  version: 1,
  updatedAt: null,
  stages: [
    {
      id: "S1", name: "竞品情报·市场调研", foundation: false,
      pipeline: ["done", "done", "gap", "done"],
      tools: [
        { n: "AI监控竞品标题在线/改名/下架情况", s: "已实现", shared: false },
        { n: "竞品变化监控Python脚本，自动监控竞品商店页变更", s: "已实现", shared: true },
        { n: "对比竞品自动生成重点产品的自然量优化计划", s: "已实现", shared: true },
        { n: "关键词桌面工具（拉取+竞品+追踪）", s: "已实现", shared: true },
        { n: "调研竞品市场元数据/历史活动图，本地保存并给出图片优化建议", s: "进行中", shared: true },
        { n: "竞品元数据历史CSV→关键词变动分析+文案风险词策略+分类占比", s: "进行中", shared: true },
        { n: "竞品开发者新品获取", s: "已归档", shared: true }
      ]
    },
    {
      id: "S2", name: "立项·命名·合规", foundation: false,
      pipeline: ["done", "done", "gap", "wip"],
      tools: [
        { n: "输入玩法抓取同玩法包名词，给出建议包名", s: "已实现", shared: true },
        { n: "包名可用性检查（符合包名规则）", s: "已实现", shared: true },
        { n: "AI参考名：商店唯一性+商标侵权查询，支持标题自查", s: "已实现", shared: true },
        { n: "名称线上使用查询自动回复", s: "已实现", shared: true },
        { n: "平台提交提名：按小编喜好AI生成提名文案", s: "进行中", shared: true },
        { n: "AI截图对比竞品界面相似度分析", s: "进行中", shared: true },
        { n: "输入玩法/主题生成英文名并查iOS同名情况", s: "进行中", shared: true },
        { n: "软著线上使用AI自动检索", s: "已归档", shared: true }
      ]
    },
    {
      id: "S3", name: "发布上架·工程", foundation: false,
      pipeline: ["done", "wip", "gap", "done"],
      tools: [
        { n: "参数工程：基础静态参数自动处理，icon启动页自动上传", s: "已实现", shared: true },
        { n: "输入Apple ID自动爬取对应CPP页面", s: "已实现", shared: true },
        { n: "新发产品自动导入，高风险产品自动对比分析", s: "进行中", shared: true },
        { n: "自动分析个人/全组发布任务处理情况", s: "已归档", shared: true }
      ]
    },
    {
      id: "S4", name: "文案·关键词 ASO", foundation: false,
      pipeline: ["done", "done", "done", "done"],
      tools: [
        { n: "宣传图文案编写Gem（关键词/视觉双模式，3组文案+翻译）", s: "已实现", shared: false },
        { n: "GP自研产品ASO经验总结调研skill体系", s: "已实现", shared: true },
        { n: "GP关键词覆盖度及霸榜查询工具", s: "已实现", shared: false },
        { n: "AKO关键词优化器：高密度高保留度插词", s: "已实现", shared: true },
        { n: "筛选排序关键词，确定最终保留词", s: "已实现", shared: true },
        { n: "分析谷歌后台带量词，给出方向和关键词建议", s: "已实现", shared: true },
        { n: "GP CPP短描/长描第一段主题改写工具", s: "已实现", shared: true },
        { n: "AppTweak关键词18语言批量抓取工具", s: "已实现", shared: false },
        { n: "AppTweak+后台关键词分析的版本迭代优化平台", s: "已实现", shared: true },
        { n: "点点数据+AppTweak关键词覆盖/排名每日定时爬取", s: "已实现", shared: true },
        { n: "文案上传后台", s: "已实现", shared: true },
        { n: "文案迭代优化（插词/合规检查/活动文案/邮件回复一体）", s: "已实现", shared: true },
        { n: "GP搜索字词分析平台，给出ASO建议", s: "已实现", shared: true },
        { n: "ST关键词拉取，自动生成合规标题和关键词", s: "已实现", shared: true },
        { n: "新发文案机器人（选词加词NLP多语言翻译一体化）", s: "已实现", shared: false },
        { n: "图文生成App Store合规产品描述文案+多语言翻译", s: "进行中", shared: true },
        { n: "GP关键词排名查询工具（爬第三方补官方无收录排名）", s: "进行中", shared: false },
        { n: "定时查找各地区带量关键词+监控推送需优化项", s: "未开始", shared: true },
        { n: "关键词排名追踪，每日自动拉取排名", s: "已归档", shared: true }
      ]
    },
    {
      id: "S5", name: "图测·美宣创意", foundation: false,
      pipeline: ["done", "wip", "done", "wip"],
      tools: [
        { n: "TimeMap：下载量&图测可视化创建（GAS+cursor两工具）", s: "已实现", shared: true },
        { n: "AI检测美宣交付图错别字/GM按钮等bug，并入飞书流程", s: "已实现", shared: true },
        { n: "飞书任务+用户画像的历史图测分析，给出下一步计划", s: "已实现", shared: true },
        { n: "批量搜集产品不同国家的当前市场图", s: "已实现", shared: true },
        { n: "AI生图提示词助手", s: "已实现", shared: false },
        { n: "历史图测分析", s: "进行中", shared: true },
        { n: "Top20产品活动前2月批量创建固定节日活动图需求", s: "进行中", shared: true },
        { n: "自动创建美宣需求关联的转化率优化记录（识别送审地区）", s: "进行中", shared: true },
        { n: "AI出美宣示意图/icon前期发散(Image2)", s: "进行中", shared: false },
        { n: "已应用图测结果定时自动推送脚本", s: "进行中", shared: false },
        { n: "群会话自动生成美宣需求并选定人员", s: "进行中", shared: true },
        { n: "个人图片分类图库（美术素材管理）", s: "进行中", shared: false },
        { n: "海外CP图测优化跟进", s: "进行中", shared: true },
        { n: "自动在后台上传图测", s: "进行中", shared: true },
        { n: "谷歌后台图测数据日常巡检", s: "进行中", shared: true },
        { n: "利用AI生成3D模型素材", s: "进行中", shared: false },
        { n: "发布组提美宣需求自动化Web工具（图测方向生成）", s: "进行中", shared: false },
        { n: "商店页icon/宣传图创意迁移工具（迁移+灵感双模式）", s: "进行中", shared: true },
        { n: "AI分析商店页批量生成图测创意，人工确认", s: "未开始", shared: true },
        { n: "自动拉取图测数据+暂停填充分析", s: "实现不了", shared: true }
      ]
    },
    {
      id: "S6", name: "推广活动", foundation: false,
      pipeline: ["done", "done", "gap", "done"],
      tools: [
        { n: "图片自动生成3版本视频提示词（含运动轨迹合理性）", s: "已实现", shared: true },
        { n: "活动图生视频提示词skill(seedance)", s: "已实现", shared: false },
        { n: "自动整理生成推广活动文案，自动上传", s: "已实现", shared: true },
        { n: "自动关联iOS国内/海外产品，活动只提交一次", s: "已实现", shared: true },
        { n: "AI视频生成工具（即梦+seedance2.0+CLI），手搓宣传视频", s: "已实现", shared: false },
        { n: "产品分享语自动生成", s: "已实现", shared: false },
        { n: "按玩法类型每月总结下月可做推广节日", s: "已实现", shared: true },
        { n: "每周提醒谷歌官方节日热点+推广活动创意", s: "已实现", shared: true },
        { n: "GAS活动文案生成插件", s: "进行中", shared: false },
        { n: "产品分享链接固定化+分享文案自动填充", s: "进行中", shared: false },
        { n: "竞品推广活动图抓取并分析", s: "未开始", shared: true },
        { n: "推广活动复盘", s: "已归档", shared: true }
      ]
    },
    {
      id: "S7", name: "数据监控·复盘", foundation: false,
      pipeline: ["done", "done", "na", "done"],
      tools: [
        { n: "管理各自负责游戏产品及其优化频率", s: "已实现", shared: true },
        { n: "海外重点产品评分监控（8国/低于4.5周一提醒）", s: "已实现", shared: false },
        { n: "产品清榜恢复监控+新上架产品播报（七麦）", s: "已实现", shared: false },
        { n: "自动收集一周热点生成文档+节日预告", s: "已实现", shared: true },
        { n: "推广活动深度复盘Skill（配合TimeMap）", s: "进行中", shared: false },
        { n: "自然量缓慢下滑产品监控+趋势提醒", s: "进行中", shared: false },
        { n: "自动分析个人/全组优化任务处理情况", s: "进行中", shared: true },
        { n: "新增用户留存/时长影响因素分析skill", s: "进行中", shared: false },
        { n: "游戏榜单监控，进榜产品推送+AI分析玩法", s: "进行中", shared: false }
      ]
    },
    {
      id: "S8", name: "用户维护·邮件", foundation: false,
      pipeline: ["done", "done", "done", "done"],
      tools: [
        { n: "邮件回复助手（翻译+拟写回复一体化）", s: "已实现", shared: true },
        { n: "定时读取ASA相关邮件，汇总发送至飞书", s: "已实现", shared: false },
        { n: "aily整理ASA账户和投放产品汇总", s: "已实现", shared: false },
        { n: "邮件分类-审核-回复（翻译/模板一键生成）", s: "已实现", shared: true },
        { n: "特定邮件一键回复", s: "已实现", shared: false },
        { n: "账号支持邮件AI回复助手（翻译+生成回复）", s: "已实现", shared: true },
        { n: "审核备注自动生成工具", s: "进行中", shared: false }
      ]
    },
    {
      id: "S9", name: "提效基建·知识库", foundation: true,
      pipeline: null,
      tools: [
        { n: "工作配方收集产品反馈并AI自动翻译", s: "已实现", shared: false },
        { n: "AI拉取iOS/GP产品描述并提炼重点", s: "已实现", shared: false },
        { n: "产品官网AI自动生成与部署", s: "已实现", shared: false },
        { n: "代理产品新发确认表单工具", s: "已实现", shared: false },
        { n: "授权书管理系统", s: "进行中", shared: false },
        { n: "飞书项目MCP驱动agent自动化处理项目节点", s: "进行中", shared: false },
        { n: "机器人整理合并知识库文档+定期分析", s: "进行中", shared: true }
      ]
    }
  ],
  gaps: [
    {
      tag: "断点 S3 · 发布上架·工程",
      title: "整条链最薄，强规则重复劳动几乎没被自动化",
      desc: "发布上架只有 4 个工具，「送审 → 审核问题诊断 → 多渠道批量提交 → 送审状态追踪」这条链上，只有参数上传和 CPP 爬取跑通，中段大面积空白。而这类环节规则明确、重复度高，恰恰是自动化收益最高的地方。",
      fixLabel: "补齐方向",
      fixText: "审核问题自动诊断 agent + 送审状态看板 + 参数工程从单渠道扩展到全渠道批量提交。"
    },
    {
      tag: "断点 S5 · 图测·美宣创意",
      title: "生成火力全开，却断在「数据回填」最后一公里",
      desc: "20 个工具里 13 个在进行中，创意生成、迁移、示意图能力堆得很足；但「自动拉取图测数据」被标注为实现不了，导致「出创意 → 上测试 → 拿数据 → 定决策」的闭环断在末端，前面的生成投入无法沉淀成数据飞轮。",
      fixLabel: "补齐方向",
      fixText: "绕开官方接口限制，用截图 OCR / 半自动录入补上数据回填节点，让测试结果重新回流到决策。"
    },
    {
      tag: "跨链 S1·S2·S6 + 地基 S9",
      title: "普遍缺「确认 / 编排」层，靠人肉把散工具串起来",
      desc: "竞品情报、立项命名、推广活动三条链的「人工确认」节点都是空的，采集和生成之间靠人力衔接。而真正能补上这一层的，是 S9 里那个还在进行中的「飞书 MCP agent 编排」——它是把一堆小工具升级成自动化系统的临界基建。",
      fixLabel: "补齐方向",
      fixText: "优先跑通 MCP agent，把散落的采集 / 生成工具用一个统一的确认工作流编排起来。"
    }
  ]
};
