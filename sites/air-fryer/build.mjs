import {cp,mkdir,rm} from 'node:fs/promises';
await rm(new URL('./public/',import.meta.url),{recursive:true,force:true});
await mkdir(new URL('./public/',import.meta.url),{recursive:true});
for(const item of ['index.html','styles.css','script.js','analytics.js','privacidade.html','admin','assets']) await cp(new URL(item,import.meta.url),new URL('public/'+item,import.meta.url),{recursive:true});
