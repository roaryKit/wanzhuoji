// 微信官方消息推送安全模式(JSON)。协议来源与部署约定见 docs/callback.md。
// 仅 node:crypto；不接受明文、客户端声明的 source 或伪造云事件类型。
const crypto=require('node:crypto');
const deny=()=>{throw Error('可信图片回调校验失败或服务端配置缺失')};
function digest(parts){return crypto.createHash('sha1').update(parts.sort().join('')).digest('hex')}
function same(a,b){return typeof a==='string'&&/^[a-f0-9]{40}$/.test(a)&&crypto.timingSafeEqual(Buffer.from(a),Buffer.from(b))}
function verify(e,env,config,now=Date.now()){
 const token=env.WZJ_CALLBACK_TOKEN,keyText=env.WZJ_CALLBACK_AES_KEY;
 if(env.WZJ_CALLBACK_MODE!=='wechat-aes-json'||!token||!keyText||!/^[A-Za-z0-9+/]{43}$/.test(keyText))deny();
 const key=Buffer.from(keyText+'=','base64');if(key.length!==32)deny();
 const q=e?.queryStringParameters;
 if(!q||typeof q.timestamp!=='string'||!/^\d{10}$/.test(q.timestamp)||Math.abs(now/1000-Number(q.timestamp))>600||typeof q.nonce!=='string'||q.nonce.length<1||q.nonce.length>128)deny();
 if(e.httpMethod==='GET'){
  if(typeof q.echostr!=='string'||q.echostr.length>1024||!same(q.signature,digest([token,q.timestamp,q.nonce])))deny();
  return {echo:q.echostr}; // URL验证不写数据库，按小程序官方GET协议返回明文echostr。
 }
 if(e.httpMethod!=='POST'||q.encrypt_type!=='aes'||typeof e.body!=='string'||e.body.length>131072)deny();
 let body;
 try{body=JSON.parse(e.isBase64Encoded?Buffer.from(e.body,'base64').toString('utf8'):e.body)}catch(_){deny()}
 const ciphertext=body?.Encrypt;
 if(typeof ciphertext!=='string'||!ciphertext.length||ciphertext.length%4||!/^[A-Za-z0-9+/]+={0,2}$/.test(ciphertext)||!same(q.msg_signature,digest([token,q.timestamp,q.nonce,ciphertext])))deny();
 let plain;
 try{
  const bytes=Buffer.from(ciphertext,'base64');if(bytes.length%16)deny();
  const decipher=crypto.createDecipheriv('aes-256-cbc',key,key.subarray(0,16));decipher.setAutoPadding(false);
  const padded=Buffer.concat([decipher.update(bytes),decipher.final()]);const n=padded[padded.length-1];
  if(n<1||n>32||padded.length<32||!padded.subarray(-n).every(v=>v===n))deny();
  plain=padded.subarray(0,-n);if(plain.length<20)deny();
  const len=plain.readUInt32BE(16);if(len>plain.length-20||plain.subarray(20+len).toString('utf8')!==config.appid)deny();
  plain=JSON.parse(plain.subarray(20,20+len).toString('utf8'));
 }catch(_){deny()}
 if(plain.appid!==config.appid||plain.MsgType!=='event'||plain.Event!=='wxa_media_check'||plain.version!==2||typeof plain.trace_id!=='string'||!plain.trace_id||plain.trace_id.length>256||!Number.isInteger(plain.errcode))deny();
 if(plain.errcode===0&&!['pass','review','risky'].includes(plain.result?.suggest))deny();
 return {message:plain};
}
module.exports={verify};
