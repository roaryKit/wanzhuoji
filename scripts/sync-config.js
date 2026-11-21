const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),config=require('../miniprogram/utils/config');
if(!config.envId||!config.appid)throw Error('配置缺失');
// 云调用权限：submitRecord 调用 security.msgSecCheck / security.mediaCheckAsync，未声明则云调用被拒（-604101）。六函数共用同一份配置。
const functionConfig=Object.assign({},config,{permissions:{openapi:['security.msgSecCheck','security.mediaCheckAsync']}});
const rc=JSON.parse(fs.readFileSync(path.join(root,'cloudbaserc.json')));rc.envId=config.envId;
const outputs=[['cloudbaserc.json',JSON.stringify(rc,null,2)+'\n'],...rc.functions.map(f=>['cloudfunctions/'+f.name+'/config.json',JSON.stringify(functionConfig,null,2)+'\n'])];
for(const [file,value]of outputs){const dest=path.join(root,file);if(process.argv.includes('--check')){if(!fs.existsSync(dest)||fs.readFileSync(dest,'utf8')!==value)throw Error('配置漂移：'+file)}else fs.writeFileSync(dest,value)}
console.log(config.envId.startsWith('YOUR_')?'占位配置一致（仅离线；不是可部署配置）':'配置一致');
