// 统一输出 JPEG，避免 PNG 不支持有损压缩或服务端误判格式。
async function compress(page,path){
 const info=await wx.getImageInfo({src:path});
 const scale=Math.min(1,1080/Math.max(info.width,info.height));
 const width=Math.max(1,Math.round(info.width*scale)),height=Math.max(1,Math.round(info.height*scale));
 const result=await new Promise(resolve=>page.createSelectorQuery().select('#image-compress').fields({node:true}).exec(r=>resolve(r[0])));
 if(!(result&&result.node))throw Error('图片处理初始化失败');
 const canvas=result.node;canvas.width=width;canvas.height=height;
 const image=canvas.createImage();await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(Error('图片读取失败'));image.src=path});
 const ctx=canvas.getContext('2d');ctx.fillStyle='#ffffff';ctx.fillRect(0,0,width,height);ctx.drawImage(image,0,0,width,height);
 const out=await wx.canvasToTempFilePath({canvas,width,height,destWidth:width,destHeight:height,fileType:'jpg',quality:0.8},page);
 return out.tempFilePath;
}
module.exports={compress};
