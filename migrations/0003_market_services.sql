-- 献策市场：类型 / 点赞 / 精选 / 隐藏 / 样板标记
ALTER TABLE ideas ADD COLUMN kind TEXT DEFAULT 'proposal';
ALTER TABLE ideas ADD COLUMN likes INTEGER DEFAULT 0;
ALTER TABLE ideas ADD COLUMN featured INTEGER DEFAULT 0;
ALTER TABLE ideas ADD COLUMN hidden INTEGER DEFAULT 0;
ALTER TABLE ideas ADD COLUMN sample INTEGER DEFAULT 0;
ALTER TABLE ideas ADD COLUMN tags TEXT DEFAULT '';
ALTER TABLE ideas ADD COLUMN listed INTEGER DEFAULT 1;
CREATE INDEX IF NOT EXISTS idx_ideas_created ON ideas(created_at);
CREATE TABLE IF NOT EXISTS idea_likes (idea_id TEXT NOT NULL, uid TEXT NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (idea_id, uid));

-- 数据缓存（雷达 / 贸易 / 热点视频）：按需刷新，过期自动重新抓取
CREATE TABLE IF NOT EXISTS data_cache (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at INTEGER NOT NULL);

-- 网站交付物
CREATE TABLE IF NOT EXISTS sites (id TEXT PRIMARY KEY, owner TEXT DEFAULT '', company TEXT DEFAULT '', title TEXT DEFAULT '', html TEXT NOT NULL, views INTEGER DEFAULT 0, created_at INTEGER NOT NULL);

-- 客服 Agent
CREATE TABLE IF NOT EXISTS cs_bots (id TEXT PRIMARY KEY, token TEXT NOT NULL, name TEXT NOT NULL, company TEXT DEFAULT '', greeting TEXT DEFAULT '', knowledge TEXT DEFAULT '', human TEXT DEFAULT '', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS cs_sessions (id TEXT PRIMARY KEY, bot_id TEXT NOT NULL, status TEXT DEFAULT 'bot', msgs INTEGER DEFAULT 0, last_text TEXT DEFAULT '', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS idx_cs_sessions_bot ON cs_sessions(bot_id, updated_at);
CREATE TABLE IF NOT EXISTS cs_msgs (id TEXT PRIMARY KEY, session_id TEXT NOT NULL, role TEXT NOT NULL, text TEXT NOT NULL, at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS idx_cs_msgs_session ON cs_msgs(session_id, at);
