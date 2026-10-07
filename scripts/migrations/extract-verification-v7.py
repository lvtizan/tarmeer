#!/usr/bin/env python3
"""Extract the approved portable V7 reference into a DB-owned schema catalogue."""
import sys,json,hashlib
from bs4 import BeautifulSoup
source=open(sys.argv[1],encoding='utf-8').read()
soup=BeautifulSoup(source,'html.parser')
def text(el): return el.get_text(' ',strip=True).replace(' *','').strip() if el else ''
sections=[]
for panel in soup.select('[data-panel]'):
 section={'key':'verification_'+str(int(panel['data-panel'])+1),'title':text(panel.select_one('h1')),'titleEn':text(panel.select_one('h1')),'fields':[]}
 found={}
 for el in panel.select('input,textarea,select'):
  key=el.get('name') or el.get('data-upload')
  if not key: continue
  typ=el.get('type',el.name if el.name!='input' else 'text')
  if key in found:
   if typ in ('radio','checkbox'): found[key]['options'].append(el.get('value',''))
   continue
  legend=el.find_parent('fieldset')
  label=el.find_parent('label')
  row=el.find_parent(attrs={'data-manpower-row':True})
  group=el.find_parent(attrs={'data-specialist-group':True})
  trade=el.find_parent(class_='trade')
  case=el.find_parent(class_='case')
  title=text(legend.find('legend',recursive=False)) if typ in ('radio','checkbox') and legend else text(label.find('span',recursive=False)) if label else ''
  if not title: title=el.get('aria-label') or key
  field={'key':key,'label':title,'labelEn':title,'type':'attachment' if typ=='file' else typ}
  if typ in ('radio','checkbox'): field['options']=[el.get('value','')]
  if el.has_attr('required') or key=='conclusion': field['required']=True
  for attr in ('min','max','step'):
   if el.has_attr(attr): field[attr]=float(el[attr])
  if typ=='number' and not el.has_attr('step'): field['step']=1
  if key=='year': field['yearPolicy']={'min':1900,'maxCurrentYear':True,'timeZone':'Asia/Dubai'}
  if typ=='date': field['datePolicy']={'minYear':1900,'maxYearsFromToday':30 if key=='expiry' else 5 if key=='start' else 0,'timeZone':'Asia/Dubai'}
  if el.has_attr('placeholder'): field['placeholder']=el['placeholder']
  if group: field['group']=text(group.select_one('h3')); field['groupKey']=group['data-specialist-group']
  if trade: field['group']=text(trade.select_one('legend'))
  if case: field['group']=text(case.select_one('h4')) or text(case.select_one('h3'))
  if row and typ=='number':
   check=row.select_one('input[type=checkbox]'); detail=row.select_one('textarea')
   field['visibleWhen']={'field':check['name'],'values':[check['value']]} if check else {'field':detail['name'],'notEmpty':True}
   field['label']=field['labelEn']=el.get('aria-label') or (row.get('data-work-label','Additional Work')+' — Number of Workers')
  if key=='factory': field['exclusiveValue']='None'
  if key.startswith('owner'): field['group']='Owner / Decision-maker'
  if key.startswith('commercial'): field['group']='Commercial Contact'
  if key.startswith('technical'): field['group']='Technical / Site Contact'
  if key=='company': field['role']='company_name'
  if key.startswith('commercial') or key.startswith('technical'):
   suffix=key.removeprefix('commercial').removeprefix('technical'); field['copyFrom']={'Name':'contact','Role':'position','Phone':'phone'}[suffix]
  if key=='otherSpecialization': field['visibleWhen']={'field':'specializations','values':['Other Specialist Works']}
  if key in ('facilityAddress','facilityMap','Workshop / Warehouse Evidence'): field['visibleWhen']={'field':'factory','excludeValues':['None']}
  if typ=='file': field.update({'label':key,'labelEn':key,'accept':'image/jpeg,image/png,image/webp,application/pdf','maxBytes':15*1024*1024})
  found[key]=field; section['fields'].append(field)
 if int(panel['data-panel'])==1:
  section['fields'].append({'key':'areas','role':'service_areas','label':'Service Districts','labelEn':'Service Districts','type':'repeat','maxItems':30,'fields':[{'key':'emirate','label':'Emirate','labelEn':'Emirate','type':'radio','options':['Dubai','Abu Dhabi','Sharjah','Ajman','RAK','Fujairah','Umm Al Quwain']},{'key':'district','label':'District / Community','labelEn':'District / Community','type':'text'}]})
 sections.append(section)
def add_policy(field):
 key=field['key']; typ=field['type']
 simple={'radio':'choice','checkbox':'choices','attachment':'attachment','repeat':'repeat','date':'date','email':'email'}
 kind=simple.get(typ)
 if typ=='number': kind='year' if key=='year' else 'amount' if '(AED)' in field['label'] else 'area' if key.endswith('_area') else 'count'
 if typ=='tel': kind='phone'
 if typ=='url': kind='map'
 if typ in ('text','textarea'):
  kind='website' if key=='website' else 'identifier' if key=='license' else 'address' if key in ('address','facilityAddress') else 'name' if key in ('company','contact','position','ownerName','commercialName','commercialRole','technicalName','technicalRole','inspector') or key.endswith(('_name','_location')) else 'text'
 policy={'kind':kind}
 if kind in ('count','amount','area'):
  precision=2 if kind=='amount' else 3 if kind=='area' else 0
  policy.update({'min':0,'max':1000000000000 if kind=='amount' else 1000000000 if kind=='area' else 100000,'precision':precision,'integer':kind=='count'})
  field['step']=0.01 if kind=='amount' else 0.001 if kind=='area' else 1
 elif kind=='phone': policy.update({'country':'ae','maxLength':40})
 elif kind=='name': policy.update({'minLength':1,'maxLength':200 if key=='company' or key.endswith(('_name','_location')) else 120,'requireLetter':True})
 elif kind=='address': policy.update({'minLength':3,'maxLength':500,'requireLetter':True})
 elif kind=='identifier': policy.update({'minLength':1,'maxLength':100})
 elif kind in ('website','map'):
  policy.update({'maxLength':2000})
  if kind=='website': policy['allowHandle']=True
 elif kind=='email': policy.update({'maxLength':254})
 elif kind=='text':
  work=key.startswith('specialist_') or key=='otherSpecialization' or key.endswith('_work') or key in ('specialty','serviceArea','activities')
  policy.update({'minLength':2 if work else 1,'maxLength':2000 if work or typ=='text' else 10000,'allowNewlines':typ=='textarea'})
  if work: policy['requireLetter']=True
 field['inputPolicy']=policy
 for child in field.get('fields',[]):
  add_policy(child)
  if child['key']=='district': child['inputPolicy']={'kind':'name','minLength':1,'maxLength':200,'requireLetter':True}
for section in sections:
 for field in section['fields']: add_policy(field)
schema={'version':'tarmeer-verification-v7','country':'ae','title':'Contractor Verification','currency':'AED','source_sha256':hashlib.sha256(source.encode()).hexdigest(),'sections':sections,'notice':'Keep company claims separate from verified findings. Completing this form does not assign an A, B or C rating.'}
with open(sys.argv[2],'w',encoding='utf-8') as out: json.dump(schema,out,ensure_ascii=False,indent=2); out.write('\n')
print('Extracted',sum(len(s['fields']) for s in sections),'fields across',len(sections),'steps')
