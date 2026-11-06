// 企业智脑 · 预置知识：部门库 / 智能体角色 / 管理机制
window.DEPT_LIBRARY = [
  { id: 'strategy', name: '战略策划部', icon: 'fa-chess-knight', color: '#7c4dff', kpi: ['战略项目推进率', '机会转化率'],
    agents: ['经营诊断官', '情报对标官', '策略规划官'], tasks: ['完成七域经营诊断', '更新竞品对标雷达', '输出90天增长计划草案', '测算三种市场情景', '复盘上周增长实验'] },
  { id: 'sales', name: '销售部', icon: 'fa-handshake', color: '#ff7043', kpi: ['线索响应时长', '赢单率', '回款额'],
    agents: ['销售线索官', '报价助理', '跟进督办官', '客户画像官'], tasks: ['全网匹配采购需求线索', '为A级线索生成跟进话术', '整理丢单原因', '生成报价依据单', '同步有效订单给产品与生产'] },
  { id: 'marketing', name: '市场营销部', icon: 'fa-bullhorn', color: '#f06292', kpi: ['获客成本CAC', '线索量', 'ROAS'],
    agents: ['营销策划官', '投放优化官', '活动策划官'], tasks: ['生成本月营销日历', '拆解3条行业爆款内容', '设计A/B投放实验', '计算渠道漏斗转化', '策划行业展会获客方案'] },
  { id: 'brand', name: '品牌内容部', icon: 'fa-photo-film', color: '#ec407a', kpi: ['内容产能', '互动率', '品牌声量'],
    agents: ['内容创作官', '海报设计官', '视频剪辑官', '分发运营官'], tasks: ['生成新品宣传海报', '制作30秒宣传短视频', '撰写公众号推文', '多平台内容分发', '合规审校营销文案'] },
  { id: 'product', name: '产品部', icon: 'fa-cubes', color: '#29b6f6', kpi: ['需求交付率', '产品毛利', 'NPS'],
    agents: ['产品创新官', '需求分析官', '定价分析官'], tasks: ['聚类客户需求主题', '评估订单的定制需求', '更新产品路线图', '输出MVP验证计划', '分析竞品功能差距'] },
  { id: 'rnd', name: '研发部', icon: 'fa-code', color: '#5c6bc0', kpi: ['研发周期', '缺陷率', '专利数'],
    agents: ['技术方案官', '代码审查官', '专利检索官'], tasks: ['评审技术可行性', '检索相关专利', '拆解研发里程碑', '生成测试用例', '整理技术文档'] },
  { id: 'production', name: '生产部', icon: 'fa-gears', color: '#4fc3f7', kpi: ['产能利用率', '准时交付率', '良品率'],
    agents: ['排产调度官', '设备巡检官', '工艺优化官'], tasks: ['根据新订单重排产计划', '预测设备维护窗口', '分析良率波动原因', '核算单件工时', '生成交付甘特图'] },
  { id: 'quality', name: '质量部', icon: 'fa-shield-halved', color: '#26a69a', kpi: ['一次合格率', '客诉率'],
    agents: ['质检分析官', '标准合规官'], tasks: ['汇总本周质检异常', '比对行业质量标准', '生成8D改进报告', '追溯客诉批次'] },
  { id: 'procurement', name: '采购部', icon: 'fa-cart-flatbed', color: '#8d6e63', kpi: ['采购成本降幅', '供应商准时率'],
    agents: ['比价寻源官', '供应商评估官'], tasks: ['全网比价主要原料', '评估供应商风险', '预测原料价格走势', '生成采购计划'] },
  { id: 'logistics', name: '仓储物流部', icon: 'fa-truck-ramp-box', color: '#26c6da', kpi: ['库存周转天数', '发货准时率'],
    agents: ['库存预警官', '配送路径官'], tasks: ['识别呆滞库存', '优化配送路线', '预测安全库存', '对账物流费用'] },
  { id: 'service', name: '客户成功部', icon: 'fa-headset', color: '#66bb6a', kpi: ['续费率', '响应时长', '满意度'],
    agents: ['客户成功官', '智能客服', '流失预警官'], tasks: ['识别流失风险客户', '生成续费/复购计划', '归因服务问题', '回访高价值客户'] },
  { id: 'operation', name: '运营部', icon: 'fa-chart-line', color: '#ffa726', kpi: ['GMV', '复购率', '转化率'],
    agents: ['运营流程官', '数据分析官', '用户增长官'], tasks: ['分析日活与转化漏斗', '设计会员分层策略', '生成私域SOP', '排查流程瓶颈'] },
  { id: 'finance', name: '财务部', icon: 'fa-sack-dollar', color: '#ffca28', kpi: ['毛利率', '现金周转', '应收账龄'],
    agents: ['财务经营官', '应收风控官', '税务解释官'], tasks: ['生成收入/毛利分层报表', '预警逾期应收', '核对预算偏差', '解释本月税务事项', '测算项目ROI'] },
  { id: 'hr', name: '人力资源部', icon: 'fa-people-group', color: '#ab47bc', kpi: ['人效', '招聘周期', '流失率'],
    agents: ['招聘筛选官', '人才盘点官', '培训教练官'], tasks: ['筛选岗位简历', '生成新人入职手册', '盘点岗位能力缺口', '用工合规检查'] },
  { id: 'admin', name: '行政部', icon: 'fa-building-user', color: '#90a4ae', kpi: ['费用控制', '服务满意度'],
    agents: ['行政事务官', '会议纪要官'], tasks: ['整理周会行动项', '安排访客与会议室', '核对办公费用', '更新制度文件'] },
  { id: 'legal', name: '法务合规部', icon: 'fa-scale-balanced', color: '#78909c', kpi: ['合同审查时效', '合规风险数'],
    agents: ['合同审查官', '合规巡检官'], tasks: ['审查新签合同风险条款', '巡检营销内容合规', '更新法规变化清单', '数据授权核查'] },
  { id: 'it', name: '信息技术部', icon: 'fa-server', color: '#5e35b1', kpi: ['系统可用率', '工单时效'],
    agents: ['IT运维官', '数据治理官', '安全审计官'], tasks: ['巡检系统健康', '同步业务数据接口', '审计权限变更', '整理指标字典'] },
  { id: 'project', name: '工程项目部', icon: 'fa-helmet-safety', color: '#ff9f43', kpi: ['工期达成率', '安全事故', '成本偏差'],
    agents: ['项目编排官', '安全巡检官', '成本核算官'], tasks: ['更新工程进度', '识别工期风险', '安全巡检日报', '核算项目成本'] },
  { id: 'design', name: '设计部', icon: 'fa-pen-ruler', color: '#e91e63', kpi: ['方案通过率', '出图效率'],
    agents: ['方案设计官', '效果图助理'], tasks: ['生成初版设计方案', '整理客户修改意见', '出具效果图', '归档设计素材'] },
  { id: 'store', name: '门店运营部', icon: 'fa-shop', color: '#ff5252', kpi: ['坪效', '客单价', '翻台率'],
    agents: ['门店巡店官', '排班优化官', '会员运营官'], tasks: ['分析门店客流', '优化排班表', '生成会员促销活动', '巡店问题汇总'] },
  { id: 'teaching', name: '教学教研部', icon: 'fa-chalkboard-user', color: '#7e57c2', kpi: ['完课率', '续班率'],
    agents: ['教研助理', '学情分析官', 'AI陪练'], tasks: ['生成课程教案', '分析学员学情', '批改作业', '设计续班活动'] },
  { id: 'medical', name: '医疗服务部', icon: 'fa-stethoscope', color: '#ef5350', kpi: ['接诊量', '复诊率'],
    agents: ['分诊助理', '病历整理官', '健康随访官'], tasks: ['整理病历摘要', '生成随访计划', '排班优化', '患者满意度分析'] },
  { id: 'risk', name: '风控部', icon: 'fa-user-shield', color: '#455a64', kpi: ['不良率', '风险拦截数'],
    agents: ['风险评估官', '反欺诈官'], tasks: ['评估客户信用', '识别异常交易', '更新风控规则', '压力测试'] },
  { id: 'agri', name: '种养基地部', icon: 'fa-wheat-awn', color: '#7cb342', kpi: ['亩产', '成本/亩'],
    agents: ['农情监测官', '农资调度官'], tasks: ['监测气象与病虫害', '安排农资调度', '预测产量', '对接收购渠道'] }
];

