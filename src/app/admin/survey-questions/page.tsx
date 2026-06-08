'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { adminApi } from '@/lib/adminApi';
import { showToast } from '@/components/ui/Toast';
import { showConfirm } from '@/components/ui/ConfirmModal';
import { Save } from 'lucide-react';

interface SurveyField {
  key: string;
  label: string;
  type: 'single' | 'multi';
  options: string[];
}

interface SurveySection {
  title: string;
  key: string;
  fields: SurveyField[];
}

const inputCls = 'h-[34px] px-3 rounded-xl border border-stone-200 bg-stone-50/80 text-[13px] text-[#1c1917] placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#B8864A]/15 focus:border-[#B8864A] focus:bg-white';
const btnAddCls = 'btn-primary inline-flex items-center justify-center h-[34px] px-4 text-sm disabled:opacity-40';

function AddRow({ value, onChange, onAdd, placeholder, inputCls: cls = 'flex-1' }: {
  value: string; onChange: (v: string) => void; onAdd: () => void;
  placeholder?: string; inputCls?: string;
}) {
  return (
    <>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') onAdd(); }}
        placeholder={placeholder}
        className={`${inputCls} ${cls}`}
      />
      <button onClick={onAdd} disabled={!value.trim()} className={btnAddCls}>添加</button>
    </>
  );
}

function genKey(prefix: string, existing: string[]): string {
  let i = existing.length + 1;
  while (existing.includes(`${prefix}_${i}`)) i++;
  return `${prefix}_${i}`;
}

function FieldRow({
  field, idx, sectionKey, dragging, over,
  onDragStart, onDragEnter, onDragEnd,
  onChange, onDelete,
}: {
  field: SurveyField; idx: number; sectionKey: string; dragging: boolean; over: boolean;
  onDragStart: () => void; onDragEnter: () => void; onDragEnd: () => void;
  onChange: (updated: SurveyField) => void; onDelete: () => void;
}) {
  const [optInput, setOptInput] = useState('');

  function addOption() {
    const v = optInput.trim();
    if (!v || field.options.includes(v)) return;
    onChange({ ...field, options: [...field.options, v] });
    setOptInput('');
  }

  function removeOption(opt: string) {
    onChange({ ...field, options: field.options.filter((o) => o !== opt) });
  }

  function toggleType() {
    onChange({ ...field, type: field.type === 'single' ? 'multi' : 'single' });
  }

  return (
    <div
      draggable
      onDragStart={onDragStart} onDragEnter={onDragEnter} onDragEnd={onDragEnd}
      onDragOver={(e) => e.preventDefault()}
      className={`rounded-xl border transition-colors select-none ${dragging ? 'opacity-40' : ''} ${over ? 'border-[#B8864A]/40 bg-amber-50' : 'border-stone-200 bg-white hover:border-stone-300'}`}
    >
      {/* Header row */}
      <div className="flex items-center gap-2 px-3 py-2">
        <span className="cursor-grab text-stone-300 hover:text-stone-400 text-[18px] leading-none shrink-0" title="拖动排序">⠿</span>
        <span className="text-xs text-stone-300 w-4 shrink-0">{idx + 1}</span>
        <input
          className={`${inputCls} flex-1 min-w-0`}
          defaultValue={field.label}
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (v && v !== field.label) onChange({ ...field, label: v });
          }}
          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
        />
        <button
          onClick={toggleType}
          className={`shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-full transition-colors ${field.type === 'single' ? 'bg-blue-50 text-blue-600 hover:bg-blue-100' : 'bg-purple-50 text-purple-600 hover:bg-purple-100'}`}
        >
          {field.type === 'single' ? '单选' : '多选'}
        </button>
        <button onClick={onDelete} className="shrink-0 text-xs text-red-400 hover:text-red-600 transition-colors">删除</button>
      </div>
      {/* Options row */}
      <div className="flex flex-wrap items-center gap-1.5 px-4 pb-2.5 pl-11">
        {field.options.map((opt) => (
          <span key={opt} className="inline-flex items-center gap-1 text-[12px] bg-stone-100 text-stone-600 rounded-full px-2.5 py-0.5">
            {opt}
            <button onClick={() => removeOption(opt)} className="text-stone-400 hover:text-red-500 transition-colors leading-none">×</button>
          </span>
        ))}
        <input
          value={optInput}
          onChange={(e) => setOptInput(e.target.value)}
          onBlur={addOption}
          onKeyDown={(e) => { if (e.key === 'Enter') addOption(); }}
          placeholder="+ 选项"
          className="h-[26px] px-2.5 rounded-full border border-dashed border-stone-300 bg-transparent text-[12px] text-stone-500 placeholder:text-stone-400 focus:outline-none focus:border-[#B8864A] focus:text-stone-700 w-24"
        />
      </div>
    </div>
  );
}

