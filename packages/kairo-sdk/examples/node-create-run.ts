import { KairoClient } from '../src/index.js'

const client = new KairoClient({
  baseUrl: process.env.KAIRO_BASE_URL ?? 'https://api.kairo.example',
  apiKey: process.env.KAIRO_SESSION_TOKEN,
})

const run = await client.createRun({
  agentId: 'risk-research-agent',
  amountSol: 0.01,
  payload: {
    category: 'security',
    task: 'Review the submitted agent workflow and return a concise risk memo.',
  },
})

console.log(run.runId)