// 门类 → 推荐部门（通用部门 + 行业特色部门）
window.INDUSTRY_DEPTS = {
  base: ['strategy', 'sales', 'marketing', 'finance', 'hr', 'admin'],
  A: ['agri', 'procurement', 'logistics', 'quality'],
  B: ['production', 'quality', 'procurement', 'project', 'legal'],
  C: ['production', 'rnd', 'quality', 'procurement', 'logistics', 'product', 'brand'],
  D: ['production', 'project', 'it', 'legal', 'service'],
  E: ['project', 'design', 'procurement', 'legal', 'quality'],
  F: ['procurement', 'logistics', 'operation', 'service', 'brand'],
  G: ['logistics', 'operation', 'service', 'it'],
  H: ['store', 'procurement', 'operation', 'brand', 'service'],
  I: ['product', 'rnd', 'operation', 'service', 'it', 'brand'],
  J: ['risk', 'legal', 'service', 'it', 'product'],
  K: ['project', 'design', 'service', 'legal', 'operation'],
  L: ['service', 'operation', 'legal', 'brand', 'product'],
  M: ['rnd', 'product', 'quality', 'project'],
  N: ['project', 'operation', 'quality', 'legal'],
  O: ['store', 'service', 'operation', 'brand'],
  P: ['teaching', 'operation', 'service', 'brand', 'product'],
  Q: ['medical', 'service', 'operation', 'legal', 'quality'],
  R: ['brand', 'operation', 'product', 'design'],
  S: ['operation', 'legal', 'it', 'service'],
  T: ['operation', 'legal', 'it']
};

