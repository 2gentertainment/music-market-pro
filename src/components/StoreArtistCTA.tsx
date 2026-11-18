'use client';

import React from 'react';

export default function StoreArtistCTA() {
  return (
    <div className="w-full max-w-[1200px] mx-auto px-6 my-16">
      <div className="relative overflow-hidden rounded-[24px] bg-gradient-to-r from-[#161616] via-[#1a1a1a] to-[#121212] border border-[#2a2a2a] p-8 md:p-12 shadow-[0_16px_40px_rgba(0,0,0,0.6)]">
        
        {/* Subtle background glow accent */}
        <div className="absolute -right-20 -top-20 w-60 h-60 bg-[#ff8c00]/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="text-center md:text-left space-y-3 max-w-[600px]">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#ff8c00]/10 border border-[#ff8c00]/30 text-[#ff8c00] text-[11px] font-bold tracking-wider uppercase">
              <span>● Independent Creator Infrastructure</span>
            </div>
            
            <h3 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
              Are you an artist or label? Launch your own store.
            </h3>
            
            <p className="text-[#aaa] text-sm leading-relaxed">
              Stop losing 30% to legacy streaming middlemen. Get direct Stripe payouts, automated Vault delivery, and custom artist tools engineered to keep 100% of your leverage.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto shrink-0">
            <a
              href="/#pricing"
              className="bg-[#ff8c00] hover:bg-[#e07b00] text-black font-bold px-8 py-4 rounded-[14px] text-sm text-center transition-all shadow-[0_0_25px_rgba(255,140,0,0.25)] cursor-pointer whitespace-nowrap"
            >
              Start Your Store →
            </a>
            <a
              href="/vault"
              className="bg-black hover:bg-[#222] text-white border border-[#333] font-bold px-6 py-4 rounded-[14px] text-sm text-center transition-all cursor-pointer whitespace-nowrap"
            >
              Access Vault
            </a>
          </div>
        </div>

      </div>
    </div>
  );
}