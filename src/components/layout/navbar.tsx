'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useWallet } from '@solana/wallet-adapter-react'
import { useWalletModal } from '@solana/wallet-adapter-react-ui'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import {
  Menu,
  Store,
  BarChart3,
  FileText,
  Plus,
  ShieldCheck,
  Loader2,
  ChevronDown,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useWalletAuth } from '@/hooks/use-wallet-auth'

const navigation = [
  { name: 'Marketplace', href: '/marketplace', icon: Store },
  { name: 'Activity', href: '/receipts', icon: FileText },
  { name: 'Dashboard', href: '/dashboard', icon: BarChart3 },
  { name: 'Docs', href: '/api-docs', icon: FileText },
]

function compactWallet(address: string) {
  return `${address.slice(0, 5)}...${address.slice(-5)}`
}

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false)
  const [walletMenuOpen, setWalletMenuOpen] = useState(false)
  const pathname = usePathname()
  const { publicKey, connected } = useWallet()
  const { setVisible } = useWalletModal()
  const { isAuthenticated, isAuthenticating, wallet: verifiedWallet, signOut } = useWalletAuth({
    autoAuthenticate: false,
    authenticateOnWalletChange: true,
  })
  const walletAddress = publicKey?.toBase58()
  const isCurrentWalletVerified = Boolean(
    isAuthenticated && walletAddress && verifiedWallet === walletAddress
  )

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/6 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 max-w-full items-center justify-between px-4 sm:px-8">
        {/* Logo */}
        <Link href="/" className="flex items-center space-x-2 group">
          <Image
            src="/logo.png"
            alt="Kairo Logo"
            width={32}
            height={32}
            className="h-8 w-8 rounded-lg ring-1 ring-emerald-400/30 transition-all duration-200 group-hover:ring-emerald-400/60 group-hover:shadow-[0_0_12px_rgba(16,185,129,0.4)]"
            priority
          />
          <span className="font-bold text-xl tracking-tight group-hover:text-emerald-400/90 transition-colors duration-200">Kairo</span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden lg:flex items-center space-x-6">
          {navigation.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'flex items-center space-x-2 text-sm font-medium transition-colors hover:text-foreground relative',
                  pathname === item.href || pathname.startsWith(item.href + '/')
                    ? 'text-emerald-400'
                    : 'text-muted-foreground hover:text-foreground/80'
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{item.name}</span>
                {(pathname === item.href || pathname.startsWith(item.href + '/')) && (
                  <span className="absolute -bottom-1 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-500/70 to-transparent" />
                )}
              </Link>
            )
          })}
        </nav>

        {/* Desktop Actions */}
        <div className="hidden lg:flex items-center space-x-3">
          <Button asChild variant="outline" size="sm" className="border-white/10 hover:border-white/20">
            <Link href="/agents/register">
              <Plus className="h-4 w-4 mr-2" />
              List an Agent
            </Link>
          </Button>
          {isAuthenticating && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span className="hidden lg:inline">Signing in…</span>
            </div>
          )}
          {isCurrentWalletVerified && !isAuthenticating && (
            <div className="flex items-center gap-1 text-xs text-emerald-400" title="Wallet authenticated">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span className="hidden lg:inline">Verified</span>
            </div>
          )}
          <div className="relative">
            <Button
              type="button"
              onClick={() => {
                if (!connected) {
                  setVisible(true)
                  return
                }
                setWalletMenuOpen((open) => !open)
              }}
              className="h-9 bg-emerald-500 px-4 text-sm font-semibold text-black hover:bg-emerald-400"
            >
              {walletAddress ? compactWallet(walletAddress) : 'Select Wallet'}
              {walletAddress && <ChevronDown className="ml-2 h-3.5 w-3.5" />}
            </Button>
            {walletAddress && walletMenuOpen && (
              <div className="absolute right-0 top-[calc(100%+0.5rem)] z-[100] min-w-36 rounded-xl border border-white/10 bg-[#050807] p-1 shadow-[0_16px_48px_rgba(0,0,0,0.45)]">
                <button
                  type="button"
                  onClick={() => {
                    setWalletMenuOpen(false)
                    signOut()
                  }}
                  className="w-full rounded-lg px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-white/8 hover:text-foreground"
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Mobile Menu */}
        <div className="flex items-center space-x-2 lg:hidden">
          {isAuthenticating && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          {isCurrentWalletVerified && !isAuthenticating && (
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
          )}
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="sm">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-80">
              <div className="flex flex-col space-y-6 mt-6">
                <div className="flex items-center gap-2">
                  <Image
                    src="/logo.png"
                    alt="Kairo Logo"
                    width={32}
                    height={32}
                    className="h-8 w-8 rounded-lg ring-1 ring-emerald-400/30"
                    priority
                  />
                  <span className="font-bold text-xl tracking-tight">Kairo</span>
                </div>
                <nav className="flex flex-col space-y-4">
                  {navigation.map((item) => {
                    const Icon = item.icon
                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        onClick={() => setIsOpen(false)}
                        className={cn(
                          'flex items-center space-x-3 text-sm font-medium transition-colors hover:text-foreground p-2 rounded-md',
                          pathname === item.href || pathname.startsWith(item.href + '/')
                            ? 'text-foreground bg-white/5'
                            : 'text-muted-foreground hover:bg-white/5'
                        )}
                      >
                        <Icon className="h-5 w-5" />
                        <span>{item.name}</span>
                      </Link>
                    )
                  })}
                </nav>

                <div className="flex flex-col space-y-3 pt-4 border-t border-white/8">
                  <Button asChild className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-semibold">
                    <Link href="/agents/register" onClick={() => setIsOpen(false)}>
                      <Plus className="h-4 w-4 mr-2" />
                      List an Agent
                    </Link>
                  </Button>
                  <div className="relative w-full">
                    <Button
                      type="button"
                      onClick={() => {
                        if (!connected) {
                          setVisible(true)
                          return
                        }
                        setWalletMenuOpen((open) => !open)
                      }}
                      className="h-10 w-full bg-white/5 text-foreground hover:bg-white/10"
                    >
                      {walletAddress ? compactWallet(walletAddress) : 'Select Wallet'}
                      {walletAddress && <ChevronDown className="ml-2 h-3.5 w-3.5" />}
                    </Button>
                    {walletAddress && walletMenuOpen && (
                      <div className="mt-2 rounded-xl border border-white/10 bg-white/[0.03] p-1">
                        <button
                          type="button"
                          onClick={() => {
                            setWalletMenuOpen(false)
                            setIsOpen(false)
                            signOut()
                          }}
                          className="w-full rounded-lg px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-white/8 hover:text-foreground"
                        >
                          Sign out
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}
