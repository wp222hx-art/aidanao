-- 智导献策：入驻企业 + 献策 + 发信记录
CREATE TABLE IF NOT EXISTS companies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  alias TEXT DEFAULT '',
  industry TEXT DEFAULT '',
  business TEXT DEFAULT '',
  email TEXT DEFAULT '',
  token TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_companies_name ON companies(name);

CREATE TABLE IF NOT EXISTS ideas (
  id TEXT PRIMARY KEY,
  uid TEXT NOT NULL,
  nickname TEXT DEFAULT '',
  contact TEXT DEFAULT '',
  target_name TEXT NOT NULL,
  company_id TEXT,
  category TEXT DEFAULT '',
  title TEXT NOT NULL,
  one_liner TEXT DEFAULT '',
  proposal TEXT NOT NULL,
  cover TEXT DEFAULT '',
  channel TEXT NOT NULL,
  email_to TEXT DEFAULT '',
  email_source TEXT DEFAULT '',
  email_msg TEXT DEFAULT '',
  status TEXT NOT NULL,
  reply TEXT DEFAULT '',
  eval TEXT DEFAULT '',
  cmd_no INTEGER,
  cmd_score INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ideas_uid ON ideas(uid);
CREATE INDEX IF NOT EXISTS idx_ideas_company ON ideas(company_id);
CREATE INDEX IF NOT EXISTS idx_ideas_target ON ideas(target_name);

CREATE TABLE IF NOT EXISTS email_log (
  id TEXT PRIMARY KEY,
  idea_id TEXT NOT NULL,
  to_email TEXT NOT NULL,
  at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_email_at ON email_log(at);
CREATE INDEX IF NOT EXISTS idx_email_to ON email_log(to_email);
