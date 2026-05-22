import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatSOL(lamports: number): string {
  const sol = lamports / 1_000_000_000
  if (sol < 0.01) {
    return `${Math.round(lamports / 1000)}k lamports`
  }
  return `${sol.toFixed(sol < 1 ? 3 : 2)} SOL`
}

export function formatNumber(num: number): string {
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(1)}M`
  }
  if (num >= 1_000) {
    return `${(num / 1_000).toFixed(1)}K`
  }
  return num.toString()
}

export function formatTimeAgo(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp
  
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  
  if (days > 0) return `${days}d ago`
  if (hours > 0) return `${hours}h ago`
  if (minutes > 0) return `${minutes}m ago`
  return `${seconds}s ago`
}

export function truncateAddress(address: string, chars = 4): string {
  return `${address.slice(0, chars)}...${address.slice(-chars)}`
}

export function getRiskColor(riskLevel: string): string {
  switch (riskLevel.toUpperCase()) {
    case 'SAFE':
      return 'text-green-600 bg-green-50 border-green-200 dark:text-green-400 dark:bg-green-950 dark:border-green-800'
    case 'CAUTION':
      return 'text-orange-600 bg-orange-50 border-orange-200 dark:text-orange-400 dark:bg-orange-950 dark:border-orange-800'
    case 'DANGER':
      return 'text-red-600 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-950 dark:border-red-800'
    default:
      return 'text-gray-600 bg-gray-50 border-gray-200 dark:text-gray-400 dark:bg-gray-950 dark:border-gray-800'
  }
}

export function getCapabilityColor(capability: string): string {
  const normalizedCap = capability.toLowerCase()
  
  if (normalizedCap.includes('security')) {
    return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-800'
  }
  if (normalizedCap.includes('code')) {
    return 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950 dark:text-purple-400 dark:border-purple-800'
  }
  if (normalizedCap.includes('design')) {
    return 'bg-pink-100 text-pink-800 border-pink-200 dark:bg-pink-950 dark:text-pink-400 dark:border-pink-800'
  }
  if (normalizedCap.includes('data') || normalizedCap.includes('analysis')) {
    return 'bg-green-100 text-green-800 border-green-200 dark:bg-green-950 dark:text-green-400 dark:border-green-800'
  }
  if (normalizedCap.includes('defi') || normalizedCap.includes('yield')) {
    return 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-400 dark:border-yellow-800'
  }
  
  return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-950 dark:text-gray-400 dark:border-gray-800'
}