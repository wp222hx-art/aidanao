// 撮合体系 · 智点账本：所有加减分都写入 ledger（ref 唯一 = 天然幂等，防重复发放）
import { AiError, clip } from './ai'
import { rid, now, DAY } from './svc-util'

// 激励规则（前后端共用，/api/mkt/rules 下发）
export const RULES = {
  submit: { pts: 5, cap: 3, name: '提交献策', desc: '每天前 3 份' },
  like: { pts: 1, cap: 50, name: '献策被点赞', desc: '每份献策最多计 50 个赞' },
  reply: { pts: 10, name: '企业回复', desc: '企业首次回复你的献策' },
  adopt: { pts: 100, name: '被企业采纳', desc: '平台奖励，另加企业悬赏 / 打赏' },
  done: { pts: 50, name: '落地验收', desc: '企业把你的方案执行完成' },
  feature: { pts: 30, name: '入选精选', desc: '平台编辑精选' },
  share: { pts: 20, cap: 3, name: '共享方案', desc: '企业向同行共享方案，每天前 3 个' },
  freeUse: { pts: 2, cap: 30, name: '方案被同行使用', desc: '免费方案每被使用一次（每方案每天最多 30 次）' },
  paidCut: { rate: 0.8, name: '付费方案分成', desc: '同行付费使用，作者得 80%，平台 20%' },
  grant: { pts: 1000, name: '企业入驻礼包', desc: '可用于发布征集令、打赏、购买同行方案' },
}
export const userOf = (uid: string) => `u:${uid}`
export const coOf = (id: string) => `co:${id}`
const dayStart = () => { const d = new Date(); d.setUTCHours(-8, 0, 0, 0); let t = d.getTime(); if (now() - t >= DAY) t += DAY; return t } // 北京时间 0 点

async function bump(D: D1Database, owner: string, delta: number, t: number) {
  await D.prepare('INSERT INTO wallets (owner, balance, earned, spent, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(owner) DO UPDATE SET balance = balance + excluded.balance, earned = earned + excluded.earned, spent = spent + excluded.spent, updated_at = excluded.updated_at')
    .bind(owner, delta, delta > 0 ? delta : 0, delta < 0 ? -delta : 0, t).run()
}
// 加分：ref 已存在则不重复发放；cap 为该 owner 当日同类上限
export async function credit(D: D1Database, owner: string, delta: number, kind: string, note: string, ref: string, cap?: number) {
  if (!owner || !(delta > 0)) return false
  if (cap) { const n = await D.prepare('SELECT COUNT(*) AS n FROM ledger WHERE owner = ? AND kind = ? AND at >= ?').bind(owner, kind, dayStart()).first<any>(); if ((n?.n || 0) >= cap) return false }
  const t = now()
  const r = await D.prepare('INSERT OR IGNORE INTO ledger (id, owner, delta, kind, note, ref, at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(rid('lg'), owner, Math.round(delta), kind, clip(note, 100), clip(ref, 120), t).run()
  if (!r.meta?.changes) return false
  await bump(D, owner, Math.round(delta), t)
  return true
}
// 扣分：余额不足报错；ref 已存在视为已扣过
export async function debit(D: D1Database, owner: string, amount: number, kind: string, note: string, ref: string) {
  amount = Math.round(amount); if (!(amount > 0)) return false
  if (await D.prepare('SELECT 1 AS x FROM ledger WHERE ref = ?').bind(ref).first()) return false
  const t = now()
  const r = await D.prepare('UPDATE wallets SET balance = balance - ?, spent = spent + ?, updated_at = ? WHERE owner = ? AND balance >= ?').bind(amount, amount, t, owner, amount).run()
  if (!r.meta?.changes) throw new AiError(`智点余额不足（需要 ${amount}）`, 402)
  await D.prepare('INSERT OR IGNORE INTO ledger (id, owner, delta, kind, note, ref, at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(rid('lg'), owner, -amount, kind, clip(note, 100), clip(ref, 120), t).run()
  return true
}
export async function ensureCompanyGrant(D: D1Database, id: string) {
  await credit(D, coOf(id), RULES.grant.pts, 'grant', RULES.grant.name, `grant:co:${id}`)
}

// 企业采纳献策：平台奖励 + 悬赏（从征集令托管扣）/ 打赏（从企业钱包扣）
export async function rewardAdoption(D: D1Database, co: { id: string; name: string }, idea: any, reward: number) {
  if (!idea || idea.sample) return { bonus: 0, paid: 0 }
  const to = userOf(idea.uid), title = clip(idea.title, 30)
  const bonus = (await credit(D, to, RULES.adopt.pts, 'adopt', `「${co.name}」采纳了《${title}》`, `adopt:${idea.id}`)) ? RULES.adopt.pts : 0
  let paid = 0, cash = ''
  reward = Math.max(0, Math.min(100000, Math.round(+reward || 0)))
  if (idea.challenge_id) {
    const ch = await D.prepare('SELECT * FROM challenges WHERE id = ? AND company_id = ?').bind(idea.challenge_id, co.id).first<any>()
    if (ch) {
      cash = ch.reward_cash || ''
      const want = Math.min(reward || ch.reward_points, ch.escrow)
      if (want > 0 && !(await D.prepare('SELECT 1 AS x FROM ledger WHERE ref = ?').bind(`bounty:${idea.id}`).first())) {
        const u = await D.prepare('UPDATE challenges SET escrow = escrow - ?, updated_at = ? WHERE id = ? AND escrow >= ?').bind(want, now(), ch.id, want).run()
        if (u.meta?.changes && await credit(D, to, want, 'bounty', `征集令「${clip(ch.title, 20)}」悬赏`, `bounty:${idea.id}`)) paid = want
      }
    }
  } else if (reward > 0) {
    if (await debit(D, coOf(co.id), reward, 'tip', `打赏《${title}》`, `tipout:${idea.id}`)) { await credit(D, to, reward, 'tip', `「${co.name}」打赏《${title}》`, `tipin:${idea.id}`); paid = reward }
  }
  if (paid || cash) await D.prepare('UPDATE ideas SET reward_points = reward_points + ?, reward_cash = ? WHERE id = ?').bind(paid, cash, idea.id).run()
  return { bonus, paid, cash }
}
