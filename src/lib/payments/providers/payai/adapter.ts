import {
  assertRailGuard,
  buildProviderMetadata,
  generatePaymentNonce,
  hashSensitivePayload,
  sanitizeProviderMetadata,
} from '../../proof-adapter'
import { PaymentAuthorizationRecord, PaymentNetwork } from '../../types'

const SOL_MINT = 'So11111111111111111111111111111111111111112'

export interface PayAiQuoteInput {
  authorizationId: string
  runId: string
  buyerWallet: string
  creatorWallet: string
  amountAtomic: string
  maxAmountAtomic: string
  currency: string
  tokenMint?: string
  network: string
  providerMetadata?: Record<string, unknown>
  expiresAt: string
}

export interface PayAiApprovalInput {
  record: PaymentAuthorizationRecord
  walletApprovalSignature: string
  signedAuthorizationPayload?: string
  providerPaymentReferenceId?: string
}

export interface PayAiProofInput {
  record: PaymentAuthorizationRecord
  transactionSignature: string
  providerProofId?: string
  proofMetadata?: Record<string, unknown>
}

export interface PayAiQuoteResult {
  network: PaymentNetwork
  nonce: string
  tokenMint: string
  providerMetadata: PaymentAuthorizationRecord['providerMetadata']
  publicMetadata: Record<string, unknown>
}

export interface PayAiApprovalResult {
  signedAuthorizationPayloadHash: string
  providerPaymentReferenceId: string
  providerMetadata: PaymentAuthorizationRecord['providerMetadata']
}

export interface PayAiProofResult {
  proofPayloadHash: string
  proofReference: string
  chainProofReference: string
  providerMetadata: PaymentAuthorizationRecord['providerMetadata']
}

export function createPayAiManualDevnetAdapter() {
  return {
    prepareAuthorization(input: PayAiQuoteInput): PayAiQuoteResult {
      const network = assertRailGuard({
        network: input.network,
        maxAmountAtomic: input.maxAmountAtomic,
        amountAtomic: input.amountAtomic,
        currency: input.currency,
        providerMetadata: input.providerMetadata,
      })
      const nonce = generatePaymentNonce()
      const tokenMint = input.tokenMint?.trim() || defaultTokenMint()
      const paymentRequirement = {
        scheme: 'exact',
        network,
        resource: `/api/runs/${input.runId}`,
        payTo: input.creatorWallet,
        asset: tokenMint,
        maxAmountRequired: input.maxAmountAtomic,
        amountRequired: input.amountAtomic,
        mimeType: 'application/json',
        description: 'Kairo CipherSpend Intent for wallet-approved private agent work',
        expiresAt: input.expiresAt,
      }

      return {
        network,
        nonce,
        tokenMint,
        providerMetadata: buildProviderMetadata({
          providerReferenceId: null,
          paymentRequirement,
          rawMetadata: input.providerMetadata,
        }),
        publicMetadata: {
          railGuard: {
            network,
            maxAmountAtomic: input.maxAmountAtomic,
            tokenMint,
            autonomousSpend: false,
          },
          walletApproval: {
            buyerWallet: input.buyerWallet,
            payTo: input.creatorWallet,
            amountAtomic: input.amountAtomic,
            currency: input.currency,
          },
        },
      }
    },

    recordApproval(input: PayAiApprovalInput): PayAiApprovalResult {
      if (!input.walletApprovalSignature.trim()) {
        throw new Error('walletApprovalSignature is required')
      }

      const payloadToHash = input.signedAuthorizationPayload?.trim() || input.walletApprovalSignature.trim()
      const providerReferenceId =
        input.providerPaymentReferenceId?.trim() ||
        `payai-manual-${input.record.authorizationId}`

      return {
        signedAuthorizationPayloadHash: hashSensitivePayload(payloadToHash),
        providerPaymentReferenceId: providerReferenceId,
        providerMetadata: {
          ...input.record.providerMetadata,
          providerReferenceId,
          sanitized: {
            ...input.record.providerMetadata.sanitized,
            approvalRecorded: true,
          },
        },
      }
    },

    recordProof(input: PayAiProofInput): PayAiProofResult {
      const transactionSignature = input.transactionSignature.trim()
      if (!transactionSignature) {
        throw new Error('transactionSignature is required')
      }

      const proofReference = input.providerProofId?.trim() || transactionSignature
      const safeProofMetadata = sanitizeProviderMetadata(input.proofMetadata)
      const proofPayloadHash = hashSensitivePayload(
        JSON.stringify({
          authorizationId: input.record.authorizationId,
          transactionSignature,
          proofReference,
          metadata: safeProofMetadata,
        })
      )

      return {
        proofPayloadHash,
        proofReference,
        chainProofReference: transactionSignature,
        providerMetadata: {
          ...input.record.providerMetadata,
          providerReferenceId: input.record.providerPaymentReferenceId,
          sanitized: {
            ...input.record.providerMetadata.sanitized,
            ...safeProofMetadata,
            proofRecorded: true,
          },
        },
      }
    },
  }
}

function defaultTokenMint(): string {
  return SOL_MINT
}
