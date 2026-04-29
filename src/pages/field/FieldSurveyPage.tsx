import { useState, useEffect, useRef, useCallback } from 'react';
import { fieldApi } from '../../lib/adminApi';
import ChipSelect from '../../components/field/ChipSelect';

const SECTIONS = [
  {
    title: 'Section 1: Company Basic Information',
    key: 'section_1',
    fields: [
      { key: 'company_type', label: 'Company Type', type: 'single', options: ['Local', 'Joint Venture', 'Foreign'] },
      { key: 'year_established', label: 'Year Established', type: 'single', options: ['Before 2000', '2000-2010', '2010-2015', '2015-2020', '2020+'] },
      { key: 'registration_location', label: 'Registration Location', type: 'single', options: ['Dubai', 'Abu Dhabi', 'Sharjah', 'Other UAE', 'Outside UAE'] },
      { key: 'company_size', label: 'Company Size', type: 'single', options: ['1-10', '10-30', '30-100', '100+'] },
      { key: 'licenses', label: 'Licenses / Certifications', type: 'multi', options: ['Dubai Municipality', 'DEWA Approved', 'ISO Certified', 'RERA', 'Other'] },
    ],
  },
  {
    title: 'Section 2: Core Business',
    key: 'section_2',
    fields: [
      { key: 'main_business_scope', label: 'Main Business Scope', type: 'multi', options: ['Interior Design', 'Fit-out', 'FF&E', 'MEP', 'Joinery', 'Landscaping'] },
      { key: 'one_stop_service', label: 'One-Stop Service (Design + Build + Materials + Furniture)?', type: 'single', options: ['Yes', 'No', 'Partial'] },
      { key: 'main_client_types', label: 'Main Client Types', type: 'multi', options: ['Residential', 'Commercial', 'Hospitality', 'Retail', 'Government', 'F&B'] },
    ],
  },
  {
    title: 'Section 3: Team Structure',
    key: 'section_3',
    fields: [
      { key: 'total_employees', label: 'Total Employees', type: 'single', options: ['1-10', '11-30', '31-100', '100+'] },
      { key: 'design_team_size', label: 'Design Team Size', type: 'single', options: ['0', '1-3', '4-10', '10+'] },
      { key: 'pm_team_size', label: 'Project Management Team Size', type: 'single', options: ['0', '1-3', '4-10', '10+'] },
      { key: 'construction_team', label: 'Construction Team', type: 'single', options: ['In-house', 'Outsourced', 'Hybrid'] },
      { key: 'management_background', label: 'Management Background', type: 'multi', options: ['UAE Local', 'Arab', 'South Asian', 'Chinese', 'European', 'Mixed'] },
      { key: 'owner_nationality', label: 'Owner / Shareholder Nationality', type: 'multi', options: ['Emirati', 'Arab', 'Indian', 'Pakistani', 'Chinese', 'European', 'Other'] },
    ],
  },
  {
    title: 'Section 4: Projects & Performance',
    key: 'section_4',
    fields: [
      { key: 'projects_last_year', label: 'Projects Completed Last Year', type: 'single', options: ['1-5', '6-20', '21-50', '50+'] },
      { key: 'annual_revenue_aed', label: 'Annual Revenue (AED)', type: 'single', options: ['< 1M', '1-5M', '5-20M', '20-50M', '50M+'] },
      { key: 'typical_contract_value', label: 'Typical Contract Value Range', type: 'single', options: ['< 100K', '100K-500K', '500K-2M', '2M+'] },
      { key: 'main_project_types', label: 'Main Project Types', type: 'multi', options: ['Villa', 'Apartment', 'Office', 'Retail', 'Hotel', 'Restaurant', 'Government'] },
    ],
  },
  {
    title: 'Section 5: Supply Chain',
    key: 'section_5',
    fields: [
      { key: 'main_material_sources', label: 'Main Material Sources', type: 'multi', options: ['China', 'Italy', 'Germany', 'Local UAE', 'India', 'Turkey', 'Mixed'] },
      { key: 'stable_supply_chain', label: 'Stable Supply Chain?', type: 'single', options: ['Yes', 'No', 'Partially'] },
      { key: 'open_to_chinese_supply', label: 'Open to Chinese Material Supply?', type: 'single', options: ['Very Interested', 'Open', 'Neutral', 'Not Interested'] },
    ],
  },
  {
    title: 'Section 6: Strengths & Challenges',
    key: 'section_6',
    fields: [
      { key: 'key_strengths', label: 'Key Strengths', type: 'multi', options: ['Design Capability', 'Speed', 'Price', 'Quality', 'Relationships', 'After-sales'] },
      { key: 'main_challenges', label: 'Main Challenges', type: 'multi', options: ['Material Cost', 'Labour', 'Cash Flow', 'Competition', 'Finding Clients', 'Logistics'] },
    ],
  },
  {
    title: 'Section 7: Cooperation Intent',
    key: 'section_7',
    fields: [
      { key: 'interest_in_chinese_platform', label: 'Interest in Cooperating with Chinese Supply Platform', type: 'single', options: ['Very Interested', 'Interested', 'Maybe', 'Not Interested'] },
      { key: 'support_needed', label: 'Support Needed', type: 'multi', options: ['Sourcing', 'Logistics', 'Quality Control', 'Payment Terms', 'Showroom', 'Training'] },
      { key: 'preferred_cooperation_model', label: 'Preferred Cooperation Model', type: 'single', options: ['Platform Membership', 'Per-project', 'Revenue Share', 'Exclusive Supply'] },
    ],
  },
  {
    title: 'Section 8: Additional Information',
    key: 'section_8',
    fields: [
      { key: 'stable_developer_clients', label: 'Stable Developer / Client Resources?', type: 'single', options: ['Yes', 'No', 'Some'] },
      { key: 'avg_project_duration', label: 'Average Project Duration', type: 'single', options: ['< 1 month', '1-3 months', '3-6 months', '6+ months'] },
      { key: 'client_acquisition_channels', label: 'Client Acquisition Channels', type: 'multi', options: ['Referral', 'Social Media', 'Tenders', 'Direct Sales', 'Repeat Clients', 'Platforms'] },
      { key: 'design_software', label: 'Design Software Used', type: 'multi', options: ['AutoCAD', '3ds Max', 'SketchUp', 'Revit', 'Lumion', 'Other'] },
      { key: 'standardized_quotation', label: 'Standardized Quotation System?', type: 'single', options: ['Yes', 'No', 'In Progress'] },
    ],
  },
  {
    title: 'Section 9: Strategic Questions',
    key: 'section_9',
    fields: [
      { key: 'open_to_material_construction_split', label: 'Open to Material + Construction Separation Model?', type: 'single', options: ['Yes', 'No', 'Need to Discuss'] },
      { key: 'willing_to_share_client_resources', label: 'Willing to Share Client Resources for Joint Projects?', type: 'single', options: ['Yes', 'No', 'Case by Case'] },
      { key: 'concerns_about_chinese_supply', label: 'Main Concerns About Chinese Supply Chain', type: 'multi', options: ['Quality', 'Delivery Time', 'Communication', 'MOQ', 'After-sales', 'None'] },
      { key: 'interested_in_showroom_collab', label: 'Interested in Showroom / Sample Collaboration?', type: 'single', options: ['Very Interested', 'Interested', 'Maybe', 'Not Interested'] },
    ],
  },
];

