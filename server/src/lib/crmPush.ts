/**
 * CRM Lead Push Service
 *
 * Fire-and-forget push to CRM inbound API.
 * Never blocks registration or inquiry submission.
 * Silently skips if CRM config is missing.
 *
 * Contract (verified against CRM inbound endpoint 2026-04-10):
 * - Request: POST {CRM_INBOUND_URL}, x-api-key header, JSON body
 * - Success: HTTP 200/201 + body { code: 0, data: { leadId, action }, message }
 *   where action ∈ { 'created', 'updated', 'linked', 'duplicate' }
 * - Failure: HTTP 4xx/5xx, or body with code !== 0
 *
 * Sync status is only marked 'synced' when BOTH the HTTP layer succeeded
 * AND the business layer returned code === 0. Anything else is persisted
 * as 'failed' with the error payload so admins can inspect + re-trigger.
 */

import pool from '../config/database';

const CRM_INBOUND_URL = process.env.CRM_INBOUND_URL;
const CRM_API_KEY = process.env.CRM_API_KEY;
const CRM_TENANT_ID = process.env.CRM_TENANT_ID;
const CRM_TRAFFIC_CHANNEL_ID = process.env.CRM_TRAFFIC_CHANNEL_ID;

export interface LeadPayload {
  inquiryId: number;
  externalId: string;
  name: string;
  phone?: string;
  email?: string;
  city?: string;
  area?: string;
  notes?: string;
  page?: string;
}

async function markSynced(
  inquiryId: number,
  leadId: string | null,
  action: string | null,
): Promise<void> {
  await pool.execute(
    `UPDATE design_inquiries
       SET crm_synced_at = NOW(),
           crm_sync_status = 'synced',
           crm_lead_id = ?,
           crm_action = ?,
           crm_last_error = NULL,
           crm_sync_attempts = crm_sync_attempts + 1
     WHERE id = ?`,
    [leadId, action, inquiryId],
  );
}

async function markFailed(
  inquiryId: number,
  error: Record<string, unknown>,
): Promise<void> {
  await pool.execute(
    `UPDATE design_inquiries
       SET crm_sync_status = 'failed',
           crm_last_error = ?,
           crm_sync_attempts = crm_sync_attempts + 1
     WHERE id = ?`,
    [JSON.stringify(error), inquiryId],
  );
}

/**
 * Push a lead to CRM. On success, writes crm_synced_at + crm_lead_id +
 * crm_action back to the inquiry. On failure, writes crm_last_error.
 * MUST be called with .catch(() => {}) — never await in critical paths.
 */
export async function pushLeadToCRM(lead: LeadPayload): Promise<any> {
  if (!CRM_INBOUND_URL || !CRM_API_KEY || !CRM_TENANT_ID) {
    // Config missing — don't touch the inquiry row (stays 'pending')
    return null;
  }

  let httpStatus = 0;
  let data: any = null;

  try {
    const response = await fetch(CRM_INBOUND_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CRM_API_KEY,
      },
      body: JSON.stringify({
        source: 'tarmeer-mall',
        tenantId: CRM_TENANT_ID,
        externalId: String(lead.externalId),
        name: lead.name,
        phone: lead.phone || undefined,
        email: lead.email || undefined,
        city: lead.city || undefined,
        area: lead.area || undefined,
        notes: lead.notes || undefined,
        page: lead.page || undefined,
        trafficChannelId: CRM_TRAFFIC_CHANNEL_ID || undefined,
      }),
      signal: AbortSignal.timeout(5000),
    });

    httpStatus = response.status;

    try {
      data = await response.json();
    } catch {
      data = null;
    }

    // Dual check: HTTP 2xx AND body.code === 0.
    // CRM may return HTTP 200 with code !== 0 for business-level rejections
    // (validation errors, tenant not found, rate limit, etc.) — don't mark
    // synced in that case.
    if (!response.ok || !data || data.code !== 0) {
      const errorPayload = {
        httpStatus,
        code: data?.code ?? null,
        message: data?.message ?? 'No message',
        responseBody: data,
      };
      console.error('[CRM Push] Failed (inquiry #' + lead.inquiryId + '):', errorPayload);
      await markFailed(lead.inquiryId, errorPayload).catch(() => {});
      return null;
    }

    const leadId: string | null = data.data?.leadId ?? null;
    const action: string | null = data.data?.action ?? null;

    await markSynced(lead.inquiryId, leadId, action);
    console.log(
      `[CRM Push] Lead ${action}: ${leadId} (inquiry #${lead.inquiryId} marked synced)`,
    );
    return data;
  } catch (err: any) {
    // Network / timeout / AbortError — record so retry is possible
    const errorPayload = {
      httpStatus: httpStatus || 0,
      code: null,
      message: err?.message || String(err),
      errorName: err?.name || 'Error',
    };
    console.error('[CRM Push] Error (inquiry #' + lead.inquiryId + '):', errorPayload);
    await markFailed(lead.inquiryId, errorPayload).catch(() => {});
    return null;
  }
}