// 六引擎（来自《企业智脑可行性与产品功能策划案》）
window.ENGINES = [
  { id: 'diag', name: '经营诊断', icon: 'fa-stethoscope', desc: '目标拆解·指标异常·瓶颈定位·事实追问' },
  { id: 'intel', name: '情报对标', icon: 'fa-satellite-dish', desc: '主题监测·多源接入·可比组·差距分析' },
  { id: 'plan', name: '策略规划', icon: 'fa-chess', desc: '机会排序·情景测算·资源约束·项目组合' },
  { id: 'act', name: '行动编排', icon: 'fa-diagram-project', desc: '任务·负责人·审批·预算·提醒' },
  { id: 'exp', name: '实验验证', icon: 'fa-flask-vial', desc: '对照·归因·成本收益·护栏与停损' },
  { id: 'evo', name: '知识进化', icon: 'fa-brain', desc: '项目经验·失败原因·打法沉淀·适配评测' }
];

// 七域经营诊断
window.SEVEN_DOMAINS = ['战略目标', '市场获客', '销售转化', '交付运营', '客户留存', '财务现金', '组织协同'];

// Agent 评测五维（新增管理机制）
window.EVAL_DIMS = [
  { k: 'acc', name: '准确性', w: 30, desc: '结论与事实一致、无幻觉' },
  { k: 'evi', name: '证据溯源', w: 20, desc: '每条结论可追溯至来源/数据' },
  { k: 'time', name: '时效性', w: 15, desc: '在 SLA 内交付' },
  { k: 'comp', name: '合规安全', w: 15, desc: '权限、隐私、广告法、用工合规' },
  { k: 'val', name: '业务价值', w: 20, desc: '对订单/成本/效率的可验证贡献' }
];

// 自治等级
window.AUTONOMY = [
  { lv: 'L1', name: '建议', desc: '成果须老板确认后才交付（新上岗/表现不稳）', color: '#90a4ae' },
  { lv: 'L2', name: '标准', desc: '校验通过即交付，返工 1 次，高风险动作走审批', color: '#4fc3f7' },
  { lv: 'L3', name: '自主', desc: '校验通过即交付，可多一次自我返工（连续高分晋升）', color: '#66bb6a' },
  { lv: 'L4', name: '禁止自主', desc: '报价签约/追加预算/对外发布/人事/支付申报 必须老板审批', color: '#ef5350' }
];

window.HIGH_RISK_ACTIONS = ['追加广告预算', '客户群发触达', '调整报价/签约', '人员重大决定', '对外支付', '税务申报', '对外发布声明'];

window.SURNAMES = '王李张刘陈杨黄赵吴周徐孙马朱胡郭何林罗高郑梁谢宋唐许韩冯邓曹彭曾萧田董潘袁蔡蒋余于杜叶程魏苏吕丁任沈姚卢钟姜崔谭陆范汪廖石金韦贾夏付方邹熊白孟秦邱侯江尹薛闫段雷龙黎史陶贺毛郝顾龚邵万覃武钱戴严欧莫孔向常汤康易乔赖文'.split('');
window.GIVEN = '伟芳娜秀英敏静丽强磊军洋勇艳杰娟涛明超秀霞平刚桂英华玉兰飞鑫波宁斌浩凯晨宇轩然欣怡子涵梓萱思远博文雨辰诗琪嘉怡天佑俊杰一鸣雅婷佳琪泽宇晓东海燕春梅志强建华'.match(/.{1,2}/g);
window.SKILL_DICT = ['Excel', 'PPT', '数据分析', 'Python', 'SQL', '财务', '会计', '税务', '招聘', '培训', '谈判', '大客户', '渠道', '电商', '直播', '短视频', '文案', '设计', 'PS', 'AI', 'CAD', '项目管理', '供应链', '采购', '质量', 'ISO', '精益', '六西格玛', '法务', '合同', '客服', '运营', '私域', 'SEO', '投放', '品牌', '产品', '研发', 'Java', '前端', '测试', '运维', '生产', '工艺', '设备', '仓储', '物流', '英语', '销售', '市场', '策划', '管理'];

