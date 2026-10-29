/** Keep a small preparation lead while network requests occupy the upload slots. */
export function createUploadPreparation<T,R>(files:readonly T[],prepare:(file:T)=>Promise<R>,capacity:number) {
 type Result={ok:true;value:R}|{ok:false;error:unknown};
 const jobs=new Map<number,Promise<Result>>(),queued:Array<()=>void>=[];
 let next=0,stopped=false,active=0;
 // This bound also covers browsers falling back to main-thread compression.
 const pump=()=>{while(!stopped&&active<2&&queued.length){active++;queued.shift()!();}};
 const fill=()=>{
  while(!stopped&&jobs.size<capacity&&next<files.length){
   const index=next++;
   jobs.set(index,new Promise<Result>(resolve=>queued.push(()=>{
    void Promise.resolve().then(()=>prepare(files[index])).then(value=>resolve({ok:true,value}),error=>resolve({ok:false,error})).finally(()=>{active--;pump();});
   })));
  }
  pump();
 };
 fill();
 return {
  async take(index:number):Promise<R>{const job=jobs.get(index);if(!job)throw Error('Upload preparation stopped.');const result=await job;jobs.delete(index);fill();if(!result.ok)throw result.error;return result.value;},
  stop(){stopped=true;queued.length=0;jobs.clear();},
 };
}

export function imageUploadConcurrency(profile:string,connection?:{saveData?:boolean;effectiveType?:string},cores=4) {
 if(connection?.saveData||['slow-2g','2g'].includes(connection?.effectiveType||''))return 2;
 return profile==='product'&&cores>=4?4:3;
}
