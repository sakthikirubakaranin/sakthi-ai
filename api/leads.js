/**
 * Sakthi.ai — /api/leads
 * Vercel Serverless Function (Node.js)
 *
 * On every form submission:
 *  1. Sends a rich HTML email to your Zoho Mail via SMTP
 *  2. Creates a HubSpot Contact + Deal ticket
 *  3. Returns success to the browser
 *
 * Environment variables needed in Vercel dashboard:
 *   ZOHO_SMTP_USER     → sakthi.kirubakaran@sakthikirubakaran.in
 *   ZOHO_SMTP_PASS     → Zoho app password (NOT your login password)
 *   NOTIFY_EMAIL       → sakthi.kirubakaran@sakthikirubakaran.in
 *   HUBSPOT_API_KEY    → HubSpot Private App token (starts with pat-na1-)
 */

import nodemailer from 'nodemailer';

// ─── ZOHO SMTP TRANSPORTER ────────────────────────────────────────────────────
function createTransporter() {
  return nodemailer.createTransport({
    host: 'smtppro.zoho.com',        // Use smtp.zoho.com if your account is .com
    port: 465,
    secure: true,                 // SSL
    auth: {
      user: process.env.ZOHO_SMTP_USER,
      pass: process.env.ZOHO_SMTP_PASS,
    },
  });
}

// ─── BUILD HTML EMAIL ─────────────────────────────────────────────────────────
function buildEmailHTML(lead) {
  const tierColor = { A: '#00e5a0', B: '#4ade80', C: '#facc15', D: '#f87171' };
  const score = lead.icp_score || '—';
  const tier  = lead.tier || '—';
  const color = tierColor[tier] || '#888';

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;padding:40px 20px;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#15151f;border-radius:16px;border:1px solid rgba(255,255,255,0.08);overflow:hidden;">

      <!-- Header -->
      <tr><td style="background:linear-gradient(135deg,#0d1a14,#0a0a0f);padding:36px 40px;border-bottom:1px solid rgba(255,255,255,0.06);">
        <table width="100%"><tr>
          <td><span style="font-size:24px;font-weight:800;color:#fff;letter-spacing:-1px;">Sakthi<span style="color:#00e5a0">.ai</span></span><br>
          <span style="font-size:11px;color:#7070a0;letter-spacing:2px;text-transform:uppercase;">New Lead Submission</span></td>
          <td align="right">
            <span style="display:inline-block;background:${color}22;border:1px solid ${color}44;color:${color};font-size:12px;font-family:monospace;padding:6px 16px;border-radius:20px;">
              ${lead.ref_token || 'SKT-???'}
            </span>
          </td>
        </tr></table>
      </td></tr>

      <!-- Lead summary -->
      <tr><td style="padding:32px 40px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr><td style="padding-bottom:8px;">
            <span style="font-size:11px;color:#7070a0;text-transform:uppercase;letter-spacing:2px;font-family:monospace;">// LEAD DETAILS</span>
          </td></tr>
        </table>

        <!-- Name & company block -->
        <table width="100%" style="background:#0f0f18;border-radius:12px;border:1px solid rgba(255,255,255,0.06);margin-bottom:20px;">
          <tr>
            <td style="padding:20px 24px;">
              <p style="margin:0 0 4px;font-size:22px;font-weight:700;color:#fff;">${lead.first_name} ${lead.last_name}</p>
              <p style="margin:0;font-size:14px;color:#7070a0;">${lead.title} &nbsp;·&nbsp; ${lead.company}</p>
            </td>
            <td align="right" style="padding:20px 24px;">
              <a href="mailto:${lead.email}" style="display:block;font-size:13px;color:#00e5a0;text-decoration:none;">${lead.email}</a>
              ${lead.phone ? `<span style="display:block;font-size:13px;color:#7070a0;margin-top:4px;">${lead.phone}</span>` : ''}
            </td>
          </tr>
        </table>

        <!-- Data grid -->
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
          <tr>
            ${buildCell('Company size', lead.company_size)}
            ${buildCell('Lead volume', lead.lead_volume || '—')}
            ${buildCell('CRM', lead.crm || '—')}
          </tr>
          <tr>
            ${buildCell('Budget', lead.budget_range || '—')}
            ${buildCell('Use case', formatUseCase(lead.use_case))}
            ${buildCell('Source', lead.source || '—')}
          </tr>
        </table>

        <!-- Challenge -->
        ${lead.challenge ? `
        <table width="100%" style="background:#0f0f18;border-radius:12px;border:1px solid rgba(255,255,255,0.06);margin-bottom:20px;">
          <tr><td style="padding:20px 24px;">
            <p style="margin:0 0 8px;font-size:10px;color:#7070a0;text-transform:uppercase;letter-spacing:2px;font-family:monospace;">// THEIR CHALLENGE</p>
            <p style="margin:0;font-size:14px;color:#c8c8e0;line-height:1.6;">${lead.challenge}</p>
          </td></tr>
        </table>` : ''}

        <!-- Submitted at -->
        <p style="margin:0;font-size:11px;color:#3a3a52;font-family:monospace;">
          Submitted: ${new Date(lead.submitted_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'full', timeStyle: 'short' })} IST
        </p>
      </td></tr>

      <!-- CTA -->
      <tr><td style="padding:0 40px 40px;">
        <table width="100%"><tr>
          <td>
            <a href="https://app.hubspot.com/contacts/" style="display:inline-block;background:#00e5a0;color:#000;font-size:14px;font-weight:700;padding:14px 28px;border-radius:10px;text-decoration:none;letter-spacing:0.3px;">
              View in HubSpot →
            </a>
          </td>
          <td align="right" style="font-size:11px;color:#3a3a52;font-family:monospace;">Sakthi.ai pipeline</td>
        </tr></table>
      </td></tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;
}

