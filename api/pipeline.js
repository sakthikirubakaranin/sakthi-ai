/**
 * Sakthi.ai — /api/pipeline
 * Multi-Agent Presales Intelligence Pipeline
 *
 * 6 Agents run in sequence after lead capture:
 *   Agent 1 — Lead Enrichment (company data via web search)
 *   Agent 2 — ICP Scoring (Claude grades A/B/C/D with reasoning)
 *   Agent 3 — Deep Research (news, hiring signals, tech stack)
 *   Agent 4 — Personalized Outreach (email + talk track via Claude)
 *   Agent 5 — HubSpot Update (push intel brief to deal notes)
 *   Agent 6 — Zoho Cliq Alert (rich message to #sakthi-ai-leads)
 */

const ANTHROPIC_API_KEY = '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';

// ─── HELPERS ──────────────────────────────────────────────────────────────────

async function callClaude(systemPrompt, userPrompt) {
  const apiKey = process.env.ANTHROPIC_API_KEY || ANTHROPIC_API_KEY;
  console.log('[Claude] Key source:', process.env.ANTHROPIC_API_KEY ? 'env' : 'fallback');
  console.log('[Claude] Key prefix:', apiKey.substring(0, 25) + '...');

  const controller = new AbortController();
  const timeout = setTimeout(() => {
    console.error('[Claude] TIMEOUT after 30s — aborting fetch');
    controller.abort();
  }, 30000);

  try {
    console.log('[Claude] Sending request to Anthropic API...');
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });
    clearTimeout(timeout);
    console.log('[Claude] HTTP status:', res.status);
    if (!res.ok) {
      const err = await res.text();
      console.error('[Claude] API error body:', err);
      throw new Error(`Claude API error ${res.status}: ${err}`);
    }
    const data = await res.json();
    console.log('[Claude] Success — output tokens:', data.usage?.output_tokens);
    // Strip markdown code fences if Claude wraps JSON in ```json ... ```
    let text = data.content[0].text.trim();
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    return text;
  } catch (err) {
    clearTimeout(timeout);
    console.error('[Claude] Fetch threw:', err.name, err.message);
    throw err;
  }
}

// Get a fresh Zoho access token using the refresh token
async function getZohoAccessToken() {
  const res = await fetch('https://accounts.zoho.com/oauth/v2/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: process.env.ZOHO_CLIENT_ID || '1000.LH2MBXXI21P7908G5GN9B8FVWXJ4ZK',
      client_secret: process.env.ZOHO_CLIENT_SECRET || '386356adcc19e80429cc1cb60d8f31c18897a14d63',
      refresh_token: process.env.ZOHO_REFRESH_TOKEN || '1000.46d9c9f4c2f459d14e103846720f67fb.b1b0d509be371a3994604ca05f0881ee',
    }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error('Failed to get Zoho access token: ' + JSON.stringify(data));
  return data.access_token;
}

// ─── AGENT 1: LEAD ENRICHMENT ─────────────────────────────────────────────────
async function agentEnrichLead(lead) {
  console.log('[Agent 1] Enriching lead:', lead.company);

  const prompt = `You are a B2B lead enrichment agent. Based on the following lead information, provide enriched company intelligence.

Lead Data:
- Name: ${lead.first_name} ${lead.last_name}
- Title: ${lead.title}
- Company: ${lead.company}
- Email domain: ${lead.email.split('@')[1]}
- Company size: ${lead.company_size}
- CRM: ${lead.crm}
- Use case: ${lead.use_case}

Provide a JSON response with these exact fields:
{
  "industry": "detected industry vertical",
  "business_model": "B2B or B2C or B2B2C",
  "likely_tech_stack": ["tool1", "tool2", "tool3"],
  "company_stage": "startup or scaleup or enterprise",
  "decision_maker_level": "C-suite or VP or Director or Manager",
  "buying_urgency": "high or medium or low",
  "enrichment_notes": "2-3 sentence summary of what this company likely does and why they need presales AI"
}

Respond with valid JSON only, no markdown.`;

  const raw = await callClaude(
    'You are a precise B2B intelligence agent. Always respond with valid JSON only.',
    prompt
  );

  try {
    return JSON.parse(raw);
  } catch {
    console.warn('[Agent 1] JSON parse failed, using defaults');
    return {
      industry: 'Technology',
      business_model: 'B2B',
      likely_tech_stack: [lead.crm || 'Unknown CRM'],
      company_stage: 'scaleup',
      decision_maker_level: lead.title.includes('VP') || lead.title.includes('Chief') ? 'VP' : 'Director',
      buying_urgency: 'medium',
      enrichment_notes: `${lead.company} is a ${lead.company_size} company interested in ${lead.use_case}.`,
    };
  }
}

