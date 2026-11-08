-- 献策广场样板数据（sample = 1，界面标注「样板」，后台可一键隐藏）
-- 所有样板状态为「公开献策」，不代表任何企业已收到或采纳
INSERT OR IGNORE INTO ideas (id, uid, nickname, contact, target_name, company_id, kind, category, title, one_liner, proposal, cover, channel, email_to, email_source, email_msg, status, reply, eval, tags, listed, likes, featured, hidden, sample, created_at, updated_at) VALUES ('idea_sample_00', 'sample', '旅行者阿禾', '', '米哈游', NULL, 'proposal', '营销活动', '提瓦特寻迹：城市地标打卡季', '与地方文旅联动，在真实地标打卡解锁限定剧情与纪念奖励', '## 一句话提案
把城市变成一张冒险地图：玩家在真实地标打卡，解锁游戏内限定剧情与纪念道具。
## 为什么是现在
文旅部门积极寻找年轻化 IP 合作，游戏用户线下聚集意愿强。
## 创意方案
- 每季选 3 座城市，每城 5 个地标
- 打卡解锁「城市回忆」短剧情
- 集齐盖章兑换实体纪念卡
## 落地三步走
1. 选 1 座城市试点 4 周
2. 复盘客流与新增回流
3. 复制到更多城市
## 预期价值（估算）
试点城市带动回流玩家与话题曝光，具体以试点数据为准。', '', 'public', '', '', '', 'saved', '', '{"novelty": 76, "fit": 74, "feasibility": 74, "value": 86, "total": 78, "comment": "样板数据：用于展示献策广场效果"}', '文旅联动,LBS,线下活动', 1, 128, 1, 0, 1, 1793920144829, 1793920144829);
INSERT OR IGNORE INTO ideas (id, uid, nickname, contact, target_name, company_id, kind, category, title, one_liner, proposal, cover, channel, email_to, email_source, email_msg, status, reply, eval, tags, listed, likes, featured, hidden, sample, created_at, updated_at) VALUES ('idea_sample_01', 'sample', '插画师小满', '', '米哈游', NULL, 'design', '品牌联名', '「星海邮局」联名明信片视觉', '以星空邮戳为母题的系列明信片与周边视觉', '## 设计概念
每一张明信片都是一封寄往提瓦特的信。
## 视觉方向
主色 #1E2A5A 深夜蓝 + #F4C66A 星光金，衬线标题，手绘邮戳纹理。
## 关键画面
角色剪影 + 星轨邮路 + 可盖章留白区。
## 应用场景
明信片、邮票贴纸、线下邮局快闪店。
## 落地建议
先做 6 张试印，在线下活动限量发放。', '', 'public', '', '', '', 'saved', '', '{"novelty": 83, "fit": 73, "feasibility": 73, "value": 84, "total": 78, "comment": "样板数据：用于展示献策广场效果"}', '视觉设计,周边,联名', 1, 96, 1, 0, 1, 1793861760191, 1793861760191);
INSERT OR IGNORE INTO ideas (id, uid, nickname, contact, target_name, company_id, kind, category, title, one_liner, proposal, cover, channel, email_to, email_source, email_msg, status, reply, eval, tags, listed, likes, featured, hidden, sample, created_at, updated_at) VALUES ('idea_sample_02', 'sample', '老玩家路过', '', '米哈游', NULL, 'suggestion', '用户体验', '回归玩家 7 日引导清单', '给 30 天未登录玩家一份「补课清单」，降低回归门槛', '## 我发现的问题
长期未登录的玩家回来后不知道先做什么，容易再次流失。
## 具体建议
1. 登录弹出「你错过了什么」一页总结
2. 7 日任务清单，每天 15 分钟可完成
3. 清单完成送一次免费抽卡道具
## 低成本试点
对 5% 回归玩家灰度 2 周，对比 7 日留存。', '', 'public', '', '', '', 'saved', '', '{"novelty": 72, "fit": 71, "feasibility": 64, "value": 79, "total": 72, "comment": "样板数据：用于展示献策广场效果"}', '回流,新手引导', 1, 74, 0, 0, 1, 1792883691226, 1792883691226);
INSERT OR IGNORE INTO ideas (id, uid, nickname, contact, target_name, company_id, kind, category, title, one_liner, proposal, cover, channel, email_to, email_source, email_msg, status, reply, eval, tags, listed, likes, featured, hidden, sample, created_at, updated_at) VALUES ('idea_sample_03', 'sample', '极客老周', '', '小米', NULL, 'proposal', '产品创意', '米家「家庭能耗管家」', '把米家设备用电数据变成每月家庭节能报告与建议', '## 一句话提案
每月给用户一份家庭用电体检报告，告诉他哪台设备最耗电、怎么省。
## 创意方案
- 汇总插座、空调、热水器等设备用电
- 与同城相似家庭对比（匿名）
- 一键开启「省电场景」
## 落地三步走
1. 先在米家 App 上线报告卡片
2. 加入峰谷电价提醒
3. 联动电力公司做节能激励
## 风险
需明确告知数据用途，默认关闭对比功能。', '', 'public', '', '', '', 'saved', '', '{"novelty": 73, "fit": 72, "feasibility": 79, "value": 79, "total": 76, "comment": "样板数据：用于展示献策广场效果"}', '智能家居,节能,数据', 1, 85, 1, 0, 1, 1793853973152, 1793853973152);
INSERT OR IGNORE INTO ideas (id, uid, nickname, contact, target_name, company_id, kind, category, title, one_liner, proposal, cover, channel, email_to, email_source, email_msg, status, reply, eval, tags, listed, likes, featured, hidden, sample, created_at, updated_at) VALUES ('idea_sample_04', 'sample', '米粉阿杰', '', '小米', NULL, 'suggestion', '用户体验', '售后进度「快递式」追踪', '维修进度像快递一样分节点展示，减少客服咨询', '## 我发现的问题
送修后只能打电话问进度。
## 具体建议
1. 寄修后展示：已签收 → 检测 → 维修 → 质检 → 寄回
2. 每个节点推送一次
3. 超时自动致歉并告知原因
## 预期效果（估算）
售后进度类咨询明显减少。', '', 'public', '', '', '', 'saved', '', '{"novelty": 69, "fit": 77, "feasibility": 82, "value": 86, "total": 78, "comment": "样板数据：用于展示献策广场效果"}', '售后,体验', 1, 41, 0, 0, 1, 1792452764079, 1792452764079);
INSERT OR IGNORE INTO ideas (id, uid, nickname, contact, target_name, company_id, kind, category, title, one_liner, proposal, cover, channel, email_to, email_source, email_msg, status, reply, eval, tags, listed, likes, featured, hidden, sample, created_at, updated_at) VALUES ('idea_sample_05', 'sample', '咖啡续命人', '', '瑞幸咖啡', NULL, 'proposal', '营销活动', '「早八续命」通勤订阅卡', '工作日早上专属的月度订阅，锁定高频通勤用户', '## 一句话提案
每月固定价格，工作日早 7-10 点每天一杯指定饮品。
## 为什么是现在
通勤人群复购稳定，订阅能提前锁定现金流。
## 创意方案
- 3 档订阅：10 杯 / 15 杯 / 22 杯
- 可指定门店提前出杯
- 连续打卡解锁限定口味
## 落地三步走
1. 选写字楼密集城市试点
2. 观察核销率与续订率
3. 扩展到午间档', '', 'public', '', '', '', 'saved', '', '{"novelty": 84, "fit": 88, "feasibility": 74, "value": 67, "total": 78, "comment": "样板数据：用于展示献策广场效果"}', '订阅制,复购,私域', 1, 112, 1, 0, 1, 1793405214841, 1793405214841);
INSERT OR IGNORE INTO ideas (id, uid, nickname, contact, target_name, company_id, kind, category, title, one_liner, proposal, cover, channel, email_to, email_source, email_msg, status, reply, eval, tags, listed, likes, featured, hidden, sample, created_at, updated_at) VALUES ('idea_sample_06', 'sample', '设计师Momo', '', '瑞幸咖啡', NULL, 'design', '品牌联名', '节气杯套：二十四节气插画系列', '每个节气换一款杯套插画，形成收集欲', '## 设计概念
一年 24 张杯套，喝出一整年的时令。
## 视觉方向
低饱和国风配色，每个节气一个主色；细线插画 + 节气书法字。
## 应用场景
杯套、门店海报、App 开屏、集章卡。
## 落地建议
先做春季 6 个节气，配合限定新品上线。', '', 'public', '', '', '', 'saved', '', '{"novelty": 83, "fit": 74, "feasibility": 71, "value": 79, "total": 77, "comment": "样板数据：用于展示献策广场效果"}', '包装设计,节气,收集', 1, 88, 0, 0, 1, 1793598097431, 1793598097431);
INSERT OR IGNORE INTO ideas (id, uid, nickname, contact, target_name, company_id, kind, category, title, one_liner, proposal, cover, channel, email_to, email_source, email_msg, status, reply, eval, tags, listed, likes, featured, hidden, sample, created_at, updated_at) VALUES ('idea_sample_07', 'sample', '潮玩收藏家', '', '泡泡玛特', NULL, 'proposal', '产品创意', '盲盒「交换角」线下社区', '门店设置官方交换台，让重复款流转起来', '## 一句话提案
在门店设置官方交换角，用户用重复款换心仪款。
## 创意方案
- 门店交换台 + 小程序登记
- 官方鉴定，防止假货
- 交换成功送积分
## 预期价值（估算）
提升到店频次与社区黏性。
## 风险与应对
设置每人每月交换上限，避免黄牛。', '', 'public', '', '', '', 'saved', '', '{"novelty": 69, "fit": 88, "feasibility": 71, "value": 83, "total": 78, "comment": "样板数据：用于展示献策广场效果"}', '社区,门店,二手流转', 1, 97, 1, 0, 1, 1791745610378, 1791745610378);
INSERT OR IGNORE INTO ideas (id, uid, nickname, contact, target_name, company_id, kind, category, title, one_liner, proposal, cover, channel, email_to, email_source, email_msg, status, reply, eval, tags, listed, likes, featured, hidden, sample, created_at, updated_at) VALUES ('idea_sample_08', 'sample', '不抽到隐藏不睡', '', '泡泡玛特', NULL, 'suggestion', '用户体验', '抽盒机加「已抽款式」提示', '线上抽盒前提示该盒已被抽出的款式，减少重复', '## 我发现的问题
用户最怕重复款。
## 具体建议
1. 端盒展示已被抽出的款式
2. 提供「换一盒」按钮
3. 隐藏款概率公开展示
## 低成本试点
先在线上抽盒机灰度一个系列。', '', 'public', '', '', '', 'saved', '', '{"novelty": 69, "fit": 88, "feasibility": 80, "value": 86, "total": 81, "comment": "样板数据：用于展示献策广场效果"}', '体验,透明', 1, 53, 0, 0, 1, 1793447884710, 1793447884710);
INSERT OR IGNORE INTO ideas (id, uid, nickname, contact, target_name, company_id, kind, category, title, one_liner, proposal, cover, channel, email_to, email_source, email_msg, status, reply, eval, tags, listed, likes, featured, hidden, sample, created_at, updated_at) VALUES ('idea_sample_09', 'sample', '电车通勤族', '', '蔚来', NULL, 'proposal', '商业模式', '换电站「顺路服务」生态', '换电等待的 3 分钟里，提供洗车、咖啡、快递柜等服务', '## 一句话提案
让换电站成为车主的生活服务点。
## 创意方案
- 换电站旁合作咖啡车与快递柜
- 换电时一键预约洗车
- 积分在服务间通用
## 落地三步走
1. 选 10 座高频站试点
2. 评估车主使用率
3. 开放第三方入驻', '', 'public', '', '', '', 'saved', '', '{"novelty": 69, "fit": 87, "feasibility": 84, "value": 68, "total": 77, "comment": "样板数据：用于展示献策广场效果"}', '换电,生态,服务', 1, 66, 0, 0, 1, 1792453067529, 1792453067529);
INSERT OR IGNORE INTO ideas (id, uid, nickname, contact, target_name, company_id, kind, category, title, one_liner, proposal, cover, channel, email_to, email_source, email_msg, status, reply, eval, tags, listed, likes, featured, hidden, sample, created_at, updated_at) VALUES ('idea_sample_10', 'sample', '工业设计学生', '', '蔚来', NULL, 'design', '品牌联名', 'NIO House 季节限定空间设计', '每季一个主题，把 NIO House 变成城市打卡点', '## 设计概念
四季主题：春·苔原、夏·海岸、秋·麦田、冬·极光。
## 视觉方向
自然材质 + 柔光装置；主色随季节切换。
## 关键画面
入口装置墙 + 主题休息区 + 可拍照角落。
## 落地建议
先在一座城市做冬季极光主题。', '', 'public', '', '', '', 'saved', '', '{"novelty": 85, "fit": 76, "feasibility": 77, "value": 87, "total": 81, "comment": "样板数据：用于展示献策广场效果"}', '空间设计,门店', 1, 59, 0, 0, 1, 1792490076595, 1792490076595);
INSERT OR IGNORE INTO ideas (id, uid, nickname, contact, target_name, company_id, kind, category, title, one_liner, proposal, cover, channel, email_to, email_source, email_msg, status, reply, eval, tags, listed, likes, featured, hidden, sample, created_at, updated_at) VALUES ('idea_sample_11', 'sample', '逛店达人', '', '名创优品', NULL, 'proposal', '营销活动', '「10 元惊喜盒」城市限定', '每座城市推出城市元素的 10 元惊喜盒', '## 一句话提案
每座城市一款城市元素惊喜盒，游客必买伴手礼。
## 创意方案
- 盒内含城市主题冰箱贴、贴纸、钥匙扣
- 机场与景区门店优先铺货
- 集齐多城可兑换限定周边
## 预期价值（估算）
带动旅游客流门店客单。', '', 'public', '', '', '', 'saved', '', '{"novelty": 76, "fit": 84, "feasibility": 80, "value": 80, "total": 80, "comment": "样板数据：用于展示献策广场效果"}', '城市限定,低价引流', 1, 47, 0, 0, 1, 1793025633017, 1793025633017);
INSERT OR IGNORE INTO ideas (id, uid, nickname, contact, target_name, company_id, kind, category, title, one_liner, proposal, cover, channel, email_to, email_source, email_msg, status, reply, eval, tags, listed, likes, featured, hidden, sample, created_at, updated_at) VALUES ('idea_sample_12', 'sample', '新车主小林', '', '比亚迪', NULL, 'suggestion', '用户体验', '新车主「首月陪跑」服务', '提车后 30 天内每周一条用车小课堂', '## 我发现的问题
新车主对充电、智能功能不熟。
## 具体建议
1. 提车后每周推送 1 条 1 分钟视频
2. 第 7 天专属顾问回访
3. 第 30 天邀请参加车主沙龙
## 低成本试点
选 2 家门店试点一个月。', '', 'public', '', '', '', 'saved', '', '{"novelty": 73, "fit": 75, "feasibility": 84, "value": 73, "total": 76, "comment": "样板数据：用于展示献策广场效果"}', '车主服务,留存', 1, 38, 0, 0, 1, 1793766369217, 1793766369217);
INSERT OR IGNORE INTO ideas (id, uid, nickname, contact, target_name, company_id, kind, category, title, one_liner, proposal, cover, channel, email_to, email_source, email_msg, status, reply, eval, tags, listed, likes, featured, hidden, sample, created_at, updated_at) VALUES ('idea_sample_13', 'sample', '策划爱好者', '', '网易游戏', NULL, 'proposal', '游戏玩法', '「玩家共创关卡」季度大赛', '开放关卡编辑器，优秀关卡收录进正式版', '## 一句话提案
每季度举办玩家关卡设计大赛，冠军关卡进正式服。
## 创意方案
- 开放简化版关卡编辑器
- 社区投票 + 策划评审
- 作者署名与分成
## 落地三步走
1. 选一款游戏试点
2. 建立审核机制
3. 形成常态化创作者计划', '', 'public', '', '', '', 'saved', '', '{"novelty": 75, "fit": 86, "feasibility": 77, "value": 76, "total": 78, "comment": "样板数据：用于展示献策广场效果"}', 'UGC,共创,社区', 1, 71, 1, 0, 1, 1791968825557, 1791968825557);
INSERT OR IGNORE INTO ideas (id, uid, nickname, contact, target_name, company_id, kind, category, title, one_liner, proposal, cover, channel, email_to, email_source, email_msg, status, reply, eval, tags, listed, likes, featured, hidden, sample, created_at, updated_at) VALUES ('idea_sample_14', 'sample', 'UI 设计师阿川', '', '网易游戏', NULL, 'design', '品牌联名', '国风 UI 组件库：水墨交互', '一套水墨风格的按钮、弹窗与转场规范', '## 设计概念
交互像笔墨晕开。
## 视觉方向
#2B2B2B 墨色 + #C8102E 朱砂点缀；宋体标题；墨迹扩散转场。
## 应用场景
游戏主界面、活动页、商城弹窗。
## 落地建议
先在一个活动页验证转化与加载性能。', '', 'public', '', '', '', 'saved', '', '{"novelty": 75, "fit": 89, "feasibility": 64, "value": 69, "total": 74, "comment": "样板数据：用于展示献策广场效果"}', 'UI设计,国风', 1, 64, 0, 0, 1, 1792577747567, 1792577747567);
INSERT OR IGNORE INTO ideas (id, uid, nickname, contact, target_name, company_id, kind, category, title, one_liner, proposal, cover, channel, email_to, email_source, email_msg, status, reply, eval, tags, listed, likes, featured, hidden, sample, created_at, updated_at) VALUES ('idea_sample_15', 'sample', '园区物业老张', '', '星澜新能源', NULL, 'suggestion', '降本增效', '储能柜远程巡检看板', '给园区客户一个手机端巡检看板，减少上门次数', '## 我发现的问题
储能柜例行巡检要人跑现场。
## 具体建议
1. 手机端显示温度、SOC、告警
2. 异常自动派单
3. 每月出一份运行报告
## 预期效果（估算）
例行上门次数可减少，具体以试点为准。', '', 'public', '', '', '', 'saved', '', '{"novelty": 71, "fit": 80, "feasibility": 66, "value": 81, "total": 74, "comment": "样板数据：用于展示献策广场效果"}', '运维,降本', 1, 29, 0, 0, 1, 1792887804754, 1792887804754);
INSERT OR IGNORE INTO ideas (id, uid, nickname, contact, target_name, company_id, kind, category, title, one_liner, proposal, cover, channel, email_to, email_source, email_msg, status, reply, eval, tags, listed, likes, featured, hidden, sample, created_at, updated_at) VALUES ('idea_sample_16', 'sample', '能源咨询师', '', '星澜新能源', NULL, 'proposal', '商业模式', '储能柜按月租赁 + 峰谷分成', '小工厂零首付用上储能，电费节省部分分成', '## 一句话提案
工厂零首付装储能，节省的电费按比例分成。
## 创意方案
- 按月租赁，3 年合同
- 峰谷价差收益按 7:3 分成
- 与园区物业合作批量推广
## 风险与应对
电价政策变化：合同设置调价条款。', '', 'public', '', '', '', 'saved', '', '{"novelty": 87, "fit": 72, "feasibility": 86, "value": 83, "total": 82, "comment": "样板数据：用于展示献策广场效果"}', '租赁,分成,工商业储能', 1, 44, 1, 0, 1, 1792418956584, 1792418956584);
INSERT OR IGNORE INTO ideas (id, uid, nickname, contact, target_name, company_id, kind, category, title, one_liner, proposal, cover, channel, email_to, email_source, email_msg, status, reply, eval, tags, listed, likes, featured, hidden, sample, created_at, updated_at) VALUES ('idea_sample_17', 'sample', '奶茶研究员', '', '喜茶', NULL, 'proposal', '品牌联名', '「城市方言杯」限定', '每座城市用当地方言印一句俏皮话', '## 一句话提案
一杯奶茶说一句方言，让本地人会心一笑、外地人拍照分享。
## 创意方案
- 每城 6 句方言文案
- 门店墙面方言解读
- 线上征集下一批方言
## 落地三步走
1. 3 座城市首发
2. 看社交平台分享量
3. 全国推广', '', 'public', '', '', '', 'saved', '', '{"novelty": 76, "fit": 92, "feasibility": 73, "value": 85, "total": 82, "comment": "样板数据：用于展示献策广场效果"}', '包装,城市营销', 1, 58, 0, 0, 1, 1792642434846, 1792642434846);
INSERT OR IGNORE INTO ideas (id, uid, nickname, contact, target_name, company_id, kind, category, title, one_liner, proposal, cover, channel, email_to, email_source, email_msg, status, reply, eval, tags, listed, likes, featured, hidden, sample, created_at, updated_at) VALUES ('idea_sample_18', 'sample', '外卖骑手家属', '', '美团', NULL, 'suggestion', '用户体验', '恶劣天气「骑手关怀」提示', '暴雨天下单时提示用户放宽时间并可打赏骑手', '## 我发现的问题
恶劣天气骑手压力大。
## 具体建议
1. 暴雨预警时下单页提示「请多给骑手一些时间」
2. 可选 1-5 元关怀打赏
3. 超时免责提示
## 预期效果
减少恶劣天气差评与投诉。', '', 'public', '', '', '', 'saved', '', '{"novelty": 80, "fit": 72, "feasibility": 64, "value": 74, "total": 72, "comment": "样板数据：用于展示献策广场效果"}', '社会公益,体验', 1, 91, 1, 0, 1, 1792711542913, 1792711542913);
INSERT OR IGNORE INTO ideas (id, uid, nickname, contact, target_name, company_id, kind, category, title, one_liner, proposal, cover, channel, email_to, email_source, email_msg, status, reply, eval, tags, listed, likes, featured, hidden, sample, created_at, updated_at) VALUES ('idea_sample_19', 'sample', '运动插画师', '', '李宁', NULL, 'design', '品牌联名', '城市马拉松纪念鞋盒设计', '每场城市马拉松一款路线图鞋盒', '## 设计概念
鞋盒就是这场马拉松的路线地图。
## 视觉方向
路线线稿 + 城市地标剪影；完赛时间留白可手写。
## 应用场景
鞋盒、完赛包、纪念 T 恤。
## 落地建议
与一场城市马拉松合作试做 2000 套。', '', 'public', '', '', '', 'saved', '', '{"novelty": 67, "fit": 92, "feasibility": 71, "value": 86, "total": 79, "comment": "样板数据：用于展示献策广场效果"}', '包装设计,运动', 1, 49, 0, 0, 1, 1792401254171, 1792401254171);
INSERT OR IGNORE INTO ideas (id, uid, nickname, contact, target_name, company_id, kind, category, title, one_liner, proposal, cover, channel, email_to, email_source, email_msg, status, reply, eval, tags, listed, likes, featured, hidden, sample, created_at, updated_at) VALUES ('idea_sample_20', 'sample', '旅行规划师', '', '携程', NULL, 'proposal', '营销活动', '「说走就走」周五晚盲盒游', '周五晚出发、周日回的随机目的地周末游', '## 一句话提案
只选出发城市和预算，目的地周四揭晓。
## 创意方案
- 3 档预算
- 含往返交通 + 1 晚住宿
- 目的地保证 3 小时内可达
## 风险与应对
设置「不想去的城市」排除选项。', '', 'public', '', '', '', 'saved', '', '{"novelty": 75, "fit": 92, "feasibility": 74, "value": 87, "total": 82, "comment": "样板数据：用于展示献策广场效果"}', '盲盒,周末游', 1, 63, 0, 0, 1, 1793062838718, 1793062838718);
INSERT OR IGNORE INTO ideas (id, uid, nickname, contact, target_name, company_id, kind, category, title, one_liner, proposal, cover, channel, email_to, email_source, email_msg, status, reply, eval, tags, listed, likes, featured, hidden, sample, created_at, updated_at) VALUES ('idea_sample_21', 'sample', '火锅爱好者', '', '海底捞', NULL, 'suggestion', '用户体验', '一人食「不尴尬」套餐', '单人用餐专属小份锅底与陪伴玩偶升级版', '## 我发现的问题
一个人吃火锅份量大、选择少。
## 具体建议
1. 推出 4 款小份锅底
2. 菜品半份可选
3. 吧台式一人座
## 低成本试点
先在写字楼商圈门店试点。', '', 'public', '', '', '', 'saved', '', '{"novelty": 80, "fit": 81, "feasibility": 67, "value": 85, "total": 78, "comment": "样板数据：用于展示献策广场效果"}', '单人经济,体验', 1, 57, 0, 0, 1, 1793690804710, 1793690804710);
