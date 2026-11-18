'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import AudioPlayer from '@/components/AudioPlayer';
import Link from 'next/link';

function MarketContent() {
  const searchParams = useSearchParams();
  const artistHandle = searchParams.get('artist') || undefined;

  return (
    <main style={{ 
      padding: "40px 20px", 
      fontFamily: "sans-serif", 
      backgroundColor: "#111", 
      color: "#fff", 
      minHeight: "100vh", 
      display: "flex", 
      flexDirection: "column", 
      alignItems: "center" 
    }}>
      <div style={{ 
        width: "100%", 
        maxWidth: "1200px", 
        display: "flex", 
        justifyContent: "space-between", 
        alignItems: "center", 
        marginBottom: "30px" 
      }}>
        <Link 
          href="/" 
          style={{ 
            color: "#888", 
            textDecoration: "none", 
            fontSize: "14px",
            fontWeight: "bold"
          }}
        >
          ← Back to Home
        </Link>
        <span style={{ fontSize: "14px", color: "#2ecc71", fontWeight: "bold" }}>
          ● Live Checkout & Telemetry Active
        </span>
      </div>

      {/* Pass the artist query parameter down to the AudioPlayer */}
      <AudioPlayer artistHandle={artistHandle} />
    </main>
  );
}

export default function MarketPage() {
  return (
    <Suspense fallback={<div style={{ backgroundColor: "#111", color: "#fff", minHeight: "100vh", display: "flex", justifyContent: "center", alignItems: "center" }}>Loading Market...</div>}>
      <MarketContent />
    </Suspense>
  );
}