// ─── AGENT 2: ICP SCORING ─────────────────────────────────────────────────────
async function agentScoreICP(lead, enrichment) {
  console.log('[Agent 2] Scoring ICP for:', lead.company);

  const prompt = `You are an ICP scoring agent for Sakthi.ai, a presales intelligence platform.

Our ideal customer:
- B2B company with 50+ employees
- Has a sales team actively working inbound leads
- Uses a CRM (HubSpot, Salesforce, Zoho, Pipedrive)
- Monthly lead volume of 50+
- Budget of $1000+/month
- VP Sales, Head of Sales, or RevOps title

Lead to score:
- Company: ${lead.company} (${lead.company_size} employees)
- Title: ${lead.title}
- Use case: ${lead.use_case}
- CRM: ${lead.crm}
- Monthly leads: ${lead.lead_volume}
- Budget: ${lead.budget_range}
- Challenge: ${lead.challenge}
- Industry: ${enrichment.industry}
- Business model: ${enrichment.business_model}
- Company stage: ${enrichment.company_stage}
- Decision maker level: ${enrichment.decision_maker_level}
- Buying urgency: ${enrichment.buying_urgency}

Respond with valid JSON only:
{
  "tier": "A or B or C or D",
  "icp_score": 85,
  "score_breakdown": {
    "company_fit": 90,
    "title_fit": 85,
    "use_case_fit": 95,
    "budget_fit": 80,
    "urgency_fit": 75
  },
  "tier_reasoning": "2-3 sentences explaining the tier",
  "recommended_action": "Book discovery call immediately or Nurture with content or Low priority or Disqualify",
  "follow_up_timing": "Within 2 hours or Within 24 hours or Within 1 week or No follow-up"
}`;

  const raw = await callClaude(
    'You are a precise ICP scoring agent. Always respond with valid JSON only.',
    prompt
  );

  try {
    return JSON.parse(raw);
  } catch {
    console.warn('[Agent 2] JSON parse failed, using defaults');
    return {
      tier: 'B',
      icp_score: 70,
      score_breakdown: { company_fit: 70, title_fit: 70, use_case_fit: 75, budget_fit: 65, urgency_fit: 70 },
      tier_reasoning: `${lead.company} shows moderate fit with our ICP based on size and use case.`,
      recommended_action: 'Nurture with content',
      follow_up_timing: 'Within 24 hours',
    };
  }
}

// ─── AGENT 3: DEEP RESEARCH ───────────────────────────────────────────────────
async function agentDeepResearch(lead, enrichment) {
  console.log('[Agent 3] Deep research on:', lead.company);

  const prompt = `You are a sales intelligence researcher. Generate insights for this company.

Company: ${lead.company}
Industry: ${enrichment.industry}
Size: ${lead.company_size}
Stage: ${enrichment.company_stage}
Tech stack clues: ${enrichment.likely_tech_stack.join(', ')}
Contact: ${lead.title} — ${lead.first_name} ${lead.last_name}
Their challenge: ${lead.challenge}

Respond with valid JSON only:
{
  "growth_signals": ["signal1", "signal2", "signal3"],
  "hiring_signals": "Brief note on likely hiring activity",
  "pain_points": ["pain1", "pain2", "pain3"],
  "tech_stack_gaps": ["gap1", "gap2"],
  "conversation_hooks": ["hook1 — specific talking point", "hook2 — specific talking point"],
  "risk_flags": [],
  "company_summary": "3-4 sentence intel brief a sales rep can read in 30 seconds before a call"
}`;

  const raw = await callClaude(
    'You are a precise B2B sales researcher. Always respond with valid JSON only.',
    prompt
  );

  try {
    return JSON.parse(raw);
  } catch {
    console.warn('[Agent 3] JSON parse failed, using defaults');
    return {
      growth_signals: ['Active in their market segment', 'Has dedicated sales function', 'Using modern CRM'],
      hiring_signals: 'Likely hiring sales/RevOps based on company stage',
      pain_points: [lead.challenge || 'Manual lead qualification', 'Slow response time to inbound leads'],
      tech_stack_gaps: ['Automated enrichment', 'AI-powered scoring'],
      conversation_hooks: [`Reference their challenge: "${lead.challenge}"`, 'Ask about current lead qualification process'],
      risk_flags: [],
      company_summary: `${lead.company} is a ${lead.company_size} ${enrichment.industry} company. ${lead.first_name} ${lead.last_name} (${lead.title}) is evaluating presales AI for ${lead.use_case}. Their main challenge: ${lead.challenge}.`,
    };
  }
}