type SectionData = Record<string, string | string[]>;
type AllSections = { [key: string]: SectionData };

export default function FieldSurveyPage() {
  const [draftId, setDraftId] = useState<number | null>(null);
  const [companyName, setCompanyName] = useState('');
  const [companyRefId, setCompanyRefId] = useState<number | null>(null);
  const [companyRefName, setCompanyRefName] = useState('');
  const [sections, setSections] = useState<AllSections>({});
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'idle'>('idle');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [companySuggestions, setCompanySuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const companySearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const storedId = localStorage.getItem('field_draft_id');
        if (storedId) {
          const { draft } = await fieldApi.getDraft();
          if (draft && draft.id === Number(storedId)) {
            hydrateDraft(draft);
            return;
          }
        }
        const { id } = await fieldApi.createDraft();
        setDraftId(id);
        localStorage.setItem('field_draft_id', String(id));
      } catch (e) {
        console.error('Init error:', e);
      }
    })();
  }, []);

  function hydrateDraft(draft: any) {
    setDraftId(draft.id);
    setCompanyName(draft.company_name || '');
    setCompanyRefId(draft.company_ref_id || null);
    const restored: AllSections = {};
    for (let i = 1; i <= 9; i++) {
      const key = `section_${i}`;
      if (draft[key]) {
        try {
          restored[key] = typeof draft[key] === 'string' ? JSON.parse(draft[key]) : draft[key];
        } catch {
          restored[key] = {};
        }
      }
    }
    setSections(restored);
  }

  const triggerSave = useCallback((
    id: number,
    cName: string,
    cRefId: number | null,
    secs: AllSections
  ) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      setSaveStatus('saving');
      try {
        await fieldApi.saveDraft(id, {
          company_name: cName,
          company_ref_id: cRefId,
          ...Object.fromEntries(Object.entries(secs).map(([k, v]) => [k, v])),
        });
        setSaveStatus('saved');
      } catch {
        setSaveStatus('idle');
      }
    }, 500);
  }, []);

  function updateSection(sectionKey: string, fieldKey: string, value: string | string[]) {
    setSections(prev => {
      const updated = {
        ...prev,
        [sectionKey]: { ...(prev[sectionKey] || {}), [fieldKey]: value },
      };
      if (draftId) triggerSave(draftId, companyName, companyRefId, updated);
      return updated;
    });
  }

  function handleCompanyNameChange(val: string) {
    setCompanyName(val);
    if (draftId) triggerSave(draftId, val, companyRefId, sections);
    if (companySearchTimerRef.current) clearTimeout(companySearchTimerRef.current);
    if (val.length > 1) {
      companySearchTimerRef.current = setTimeout(async () => {
        try {
          const { results } = await fieldApi.searchCompanies(val);
          setCompanySuggestions(results);
          setShowSuggestions(results.length > 0);
        } catch {
          setShowSuggestions(false);
        }
      }, 300);
    } else {
      setShowSuggestions(false);
    }
  }

  function selectCompany(company: any) {
    setCompanyRefId(company.id);
    setCompanyRefName(company.name);
    setCompanyName(company.name);
    setShowSuggestions(false);
    if (draftId) triggerSave(draftId, company.name, company.id, sections);
  }

  async function handleSubmit() {
    if (!draftId) return;
    setIsSubmitting(true);
    try {
      await fieldApi.submit(draftId);
      localStorage.removeItem('field_draft_id');
      setSubmitted(true);
    } catch (e: any) {
      alert(e.message || 'Failed to submit');
    } finally {
      setIsSubmitting(false);
    }
  }

  function startNew() {
    localStorage.removeItem('field_draft_id');
    window.location.reload();
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#faf9f7] flex flex-col items-center justify-center px-6">
        <div className="text-5xl mb-4">✓</div>
        <h1 className="text-xl font-bold text-[#2c2c2c] mb-2">Interview Submitted</h1>
        <p className="text-stone-500 text-[15px] mb-8">Record saved successfully.</p>
        <button onClick={startNew} className="btn-primary w-full max-w-xs">
          Start New Interview
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#faf9f7] pb-24">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-white border-b border-stone-200 px-4 py-3 flex items-center justify-between">
        <span className="font-semibold text-[#2c2c2c] text-[15px]">Interview Survey</span>
        <span className={`text-xs ${saveStatus === 'saving' ? 'text-stone-400' : saveStatus === 'saved' ? 'text-green-600' : 'text-stone-300'}`}>
          {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'saved' ? '✓ Saved' : ''}
        </span>
      </div>

      <div className="px-4 pt-6 space-y-8 max-w-lg mx-auto">
        {/* Company name */}
        <div>
          <label className="block text-sm font-medium text-stone-500 mb-1">Company Name *</label>
          <div className="relative">
            <input
              value={companyName}
              onChange={e => handleCompanyNameChange(e.target.value)}
              placeholder="Enter company name"
              className="w-full h-[50px] px-5 rounded-2xl border border-stone-200 bg-stone-50/80 text-[15px] text-[#1c1917] placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#B8864A]/15 focus:border-[#B8864A] focus:bg-white"
            />
            {showSuggestions && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-stone-200 rounded-2xl shadow-lg z-20 overflow-hidden">
                {companySuggestions.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => selectCompany(c)}
                    className="w-full text-left px-4 py-3 text-[15px] hover:bg-stone-50 border-b border-stone-100 last:border-0"
                  >
                    <span className="font-medium">{c.name}</span>
                    {c.city && <span className="text-stone-400 ml-2 text-sm">{c.city}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
          {companyRefName && companyRefId && (
            <p className="text-xs text-green-600 mt-1">✓ Linked to existing company record</p>
          )}
        </div>

        {/* All 9 sections */}
        {SECTIONS.map(section => (
          <div key={section.key}>
            <h2 className="text-base font-bold text-[#2c2c2c] mb-4 pl-3 border-l-4 border-[#b8864a]">
              {section.title}
            </h2>
            <div className="space-y-5">
              {section.fields.map(field => {
                const sectionData = sections[section.key] || {};
                const val = sectionData[field.key] ?? (field.type === 'multi' ? [] : '');
                return (
                  <div key={field.key}>
                    <label className="block text-sm font-medium text-stone-500 mb-2">{field.label}</label>
                    <ChipSelect
                      options={field.options}
                      value={val}
                      multi={field.type === 'multi'}
                      onChange={v => updateSection(section.key, field.key, v)}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Sticky submit */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-stone-200 px-4 py-3">
        <button
          onClick={handleSubmit}
          disabled={isSubmitting || !companyName}
          className="btn-primary w-full disabled:opacity-50"
        >
          {isSubmitting ? 'Submitting…' : 'Submit Interview'}
        </button>
      </div>
    </div>
  );
}
