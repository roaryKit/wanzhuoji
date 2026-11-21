// Pure client helpers; drafts are in-memory and scoped to a page/session, never global storage.
function clientId(){return Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,14)}
function textRow(row){
 const hasMedia=['imageURL','fileID','fileId','image','images','attachment','attachments','media','file','files'].some(k=>Array.isArray(row[k])?row[k].length>0:!!row[k])||['type','kind','messageType'].some(k=>row[k]!=null&&row[k]!=='text')||!!(row.packet&&row.packet.attachment)||!!(row.snapshot&&row.snapshot.attachment);
 const {imageURL,fileID,fileId,image,images,attachment,attachments,media,file,files,...safe}=row;
 if(hasMedia||row.unsupported)return {id:row.id,orderKey:row.orderKey,createdAt:row.createdAt,version:row.version,deleted:true,unsupported:true,text:'',author:null,quote:null};
 if(safe.quote){const q=safe.quote;if(q.imageURL||q.fileID||q.attachment)safe.quote={id:q.id,deleted:true,text:'原消息已删除或不可见'};else safe.quote={id:q.id,name:q.name,text:q.text,deleted:q.deleted};}
 return safe;
}
function merge(old,rows){old=old.map(textRow);rows=rows.map(textRow);const M=new Map(old.map(x=>[x.id,x]));for(const row of rows){const prior=M.get(row.id);if(!prior||(row.version||0)>=(prior.version||0))M.set(row.id,{...prior,...row,...(row.deleted?{text:'',quote:null,author:null}:{}),local:false,failed:false})}const gone=new Set([...M.values()].filter(r=>r.deleted).map(r=>r.id));for(const [id,r]of M)if(r.quote&&gone.has(r.quote.id))M.set(id,{...r,quote:{id:r.quote.id,deleted:true,text:'原消息已删除或不可见'}});const confirmed=new Set(rows.map(r=>r.clientId).filter(Boolean));return [...M.values()].filter(r=>!r.local||!confirmed.has(r.clientId)).sort((a,b)=>a.orderKey<b.orderKey?-1:a.orderKey>b.orderKey?1:0)}
function seats(members=[],count=members.length,capacity=8){capacity=Number.isInteger(capacity)&&capacity>=5&&capacity<=8?capacity:8;return Array.from({length:capacity},(_,i)=>{const p=members[i],rad=(-90+360/capacity*i)*Math.PI/180;return {...p,key:i,empty:i>=count,anonymous:!p&&i<count,x:135+62*Math.cos(rad)-13,y:99+62*Math.sin(rad)-13,nx:135+92*Math.cos(rad),ny:99+92*Math.sin(rad),tx:50+36*Math.cos(rad),ty:50+36*Math.sin(rad),cx:(135+62*Math.cos(rad))/270*100,cy:(99+62*Math.sin(rad))/198*100}})}
class Gesture{
 constructor(){this.reset()}
 reset(y){this.y=y;this.sum=0;this.reverse=0}
 move(y,collapsed,keyboard){if(this.y==null){this.reset(y);return null}const d=this.y-y;this.y=y;if(keyboard||Math.abs(d)<2)return null;if(d*this.sum<0){this.reverse+=Math.abs(d);if(this.reverse<12)return null;this.sum=0;this.reverse=0}else this.reverse=0;this.sum+=d;if(!collapsed&&this.sum>=36){this.sum=0;return true}if(collapsed&&this.sum<=-52){this.sum=0;return false}return null}
}
class Poller{
 constructor(fetch,onData,onError,{wait=setTimeout,cancel=clearTimeout}={}){Object.assign(this,{fetch,onData,onError,wait,cancel});this.generation=0;this.active=false;this.pending=null;this.delay=2500}
 start(){if(this.active)return;this.active=true;this.generation++;this.delay=2500;this.tick()}
 stop(){this.active=false;this.generation++;if(this.timer)this.cancel(this.timer);this.timer=null}
 async tick(){const g=this.generation;if(!this.active)return;if(this.pending){this.timer=this.wait(()=>this.tick(),250);return}const p=this.pending=Promise.resolve().then(()=>this.fetch());let fast=false;try{const r=await p;if(!this.active||g!==this.generation)return;this.delay=2500;this.onData(r);fast=!!r.more}catch(e){if(!this.active||g!==this.generation)return;this.delay=Math.min(30000,this.delay*2);this.onError(e)}finally{if(this.pending===p)this.pending=null;if(this.active&&g===this.generation)this.timer=this.wait(()=>this.tick(),fast?50:this.delay)}}
}
module.exports={clientId,textRow,merge,seats,Gesture,Poller};
