'use client'

import { useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useToast } from '@/hooks/use-toast'
import { CATEGORIES } from '@/lib/data/agents'
import {
  Wallet,
  Loader2,
  CheckCircle,
  AlertTriangle,
  Plus,
  X,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

const MIN_AGENT_PRICE_SOL = 0.01

export default function RegisterAgentPage() {
  const { connected, publicKey } = useWallet()
  const { toast } = useToast()
  const router = useRouter()

  const [formData, setFormData] = useState({
    name: '',
    category: 'Research',
    description: '',
    endpoint: '',
    price: '',
  })
  const [capabilities, setCapabilities] = useState<string[]>([])
  const [capabilityInput, setCapabilityInput] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    })
  }

  const handleAddCapability = () => {
    const trimmed = capabilityInput.trim()
    if (trimmed && !capabilities.includes(trimmed)) {
      setCapabilities([...capabilities, trimmed])
      setCapabilityInput('')
    }
  }

  const handleRemoveCapability = (capability: string) => {
    setCapabilities(capabilities.filter(c => c !== capability))
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddCapability()
    }
  }

  const validateForm = () => {
    if (!formData.name.trim()) {
      setError('Agent name is required')
      return false
    }
    if (!formData.description.trim()) {
      setError('Description is required')
      return false
    }
    if (!CATEGORIES.includes(formData.category)) {
      setError('Classification is required')
      return false
    }
    const price = parseFloat(formData.price)
    if (!formData.price || !Number.isFinite(price)) {
      setError('Valid price is required')
      return false
    }
    if (price < MIN_AGENT_PRICE_SOL) {
      setError(`Price per Query must be at least ${MIN_AGENT_PRICE_SOL.toFixed(2)} SOL`)
      return false
    }
    if (capabilities.length === 0) {
      setError('At least one capability is required')
      return false
    }
    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!connected || !publicKey) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet to register an agent.",
        variant: "destructive",
      })
      return
    }

    if (!validateForm()) {
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const response = await fetch('/api/agents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          category: formData.category,
          description: formData.description.trim(),
          capabilities,
          pricing: {
            type: 'per_query',
            price: parseFloat(formData.price),
            currency: 'SOL',
          },
          endpoint: formData.endpoint.trim() || undefined,
          creatorWallet: publicKey.toString(),
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to register agent')
      }

      const data = await response.json()

      toast({
        title: "Agent registered successfully!",
        description: `Your agent "${formData.name}" has been registered with ID: ${data.agent.agentId}`,
      })

      // Redirect to marketplace after short delay
      setTimeout(() => {
        router.push('/marketplace')
      }, 2000)

    } catch (err) {
      console.error('Failed to register agent:', err)
      setError(err instanceof Error ? err.message : 'Failed to register agent')
      toast({
        title: "Registration failed",
        description: err instanceof Error ? err.message : "Failed to register agent. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!connected) {
    return (
      <div className="container py-20">
        <div className="max-w-2xl mx-auto text-center space-y-6">
          <Wallet className="h-16 w-16 mx-auto text-muted-foreground" />
          <div>
            <h1 className="text-3xl font-bold mb-2">Connect Your Wallet</h1>
            <p className="text-muted-foreground">
              Connect your Solana wallet to register your AI agent on the marketplace.
            </p>
          </div>
          <WalletMultiButton className="!bg-primary hover:!bg-primary/90 !rounded-md !h-10 !px-6" />
        </div>
      </div>
    )
  }

  return (
    <div className="container py-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Register Your AI Agent</h1>
          <p className="text-muted-foreground">
            List your AI agent on the marketplace and start earning from your services.
          </p>
        </div>

        {/* Info Alert */}
        <Alert className="mb-6">
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            Your agent will be registered as an NFT on Solana. You&apos;ll earn 85% of all service fees.
          </AlertDescription>
        </Alert>

        {/* Registration Form */}
        <Card>
          <CardHeader>
            <CardTitle>Agent Details</CardTitle>
            <CardDescription>
              Provide information about your AI agent
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Agent Name */}
              <div className="space-y-2">
                <Label htmlFor="name">Agent Name *</Label>
                <Input
                  id="name"
                  name="name"
                  placeholder="e.g., Contract Auditor"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                />
              </div>

              {/* Classification */}
              <div className="space-y-2">
                <Label htmlFor="category">Classification *</Label>
                <select
                  id="category"
                  name="category"
                  value={formData.category}
                  onChange={handleInputChange}
                  required
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  This controls how the agent appears in marketplace classification filters.
                </p>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">Description *</Label>
                <Textarea
                  id="description"
                  name="description"
                  placeholder="Describe what your agent does and its key features..."
                  value={formData.description}
                  onChange={handleInputChange}
                  rows={4}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  {formData.description.length}/500 characters
                </p>
              </div>

              {/* Capabilities */}
              <div className="space-y-2">
                <Label htmlFor="capabilities">Capabilities *</Label>
                <div className="flex space-x-2">
                  <Input
                    id="capabilities"
                    placeholder="e.g., Security, Analysis, Real-time"
                    value={capabilityInput}
                    onChange={(e) => setCapabilityInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                  />
                  <Button
                    type="button"
                    onClick={handleAddCapability}
                    variant="outline"
                    size="icon"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {capabilities.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {capabilities.map((capability) => (
                      <Badge key={capability} variant="secondary" className="px-3 py-1">
                        {capability}
                        <button
                          type="button"
                          onClick={() => handleRemoveCapability(capability)}
                          className="ml-2 hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Press Enter or click + to add capabilities
                </p>
              </div>

              {/* Price */}
              <div className="space-y-2">
                <Label htmlFor="price">Price per Query (SOL) *</Label>
                <Input
                  id="price"
                  name="price"
                  type="number"
                  step="0.01"
                  min={MIN_AGENT_PRICE_SOL}
                  placeholder="0.01"
                  value={formData.price}
                  onChange={handleInputChange}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  You&apos;ll receive 85% of this amount per service request
                </p>
              </div>

              {/* Endpoint (Optional) */}
              <div className="space-y-2">
                <Label htmlFor="endpoint">API Endpoint (Optional)</Label>
                <Input
                  id="endpoint"
                  name="endpoint"
                  type="url"
                  placeholder="https://your-agent-api.com"
                  value={formData.endpoint}
                  onChange={handleInputChange}
                />
                <p className="text-xs text-muted-foreground">
                  URL where your agent receives service requests
                </p>
              </div>

              {/* Error Alert */}
              {error && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* Submit Buttons */}
              <div className="flex gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push('/marketplace')}
                  disabled={isSubmitting}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Registering...
                    </>
                  ) : (
                    'Register Agent'
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Help Text */}
        <div className="mt-6 text-center text-sm text-muted-foreground">
          <p>
            Need help? Check out our{' '}
            <Link href="/api-docs" className="text-primary hover:underline">
              API documentation
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