function buildCell(label, value) {
  return `<td width="33%" style="padding:0 6px 12px 0;">
    <table width="100%" style="background:#0f0f18;border-radius:10px;border:1px solid rgba(255,255,255,0.06);">
      <tr><td style="padding:14px 16px;">
        <p style="margin:0 0 4px;font-size:10px;color:#7070a0;text-transform:uppercase;letter-spacing:1.5px;font-family:monospace;">${label}</p>
        <p style="margin:0;font-size:13px;color:#c8c8e0;font-weight:500;">${value}</p>
      </td></tr>
    </table>
  </td>`;
}

function formatUseCase(val) {
  const map = {
    lead_enrichment: 'Lead enrichment',
    icp_scoring: 'ICP scoring',
    research: 'Deep research',
    personalization: 'Personalization',
    full_pipeline: 'Full pipeline',
  };
  return map[val] || val || '—';
}

// ─── SEND ZOHO EMAIL ─────────────────────────────────────────────────────────
async function sendZohoEmail(lead) {
  const transporter = createTransporter();
  const notifyTo = process.env.NOTIFY_EMAIL || process.env.ZOHO_SMTP_USER;

  await transporter.sendMail({
    from: `"Sakthi.ai Pipeline" <${process.env.ZOHO_SMTP_USER}>`,
    to: notifyTo,
    replyTo: lead.email,
    subject: `🔥 New Lead: ${lead.first_name} ${lead.last_name} from ${lead.company} [${lead.ref_token}]`,
    html: buildEmailHTML(lead),
    text: `New lead from Sakthi.ai\n\n${lead.first_name} ${lead.last_name}\n${lead.title} at ${lead.company}\nEmail: ${lead.email}\nPhone: ${lead.phone || 'N/A'}\nSize: ${lead.company_size}\nBudget: ${lead.budget_range}\nUse case: ${lead.use_case}\nCRM: ${lead.crm}\nChallenge: ${lead.challenge}\nRef: ${lead.ref_token}`,
  });

  console.log(`[Zoho] Email sent to ${notifyTo} for lead ${lead.ref_token}`);
}

