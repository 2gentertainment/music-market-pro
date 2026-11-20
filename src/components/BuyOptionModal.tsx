'use client';

import React from 'react';

interface BuyOptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  trackTitle: string;
  albumName?: string | null;
  trackPrice: number | string;
  albumPrice?: number | string;
  onSelectOption: (type: 'single' | 'album') => void;
  disabled?: boolean;
}

function formatPrice(value: number | string | undefined, fallback: number): string {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed.toFixed(2) : fallback.toFixed(2);
}

export default function BuyOptionModal({
  isOpen,
  onClose,
  trackTitle,
  albumName,
  trackPrice = '0.99',
  albumPrice = '7.99',
  onSelectOption,
  disabled = false,
}: BuyOptionModalProps) {

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 touch-manipulation">
      <div className="bg-[#161616] border border-[#2e2e2e] w-full max-w-[420px] rounded-[22px] p-6 text-left shadow-2xl relative touch-manipulation">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-[#888] hover:text-white text-[18px] font-bold cursor-pointer"
        >
          ✕
        </button>

        <h3 className="text-[20px] font-bold text-white mb-1">Select Purchase Option</h3>
        <p className="text-[12px] text-[#888] mb-5">
          Choose whether to buy this individual track or the full project.
        </p>

        <div className="space-y-3">
                    {/* Option 1: Buy Single Track */}
          <button
            type="button"
            disabled={disabled}
            onClick={() => onSelectOption('single')}
            className="w-full bg-[#111] hover:bg-[#1f1f1f] border border-[#262626] hover:border-[#ff8c00] p-4 rounded-[14px] flex items-center justify-between text-left transition-all cursor-pointer group disabled:opacity-50"
          >
            <div>
              <div className="text-[11px] font-bold text-[#ff8c00] uppercase tracking-wider mb-0.5">Single Track</div>
              <div className="text-[14px] font-bold text-white group-hover:text-[#ff8c00] transition-colors">{trackTitle}</div>
            </div>
            <div className="text-[15px] font-bold text-white bg-[#222] px-3 py-1.5 rounded-[8px] border border-[#333]">
              ${formatPrice(trackPrice, 0.99)}
            </div>
          </button>

          {/* Option 2: Buy Full Album / EP */}
          {albumName && (
            <button
              type="button"
              disabled={disabled}
              onClick={() => onSelectOption('album')}
              className="w-full bg-[#1e1710] hover:bg-[#2a1f12] border border-[#ff8c00]/40 hover:border-[#ff8c00] p-4 rounded-[14px] flex items-center justify-between text-left transition-all cursor-pointer group shadow-[0_0_16px_rgba(255,140,0,0.1)] disabled:opacity-50"
            >
              <div>
                <div className="text-[11px] font-bold text-[#2ecc71] uppercase tracking-wider mb-0.5">Full Album Bundle</div>
                <div className="text-[14px] font-bold text-white group-hover:text-[#ff8c00] transition-colors">{albumName}</div>
              </div>
              <div className="text-[15px] font-bold text-[#ff8c00] bg-[#2a1f12] px-3 py-1.5 rounded-[8px] border border-[#ff8c00]/40">
                ${formatPrice(albumPrice, 7.99)}
              </div>
            </button>
          )}

        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full text-center text-[12px] text-[#666] hover:text-[#aaa] font-bold pt-4 cursor-pointer"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
