"use client";
import { trackMaterialEvent } from '@/lib/materialsAnalytics';

import { useEffect, useId, useRef, useState } from "react";
import { api } from "@/lib/api";
import { trackContact, trackLead } from "@/lib/analytics";
import { countryFromLang } from "@/lib/country";
import { useSiteLocale } from "@/contexts/SiteLocaleContext";
import {
  validatePhone,
  isPhoneComplete,
  phoneDigitCount,
} from "@/lib/phoneValidation";

export type SourcingRequestVariant =
  | "quote"
  | "sample"
  | "visit"
  | "sourcing"
  | "designer_partner";
interface SourcingRequestFormProps {
  variant: SourcingRequestVariant;
  productId?: number;
  productTitle?: string;
  productModel?: string;
  quantityUnit?: string;
  supplierId?: number;
  title?: string;
  subtitle?: string;
  submitLabel?: string;
  className?: string;
  inline?: boolean;
}
const COPY: Record<
  SourcingRequestVariant,
  { title: string; submitLabel: string }
> = {
  quote: { title: "Request a quote", submitLabel: "Send quote request" },
  sample: { title: "Request a sample", submitLabel: "Request sample" },
  visit: { title: "Request a showroom visit", submitLabel: "Request visit" },
  sourcing: {
    title: "Discuss your sourcing needs",
    submitLabel: "Send inquiry",
  },
  designer_partner: {
    title: "Become a material partner",
    submitLabel: "Apply to join",
  },
};
const inputCls =
  "h-12 w-full rounded-lg border border-stone-200 bg-white px-3 text-sm text-[#2c2c2c] focus:border-[#b8864a] focus:ring-2 focus:ring-[#b8864a]/30 outline-none transition-colors";

export default function SourcingRequestForm(props: SourcingRequestFormProps) {
  const country = countryFromLang(useSiteLocale().lang);
  // Remount between targets/countries so a pending request can never acknowledge another product.
  return (
    <RequestForm
      key={`${country.code}:${props.variant}:${props.productId ?? ""}:${props.supplierId ?? ""}`}
      {...props}
    />
  );
}

