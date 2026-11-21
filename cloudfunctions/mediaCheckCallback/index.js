const cloud=require('wx-server-sdk');const handler=require('./service').create(cloud);
exports.main=async event=>{const result=await handler('mediaCheckCallback',event);return {statusCode:result?.error?403:200,headers:{'Content-Type':'text/plain; charset=utf-8'},body:result?.error?'callback rejected':result,isBase64Encoded:false}};
