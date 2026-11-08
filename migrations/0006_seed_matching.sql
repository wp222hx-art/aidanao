-- 撮合体系样板：征集令 / 同行方案 / 献策达人钱包（sample = 1，界面标注「样板」，后台可隐藏）
INSERT OR IGNORE INTO challenges (id, company_id, company_name, industry, brief, title, problem, category, kind_pref, reward_points, escrow, reward_cash, deadline, status, hidden, sample, created_at, updated_at) VALUES ('ch_sample_00', NULL, '米哈游', '游戏与数字文娱', '', '老玩家回流：如何让 30 天未登录的玩家回来？', '我们发现长期未登录玩家回归后流失率高，想征集低成本、不破坏平衡的回流方案，包括引导、福利、社交召回等方向。', '游戏玩法', 'proposal', 3000, 3000, '采纳后另付 2000 元创意奖金（线下约定）', 1795594209959, 'open', 0, 1, 1793779809959, 1793779809959);
INSERT OR IGNORE INTO challenges (id, company_id, company_name, industry, brief, title, problem, category, kind_pref, reward_points, escrow, reward_cash, deadline, status, hidden, sample, created_at, updated_at) VALUES ('ch_sample_01', NULL, '瑞幸咖啡', '餐饮连锁', '', '秋冬季新品的城市限定营销创意', '想为秋冬季新品做城市限定营销，征集包装、门店互动、社交传播的创意，预算可控、能在 50 家门店复制。', '营销活动', 'design', 2000, 2000, '', 1794903009959, 'open', 0, 1, 1793693409959, 1793693409959);
INSERT OR IGNORE INTO challenges (id, company_id, company_name, industry, brief, title, problem, category, kind_pref, reward_points, escrow, reward_cash, deadline, status, hidden, sample, created_at, updated_at) VALUES ('ch_sample_02', NULL, '星澜新能源', '电气机械和器材制造业', '', '工商业储能柜：如何降低中小工厂的决策门槛？', '中小工厂觉得储能投资大、回本慢、看不懂，我们想征集商业模式或销售工具方面的点子，让客户更快下决定。', '商业模式', 'proposal', 1500, 1500, '', 1796371809959, 'open', 0, 1, 1793779809959, 1793779809959);
INSERT OR IGNORE INTO challenges (id, company_id, company_name, industry, brief, title, problem, category, kind_pref, reward_points, escrow, reward_cash, deadline, status, hidden, sample, created_at, updated_at) VALUES ('ch_sample_03', NULL, '泡泡玛特', '潮玩零售', '', '门店会员互动：让顾客愿意每月来一次', '征集门店会员体系与到店互动玩法，要求成本低、有收集感、能提升复购频次。', '用户体验', 'suggestion', 1200, 1200, '', 1795335009959, 'open', 0, 1, 1793779809959, 1793779809959);
INSERT OR IGNORE INTO challenges (id, company_id, company_name, industry, brief, title, problem, category, kind_pref, reward_points, escrow, reward_cash, deadline, status, hidden, sample, created_at, updated_at) VALUES ('ch_sample_04', NULL, '某连锁药房（样板）', '医药零售', '', '慢病会员的复购提醒怎么做才不烦人？', '我们有大量高血压、糖尿病会员，想做复购提醒但担心打扰用户，征集体验好、合规的提醒与关怀方案。', '用户体验', 'suggestion', 800, 800, '', 1795853409959, 'open', 0, 1, 1793693409959, 1793693409959);
INSERT OR IGNORE INTO challenges (id, company_id, company_name, industry, brief, title, problem, category, kind_pref, reward_points, escrow, reward_cash, deadline, status, hidden, sample, created_at, updated_at) VALUES ('ch_sample_05', NULL, '某县域文旅局（样板）', '政府文旅', '', '让年轻人来县城过一个周末', '征集适合县域的周末文旅产品与传播创意，要求投入小、可持续、能带动本地商户。', '营销活动', 'proposal', 2500, 2500, '优秀方案可获邀参与落地合作', 1797149409959, 'open', 0, 1, 1793693409959, 1793693409959);
INSERT OR IGNORE INTO solutions (id, owner, owner_name, anonymous, industry, title, problem, approach, results, score, tags, price, uses, earned, hidden, sample, created_at) VALUES ('so_sample_00', 'sample:so00', '华东某储能集成商', 0, '电气机械和器材制造业', '工商业储能「峰谷收益测算」销售工具', '销售现场 10 分钟给客户算清回本周期', '## 适用场景
面向年用电量 50 万度以上的工厂客户，销售首次拜访。
## 核心做法
把电价表、负荷曲线、设备参数做成一页测算模板，现场填 6 个数就能出回本周期。
## 实施步骤
1. 收集当地分时电价与需量电价
2. 设计测算模板（容量、充放策略、衰减）
3. 培训销售用平板现场演示
4. 输出一页 PDF 方案留给客户
## 所需资源与工具
Excel 模板、平板、当地电价政策汇编
## 关键经验与避坑
衰减和运维成本一定要算进去，否则后期客户会质疑。', '首访转化率约提升 30%-40%', 86, '储能,销售工具,测算', 0, 58, 0, 0, 1, 1793434209959);
INSERT OR IGNORE INTO solutions (id, owner, owner_name, anonymous, industry, title, problem, approach, results, score, tags, price, uses, earned, hidden, sample, created_at) VALUES ('so_sample_01', 'sample:so01', '某新消费品牌', 0, '消费品零售', '小红书「素人种草」冷启动 SOP', '30 天用 50 篇素人笔记打开新品认知', '## 适用场景
新品上市、预算有限、没有大 KOL 资源。
## 核心做法
先找 200 位真实用户试用，再筛选 50 位写真实体验，统一关键词但不统一文案。
## 实施步骤
1. 招募试用官并寄样
2. 提供拍摄与关键词指引
3. 按互动数据二次投放
4. 沉淀高互动笔记做官方合集
## 关键经验与避坑
不要统一文案，平台会判定营销；关注收藏率而不只是点赞。', '新品搜索量约提升 3-5 倍', 82, '内容营销,小红书,冷启动', 0, 124, 0, 0, 1, 1793520609959);
INSERT OR IGNORE INTO solutions (id, owner, owner_name, anonymous, industry, title, problem, approach, results, score, tags, price, uses, earned, hidden, sample, created_at) VALUES ('so_sample_02', 'sample:so02', '某连锁餐饮', 0, '餐饮连锁', '门店「高峰排队」体验改造', '排队变成看菜单、提前点单的时间', '## 适用场景
午晚高峰排队超过 10 分钟的门店。
## 核心做法
排队区放扫码预点单，取号即下单，到桌即上菜。
## 实施步骤
1. 排队区设置点单二维码与菜单立牌
2. 后厨按取号顺序备餐
3. 叫号同时推送「即将上菜」
## 关键经验与避坑
预点单要支持修改，否则顾客不敢提前点。', '高峰翻台率约提升 15%', 79, '门店运营,排队,体验', 0, 67, 0, 0, 1, 1792570209959);
INSERT OR IGNORE INTO solutions (id, owner, owner_name, anonymous, industry, title, problem, approach, results, score, tags, price, uses, earned, hidden, sample, created_at) VALUES ('so_sample_03', 'sample:so03', '某 SaaS 企业', 0, '软件和信息技术服务业', '客户成功「90 天上手计划」', '新客户 90 天内完成关键功能使用，降低首年流失', '## 适用场景
B2B 订阅制软件，客单价中等以上。
## 核心做法
把上手拆成 3 个 30 天里程碑，每个里程碑一个可量化的使用指标。
## 实施步骤
1. 定义激活指标（如 5 个核心功能）
2. 第 7 / 30 / 60 / 90 天固定回访
3. 健康分低于阈值自动预警
## 关键经验与避坑
里程碑一定要客户也认可，否则只是我们自己的 KPI。', '首年续费率约提升 10-20 个百分点', 88, '客户成功,SaaS,留存', 300, 41, 0, 0, 1, 1792656609959);
INSERT OR IGNORE INTO solutions (id, owner, owner_name, anonymous, industry, title, problem, approach, results, score, tags, price, uses, earned, hidden, sample, created_at) VALUES ('so_sample_04', 'sample:so04', '某制造企业', 0, '通用设备制造业', '车间「数字化日报」低成本落地', '不上 MES，用表单 + 看板做到班组日报透明', '## 适用场景
中小制造企业，暂时没有预算上 MES。
## 核心做法
班组长每天用手机表单报产量、良率、停机原因，自动汇总成看板。
## 实施步骤
1. 设计 8 个必填字段
2. 每天下班前 10 分钟填报
3. 早会看看板复盘
## 关键经验与避坑
字段越少越好，先保证每天都填。', '停机原因可追溯率从约 30% 提升到 90% 以上', 81, '数字化,制造,低成本', 200, 33, 0, 0, 1, 1793520609959);
INSERT OR IGNORE INTO solutions (id, owner, owner_name, anonymous, industry, title, problem, approach, results, score, tags, price, uses, earned, hidden, sample, created_at) VALUES ('so_sample_05', 'sample:so05', '某文旅景区', 0, '文化旅游', '淡季「夜游 + 市集」引流', '用夜间经济填补淡季客流', '## 适用场景
有一定夜景基础、淡季客流下滑明显的景区。
## 核心做法
周五周六晚开放夜游，引入本地手作和小吃市集，门票含市集券。
## 实施步骤
1. 招募 30 家本地摊主
2. 设计灯光与打卡点
3. 联合本地媒体和达人宣传
## 关键经验与避坑
安全动线和保洁要提前规划，摊主要做品类控制。', '淡季周末客流约提升 50%', 77, '文旅,夜经济,淡季', 0, 29, 0, 0, 1, 1793693409959);
INSERT OR IGNORE INTO wallets (owner, balance, earned, spent, sample, updated_at) VALUES ('u:sample_00', 150, 150, 0, 1, 1794125409959);
INSERT OR IGNORE INTO wallets (owner, balance, earned, spent, sample, updated_at) VALUES ('u:sample_01', 360, 360, 0, 1, 1794125409959);
INSERT OR IGNORE INTO wallets (owner, balance, earned, spent, sample, updated_at) VALUES ('u:sample_02', 720, 720, 0, 1, 1794125409959);
INSERT OR IGNORE INTO wallets (owner, balance, earned, spent, sample, updated_at) VALUES ('u:sample_03', 980, 980, 0, 1, 1794125409959);
INSERT OR IGNORE INTO wallets (owner, balance, earned, spent, sample, updated_at) VALUES ('u:sample_04', 80, 80, 0, 1, 1794125409959);
INSERT OR IGNORE INTO wallets (owner, balance, earned, spent, sample, updated_at) VALUES ('u:sample_05', 30, 30, 0, 1, 1794125409959);
INSERT OR IGNORE INTO wallets (owner, balance, earned, spent, sample, updated_at) VALUES ('u:sample_06', 1320, 1320, 0, 1, 1794125409959);
INSERT OR IGNORE INTO wallets (owner, balance, earned, spent, sample, updated_at) VALUES ('u:sample_07', 45, 45, 0, 1, 1794125409959);
INSERT OR IGNORE INTO wallets (owner, balance, earned, spent, sample, updated_at) VALUES ('u:sample_08', 220, 220, 0, 1, 1794125409959);
INSERT OR IGNORE INTO wallets (owner, balance, earned, spent, sample, updated_at) VALUES ('u:sample_09', 150, 150, 0, 1, 1794125409959);
INSERT OR IGNORE INTO wallets (owner, balance, earned, spent, sample, updated_at) VALUES ('u:sample_10', 30, 30, 0, 1, 1794125409959);
INSERT OR IGNORE INTO wallets (owner, balance, earned, spent, sample, updated_at) VALUES ('u:sample_11', 45, 45, 0, 1, 1794125409959);
INSERT OR IGNORE INTO wallets (owner, balance, earned, spent, sample, updated_at) VALUES ('u:sample_12', 30, 30, 0, 1, 1794125409959);
INSERT OR IGNORE INTO wallets (owner, balance, earned, spent, sample, updated_at) VALUES ('u:sample_13', 640, 640, 0, 1, 1794125409959);
INSERT OR IGNORE INTO wallets (owner, balance, earned, spent, sample, updated_at) VALUES ('u:sample_14', 45, 45, 0, 1, 1794125409959);
INSERT OR IGNORE INTO wallets (owner, balance, earned, spent, sample, updated_at) VALUES ('u:sample_15', 1680, 1680, 0, 1, 1794125409959);
INSERT OR IGNORE INTO wallets (owner, balance, earned, spent, sample, updated_at) VALUES ('u:sample_16', 90, 90, 0, 1, 1794125409959);
INSERT OR IGNORE INTO wallets (owner, balance, earned, spent, sample, updated_at) VALUES ('u:sample_17', 980, 980, 0, 1, 1794125409959);
INSERT OR IGNORE INTO wallets (owner, balance, earned, spent, sample, updated_at) VALUES ('u:sample_18', 1320, 1320, 0, 1, 1794125409959);
INSERT OR IGNORE INTO wallets (owner, balance, earned, spent, sample, updated_at) VALUES ('u:sample_19', 1320, 1320, 0, 1, 1794125409959);
INSERT OR IGNORE INTO wallets (owner, balance, earned, spent, sample, updated_at) VALUES ('u:sample_20', 520, 520, 0, 1, 1794125409959);
INSERT OR IGNORE INTO wallets (owner, balance, earned, spent, sample, updated_at) VALUES ('u:sample_21', 480, 480, 0, 1, 1794125409959);
