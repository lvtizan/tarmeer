'use strict';
const fs=require('fs/promises'),path=require('path');
const {parseChunkMeta,CHUNK_BYTES,MAX_CATALOG_BYTES,isPdfBuffer}=require('./catalogValidation');
const {storeCatalogChunk}=require('./catalogChunkSession');
const {withCatalogChunkLock}=require('./catalogChunkLock');
function createAdminCatalogChunkHandler(pool,addCatalog,lockPool=pool) {
 return async(req,res)=>{
  try {
   const meta=parseChunkMeta(req.body),adminId=req.admin.id,supplierId=Number(req.params.id),name=req.body.original_name;
   if(!meta||typeof name!=='string'||name.length>255||!/\.pdf$/i.test(name)||!req.file?.buffer||req.file.size<1||req.file.size>CHUNK_BYTES)return res.status(400).json({error:'Invalid PDF chunk.'});
   await withCatalogChunkLock(lockPool,adminId,async()=>{
    const root=path.resolve(process.cwd(),'private/admin-catalog-chunks',String(adminId),String(supplierId),meta.uploadId);
    const receipt=path.join(root,'completed.json');
    try {const previous=JSON.parse(await fs.readFile(receipt,'utf8'));if(previous.name!==name||previous.total!==meta.total)return res.status(409).json({error:'Upload session changed.'});const [rows]=await pool.execute('SELECT id,title,file_url,file_size,render_status,catalog_visible FROM supplier_catalogs WHERE id=? AND supplier_profile_id=?',[previous.id,supplierId]);if(rows[0])return res.json({done:true,catalog:rows[0]});return res.status(409).json({error:'Previously saved catalog no longer exists.'});}
    catch(error){if(error.code!=='ENOENT')throw error;}
    const stored=await storeCatalogChunk({chunkRoot:root,meta,originalName:name,buffer:req.file.buffer,staleMs:24*60*60*1000});
    if(!stored.assemblingDir)return res.json({done:false});
    try {
    const buffers=[];let bytes=0;
    for(let i=0;i<meta.total;i++){const buffer=await fs.readFile(path.join(stored.assemblingDir,`chunk_${i}`));if(!buffer.length||buffer.length>CHUNK_BYTES)throw Object.assign(Error('Invalid PDF chunk size.'),{statusCode:400});bytes+=buffer.length;if(bytes>MAX_CATALOG_BYTES)throw Object.assign(Error('PDF exceeds the 60 MB limit.'),{statusCode:413});buffers.push(buffer);}
    const buffer=Buffer.concat(buffers);if(!isPdfBuffer(buffer))throw Object.assign(Error('Invalid PDF file.'),{statusCode:400});
    req.file={buffer,size:bytes,mimetype:'application/pdf',originalname:name};req.body.upload_id=meta.uploadId;
    let status=200,payload;
    await addCatalog(req,{status(code){status=code;return this;},json(data){payload=data;}});
    if(payload?.catalog?.id){await fs.writeFile(receipt,JSON.stringify({id:payload.catalog.id,name,total:meta.total}),{mode:0o600});await fs.rm(stored.assemblingDir,{recursive:true,force:true});}
    else await fs.rename(stored.assemblingDir,path.join(root,'active')).catch(()=>{});
    res.status(status).json(payload||{error:'Catalog could not be saved.'});
    }finally{await fs.rename(stored.assemblingDir,path.join(root,'active')).catch(()=>{});}
   },'admin-catalog');
  }catch(error){console.error('Admin PDF chunk failed:',error);res.status(error.statusCode||500).json({error:error.statusCode?error.message:'PDF upload could not finish. Please retry.'});}
 };
}
module.exports={createAdminCatalogChunkHandler};