// ================= 岗位能力分级 × Genspark 决策调用库 =================
window.TIERS = {
  std: { k: 'std', name: '一般级', short: '一般', icon: 'fa-user', color: '#64748b', bg: '#f1f5f9', model: 'gpt-5.4-mini', calls: 1, pass: 78, tools: ['search'],
    desc: '清单式执行：信息整理、标准动作，输出可直接照做的步骤表' },
  master: { k: 'master', name: '大师级', short: '大师', icon: 'fa-user-graduate', color: '#2563eb', bg: '#eff6ff', model: 'gpt-5.4', calls: 3, pass: 82, tools: ['search', 'batch', 'crawl', 'imgsearch'],
    desc: '方法论驱动：显式框架 + 数据测算表 + 双方案取舍，证据深读' },
  leader: { k: 'leader', name: '超级领袖级', short: '领袖', icon: 'fa-crown', color: '#c2410c', bg: '#fff7ed', model: 'gpt-5.5', calls: 5, pass: 85, tools: ['search', 'batch', 'crawl', 'imgsearch', 'image', 'doc'],
    desc: '战略决策：SCQA、三方案对比、ROI 测算、风险矩阵、30/60/90 天里程碑' }
};
window.TIER_ORDER = ['std', 'master', 'leader'];
window.TOOL_LIB = [
  { k: 'search', name: '全网检索', icon: 'fa-magnifying-glass', gsk: 'web_search', desc: '单关键词检索公开网页，返回标题/摘要/链接' },
  { k: 'batch', name: '多路并行检索', icon: 'fa-layer-group', gsk: 'batch_web_search', desc: '2-4 个关键词并行检索，覆盖面更广' },
  { k: 'crawl', name: '网页深读', icon: 'fa-book-open-reader', gsk: 'crawler', desc: '抓取网页正文，把关键事实读进证据包' },
  { k: 'imgsearch', name: '图片检索', icon: 'fa-images', gsk: 'image_search', desc: '检索竞品物料、参考视觉' },
  { k: 'image', name: 'AI 视觉生成', icon: 'fa-wand-magic-sparkles', gsk: 'image_generation', desc: '生成海报/视觉稿并嵌入成果' },
  { k: 'doc', name: '长文档分析', icon: 'fa-file-pdf', gsk: 'summarize_large_document', desc: '研报/PDF/招标文件深度问答' }
];
window.CORE_TOOLS = [
  { k: 'plan', name: '执行规划', icon: 'fa-list-check', gsk: 'llm_proxy', desc: '拆出验收标准与工具调用计划' },
  { k: 'write', name: '成果撰写', icon: 'fa-pen-nib', gsk: 'llm_proxy', desc: '按级别模型撰写，引用证据 [n]' },
  { k: 'accept', name: '独立验收', icon: 'fa-clipboard-check', gsk: 'llm_proxy', desc: '逐条核对验收标准，引用原文' }
];
window.toolMeta = (k) => TOOL_LIB.find((t) => t.k === k) || CORE_TOOLS.find((t) => t.k === k) || { name: k, icon: 'fa-gear' };
window.autoTier = (s) => {
  const pos = s.pos || '';
  if (/总监|总经理|副总|首席|CEO|COO|CTO|CFO|合伙人|董事/.test(pos) || (s.value || 0) >= 88) return 'leader';
  if (/经理|主管|高级|资深|专家|架构|主任/.test(pos) || (s.value || 0) >= 72) return 'master';
  return 'std';
};
window.tierOf = (s) => (s && TIERS[s.tier]) ? s.tier : (s ? autoTier(s) : 'std');
window.staffTools = (s) => { const t = TIERS[tierOf(s)]; const sel = (s?.tools || []).filter((x) => t.tools.includes(x)); return sel.length ? sel : t.tools.slice(); };
window.tierBadge = (k, sm) => { const t = TIERS[k] || TIERS.std; return `<span class="tier ${sm ? 'sm' : ''}" style="--tc:${t.color};--tb:${t.bg}"><i class="fas ${t.icon}"></i>${sm ? t.short : t.name}</span>`; };