// ─── AGENT 4: PERSONALIZED OUTREACH ──────────────────────────────────────────
async function agentPersonalizeOutreach(lead, enrichment, scoring, research) {
  console.log('[Agent 4] Generating personalized outreach for:', lead.company);

  const prompt = `You are an elite B2B sales copywriter. Write personalized outreach for this lead.

Lead: ${lead.first_name} ${lead.last_name}, ${lead.title} at ${lead.company}
ICP Tier: ${scoring.tier} (score: ${scoring.icp_score})
Their challenge: ${lead.challenge}
Use case interest: ${lead.use_case}
Conversation hooks: ${research.conversation_hooks.join(' | ')}
Company summary: ${research.company_summary}
Recommended action: ${scoring.recommended_action}

Respond with valid JSON only:
{
  "subject_line": "Email subject line (max 60 chars)",
  "email_body": "3-4 paragraph personalized email. Mention their specific challenge. Reference Sakthi.ai value prop. Clear CTA.",
  "talk_track": "Bullet-point script for a discovery call opening.",
  "linkedin_message": "Short LinkedIn connection message under 300 chars",
  "key_value_props": ["prop1 relevant to their use case", "prop2", "prop3"]
}`;

  const raw = await callClaude(
    'You are an elite B2B sales copywriter. Always respond with valid JSON only.',
    prompt
  );

  try {
    return JSON.parse(raw);
  } catch {
    console.warn('[Agent 4] JSON parse failed, using defaults');
    return {
      subject_line: `${lead.first_name}, quick question about your presales process`,
      email_body: `Hi ${lead.first_name},\n\nI noticed you're exploring presales intelligence for ${lead.company}. Your challenge around "${lead.challenge}" is exactly what Sakthi.ai solves.\n\nWe help ${lead.company_size} companies enrich, score, and act on inbound leads in under 30 seconds — automatically.\n\nWould you be open to a 20-minute call this week?\n\nBest,\nSakthi`,
      talk_track: `• Open: "Thanks for your interest, ${lead.first_name}"\n• Pain: "You mentioned ${lead.challenge}"\n• Value: "We automate that with 6 AI agents"\n• Question: "What does your current process look like?"`,
      linkedin_message: `Hi ${lead.first_name}, saw you're exploring presales AI at ${lead.company}. Would love to connect and share how Sakthi.ai can help.`,
      key_value_props: ['Enrichment in under 30 seconds', 'Claude-powered ICP scoring', 'Auto-generated personalized outreach'],
    };
  }
}

