const DAY=86400000,SHIFT=8*3600000;
function key(v){return new Date(new Date(v).getTime()+SHIFT).toISOString().slice(0,10)}
// 'YYYY-MM-DD HH:mm' in China time (UTC+08) for display.
function time(v){if(v===undefined||v===null||v==='')return '—';const t=new Date(v).getTime();if(!Number.isFinite(t))return '—';return new Date(t+SHIFT).toISOString().slice(0,16).replace('T',' ')}
function month(v){return key(v).slice(0,7)}
function top(rows,field){const m=new Map();rows.forEach(r=>(Array.isArray(r[field])?[...new Set(r[field])]:[r[field]]).filter(Boolean).forEach(t=>{const a=m.get(t)||{n:0,last:0};a.n++;a.last=Math.max(a.last,+new Date(r.createdAt));m.set(t,a)}));const best=[...m].sort((a,b)=>b[1].n-a[1].n||b[1].last-a[1].last||a[0].localeCompare(b[0]))[0];return (best&&best[0])||'—'}
function stats(rows,ym=month(new Date())){const r=rows.filter(x=>month(x.createdAt)===ym);return {count:r.length,nights:new Set(r.filter(x=>x.isSolo).map(x=>key(x.createdAt))).size,tag:top(r,'moodTags'),category:top(r,'category'),latest:rows.length?key(rows.reduce((a,b)=>+new Date(a.createdAt)>+new Date(b.createdAt)?a:b).createdAt):'—'}}
function remind(rows,now=new Date()){const end=Date.parse(key(now)+'T00:00:00+08:00');return new Set(rows.filter(r=>{const t=Date.parse(key(r.createdAt)+'T00:00:00+08:00');return t<=end&&t>=end-6*DAY}).map(r=>key(r.createdAt))).size>=4}
module.exports={key,time,month,top,stats,remind};
