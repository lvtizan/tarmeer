'use client';

import { CheckCircle2, Circle, ArrowRight } from 'lucide-react';

export interface PortalStep {
  /** 节点标签（步骤名，显示在圆圈下方） */
  label: string;
  /** 当前激活时显示的描述文字 */
  desc: string;
  /** 是否已完成 */
  done: boolean;
  /** 当前激活步骤的操作按钮文案；不传则该步骤激活时不显示操作行 */
  actionLabel?: string;
  /** 点击操作按钮的回调 */
  onAction?: () => void;
}

/**
 * Portal 引导步骤器 —— 数字节点 + 连线 + 当前激活步骤的操作行。
 * 装企（完善资料 → 上传项目 → 审核）和业主（填需求 → 传照片 → 匹配）共用。
 */
export default function OnboardingStepper({
  title = 'Getting Started',
  steps,
}: {
  title?: string;
  steps: PortalStep[];
}) {
  const firstUndone = steps.findIndex((s) => !s.done);
  const completed = steps.filter((s) => s.done).length;

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden shadow-sm">
      <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[#2c2c2c]">{title}</h2>
        <span className="text-xs text-stone-400">{completed} / {steps.length} complete</span>
      </div>

      <div className="px-4 py-5">
        {/* 数字节点 + 连线 */}
        <div className="grid mb-6 relative" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
          {steps.map((step, i) => (
            <div key={i} className="flex flex-col items-center relative">
              {i > 0 && (
                <div className={`absolute top-[18px] right-1/2 left-0 h-0.5 transition-all ${steps[i - 1].done ? 'bg-[#b8864a]' : 'bg-stone-200'}`} />
              )}
              {i < steps.length - 1 && (
                <div className={`absolute top-[18px] left-1/2 right-0 h-0.5 transition-all ${step.done ? 'bg-[#b8864a]' : 'bg-stone-200'}`} />
              )}
              <div className="relative z-10 w-9 h-9 rounded-full bg-white flex items-center justify-center">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                  step.done
                    ? 'bg-[#b8864a] text-white'
                    : i === firstUndone
                      ? 'bg-white text-[#b8864a] border-2 border-[#b8864a]'
                      : 'bg-stone-100 text-stone-400'
                }`}>
                  {step.done ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
                </div>
              </div>
              <span className={`mt-1.5 text-[10px] font-medium text-center leading-tight px-1 ${step.done ? 'text-[#b8864a]' : 'text-stone-400'}`}>
                {step.label}
              </span>
            </div>
          ))}
        </div>

        {/* 当前激活步骤的操作行 */}
        {steps.map((step, i) => {
          const isActive = !step.done && i === firstUndone;
          if (!isActive || !step.actionLabel || !step.onAction) return null;
          return (
            <div key={i} className="rounded-xl border border-[#b8864a]/20 bg-[#b8864a]/5 px-4 py-4 flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <Circle className="w-4 h-4 text-[#b8864a] mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-[#2c2c2c]">Step {i + 1}: {step.label}</p>
                  <p className="mt-0.5 text-xs text-stone-500">{step.desc}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={step.onAction}
                className="flex-shrink-0 flex items-center gap-1.5 h-8 px-4 rounded-lg bg-[#b8864a] text-white text-xs font-semibold hover:bg-[#a4763f] transition"
              >
                {step.actionLabel}
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
