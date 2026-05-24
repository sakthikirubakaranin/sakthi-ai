# Sakthi.ai — Presales Intelligence Lead Capture

## What this does
When someone submits the form on your site:
1. **Zoho Mail** — You get a rich HTML email with full lead details
2. **HubSpot** — A Contact + Deal is automatically created and linked
3. **Browser** — The visitor sees a success screen with a reference token

---

## Project Structure
```
sakthi-ai/
├── public/
│   └── index.html        ← The lead capture website
├── api/
│   └── leads.js          ← Vercel serverless function (email + HubSpot)
├── package.json
├── vercel.json
├── .gitignore
└── .env.example
```

---

## Step 1 — Prerequisites (Mac)

Install Node.js from https://nodejs.org (download LTS installer)

Install Vercel CLI:
```bash
npm install -g vercel
```

---

## Step 2 — Get your Zoho App Password

1. Log into **Zoho Mail** → click your avatar top-right → **My Account**
2. Go to **Security** → **App Passwords**
3. Click **Generate New Password** → name it "Sakthi.ai"
4. Copy the password shown — you only see it once
5. Save it as `ZOHO_SMTP_PASS` in your env vars

> Note: Use `smtp.zoho.in` for `.in` accounts, `smtp.zoho.com` for `.com` accounts

---

## Step 3 — Get your HubSpot Private App Token

1. Log into **HubSpot** → click the ⚙️ Settings gear
2. Go to **Integrations** → **Private Apps** → **Create a private app**
3. Name it: `Sakthi.ai Lead Capture`
4. Under **Scopes**, enable:
   - `crm.objects.contacts.write`
   - `crm.objects.contacts.read`
   - `crm.objects.deals.write`
5. Click **Create app** → copy the token (starts with `pat-na1-`)
6. Save it as `HUBSPOT_API_KEY`

---

## Step 4 — Set up the project locally

```bash
# Clone or open the folder in VS Code terminal
cd sakthi-ai

# Install dependencies
npm install

# Create your local env file
cp .env.example .env.local
# → Open .env.local in VS Code and fill in your values
```

---

## Step 5 — Test locally

```bash
vercel dev
# → Opens http://localhost:3000
# → Fill the form and check your Zoho inbox + HubSpot
```

---

## Step 6 — Push to GitHub

```bash
git init
git add .
git commit -m "feat: Sakthi.ai lead capture site"

# Create repo on github.com → copy the remote URL, then:
git remote add origin https://github.com/YOUR_USERNAME/sakthi-ai.git
git branch -M main
git push -u origin main
```

---

## Step 7 — Deploy to Vercel

```bash
vercel
# Follow prompts → link to GitHub repo → framework: Other
```

Then add Environment Variables in **Vercel Dashboard → Project → Settings → Environment Variables**:

| Variable | Value |
|---|---|
| `ZOHO_SMTP_USER` | `sakthi.kirubakaran@sakthikirubakaran.in` |
| `ZOHO_SMTP_PASS` | your Zoho app password |
| `NOTIFY_EMAIL` | `sakthi.kirubakaran@sakthikirubakaran.in` |
| `HUBSPOT_API_KEY` | `pat-na1-...` |

Redeploy after adding vars:
```bash
vercel --prod
```

---

## Step 8 — Connect your Zoho Domain

In **Zoho Domains → DNS Manager**, add:

| Type | Name | Value |
|---|---|---|
| A | @ | 76.76.21.21 |
| CNAME | www | cname.vercel-dns.com |

In **Vercel → Project → Settings → Domains**, add:
- `sakthikirubakaran.in`
- `www.sakthikirubakaran.in`

SSL auto-provisions. DNS takes 10–60 minutes.

---

## Troubleshooting

**Email not arriving?**
- Check spam folder
- Verify Zoho App Password (not your login password)
- Check Vercel Function Logs: Dashboard → Project → Functions tab

**HubSpot contact not created?**
- Verify your Private App token has write scopes
- Check Vercel logs for `[HubSpot]` lines

**Form shows error after submit?**
- Open browser DevTools → Network tab → look at the `/api/leads` response
- Check Vercel logs for the specific error
