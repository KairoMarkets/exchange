'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  Shield, 
  TrendingUp, 
  Clock, 
  AlertTriangle,
  CheckCircle,
  Users,
  Zap,
  Eye,
  Calendar,
  BarChart3
} from 'lucide-react'

interface SecurityStats {
  totalScans: number
  threatsBlocked: number
  avgScanTime: number
  accuracyRate: number
  lastScanTime?: string
  riskDistribution: {
    safe: number
    caution: number
    danger: number
  }
}

interface RecentThreat {
  id: string
  type: string
  timestamp: string
  severity: 'HIGH' | 'MEDIUM' | 'LOW'
  description: string
  blocked: boolean
}

interface SecurityDashboardProps {
  userWallet?: string
}

export function SecurityDashboard({ userWallet }: SecurityDashboardProps) {
  const [stats, setStats] = useState<SecurityStats>({
    totalScans: 0,
    threatsBlocked: 0,
    avgScanTime: 0,
    accuracyRate: 0,
    riskDistribution: { safe: 0, caution: 0, danger: 0 }
  })
  const [recentThreats, setRecentThreats] = useState<RecentThreat[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Simulate loading dashboard data
    const loadDashboardData = async () => {
      setLoading(true)
      
      // Mock data - in real implementation, this would fetch from API
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      setStats({
        totalScans: 1247,
        threatsBlocked: 89,
        avgScanTime: 1.8,
        accuracyRate: 99.8,
        lastScanTime: new Date(Date.now() - 1000 * 60 * 15).toISOString(), // 15 minutes ago
        riskDistribution: {
          safe: 1098,
          caution: 60,
          danger: 89
        }
      })

      setRecentThreats([
        {
          id: 'threat_001',
          type: 'Wallet Drainer',
          timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
          severity: 'HIGH',
          description: 'Malicious contract attempting to drain all tokens',
          blocked: true
        },
        {
          id: 'threat_002',
          type: 'Phishing Contract',
          timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
          severity: 'MEDIUM',
          description: 'Fake DEX interface mimicking legitimate protocol',
          blocked: true
        },
        {
          id: 'threat_003',
          type: 'Unlimited Approval',
          timestamp: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(),
          severity: 'MEDIUM',
          description: 'Transaction requesting excessive token permissions',
          blocked: false
        }
      ])
      
      setLoading(false)
    }

    loadDashboardData()
  }, [userWallet])

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'HIGH': return 'text-red-600 bg-red-50 border-red-200'
      case 'MEDIUM': return 'text-orange-600 bg-orange-50 border-orange-200'
      case 'LOW': return 'text-yellow-600 bg-yellow-50 border-yellow-200'
      default: return 'text-gray-600 bg-gray-50 border-gray-200'
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 bg-gray-200 rounded mb-2"></div>
                <div className="h-8 bg-gray-200 rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Scans</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalScans.toLocaleString()}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-full">
                <BarChart3 className="h-6 w-6 text-blue-600" />
              </div>
            </div>
            <div className="mt-2 flex items-center text-sm">
              <TrendingUp className="h-4 w-4 text-green-600 mr-1" />
              <span className="text-green-600">+12% from last month</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Threats Blocked</p>
                <p className="text-2xl font-bold text-red-600">{stats.threatsBlocked}</p>
              </div>
              <div className="p-3 bg-red-100 rounded-full">
                <Shield className="h-6 w-6 text-red-600" />
              </div>
            </div>
            <div className="mt-2 flex items-center text-sm">
              <AlertTriangle className="h-4 w-4 text-orange-600 mr-1" />
              <span className="text-orange-600">7 in last 24h</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Avg Scan Time</p>
                <p className="text-2xl font-bold text-blue-600">{stats.avgScanTime}s</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-full">
                <Clock className="h-6 w-6 text-blue-600" />
              </div>
            </div>
            <div className="mt-2 flex items-center text-sm">
              <Zap className="h-4 w-4 text-green-600 mr-1" />
              <span className="text-green-600">0.3s faster than target</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Accuracy Rate</p>
                <p className="text-2xl font-bold text-green-600">{stats.accuracyRate}%</p>
              </div>
              <div className="p-3 bg-green-100 rounded-full">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
            </div>
            <div className="mt-2 flex items-center text-sm">
              <TrendingUp className="h-4 w-4 text-green-600 mr-1" />
              <span className="text-green-600">Above 99% target</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Risk Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <BarChart3 className="h-5 w-5 text-blue-600" />
              <span>Risk Distribution</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-sm font-medium">Safe</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600">{stats.riskDistribution.safe}</span>
                  <span className="text-xs text-gray-500">
                    ({Math.round((stats.riskDistribution.safe / stats.totalScans) * 100)}%)
                  </span>
                </div>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-green-500 h-2 rounded-full" 
                  style={{ width: `${(stats.riskDistribution.safe / stats.totalScans) * 100}%` }}
                ></div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                  <span className="text-sm font-medium">Caution</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600">{stats.riskDistribution.caution}</span>
                  <span className="text-xs text-gray-500">
                    ({Math.round((stats.riskDistribution.caution / stats.totalScans) * 100)}%)
                  </span>
                </div>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-orange-500 h-2 rounded-full" 
                  style={{ width: `${(stats.riskDistribution.caution / stats.totalScans) * 100}%` }}
                ></div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  <span className="text-sm font-medium">Danger</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600">{stats.riskDistribution.danger}</span>
                  <span className="text-xs text-gray-500">
                    ({Math.round((stats.riskDistribution.danger / stats.totalScans) * 100)}%)
                  </span>
                </div>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-red-500 h-2 rounded-full" 
                  style={{ width: `${(stats.riskDistribution.danger / stats.totalScans) * 100}%` }}
                ></div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Threats */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <span>Recent Threats</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentThreats.map((threat) => (
                <div key={threat.id} className="flex items-start space-x-3 p-3 border rounded-lg">
                  <div className={`p-1 rounded-full ${
                    threat.blocked ? 'bg-green-100' : 'bg-orange-100'
                  }`}>
                    {threat.blocked ? (
                      <Shield className="h-4 w-4 text-green-600" />
                    ) : (
                      <Eye className="h-4 w-4 text-orange-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="text-sm font-medium">{threat.type}</span>
                      <Badge className={getSeverityColor(threat.severity)}>
                        {threat.severity}
                      </Badge>
                      {threat.blocked && (
                        <Badge className="text-green-600 bg-green-50 border-green-200">
                          BLOCKED
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mb-1">{threat.description}</p>
                    <div className="flex items-center text-xs text-gray-500">
                      <Calendar className="h-3 w-3 mr-1" />
                      <span>{new Date(threat.timestamp).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 text-center">
              <Button variant="outline" size="sm">
                View All Threats
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Last Scan Info */}
      {stats.lastScanTime && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Clock className="h-4 w-4 text-gray-500" />
                <span className="text-sm text-gray-600">
                  Last scan: {new Date(stats.lastScanTime).toLocaleString()}
                </span>
              </div>
              <Button size="sm" className="bg-red-600 hover:bg-red-700">
                Scan New Transaction
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}