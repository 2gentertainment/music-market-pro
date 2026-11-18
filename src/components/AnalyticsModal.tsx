'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { getAnalyticsData } from '@/utils/fetchAnalytics';
import { supabase } from '@/utils/supabase';

interface AnalyticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  artistHandle?: string;
  isAdminView?: boolean;     // Label Executive view (scoped to roster)
  isSuperAdmin?: boolean;    // Platform Super-Admin view (global ecosystem)
  userTier?: string;
  rosterArtists?: any[];
}

interface TrackMetricRow {
  plays: number;
  clickThroughs: number;
  revenue: number;
}

type Timeframe = 'today' | '7d' | '30d' | 'all';

const PLATFORM_GENRES = [
  'Hip-Hop',
  'Rap',
  'R&B',
  'Trap',
  'Drill',
  'Soul',
  'Pop',
  'Afrobeats',
  'Electronic / Dance',
  'Rock / Alternative',
  'Instrumental / Beat',
  'Other',
];

export default function AnalyticsModal({ 
  isOpen, 
  onClose, 
  artistHandle, 
  isAdminView, 
  isSuperAdmin = false,
  userTier, 
  rosterArtists = []
}: AnalyticsModalProps) {
  
  const [timeframe, setTimeframe] = useState<Timeframe>('7d');
  const [loading, setLoading] = useState(true);
  
  // Roster Filter State for Label / Super-Admin tiers (default to 'all' for super admins)
  const [selectedRosterFilter, setSelectedRosterFilter] = useState<string>('all');

  // Fan Acquisition & Genre Mega-List State
  const [fanRecords, setFanRecords] = useState<any[]>([]);
  const [selectedGenreFilter, setSelectedGenreFilter] = useState<string>('all');

  const [metrics, setMetrics] = useState<{
    totalGross: number;
    totalNet: number;
    totalPlatformCommission: number;
    totalPlays: number;
    totalClickThroughs: number;
    salesCount: number;
    trackBreakdown: Record<string, TrackMetricRow>;
    tierCounts: { free: number; artist: number; label: number };
    commissionAuditLog: any[];
    topArtistsLeaderboard: { artist_handle: string; total_revenue: number; total_sales: number }[];
  }>({
    totalGross: 0,
    totalNet: 0,
    totalPlatformCommission: 0,
    totalPlays: 0,
    totalClickThroughs: 0,
    salesCount: 0,
    trackBreakdown: {},
    tierCounts: { free: 0, artist: 0, label: 0 },
    commissionAuditLog: [],
    topArtistsLeaderboard: [],
  });

  const [trackStats, setTrackStats] = useState<any[]>([]);

  const hasElevatedView = Boolean(isAdminView || isSuperAdmin);
  const isFreeTier = userTier === 'free' && !hasElevatedView;
  
  // Global View is active only if super admin and dropdown is set to global 'all'
  const isGlobalMasterView = isSuperAdmin && selectedRosterFilter === 'all';

  function getTimeframeStartIso(tf: Timeframe): string | null {
    if (tf === 'all') return null;
    const now = new Date();
    if (tf === 'today') {
      now.setHours(0, 0, 0, 0);
      return now.toISOString();
    }
    const days = tf === '7d' ? 7 : 30;
    now.setDate(now.getDate() - days);
    return now.toISOString();
  }

  useEffect(() => {
    if (!isOpen) return;

    async function loadData() {
      setLoading(true);

      // Determine handle scope: undefined pulls global or roster data depending on filter selection
      const effectiveHandle = hasElevatedView
        ? (selectedRosterFilter === 'all' || selectedRosterFilter === 'roster_all' ? undefined : selectedRosterFilter)
        : artistHandle;

      // Only query global ecosystem data if super admin is viewing the global 'all' option
      const querySuperAdmin = isSuperAdmin && selectedRosterFilter === 'all';

      // Fetch Macro & Super-Admin Telemetry
      const data = await getAnalyticsData(timeframe, effectiveHandle, querySuperAdmin);
      setMetrics({
        totalGross: data.totalGross,
        totalNet: data.totalNet,
        totalPlatformCommission: data.totalPlatformCommission,
        totalPlays: data.totalPlays,
        totalClickThroughs: data.totalClickThroughs,
        salesCount: data.salesCount,
        trackBreakdown: data.trackBreakdown || {},
        tierCounts: data.tierCounts || { free: 0, artist: 0, label: 0 },
        commissionAuditLog: data.commissionAuditLog || [],
        topArtistsLeaderboard: data.topArtistsLeaderboard || [],
      });

               const normalizedArtistHandle = String(artistHandle || '').trim().toLowerCase();
      const normalizedRosterHandles = Array.from(
        new Set(
          (rosterArtists || [])
            .map((a) => String(a?.artist_handle || a?.handle || '').trim().toLowerCase())
            .filter(Boolean)
        )
      );


      // Fetch Track-Level Performance Breakdown (exclude soft-deleted tracks)
      let trackQuery = supabase
        .from('tracks_pro')
        .select('*')
        .is('deleted_at', null);

      if (effectiveHandle) {
        trackQuery = trackQuery.ilike('artist_handle', effectiveHandle.trim());
      } else if (isAdminView && !isSuperAdmin) {
        if (normalizedRosterHandles.length > 0) {
          trackQuery = trackQuery.in('artist_handle', normalizedRosterHandles);
        } else {
          trackQuery = trackQuery.eq('artist_handle', '__none__');
        }
      } else if (isSuperAdmin && selectedRosterFilter === 'roster_all') {
        if (normalizedRosterHandles.length > 0) {
          trackQuery = trackQuery.in('artist_handle', normalizedRosterHandles);
        } else {
          trackQuery = trackQuery.eq('artist_handle', '__none__');
        }
      }
      const { data: tracks } = await trackQuery;
      setTrackStats(tracks || []);

      // Fetch Captured Fans (artist_fans) strictly scoped to the active account / roster
      if (isFreeTier) {
        setFanRecords([]);
      } else {
        let fanQuery = supabase
          .from('artist_fans')
          .select('*')
          .order('created_at', { ascending: false });

        if (isGlobalMasterView) {
          // Only Super-Admin in Global Master View sees all platform fan records
        } else if (effectiveHandle) {
          fanQuery = fanQuery.ilike('artist_handle', effectiveHandle.trim());
        } else if (hasElevatedView) {
          // Label Admin or Super-Admin viewing roster scope: restrict strictly to roster handles
          if (normalizedRosterHandles.length > 0) {
            fanQuery = fanQuery.in('artist_handle', normalizedRosterHandles);
          } else {
            fanQuery = fanQuery.eq('artist_handle', '__none__');
          }
                } else if (normalizedArtistHandle) {
          fanQuery = fanQuery.ilike('artist_handle', normalizedArtistHandle);
        } else {
          fanQuery = fanQuery.eq('artist_handle', '__none__');
        }


        const startIso = getTimeframeStartIso(timeframe);
        if (startIso) {
          fanQuery = fanQuery.gte('created_at', startIso);
        }

        const { data: fansData } = await fanQuery;
        setFanRecords(fansData || []);
      }


      setLoading(false);
    }

    loadData();
  }, [isOpen, timeframe, artistHandle, selectedRosterFilter, hasElevatedView, isSuperAdmin, isFreeTier, rosterArtists.length]);

  const filteredFans = fanRecords.filter((fan) => {
    if (!isGlobalMasterView || selectedGenreFilter === 'all') return true;
    return (fan.source_genre || 'Untagged').toLowerCase() === selectedGenreFilter.toLowerCase();
  });

  function downloadCsvFile(headers: string[], rows: any[][], filename: string) {
    const csvContent = [
      headers.join(','),
      ...rows.map((row: any[]) => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  // Fan Emails CSV Export Handler
  const exportFansToCSV = () => {
    if (isFreeTier) {
      return;
    }

    if (!filteredFans || filteredFans.length === 0) {
      alert('No fan emails to export for the current filter/timeframe.');
      return;
    }

    const headers = ['Email', 'Artist Handle', 'Source Genre', 'Source Track', 'Joined Date'];
    const rows = filteredFans.map((fan: any) => [
      `"${fan.email || ''}"`,
      `"@${fan.artist_handle || 'unknown'}"`,
      `"${fan.source_genre || 'Untagged'}"`,
      `"${fan.source_track_title || ''}"`,
      fan.created_at ? new Date(fan.created_at).toISOString().split('T')[0] : ''
    ]);

    const genreSlug = isGlobalMasterView && selectedGenreFilter !== 'all'
      ? `_${selectedGenreFilter.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`
      : '';

    const scopeSlug = isGlobalMasterView
      ? 'global'
      : (selectedRosterFilter !== 'all' && selectedRosterFilter !== 'roster_all'
        ? selectedRosterFilter
        : (artistHandle || 'roster'));

    downloadCsvFile(headers, rows, `2g_fans_${scopeSlug}${genreSlug}_${timeframe}_${Date.now()}.csv`);
  };

  // Universal CSV Export Handler for All Tiers
  const exportAnalyticsToCSV = () => {
    let headers: string[];
    let rows: any[];
    let filename = '';

    if (isSuperAdmin && selectedRosterFilter === 'all') {
      if (!metrics.commissionAuditLog || metrics.commissionAuditLog.length === 0) {
        alert('No ecosystem audit log transactions to export for this timeframe.');
        return;
      }
      headers = ['Transaction ID', 'Artist Handle', 'Created At', 'Gross Amount ($)', 'Platform Fee ($)', 'Net Amount ($)'];
      rows = metrics.commissionAuditLog.map((tx: any) => [
        tx.id,
        `@${tx.artist_handle || 'unknown'}`,
        new Date(tx.created_at).toISOString().split('T')[0],
        Number(tx.gross_amount || 0).toFixed(2),
        Number(tx.platform_fee || 0).toFixed(2),
        Number(tx.net_amount || 0).toFixed(2)
      ]);
      filename = `2g_ecosystem_audit_${timeframe}_${Date.now()}.csv`;
    } else {
      if (!trackStats || trackStats.length === 0) {
        alert('No catalogue performance data available to export for this timeframe.');
        return;
      }
      headers = ['Track Title', 'Album', 'Price ($)', 'Artist Handle'];
      rows = trackStats.map((track: any) => [
        `"${track.title || 'Untitled'}"`,
        `"${track.album_name || 'Single'}"`,
        Number(track.price || 0).toFixed(2),
        `@${track.artist_handle || artistHandle || 'unknown'}`
      ]);
      filename = `2g_analytics_report_${timeframe}_${Date.now()}.csv`;
    }

    downloadCsvFile(headers, rows, filename);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-neutral-950/85 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="bg-neutral-900 border border-purple-500/35 rounded-3xl w-full max-w-4xl p-6 space-y-6 text-left shadow-2xl animate-fadeIn max-h-[90vh] overflow-y-auto">
        
        {/* Modal Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-neutral-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-md border ${
                isSuperAdmin && selectedRosterFilter === 'all'
                  ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' 
                  : 'bg-purple-500/20 text-purple-400 border-purple-500/30'
              }`}>
                {isSuperAdmin && selectedRosterFilter === 'all' ? 'Super-Admin Chessboard' : isAdminView || isSuperAdmin ? 'Label Master View' : 'Performance Analytics'}
              </span>
            </div>
            <h3 className="font-extrabold text-xl text-white mt-1">
              {isSuperAdmin && selectedRosterFilter === 'all'
                ? 'Global Ecosystem Telemetry' 
                : hasElevatedView 
                  ? 'Roster Performance Telemetry' 
                  : `Analytics for @${artistHandle}`}
            </h3>
          </div>
          
          <button onClick={onClose} className="text-neutral-500 hover:text-white font-bold text-lg cursor-pointer">✕</button>
        </div>

        {/* Master Timeframe, Export CSV, & Dynamic Roster Filter Row */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          
          <div className="flex items-center gap-2 flex-wrap">
            {/* Master Timeframe Switcher Tabs */}
            <div className="flex bg-neutral-950 p-1.5 rounded-xl border border-neutral-800">
              {(['today', '7d', '30d', 'all'] as Timeframe[]).map((tf) => (
                <button
                  key={tf}
                  onClick={() => setTimeframe(tf)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                    timeframe === tf
                      ? 'bg-purple-600 text-white shadow-md'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  {tf === '7d' ? '7D' : tf === '30d' ? '30D' : tf === 'today' ? 'Today' : 'All'}
                </button>
              ))}
            </div>

            {/* Universal Export CSV Button or Upgrade Prompt */}
            {isFreeTier ? (
              <Link
                href="/upgrade"
                onClick={onClose}
                className="bg-neutral-950 hover:bg-neutral-800 text-[#ff8c00] border border-[#ff8c00]/40 px-3.5 py-2.5 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 shadow-sm"
              >
                🔒 Upgrade for Audience & CSV
              </Link>
            ) : (
              <button
                onClick={exportAnalyticsToCSV}
                className="bg-neutral-950 hover:bg-neutral-800 text-purple-400 border border-purple-500/30 px-3.5 py-2.5 rounded-xl text-xs font-bold cursor-pointer transition-all flex items-center gap-1.5 shadow-sm"
                title="Export report for current view"
              >
                ↓ Export {isSuperAdmin && selectedRosterFilter === 'all' ? 'Ecosystem' : hasElevatedView ? 'Roster' : 'Artist'} CSV
              </button>
            )}
          </div>

          {/* Dynamic Roster / Tenant Filter Dropdown */}
          {hasElevatedView && (
            <div className="flex items-center gap-2">
              <div className="text-purple-400 flex items-center justify-center" title="Master View">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" />
                  <circle cx="5" cy="5" r="2" />
                  <circle cx="19" cy="5" r="2" />
                  <circle cx="5" cy="19" r="2" />
                  <circle cx="19" cy="19" r="2" />
                  <line x1="9.5" y1="9.5" x2="6.5" y2="6.5" />
                  <line x1="14.5" y1="9.5" x2="17.5" y2="6.5" />
                  <line x1="9.5" y1="14.5" x2="6.5" y2="17.5" />
                  <line x1="14.5" y1="14.5" x2="17.5" y2="17.5" />
                </svg>
              </div>

              <select
                value={selectedRosterFilter}
                onChange={(e) => setSelectedRosterFilter(e.target.value)}
                className="bg-neutral-950 border border-neutral-800 hover:border-purple-500/50 text-neutral-200 text-xs font-bold rounded-xl px-3 py-2.5 outline-none cursor-pointer transition-all shadow-sm"
              >
                {isSuperAdmin && (
                  <option value="all">All Platform Accounts (Global Master View)</option>
                )}
                <option value="roster_all">All Roster Artists (Master View)</option>
                
                {rosterArtists.map((artist) => {
                  const handle = artist.artist_handle || artist.handle;
                  const displayName = artist.name || artist.handle || 'Artist';
                  if (!handle) return null;

                  return (
                    <option key={artist.id || handle} value={handle}>
                      {displayName} (@{handle})
                    </option>
                  );
                })}
              </select>
            </div>
          )}
        </div>

        {/* Macro Metrics Cards */}
        {loading ? (
          <div className="text-center py-12 text-neutral-500 text-xs">Crunching ecosystem metrics...</div>
        ) : (
          <>
            <div className={`grid grid-cols-1 ${isFreeTier ? 'sm:grid-cols-2' : 'sm:grid-cols-3'} gap-4`}>
              <div className="p-4 bg-neutral-950 border border-neutral-800 rounded-2xl space-y-1">
                <span className="text-[10px] text-neutral-500 uppercase tracking-wider font-bold">Total Revenue</span>
                <h4 className="text-2xl font-extrabold text-emerald-400">
                  ${hasElevatedView ? metrics.totalGross.toFixed(2) : metrics.totalNet.toFixed(2)}
                </h4>
                <p className="text-[11px] text-neutral-400">
                  {hasElevatedView
                    ? `Platform Commission: $${metrics.totalPlatformCommission.toFixed(2)}`
                    : `${metrics.salesCount} completed sales`}
                </p>
              </div>

              <div className="p-4 bg-neutral-950 border border-neutral-800 rounded-2xl space-y-1">
                <span className="text-[10px] text-neutral-500 uppercase tracking-wider font-bold">Total Vault Plays</span>
                <h4 className="text-2xl font-extrabold text-white">{metrics.totalPlays}</h4>
                <p className="text-[11px] text-neutral-400">Audio player interactions</p>
              </div>

              {!isFreeTier && (
                <div className="p-4 bg-neutral-950 border border-neutral-800 rounded-2xl space-y-1">
                  <span className="text-[10px] text-neutral-500 uppercase tracking-wider font-bold">Stream Click-Throughs</span>
                  <h4 className="text-2xl font-extrabold text-purple-400">{metrics.totalClickThroughs}</h4>
                  <p className="text-[11px] text-neutral-400">Transitions to DSPs / Links</p>
                </div>
              )}
            </div>

            {/* ================================================================= */}
            {/* FAN ACQUISITION & GENRE LIST EXPORT SUITE (Paid / Elevated Only)   */}
            {/* ================================================================= */}
            {!isFreeTier && (
              <div className="p-4 bg-neutral-950 border border-neutral-800 rounded-2xl space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-[10px] text-[#ff8c00] uppercase tracking-wider font-bold block">
                      Fan Base & Audience List
                    </span>
                    <h4 className="text-xl font-extrabold text-white">
                      {filteredFans.length} {filteredFans.length === 1 ? 'Subscriber' : 'Subscribers'}
                      {isGlobalMasterView && selectedGenreFilter !== 'all' ? ` · ${selectedGenreFilter}` : ''}
                    </h4>
                    <p className="text-[11px] text-neutral-400">
                      {isGlobalMasterView
                        ? 'Filter captured listeners by genre to export targeted campaign & lookalike lists.'
                        : 'Emails collected via Become a Fan on your store, synced to AWeber & ready for export.'}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {isGlobalMasterView && (
                      <select
                        value={selectedGenreFilter}
                        onChange={(e) => setSelectedGenreFilter(e.target.value)}
                        className="bg-neutral-900 border border-neutral-700 hover:border-[#ff8c00] text-neutral-200 text-xs font-bold rounded-xl px-3 py-2 outline-none cursor-pointer"
                      >
                        <option value="all">All Genres (Mega-List)</option>
                        {PLATFORM_GENRES.map((genre) => (
                          <option key={genre} value={genre}>
                            {genre}
                          </option>
                        ))}
                        <option value="Untagged">Untagged</option>
                      </select>
                    )}

                    <button
                      type="button"
                      onClick={exportFansToCSV}
                      className="bg-[#ff8c00] hover:bg-[#e07b00] text-neutral-950 font-extrabold px-3.5 py-2 rounded-xl text-xs cursor-pointer transition-all flex items-center gap-1.5"
                    >
                      ↓ Download Fan CSV ({filteredFans.length})
                    </button>
                  </div>
                </div>

                {filteredFans.length > 0 && (
                  <div className="border-t border-neutral-900 pt-2.5 max-h-36 overflow-y-auto space-y-1.5">
                    {filteredFans.slice(0, 15).map((fan) => (
                      <div key={fan.id} className="flex items-center justify-between text-xs py-1 px-2 rounded-lg bg-neutral-900/70">
                        <div className="flex items-center gap-2 truncate">
                          <span className="font-semibold text-white truncate">{fan.email}</span>
                          {fan.source_genre && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#ff8c00]/15 text-[#ff8c00] border border-[#ff8c00]/30 flex-shrink-0">
                              {fan.source_genre}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-neutral-500 flex-shrink-0">
                          @{fan.artist_handle} · {fan.created_at ? new Date(fan.created_at).toLocaleDateString() : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ================================================================= */}
            {/* SUPER-ADMIN ONLY TELEMETRY SUITE (Hidden from all regular users)  */}
            {/* ================================================================= */}
            {isGlobalMasterView && (
              <div className="space-y-6 pt-2 border-t border-neutral-800/80">
                
                {/* 1. Ecosystem Tier Distribution Bar */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-orange-400">
                      Ecosystem Tenant Distribution
                    </h4>
                    <span className="text-[10px] text-neutral-500 font-semibold">
                      Total Accounts: {metrics.tierCounts.free + metrics.tierCounts.artist + metrics.tierCounts.label}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-neutral-950 border border-neutral-800 p-3 rounded-xl flex justify-between items-center">
                      <span className="text-xs text-neutral-400 font-semibold">Free Tier</span>
                      <span className="text-sm font-extrabold text-white">{metrics.tierCounts.free}</span>
                    </div>
                    <div className="bg-neutral-950 border border-neutral-800 p-3 rounded-xl flex justify-between items-center">
                      <span className="text-xs text-neutral-400 font-semibold">Artist Tier</span>
                      <span className="text-sm font-extrabold text-purple-400">{metrics.tierCounts.artist}</span>
                    </div>
                    <div className="bg-neutral-950 border border-neutral-800 p-3 rounded-xl flex justify-between items-center">
                      <span className="text-xs text-neutral-400 font-semibold">Label Tier</span>
                      <span className="text-sm font-extrabold text-orange-400">{metrics.tierCounts.label}</span>
                    </div>
                  </div>
                </div>

                {/* 2. Global Top Performers & 3. Commission Audit Ledger (Side-by-Side) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  
                  {/* Global Top Performers Leaderboard */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-orange-400">
                      Global Top Performers (Gross)
                    </h4>
                    <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-3 space-y-2 max-h-56 overflow-y-auto">
                      {metrics.topArtistsLeaderboard.length === 0 ? (
                        <p className="text-xs text-neutral-500 text-center py-6">No gross revenue recorded in this window.</p>
                      ) : (
                        metrics.topArtistsLeaderboard.map((item, index) => (
                          <div key={item.artist_handle} className="flex items-center justify-between text-xs py-1.5 border-b border-neutral-900 last:border-0">
                            <div className="flex items-center gap-2 truncate">
                              <span className="w-5 h-5 rounded-md bg-neutral-900 text-orange-400 font-black text-[10px] flex items-center justify-center">
                                #{index + 1}
                              </span>
                              <span className="font-bold text-white truncate">@{item.artist_handle}</span>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <span className="font-extrabold text-emerald-400 block">${item.total_revenue.toFixed(2)}</span>
                              <span className="text-[10px] text-neutral-500">{item.total_sales} sales</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Platform Commission Audit Ledger */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-orange-400">
                      Platform Commission Audit Trail
                    </h4>
                    <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-3 space-y-2 max-h-56 overflow-y-auto">
                      {metrics.commissionAuditLog.length === 0 ? (
                        <p className="text-xs text-neutral-500 text-center py-6">No transactions logged in this window.</p>
                      ) : (
                        metrics.commissionAuditLog.map((tx: any) => (
                          <div key={tx.id} className="flex items-center justify-between text-xs py-1.5 border-b border-neutral-900 last:border-0">
                            <div className="truncate">
                              <span className="font-bold text-white block truncate">@{tx.artist_handle || 'unknown'}</span>
                              <span className="text-[10px] text-neutral-500">
                                {new Date(tx.created_at).toLocaleDateString()} • Gross: ${Number(tx.gross_amount || 0).toFixed(2)}
                              </span>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <span className="font-extrabold text-orange-400 block">
                                +${Number(tx.platform_fee || 0).toFixed(2)} fee
                              </span>
                              <span className="text-[10px] text-neutral-500">
                                Net: ${Number(tx.net_amount || 0).toFixed(2)}
                              </span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                </div>
              </div>
            )}

            {/* Track-Level Micro Breakdown Table */}
            <div className="space-y-3 pt-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400">Catalogue Breakdown</h4>
              
              {trackStats.length === 0 ? (
                <div className="text-neutral-500 text-xs py-6 text-center bg-neutral-950 rounded-xl border border-neutral-800">
                  No active tracks found for this timeframe window.
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {trackStats.map((track) => {
                    const stats = metrics.trackBreakdown[String(track.id || '').toLowerCase()] || {
                      plays: 0,
                      clickThroughs: 0,
                      revenue: 0,
                    };

                    return (
                      <div key={track.id} className="bg-neutral-950 border border-neutral-800 p-3 rounded-xl flex items-center justify-between gap-4">
                        <div className="truncate">
                          <h5 className="text-xs font-bold text-white truncate">{track.title}</h5>
                          <span className="text-[10px] text-neutral-500">
                            {track.album_name || 'Single Release'} • ${track.price} {track.artist_handle ? `• @${track.artist_handle}` : ''}
                          </span>
                        </div>

                        <div className="flex items-center gap-4 text-right flex-shrink-0">
                          <div>
                            <span className="text-[10px] text-neutral-500 block">Plays</span>
                            <span className="text-xs font-bold text-white">{stats.plays}</span>
                          </div>

                          {!isFreeTier && (
                            <div>
                              <span className="text-[10px] text-neutral-500 block">Click-Throughs</span>
                              <span className="text-xs font-bold text-purple-400">{stats.clickThroughs}</span>
                            </div>
                          )}

                          <div>
                            <span className="text-[10px] text-neutral-500 block">Record Revenue</span>
                            <span className="text-xs font-bold text-emerald-400">${stats.revenue.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {/* Footer Actions */}
        <div className="pt-2">
          <button
            onClick={onClose}
            className="w-full bg-neutral-800 hover:bg-neutral-700 text-white font-bold py-2.5 rounded-xl text-xs cursor-pointer transition-all"
          >
            Close Analytics
          </button>
        </div>

      </div>
    </div>
  );
}
