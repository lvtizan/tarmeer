/** One writer per form. Edits made while a request is pending are saved next. */
export function createDraftQueue<T>(write:(value:T)=>Promise<void>) {
 let pending:T|undefined, running:Promise<void>|null=null;
 async function drain(){while(pending!==undefined){const value=pending;pending=undefined;try{await write(value);}catch(error){if(pending===undefined)pending=value;throw error;}}}
 function flush():Promise<void>{if(!running)running=drain().finally(()=>{running=null;});return running;}
 return {enqueue(value:T){pending=value;},flush,hasPending:()=>pending!==undefined};
}

export function draftFingerprint(value:unknown):string{return JSON.stringify(value,(_key,next)=>next&&typeof next==='object'&&!Array.isArray(next)?Object.fromEntries(Object.keys(next).sort().map(key=>[key,next[key]])):next);}
