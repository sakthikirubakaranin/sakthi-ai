import express from 'express';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Load .env.local manually
const envFile = readFileSync('.env.local', 'utf8');
envFile.split('\n').forEach(line => {
  const [key, ...val] = line.split('=');
  if (key && val.length) process.env[key.trim()] = val.join('=').trim();
});

const app = express();
app.use(express.json());
app.use(express.static('public'));

// Load API handlers dynamically
const { default: leadsHandler } = await import('./api/leads.js');
const { default: pipelineHandler } = await import('./api/pipeline.js');

app.all('/api/leads', (req, res) => leadsHandler(req, res));
app.all('/api/pipeline', (req, res) => pipelineHandler(req, res));

app.listen(3000, () => {
  console.log('✅ Sakthi.ai dev server running at http://localhost:3000');
});
