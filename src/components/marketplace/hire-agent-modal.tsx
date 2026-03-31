'use client'

import { useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useToast } from '@/hooks/use-toast'
import { 
  Loader2, 
  Wallet, 
  Shield, 
  Clock, 
  Star,
  AlertTriangle,
  CheckCircle
} from 'lucide-react'

interface Agent {
  id: string
  name: string
  description: string
  capabilities: string[]
  pricing: {
    type: 'per_query' | 'subscription' | 'custom'
    price: number
    currency: 'SOL'
  }
  rating: number
  totalServices: number
  creator: string
  creatorAddress: string
  responseTime: string
  isActive: boolean
  nftMint: string
}

interface HireAgentModalProps {
  agent: Agent
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function HireAgentModal({ agent, open, onOpenChange }: HireAgentModalProps) {
  const { connected, publicKey } = useWallet()
  const { toast } = useToast()
  const [requestData, setRequestData] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [step, setStep] = useState<'details' | 'confirm' | 'processing' | 'success'>('details')

  const handleSubmit = async () => {
    if (!connected || !publicKey) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet to hire an agent.",
        variant: "destructive",
      })
      return
    }

    if (!requestData.trim()) {
      toast({
        title: "Request required",
        description: "Please describe what you need the agent to do.",
        variant: "destructive",
      })
      return
    }

    setStep('confirm')
  }

  const handleConfirm = async () => {
    if (!publicKey) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet to proceed.",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)
    setStep('processing')

    try {
      // Create service request via API
      const response = await fetch('/api/requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          agentId: agent.nftMint,
          userWallet: publicKey.toString(),
          amount: agent.pricing.price,
          requestData: {
            description: requestData,
            timestamp: new Date().toISOString(),
          },
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create request')
      }

      const data = await response.json()
      
      setStep('success')
      
      toast({
        title: "Service request created!",
        description: `Request ID: ${data.request.requestId}. ${agent.name} will start working on it.`,
      })

      // Auto-close after success
      setTimeout(() => {
        onOpenChange(false)
        resetModal()
      }, 3000)

    } catch (error) {
      toast({
        title: "Request failed",
        description: error instanceof Error ? error.message : "Failed to create service request. Please try again.",
        variant: "destructive",
      })
      setStep('details')
    } finally {
      setIsSubmitting(false)
    }
  }

  const resetModal = () => {
    setStep('details')
    setRequestData('')
    setIsSubmitting(false)
  }

  const handleClose = () => {
    if (!isSubmitting) {
      onOpenChange(false)
      resetModal()
    }
  }

  const formatPrice = (price: number) => {
    if (price < 0.01) {
      return `${(price * 1000).toFixed(0)}k lamports`
    }
    return `${price} SOL`
  }

  const getPricingLabel = (type: string) => {
    switch (type) {
      case 'per_query': return 'per query'
      case 'subscription': return 'per month'
      case 'custom': return 'custom pricing'
      default: return 'per query'
    }
  }

  const intakeSteps = [
    { label: 'Request', value: requestData.trim() ? 'Ready' : 'Draft' },
    { label: 'Wallet', value: connected ? 'Connected' : 'Connect' },
    { label: 'Escrow proof', value: step === 'success' ? 'Ready for hold' : 'After approval' },
    { label: 'Receipt', value: step === 'success' ? 'Dashboard trail' : 'After delivery' },
  ]

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <span>Hire {agent.name}</span>
            {step === 'success' && <CheckCircle className="h-5 w-5 text-green-500" />}
          </DialogTitle>
          <DialogDescription>
            {step === 'details' && "Describe the private work request and delivery expectations."}
            {step === 'confirm' && "Review request scope, wallet authorization, and escrow proof state."}
            {step === 'processing' && "Creating your Private Deal Room request..."}
            {step === 'success' && "Your request is ready for seller intake."}
          </DialogDescription>
        </DialogHeader>

        {step === 'details' && (
          <div className="space-y-6">
            <IntakeRail steps={intakeSteps} activeIndex={0} />

            {/* Agent Info */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  <span className="font-medium">{agent.rating}</span>
                  <span className="text-sm text-muted-foreground">
                    ({agent.totalServices.toLocaleString()} services)
                  </span>
                </div>
                <div className="flex items-center space-x-1 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>{agent.responseTime}</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-1">
                {agent.capabilities.map((capability) => (
                  <Badge key={capability} variant="secondary" className="text-xs">
                    {capability}
                  </Badge>
                ))}
              </div>
            </div>

            <Separator />

            {/* Request Input */}
            <div className="space-y-2">
              <Label htmlFor="request">Describe your request</Label>
              <Textarea
                id="request"
                placeholder="Describe the private work, output format, deadline, and review path."
                value={requestData}
                onChange={(e) => setRequestData(e.target.value)}
                rows={4}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">
                {requestData.length}/1000 characters - include output format, deadline, and review path.
              </p>
            </div>

            {/* Pricing */}
            <div className="space-y-3">
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                <div>
                  <p className="font-medium">Request Budget</p>
                  <p className="text-sm text-muted-foreground">
                    {getPricingLabel(agent.pricing.type)} - wallet-approved proof required
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-primary">
                    {formatPrice(agent.pricing.price)}
                  </p>
                </div>
              </div>

              {!connected && (
                <Alert>
                  <Wallet className="h-4 w-4" />
                  <AlertDescription>
                    Connect your wallet to continue to wallet approval.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </div>
        )}

        {step === 'confirm' && (
          <div className="space-y-6">
            <IntakeRail steps={intakeSteps} activeIndex={1} />

            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium">Private Deal Room Request</Label>
                <div className="mt-1 p-3 bg-muted/50 rounded-md text-sm">
                  {requestData}
                </div>
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">Wallet Authorization</p>
                  <p className="text-sm text-muted-foreground">
                    Approval creates a priced request; escrow proof is recorded before paid fulfillment proceeds.
                  </p>
                </div>
                <p className="text-xl font-bold text-primary">
                  {formatPrice(agent.pricing.price)}
                </p>
              </div>
            </div>

            <Alert>
              <Shield className="h-4 w-4" />
              <AlertDescription>
                The flow is request, wallet approval, escrow proof, seller delivery, and receipt. Wallet approval remains the control path.
              </AlertDescription>
            </Alert>
          </div>
        )}

        {step === 'processing' && (
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <IntakeRail steps={intakeSteps} activeIndex={2} />
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <div className="text-center">
              <p className="font-medium">Creating Private Deal Room request...</p>
              <p className="text-sm text-muted-foreground">
                Kairo is preparing the seller intake flow and receipt trail.
              </p>
            </div>
          </div>
        )}

        {step === 'success' && (
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <IntakeRail steps={intakeSteps} activeIndex={3} />
            <CheckCircle className="h-12 w-12 text-green-500" />
            <div className="text-center">
              <p className="font-medium">Request ready for intake</p>
              <p className="text-sm text-muted-foreground">
                {agent.name} can accept the work, submit delivery, and link the receipt from your dashboard.
              </p>
            </div>
          </div>
        )}

        <DialogFooter>
          {step === 'details' && (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              {connected ? (
                <Button onClick={handleSubmit} disabled={!requestData.trim()}>
                  Continue
                </Button>
              ) : (
                <WalletMultiButton className="!bg-primary hover:!bg-primary/90 !rounded-md !h-9 !px-4 !text-sm" />
              )}
            </>
          )}

          {step === 'confirm' && (
            <>
              <Button variant="outline" onClick={() => setStep('details')}>
                Back
              </Button>
              <Button onClick={handleConfirm} disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  `Authorize ${formatPrice(agent.pricing.price)}`
                )}
              </Button>
            </>
          )}

          {step === 'processing' && (
            <Button disabled className="w-full">
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Processing...
            </Button>
          )}

          {step === 'success' && (
            <Button onClick={handleClose} className="w-full">
              Close
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function IntakeRail({ steps, activeIndex }: { steps: Array<{ label: string; value: string }>; activeIndex: number }) {
  return (
    <div className="grid w-full grid-cols-2 gap-2 rounded-lg border border-white/8 bg-white/[0.02] p-3 sm:grid-cols-4">
      {steps.map((item, index) => (
        <div
          key={item.label}
          className={`min-w-0 rounded-md border px-3 py-2 ${
            index === activeIndex
              ? 'border-emerald-500/25 bg-emerald-500/5'
              : index < activeIndex
              ? 'border-emerald-500/15 bg-black/20'
              : 'border-white/8 bg-black/10'
          }`}
        >
          <p className="truncate text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{item.label}</p>
          <p className={`mt-1 truncate text-xs font-medium ${index <= activeIndex ? 'text-foreground' : 'text-muted-foreground'}`}>
            {item.value}
          </p>
        </div>
      ))}
    </div>
  )
}
