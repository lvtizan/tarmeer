'use strict';
const record=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
const strings=value=>Array.isArray(value)&&value.every(item=>typeof item==='string');
function fields(value,stringKeys,boolKeys=[]){return record(value)&&stringKeys.every(key=>value[key]===undefined||typeof value[key]==='string')&&boolKeys.every(key=>value[key]===undefined||typeof value[key]==='boolean');}
function extras(value){return value===undefined||record(value)&&
 (value.specs===undefined||Array.isArray(value.specs)&&value.specs.every(row=>record(row)&&typeof row.label==='string'&&typeof row.value==='string'))&&
 (value.certifications===undefined||strings(value.certifications))&&
 (value.application_scenes===undefined||strings(value.application_scenes))&&
 (value.certificationInput===undefined||typeof value.certificationInput==='string');}
function validDraftShape(scope,data){
 if(data.images!==undefined&&!strings(data.images))return false;
 const productKeys=['title','titleEn','category','description','price','priceMax','priceUnit','priceCurrency'];
 if(scope==='product-new')return (data.product===undefined||fields(data.product,['title','title_translated','category','price','price_max','price_unit','price_currency'],['price_from']))&&extras(data.extras);
 if(/^product-\d+$/.test(scope)||scope==='quick-product-new')return fields(data,[...productKeys,'imageUrl'],['priceFrom'])&&extras(data.extras);
 if(scope.startsWith('project'))return fields(data,['title','description','location','area_sqm','budget','year','draft_id']);
 if(scope==='supplier-edit')return ['company_name','description','origin','store_address','google_maps_url','contact_phone','whatsapp','website','status','country'].every(key=>data[key]===undefined||data[key]===null||typeof data[key]==='string')&&(data.categories===undefined||strings(data.categories));
 return false;
}
module.exports={validDraftShape};
