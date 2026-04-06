'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Copy, Check } from 'lucide-react'

interface SyntaxHighlighterProps {
  content: string
  className?: string
}

export function SyntaxHighlighter({ content, className = '' }: SyntaxHighlighterProps) {
  const [copiedItems, setCopiedItems] = useState<Set<string>>(new Set())

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedItems(prev => new Set(prev).add(text))
      setTimeout(() => {
        setCopiedItems(prev => {
          const newSet = new Set(prev)
          newSet.delete(text)
          return newSet
        })
      }, 2000)
    } catch (err) {
      console.error('Failed to copy text: ', err)
    }
  }

  const formatContent = (text: string) => {
    // Solana address pattern (base58, 32-44 characters)
    const addressRegex = /\b([1-9A-HJ-NP-Za-km-z]{32,44})\b/g
    
    // Transaction signature pattern (base58, typically 64-88 characters)
    const txRegex = /\b([1-9A-HJ-NP-Za-km-z]{64,88})\b/g
    
    // Program ID pattern (common Solana program IDs)
    const programRegex = /\b(TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA|11111111111111111111111111111112|So11111111111111111111111111111111111111112|ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL)\b/g
    
    // SOL amount pattern
    const solAmountRegex = /\b(\d+(?:\.\d+)?)\s*(SOL|sol)\b/g
    
    let formattedText = text
    const elements: JSX.Element[] = []
    let lastIndex = 0

    // Find all matches and their positions
    const matches: Array<{
      match: string
      index: number
      type: 'address' | 'transaction' | 'program' | 'amount'
      length: number
    }> = []

    // Collect all matches
    let match
    while ((match = addressRegex.exec(text)) !== null) {
      matches.push({
        match: match[1],
        index: match.index,
        type: 'address',
        length: match[1].length
      })
    }

    while ((match = txRegex.exec(text)) !== null) {
      matches.push({
        match: match[1],
        index: match.index,
        type: 'transaction',
        length: match[1].length
      })
    }

    while ((match = programRegex.exec(text)) !== null) {
      matches.push({
        match: match[1],
        index: match.index,
        type: 'program',
        length: match[1].length
      })
    }

    while ((match = solAmountRegex.exec(text)) !== null) {
      matches.push({
        match: match[0],
        index: match.index,
        type: 'amount',
        length: match[0].length
      })
    }

    // Sort matches by index
    matches.sort((a, b) => a.index - b.index)

    // Remove overlapping matches (keep the first one)
    const filteredMatches = matches.filter((current, index) => {
      if (index === 0) return true
      const previous = matches[index - 1]
      return current.index >= previous.index + previous.length
    })

    // Build the formatted content
    filteredMatches.forEach((matchInfo, index) => {
      // Add text before this match
      if (matchInfo.index > lastIndex) {
        elements.push(
          <span key={`text-${index}`}>
            {text.slice(lastIndex, matchInfo.index)}
          </span>
        )
      }

      // Add the highlighted match
      const getHighlightStyle = (type: string) => {
        switch (type) {
          case 'address':
            return 'bg-blue-100 text-blue-800 border border-blue-200'
          case 'transaction':
            return 'bg-purple-100 text-purple-800 border border-purple-200'
          case 'program':
            return 'bg-green-100 text-green-800 border border-green-200'
          case 'amount':
            return 'bg-orange-100 text-orange-800 border border-orange-200'
          default:
            return 'bg-gray-100 text-gray-800 border border-gray-200'
        }
      }

      const truncateText = (text: string, maxLength: number = 16) => {
        if (text.length <= maxLength) return text
        return `${text.slice(0, 6)}...${text.slice(-6)}`
      }

      elements.push(
        <span
          key={`match-${index}`}
          className={`inline-flex items-center space-x-1 px-2 py-1 rounded font-mono text-xs ${getHighlightStyle(matchInfo.type)}`}
        >
          <span title={matchInfo.match}>
            {matchInfo.type === 'amount' ? matchInfo.match : truncateText(matchInfo.match)}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-4 w-4 p-0 hover:bg-white/50"
            onClick={() => copyToClipboard(matchInfo.match)}
            title={`Copy ${matchInfo.type}`}
          >
            {copiedItems.has(matchInfo.match) ? (
              <Check className="h-3 w-3 text-green-600" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
          </Button>
        </span>
      )

      lastIndex = matchInfo.index + matchInfo.length
    })

    // Add remaining text
    if (lastIndex < text.length) {
      elements.push(
        <span key="text-end">
          {text.slice(lastIndex)}
        </span>
      )
    }

    return elements.length > 0 ? elements : [<span key="original">{text}</span>]
  }

  return (
    <div className={`whitespace-pre-wrap ${className}`}>
      {formatContent(content)}
    </div>
  )
}

// Helper component for displaying code blocks with syntax highlighting
export function CodeBlock({ 
  code, 
  language = 'text',
  title 
}: { 
  code: string
  language?: string
  title?: string 
}) {
  const [copied, setCopied] = useState(false)

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy code: ', err)
    }
  }

  return (
    <div className="bg-gray-900 rounded-lg overflow-hidden">
      {title && (
        <div className="bg-gray-800 px-4 py-2 text-sm text-gray-300 border-b border-gray-700">
          {title}
        </div>
      )}
      <div className="relative">
        <pre className="p-4 text-sm text-gray-100 overflow-x-auto">
          <code className={`language-${language}`}>
            {code}
          </code>
        </pre>
        <Button
          variant="ghost"
          size="sm"
          className="absolute top-2 right-2 h-8 w-8 p-0 text-gray-400 hover:text-gray-200 hover:bg-gray-700"
          onClick={copyCode}
        >
          {copied ? (
            <Check className="h-4 w-4 text-green-400" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  )
}