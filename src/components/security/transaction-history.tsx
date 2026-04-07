'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Clock, 
  Shield, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  Eye,
  Trash2,
  Download,
  Filter,
  Search,
  ChevronDown,
  ExternalLink
} from 'lucide-react'

interface ScanHistoryItem {
  id: string
  timestamp: string
  transactionSignature?: string
  walletAddress?: string
  riskLevel: 'SAFE' | 'CAUTION' | 'DANGER'
  riskScore: number
  scanTime: number
  threatCount: number
  summary: string
}

interface TransactionHistoryProps {
  userWallet?: string
  onViewDetails?: (scanId: string) => void
}

export function TransactionHistory({ userWallet, onViewDetails }: TransactionHistoryProps) {
  const [scanHistory, setScanHistory] = useState<ScanHistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'safe' | 'caution' | 'danger'>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  useEffect(() => {
    const loadScanHistory = async () => {
      setLoading(true)
      
      const sampleHistory: ScanHistoryItem[] = [
        {
          id: 'scan_001',
          timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30 minutes ago
          transactionSignature: '5KJp7KqprzQGAqjsQd4aMKvQrGYjBVqQpQzQzQzQzQzQzQzQzQzQzQzQzQzQzQzQ',
          riskLevel: 'SAFE',
          riskScore: 15,
          scanTime: 1847,
          threatCount: 0,
          summary: 'Standard token transfer to verified DEX'
        },
        {
          id: 'scan_002',
          timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
          walletAddress: 'DsVmA5QjRfzxLg9BvQpQ7QzQzQzQzQzQzQzQzQzQzQzQ',
          riskLevel: 'CAUTION',
          riskScore: 45,
          scanTime: 2134,
          threatCount: 2,
          summary: 'Unlimited token approval detected'
        },
        {
          id: 'scan_003',
          timestamp: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(), // 6 hours ago
          transactionSignature: '3MNp8KqprzQGAqjsQd4aMKvQrGYjBVqQpQzQzQzQzQzQzQzQzQzQzQzQzQzQzQzQ',
          riskLevel: 'DANGER',
          riskScore: 85,
          scanTime: 1923,
          threatCount: 5,
          summary: 'Wallet drainer pattern detected - BLOCKED'
        },
        {
          id: 'scan_004',
          timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), // 1 day ago
          walletAddress: 'FsVmA5QjRfzxLg9BvQpQ7QzQzQzQzQzQzQzQzQzQzQzQ',
          riskLevel: 'SAFE',
          riskScore: 8,
          scanTime: 1654,
          threatCount: 0,
          summary: 'NFT marketplace interaction verified'
        }
      ]

      await new Promise(resolve => setTimeout(resolve, 1000))
      setScanHistory(sampleHistory)
      setLoading(false)
    }

    loadScanHistory()
  }, [userWallet])

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'SAFE': return 'text-green-600 bg-green-50 border-green-200'
      case 'CAUTION': return 'text-orange-600 bg-orange-50 border-orange-200'
      case 'DANGER': return 'text-red-600 bg-red-50 border-red-200'
      default: return 'text-gray-600 bg-gray-50 border-gray-200'
    }
  }

  const getRiskIcon = (level: string) => {
    switch (level) {
      case 'SAFE': return CheckCircle
      case 'CAUTION': return AlertTriangle
      case 'DANGER': return XCircle
      default: return Shield
    }
  }

  const filteredHistory = scanHistory.filter(item => {
    const matchesFilter = filter === 'all' || item.riskLevel.toLowerCase() === filter
    const matchesSearch = searchTerm === '' || 
      item.summary.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.transactionSignature?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.walletAddress?.toLowerCase().includes(searchTerm.toLowerCase())
    
    return matchesFilter && matchesSearch
  })

  const exportHistory = () => {
    const dataStr = JSON.stringify(scanHistory, null, 2)
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr)
    
    const exportFileDefaultName = `security-scan-history-${new Date().toISOString().split('T')[0]}.json`
    
    const linkElement = document.createElement('a')
    linkElement.setAttribute('href', dataUri)
    linkElement.setAttribute('download', exportFileDefaultName)
    linkElement.click()
  }

  const clearHistory = () => {
    if (confirm('Are you sure you want to clear all scan history? This action cannot be undone.')) {
      setScanHistory([])
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Scan History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
            <span className="ml-2 text-gray-600">Loading scan history...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <Clock className="h-5 w-5 text-red-600" />
              <span>Scan History</span>
              <Badge variant="secondary" className="ml-2">
                {scanHistory.length} scans
              </Badge>
            </CardTitle>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center space-x-1"
              >
                <Filter className="h-4 w-4" />
                <span>Filter</span>
                <ChevronDown className={`h-4 w-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={exportHistory}
                className="flex items-center space-x-1"
              >
                <Download className="h-4 w-4" />
                <span>Export</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={clearHistory}
                className="flex items-center space-x-1 text-red-600 hover:text-red-700"
              >
                <Trash2 className="h-4 w-4" />
                <span>Clear</span>
              </Button>
            </div>
          </div>
        </CardHeader>
        
        {showFilters && (
          <CardContent className="pt-0">
            <div className="flex flex-col sm:flex-row gap-4 p-4 bg-gray-50 rounded-lg">
              <div className="flex-1">
                <label className="text-sm font-medium mb-2 block">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search by signature, address, or description..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Risk Level</label>
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value as any)}
                  className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                >
                  <option value="all">All Levels</option>
                  <option value="safe">Safe Only</option>
                  <option value="caution">Caution Only</option>
                  <option value="danger">Danger Only</option>
                </select>
              </div>
            </div>
          </CardContent>
        )}

        <CardContent className={showFilters ? 'pt-0' : ''}>
          {filteredHistory.length === 0 ? (
            <div className="text-center py-8">
              <Shield className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No scan history found</h3>
              <p className="text-gray-500">
                {scanHistory.length === 0 
                  ? "Start scanning transactions to build your security history."
                  : "No scans match your current filters."
                }
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredHistory.map((scan) => {
                const RiskIcon = getRiskIcon(scan.riskLevel)
                const colors = getRiskColor(scan.riskLevel)
                
                return (
                  <div key={scan.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3 flex-1">
                        <RiskIcon className={`h-5 w-5 mt-0.5 ${colors.split(' ')[0]}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2 mb-1">
                            <Badge className={colors}>
                              {scan.riskLevel}
                            </Badge>
                            <span className="text-sm text-gray-500">
                              Risk Score: {scan.riskScore}/100
                            </span>
                            {scan.threatCount > 0 && (
                              <span className="text-sm text-red-600 font-medium">
                                {scan.threatCount} threats
                              </span>
                            )}
                          </div>
                          
                          <p className="text-sm text-gray-900 mb-2">{scan.summary}</p>
                          
                          <div className="flex items-center space-x-4 text-xs text-gray-500">
                            <span className="flex items-center space-x-1">
                              <Clock className="h-3 w-3" />
                              <span>{new Date(scan.timestamp).toLocaleString()}</span>
                            </span>
                            <span>Scan time: {scan.scanTime}ms</span>
                            {scan.transactionSignature && (
                              <span className="flex items-center space-x-1">
                                <ExternalLink className="h-3 w-3" />
                                <span>Tx: {scan.transactionSignature.slice(0, 8)}...</span>
                              </span>
                            )}
                            {scan.walletAddress && (
                              <span>Wallet: {scan.walletAddress.slice(0, 8)}...</span>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onViewDetails?.(scan.id)}
                        className="flex items-center space-x-1 ml-4"
                      >
                        <Eye className="h-4 w-4" />
                        <span>Details</span>
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}