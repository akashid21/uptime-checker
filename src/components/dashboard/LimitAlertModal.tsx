'use client'

import { AlertTriangle, X, ShieldAlert, Zap } from 'lucide-react'

interface LimitAlertModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  description: string
  limitType: 'projects' | 'monitors'
}

export default function LimitAlertModal({
  isOpen,
  onClose,
  title,
  description,
  limitType,
}: LimitAlertModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-slate-900 border border-amber-500/30 rounded-2xl p-6 shadow-2xl glow-indigo">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Warning Icon */}
        <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mb-4">
          <AlertTriangle className="w-6 h-6 animate-pulse" />
        </div>

        {/* Header */}
        <div className="mb-4">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 mb-2">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Free Tier Limit Reached</span>
          </div>
          <h3 className="text-lg font-bold text-white tracking-tight">{title}</h3>
          <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">{description}</p>
        </div>

        {/* Upgrade Placeholder Box */}
        <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 space-y-2 mb-6">
          <div className="flex items-center gap-2 text-indigo-400 font-medium">
            <Zap className="w-4 h-4" />
            <span>Pricing Tiers Coming Soon</span>
          </div>
          <p className="text-slate-400 text-[11px]">
            We are currently finalizing our billing structure. During this preview period, free accounts are capped at{' '}
            <strong className="text-slate-200">2 projects</strong> and <strong className="text-slate-200">5 monitors per project</strong>.
          </p>
        </div>

        {/* Actions */}
        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium transition-colors"
          >
            Got it, thanks
          </button>
        </div>
      </div>
    </div>
  )
}
