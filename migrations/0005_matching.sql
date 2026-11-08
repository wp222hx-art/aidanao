-- 撮合体系：智点钱包 / 账本 / 悬赏征集 / 同行方案库
CREATE TABLE IF NOT EXISTS wallets (owner TEXT PRIMARY KEY, balance INTEGER NOT NULL DEFAULT 0, earned INTEGER NOT NULL DEFAULT 0, spent INTEGER NOT NULL DEFAULT 0, sample INTEGER DEFAULT 0, updated_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS ledger (id TEXT PRIMARY KEY, owner TEXT NOT NULL, delta INTEGER NOT NULL, kind TEXT NOT NULL, note TEXT DEFAULT '', ref TEXT NOT NULL UNIQUE, at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS idx_ledger_owner ON ledger(owner, at);
CREATE INDEX IF NOT EXISTS idx_ledger_at ON ledger(at);

CREATE TABLE IF NOT EXISTS challenges (id TEXT PRIMARY KEY, company_id TEXT, company_name TEXT NOT NULL, industry TEXT DEFAULT '', brief TEXT DEFAULT '', title TEXT NOT NULL, problem TEXT NOT NULL, category TEXT DEFAULT '', kind_pref TEXT DEFAULT '', reward_points INTEGER DEFAULT 0, escrow INTEGER DEFAULT 0, reward_cash TEXT DEFAULT '', deadline INTEGER, status TEXT DEFAULT 'open', hidden INTEGER DEFAULT 0, sample INTEGER DEFAULT 0, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS idx_challenges_company ON challenges(company_id);
CREATE INDEX IF NOT EXISTS idx_challenges_status ON challenges(status, created_at);

ALTER TABLE ideas ADD COLUMN challenge_id TEXT;
ALTER TABLE ideas ADD COLUMN reward_points INTEGER DEFAULT 0;
ALTER TABLE ideas ADD COLUMN reward_cash TEXT DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_ideas_challenge ON ideas(challenge_id);

CREATE TABLE IF NOT EXISTS solutions (id TEXT PRIMARY KEY, owner TEXT NOT NULL, owner_name TEXT DEFAULT '', anonymous INTEGER DEFAULT 0, industry TEXT DEFAULT '', title TEXT NOT NULL, problem TEXT DEFAULT '', approach TEXT NOT NULL, results TEXT DEFAULT '', score INTEGER DEFAULT 0, tags TEXT DEFAULT '', price INTEGER DEFAULT 0, uses INTEGER DEFAULT 0, earned INTEGER DEFAULT 0, hidden INTEGER DEFAULT 0, sample INTEGER DEFAULT 0, created_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS idx_solutions_owner ON solutions(owner);
CREATE TABLE IF NOT EXISTS solution_uses (solution_id TEXT NOT NULL, user TEXT NOT NULL, paid INTEGER DEFAULT 0, at INTEGER NOT NULL, PRIMARY KEY (solution_id, user));

-- 样板献策拆成不同作者，便于排行榜展示
UPDATE ideas SET uid = 'sample_' || substr(id, 13) WHERE sample = 1;
