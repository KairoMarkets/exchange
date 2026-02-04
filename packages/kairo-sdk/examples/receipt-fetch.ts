import { KairoClient } from '../src/index.js'

const client = new KairoClient({
  baseUrl: process.env.KAIRO_BASE_URL ?? 'http://localhost:3000',
})

const receipt = await client.getReceipt(process.env.KAIRO_RECEIPT_ID ?? '')
console.log(receipt.receiptHash)
