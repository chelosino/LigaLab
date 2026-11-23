import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
function crc(bytes) { let n=0xffffffff; for(const b of bytes){n^=b;for(let i=0;i<8;i++)n=(n>>>1)^((n&1)?0xedb88320:0);}return (n^0xffffffff)>>>0; }
function chunk(type,data){const t=Buffer.from(type),size=Buffer.alloc(4),sum=Buffer.alloc(4);size.writeUInt32BE(data.length);sum.writeUInt32BE(crc(Buffer.concat([t,data])));return Buffer.concat([size,t,data,sum]);}
export function icon(size){
 const raw=Buffer.alloc((size*3+1)*size);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const a=x/size,b=y/size;
  const letter=(a>.28&&a<.37&&b>.28&&b<.7)||(a>.28&&a<.62&&b>.61&&b<.7);
  const arrow=(a>.46&&a<.7&&Math.abs(b-(.98-a))<.038)||(a>.62&&a<.7&&b>.28&&b<.48)||(a>.5&&a<.7&&b>.28&&b<.36);
  const c=letter?[245,247,243]:arrow?[205,239,128]:[16,25,21];
  const p=y*(size*3+1)+1+x*3;raw.set(c,p);
 }
 const h=Buffer.alloc(13);h.writeUInt32BE(size);h.writeUInt32BE(size,4);h[8]=8;h[9]=2;
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',h),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);
}
mkdirSync('public/icons',{recursive:true});
for(const [name,size] of [['icon-192',192],['icon-512',512],['maskable-512',512],['apple-touch-icon',180]])writeFileSync(`public/icons/${name}.png`,icon(size));
