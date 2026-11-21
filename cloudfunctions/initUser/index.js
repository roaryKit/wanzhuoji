const cloud=require('wx-server-sdk');const handler=require('./service').create(cloud);exports.main=event=>handler('initUser',event);
