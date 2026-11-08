// 智导 · 客服 Agent：企业知识库问答 + 可嵌入官网的小窗 + 会话入库 + 转人工
import { Hono } from 'hono'
import { llm, AiError, clip } from './ai'
import { rid, now, esc, db } from './svc-util'

type Bindings = { GSK_API_KEY?: string; GSK_BASE_URL?: string; DB?: D1Database }
const cs = new Hono<{ Bindings: Bindings }>()
cs.onError((err, c) => c.json({ ok: false, error: err.message || '客服服务异常' }, (err instanceof AiError ? err.code : 500) as any))
const HUMAN_RE = /人工|真人|转接|投诉|经理|客服电话|找你们老板/
const DAY = 86400e3

async function bot(c: any, id: string, token?: string) {
  const r = await db(c).prepare('SELECT * FROM cs_bots WHERE id = ?').bind(clip(id, 40)).first<any>()
  if (!r) throw new AiError('客服不存在', 404)
  if (token !== undefined && r.token !== token) throw new AiError('客服管理密钥无效', 401)
  return r
}

// ---- 企业端：创建 / 更新 / 查看会话 ----
cs.post('/bot/save', async (c) => {
  const b = await c.req.json<any>()
  const name = clip(b.name, 30).trim() || '智能客服', t = now()
  const fields = [name, clip(b.company, 60), clip(b.greeting, 200) || `您好，我是${name}，有什么可以帮您？`, clip(b.knowledge, 12000), clip(b.human, 120), t]
  if (b.id) {
    const r = await bot(c, b.id, clip(b.token, 60))
    await db(c).prepare('UPDATE cs_bots SET name = ?, company = ?, greeting = ?, knowledge = ?, human = ?, updated_at = ? WHERE id = ?').bind(...fields, r.id).run()
    return c.json({ ok: true, id: r.id, token: r.token })
  }
  const id = rid('bot'), token = rid('bk')
  await db(c).prepare('INSERT INTO cs_bots (id, token, name, company, greeting, knowledge, human, updated_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(id, token, ...fields, t).run()
  return c.json({ ok: true, id, token })
})
cs.post('/bot/sessions', async (c) => {
  const b = await c.req.json<any>()
  const r = await bot(c, b.id, clip(b.token, 60))
  const D = db(c)
  const { results } = await D.prepare('SELECT * FROM cs_sessions WHERE bot_id = ? ORDER BY updated_at DESC LIMIT 50').bind(r.id).all<any>()
  const st = await D.prepare("SELECT COUNT(*) AS n, SUM(msgs) AS m, SUM(CASE WHEN status = 'human' THEN 1 ELSE 0 END) AS h FROM cs_sessions WHERE bot_id = ? AND created_at > ?").bind(r.id, now() - 7 * DAY).first<any>()
  return c.json({ ok: true, sessions: results || [], stats: { sessions7d: st?.n || 0, msgs7d: st?.m || 0, human7d: st?.h || 0 } })
})
cs.post('/bot/messages', async (c) => {
  const b = await c.req.json<any>()
  const r = await bot(c, b.id, clip(b.token, 60))
  const s = await db(c).prepare('SELECT id FROM cs_sessions WHERE id = ? AND bot_id = ?').bind(clip(b.sid, 40), r.id).first<any>()
  if (!s) throw new AiError('会话不存在', 404)
  const { results } = await db(c).prepare('SELECT role, text, at FROM cs_msgs WHERE session_id = ? ORDER BY at ASC LIMIT 200').bind(s.id).all<any>()
  return c.json({ ok: true, msgs: results || [] })
})
// 人工客服回复 / 结束会话
cs.post('/bot/reply', async (c) => {
  const b = await c.req.json<any>()
  const r = await bot(c, b.id, clip(b.token, 60))
  const s = await db(c).prepare('SELECT id FROM cs_sessions WHERE id = ? AND bot_id = ?').bind(clip(b.sid, 40), r.id).first<any>()
  if (!s) throw new AiError('会话不存在', 404)
  const text = clip(b.text, 1000).trim(), t = now()
  if (text) await db(c).prepare('INSERT INTO cs_msgs (id, session_id, role, text, at) VALUES (?, ?, ?, ?, ?)').bind(rid('m'), s.id, 'agent', text, t).run()
  await db(c).prepare('UPDATE cs_sessions SET status = ?, updated_at = ?, msgs = msgs + ? WHERE id = ?').bind(b.close ? 'closed' : 'human', t, text ? 1 : 0, s.id).run()
  return c.json({ ok: true })
})

// ---- 访客端（公开）：配置 / 对话 / 拉取人工回复 ----
cs.get('/pub/:id', async (c) => {
  const r = await bot(c, c.req.param('id'))
  return c.json({ ok: true, name: r.name, company: r.company, greeting: r.greeting })
})
cs.post('/pub/:id/chat', async (c) => {
  const r = await bot(c, c.req.param('id'))
  const b = await c.req.json<any>()
  const text = clip(b.text, 500).trim(); if (!text) throw new AiError('请输入问题', 400)
  const D = db(c), t = now()
  // 简单防刷：单会话每分钟最多 8 条
  let sid = clip(b.sid, 40)
  let s = sid ? await D.prepare('SELECT * FROM cs_sessions WHERE id = ? AND bot_id = ?').bind(sid, r.id).first<any>() : null
  if (!s) { sid = rid('ss'); await D.prepare("INSERT INTO cs_sessions (id, bot_id, status, msgs, last_text, created_at, updated_at) VALUES (?, ?, 'bot', 0, '', ?, ?)").bind(sid, r.id, t, t).run(); s = { id: sid, status: 'bot' } }
  const recent = await D.prepare("SELECT COUNT(*) AS n FROM cs_msgs WHERE session_id = ? AND role = 'user' AND at > ?").bind(sid, t - 60e3).first<any>()
  if ((recent?.n || 0) >= 8) throw new AiError('提问太频繁了，请稍后再试', 429)
  await D.prepare('INSERT INTO cs_msgs (id, session_id, role, text, at) VALUES (?, ?, ?, ?, ?)').bind(rid('m'), sid, 'user', text, t).run()
  // 已转人工：AI 不再抢答，等人工回复
  if (s.status === 'human') {
    await D.prepare('UPDATE cs_sessions SET msgs = msgs + 1, last_text = ?, updated_at = ? WHERE id = ?').bind(clip(text, 80), t, sid).run()
    return c.json({ ok: true, sid, reply: '', human: true, waiting: true })
  }
  const { results: hist } = await D.prepare('SELECT role, text FROM cs_msgs WHERE session_id = ? ORDER BY at DESC LIMIT 10').bind(sid).all<any>()
  const history = (hist || []).reverse().map((m: any) => `${m.role === 'user' ? '客户' : '客服'}：${m.text}`).join('\n')
  let reply = '', human = HUMAN_RE.test(text)
  if (!human) {
    try {
      const out = await llm(c.env,
        `你是「${r.company || r.name}」的在线客服「${r.name}」。只依据【企业知识库】回答，语气亲切专业、简洁（≤120字）。知识库没有的信息不要编造：坦诚说明并建议转人工。涉及价格、合同、退款、投诉等需要承诺的事项，给出知识库里的规则后建议转人工确认。不得索要身份证号、银行卡、密码。输出 JSON：{"reply":"回复","handoff":true|false,"intent":"咨询|售前|售后|投诉|其他"}`,
        `【企业知识库】\n${clip(r.knowledge, 9000) || '（暂无，请建议客户转人工）'}\n\n【最近对话】\n${history}\n\n请回复客户的最后一条消息。`,
        { model: 'gpt-5.4-mini', effort: 'medium' })
      reply = clip(out.reply, 400); human = !!out.handoff
    } catch { reply = '抱歉，客服系统有点忙，我先帮您转人工。'; human = true }
  }
  if (human) reply = (reply ? reply + '\n\n' : '') + `已为您转接人工客服${r.human ? `（${r.human}）` : ''}，请稍候，人工回复会显示在这里。`
  await D.prepare('INSERT INTO cs_msgs (id, session_id, role, text, at) VALUES (?, ?, ?, ?, ?)').bind(rid('m'), sid, 'bot', reply, now()).run()
  await D.prepare('UPDATE cs_sessions SET msgs = msgs + 2, last_text = ?, status = ?, updated_at = ? WHERE id = ?').bind(clip(text, 80), human ? 'human' : 'bot', now(), sid).run()
  return c.json({ ok: true, sid, reply, human })
})
cs.get('/pub/:id/poll', async (c) => {
  const sid = clip(c.req.query('sid'), 40), since = +(c.req.query('since') || 0)
  const s = await db(c).prepare('SELECT id, status FROM cs_sessions WHERE id = ? AND bot_id = ?').bind(sid, clip(c.req.param('id'), 40)).first<any>()
  if (!s) return c.json({ ok: true, msgs: [] })
  const { results } = await db(c).prepare("SELECT role, text, at FROM cs_msgs WHERE session_id = ? AND role = 'agent' AND at > ? ORDER BY at ASC").bind(s.id, since).all<any>()
  return c.json({ ok: true, status: s.status, msgs: results || [] })
})

// ---- 嵌入脚本：<script src="/cs/widget.js" data-bot="bot_xxx"></script> ----
export const widgetJs = (origin: string) => `(function(){var s=document.currentScript,id=s&&s.getAttribute('data-bot');if(!id)return;var O='${origin}';
var b=document.createElement('button');b.innerHTML='💬';b.title='在线客服';b.style.cssText='position:fixed;right:22px;bottom:22px;width:56px;height:56px;border-radius:50%;border:0;background:linear-gradient(135deg,#2563eb,#7c3aed);color:#fff;font-size:24px;box-shadow:0 10px 30px rgba(37,99,235,.35);cursor:pointer;z-index:2147483646';
var f=document.createElement('iframe');f.src=O+'/cs/chat/'+id;f.title='在线客服';f.style.cssText='position:fixed;right:22px;bottom:90px;width:380px;max-width:calc(100vw - 32px);height:560px;max-height:calc(100vh - 120px);border:0;border-radius:18px;box-shadow:0 20px 60px rgba(15,23,42,.25);display:none;z-index:2147483647;background:#fff';
b.onclick=function(){f.style.display=f.style.display==='none'?'block':'none'};document.body.appendChild(f);document.body.appendChild(b)})();`

export const chatPage = (id: string) => `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>在线客服</title>
<style>*{box-sizing:border-box;margin:0}body{font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;height:100vh;display:flex;flex-direction:column;background:#f8fafc;color:#0f172a;font-size:14px}
header{padding:14px 16px;background:linear-gradient(135deg,#2563eb,#7c3aed);color:#fff;display:flex;align-items:center;gap:10px}header b{font-size:15px}header small{opacity:.85;font-size:12px;display:block}
.dot{width:8px;height:8px;border-radius:50%;background:#34d399;box-shadow:0 0 0 3px rgba(52,211,153,.3)}
#m{flex:1;overflow:auto;padding:16px;display:flex;flex-direction:column;gap:10px}.b{max-width:82%;padding:10px 13px;border-radius:14px;line-height:1.6;white-space:pre-wrap;word-break:break-word}
.u{align-self:flex-end;background:#2563eb;color:#fff;border-bottom-right-radius:4px}.a{align-self:flex-start;background:#fff;border:1px solid #e2e8f0;border-bottom-left-radius:4px}.h{align-self:flex-start;background:#ecfdf5;border:1px solid #a7f3d0;border-bottom-left-radius:4px}
.h:before{content:"人工客服";display:block;font-size:11px;color:#059669;margin-bottom:2px}.t{align-self:center;font-size:12px;color:#94a3b8}
form{display:flex;gap:8px;padding:12px;border-top:1px solid #e2e8f0;background:#fff}input{flex:1;padding:11px 13px;border:1px solid #cbd5e1;border-radius:12px;font-size:14px;outline:none}input:focus{border-color:#2563eb}
button{padding:0 16px;border:0;border-radius:12px;background:#2563eb;color:#fff;font-weight:600;cursor:pointer}button:disabled{opacity:.5}
.q{display:flex;gap:6px;flex-wrap:wrap;padding:0 16px 10px}.q span{padding:5px 10px;border-radius:20px;border:1px solid #e2e8f0;background:#fff;font-size:12px;cursor:pointer}</style></head>
<body><header><span class="dot"></span><div><b id="n">在线客服</b><small id="co">AI 客服 · 7×24 小时</small></div></header><div id="m"></div>
<div class="q" id="q"><span>你们主要做什么？</span><span>怎么收费？</span><span>转人工</span></div>
<form id="f"><input id="i" placeholder="请输入您的问题…" autocomplete="off" maxlength="500"><button id="s">发送</button></form>
<script>var ID=${JSON.stringify(id)},K='cs_sid_'+ID,sid=localStorage.getItem(K)||'',last=Date.now(),m=document.getElementById('m');
function add(t,c){var d=document.createElement('div');d.className='b '+c;d.textContent=t;m.appendChild(d);m.scrollTop=m.scrollHeight;return d}
fetch('/api/cs/pub/'+ID).then(function(r){return r.json()}).then(function(j){if(!j.ok){add(j.error||'客服不可用','t');return}document.getElementById('n').textContent=j.name;if(j.company)document.getElementById('co').textContent=j.company+' · AI 客服';add(j.greeting,'a')});
function send(t){t=(t||'').trim();if(!t)return;add(t,'u');var w=add('正在输入…','a');document.getElementById('s').disabled=true;
fetch('/api/cs/pub/'+ID+'/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sid:sid,text:t})}).then(function(r){return r.json()}).then(function(j){
if(!j.ok){w.textContent=j.error||'发送失败';return}sid=j.sid;localStorage.setItem(K,sid);if(j.reply)w.textContent=j.reply;else{w.className='b t';w.textContent='已通知人工客服，请稍候…'}}).catch(function(){w.textContent='网络异常，请重试'}).finally(function(){document.getElementById('s').disabled=false})}
document.getElementById('f').onsubmit=function(e){e.preventDefault();var i=document.getElementById('i');send(i.value);i.value=''};
document.getElementById('i').addEventListener('keydown',function(e){if(e.key==='Enter'&&(e.isComposing||e.keyCode===229))e.preventDefault()});
[].forEach.call(document.querySelectorAll('#q span'),function(x){x.onclick=function(){send(x.textContent)}});
setInterval(function(){if(!sid)return;fetch('/api/cs/pub/'+ID+'/poll?sid='+sid+'&since='+last).then(function(r){return r.json()}).then(function(j){(j.msgs||[]).forEach(function(x){add(x.text,'h');last=Math.max(last,x.at)});if(j.status==='closed'&&!window._c){window._c=1;add('本次会话已结束，感谢咨询','t')}}).catch(function(){})},4000);
</script></body></html>`
export { esc }
export default cs
