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
schema={'version':'tarmeer-verification-v7','country':'ae','title':'Contractor Verification','currency':'AED','source_sha256':hashlib.sha256(source.encode()).hexdigest(),'sections':sections,'notice':'Keep company claims separate from verified findings. Completing this form does not assign an A, B or C rating.'}
with open(sys.argv[2],'w',encoding='utf-8') as out: json.dump(schema,out,ensure_ascii=False,indent=2); out.write('\n')
print('Extracted',sum(len(s['fields']) for s in sections),'fields across',len(sections),'steps')
