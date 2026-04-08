/**
 * CRM Lead Push Service
 *
 * Fire-and-forget push to CRM inbound API.
 * Never blocks registration or inquiry submission.
 * Silently skips if CRM config is missing.
 * On success, marks the inquiry as synced (crm_synced_at).
 */

import pool from '../config/database';

const CRM_INBOUND_URL = process.env.CRM_INBOUND_URL;
const CRM_API_KEY = process.env.CRM_API_KEY;
const CRM_TENANT_ID = process.env.CRM_TENANT_ID;
const CRM_TRAFFIC_CHANNEL_ID = process.env.CRM_TRAFFIC_CHANNEL_ID;

interface LeadPayload {
  inquiryId: number;
  externalId: string;
  name: string;
  phone?: string;
  email?: string;
  city?: string;
  area?: string;
  notes?: string;
}

/**
 * Push a lead to CRM. On success, writes crm_synced_at back to the inquiry.
 * MUST be called with .catch(() => {}) — never await in critical paths.
 */
export async function pushLeadToCRM(lead: LeadPayload): Promise<any> {
  if (!CRM_INBOUND_URL || !CRM_API_KEY || !CRM_TENANT_ID) {
    return null;
  }

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
        trafficChannelId: CRM_TRAFFIC_CHANNEL_ID || undefined,
      }),
      signal: AbortSignal.timeout(5000),
    });

    const data = await response.json() as any;

    if (!response.ok) {
      console.error('[CRM Push] Failed:', response.status, data);
      return null;
    }

    // Mark inquiry as synced
    await pool.execute(
      'UPDATE design_inquiries SET crm_synced_at = NOW() WHERE id = ?',
      [lead.inquiryId]
    );

    console.log(`[CRM Push] Lead ${data.data?.action}: ${data.data?.leadId} (inquiry #${lead.inquiryId} marked synced)`);
    return data;
  } catch (err: any) {
    console.error('[CRM Push] Error:', err.message);
    return null;
  }
}
