'use strict';
// A confirmed create and its receipt commit together. Lost responses can be retried safely.
function createSupplierSubmissionHandler(pool,handler,updateHandler) {
 return async(req,res)=>{
  if(req.body.draft_id===undefined)return handler(req,res);
  if(typeof req.body.draft_id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(req.body.draft_id))return res.status(400).json({error:'Invalid draft submission ID.'});
  const originalProjectId=req.params.projectId;
  const connection=await pool.getConnection();
  try{
   await connection.beginTransaction();
   const args=[req.admin.id,Number(req.params.id),'project-new',req.body.draft_id];
   const [receipts]=await connection.execute('SELECT response FROM admin_supplier_submissions WHERE admin_id=? AND supplier_id=? AND scope=? AND request_id=?',args);
   let status=200,payload;
   req.supplierWriteConnection=connection;
   let action=handler;
   if(receipts[0]){
    const previous=typeof receipts[0].response==='string'?JSON.parse(receipts[0].response):receipts[0].response;
    if(!updateHandler||!Number.isSafeInteger(previous?.project?.id))throw Error('Saved project receipt cannot be recovered.');
    req.params.projectId=String(previous.project.id);action=updateHandler;
   }
   await action(req,{status(code){status=code;return this;},json(data){payload=data;return this;}});
   if(status<400&&payload?.project?.id){
    if(receipts[0])await connection.execute('UPDATE admin_supplier_submissions SET response=? WHERE admin_id=? AND supplier_id=? AND scope=? AND request_id=?',[JSON.stringify(payload),...args]);
    else await connection.execute('INSERT INTO admin_supplier_submissions(admin_id,supplier_id,scope,request_id,response) VALUES(?,?,?,?,?)',[...args,JSON.stringify(payload)]);
    await connection.commit();
   }else await connection.rollback();
   return res.status(status).json(payload||{error:'Project could not be saved.'});
  }catch(error){await connection.rollback().catch(()=>{});console.error('Supplier submission failed:',error);return res.status(500).json({error:'Project save failed. Your draft can be retried.'});}
  finally{req.params.projectId=originalProjectId;delete req.supplierWriteConnection;connection.release();}
 };
}
module.exports={createSupplierSubmissionHandler};
