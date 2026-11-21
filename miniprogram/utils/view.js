const D=require('./date');
// Display-only fields: dateLabel for cards, tagList so mood tags render as chips whether stored as array or string.
function tagList(v){return Array.isArray(v)?v.filter(Boolean):(v?[v]:[])}
// thumbs: up to 3 displayable https URLs (own rows carry imageURLs; plaza rows carry images as URLs; legacy rows a single image).
function thumbs(r){const a=Array.isArray(r.imageURLs)&&r.imageURLs.length?r.imageURLs:Array.isArray(r.images)?r.images:(r.imageURL?[r.imageURL]:r.image?[r.image]:[]);return a.filter(u=>typeof u==='string'&&/^https?:\/\//.test(u)).slice(0,3)}
module.exports=rows=>rows.map(r=>({...r,dateLabel:D.key(r.createdAt),tagList:tagList(r.moodTags),thumbs:thumbs(r)}));
module.exports.thumbs=thumbs;
