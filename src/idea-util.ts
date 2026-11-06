// 智导献策：企业名称归一化与入驻企业匹配（ai.ts 与 ideas.ts 共用）
export const normName = (s: unknown) => String(s ?? '').replace(/(股份有限公司|有限责任公司|有限公司|集团|控股|科技|公司|\(.*?\)|（.*?）|\s)/g, '').toLowerCase()
export async function matchCompany(db: D1Database | undefined, ...names: unknown[]) {
  if (!db) return null
  const keys = [...new Set(names.map(normName).filter((k) => k.length >= 2))]
  if (!keys.length) return null
  const { results } = await db.prepare('SELECT id, name, alias, industry, business, email, created_at FROM companies ORDER BY created_at DESC LIMIT 1000').all<any>()
  for (const c of results || []) {
    const ks = [c.name, ...String(c.alias || '').split(/[,，、\s]+/)].map(normName).filter((k) => k.length >= 2)
    if (ks.some((k) => keys.some((q) => q === k || (q.length >= 3 && k.length >= 3 && (q.includes(k) || k.includes(q)))))) return c
  }
  return null
}
