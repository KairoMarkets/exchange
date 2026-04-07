'use client'

import { useState, useCallback, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { 
  Upload, 
  Wallet, 
  Clipboard, 
  X,
  FileText,
  Link as LinkIcon,
  AlertCircle
} from 'lucide-react'

interface TransactionInputProps {
  onTransactionSubmit: (data: string, type: 'paste' | 'file' | 'wallet') => void
  isScanning: boolean
}

export function TransactionInput({ onTransactionSubmit, isScanning }: TransactionInputProps) {
  const [inputMethod, setInputMethod] = useState<'paste' | 'file' | 'wallet'>('paste')
  const [transactionData, setTransactionData] = useState('')
  const [walletAddress, setWalletAddress] = useState('')
  const [dragActive, setDragActive] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleSubmit = () => {
    setError('')
    
    if (inputMethod === 'paste' && transactionData.trim()) {
      onTransactionSubmit(transactionData.trim(), 'paste')
    } else if (inputMethod === 'wallet' && walletAddress.trim()) {
      // Basic Solana address validation
      if (walletAddress.length < 32 || walletAddress.length > 44) {
        setError('Invalid Solana address format')
        return
      }
      onTransactionSubmit(walletAddress.trim(), 'wallet')
    } else {
      setError('Please provide transaction data or wallet address')
    }
  }

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    setError('')

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0]
      if (file.type === 'text/plain' || file.name.endsWith('.txt') || file.name.endsWith('.json')) {
        const reader = new FileReader()
        reader.onload = (event) => {
          const content = event.target?.result as string
          if (content) {
            setTransactionData(content)
            setInputMethod('file')
            onTransactionSubmit(content, 'file')
          }
        }
        reader.readAsText(file)
      } else {
        setError('Please upload a text or JSON file')
      }
    }
  }, [onTransactionSubmit])

  const handleFileSelect = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setError('')
      const reader = new FileReader()
      reader.onload = (event) => {
        const content = event.target?.result as string
        if (content) {
          setTransactionData(content)
          setInputMethod('file')
          onTransactionSubmit(content, 'file')
        }
      }
      reader.readAsText(file)
    }
  }

  const clearInput = () => {
    setTransactionData('')
    setWalletAddress('')
    setError('')
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <FileText className="h-5 w-5 text-red-600" />
          <span>Transaction Input</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Input Method Selector */}
        <div className="flex space-x-2">
          <Button
            variant={inputMethod === 'paste' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setInputMethod('paste')}
            className="flex items-center space-x-1"
          >
            <Clipboard className="h-4 w-4" />
            <span>Paste</span>
          </Button>
          <Button
            variant={inputMethod === 'file' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setInputMethod('file')}
            className="flex items-center space-x-1"
          >
            <Upload className="h-4 w-4" />
            <span>Upload</span>
          </Button>
          <Button
            variant={inputMethod === 'wallet' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setInputMethod('wallet')}
            className="flex items-center space-x-1"
          >
            <Wallet className="h-4 w-4" />
            <span>Wallet</span>
          </Button>
        </div>

        {/* Input Areas */}
        {inputMethod === 'paste' && (
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Transaction Data or Signature
            </label>
            <div className="relative">
              <Textarea
                placeholder="Paste your Solana transaction data, signature, or base64 encoded transaction here..."
                value={transactionData}
                onChange={(e) => setTransactionData(e.target.value)}
                rows={6}
                className="resize-none"
              />
              {transactionData && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearInput}
                  className="absolute top-2 right-2 h-6 w-6 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        )}

        {inputMethod === 'file' && (
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Upload Transaction File
            </label>
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                dragActive 
                  ? 'border-red-500 bg-red-50' 
                  : 'border-gray-300 hover:border-gray-400'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <Upload className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p className="text-lg font-medium mb-2">
                Drop transaction file here
              </p>
              <p className="text-sm text-gray-500 mb-4">
                or click to browse (.txt, .json files)
              </p>
              <Button onClick={handleFileSelect} variant="outline">
                Select File
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.json"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
          </div>
        )}

        {inputMethod === 'wallet' && (
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Wallet Address
            </label>
            <div className="relative">
              <div className="flex">
                <div className="flex items-center px-3 bg-gray-50 border border-r-0 rounded-l-md">
                  <LinkIcon className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder="Enter Solana wallet address to analyze recent transactions"
                  value={walletAddress}
                  onChange={(e) => setWalletAddress(e.target.value)}
                  className="flex-1 px-3 py-2 border rounded-r-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                />
              </div>
              {walletAddress && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearInput}
                  className="absolute top-2 right-2 h-6 w-6 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="flex items-center space-x-2 text-red-600 text-sm">
            <AlertCircle className="h-4 w-4" />
            <span>{error}</span>
          </div>
        )}

        {/* Scan Button */}
        <Button 
          onClick={handleSubmit}
          disabled={
            isScanning || 
            (inputMethod === 'paste' && !transactionData.trim()) ||
            (inputMethod === 'wallet' && !walletAddress.trim())
          }
          className="w-full bg-red-600 hover:bg-red-700"
          size="lg"
        >
          {isScanning ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Scanning Transaction...
            </>
          ) : (
            <>
              <FileText className="h-4 w-4 mr-2" />
              Scan for Threats
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  )
}