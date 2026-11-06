-- 企业退订：退订后不再向该邮箱代发献策
CREATE TABLE IF NOT EXISTS optout (
  email TEXT PRIMARY KEY,
  at INTEGER NOT NULL
);
