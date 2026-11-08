import { Hono } from 'hono'
import aiRoutes from './ai'
import ideaRoutes from './ideas'

const app = new Hono<{ Bindings: { GSK_API_KEY?: string; BRAIN_ACCESS_CODE?: string; DB?: D1Database } }>()

// 访问口令（可选）：设置 BRAIN_ACCESS_CODE 后，调用 AI 接口须携带 X-Brain-Code，防止他人消耗你的 Genspark 积分
app.use('/api/ai/*', async (c, next) => {
  const code = c.env.BRAIN_ACCESS_CODE
  if (code && c.req.path !== '/api/ai/status' && c.req.path !== '/api/ai/file' && c.req.header('X-Brain-Code') !== code) return c.json({ ok: false, error: '需要访问口令', needCode: true }, 401)
  await next()
})
app.route('/api/ai', aiRoutes)
app.route('/api/ideas', ideaRoutes)

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36'

const WIKI_UA = 'EnterpriseBrain/1.0 (enterprise-brain demo; contact@example.com)'

type NewsItem = { title: string; link: string; desc: string; date: string; source: string }

function decodeXml(s: string) {
  return s
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/<[^>]+>/g, '')
}

async function bingRss(q: string, limit = 8): Promise<NewsItem[]> {
  try {
    const url = `https://www.bing.com/search?format=rss&setlang=zh-cn&cc=cn&q=${encodeURIComponent(q)}`
    const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'zh-CN,zh;q=0.9' } })
    if (!r.ok) return []
    const xml = await r.text()
    const items = xml.match(/<item>[\s\S]*?<\/item>/g) || []
    return items.slice(0, limit).map((it) => {
      const g = (t: string) => decodeXml((it.match(new RegExp(`<${t}>([\\s\\S]*?)</${t}>`)) || [])[1] || '')
      const link = g('link')
      let source = ''
      try { source = new URL(link).hostname.replace(/^www\./, '') } catch { }
      return { title: g('title'), link, desc: g('description').slice(0, 220), date: g('pubDate'), source }
    }).filter((x) => x.title)
  } catch { return [] }
}

async function wiki(name: string) {
  try {
    const s = await fetch(`https://zh.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(name)}&format=json&srlimit=1`, { headers: { 'User-Agent': WIKI_UA } })
    const sj: any = await s.json()
    const title = sj?.query?.search?.[0]?.title
    if (!title) return null
    const e = await fetch(`https://zh.wikipedia.org/w/api.php?action=query&prop=extracts&exintro=1&explaintext=1&variant=zh-cn&format=json&titles=${encodeURIComponent(title)}`, { headers: { 'User-Agent': WIKI_UA } })
    const ej: any = await e.json()
    const page: any = Object.values(ej?.query?.pages || {})[0]
    if (!page?.extract) return null
    return { title, extract: String(page.extract).slice(0, 900), url: `https://zh.wikipedia.org/wiki/${encodeURIComponent(title)}` }
  } catch { return null }
}

// 企业全网扫描：维基百科 + 必应资讯（合法公开来源），失败时前端降级为 AI 行业推断
app.get('/api/scan', async (c) => {
  const name = (c.req.query('name') || '').trim().slice(0, 60)
  const industry = (c.req.query('industry') || '').trim().slice(0, 40)
  if (!name) return c.json({ error: 'name required' }, 400)
  const short = name.replace(/(股份有限公司|有限责任公司|有限公司|集团|公司)$/g, '')
  const [w0, news, biz] = await Promise.all([
    wiki(name),
    bingRss(`${name}`, 8),
    bingRss(`${name} ${industry} 产品 业务`, 6),
  ])
  const w = w0 || (short && short !== name ? await wiki(short) : null)
  // 只保留与企业名称相关的条目，降低误匹配
  const key = name.replace(/(有限公司|股份有限公司|有限责任公司|集团|公司)$/g, '').slice(0, 6)
  const rel = (n: NewsItem) => !key || n.title.includes(key) || n.desc.includes(key)
  const seen = new Set<string>()
  const all = [...news, ...biz].filter((n) => { if (seen.has(n.link)) return false; seen.add(n.link); return true })
  const related = all.filter(rel)
  return c.json({
    name, industry,
    wiki: w,
    news: related.slice(0, 8),
    loose: all.filter((n) => !rel(n)).slice(0, 4),
    sources: [
      { name: '维基百科', ok: !!w },
      { name: '必应资讯', ok: all.length > 0 },
    ],
    scannedAt: new Date().toISOString(),
  })
})

// 商机雷达：按行业关键词检索公开采购/需求/招标线索
app.get('/api/leads', async (c) => {
  const q = (c.req.query('q') || '').trim().slice(0, 60)
  if (!q) return c.json({ items: [] })
  const [a, b, c2] = await Promise.all([bingRss(`${q} 采购 需求`, 8), bingRss(`${q} 招标 项目`, 8), bingRss(`${q} 行业 市场`, 8)])
  const seen = new Set<string>()
  const words = q.split(/\s+/).filter(Boolean)
  const INTENT = /采购|招标|中标|询价|比选|竞争性|订单|需求公告|项目公告|供应商|集采/
  const hit = (n: NewsItem) => { const t = n.title + n.desc; return words.some((w) => t.includes(w.slice(0, 4))) && INTENT.test(t) }
  const items = [...a, ...b, ...c2].filter((n) => { if (seen.has(n.link) || !hit(n)) return false; seen.add(n.link); return true })
  return c.json({ q, items, fetchedAt: new Date().toISOString() })
})

app.get('/api/health', (c) => c.json({ ok: true, service: 'enterprise-brain' }))

app.get('/', (c) => c.html(`<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>企业智脑 · 老板的 AI 经营指挥舱</title>
<link rel="preconnect" href="https://cdn.jsdelivr.net" />
<link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet" />
<link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🧠</text></svg>" />
<link href="/static/style.css" rel="stylesheet" />
</head>
<body>
<div id="bg-stars"></div>
<div id="app"></div>
<div id="toast-layer"></div>
<script src="/static/industries.js"></script>
<script src="/static/data.js"></script>
<script src="/static/core.js"></script>
<script src="/static/wizard.js"></script>
<script src="/static/flow.js"></script>
<script src="/static/hq.js"></script>
<script src="/static/modules.js"></script>
<script src="/static/office.js"></script>
<script src="/static/masters.js"></script>
<script src="/static/models.js"></script>
<script src="/static/ideas.js"></script>
<script src="/static/home.js"></script>
<script src="/static/ai.js"></script>
<script src="/static/main.js"></script>
</body>
</html>`))

export default app