export default function SurveyQuestionsPage() {
  const [sections, setSections] = useState<SurveySection[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [qaQuestions, setQaQuestions] = useState<{ id: number; question_text: string; is_active: number }[]>([]);
  const [qaLoading, setQaLoading] = useState(false);
  const [newQaText, setNewQaText] = useState('');

  // Section drag
  const secDragIdx = useRef(-1);
  const secOverIdx = useRef(-1);
  const [secDragging, setSecDragging] = useState(-1);
  const [secOver, setSecOver] = useState(-1);

  // Field drag (within selected section)
  const fldDragIdx = useRef(-1);
  const fldOverIdx = useRef(-1);
  const [fldDragging, setFldDragging] = useState(-1);
  const [fldOver, setFldOver] = useState(-1);

  // Adding new section
  const [addingSection, setAddingSection] = useState(false);
  const [newSectionTitle, setNewSectionTitle] = useState('');
  const newSecRef = useRef<HTMLInputElement>(null);

  // Adding new field
  const [newFieldLabel, setNewFieldLabel] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminApi.request('/survey-schema');
      const schema: SurveySection[] = data.schema || [];
      setSections(schema);
      if (schema.length > 0) setSelectedKey(schema[0].key);
    } catch {
      showToast('加载问卷结构失败', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadQaQuestions = useCallback(async () => {
    setQaLoading(true);
    try {
      const data = await adminApi.request('/survey-questions?active=false');
      setQaQuestions(data.questions || []);
    } catch {
      showToast('加载 Q&A 问题失败', 'error');
    } finally {
      setQaLoading(false);
    }
  }, []);

  useEffect(() => { load(); loadQaQuestions(); }, [load, loadQaQuestions]);

  async function handleAddQa() {
    const text = newQaText.trim();
    if (!text) return;
    try {
      const q = await adminApi.request('/survey-questions', { method: 'POST', body: JSON.stringify({ question_text: text }) });
      setQaQuestions(prev => [...prev, q]);
      setNewQaText('');
      showToast('已添加', 'success');
    } catch {
      showToast('添加失败', 'error');
    }
  }

  async function handleToggleQa(id: number, active: boolean) {
    try {
      await adminApi.request(`/survey-questions/${id}`, { method: 'PATCH', body: JSON.stringify({ is_active: active }) });
      setQaQuestions(prev => prev.map(q => q.id === id ? { ...q, is_active: active ? 1 : 0 } : q));
    } catch {
      showToast('操作失败', 'error');
    }
  }

  async function handleDeleteQa(id: number) {
    showConfirm({
      title: '删除问题',
      message: '删除后该问题不再出现在问卷中，已填写的历史答案仍保留。',
      confirmLabel: '确认删除',
      onConfirm: async () => {
        try {
          await adminApi.request(`/survey-questions/${id}`, { method: 'DELETE' });
          setQaQuestions(prev => prev.filter(q => q.id !== id));
          showToast('已删除', 'success');
        } catch {
          showToast('删除失败', 'error');
        }
      },
    });
  }

  async function save() {
    setSaving(true);
    try {
      await adminApi.request('/survey-schema', { method: 'PUT', body: JSON.stringify({ schema: sections }) });
      showToast('已保存', 'success');
      setIsDirty(false);
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : '保存失败', 'error');
    } finally {
      setSaving(false);
    }
  }

  function mutate(updater: (prev: SurveySection[]) => SurveySection[]) {
    setSections((prev) => updater(prev));
    setIsDirty(true);
  }

  const selectedSection = sections.find((s) => s.key === selectedKey) ?? null;

  // ---- Section ops ----
  function handleSecDragStart(idx: number) { secDragIdx.current = idx; setSecDragging(idx); }
  function handleSecDragEnter(idx: number) { secOverIdx.current = idx; setSecOver(idx); }
  function handleSecDragEnd() {
    const from = secDragIdx.current; const to = secOverIdx.current;
    setSecDragging(-1); setSecOver(-1); secDragIdx.current = -1; secOverIdx.current = -1;
    if (from === to || from < 0 || to < 0) return;
    mutate((prev) => {
      const arr = [...prev]; const [moved] = arr.splice(from, 1); arr.splice(to, 0, moved); return arr;
    });
  }

  function renameSection(key: string, title: string) {
    if (!title.trim()) return;
    mutate((prev) => prev.map((s) => s.key === key ? { ...s, title: title.trim() } : s));
  }

  function deleteSection(key: string) {
    showConfirm({
      title: '删除整个节',
      message: '该节下的所有问题将一并删除，操作不可撤销。',
      requireText: '确认删除整节',
      confirmLabel: '确认删除',
      onConfirm: () => {
        mutate((prev) => {
          const next = prev.filter((s) => s.key !== key);
          if (selectedKey === key) setSelectedKey(next[0]?.key ?? null);
          return next;
        });
      },
    });
  }

  function addSection() {
    const title = newSectionTitle.trim();
    if (!title) { setAddingSection(false); return; }
    const key = genKey('section', sections.map((s) => s.key));
    const newSec: SurveySection = { title, key, fields: [] };
    mutate((prev) => [...prev, newSec]);
    setSelectedKey(key);
    setAddingSection(false);
    setNewSectionTitle('');
  }

  // ---- Field ops ----
  function handleFldDragStart(idx: number) { fldDragIdx.current = idx; setFldDragging(idx); }
  function handleFldDragEnter(idx: number) { fldOverIdx.current = idx; setFldOver(idx); }
  function handleFldDragEnd() {
    const from = fldDragIdx.current; const to = fldOverIdx.current;
    setFldDragging(-1); setFldOver(-1); fldDragIdx.current = -1; fldOverIdx.current = -1;
    if (!selectedKey || from === to || from < 0 || to < 0) return;
    mutate((prev) => prev.map((s) => {
      if (s.key !== selectedKey) return s;
      const arr = [...s.fields]; const [moved] = arr.splice(from, 1); arr.splice(to, 0, moved);
      return { ...s, fields: arr };
    }));
  }

  function updateField(fieldKey: string, updated: SurveyField) {
    if (!selectedKey) return;
    mutate((prev) => prev.map((s) => {
      if (s.key !== selectedKey) return s;
      return { ...s, fields: s.fields.map((f) => f.key === fieldKey ? updated : f) };
    }));
  }

  function deleteField(fieldKey: string) {
    if (!selectedKey) return;
    mutate((prev) => prev.map((s) => {
      if (s.key !== selectedKey) return s;
      return { ...s, fields: s.fields.filter((f) => f.key !== fieldKey) };
    }));
  }

  function addField() {
    const label = newFieldLabel.trim();
    if (!label || !selectedKey) return;
    const existingKeys = sections.find((s) => s.key === selectedKey)?.fields.map((f) => f.key) ?? [];
    const key = genKey('field', existingKeys);
    const newField: SurveyField = { key, label, type: 'single', options: [] };
    mutate((prev) => prev.map((s) => {
      if (s.key !== selectedKey) return s;
      return { ...s, fields: [...s.fields, newField] };
    }));
    setNewFieldLabel('');
  }

  if (loading) return <div className="p-8 text-center text-stone-400 text-sm">加载中…</div>;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-xl font-bold text-[#2c2c2c]">访谈问卷编辑</h1>
        <button
          onClick={save}
          disabled={!isDirty || saving}
          className={`inline-flex items-center gap-1.5 h-9 px-4 rounded-xl text-sm font-medium transition-colors ${isDirty ? 'bg-[#B8864A] text-white hover:bg-[#a07040]' : 'bg-stone-100 text-stone-400 cursor-default'} disabled:opacity-50`}
        >
          <Save className="w-3.5 h-3.5" />
          {saving ? '保存中…' : isDirty ? '保存更改' : '已保存'}
        </button>
      </div>
      <p className="text-sm text-stone-500 mb-5">左侧管理节（大类），右侧管理节内的问题。修改后点「保存更改」生效，外勤 App 实时同步。</p>

      <div className="flex gap-4 items-start">
        {/* Left panel: sections */}
        <div className="w-[360px] shrink-0 bg-white rounded-2xl border border-stone-200 overflow-hidden">
          <div className="px-3 pt-3 pb-1 flex items-center justify-between">
            <p className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider">节（拖动排序）</p>
            <button
              onClick={() => { setAddingSection(true); setNewSectionTitle(''); setTimeout(() => newSecRef.current?.focus(), 50); }}
              className="text-xs text-[#b8864a] hover:text-[#a07040] font-medium transition-colors"
            >
              + 新增节
            </button>
          </div>
          <div className="p-2 space-y-0.5">
            {sections.map((sec, idx) => {
              const isSelected = selectedKey === sec.key;
              const isDrag = secDragging === idx;
              const isOver = secOver === idx && secDragging !== idx;
              return (
                <div
                  key={sec.key}
                  draggable
                  onDragStart={() => handleSecDragStart(idx)}
                  onDragEnter={() => handleSecDragEnter(idx)}
                  onDragEnd={handleSecDragEnd}
                  onDragOver={(e) => e.preventDefault()}
                  onClick={() => setSelectedKey(sec.key)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer transition-colors select-none ${isSelected ? 'bg-[#b8864a]/8' : 'hover:bg-stone-50'} ${isDrag ? 'opacity-40' : ''} ${isOver ? 'bg-amber-50 ring-1 ring-[#B8864A]/30' : ''}`}
                >
                  <span className="cursor-grab text-stone-300 hover:text-stone-400 text-[18px] leading-none shrink-0">⠿</span>
                  <input
                    key={sec.key + sec.title}
                    className={`${inputCls} flex-1 min-w-0 cursor-pointer focus:cursor-text`}
                    defaultValue={sec.title}
                    onClick={(e) => e.stopPropagation()}
                    onBlur={(e) => renameSection(sec.key, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                      if (e.key === 'Escape') { (e.target as HTMLInputElement).value = sec.title; (e.target as HTMLInputElement).blur(); }
                    }}
                  />
                  <span className={`text-[11px] shrink-0 tabular-nums ${isSelected ? 'text-[#b8864a]/70' : 'text-stone-400'}`}>{sec.fields.length}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteSection(sec.key); }}
                    className="shrink-0 text-xs text-red-400 hover:text-red-600 transition-colors"
                  >删除</button>
                </div>
              );
            })}
            {addingSection && (
              <div className="flex items-center gap-1.5 px-2 py-1">
                <input
                  ref={newSecRef}
                  value={newSectionTitle}
                  onChange={(e) => setNewSectionTitle(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') addSection(); if (e.key === 'Escape') { setAddingSection(false); setNewSectionTitle(''); } }}
                  onBlur={addSection}
                  placeholder="节标题…"
                  className="flex-1 min-w-0 h-8 px-3 text-sm rounded-xl border border-[#b8864a]/40 bg-white focus:outline-none focus:ring-2 focus:ring-[#B8864A]/15 focus:border-[#B8864A]"
                />
              </div>
            )}
          </div>
        </div>

        {/* Right panel: fields */}
        <div className="flex-1 min-w-0">
          {selectedSection ? (
            <>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-sm font-semibold text-[#2c2c2c]">{selectedSection.title}</h3>
                  <p className="text-xs text-stone-400 mt-0.5">{selectedSection.fields.length} 个问题 · 拖动 ⠿ 调整顺序</p>
                </div>
                <div className="flex items-center gap-2">
                  <AddRow value={newFieldLabel} onChange={setNewFieldLabel} onAdd={addField} placeholder="新问题标签…" inputCls="w-48" />
                </div>
              </div>
              <div className="space-y-2">
                {selectedSection.fields.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-stone-200 px-4 py-8 text-center text-sm text-stone-400">
                    暂无问题，点击右上方添加
                  </div>
                ) : (
                  selectedSection.fields.map((field, idx) => (
                    <FieldRow
                      key={field.key}
                      field={field}
                      idx={idx}
                      sectionKey={selectedSection.key}
                      dragging={fldDragging === idx}
                      over={fldOver === idx && fldDragging !== idx}
                      onDragStart={() => handleFldDragStart(idx)}
                      onDragEnter={() => handleFldDragEnter(idx)}
                      onDragEnd={handleFldDragEnd}
                      onChange={(updated) => updateField(field.key, updated)}
                      onDelete={() => deleteField(field.key)}
                    />
                  ))
                )}
              </div>
            </>
          ) : (
            <div className="bg-white rounded-2xl border border-stone-200 px-4 py-12 text-center text-sm text-stone-400">
              从左侧选择一个节
            </div>
          )}
        </div>
      </div>

      {/* Q&A 模块 */}
      <div className="mt-10 pt-8 border-t border-stone-100">
        <h2 className="text-lg font-bold text-[#2c2c2c] mb-1">Q&amp;A 模块</h2>
        <p className="text-sm text-stone-500 mb-5">这里的问题会显示在外勤 App 问卷底部，由 field staff 手动填写回答。</p>

        <div className="flex gap-2 mb-4 max-w-2xl">
          <AddRow value={newQaText} onChange={setNewQaText} onAdd={handleAddQa} placeholder="输入问题文字…" />
        </div>

        {qaLoading ? (
          <div className="text-center text-stone-400 py-6 text-sm">加载中…</div>
        ) : qaQuestions.length === 0 ? (
          <div className="bg-white rounded-2xl border border-stone-200 px-4 py-8 text-center text-sm text-stone-400 max-w-2xl">
            暂无 Q&amp;A 问题
          </div>
        ) : (
          <div className="space-y-2 max-w-2xl">
            {qaQuestions.map((q) => (
              <div key={q.id} className={`flex items-center gap-3 px-4 py-3 rounded-xl border bg-white ${q.is_active ? 'border-stone-200' : 'border-stone-100 opacity-50'}`}>
                <p className="flex-1 text-sm text-[#1c1917]">{q.question_text}</p>
                <button
                  onClick={() => handleToggleQa(q.id, !q.is_active)}
                  className={`text-xs font-medium px-2.5 py-1 rounded-full transition-colors ${q.is_active ? 'bg-green-50 text-green-600 hover:bg-green-100' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'}`}
                >
                  {q.is_active ? '启用' : '禁用'}
                </button>
                <button
                  onClick={() => handleDeleteQa(q.id)}
                  className="text-xs text-red-400 hover:text-red-600 transition-colors"
                >删除</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
