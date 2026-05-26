import { KairoClient } from '../src/index.js'

const client = new KairoClient({
  baseUrl: process.env.KAIRO_BASE_URL ?? 'https://api.kairo.example',
})

const receipt = await client.getReceipt(process.env.KAIRO_RECEIPT_ID ?? '')
console.log(receipt.receiptHash)
