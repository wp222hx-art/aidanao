// 企业智脑 · 汇报材料（Word / Excel / 创意 PPT）+ 部门汇报查看器 + 项目档案
(function () {
  // ---------------- 按需加载文档库（CDN） ----------------
  const LIBS = {
    docx: ['https://cdn.jsdelivr.net/npm/docx@8.5.0/build/index.umd.js', 'docx'],
    xlsx: ['https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js', 'XLSX'],
    pptx: ['https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js', 'PptxGenJS'],
    zip: ['https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js', 'JSZip']
  };
  const loading = {};
  function lib(k) {
    const [src, g] = LIBS[k];
    if (window[g]) return Promise.resolve(window[g]);
    return loading[k] = loading[k] || new Promise((ok, no) => { const s = document.createElement('script'); s.src = src; s.onload = () => ok(window[g]); s.onerror = () => no(new Error('文档组件加载失败：' + k)); document.head.appendChild(s); });
  }
  const safe = (s) => String(s || '').replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 40);
  const fname = (r, ext) => `${safe(S.company.name.replace(/(股份有限公司|有限责任公司|有限公司)$/, ''))}-${safe(r.deptName)}-${safe(r.title)}.${ext}`;
  function save(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500); }
  async function toDataURL(url) { const b = await (await fetch(url)).blob(); return await new Promise((ok) => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(b); }); }

  // ---------------- 任务快照（实时任务与档案共用一个结构） ----------------
  function snap(t) {
    const d = S.depts.find((x) => x.id === t.deptId), o = S.staff.find((x) => x.id === t.ownerId), P = window.Masters ? Masters.get(t.deptId) : null, c = Flow.cmd(t.cmdId);
    return {
      id: t.id, cmdNo: c?.no || null, cmdText: c?.text || '', title: t.title, deliverable: t.deliverable, deptId: t.deptId, deptName: d?.name || '', color: d?.color || '#2563eb', icon: d?.icon || 'fa-building',
      persona: P ? { title: P.title, name: P.name, motto: P.motto } : null, owner: o ? { name: o.name, pos: o.pos } : null, tier: t.tier, level: t.level, status: t.status, real: !!t.real,
      score: t.accept?.total ?? t.evals?.total ?? null, accept: t.accept ? { total: t.accept.total, threshold: t.accept.threshold, pass: t.accept.pass, met: t.accept.met, items: t.accept.items, feedback: t.accept.feedback } : null,
      criteria: t.criteria || [], output: t.output || '', pack: t.pack || null, rework: t.rework || 0, versions: t.history?.length || 0,
      toolCalls: (t.trace || []).filter((e) => e.step === 'tool' && e.status === 'ok').length, slidesMade: (t.pack?.slides || []).filter((x) => x.url).length,
      evidence: (t.evidence || []).slice(0, 14).map((x) => ({ title: x.title, url: x.url })),
      trace: (t.trace || []).map((e) => ({ step: e.step, tool: e.tool, detail: e.detail, at: e.at, ms: e.ms, status: e.status, model: e.model, sim: e.sim })),
      doneAt: t.doneAt || '', company: S.company.name
    };
  }

  // ---------------- 仿真模式下的汇报材料（结构与真实一致，明确标注仿真） ----------------
  function simPack(t) {
    const d = S.depts.find((x) => x.id === t.deptId);
    const crit = t.criteria || [];
    return {
      sim: true, at: `D${S.sim.day}`, slideModel: officeCfg().slideModel,
      doc: { title: t.title, subtitle: `${d?.name || ''} · 部门汇报（仿真）`, summary: '仿真模式：AI 未连接，本汇报材料仅演示结构与流程，不含真实内容。' },
      sheets: [
        { name: '验收对照', title: '验收标准达成情况', columns: ['序号', '验收标准', '结果'], rows: crit.map((c, i) => [i + 1, c, (t.accept?.items?.[i]?.status) === 'met' ? '达标' : '部分达标']), note: '仿真数据' },
        { name: '行动计划', title: '下一步行动计划', columns: ['动作', '负责岗位', '开始', '完成', '量化目标', '状态'], rows: [['确认方案细节', d?.name || '', 'D1', 'D3', '方案定稿 1 份', '待启动'], ['资源与预算确认', '部门负责人', 'D2', 'D5', '预算表 1 份', '待启动'], ['执行与周复盘', d?.name || '', 'D5', 'D30', '每周复盘 1 次', '待启动']], note: '仿真数据' }
      ],
      slides: [
        { layout: 'cover', title: t.title.slice(0, 14), subtitle: `${d?.name || ''} · 部门汇报`, points: [], speaker: '仿真演示：封面页。', visual: '' },
        { layout: 'insight', title: '核心结论', points: ['仿真模式演示', '连接 AI 后生成真实内容'], speaker: '仿真演示：结论页。', visual: '' },
        { layout: 'plan', title: '行动计划', points: ['确认方案', '资源到位', '执行复盘'], speaker: '仿真演示：计划页。', visual: '' },
        { layout: 'close', title: '需老板拍板', points: ['是否启动执行'], speaker: '仿真演示：决策页。', visual: '' }
      ]
    };
  }

  // ---------------- Markdown → Word ----------------
  function mdBlocks(md) {
    const out = []; let table = null;
    const flush = () => { if (table) { out.push({ t: 'table', rows: table }); table = null; } };
    String(md || '').split('\n').forEach((raw) => {
      const l = raw.trimEnd(); let m;
      if (/^\s*\|.*\|\s*$/.test(l)) { if (/^\s*\|[\s:\-|]+\|\s*$/.test(l)) return; (table = table || []).push(l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim())); return; }
      flush();
      if (!l.trim()) return;
      if ((m = l.match(/^\s*!\[[^\]]*\]\(([^)]+)\)/))) return out.push({ t: 'img', url: m[1] });
      if ((m = l.match(/^\s*(#{1,4})\s+(.*)/))) return out.push({ t: 'h', lv: m[1].length, text: m[2] });
      if ((m = l.match(/^\s*>\s?(.*)/))) return out.push({ t: 'quote', text: m[1] });
      if ((m = l.match(/^\s*[-*•]\s+(.*)/))) return out.push({ t: 'li', text: m[1] });
      if ((m = l.match(/^\s*(\d+)[.)、]\s*(.*)/))) return out.push({ t: 'ol', n: m[1], text: m[2] });
      out.push({ t: 'p', text: l.trim() });
    });
    flush(); return out;
  }
  const clean = (s) => String(s || '').replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '$1（$2）').replace(/`([^`]+)`/g, '$1');
  function runs(D, text, o = {}) {
    return clean(text).split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((seg) => { const b = /^\*\*.*\*\*$/.test(seg); return new D.TextRun({ text: b ? seg.slice(2, -2) : seg, bold: b || o.bold, color: o.color, size: o.size }); });
  }
  function dTable(D, rows, headFill = 'EFF6FF') {
    const w = Math.max(...rows.map((r) => r.length));
    return new D.Table({
      width: { size: 100, type: D.WidthType.PERCENTAGE },
      rows: rows.map((r, i) => new D.TableRow({ tableHeader: i === 0, children: Array.from({ length: w }, (_, j) => new D.TableCell({ children: [new D.Paragraph({ children: runs(D, r[j] ?? '', { bold: i === 0, size: 19 }) })], shading: i === 0 ? { fill: headFill, type: D.ShadingType.CLEAR, color: 'auto' } : undefined, margins: { top: 60, bottom: 60, left: 90, right: 90 } })) }))
    });
  }
  async function makeDocx(r) {
    const D = await lib('docx');
    const P = r.pack || {}, doc = P.doc || {}, kids = [];
    const H = (text, lv) => new D.Paragraph({ heading: [D.HeadingLevel.HEADING_1, D.HeadingLevel.HEADING_2, D.HeadingLevel.HEADING_3, D.HeadingLevel.HEADING_4][lv - 1], spacing: { before: 240, after: 120 }, children: runs(D, text, { color: '1E3A8A' }) });
    kids.push(new D.Paragraph({ heading: D.HeadingLevel.TITLE, children: [new D.TextRun({ text: doc.title || r.title, bold: true, size: 40, color: '0F172A' })] }));
    if (doc.subtitle) kids.push(new D.Paragraph({ spacing: { after: 200 }, children: [new D.TextRun({ text: doc.subtitle, size: 24, color: '475569' })] }));
    kids.push(dTable(D, [['项目', '内容'], ['企业', r.company || S.company.name], ['部门', r.deptName], ['首席大师', r.persona ? `${r.persona.title}「${r.persona.name}」` : '—'], ['负责人', r.owner ? `${r.owner.name}（${r.owner.pos}）` : '—'], ['能力级别', TIERS[r.tier]?.name || ''], ['所属指令', r.cmdNo ? `#${r.cmdNo} ${r.cmdText}` : '—'], ['交付物', r.deliverable || ''], ['验收得分', r.accept ? `${r.accept.total} / 门槛 ${r.accept.threshold}（${r.accept.met}/${(r.accept.items || []).length} 条达标）` : '—'], ['执行方式', r.real ? `Ultra 推理 · 工具调用 ${r.toolCalls} 次 · 证据 ${r.evidence.length} 条` : '仿真演示']]));
    if (doc.summary) { kids.push(H('汇报摘要', 1)); kids.push(new D.Paragraph({ children: runs(D, doc.summary) })); }
    kids.push(H('成果正文', 1));
    for (const b of mdBlocks(r.output)) {
      if (b.t === 'h') kids.push(H(b.text, Math.min(4, b.lv + 1)));
      else if (b.t === 'p') kids.push(new D.Paragraph({ spacing: { after: 80 }, children: runs(D, b.text) }));
      else if (b.t === 'quote') kids.push(new D.Paragraph({ indent: { left: 360 }, children: runs(D, b.text, { color: '64748B' }) }));
      else if (b.t === 'li') kids.push(new D.Paragraph({ bullet: { level: 0 }, children: runs(D, b.text) }));
      else if (b.t === 'ol') kids.push(new D.Paragraph({ indent: { left: 360 }, children: runs(D, `${b.n}. ${b.text}`) }));
      else if (b.t === 'table' && b.rows.length) { kids.push(dTable(D, b.rows)); kids.push(new D.Paragraph({ text: '' })); }
      else if (b.t === 'img') { try { const buf = await (await fetch(b.url)).arrayBuffer(); kids.push(new D.Paragraph({ children: [new D.ImageRun({ data: buf, transformation: { width: 420, height: 560 } })] })); } catch { } }
    }
    if (r.accept?.items?.length) { kids.push(H('附录一 · 独立验收对照', 1)); kids.push(dTable(D, [['验收标准', '结果', '验收证据'], ...r.accept.items.map((x) => [x.text, { met: '达标', partial: '部分达标', miss: '未达标' }[x.status] || x.status, `${x.evidence || ''} ${x.note || ''}`])], 'ECFDF5')); if (r.accept.feedback) kids.push(new D.Paragraph({ spacing: { before: 120 }, children: runs(D, `验收意见：${r.accept.feedback}`, { color: '475569' }) })); }
    if (r.evidence?.length) { kids.push(H('附录二 · 证据来源', 1)); r.evidence.forEach((x, i) => kids.push(new D.Paragraph({ children: runs(D, `[${i + 1}] ${x.title}  ${x.url}`, { size: 18 }) }))); }
    const docx = new D.Document({ creator: '企业智脑', title: doc.title || r.title, styles: { default: { document: { run: { font: 'Microsoft YaHei', size: 21 } } } }, sections: [{ properties: {}, children: kids }] });
    return await D.Packer.toBlob(docx);
  }

  // ---------------- Excel ----------------
  async function makeXlsx(r) {
    const X = await lib('xlsx');
    const wb = X.utils.book_new(), used = new Set();
    const nm = (s) => { let n = String(s || '表').replace(/[\\/?*[\]:]/g, '').slice(0, 28) || '表'; let k = n, i = 2; while (used.has(k)) k = `${n}${i++}`; used.add(k); return k; };
    const width = (aoa) => { const w = []; aoa.forEach((row) => row.forEach((c, j) => { const len = String(c ?? '').replace(/[^\x00-\xff]/g, 'xx').length; w[j] = Math.min(60, Math.max(w[j] || 8, len + 2)); })); return w.map((wch) => ({ wch })); };
    const add = (name, aoa) => { const ws = X.utils.aoa_to_sheet(aoa); ws['!cols'] = width(aoa); X.utils.book_append_sheet(wb, ws, nm(name)); };
    const sum = [[`${r.deptName} · 部门汇报概要`], [], ['任务', r.title], ['交付物', r.deliverable || ''], ['首席大师', r.persona ? `${r.persona.title}「${r.persona.name}」` : ''], ['负责人', r.owner ? `${r.owner.name}（${r.owner.pos}）` : ''], ['能力级别', TIERS[r.tier]?.name || ''], ['验收得分', r.accept?.total ?? ''], ['验收门槛', r.accept?.threshold ?? ''], ['工具调用次数', r.toolCalls], ['证据条数', r.evidence.length], ['返工次数', r.rework], []];
    if (r.accept?.items?.length) { sum.push(['验收标准', '结果', '验收证据']); r.accept.items.forEach((x) => sum.push([x.text, { met: '达标', partial: '部分达标', miss: '未达标' }[x.status], x.evidence || ''])); }
    add('汇报概要', sum);
    (r.pack?.sheets || []).forEach((sh) => add(sh.name, [[sh.title || sh.name], [], sh.columns, ...sh.rows, [], ...(sh.note ? [['说明', sh.note]] : [])]));
    if (r.evidence?.length) add('证据来源', [['序号', '标题', '链接'], ...r.evidence.map((x, i) => [i + 1, x.title, x.url])]);
    return new Blob([X.write(wb, { bookType: 'xlsx', type: 'array' })], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }

  // ---------------- 创意 PPT ----------------
  async function makePptx(r) {
    const G = await lib('pptx');
    const p = new G(); p.layout = 'LAYOUT_16x9'; p.title = r.pack?.doc?.title || r.title;
    const col = (r.color || '#2563eb').replace('#', '');
    for (const sl of (r.pack?.slides || [])) {
      const s = p.addSlide();
      let ok = false;
      if (sl.url) { try { s.addImage({ data: await toDataURL(sl.url), x: 0, y: 0, w: 10, h: 5.625 }); ok = true; } catch { } }
      if (!ok) {
        s.background = { color: 'FFFFFF' };
        s.addShape(p.ShapeType.rect, { x: 0, y: 0, w: 0.18, h: 5.625, fill: { color: col } });
        s.addText(sl.title || '', { x: 0.6, y: sl.layout === 'cover' ? 1.8 : 0.5, w: 8.8, h: 0.9, fontSize: sl.layout === 'cover' ? 36 : 28, bold: true, color: '0F172A', fontFace: 'Microsoft YaHei' });
        if (sl.subtitle) s.addText(sl.subtitle, { x: 0.6, y: sl.layout === 'cover' ? 2.7 : 1.3, w: 8.8, h: 0.5, fontSize: 16, color: '475569', fontFace: 'Microsoft YaHei' });
        if (sl.points?.length) s.addText(sl.points.map((t) => ({ text: t, options: { bullet: true } })), { x: 0.8, y: 2.0, w: 8.4, h: 3, fontSize: 20, color: '1E293B', fontFace: 'Microsoft YaHei', paraSpaceAfter: 10 });
      }
      if (sl.speaker) s.addNotes(sl.speaker);
    }
    const sh = (r.pack?.sheets || [])[0];
    if (sh) {
      const s = p.addSlide(); s.background = { color: 'FFFFFF' };
      s.addText(`数据附录 · ${sh.title || sh.name}`, { x: 0.4, y: 0.25, w: 9.2, h: 0.5, fontSize: 18, bold: true, color: '0F172A', fontFace: 'Microsoft YaHei' });
      const rows = [sh.columns.map((c) => ({ text: String(c), options: { bold: true, fill: { color: 'EFF6FF' } } })), ...sh.rows.slice(0, 12).map((row) => sh.columns.map((_, j) => ({ text: String(row[j] ?? '') })))];
      s.addTable(rows, { x: 0.4, y: 0.85, w: 9.2, fontSize: 9, fontFace: 'Microsoft YaHei', border: { type: 'solid', color: 'CBD5E1', pt: 0.5 }, autoPage: false });
      if (sh.note) s.addText(sh.note, { x: 0.4, y: 5.1, w: 9.2, h: 0.35, fontSize: 9, color: '64748B', fontFace: 'Microsoft YaHei' });
    }
    return await p.write({ outputType: 'blob' });
  }

  const Office = window.Office = { lib, snap, simPack, makeDocx, makeXlsx, makePptx, save, fname };
  Office.download = async function (r, kind) {
    if (!r.pack) return toast('该任务还没有汇报材料');
    toast(`正在生成${{ docx: ' Word 文档', xlsx: ' Excel 表格', pptx: '创意 PPT' }[kind]}…`, 'fa-file-arrow-down');
    try { const blob = await ({ docx: makeDocx, xlsx: makeXlsx, pptx: makePptx }[kind])(r); save(blob, fname(r, kind)); }
    catch (e) { toast('文档生成失败：' + e.message, 'fa-triangle-exclamation'); }
  };

  // ---------------- 部门汇报查看器（Word / Excel / PPT 三屏） ----------------
  let RV = { r: null, tab: 'ppt', sheet: 0, slide: 0 };
  window.openReport = function (ref, tab) {
    const r = typeof ref === 'string' ? (Flow.task(ref) ? snap(Flow.task(ref)) : null) : ref;
    if (!r) return toast('找不到该任务');
    if (!r.pack) return toast('汇报材料尚未生成（验收通过后自动生成）');
    RV = { r, tab: tab || 'ppt', sheet: 0, slide: 0 };
    const m = openModal('<div id="rv"></div>'); m.classList.add('wide', 'report-modal'); drawRV();
  };
  function drawRV() {
    const box = $('#rv'); if (!box) return;
    const { r, tab } = RV, P = r.pack;
    const sc = r.accept ? `<span class="acc ${r.accept.pass ? 'ok' : 'no'}"><b>${r.accept.total}</b><small>/${r.accept.threshold}</small></span>` : '';
    box.innerHTML = `<div class="flex"><span class="dpt" style="--dc:${r.color}"><i class="fas ${r.icon}"></i></span><div style="flex:1;min-width:0"><div class="h2" style="font-size:17px">${esc(r.deptName)} · 部门汇报</div><div class="hint">${esc(r.title)} ${r.persona ? `· 汇报人 <b>${esc(r.persona.title)}「${esc(r.persona.name)}」</b>` : ''} ${r.owner ? `· 负责人 ${esc(r.owner.name)}` : ''} · ${tierBadge(r.tier, true)} ${sc} ${P.sim ? '<span class="tag p">仿真</span>' : ''}</div></div><button class="close-x" data-close><i class="fas fa-xmark"></i></button></div>
      <div class="rv-tabs mt">${[['doc', 'fa-file-word', 'Word 文档', 'w'], ['xls', 'fa-file-excel', 'Excel 表格', 'x'], ['ppt', 'fa-file-powerpoint', '创意 PPT', 'p']].map(([k, i, n, c]) => `<button class="rv-tab ${tab === k ? 'on' : ''} ${c}" data-tab="${k}"><i class="fas ${i}"></i>${n}</button>`).join('')}
        <span style="flex:1"></span>
        <button class="btn btn-ghost btn-sm" data-dl="docx"><i class="fas fa-file-word" style="color:#2563eb"></i>下载 Word</button><button class="btn btn-ghost btn-sm" data-dl="xlsx"><i class="fas fa-file-excel" style="color:#059669"></i>下载 Excel</button><button class="btn btn-ghost btn-sm" data-dl="pptx"><i class="fas fa-file-powerpoint" style="color:#ea580c"></i>下载 PPT</button></div>
      <div class="rv-body mt">${tab === 'doc' ? docView(r) : tab === 'xls' ? xlsView(r) : pptView(r)}</div>`;
    $$('[data-close]', box).forEach((b) => b.onclick = closeOverlay);
    $$('[data-tab]', box).forEach((b) => b.onclick = () => { RV.tab = b.dataset.tab; drawRV(); });
    $$('[data-dl]', box).forEach((b) => b.onclick = () => Office.download(r, b.dataset.dl));
    $$('[data-sheet]', box).forEach((b) => b.onclick = () => { RV.sheet = +b.dataset.sheet; drawRV(); });
    $$('[data-slide]', box).forEach((b) => b.onclick = () => { RV.slide = +b.dataset.slide; drawRV(); });
    const pv = $('#sl-prev', box), nx = $('#sl-next', box), fs = $('#sl-full', box);
    if (pv) pv.onclick = () => { RV.slide = Math.max(0, RV.slide - 1); drawRV(); };
    if (nx) nx.onclick = () => { RV.slide = Math.min((P.slides || []).length - 1, RV.slide + 1); drawRV(); };
    if (fs) fs.onclick = () => openBriefing([{ r, slides: P.slides }], RV.slide);
  }
  function docView(r) {
    const P = r.pack, d = P.doc || {};
    return `<div class="doc-page"><div class="doc-title">${esc(d.title || r.title)}</div>${d.subtitle ? `<div class="doc-sub">${esc(d.subtitle)}</div>` : ''}
      <table class="doc-meta"><tr><th>部门</th><td>${esc(r.deptName)}</td><th>首席大师</th><td>${r.persona ? esc(`${r.persona.title}「${r.persona.name}」`) : '—'}</td></tr><tr><th>负责人</th><td>${r.owner ? esc(`${r.owner.name}（${r.owner.pos}）`) : '—'}</td><th>能力级别</th><td>${TIERS[r.tier]?.name || ''}</td></tr><tr><th>交付物</th><td>${esc(r.deliverable || '')}</td><th>验收</th><td>${r.accept ? `${r.accept.total} 分 · ${r.accept.met}/${(r.accept.items || []).length} 条达标` : '—'}</td></tr></table>
      ${d.summary ? `<div class="doc-sum"><b>汇报摘要</b><p>${esc(d.summary)}</p></div>` : ''}
      <div class="md">${mdRender(r.output)}</div>
      ${r.accept?.items?.length ? `<h4 class="doc-h">附录一 · 独立验收对照</h4><ul class="crit">${r.accept.items.map((x) => `<li class="ai-${x.status}"><i class="fas ${x.status === 'met' ? 'fa-circle-check' : x.status === 'partial' ? 'fa-circle-half-stroke' : 'fa-circle-xmark'}"></i><span>${esc(x.text)}${x.evidence ? `<small>「${esc(x.evidence)}」</small>` : ''}</span></li>`).join('')}</ul>` : ''}
      ${r.evidence?.length ? `<h4 class="doc-h">附录二 · 证据来源</h4><ol class="doc-src">${r.evidence.map((x) => `<li><a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.title)}</a></li>`).join('')}</ol>` : ''}</div>`;
  }
  function xlsView(r) {
    const sheets = [{ name: '汇报概要', title: `${r.deptName} · 汇报概要`, columns: ['项目', '内容'], rows: [['任务', r.title], ['首席大师', r.persona ? `${r.persona.title}「${r.persona.name}」` : ''], ['负责人', r.owner?.name || ''], ['能力级别', TIERS[r.tier]?.name || ''], ['验收得分', r.accept?.total ?? ''], ['工具调用', r.toolCalls], ['证据条数', r.evidence.length], ['返工次数', r.rework]] }, ...(r.pack.sheets || [])];
    const i = Math.min(RV.sheet, sheets.length - 1), sh = sheets[i];
    return `<div class="xls"><div class="xls-tabs">${sheets.map((x, k) => `<button class="${k === i ? 'on' : ''}" data-sheet="${k}"><i class="fas fa-table"></i>${esc(x.name)}</button>`).join('')}</div>
      <div class="xls-title">${esc(sh.title || sh.name)}</div>
      <div class="xls-grid"><table><thead><tr><th class="rn"></th>${sh.columns.map((c, j) => `<th><small>${String.fromCharCode(65 + j)}</small>${esc(c)}</th>`).join('')}</tr></thead><tbody>${sh.rows.map((row, k) => `<tr><td class="rn">${k + 1}</td>${sh.columns.map((_, j) => { const v = row[j]; return `<td class="${typeof v === 'number' ? 'num' : ''}">${esc(typeof v === 'number' ? v.toLocaleString() : v ?? '')}</td>`; }).join('')}</tr>`).join('')}</tbody></table></div>
      ${sh.note ? `<div class="hint mt"><i class="fas fa-circle-info"></i> ${esc(sh.note)}</div>` : ''}</div>`;
  }
  function slideHTML(sl, r, big) {
    if (sl.url) return `<img src="${esc(sl.url)}" alt="${esc(sl.title)}" loading="lazy">`;
    return `<div class="slide-html ${sl.layout}" style="--sc:${r.color}"><i class="bar"></i><div class="st">${esc(sl.title)}</div>${sl.subtitle ? `<div class="ss">${esc(sl.subtitle)}</div>` : ''}${sl.points?.length ? `<ul>${sl.points.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}${big && sl.pending ? '<div class="sp"><i class="fas fa-spinner fa-spin"></i> 生成中…</div>' : ''}</div>`;
  }
  Office.slideHTML = slideHTML;
  function pptView(r) {
    const S2 = r.pack.slides || []; if (!S2.length) return '<div class="hint">无幻灯片</div>';
    const i = Math.min(RV.slide, S2.length - 1), sl = S2[i];
    const mdl = (SLIDE_MODELS.find((x) => x[0] === r.pack.slideModel) || [])[1] || '';
    return `<div class="ppt"><div class="ppt-stage">${slideHTML(sl, r, true)}<button class="nav l" id="sl-prev" ${i ? '' : 'disabled'}><i class="fas fa-chevron-left"></i></button><button class="nav r" id="sl-next" ${i < S2.length - 1 ? '' : 'disabled'}><i class="fas fa-chevron-right"></i></button><span class="pg-no">${i + 1} / ${S2.length}</span><button class="full" id="sl-full" title="全屏汇报"><i class="fas fa-expand"></i></button></div>
      <div class="ppt-side"><div class="h4">讲稿</div><p class="notes">${esc(sl.speaker || '—')}</p>${sl.visual ? `<div class="h4 mt">画面创意</div><p class="hint">${esc(sl.visual)}</p>` : ''}<div class="hint mt">${sl.url ? `<i class="fas fa-wand-magic-sparkles"></i> ${esc(mdl)} 生成` : r.pack.sim ? '仿真模式：文字版幻灯片' : '图片未生成，导出时使用文字版版式'}</div></div></div>
      <div class="ppt-thumbs">${S2.map((x, k) => `<button class="${k === i ? 'on' : ''}" data-slide="${k}">${slideHTML(x, r)}<span>${k + 1}</span></button>`).join('')}</div>`;
  }

  // ---------------- 全屏汇报模式：按部门依次播放幻灯片 ----------------
  window.openBriefing = function (groups, start = 0) {
    const items = []; groups.forEach((g) => (g.slides || []).forEach((sl) => items.push({ r: g.r, sl })));
    if (!items.length) return toast('暂无可汇报的幻灯片');
    let i = Math.min(start, items.length - 1);
    const el = document.createElement('div'); el.className = 'brief-mode'; document.body.appendChild(el);
    const draw = () => { const { r, sl } = items[i]; el.innerHTML = `<div class="bm-top"><span class="dpt" style="--dc:${r.color}"><i class="fas ${r.icon}"></i>${esc(r.deptName)}</span><span>${r.persona ? `汇报人：${esc(r.persona.title)}「${esc(r.persona.name)}」` : ''}</span><span class="dim">${esc(r.title)}</span><span style="flex:1"></span><span>${i + 1} / ${items.length}</span><button data-x><i class="fas fa-xmark"></i></button></div><div class="bm-stage">${slideHTML(sl, r, true)}</div><div class="bm-notes"><b>讲稿</b> ${esc(sl.speaker || '')}</div><button class="bm-nav l" data-p><i class="fas fa-chevron-left"></i></button><button class="bm-nav r" data-n><i class="fas fa-chevron-right"></i></button>`; el.querySelector('[data-x]').onclick = close; el.querySelector('[data-p]').onclick = () => { if (i > 0) { i--; draw(); } }; el.querySelector('[data-n]').onclick = () => { if (i < items.length - 1) { i++; draw(); } }; };
    const key = (e) => { if (e.key === 'ArrowRight' || e.key === ' ') { if (i < items.length - 1) { i++; draw(); } } else if (e.key === 'ArrowLeft') { if (i > 0) { i--; draw(); } } else if (e.key === 'Escape') close(); };
    function close() { el.remove(); document.removeEventListener('keydown', key, true); }
    document.addEventListener('keydown', key, true); draw();
  };

  // ---------------- 项目档案 ----------------
  const Archive = window.Archive = {};
  Archive.list = () => (S.archive = S.archive || []);
  Archive.add = function (c) {
    const ts = c.taskIds.map(Flow.task).filter((t) => t && t.status === 'done');
    const by = {};
    ts.forEach((t) => { const s = snap(t); (by[t.deptId] = by[t.deptId] || { deptId: t.deptId, name: s.deptName, color: s.color, icon: s.icon, persona: s.persona, tasks: [] }).tasks.push(s); });
    const depts = Object.values(by), all = depts.flatMap((d) => d.tasks);
    const rec = {
      id: uid('ar'), cmdId: c.id, no: c.no, text: c.text, goal: c.goal, source: c.source, iteration: c.iteration, real: !!c.real, issuedAt: `D${c.day} ${c.t}`, doneAt: c.doneAt || `D${S.sim.day}`, archivedAt: Date.now(),
      company: S.company.name, industry: `${S.industry?.name || ''} › ${S.industry?.div?.name || ''}`,
      acceptance: c.acceptance, review: c.review, depts,
      stats: { depts: depts.length, tasks: all.length, docs: all.filter((x) => x.pack).length * 3, slides: all.reduce((n, x) => n + (x.pack?.slides?.length || 0), 0), toolCalls: all.reduce((n, x) => n + x.toolCalls, 0), evidence: all.reduce((n, x) => n + x.evidence.length, 0), rework: all.reduce((n, x) => n + x.rework, 0), avg: all.length ? Math.round(all.reduce((n, x) => n + (x.score || 0), 0) / all.length) : 0 }
    };
    const L = Archive.list(); const old = L.findIndex((x) => x.cmdId === c.id); if (old >= 0) L.splice(old, 1);
    L.unshift(rec); if (L.length > 40) L.length = 40;
    c.archiveId = rec.id; return rec;
  };
  Archive.get = (id) => Archive.list().find((x) => x.id === id || x.cmdId === id);
  Archive.zip = async function (rec) {
    const Z = await lib('zip'); const zip = new Z();
    toast(`正在打包 #${rec.no} 全部部门汇报材料…`, 'fa-file-zipper');
    for (const d of rec.depts) {
      const f = zip.folder(safe(d.name));
      for (const r of d.tasks) { if (!r.pack) continue; for (const k of ['docx', 'xlsx', 'pptx']) { try { f.file(fname(r, k), await ({ docx: makeDocx, xlsx: makeXlsx, pptx: makePptx }[k])(r)); } catch (e) { console.warn(e); } } }
    }
    zip.file('项目总结.md', `# #${rec.no} ${rec.text}\n\n- 目标：${rec.goal || ''}\n- 下达：${rec.issuedAt}　完成：${rec.doneAt}\n- 指令验收：${rec.acceptance?.score ?? '-'} 分（${{ achieved: '目标达成', partial: '部分达成', failed: '未达成' }[rec.acceptance?.verdict] || ''}）\n- ${rec.acceptance?.summary || ''}\n\n## 部门成果\n${rec.depts.map((d) => `### ${d.name}${d.persona ? `（${d.persona.title}「${d.persona.name}」）` : ''}\n${d.tasks.map((t) => `- ${t.title}：验收 ${t.score ?? '-'} 分，返工 ${t.rework} 次，工具调用 ${t.toolCalls} 次`).join('\n')}`).join('\n\n')}\n\n## 复盘经验\n${(rec.review?.lessons || []).map((x) => `- ${x}`).join('\n')}\n\n## 下一轮方向\n${(rec.review?.next || []).map((x) => `- ${x}`).join('\n')}\n`);
    save(await zip.generateAsync({ type: 'blob' }), `${safe(S.company.name)}-项目档案-#${rec.no}-${safe(rec.text)}.zip`);
  };
})();
