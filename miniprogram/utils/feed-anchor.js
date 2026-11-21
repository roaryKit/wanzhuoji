// Native page-scroll anchor, never scroll a hidden tab or fight a user's new gesture.
function snapshot(c){return new Promise(resolve=>{
 if(c._foreground===false||typeof c.createSelectorQuery!=='function')return resolve(null);
 let timer,done=false;const end=value=>{if(done)return;done=true;clearTimeout(timer);resolve(value)};
 timer=setTimeout(()=>end(null),120);
 try{const q=c.createSelectorQuery();q.selectAll('.feed-anchor').boundingClientRect();q.selectViewport().scrollOffset();q.exec(r=>{
  const rows=r&&r[0],viewport=r&&r[1];if(!Array.isArray(rows)||!viewport)return end(null);
  end({scrollTop:Number(viewport.scrollTop)||0,rows:rows.filter(x=>x.dataset&&x.dataset.id&&x.bottom>0).map(x=>({id:x.dataset.id,top:x.top}))});
 })}catch(_){end(null)}
})}
async function restore(c,before){if(!before||c._foreground===false)return;const after=await snapshot(c);if(!after||c._foreground===false||Math.abs(after.scrollTop-before.scrollTop)>8)return;const pair=before.rows.map(a=>[a,after.rows.find(b=>b.id===a.id)]).find(x=>x[1]);if(!pair)return;const delta=pair[1].top-pair[0].top;if(Math.abs(delta)>1&&typeof wx.pageScrollTo==='function')wx.pageScrollTo({scrollTop:Math.max(0,after.scrollTop+delta),duration:0})}
module.exports={snapshot,restore};