// ─── CREATE HUBSPOT CONTACT + DEAL ──────────────────────────────────────────
async function createHubSpotTicket(lead) {
  const HSKEY = process.env.HUBSPOT_API_KEY;
  if (!HSKEY) { console.warn('[HubSpot] No API key — skipping'); return null; }

  const headers = {
    'Authorization': `Bearer ${HSKEY}`,
    'Content-Type': 'application/json',
  };

  // 1 — Upsert contact
  const contactRes = await fetch('https://api.hubapi.com/crm/v3/objects/contacts', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      properties: {
        firstname:   lead.first_name,
        lastname:    lead.last_name,
        email:       lead.email,
        phone:       lead.phone || '',
        company:     lead.company,
        jobtitle:    lead.title,
        // Custom properties — create these in HubSpot first if needed
        hs_lead_status: 'NEW',
        lifecyclestage: 'lead',
      },
    }),
  });

  let contactId = null;
  if (contactRes.ok) {
    const contactData = await contactRes.json();
    contactId = contactData.id;
    console.log(`[HubSpot] Contact created: ${contactId}`);
  } else {
    // Contact may already exist — try to find by email
    const search = await fetch('https://api.hubapi.com/crm/v3/objects/contacts/search', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        filterGroups: [{ filters: [{ propertyName: 'email', operator: 'EQ', value: lead.email }] }],
      }),
    });
    if (search.ok) {
      const searchData = await search.json();
      contactId = searchData.results?.[0]?.id;
      console.log(`[HubSpot] Existing contact found: ${contactId}`);
    }
  }

  // 2 — Create Deal (ticket)
  const dealRes = await fetch('https://api.hubapi.com/crm/v3/objects/deals', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      properties: {
        dealname:     `${lead.company} — ${formatUseCase(lead.use_case)} [${lead.ref_token}]`,
        dealstage:    'appointmentscheduled',   // adjust to your pipeline stage ID
        pipeline:     'default',
        amount:       lead.budget_range?.replace(/[^0-9]/g, '') || '0',
        closedate:    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        description:  `Source: ${lead.source || 'website'}\nCompany size: ${lead.company_size}\nLead volume: ${lead.lead_volume}\nCRM: ${lead.crm}\nChallenge: ${lead.challenge}\nRef: ${lead.ref_token}`,
      },
    }),
  });

  let dealId = null;
  if (dealRes.ok) {
    const dealData = await dealRes.json();
    dealId = dealData.id;
    console.log(`[HubSpot] Deal created: ${dealId}`);
  }

  // 3 — Associate deal ↔ contact
  if (contactId && dealId) {
    await fetch(`https://api.hubapi.com/crm/v3/objects/deals/${dealId}/associations/contacts/${contactId}/deal_to_contact`, {
      method: 'PUT',
      headers,
    });
    console.log(`[HubSpot] Deal ${dealId} associated with contact ${contactId}`);
  }

  return { contactId, dealId };
}

// ─── MAIN HANDLER ─────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { return res.status(200).end(); }
  if (req.method !== 'POST') { return res.status(405).json({ error: 'Method not allowed' }); }

  try {
    const lead = req.body;

    // Basic validation
    if (!lead.email || !lead.first_name || !lead.company) {
      return res.status(400).json({ error: 'Missing required fields: email, first_name, company' });
    }

    console.log(`[Pipeline] New lead: ${lead.email} | ${lead.company} | Ref: ${lead.ref_token}`);

    // Run email + HubSpot in parallel
    const [emailResult, hubspotResult] = await Promise.allSettled([
      sendZohoEmail(lead),
      createHubSpotTicket(lead),
    ]);

    // Log any failures (don't crash the response)
    if (emailResult.status === 'rejected') {
      console.error('[Zoho Email] Failed:', emailResult.reason?.message);
    }
    if (hubspotResult.status === 'rejected') {
      console.error('[HubSpot] Failed:', hubspotResult.reason?.message);
    }

    // Fire the AI pipeline in the background (non-blocking)
    fetch(`${process.env.VERCEL_URL ? 'https://' + process.env.VERCEL_URL : 'http://localhost:3000'}/api/pipeline`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(lead),
    }).catch(err => console.error('[Pipeline Trigger] Failed:', err.message));

    return res.status(200).json({
      success: true,
      ref_token: lead.ref_token,
      email_sent: emailResult.status === 'fulfilled',
      hubspot_created: hubspotResult.status === 'fulfilled',
      message: 'Lead received. Email sent and HubSpot ticket created.',
    });

  } catch (err) {
    console.error('[Handler] Unhandled error:', err);
    return res.status(500).json({ error: 'Internal server error', message: err.message });
  }
}
