const api=require('./cloud'),view=require('./view'),anchor=require('./feed-anchor');
// 保留已访问窗口直到服务端重新核对完成；不清空首屏，也不继续预取未打开的页。
async function load(c,options,refresh=false){
 if(!c.data.authorized||getApp().globalData.denied)return false;
 const revision=api.version(options.area);
 if(c._fetching){if(refresh&&c._fetchVersion!==revision)c._reload=true;return c._fetching}
 if(!refresh&&!c.data.more)return;
 const token=c._token=(c._token||0)+1,owner=api.sessionKey(),auth=getApp().globalData.authRevision||0,filter=c.data.filter;
 const valid=()=>token===c._token&&owner===api.sessionKey()&&auth===(getApp().globalData.authRevision||0)&&c.data.authorized&&!getApp().globalData.denied&&filter===c.data.filter;
 const edit=c._editClock||0,target=refresh?c.data.rows.length:0;
 c._fetchVersion=revision;c.setData({loading:true,refreshing:refresh&&target>0,error:'',...(options.home?{me:require('./profile').current()||{}}:{})});
 const task=(async()=>{try{
  const request=before=>api.call(options.name,{...options.query(c),...(before?{before}:{page:0}),...(options.home?{summary:refresh&&!before}: {})});
  let r=await request(!refresh?c.data.next:null);if(!valid())return false;
  let incoming=r.rows||[],next=r.next||null,pages=1;const stats=r.stats,seenCursors=new Set();
  while(refresh&&incoming.length<target&&next&&!seenCursors.has(next)){
   // 隐藏期间不启动后续分页；未完成的窗口不被误记成新鲜，下次可重查。
   if(c._foreground===false)return false;
   seenCursors.add(next);r=await request(next);if(!valid())return false;
   incoming=incoming.concat(r.rows||[]);next=r.next||null;pages++;
  }
  const base=refresh?[]:c.data.rows,seen=new Set(base.map(x=>x._id));let rows=base.concat(view(incoming.filter(x=>{if(seen.has(x._id))return false;seen.add(x._id);return true})).map(x=>{
   const prev=c.data.rows.find(y=>y._id===x._id);return !options.home&&prev&&((c._likes||{})[x._id]||(c._edited||{})[x._id]>edit)?{...x,liked:prev.liked,likeCount:prev.likeCount}:x;
  }));
  const patch={next,more:!!next};if(!options.home)patch.page=(refresh?0:c.data.page)+pages;if(stats)patch.stats=stats;
  // 相同数据不重发整张列表，保留 record-card 内部展开/测量状态。
  if(JSON.stringify(rows)!==JSON.stringify(c.data.rows))patch.rows=rows;
  const position=refresh&&patch.rows&&target?await anchor.snapshot(c):null;if(!valid())return false;
  if(position){await new Promise(resolve=>c.setData(patch,resolve));if(valid())await anchor.restore(c,position)}else c.setData(patch);c._feedAt=Date.now();c._feedVersion=revision;return true;
 }catch(e){if(valid()){c.setData({error:e.message});api.error(e)}return false}
 finally{if(token===c._token)c.setData({loading:false,refreshing:false})}})();
 c._fetching=task;try{return await task}finally{if(c._fetching===task)c._fetching=null;if(c._reload){c._reload=false;if(c._foreground!==false&&valid())return load(c,options,true)}}
}
module.exports={load};
