const MAX_COMPRESSION_WORKERS = 2;
let active = 0;
/** @type {Array<() => void>} */
const waiting = [];
async function reserve() {
  if (active >= MAX_COMPRESSION_WORKERS) await new Promise(resolve => waiting.push(resolve));
  else active++;
}
function release() { const next = waiting.shift(); if (next) next(); else active--; }

/**
 * A failed/unsupported worker falls back to the existing browser compressor.
 * @param {File} file
 * @param {ReadonlyArray<{maxDimension:number,quality:number}>} attempts
 * @param {number} limit
 * @returns {Promise<Blob|null>}
 */
export async function compressInWorker(file,attempts,limit) {
  if(typeof window==='undefined'||typeof Worker==='undefined'||typeof OffscreenCanvas==='undefined'||typeof createImageBitmap==='undefined')return null;
  await reserve();
  try {
    return await new Promise(resolve => {
      /** @type {Worker|undefined} */
      let worker;
      /** @type {ReturnType<typeof setTimeout>|undefined} */
      let timer;
      let finished=false;
      /** @param {Blob|null} blob */
      const finish=blob=>{if(finished)return;finished=true;if(timer)clearTimeout(timer);worker?.terminate();resolve(blob);};
      try {
        // Same-origin public asset avoids Next 16.2's bundled worker URL regression.
        worker=new Worker('/workers/image-compression-v1.js');
        worker.onmessage=event=>{const blob=event.data?.blob;finish(blob instanceof Blob&&blob.size>0&&['image/jpeg','image/webp'].includes(blob.type)?blob:null);};
        worker.onerror=event=>{event.preventDefault();finish(null);};
        worker.onmessageerror=()=>finish(null);
        timer=setTimeout(()=>finish(null),20_000);
        worker.postMessage({file,attempts,limit});
      }catch{finish(null);}
    });
  }finally{release();}
}
