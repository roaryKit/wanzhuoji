// Short-lived, in-memory apply diagnostics: never store identities, notes or tokens.
const api=require('./cloud');
let sequence=0;
const toast=title=>wx.showToast({title,icon:'none',duration:3500});
function trace(){return Date.now().toString(36)+'-'+(++sequence).toString(36)}
function submit(data,ms=12000){let timer;const request=api.call('roundtable',{action:'apply',...data});return Promise.race([request,new Promise((_,reject)=>{timer=setTimeout(()=>{const e=Error('申请确认超时，请重试核实；重复申请不会重复创建');e.code='APPLY_TIMEOUT';reject(e)},ms)})]).finally(()=>clearTimeout(timer))}
function problem(e,id){const code=['NETWORK','IDENTITY','PERMISSION','CONFIG','DATABASE','DEPLOYMENT','RESPONSE','RUNTIME','CALL','SERVER','APPLY_TIMEOUT'].includes(e&&e.code)?e.code:'UNKNOWN';return (e&&e.code==='SERVER'&&/^[\u4e00-\u9fa5\d，。、；：！？（）]{2,40}$/.test(e.message)?e.message:e&&e.code==='APPLY_TIMEOUT'?e.message:'申请未确认，请重试；如仍失败请反馈此编号')+' · '+code+' · '+id}
module.exports={submit,toast,trace,problem};
