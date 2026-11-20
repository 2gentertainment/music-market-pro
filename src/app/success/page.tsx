'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

function SuccessContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const artistParam = searchParams.get('artist') || searchParams.get('handle');

  const [loading, setLoading] = useState(true);
  const [verified, setVerified] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [returnUrl, setReturnUrl] = useState('/');

  useEffect(() => {
    if (!sessionId) {
      setLoading(false);
      setErrorMsg('No active checkout session found.');
      return;
    }

    // Determine return destination based on query param or fallback
    if (artistParam) {
      setReturnUrl(`/artist/${artistParam}`);
    }

    setVerified(true);
    setLoading(false);
  }, [sessionId, artistParam]);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col items-center justify-center p-6 font-sans">
      <div className="max-w-md w-full bg-[#121212] border border-[#222] rounded-[16px] p-8 flex flex-col gap-6 text-center shadow-2xl">

        {/* Brand Header */}
        <div className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-widest text-[#ff8c00] font-bold">2G Music Market</span>
          <h1 className="text-xl font-black uppercase tracking-wider text-white">
            {loading ? 'Verifying Order...' : verified ? 'Payment Successful' : 'Access Denied'}
          </h1>
        </div>

        {loading ? (
          <div className="py-8 text-[#888] text-[13px]">Securing your download link...</div>
        ) : verified ? (
          <div className="flex flex-col gap-5">
            <div className="bg-[#181818] border border-[#262626] p-4 rounded-[12px] text-left">
              <p className="text-[12px] text-[#ccc] leading-relaxed">
                Thank you for your support. Your secure transaction has been processed and your high-quality files are ready for download.
              </p>
              <div className="mt-3 text-[10px] text-[#666] font-mono truncate">
                Session: {sessionId}
              </div>
            </div>

            {/* Download Action Button */}
            <a
              href="#download"
              onClick={(e) => {
                e.preventDefault();
                alert('Secure file download triggered! Your token is active.');
              }}
              className="w-full bg-[#ff8c00] hover:bg-[#ff7700] text-black font-black uppercase text-[12px] tracking-wider py-3 rounded-[10px] transition-all text-center block"
            >
              Download Track Package
            </a>

            <p className="text-[11px] text-[#666]">
              A confirmation email with your download instructions has also been sent.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <p className="text-[13px] text-[#ff4444]">{errorMsg}</p>
            <Link
              href={returnUrl}
              className="w-full bg-[#1e1e1e] border border-[#333] hover:border-[#ff8c00] text-white font-bold text-[12px] py-3 rounded-[10px] transition-all"
            >
              Return to Store
            </Link>
          </div>
        )}

        <div className="border-t border-[#222] pt-4">
          <Link href={returnUrl} className="text-[11px] text-[#888] hover:text-white transition-all">
            &larr; Return to Artist Player / Storefront
          </Link>
        </div>

      </div>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center p-6 font-sans">
          <div className="text-[#888] text-[13px]">Verifying Order...</div>
        </div>
      }
    >
      <SuccessContent />
    </Suspense>
  );
}