function RequestForm({
  variant,
  productId,
  productTitle,
  productModel,
  quantityUnit,
  supplierId,
  title,
  subtitle,
  submitLabel,
  className = "",
  inline = false,
}: SourcingRequestFormProps) {
  const country = countryFromLang(useSiteLocale().lang);
  const copy = COPY[variant];
  const id = useId();
  const pending = useRef(false);
  const inquiryStarted = useRef(false);
  const requestKey = useRef<string | null>(null);
  const successRef = useRef<HTMLDivElement>(null);
  const [form, setForm] = useState({
    name: "",
    phoneDigits: "",
    email: "",
    companyName: "",
    city: "",
    message: "",
    preferredDate: "",
    quantity: "",
    unit: quantityUnit || "",
    area: "",
  });
  const [unknownQuantity, setUnknownQuantity] = useState(true);
  const [wholeProject, setWholeProject] = useState(false);
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState<number | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (receipt) successRef.current?.focus();
  }, [receipt]);
  const needsEmail = variant === "designer_partner";
  const needsQuantity = variant === "quote" || variant === "sample";
  const phoneError = phoneTouched
    ? validatePhone(form.phoneDigits, country.phoneCode)
    : null;
  const phoneOk =
    isPhoneComplete(form.phoneDigits, country.phoneCode) &&
    !validatePhone(form.phoneDigits, country.phoneCode);
  const quantityOk =
    !needsQuantity ||
    unknownQuantity ||
    (Number.isFinite(Number(form.quantity)) &&
      Number(form.quantity) > 0 &&
      Boolean(form.unit.trim()));
  const areaOk =
    !wholeProject ||
    !form.area ||
    (Number.isFinite(Number(form.area)) && Number(form.area) > 0);
  const canSubmit = Boolean(
    form.name.trim() &&
      phoneOk &&
      (!needsEmail || (form.email.trim() && form.companyName.trim())) &&
      quantityOk &&
      areaOk &&
      (!needsQuantity || productId),
  );
  const set =
    (key: keyof typeof form) =>
    (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >,
    ) => {
      const value = e.currentTarget.value;
      setForm((prev) => ({ ...prev, [key]: value }));
    };
  const label = (field: string, text: string) => (
    <label
      htmlFor={`${id}-${field}`}
      className="mb-1 block text-xs font-medium text-stone-700"
    >
      {text}
    </label>
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || pending.current || receipt) return;
    pending.current = true;
    setSubmitting(true);
    setError("");
    try {
      requestKey.current ??= crypto.randomUUID();
      const result = await api.request(
        `/sourcing-requests?country=${country.code}`,
        {
          method: "POST",
          headers: { "x-country": country.code },
          body: JSON.stringify({
            request_type: variant,
            country: country.code,
            request_key: requestKey.current,
            name: form.name.trim(),
            phone: country.phoneCode + form.phoneDigits,
            email: form.email.trim() || undefined,
            company_name: form.companyName.trim() || undefined,
            city: form.city || undefined,
            message: form.message.trim() || undefined,
            preferred_date: form.preferredDate || undefined,
            product_id: productId || undefined,
            product_model: productModel || undefined,
            supplier_profile_id: supplierId || undefined,
            quantity:
              needsQuantity && !unknownQuantity
                ? Number(form.quantity)
                : undefined,
            quantity_unit:
              needsQuantity && !unknownQuantity ? form.unit.trim() : undefined,
            quantity_unknown: needsQuantity ? unknownQuantity : undefined,
            project_area:
              wholeProject && form.area ? Number(form.area) : undefined,
            source_page: window.location.origin + window.location.pathname,
          }),
        },
      );
      if (!Number.isInteger(Number(result.id)) || Number(result.id) <= 0)
        throw new Error(
          "No request receipt was returned. Please retry to confirm your request.",
        );
      setReceipt(Number(result.id));
      if (!result.duplicate) {
        if (productId) trackMaterialEvent('materials_inquiry_success', country.code, productId);
        const event = {
          content_name: variant,
          content_id: String(productId ?? variant),
        };
        trackContact(event);
        trackLead(event);
      }
    } catch (err) {
      setError(
        err instanceof Error && "status" in err && err.status === 409
          ? "Your earlier request may already have been received. Restore its original details and retry to retrieve the receipt, or contact Tarmeer before submitting another request."
          : err instanceof Error
            ? err.message
            : "Unable to send. Your details are saved here; please try again.",
      );
    } finally {
      pending.current = false;
      setSubmitting(false);
    }
  }

  const cardCls = inline
    ? ""
    : "border border-stone-200 rounded-xl p-5 bg-white";
  if (receipt)
    return (
      <div className={`w-full ${className}`}>
        <div className={cardCls} ref={successRef} role="status" aria-live="polite" tabIndex={-1}>
          <p className="font-semibold text-stone-900">
            Request received by Tarmeer
          </p>
          <p className="mt-2 text-sm text-stone-700">Receipt #{receipt}</p>
          <p className="mt-2 text-sm text-stone-600">
            Tarmeer will review your requirements and contact you using the
            details provided. Pricing, availability and any arrangements remain
            subject to confirmation.
          </p>
        </div>
      </div>
    );

  return (
    <div className={`w-full ${className}`}>
      <div className={cardCls}>
        <p className="mb-1 text-sm font-semibold text-stone-900">
          {title ?? copy.title}
        </p>
        <p className="mb-4 text-xs leading-relaxed text-stone-600">
          {subtitle ??
            "Tarmeer receives this inquiry and coordinates with the supplier. Pricing and availability will be confirmed after review."}
        </p>
        {productId && (
          <div className="mb-3 rounded-lg border border-stone-200 p-3 text-sm">
            <p className="text-xs text-stone-500">
              Selected product #{productId}
            </p>
            <p className="font-medium text-stone-900">
              {productTitle || `Product #${productId}`}
            </p>
            {productModel && (
              <p className="mt-1 text-xs text-stone-600">
                Model: {productModel}
              </p>
            )}
          </div>
        )}
        <form
          className="space-y-3"
          onFocus={() => { if (productId && !inquiryStarted.current) { inquiryStarted.current = true; trackMaterialEvent('materials_inquiry_start', country.code, productId); } }}
          onSubmit={handleSubmit}
          aria-busy={submitting}
        >
          {error && (
            <p
              role="alert"
              className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700"
            >
              {error}
            </p>
          )}
          <fieldset disabled={submitting} className="space-y-3">
            <div>
              {label("name", "Your name *")}
              <input
                id={`${id}-name`}
                required
                autoComplete="name"
                maxLength={120}
                value={form.name}
                onChange={set("name")}
                className={inputCls}
              />
            </div>
            <div>
              {label("phone", "Phone number *")}
              <div className="flex gap-2">
                <span className="inline-flex h-12 items-center rounded-lg border border-stone-200 px-3 text-sm text-stone-600">
                  {country.phoneCode}
                </span>
                <input
                  id={`${id}-phone`}
                  type="tel"
                  autoComplete="tel-national"
                  required
                  inputMode="numeric"
                  placeholder={"0".repeat(phoneDigitCount(country.phoneCode))}
                  maxLength={phoneDigitCount(country.phoneCode)}
                  value={form.phoneDigits}
                  onChange={(e) => {
                    const phoneDigits = e.currentTarget.value.replace(/\D/g, "");
                    setForm((prev) => ({ ...prev, phoneDigits }));
                  }}
                  onBlur={() => setPhoneTouched(true)}
                  aria-invalid={Boolean(phoneError)}
                  aria-describedby={
                    phoneError ? `${id}-phone-error` : undefined
                  }
                  className={inputCls}
                />
              </div>
              {phoneError && (
                <p
                  id={`${id}-phone-error`}
                  className="mt-1 text-xs text-red-700"
                >
                  {phoneError}
                </p>
              )}
            </div>
            <div>
              {label("city", "Delivery / project city (optional)")}
              <select
                id={`${id}-city`}
                value={form.city}
                onChange={set("city")}
                className={inputCls}
              >
                <option value="">Select city</option>
                {country.cities.map((city) => (
                  <option key={city} value={city}>
                    {city}
                  </option>
                ))}
              </select>
            </div>
            {needsEmail && (
              <>
                <div>
                  {label("email", "Email *")}
                  <input
                    id={`${id}-email`}
                    type="email"
                    autoComplete="email"
                    required
                    maxLength={200}
                    value={form.email}
                    onChange={set("email")}
                    className={inputCls}
                  />
                </div>
                <div>
                  {label("company", "Studio / company name *")}
                  <input
                    id={`${id}-company`}
                    required
                    maxLength={200}
                    autoComplete="organization"
                    value={form.companyName}
                    onChange={set("companyName")}
                    className={inputCls}
                  />
                </div>
              </>
            )}
            {needsQuantity && (
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm text-stone-700">
                  <input
                    type="checkbox"
                    checked={unknownQuantity}
                    onChange={(e) => setUnknownQuantity(e.target.checked)}
                    className="accent-[#b8864a]"
                  />
                  Quantity not decided yet
                </label>
                {!unknownQuantity && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      {label("quantity", "Quantity *")}
                      <input
                        id={`${id}-quantity`}
                        type="number"
                        min="0.001"
                        step="any"
                        required
                        value={form.quantity}
                        onChange={set("quantity")}
                        className={inputCls}
                      />
                    </div>
                    <div>
                      {label("unit", "Unit *")}
                      <input
                        id={`${id}-unit`}
                        required
                        maxLength={40}
                        placeholder="e.g. piece, m², set"
                        value={form.unit}
                        onChange={set("unit")}
                        className={inputCls}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
            {variant === "sourcing" && (
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm text-stone-700">
                  <input
                    type="checkbox"
                    checked={wholeProject}
                    onChange={(e) => setWholeProject(e.target.checked)}
                    className="accent-[#b8864a]"
                  />
                  This is a whole-project inquiry
                </label>
                {wholeProject && (
                  <div>
                    {label("area", "Project area in m² (optional)")}
                    <input
                      id={`${id}-area`}
                      type="number"
                      min="0.001"
                      step="any"
                      value={form.area}
                      onChange={set("area")}
                      className={inputCls}
                    />
                  </div>
                )}
              </div>
            )}
            {variant === "visit" && (
              <div>
                {label(
                  "date",
                  "Preferred visit date (subject to confirmation)",
                )}
                <input
                  id={`${id}-date`}
                  type="date"
                  min={new Date().toISOString().slice(0, 10)}
                  value={form.preferredDate}
                  onChange={set("preferredDate")}
                  className={inputCls}
                />
              </div>
            )}
            <div>
              {label("message", "Requirements / message (optional)")}
              <textarea
                id={`${id}-message`}
                rows={3}
                maxLength={3000}
                value={form.message}
                onChange={set("message")}
                className={`${inputCls} h-auto py-3`}
              />
            </div>
          </fieldset>
          <button
            type="submit"
            disabled={!canSubmit || submitting}
            className="h-12 w-full rounded-lg bg-[#b8864a] text-sm font-semibold text-white transition hover:bg-[#a07640] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? "Sending…" : (submitLabel ?? copy.submitLabel)}
          </button>
        </form>
      </div>
    </div>
  );
}