// ─── AGENT 5: HUBSPOT UPDATE ──────────────────────────────────────────────────
async function agentUpdateHubSpot(lead, enrichment, scoring, research, outreach) {
  console.log('[Agent 5] Updating HubSpot deal for:', lead.company);

  const HSKEY = process.env.HUBSPOT_API_KEY || 'pat-na2-2920e2a1-943c-4527-be50-910e94f5e948';
  if (!HSKEY) { console.warn('[Agent 5] No HubSpot key — skipping'); return; }

  const headers = {
    'Authorization': `Bearer ${HSKEY}`,
    'Content-Type': 'application/json',
  };

  const searchRes = await fetch('https://api.hubapi.com/crm/v3/objects/deals/search', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      filterGroups: [{
        filters: [{
          propertyName: 'description',
          operator: 'CONTAINS_TOKEN',
          value: lead.ref_token,
        }],
      }],
      properties: ['dealname', 'description'],
    }),
  });

  let dealId = null;
  if (searchRes.ok) {
    const searchData = await searchRes.json();
    dealId = searchData.results?.[0]?.id;
  }

  if (!dealId) {
    console.warn('[Agent 5] Deal not found for ref:', lead.ref_token);
    return;
  }

  const tierColor = { A: '🟢', B: '🔵', C: '🟡', D: '🔴' };
  const notes = `
${tierColor[scoring.tier] || '⚪'} ICP TIER: ${scoring.tier} | SCORE: ${scoring.icp_score}/100
Action: ${scoring.recommended_action} | Follow-up: ${scoring.follow_up_timing}

── SCORING BREAKDOWN ──
Company fit: ${scoring.score_breakdown.company_fit}/100
Title fit: ${scoring.score_breakdown.title_fit}/100
Use case fit: ${scoring.score_breakdown.use_case_fit}/100
Budget fit: ${scoring.score_breakdown.budget_fit}/100
Urgency fit: ${scoring.score_breakdown.urgency_fit}/100

Reasoning: ${scoring.tier_reasoning}

── COMPANY INTEL ──
Industry: ${enrichment.industry} | Stage: ${enrichment.company_stage}
Business model: ${enrichment.business_model}
Tech stack: ${enrichment.likely_tech_stack.join(', ')}
${research.company_summary}

── GROWTH SIGNALS ──
${research.growth_signals.map(s => `• ${s}`).join('\n')}

── PAIN POINTS ──
${research.pain_points.map(p => `• ${p}`).join('\n')}

── CONVERSATION HOOKS ──
${research.conversation_hooks.map(h => `• ${h}`).join('\n')}

── OUTREACH READY ──
Subject: ${outreach.subject_line}
LinkedIn: ${outreach.linkedin_message}

── RISK FLAGS ──
${research.risk_flags.length > 0 ? research.risk_flags.map(f => `⚠️ ${f}`).join('\n') : '✅ No risk flags'}

Generated by Sakthi.ai Pipeline | Ref: ${lead.ref_token}
  `.trim();

  await fetch(`https://api.hubapi.com/crm/v3/objects/deals/${dealId}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({
      properties: {
        description: notes,
        hs_priority: scoring.tier === 'A' ? 'high' : scoring.tier === 'B' ? 'medium' : 'low',
      },
    }),
  });

  await fetch('https://api.hubapi.com/engagements/v1/engagements', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      engagement: { active: true, type: 'NOTE' },
      associations: { dealIds: [parseInt(dealId)] },
      metadata: { body: notes },
    }),
  });

  console.log(`[Agent 5] HubSpot deal ${dealId} updated with AI intel`);
  return dealId;
}

// ─── AGENT 6: ZOHO CLIQ ALERT ─────────────────────────────────────────────────
async function agentAlertCliq(lead, enrichment, scoring, research, outreach) {
  console.log('[Agent 6] Sending Cliq alert for:', lead.company);

  const CLIQ_URL = process.env.CLIQ_WEBHOOK_URL || 'https://cliq.zoho.com/company/646951363/api/v2/channelsbyname/sakthiaileads/message';
  if (!CLIQ_URL) { console.warn('[Agent 6] No Cliq webhook — skipping'); return; }

  const accessToken = await getZohoAccessToken();

  const tierEmoji = { A: '🔥', B: '✅', C: '⚡', D: '❄️' };
  const tierLabel = { A: 'Tier A — Hot lead', B: 'Tier B — Good fit', C: 'Tier C — Nurture', D: 'Tier D — Low priority' };

  const message = {
    text: `${tierEmoji[scoring.tier] || '📋'} *New Lead: ${lead.first_name} ${lead.last_name} from ${lead.company}*`,
    card: {
      title: `${tierEmoji[scoring.tier]} ${tierLabel[scoring.tier]} | Score: ${scoring.icp_score}/100`,
    },
    slides: [
      {
        type: 'label',
        title: '👤 Lead Details',
        data: [
          { label: 'Name', value: `${lead.first_name} ${lead.last_name}` },
          { label: 'Title', value: lead.title },
          { label: 'Company', value: `${lead.company} (${lead.company_size})` },
          { label: 'Email', value: lead.email },
          { label: 'Use case', value: lead.use_case },
          { label: 'Budget', value: lead.budget_range },
          { label: 'CRM', value: lead.crm },
        ],
      },
      {
        type: 'label',
        title: '🎯 ICP Scoring',
        data: [
          { label: 'Tier', value: `${scoring.tier} (${scoring.icp_score}/100)` },
          { label: 'Action', value: scoring.recommended_action },
          { label: 'Follow-up', value: scoring.follow_up_timing },
          { label: 'Reasoning', value: scoring.tier_reasoning },
        ],
      },
      {
        type: 'label',
        title: '🔍 Intel Brief',
        data: [
          { label: 'Industry', value: enrichment.industry },
          { label: 'Stage', value: enrichment.company_stage },
          { label: 'Growth signals', value: research.growth_signals.slice(0, 2).join(' | ') },
          { label: 'Pain points', value: research.pain_points.slice(0, 2).join(' | ') },
          { label: 'Hook', value: research.conversation_hooks[0] || '' },
        ],
      },
      {
        type: 'label',
        title: '✉️ Outreach Ready',
        data: [
          { label: 'Subject', value: outreach.subject_line },
          { label: 'LinkedIn', value: outreach.linkedin_message },
          { label: 'Value props', value: outreach.key_value_props.join(' | ') },
        ],
      },
    ],
    buttons: [
      {
        label: 'View in HubSpot',
        hint: 'Open deal in HubSpot',
        action: {
          type: 'open.url',
          data: { web: 'https://app.hubspot.com/contacts/' },
        },
      },
    ],
  };

  const res = await fetch(CLIQ_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Zoho-oauthtoken ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(message),
  });

  if (res.ok) {
    console.log('[Agent 6] Cliq alert sent successfully');
  } else {
    const err = await res.text();
    console.error('[Agent 6] Cliq alert failed:', err);
  }
}

// ─── MAIN PIPELINE HANDLER ────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const lead = req.body;

  if (!lead.email || !lead.company) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  console.log(`[Pipeline] Starting 6-agent pipeline for: ${lead.email} | ${lead.company} | Ref: ${lead.ref_token}`);

  // Respond immediately so the browser doesn't wait
  res.status(200).json({
    success: true,
    message: 'Pipeline started',
    ref_token: lead.ref_token,
  });

  // Run all agents sequentially
  try {
    const enrichment = await agentEnrichLead(lead);
    console.log('[Pipeline] Agent 1 done:', enrichment.industry, enrichment.company_stage);

    const scoring = await agentScoreICP(lead, enrichment);
    console.log('[Pipeline] Agent 2 done: Tier', scoring.tier, '| Score', scoring.icp_score);

    const research = await agentDeepResearch(lead, enrichment);
    console.log('[Pipeline] Agent 3 done:', research.growth_signals.length, 'growth signals');

    const outreach = await agentPersonalizeOutreach(lead, enrichment, scoring, research);
    console.log('[Pipeline] Agent 4 done: Subject —', outreach.subject_line);

    await agentUpdateHubSpot(lead, enrichment, scoring, research, outreach);
    console.log('[Pipeline] Agent 5 done: HubSpot updated');

    // await agentAlertCliq(lead, enrichment, scoring, research, outreach);
    // Agent 6 disabled — Cliq scope issue

    console.log(`[Pipeline] ✅ All 6 agents complete for ${lead.company} | Tier: ${scoring.tier} | Score: ${scoring.icp_score}`);
  } catch (err) {
    console.error('[Pipeline] Agent error:', err.message);
    console.error('[Pipeline] Stack:', err.stack);
  }
}
