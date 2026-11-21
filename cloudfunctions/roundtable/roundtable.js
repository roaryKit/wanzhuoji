// Server-only roundtables. Never return OpenIDs or trust client membership/author fields.
const crypto = require('node:crypto');
const fail = message => { throw Error(message); };
const uid = o => 'u' + hash(o);
const hash = s => crypto.createHash('sha256').update(s).digest('hex');
const token = (t, o) => hash('rt-member\0' + t + '\0' + o);
const strip = ({ _id, ...d }) => d;
const KEY = /^[A-Za-z0-9_-]{8,80}$/;
function text(s, max, min = 0) {
  if (typeof s !== 'string' || [...s.trim()].length < min || [...s.trim()].length > max || /[\x00-\x08\x0b-\x1f\x7f]/.test(s)) fail('文字长度或格式无效');
  return s.trim();
}
function key(s) { if (typeof s !== 'string' || !KEY.test(s)) fail('标识无效'); return s; }
function cursor(s) { if (s == null) return null; if (typeof s !== 'string' || s.length > 150 || !/^\d{4}-\d\d-\d\dT[\d:.]+Z\/[A-Za-z0-9-]+$/.test(s)) fail('分页参数无效'); return s; }
// Legacy media rows are opaque tombstones, never body/quote/URL sources.
function unsupported(m) {
  return ['type','messageType','kind'].some(k => m[k] != null && m[k] !== 'text') ||
    ['fileID','fileId','imageURL','images','image','attachment','attachments','media','file','files'].some(k => Array.isArray(m[k]) ? m[k].length > 0 : !!m[k]) ||
    typeof m.text !== 'string' || !m.text.trim();
}
function envelope(e) {
  const allowed = new Set(['action','tableId','clientId','text','replyTo','type','messageType','kind','userInfo']);
  if (['richText','html','nodes'].some(k=>Object.prototype.hasOwnProperty.call(e,k)) || ['type','messageType','kind'].some(k => e[k] !== undefined && e[k] !== 'text')) fail('圆桌仅支持纯文字消息');
  // The platform may append transport metadata. Never use it as business data or identity.
  return Object.fromEntries(Object.entries(e).filter(([k]) => allowed.has(k) && k !== 'userInfo')); 
}
function capacity(v=8) { if (!Number.isInteger(v) || v<5 || v>8) fail('人数上限须为5至8的整数'); return v; }
// Only operator-created synthetic demonstration tables carry these flags. No client can set them.
const demoOnly=t=>t.demoVisible===true&&typeof t.seedRunId==='string'&&/^seed_/.test(t.owner||'');
const tableCapacity=t=>Number.isInteger(t.capacity)&&t.capacity>=5&&t.capacity<=8?t.capacity:8;
function create(H) {
  const { db, get, locked, user, profiles, textPass } = H;
  // Room identities are projected only after room authorization, not plaza anonymity.
  const memberProfiles=(ids,o,opt={})=>profiles(ids,o,{scope:'roundtable',...opt});
  const col = (name, tx = db) => tx.collection('rt_' + name);
  const doc = (name, id, tx = db) => get('rt_' + name, id, tx);
  const set = (name, id, d, tx = db) => col(name, tx).doc(id).set({ data: strip(d) });
  const upd = (name, id, d, tx = db) => col(name, tx).doc(id).update({ data: d });
  async function auth(tid, o, tx = db, owner = false) {
    const u = await get('users', uid(o), tx);
    if (!u?.ageConfirmed || u.deleting) fail('请先确认年龄或完成清理');
    const t = await doc('tables', key(tid), tx);
    if (!t || t.closed || !t.members.includes(o)) fail('当前不是本桌成员');
    if (owner && t.owner !== o) fail('仅桌主可操作');
    // Snapshot isolation does not validate a read-only membership dependency. Lock the table
    // for every transactional member operation, including text sends, to serialize revocation.
    if (tx !== db) await upd('tables', t._id, { guard: (t.guard || 0) + 1 }, tx);
    return t;
  }
  function summary(t, o) {
    return { id: t._id, name: t.name, intro: t.intro, interest: t.interest, rules: t.rules, count: t.members.length,
      ...(demoOnly(t)?{demoOnly:true}:{}), capacity: tableCapacity(t), formed: t.members.length >= 5, full: t.members.length >= tableCapacity(t), joined: t.members.includes(o), owner: t.owner === o };
  }
  function roomIdentity(p,t,o){
    p=p||{};const suffix=token(t._id,o).slice(0,4).toUpperCase(),anonymous=p.avatarState==='anonymous';
    const name=p.nick||(anonymous?'匿名桌友 ':p.nicknameState==='pending'?'昵称审核中 · ':'桌友 ')+suffix;
    const hints=[];if(anonymous)hints.push('匿名资料');else{if(!p.nick)hints.push(p.nicknameState==='pending'?'昵称审核中':'未设置昵称');if(!p.avatar)hints.push(p.avatarState==='pending'?'头像审核中':p.avatarState==='unavailable'?'头像暂不可用':'未设置头像')}
    return {name,avatar:p.avatar||'',avatarState:p.avatarState||'none',avatarLabel:suffix.slice(0,2),profileHint:hints.join(' · ')};
  }
  async function readProfiles(t,o,opt={}){
    const P=await memberProfiles(t.members,o,opt);
    return t.members.map(x=>({id:token(t._id,x),...roomIdentity(P.get(x),t,x),self:x===o,owner:x===t.owner}));
  }
  async function bump(t, kind, messageId, tx) {
    const seq = (t.seq || 0) + 1;
    await upd('tables', t._id, { seq }, tx);
    await set('events', t._id + '-' + String(seq).padStart(12, '0'), { tableId: t._id, seq, kind, messageId: messageId || '' }, tx);
    return seq;
  }
  async function view(m, o, t) {
    if (!m) return null;
    if (m.status === 'deleted') return { id: m._id, orderKey: m.orderKey, createdAt: m.createdAt, version: m.version, deleted: true, mine: false };
    if (m.status !== 'pass' && m._openid !== o) return null;
    if (unsupported(m)) return {id:m._id,orderKey:m.orderKey,createdAt:m.createdAt,version:m.version,deleted:true,unsupported:true,mine:false,text:'',quote:null,author:null};
    const u = m._openid ? await get('users', uid(m._openid)) : null;
    if (!u || u.deleting) return { id: m._id, orderKey: m.orderKey, createdAt: m.createdAt, version: m.version, deleted: true, mine: false };
    const P = await memberProfiles([m._openid], o), p = P.get(m._openid) || {};
    let quote = null;
    if (m.replyTo) {
      const target = await doc('messages', m.replyTo);
      if (!target || target.tableId !== t._id || target.status !== 'pass' || unsupported(target) || !(await get('users', uid(target._openid))) || (await get('users', uid(target._openid)))?.deleting) quote = { id: m.replyTo, deleted: true, text: '原消息已删除或不可见' };
      else { const Q = await memberProfiles([target._openid], o); quote = { id: target._id, name: roomIdentity(Q.get(target._openid),t,target._openid).name, text: target.text.slice(0, 80) }; }
    }
    return { id: m._id, mine: m._openid === o, author: { id: token(t._id,m._openid),owner:m._openid===t.owner,...roomIdentity(p,t,m._openid) },
      text: m.text, quote, status: m.status, pending: m.status === 'pending', rejected: m.status === 'reject', orderKey: m.orderKey,
      version: m.version, createdAt: m.createdAt, clientId: m._openid === o ? m.clientId : undefined, canDelete: m._openid === o || t.owner === o };
  }
  async function checkedViews(ms, o, t) {
    const rows = [];
    // Bounded page and small concurrency prevent unbounded signing/fan-out.
    for (let i = 0; i < ms.length; i += 5) rows.push(...(await Promise.all(ms.slice(i, i + 5).map(m => view(m, o, t)))).filter(Boolean));
    await auth(t._id, o); // Fail closed if removed while projections/signatures were prepared.
    return rows;
  }
  async function pendingCount(t,o){
    if(t.owner!==o)return undefined;
    const r=await col('requests').where({tableId:t._id,status:'pending'}).count();
    await auth(t._id,o,db,true);return r.total||0;
  }
  async function search(e, o) {
    const term = text(e.search || '', 30), interest = text(e.interest || '', 16), q = { closed: false, seed: db.command.exists(false) };
    if (interest) q.interest = interest;
    if (e.before != null) q.orderKey = db.command.lt(cursor(e.before));
    // Bounded scan with cursor always advanced, including sparse filtered pages.
    const all = (await col('tables').where(q).orderBy('orderKey', 'desc').limit(30).get()).data;
    const membership = await doc('users', uid(o)), mine = [], previews = new Map(), statuses = new Map();
    const requestIds=all.filter(t=>!t.members.includes(o)).map(t=>hash(t._id+'\0'+o));
    for(let i=0;i<requestIds.length;i+=20){const found=(await col('requests').where({_id:db.command.in(requestIds.slice(i,i+20))}).get()).data;for(const r of found)if(r._openid===o)statuses.set(r.tableId,r.status);}
    async function preview(t) {
      if (!t.members.includes(o)) return {...summary(t, o),requestStatus:statuses.get(t._id)||''}; // Public discovery: occupancy only, never identities.
      if (previews.has(t._id)) return previews.get(t._id);
      const pending=(async()=>{const fresh = await auth(t._id, o), members = await readProfiles(fresh, o), checked = await auth(t._id, o);
      const pending=await pendingCount(checked,o);
      return {...summary(checked, o),...(pending===undefined?{}:{pendingCount:pending}), ...(JSON.stringify(fresh.members) === JSON.stringify(checked.members) ? {previewMembers:members} : {})};})();
      previews.set(t._id, pending); return pending;
    }
    const own=await Promise.all((membership?.tables||[]).map(async id=>{const t=await doc('tables',id);return t&&!t.closed&&t.members.includes(o)?preview(t):null}));mine.push(...own.filter(Boolean));
    return { rows: await Promise.all(all.filter(t => !term || (t.name + t.intro + t.interest).includes(term)).map(preview)),
      next: all.length === 30 ? all[29].orderKey : null, mine };
  }
  async function make(e, o) {
    const name = text(e.name, 20, 1), intro = text(e.intro, 140, 1), interest = text(e.interest, 16, 1), rules = text(e.rules || '尊重彼此，不外传桌内交流', 200, 1);
    if (await textPass([name, intro, interest, rules].join('\n'), o) !== 'pass') fail('圆桌文字暂未通过审核，请修改或重试');
    const cap = capacity(e.capacity);
    const cid = key(e.clientId), id = hash('rt-create\0' + o + '\0' + cid), at = new Date();
    const legacyFingerprint=hash(JSON.stringify([name,intro,interest,rules]));
    const fingerprint = hash(JSON.stringify([name, intro, interest, rules, cap]));
    return locked(o, async tx => {
      const old = await doc('tables', id, tx);
      if (old) { if (old.fingerprint !== fingerprint && !(old.capacity==null&&cap===8&&old.fingerprint===legacyFingerprint)) fail('重复请求内容不一致'); return { id }; }
      const u = await doc('users', uid(o), tx) || { tables: [] };
      if (u.tables.length >= 3) fail('每人最多加入三桌');
      await set('tables', id, { name, intro, interest, rules, capacity:cap, fingerprint, owner: o, members: [o], closed: false, seq: 0, createdAt: at, orderKey: at.toISOString() + '/' + id }, tx);
      await set('users', uid(o), { ...u, tables: [...u.tables, id] }, tx);
      return { id };
    });
  }
  async function edit(e,o) {
    const existing=await auth(e.tableId,o,db,true);
    if(e.capacity!==undefined&&capacity(e.capacity)!==tableCapacity(existing))fail('人数上限创建后不可修改');
    const name=text(e.name,20,1),intro=text(e.intro,140,1),interest=text(e.interest,16,1),rules=text(e.rules,200,1);
    if(await textPass([name,intro,interest,rules].join('\n'),o)!=='pass')fail('圆桌文字暂未通过审核，请修改或重试');
    return locked(o,async tx=>{const t=await auth(e.tableId,o,tx,true);await upd('tables',t._id,{name,intro,interest,rules},tx);return {ok:true}});
  }
  async function apply(e, o) {
    const tid = key(e.tableId), note = text(e.note || '', 80);
    if (note && await textPass(note, o) !== 'pass') fail('自我介绍暂未通过审核');
    return locked(o, async tx => {
      const t = await doc('tables', tid, tx), u = await doc('users', uid(o), tx);
      if (!t || t.closed) fail('圆桌不存在');
      if (t.members.includes(o)) return { joined: true };
      if (demoOnly(t)) fail('这是模拟示例圆桌，请申请真实桌主创建的圆桌');
      if ((u?.tables || []).length >= 3) fail('每人最多加入三桌');
      if (t.members.length >= tableCapacity(t)) fail('本桌已满');
      const id = hash(tid + '\0' + o), old = await doc('requests', id, tx);
      if (old?.status === 'pending') return { pending: true };
      if (old?.at && Date.now() - +new Date(old.at) < 60000) fail('申请过于频繁，请稍后重试');
      await set('requests', id, { tableId: tid, _openid: o, note, status: 'pending', at: new Date() }, tx);
      return { pending: true };
    });
  }
  async function requests(e, o) {
    const t = await auth(e.tableId, o, db, true);
    const q={tableId:t._id,status:'pending'};if(e.before!=null)q._id=db.command.gt(key(e.before));
    const found = (await col('requests').where(q).orderBy('_id', 'asc').limit(20).get()).data;
    const total=(await col('requests').where({tableId:t._id,status:'pending'}).count()).total||0;
    const P = await memberProfiles(found.map(r => r._openid), o);
    await auth(t._id, o, db, true);
    return { rows: found.map(r => ({ id: r._id, name: P.get(r._openid)?.nick || '申请人', avatar: P.get(r._openid)?.avatar || '',avatarState:P.get(r._openid)?.avatarState||'none', note: r.note })),total,next:found.length===20?found.at(-1)._id:null };
  }
  async function approve(e, o) {
    return locked(o, async tx => {
      const t = await auth(e.tableId, o, tx, true), r = await doc('requests', key(e.id), tx);
      if (!r || r.tableId !== t._id) fail('申请不存在');
      if (r.status !== 'pending') return { ok: true, duplicate: true };
      if (e.accept !== true && e.accept !== false) fail('审核操作无效');
      if (!e.accept) { await upd('requests', r._id, { status: 'rejected' }, tx); return { ok: true }; }
      const base = await get('users', uid(r._openid), tx), u = await doc('users', uid(r._openid), tx) || { tables: [] };
      if (!base?.ageConfirmed || base.deleting) fail('申请人当前不可加入');
      if (t.members.includes(r._openid)) { await upd('requests', r._id, { status: 'joined' }, tx); return { ok: true }; }
      if (t.members.length >= tableCapacity(t)) fail('本桌已满');
      if (u.tables.length >= 3) fail('该成员已加入三桌');
      await upd('tables', t._id, { members: [...t.members, r._openid] }, tx);
      await set('users', uid(r._openid), { ...u, tables: [...u.tables, t._id] }, tx);
      await upd('requests', r._id, { status: 'joined' }, tx);
      // Conflict with concurrent account clear or approvals in another table.
      await tx.collection('users').doc(base._id).update({ data: { revision: (base.revision || 0) + 1 } });
      return { ok: true };
    });
  }
  async function leave(e, o) {
    return locked(o, async tx => {
      const t = await auth(e.tableId, o, tx), who = e.action === 'remove' ? t.members.find(x => token(t._id, x) === e.memberId) : o;
      if (!who) fail('成员不存在');
      if (e.action === 'remove' && (t.owner !== o || who === o)) fail('仅桌主可移除其他成员');
      if (who === t.owner && t.members.length > 1) fail('请先转让桌主再退出');
      if (who === t.owner && e.confirm !== true) fail('请确认解散圆桌');
      const u = await doc('users', uid(who), tx);
      await upd('tables', t._id, { members: t.members.filter(x => x !== who), closed: t.members.length === 1 }, tx);
      if (u) await upd('users', uid(who), { tables: u.tables.filter(id => id !== t._id) }, tx);
      return { ok: true };
    });
  }
  async function dissolve(e,o){
    if(e.confirm!==true)fail('请确认解散圆桌');
    return locked(o,async tx=>{
      const t=await doc('tables',key(e.tableId),tx);
      if(!t||t.owner!==o)fail('仅桌主可解散圆桌');
      if(t.closed)return {ok:true,duplicate:true};
      await auth(t._id,o,tx,true);
      // A maximum of eight member indexes; all updates share the table transaction.
      for(const member of t.members){const u=await doc('users',uid(member),tx);if(u)await upd('users',uid(member),{tables:u.tables.filter(id=>id!==t._id)},tx)}
      await upd('tables',t._id,{closed:true,members:[],closedAt:new Date(),seq:(t.seq||0)+1},tx);
      // Requests/messages are retained for audit, but closed-table auth revokes every operation.
      return {ok:true};
    });
  }
  async function transfer(e, o) {
    return locked(o, async tx => {
      const t = await auth(e.tableId, o, tx, true), next = t.members.find(x => token(t._id, x) === e.memberId && x !== o);
      if (!next || !(await get('users', uid(next), tx)) || (await get('users', uid(next), tx))?.deleting) fail('目标成员不可接任');
      await upd('tables', t._id, { owner: next }, tx); return { ok: true };
    });
  }
  const membershipKey = t => hash(JSON.stringify([t.members,t.owner,t.name,t.intro,t.interest,t.rules,Math.floor(Date.now()/60000)]));
  async function detail(e, o) {
    const t = await doc('tables', key(e.tableId)); if (!t || t.closed) fail('圆桌不存在');
    if (!t.members.includes(o)) { const req = await doc('requests', hash(t._id + '\0' + o)); return { table: summary(t, o), members: [], requestStatus: req?.status || '' }; }
    await auth(t._id, o);
    const members = await readProfiles(t, o,{fresh:e.refreshProfiles===true}); await auth(t._id, o);
    const pending=await pendingCount(t,o);
    return { table: {...summary(t, o),...(pending===undefined?{}:{pendingCount:pending})}, members, membership:membershipKey(t), selfId: token(t._id, o), cursor: t.seq || 0 };
  }
  async function send(e, o) {
    e = envelope(e);
    const tid = key(e.tableId), clientId = key(e.clientId), id = hash(o + '\0' + tid + '\0' + clientId), content = text(e.text, 500, 1), replyTo = e.replyTo ? key(e.replyTo) : '';
    await auth(tid, o);
    const fingerprint = hash(JSON.stringify([content, replyTo]));
    const previous = await doc('messages', id);
    if (!previous && content && await textPass(content, o) !== 'pass') fail('文字暂未通过审核，请修改或重试');
    await locked(o, async tx => {
      const t = await auth(tid, o, tx), prior = await doc('messages', id, tx);
      if (prior) { if (prior.fingerprint !== fingerprint) fail('重复请求内容不一致'); return; }
      const u = await doc('users', uid(o), tx) || { tables: [] }, now = Date.now(), day = new Date(now).toISOString().slice(0, 10);
      if (u.lastSend && now - u.lastSend < 800 || u.day === day && (u.dayCount || 0) >= 200) fail('消息发送过于频繁，请稍后再试');
      if (replyTo) { const q = await doc('messages', replyTo, tx); if (!q || q.tableId !== tid || q.status !== 'pass' || unsupported(q)) fail('回复目标已删除或不可见'); const author = await get('users', uid(q._openid), tx); if (!author || author.deleting) fail('回复目标已删除或不可见'); }
      const seq = await bump(t, 'message', id, tx), at = new Date(now);
      await set('messages', id, { _openid: o, tableId: tid, clientId, fingerprint, text: content, replyTo, type:'text',
        status: 'pass', createdAt: at, orderKey: at.toISOString() + '/' + id, version: seq }, tx);
      await set('users', uid(o), { ...u, lastSend: now, day, dayCount: u.day === day ? (u.dayCount || 0) + 1 : 1 }, tx);
    });
    const t = await auth(tid, o), row = await view(await doc('messages', id), o, t); await auth(tid, o); return { row };
  }
  async function history(e, o) {
    const t = await auth(e.tableId, o), q = { tableId: t._id };
    if (e.before != null) q.orderKey = db.command.lt(cursor(e.before));
    const raw = (await col('messages').where(q).orderBy('orderKey', 'desc').limit(25).get()).data;
    return { rows: (await checkedViews(raw, o, t)).reverse(), next: raw.length === 25 ? raw[24].orderKey : null, cursor: t.seq || 0 };
  }
  async function poll(e, o) {
    const t = await auth(e.tableId, o), after = e.after ?? 0;
    if (!Number.isSafeInteger(after) || after < 0 || after > (t.seq || 0)) fail('同步游标无效');
    const events = (await col('events').where({ tableId: t._id, seq: db.command.gt(after) }).orderBy('seq', 'asc').limit(40).get()).data;
    const ms = []; for (const id of new Set(events.map(x => x.messageId).filter(Boolean))) { const m = await doc('messages', id); if (m) ms.push(m); }
    const rows = await checkedViews(ms, o, t), membership = membershipKey(t);
    const changed = e.membership !== membership ? {table:summary(t,o),members:await readProfiles(t,o),membership} : {};
    await auth(t._id,o);
    const pending=await pendingCount(t,o);
    return { rows, cursor: events.at(-1)?.seq ?? after, more: events.length === 40, ...changed,...(pending===undefined?{}:{pendingCount:pending}) };
  }
  async function removeMessage(e, o) {
    return locked(o, async tx => {
      const t = await auth(e.tableId, o, tx), m = await doc('messages', key(e.id), tx);
      if (!m || m.tableId !== t._id) fail('消息不存在');
      if (m._openid !== o && t.owner !== o) fail('只能删除本人消息');
      if (m.status === 'deleted') return { ok: true };
      const seq = await bump(t, 'delete', m._id, tx);
      await upd('messages', m._id, { status: 'deleted', text: '', fileID: '', replyTo: '', attachment: '', version: seq }, tx); return { ok: true, version:seq };
    });
  }
  async function report(e, o) {
    return locked(o, async tx => {
      const t = await auth(e.tableId, o, tx), m = await doc('messages', key(e.id), tx);
      if (!m || m.tableId !== t._id || m.status !== 'pass') fail('消息不可举报');
      const reason = text(e.reason || '其他', 60, 1), id = hash(o + '\0' + m._id);
      const old = await doc('reports', id, tx);
      if (!old) await set('reports', id, { tableId: t._id, messageId: m._id, _openid: o, reason, createdAt: new Date() }, tx);
      return { ok: true };
    });
  }
  async function cleanup(o) {
    // Account-clear is explicitly destructive. Remove memberships, transfer to oldest eligible member,
    // and redact messages in bounded batches. No roundtable body survives in quote snapshots.
    const u = await doc('users', uid(o));
    for (const tid of u?.tables || []) await db.runTransaction(async tx => {
      const t = await doc('tables', tid, tx); if (!t || !t.members.includes(o)) return;
      const remaining = [];
      for (const x of t.members.filter(x => x !== o)) { const p = await get('users', uid(x), tx); if (p && !p.deleting) remaining.push(x); }
      await upd('tables', tid, { members: remaining, owner: t.owner === o ? remaining[0] || '' : t.owner, closed: remaining.length === 0 }, tx);
    });
    if (u?.tables?.length) await upd('users', uid(o), { tables: [] });
    const msgs = (await col('messages').where({ _openid: o }).limit(30).get()).data;
    for (const row of msgs) await db.runTransaction(async tx => {
      const m = await doc('messages', row._id, tx), t = await doc('tables', row.tableId, tx);
      if (!m) return; const version = t ? await bump(t, 'delete', m._id, tx) : (m.version || 0) + 1;
      await set('messages', m._id, { tableId: m.tableId, status: 'deleted', text: '', createdAt: m.createdAt, orderKey: m.orderKey, version }, tx);
    });
    if (msgs.length) return false;
    for (const name of ['requests', 'reports', 'uploads']) {
      const q = name === 'uploads' ? { owner: o } : { _openid: o }, rows = (await col(name).where(q).limit(30).get()).data;
      for (const r of rows) await col(name).doc(r._id).remove();
      if (rows.length) return false;
    }
    if (u) await col('users').doc(uid(o)).remove();
    return true;
  }
  async function handle(e, o) {
    await user(o);
    if (['fileID','fileId','imageURL','image','images','attachment','attachments','media','file','files'].some(k => Object.prototype.hasOwnProperty.call(e,k)) || ['type','messageType','kind'].some(k => e[k] !== undefined && e[k] !== 'text')) fail('圆桌仅支持纯文字消息');
    const actions = { search, create: make, edit, detail, apply, requests, approve, dissolve, leave, remove: leave, transfer, send, history, poll, deleteMessage: removeMessage, report };
    const fn = actions[e.action || 'search']; if (!fn) fail('圆桌操作无效'); return fn(e, o);
  }
  return { handle, cleanup };
}
module.exports = { create, unsupported, token };
