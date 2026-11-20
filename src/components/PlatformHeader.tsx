'use client';

import React from 'react';
import Link from 'next/link';

interface PlatformHeaderProps {
  showDashboard?: boolean;
  userTier?: string;
  onOpenSupport?: () => void;
  rightContent?: React.ReactNode; // <--- Allows dropping custom actions like our power button right next to support
}

export default function PlatformHeader({ 
  showDashboard = false, 
  userTier = 'free',
  onOpenSupport,
  rightContent
}: PlatformHeaderProps) { 
  return (
    <header className="w-full max-w-[1200px] mx-auto p-6 flex justify-between items-center touch-manipulation">
      {/* Logo links back to Home */}
      <Link href="/" className="flex items-center gap-3 group cursor-pointer">
        <div className="flex items-end gap-1 h-6">
          <span className="w-[2px] h-full bg-[#ff8c00] group-hover:opacity-85 transition-all"></span>
          <span className="w-[2px] h-4 bg-[#ff8c00] group-hover:opacity-85 transition-all"></span>
          <span className="w-[2px] h-3 bg-[#ff8c00] group-hover:opacity-85 transition-all"></span>
          <span className="w-[2px] h-2 bg-[#ff8c00] group-hover:opacity-85 transition-all"></span>
          <span className="w-[2px] h-3 bg-[#ff8c00] group-hover:opacity-85 transition-all"></span>
          <span className="w-[2px] h-5 bg-[#2ecc71] group-hover:opacity-85 transition-all"></span>
          <span className="w-[2px] h-full bg-[#ff8c00] group-hover:opacity-85 transition-all"></span>
        </div>
        <span className="font-bold tracking-[1px] text-[15px] group-hover:text-[#ff8c00] transition-colors">
          Music Market
        </span>
      </Link>

      {/* Right side contextual navigation & actions */}
      <div className="flex items-center gap-2.5">
        {showDashboard && (
          <Link 
            href="/dashboard" 
            className="bg-[#1e1e1e] border border-[#333] hover:border-[#ff8c00] px-4 py-2 rounded-[10px] text-[13px] font-bold transition-all"
          >
            Dashboard
          </Link>
        )}
        

        {/* Support Envelope Button */}
        {onOpenSupport && (
          <button
            onClick={onOpenSupport}
            className="bg-[#1e1e1e] hover:bg-[#252525] border border-[#333] hover:border-[#ff8c00] text-[#ff8c00] p-2.5 rounded-[10px] transition-all cursor-pointer flex items-center justify-center"
            title="Contact Support"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
              <polyline points="22,6 12,13 2,6"></polyline>
            </svg>
          </button>
        )}

        {/* Snug Custom Right Action (Power Button Menu) */}
        {rightContent}
      </div>
    </header>
  );
}
