'use client';

import { Suspense, useState, useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase as _supabase } from '@/utils/supabase';
import ReorderModal from '@/components/ReorderModal';
import UploadTrackModal from '@/components/UploadTrackModal';
import AddArtistModal from '@/components/AddArtistModal';
import AlbumReorderModal from '@/components/AlbumReorderModal';
import AddToAlbumModal from '@/components/AddToAlbumModal';
import PlatformHeader from '@/components/PlatformHeader';
import AlbumSettingsModal from '@/components/AlbumSettingsModal';
import EditTrackModal from '@/components/EditTrackModal';
import EditArtistModal from '@/components/EditArtistModal';
import DirectBalanceButton from '@/components/DirectBalanceButton';
import AnalyticsModal from '@/components/AnalyticsModal';


function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const accountId = searchParams.get('account_id');
  const connectStatus = searchParams.get('connect');
  const pendingAccountParam = searchParams.get('pending_account');
  const customHandle = searchParams.get('handle');
  const returnedTier = searchParams.get('tier');
  const scheduledTier = searchParams.get('scheduled');
  const cancelAtPeriodEnd = searchParams.get('cancel_at_period_end') === 'true';

  const [selectedTrackForEdit, setSelectedTrackForEdit] = useState<any | null>(null);
  const [selectedArtistForEdit, setSelectedArtistForEdit] = useState<any | null>(null);
  const [selectedTrackIds, setSelectedTrackIds] = useState<Array<string | number>>([]);
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);

  const [isTutorialExpanded, setIsTutorialExpanded] = useState(false);
  const tutorialButtonRef = useRef<HTMLAnchorElement>(null);
  const profileId = searchParams.get('profile_id');
  const [stripeAccountId, setStripeAccountId] = useState<string | null>(null);



  // User & Tier state
  const [userTier, setUserTier] = useState<string>('free'); 
  const [userProfileId, setUserProfileId] = useState<string | null>(null);
  const [userHandle, setUserHandle] = useState<string | null>(null);
  const [artistHandle, setArtistHandle] = useState<string | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState<boolean>(false); // 👈 Correctly placed at the top level with other hooks
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userLogoUrl, setUserLogoUrl] = useState<string | null>(null);
  const [tracks, setTracks] = useState<Array<any>>([]);
  const [rosterArtistsList, setRosterArtistsList] = useState<Array<any>>([]);
  const [rosterCount, setRosterCount] = useState<number>(0);
  const [mainArtistProfileId, setMainArtistProfileId] = useState<string | null>(null);
  const [settingMainArtistId, setSettingMainArtistId] = useState<string | null>(null);

  const [loadingData, setLoadingData] = useState(true);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [selectedAlbumForSettings, setSelectedAlbumForSettings] = useState<string | null>(null);
  const [albumMetaMap, setAlbumMetaMap] = useState<Record<string, string>>({});
  const resolvedHandle = userHandle || artistHandle || customHandle || '';
  const queryBase = `tier=${encodeURIComponent(userTier)}&handle=${encodeURIComponent(resolvedHandle)}&account_id=${encodeURIComponent(accountId || '')}${userProfileId ? `&profile_id=${encodeURIComponent(userProfileId)}` : ''}`;


  
  // Label Setup Modal state
  const [isLabelSetupModalOpen, setIsLabelSetupModalOpen] = useState(false);
  const [labelInputName, setLabelInputName] = useState('');
  const [labelInputHandle, setLabelInputHandle] = useState('');
  const [savingLabelSetup, setSavingLabelSetup] = useState(false);

    // Search & Filtering state
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAlbumSearchOpen, setIsAlbumSearchOpen] = useState(false);
  const [albumSearchQuery, setAlbumSearchQuery] = useState('');


  // Power Menu state
  const [isPowerMenuOpen, setIsPowerMenuOpen] = useState(false);
  const powerMenuRef = useRef<HTMLDivElement>(null);

  // Support / Contact Modal state
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);
  const [supportCategory, setSupportCategory] = useState('Strategic Label Distribution');
  const [supportSubject, setSupportSubject] = useState('');
  const [supportMessage, setSupportMessage] = useState('');
  const [isSendingSupport, setIsSendingSupport] = useState(false);

  // Analytics Modal
  const [isAnalyticsModalOpen, setIsAnalyticsModalOpen] = useState(false);

  // Modals state
  const [showAllTracks, setShowAllTracks] = useState(false);
  const [showAllAlbums, setShowAllAlbums] = useState(false);
  const [isReorderModalOpen, setIsReorderModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isAddArtistModalOpen, setIsAddArtistModalOpen] = useState(false);
  const [isAddToAlbumModalOpen, setIsAddToAlbumModalOpen] = useState(false);
  
  // Album management state
  const [selectedAlbumForReorder, setSelectedAlbumForReorder] = useState<string | null>(null);
  const [isAlbumGlobalReorderOpen, setIsAlbumGlobalReorderOpen] = useState(false);

  // Copy feedback state
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

    const isDevSuiteEnabled =
    process.env.NODE_ENV === 'development' &&
    process.env.NEXT_PUBLIC_ENABLE_DEV_SUITE === 'true';

  // Base URL & Dynamic Storefront / Artist Player Link Resolution
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://musicmarket.app';

  
  const labelCorporateHandle = customHandle || userHandle || (accountId ? `label-${accountId.slice(-6)}` : '2g-imprint');
  const personalArtistHandle = artistHandle || customHandle || userHandle || 'your-actual-handle';

  const mainStoreUrl = userTier === 'label'
    ? `${baseUrl}/artist/${labelCorporateHandle}`
    : `${baseUrl}/artist/${personalArtistHandle}`;

  const handleCopy = (url: string, key: string) => {
    navigator.clipboard.writeText(url);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

    const handleLogout = async () => {
    try {
      await _supabase.auth.signOut();
      localStorage.removeItem('mm_dev_tier');
      setIsSuperAdmin(false);
      router.replace('/auth');
    } catch (err) {
      console.error('Logout error:', err);
      router.replace('/auth');
    }
  };

  const forceKickRemovedAccount = async () => {
    setTracks([]);
    setRosterArtistsList([]);
    setUserProfileId(null);
    setUserHandle(null);
    setArtistHandle(null);
    setStripeAccountId(null);
    setIsSuperAdmin(false);
    setLoadingData(false);
    setIsCheckingAuth(false);

    try {
      await _supabase.auth.signOut({ scope: 'local' });
    } catch {
      // Ignore signOut error if session was already invalidated
    }
    router.replace('/auth');
  };


  useEffect(() => {
  const handleClickOutside = (event: MouseEvent) => {
    if (
      tutorialButtonRef.current &&
      !tutorialButtonRef.current.contains(event.target as Node)
    ) {
      setIsTutorialExpanded(false);
    }
  };

  document.addEventListener('mousedown', handleClickOutside);
  return () => document.removeEventListener('mousedown', handleClickOutside);
}, []);


    useEffect(() => {
    const projectRef = process.env.NEXT_PUBLIC_SUPABASE_URL
      ?.replace(/^https?:\/\//, '')
      .split('.')[0];
    const expectedAuthStorageKey = projectRef ? `sb-${projectRef}-auth-token` : null;

    const handleStorageChange = (e: StorageEvent) => {
      if (expectedAuthStorageKey && e.key === expectedAuthStorageKey && !e.newValue) {
        setUserTier('free');
        setUserHandle(null);
        setArtistHandle(null);
        setIsSuperAdmin(false);
        router.push('/auth');
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [router]);

  useEffect(() => {
    if (!userProfileId) return;

    const channel = _supabase
      .channel(`profile-guard-${userProfileId}`)
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${userProfileId}`,
        },
        () => {
          forceKickRemovedAccount();
        }
      )
      .subscribe();

    return () => {
      _supabase.removeChannel(channel);
    };
  }, [userProfileId]);


    const verifyAndLoadWorkspace = async () => {
    try {
      setLoadingData(true);
      const devTier =
        isDevSuiteEnabled && typeof window !== 'undefined'
          ? localStorage.getItem('mm_dev_tier')
          : null;
      let ownerId = null;

      const { data: { session } } = await _supabase.auth.getSession();

      if (session?.user) {
        const { data: { user: verifiedUser }, error: userErr } = await _supabase.auth.getUser();
        if (userErr || !verifiedUser) {
          await forceKickRemovedAccount();
          return;
        }

        const { data: activeProfile, error: profileErr } = await _supabase
          .from('profiles')
          .select('*')
          .eq('id', verifiedUser.id)
          .maybeSingle();

        if (profileErr || !activeProfile) {
          await forceKickRemovedAccount();
          return;
        }

        ownerId = activeProfile.id;
        setUserProfileId(ownerId);
        setUserEmail(verifiedUser.email || activeProfile.email || null);
      } else if (!accountId && !customHandle && (!isDevSuiteEnabled || !devTier || devTier === 'logged_out')) {
        await forceKickRemovedAccount();
        return;
      }


      let profileQuery = _supabase.from('profiles').select('*');
      
      if (ownerId) {
        profileQuery = profileQuery.eq('id', ownerId);
      } else if (accountId) {
        profileQuery = profileQuery.eq('stripe_account_id', accountId);
      } else if (customHandle) {
        profileQuery = profileQuery.ilike('handle', customHandle.trim());
      }


      const { data: profileRecord } = await profileQuery.maybeSingle();

      if (returnedTier && profileRecord) {
        await _supabase
          .from('profiles')
          .update({ tier: returnedTier, updated_at: new Date().toISOString() })
          .eq('id', profileRecord.id);

        if (returnedTier === 'free' && typeof window !== 'undefined') {
          localStorage.removeItem('mm_dev_tier');
        }
      }

      const resolvedTier =
        returnedTier ||
        (isDevSuiteEnabled && devTier && devTier !== 'logged_out' ? devTier : null) ||
        profileRecord?.tier ||
        'free';


      const individualArtistHandle =
        profileRecord?.artist_handle?.trim() ||
        profileRecord?.handle?.trim() ||
        customHandle?.trim() ||
        null;

      const labelStoreHandle =
        profileRecord?.handle?.trim() ||
        customHandle?.trim() ||
        null;

            if (profileRecord) {
        setUserProfileId(profileRecord.id);
        setUserTier(resolvedTier);
        setUserHandle(labelStoreHandle);
        setArtistHandle(individualArtistHandle);
        setMainArtistProfileId(profileRecord.main_artist_profile_id || null);
        setIsSuperAdmin(Boolean(profileRecord.is_super_admin));


        if (profileRecord.logo_url) {
          setUserLogoUrl(profileRecord.logo_url);
        }

        setStripeAccountId(profileRecord.stripe_account_id || accountId || null);

        if (
          resolvedTier === 'label' &&
          (!profileRecord.label_name ||
            !profileRecord.handle ||
            profileRecord.handle.startsWith('label-'))
        ) {
          setLabelInputName(profileRecord.label_name || '');
          setIsLabelSetupModalOpen(true);
        }
      } else {
        setUserTier(resolvedTier);
      }


      setIsCheckingAuth(false);

            const activeOwnerId = profileRecord?.id || ownerId;
      let effectiveArtistHandle = individualArtistHandle;

      if (activeOwnerId) {
        let combinedRoster: any[] = [];
        const targetMainId = profileRecord?.main_artist_profile_id || null;

        if (resolvedTier === 'label' || targetMainId) {
          const { data: rosterData, error: rosterError } = await _supabase
            .from('profiles')
            .select('*')
            .eq('parent_label_id', activeOwnerId);

          if (!rosterError) {
            combinedRoster = rosterData || [];
            if (profileRecord && !combinedRoster.some(a => a.id === profileRecord.id)) {
              combinedRoster = [profileRecord, ...combinedRoster];
            }
            if (resolvedTier === 'label') {
              setRosterArtistsList(combinedRoster);
              setRosterCount(combinedRoster.length);
            }
          }
        } else if (profileRecord) {
          combinedRoster = [profileRecord];
          setRosterArtistsList(combinedRoster);
          setRosterCount(1);
        }

        if (targetMainId) {
          let designatedMain = combinedRoster.find(a => a.id === targetMainId);
          if (!designatedMain) {
            const { data: mainProfileRow } = await _supabase
              .from('profiles')
              .select('*')
              .eq('id', targetMainId)
              .maybeSingle();
            designatedMain = mainProfileRow || undefined;
          }

          const designatedHandle =
            designatedMain?.artist_handle?.trim() || designatedMain?.handle?.trim();
          if (designatedHandle) {
            effectiveArtistHandle = designatedHandle;
            setArtistHandle(designatedHandle);
          }
        }


                 let trackQuery = _supabase
          .from('tracks_pro')
          .select('*')
          .is('deleted_at', null)
          .order('track_order', { ascending: true, nullsFirst: false });


        if (resolvedTier === 'label') {
          const handles = combinedRoster
            .flatMap((a) => [a.handle, a.artist_handle])
            .filter(Boolean);
          const uniqueHandles = Array.from(
            new Set(
              handles.flatMap((h) => [String(h).trim(), String(h).trim().toLowerCase()])
            )
          );

          if (uniqueHandles.length > 0) {
            trackQuery = trackQuery.in('artist_handle', uniqueHandles);
          }
                           } else {
          const activeMainHandle =
            effectiveArtistHandle || individualArtistHandle || labelStoreHandle;
          const scopedHandles = Array.from(
            new Set(
              [activeMainHandle]
                .filter(Boolean)
                .flatMap((h) => [String(h).trim(), String(h).trim().toLowerCase()])
            )
          );

          if (scopedHandles.length > 0) {
            trackQuery = trackQuery.in('artist_handle', scopedHandles);
          }
        }





        const { data: trackData, error: trackError } = await trackQuery;

        if (trackError) throw trackError;
        
                if (trackData) {
          let finalTracks = trackData;

          if (resolvedTier === 'free') {
            const sortedTracks = [...trackData].sort((a, b) => (a.track_order ?? 0) - (b.track_order ?? 0));

            const excessTracks = sortedTracks.slice(10);

            if (excessTracks.length > 0) {
              const excessIds = excessTracks.map(t => t.id);
              finalTracks = sortedTracks.map(t => 
                excessIds.includes(t.id) ? { ...t, is_archived: true } : { ...t, is_archived: false }
              );

              _supabase
                .from('tracks_pro')
                .update({ is_archived: true, archived_at: new Date().toISOString() })
                .in('id', excessIds)
                .then(({ error }) => {
                  if (error) console.error('Error auto-archiving excess tracks:', error);
                });
            } else {
              finalTracks = sortedTracks.map(t => ({ ...t, is_archived: false }));
            }
          } else {
            finalTracks = trackData.map(t => ({ ...t, is_archived: false }));
          }

          setTracks(finalTracks);
        }

        const { data: albumMetaData, error: albumMetaError } = await _supabase
          .from('albums_meta')
          .select('*');

        if (albumMetaError) {
          console.error('Error fetching albums_meta:', albumMetaError);
        }

        if (albumMetaData) {
          const metaMap: Record<string, string> = {};
          albumMetaData.forEach((meta) => {
            let resolvedUrl = meta.artwork_url;
            if (!resolvedUrl && meta.artwork_file_path) {
              const { data: publicURLData } = _supabase.storage
                .from('v2-cover-art')
                .getPublicUrl(meta.artwork_file_path);
              resolvedUrl = publicURLData.publicUrl;
            }

            if (resolvedUrl && meta.album_name) {
              const bustedUrl = `${resolvedUrl}?t=${Date.now()}`;
              metaMap[meta.album_name] = bustedUrl;
              metaMap[meta.album_name.trim().toLowerCase()] = bustedUrl;
            }
          });
          setAlbumMetaMap(metaMap);
        }
      }
    } catch (err: any) {
      console.error('Error loading dashboard data:', err?.message || err, JSON.stringify(err, null, 2));
    } finally {
      setLoadingData(false);
    }
  };

  const handleSendSupportEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supportSubject.trim() || !supportMessage.trim()) {
      alert('Please fill out both a subject and a message before sending.');
      return;
    }

    setIsSendingSupport(true);
    try {
      const mailtoLink = `mailto:musicmarketllc.business@gmail.com?subject=${encodeURIComponent(`[${supportCategory}] ${supportSubject}`)}&body=${encodeURIComponent(`Category: ${supportCategory}\nUser ID / Email: ${userEmail || userProfileId || 'Unknown'}\nTier: ${userTier}\n\nMessage:\n${supportMessage}`)}`;
      window.location.href = mailtoLink;
      
      setIsSupportModalOpen(false);
      setSupportSubject('');
      setSupportMessage('');
      alert('Support client opened successfully!');
    } catch (err: any) {
      console.error('Support dispatch error:', err);
      alert('Failed to launch support client. Please email us directly at musicmarket@2G-ent.com');
    } finally {
      setIsSendingSupport(false);
    }
  };

  const generateSlug = (name: string) => {
    return name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  };

    const handleSaveLabelSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = labelInputName.trim();
    if (!trimmedName) {
      alert('Please enter your Official Label Name.');
      return;
    }

    if (!userProfileId) {
      alert('Missing workspace profile ID. Please refresh and try again.');
      return;
    }

    let autoHandle = generateSlug(trimmedName) || `imprint-${Date.now().toString().slice(-5)}`;
    if (autoHandle.startsWith('label-')) {
      autoHandle = `imprint-${autoHandle.slice(6) || Date.now().toString().slice(-5)}`;
    }

    setSavingLabelSetup(true);
    try {
      let { data: updatedRow, error } = await _supabase
        .from('profiles')
        .update({
          label_name: trimmedName,
          handle: autoHandle,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userProfileId)
        .select('id, label_name, handle')
        .maybeSingle();

      if (error && error.code === '23505') {
        autoHandle = `${autoHandle}-${Math.floor(1000 + Math.random() * 9000)}`;
        const retry = await _supabase
          .from('profiles')
          .update({
            label_name: trimmedName,
            handle: autoHandle,
            updated_at: new Date().toISOString(),
          })
          .eq('id', userProfileId)
          .select('id, label_name, handle')
          .maybeSingle();
        updatedRow = retry.data;
        error = retry.error;
      }

      if (error) throw error;
      if (!updatedRow?.label_name || !updatedRow?.handle) {
        throw new Error('Label profile could not be verified after saving (check Supabase RLS/permissions for profiles).');
      }

      setUserHandle(updatedRow.handle);
      setIsLabelSetupModalOpen(false);
      await verifyAndLoadWorkspace();
    } catch (err: any) {
      console.error('Error updating label profile:', err);
      alert(`Failed to save label details: ${err?.message || 'Unknown error'}`);
    } finally {
      setSavingLabelSetup(false);
    }
  };


  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userProfileId) return;

    setUploadingLogo(true);
    try {
      const fileExt = file.name.split('.').pop() || 'jpg';
      const fileName = `logo-${userProfileId}-${Date.now()}.${fileExt}`;
      
      const { data: uploadData, error: uploadError } = await _supabase.storage
        .from('v2-cover-art')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const publicUrl = _supabase.storage
        .from('v2-cover-art')
        .getPublicUrl(uploadData.path).data.publicUrl;

      const { error: updateError } = await _supabase
        .from('profiles')
        .update({ logo_url: publicUrl })
        .eq('id', userProfileId);

      if (updateError) throw updateError;

      setUserLogoUrl(publicUrl);
      alert('Label logo updated successfully!');
    } catch (err: any) {
      console.error('Logo upload error:', err);
      alert(`Failed to upload logo: ${err.message}`);
    } finally {
      setUploadingLogo(false);
    }
  };

    const handleSetMainArtist = async (targetArtist: any) => {
    if (!userProfileId || !targetArtist?.id) return;

    const chosenHandle =
      targetArtist.artist_handle?.trim() || targetArtist.handle?.trim() || '';

    if (
      !confirm(
        `Set ${targetArtist.name || targetArtist.handle || 'this artist'} (@${chosenHandle}) as your designated Main Artist? If you downgrade below Label tier, only this Main Artist remains active while other roster artists stay saved until you upgrade again.`
      )
    ) {
      return;
    }

    setSettingMainArtistId(targetArtist.id);
    try {
      const nextMainId =
        targetArtist.id === userProfileId && !targetArtist.parent_label_id
          ? null
          : targetArtist.id;

      const { error } = await _supabase
        .from('profiles')
        .update({
          main_artist_profile_id: nextMainId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userProfileId);

      if (error) throw error;

      setMainArtistProfileId(nextMainId);
      if (chosenHandle) {
        setArtistHandle(chosenHandle);
      }
      verifyAndLoadWorkspace();
    } catch (err: any) {
      console.error('Error setting main artist:', err);
      alert(`Failed to update main artist: ${err?.message || 'Unknown error'}`);
    } finally {
      setSettingMainArtistId(null);
    }
  };

  const handleRemoveLogo = async () => {

    if (!userProfileId || !confirm('Are you sure you want to remove your label logo?')) return;

    try {
      const { error: updateError } = await _supabase
        .from('profiles')
        .update({ logo_url: null })
        .eq('id', userProfileId);

      if (updateError) throw updateError;

      setUserLogoUrl(null);
      alert('Label logo removed successfully.');
    } catch (err: any) {
      console.error('Error removing logo:', err);
      alert(`Failed to remove logo: ${err.message}`);
    }
  };

    const softDeleteTracksMatchingHandles = async (handlesToMatch: string[]) => {
    const normalizedTargets = Array.from(
      new Set(
        handlesToMatch
          .map((h) => h?.trim().toLowerCase())
          .filter(Boolean)
      )
    );

    if (normalizedTargets.length === 0) return;

    const { data: matchingTracks, error: fetchErr } = await _supabase
      .from('tracks_pro')
      .select('id, artist_handle')
      .is('deleted_at', null);

    if (fetchErr) throw fetchErr;

    const toSoftDelete = (matchingTracks || []).filter((t) =>
      t.artist_handle ? normalizedTargets.includes(String(t.artist_handle).trim().toLowerCase()) : false
    );

    if (toSoftDelete.length === 0) return;

    const idsToSoftDelete = toSoftDelete.map((t) => t.id);
    const deletedAtIso = new Date().toISOString();

    const { error: delErr } = await _supabase
      .from('tracks_pro')
      .update({ deleted_at: deletedAtIso })
      .in('id', idsToSoftDelete);

    if (delErr) throw delErr;

    const idSet = new Set(idsToSoftDelete.map(String));
    setTracks((prev) => prev.filter((t) => !idSet.has(String(t.id))));
    setSelectedTrackIds((prev) => prev.filter((id) => !idSet.has(String(id))));
  };

  const toggleSelectTrack = (trackId: string | number) => {
    setSelectedTrackIds((prev) => {
      const exists = prev.some((id) => String(id) === String(trackId));
      if (exists) {
        return prev.filter((id) => String(id) !== String(trackId));
      }
      return [...prev, trackId];
    });
  };

  const handleDeleteSelectedTracks = async () => {
    if (selectedTrackIds.length === 0 || isDeletingBulk) return;

    if (
      !confirm(
        `Remove ${selectedTrackIds.length} selected track(s) from your active catalog? They will enter a 30-day recovery window before permanent deletion.`
      )
    ) {
      return;
    }

    setIsDeletingBulk(true);
    try {
      const selectedSet = new Set(selectedTrackIds.map(String));
      const deletedAtIso = new Date().toISOString();

      const { error: dbError } = await _supabase
        .from('tracks_pro')
        .update({ deleted_at: deletedAtIso })
        .in('id', Array.from(selectedSet));

      if (dbError) throw dbError;

      setTracks((prev) => prev.filter((t) => !selectedSet.has(String(t.id))));
      setSelectedTrackIds([]);
    } catch (err: any) {
      console.error('Bulk track delete error:', err);
      alert(`Failed to remove selected tracks: ${err?.message || 'Unknown error'}`);
    } finally {
      setIsDeletingBulk(false);
    }
  };

  const handleDeleteTrack = async (trackId: string | number, trackTitle: string, audioPath?: string, artworkPath?: string) => {
    if (
      !confirm(
        `Remove "${trackTitle}" from your active catalogue? It will enter a 30-day recovery window before permanent deletion.`
      )
    ) {
      return;
    }

    try {
      const deletedAtIso = new Date().toISOString();
      const { error: dbError } = await _supabase
        .from('tracks_pro')
        .update({ deleted_at: deletedAtIso })
        .eq('id', trackId);

      if (dbError) throw dbError;

      // Only remove storage assets if no other loaded track shares the path
      const otherTracksUsingArtwork = artworkPath
        ? tracks.some((t) => String(t.id) !== String(trackId) && t.artwork_file_path === artworkPath)
        : true;

      if (audioPath) {
        await _supabase.storage.from('v2-audio-vault').remove([audioPath]);
      }
      if (artworkPath && !otherTracksUsingArtwork) {
        await _supabase.storage.from('v2-cover-art').remove([artworkPath]);
      }

      setTracks((prev) => prev.filter((t) => String(t.id) !== String(trackId)));
      setSelectedTrackIds((prev) => prev.filter((id) => String(id) !== String(trackId)));
    } catch (err: any) {
      console.error('Error deleting track:', err);
      alert(`Failed to delete track: ${err?.message || 'Database permissions or RLS policy blocked the deletion.'}`);
    }
  };


    const handleDeleteAlbum = async (albumName: string) => {
    if (!confirm(`Are you sure you want to delete album "${albumName}"?`)) return;

    try {
      const changedUpdates: Array<{ id: string | number; album_name: string | null }> = [];

      const updatedTracks = tracks.map((t) => {
        const list = t.album_name
          ? t.album_name
              .split(',')
              .map((s: string) => s.trim())
              .filter((s: string) => s && s !== albumName)
          : [];
        const nextAlbumName = list.length > 0 ? list.join(', ') : null;

        if ((t.album_name || null) !== nextAlbumName) {
          changedUpdates.push({ id: t.id, album_name: nextAlbumName });
          return { ...t, album_name: nextAlbumName };
        }
        return t;
      });

      await Promise.all(
        changedUpdates.map((item) =>
          _supabase
            .from('tracks_pro')
            .update({ album_name: item.album_name })
            .eq('id', item.id)
        )
      );

      setTracks(updatedTracks);
    } catch (err) {
      console.error('Error deleting album:', err);
      alert('Failed to delete album.');
    }
  };




       useEffect(() => {
    verifyAndLoadWorkspace();

    const { data: { subscription } } = _supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setUserProfileId(null);
        setUserHandle(null);
        setArtistHandle(null);
        setIsSuperAdmin(false);
        router.replace('/auth');
        return;
      }
      if (session) {
        verifyAndLoadWorkspace();
      }
    });


    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        verifyAndLoadWorkspace();
      }
    };

    const handleGlobalTierChange = () => verifyAndLoadWorkspace();

    window.addEventListener('pageshow', handlePageShow);
    window.addEventListener('mm_tier_changed', handleGlobalTierChange);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('pageshow', handlePageShow);
      window.removeEventListener('mm_tier_changed', handleGlobalTierChange);
    };
  }, [accountId, customHandle, router]);

  useEffect(() => {
    if (connectStatus !== 'verify' || !pendingAccountParam) return;

    let cancelled = false;

    async function verifyReturnOnboarding() {
      try {
        const res = await fetch('/api/connect/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pendingAccountId: pendingAccountParam,
            profileId: userProfileId || profileId,
            handle: resolvedHandle || customHandle,
          }),
        });

        const data = await res.json();
        if (cancelled) return;

        if (res.ok && data.verified && data.accountId) {
          setStripeAccountId(data.accountId);
          const cleanUrl = new URL(window.location.href);
          cleanUrl.searchParams.delete('connect');
          cleanUrl.searchParams.delete('pending_account');
          router.replace(`${cleanUrl.pathname}${cleanUrl.search}`);
          verifyAndLoadWorkspace();
        }
      } catch (err) {
        console.error('Return onboarding verification error:', err);
      }
    }

    verifyReturnOnboarding();

    return () => {
      cancelled = true;
    };
  }, [connectStatus, pendingAccountParam, userProfileId, profileId, resolvedHandle, customHandle, router]);


  if (isCheckingAuth) {
    return <div className="text-neutral-400 my-auto py-20 text-center text-sm">Verifying workspace session...</div>;

  }

  const filteredTracks = tracks.filter(t => 
    t.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.album_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.artist_handle?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const displayedTracks = showAllTracks ? filteredTracks : filteredTracks.slice(0, 3);
    const uniqueAlbums = Array.from(
new Set(
tracks.flatMap(t => t.album_name ? t.album_name.split(',').map((s: string) => s.trim()) : [])
)
).filter(Boolean).sort((a, b) => {
const indexA = tracks.find(t => t.album_name?.split(',').map((s: string) => s.trim()).includes(a))?.album_index ?? 9999;
const indexB = tracks.find(t => t.album_name?.split(',').map((s: string) => s.trim()).includes(b))?.album_index ?? 9999;
return indexA - indexB;
});

  const filteredAlbums = uniqueAlbums.filter((albumName) => {
    const q = albumSearchQuery.trim().toLowerCase();
    if (!q) return true;
    if (albumName.toLowerCase().includes(q)) return true;

    return tracks.some((t) => {
      const belongsToAlbum = t.album_name
        ?.split(',')
        .map((s: string) => s.trim())
        .includes(albumName);
      if (!belongsToAlbum) return false;
      return (
        t.title?.toLowerCase().includes(q) ||
        t.artist_handle?.toLowerCase().includes(q)
      );
    });
  });

const displayedAlbums = showAllAlbums ? filteredAlbums : filteredAlbums.slice(0, 3);




  return (
    <div className="w-full max-w-4xl space-y-8 my-8">
      
      




{/* PlatformHeader */}
<PlatformHeader 
  userTier={userTier} 
  onOpenSupport={() => setIsSupportModalOpen(true)}
  rightContent={
    <div className="flex items-center gap-2">

   {/* Expandable Tutorials & Help Button */}
<a
  ref={tutorialButtonRef}
  href="https://www.youtube.com/@MusicMarketllc"
  target="_blank"
  rel="noopener noreferrer"
  onClick={(e) => {
    if (!isTutorialExpanded) {
      e.preventDefault();
      setIsTutorialExpanded(true);
    } else {
      setIsTutorialExpanded(false);
    }
  }}
  className={`h-[38px] rounded-[10px] bg-[#1e1e1e] hover:bg-[#252525] border border-[#333] hover:border-purple-500 flex items-center justify-center text-purple-400 text-xs font-bold transition-all duration-300 cursor-pointer shadow-md overflow-hidden ${
    isTutorialExpanded ? 'px-3 gap-1.5 w-auto' : 'w-[38px] px-0'
  }`}
  title="Tutorials & Help"
>
  <svg className="w-4 h-4 text-purple-400 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polygon points="10 8 16 12 10 16 10 8" fill="currentColor" />
  </svg>
  <span className={`whitespace-nowrap transition-opacity duration-200 ${isTutorialExpanded ? 'opacity-100 inline' : 'opacity-0 hidden'}`}>
    Tutorials & Help
  </span>
</a>

      
      {/* Unified Analytics Button */}
<button
  onClick={() => setIsAnalyticsModalOpen(true)}
  className="w-[38px] h-[38px] rounded-[10px] bg-[#1e1e1e] hover:bg-[#252525] border border-[#333] hover:border-purple-500 flex items-center justify-center transition-all cursor-pointer shadow-md"
  title="Unified Analytics Command Center"
>
  <svg className="w-4 h-4" fill="none" strokeWidth="2.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    {/* First Bar (Left) - Signature Orange */}
    <path stroke="#ff8c00" strokeLinecap="round" strokeLinejoin="round" d="M6 20v-6" />
    {/* Middle Bar - Signature Emerald Green */}
    <path stroke="#2ecc71" strokeLinecap="round" strokeLinejoin="round" d="M12 20V4" />
    {/* Last Bar (Right) - Signature Orange */}
    <path stroke="#ff8c00" strokeLinecap="round" strokeLinejoin="round" d="M18 20V10" />
  </svg>
</button>


      {/* Existing Power Menu */}
      <div className="relative" ref={powerMenuRef}>
        <button
          onClick={() => setIsPowerMenuOpen(!isPowerMenuOpen)}
          className="w-[38px] h-[38px] rounded-[10px] bg-[#1e1e1e] hover:bg-[#252525] border border-[#333] hover:border-[#ff8c00] flex items-center justify-center text-[#ff8c00] transition-all cursor-pointer shadow-md"
          title="Workspace Power & Account Options"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5.636 5.636a9 9 0 1012.728 0M12 3v9"></path>
          </svg>
        </button>

        {isPowerMenuOpen && (
          <div className="absolute right-0 mt-2 w-48 bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl py-2 z-50 text-left animate-fadeIn">
            <div className="px-4 py-2 border-b border-neutral-800">
              <span className="text-[10px] text-neutral-500 uppercase tracking-wider font-bold block">Current Tier</span>
              <span className="text-xs font-bold text-[#ff8c00] capitalize">{userTier} Tier</span>
            </div>

            <div className="py-1">
                            {userTier !== 'label' && (
                <button
                  onClick={() => {
                    setIsPowerMenuOpen(false);
                    const resolvedHandle = userHandle || artistHandle || customHandle || '';
                    const queryBase = `tier=${encodeURIComponent(userTier)}&handle=${encodeURIComponent(resolvedHandle)}&account_id=${encodeURIComponent(accountId || '')}${userProfileId ? `&profile_id=${encodeURIComponent(userProfileId)}` : ''}`;
                    router.push(`/upgrade?${queryBase}`);
                  }}

                  className="w-full text-left px-4 py-2.5 text-xs text-neutral-200 hover:bg-neutral-800 flex items-center gap-2 cursor-pointer transition-all"
                >
                  <svg className="w-4 h-4 text-[#ff8c00]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7"></path></svg>
                  Upgrade Tier
                </button>
              )}

                            {userTier !== 'free' && (
                <button
                  onClick={() => {
                    setIsPowerMenuOpen(false);
                    if (confirm('Are you sure you want to manage or downgrade your subscription tier? Changing your plan may restrict catalogue limits or commission rates.')) {
                      const resolvedHandle = userHandle || artistHandle || customHandle || '';
                      const queryBase = `tier=${encodeURIComponent(userTier)}&handle=${encodeURIComponent(resolvedHandle)}&account_id=${encodeURIComponent(accountId || '')}${userProfileId ? `&profile_id=${encodeURIComponent(userProfileId)}` : ''}`;
                      router.push(`/upgrade?action=downgrade&${queryBase}`);
                    }
                  }}

                  className="w-full text-left px-4 py-2.5 text-xs text-neutral-200 hover:bg-neutral-800 flex items-center gap-2 cursor-pointer transition-all"
                >
                  <svg className="w-4 h-4 text-neutral-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"></path></svg>
                  Manage / Downgrade
                </button>
              )}

              <div className="border-t border-neutral-800 my-1"></div>

              <button
                onClick={() => {
                  setIsPowerMenuOpen(false);
                  handleLogout();
                }}
                className="w-full text-left px-4 py-2.5 text-xs text-red-400 hover:bg-red-500/10 flex items-center gap-2 cursor-pointer transition-all font-bold"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
                Log Out
              </button>
            </div>
          </div>
        )}
      </div>

    </div>
  }
/>




      {/* Top Header Row */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-neutral-800 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">Artist & Label Workspace</h1>
          <p className="text-neutral-400 text-sm mt-1">
            Manage your catalogue, artist roster links, and direct payouts.
          </p>
        </div>
        
                <button 
          onClick={() => setIsShareModalOpen(true)}
          className="bg-[#ff8c00] hover:bg-[#e07b00] text-neutral-950 font-extrabold px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-[#ff8c00]/10"
        >
          {userTier === 'label' ? 'Copy Store & Roster Links' : 'Copy Store Link'}
        </button>
      </div>

      {(scheduledTier === 'artist' || cancelAtPeriodEnd) && (
        <div className="bg-[#ff8c00]/10 border border-[#ff8c00]/40 rounded-2xl p-4 text-left flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <span className="text-[10px] bg-[#ff8c00] text-neutral-950 font-black uppercase px-2 py-0.5 rounded">
              Scheduled Billing Change
            </span>
            <p className="text-xs text-white font-semibold pt-1">
              {scheduledTier === 'artist'
                ? 'Your workspace will switch from Label Executive to Independent Artist at the end of your current paid billing period.'
                : 'Your paid subscription is set to cancel at the end of your current paid billing period, after which your workspace will move to the Free tier.'}
            </p>
            <p className="text-[11px] text-neutral-400">
              You keep full access to your current tier benefits until the current cycle finishes.
            </p>
          </div>
        </div>
      )}

      {/* Quick Metrics Grid */}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
        {userTier === 'label' ? (
          <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-xl flex items-center gap-4">
            <div className="relative group w-14 h-14 rounded-xl bg-neutral-950 border border-neutral-700 flex items-center justify-center overflow-hidden flex-shrink-0 cursor-pointer">
              {userLogoUrl ? (
                <img src={userLogoUrl} alt="Label Logo" className="w-full h-full object-cover" />
              ) : (
                <span className="text-[10px] font-black text-[#ff8c00]">LOGO</span>
              )}
              <label className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-[10px] font-bold text-white transition-opacity cursor-pointer">
                {uploadingLogo ? '...' : 'Upload'}
                <input type="file" accept="image/jpeg, image/png, image/jpg" onChange={handleLogoUpload} className="hidden" />
              </label>
            </div>
            
            <div className="space-y-0.5 flex-1 overflow-hidden">
              <span className="text-[10px] text-neutral-500 uppercase tracking-wider font-semibold block">Account Tier</span>
              <h3 className="font-bold text-sm text-[#ff8c00] truncate">Label Executive</h3>
              <p className="text-[11px] text-neutral-400 truncate">Roster: {rosterCount}/4</p>
              {userLogoUrl && (
                <button onClick={handleRemoveLogo} className="text-[10px] text-red-400 hover:underline pt-0.5 block">
                  Remove Logo
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="p-5 bg-neutral-900 border border-neutral-800 rounded-xl space-y-1">
            <span className="text-xs text-neutral-500 uppercase tracking-wider font-semibold">Account Tier</span>
            <h3 className="font-bold text-lg text-[#ff8c00]">
              {userTier === 'free' ? 'Free Tier (10 Track Limit)' : 'Independent Artist Tier'}
            </h3>
                        <p className="text-xs text-neutral-400">
              {userTier === 'free' ? '15% marketplace commission' : '10% Marketplace commission'}
            </p>

          </div>
        )}

                <DirectBalanceButton
          artistHandle={artistHandle || userHandle || customHandle || ''}
          tier={userTier}

  stripeAccountId={stripeAccountId}
  profileId={userProfileId}
  email={userEmail}
  displayName={resolvedHandle}
  onboardEndpoint="/api/connect/onboard"
/>


        <div className="p-5 bg-neutral-900 border border-neutral-800 rounded-xl space-y-1">
          <span className="text-xs text-neutral-500 uppercase tracking-wider font-semibold">Catalog Tracks</span>
          <h3 className="font-bold text-lg text-white">
            {userTier === 'free' ? `${tracks.length} / 10 Used` : `${tracks.length} Uploaded`}
          </h3>
          <p className="text-xs text-neutral-400">Live on marketplace</p>
        </div>
      </div>


      {!stripeAccountId && (
        <div className="bg-emerald-500/10 border border-emerald-500/35 rounded-2xl p-4 text-left flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-black uppercase px-2 py-0.5 rounded">
              Payouts & Direct Sales Soft-Locked
            </span>
            <p className="text-xs text-white font-semibold pt-1">
              Your workspace and catalog are active—connect your Stripe payout account to unlock live direct track sales and payouts.
            </p>
            <p className="text-[11px] text-neutral-400">
              Use the <span className="text-emerald-400 font-semibold">Verify Payout Method</span> card above anytime to finish Stripe setup.
            </p>
          </div>
        </div>
      )}



      {/* Upgrade Banner for Free Tier */}
      {userTier === 'free' && (
        <div className="bg-gradient-to-r from-[#ff8c00]/15 via-neutral-900 to-neutral-900 border border-[#ff8c00]/40 rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-left">
          <div className="space-y-1">
            <span className="text-[10px] bg-[#ff8c00] text-neutral-950 font-black uppercase px-2.5 py-0.5 rounded-md">
              Unlock Full Access
            </span>
            <h3 className="text-base font-bold text-white pt-1">Upgrade to Artist or Label Tier</h3>
                     <p className="text-xs text-neutral-400">
              Remove the 10-track limit and lower your marketplace commission to 10% (Artist) or 5% (Label).
            </p>

          </div>
                    <button
            onClick={() => {
              const resolvedHandle = userHandle || artistHandle || customHandle || '';
              const queryBase = `tier=${encodeURIComponent(userTier)}&handle=${encodeURIComponent(resolvedHandle)}&account_id=${encodeURIComponent(accountId || '')}${userProfileId ? `&profile_id=${encodeURIComponent(userProfileId)}` : ''}`;
              router.push(`/upgrade?${queryBase}`);
            }}
            className="bg-[#ff8c00] hover:bg-[#e07b00] text-neutral-950 font-extrabold px-5 py-3 rounded-xl text-xs whitespace-nowrap cursor-pointer transition-all"
          >
            Upgrade Workspace &rarr;
          </button>

        </div>
      )}

      {/* Active Artist Roster Section (Label Tier Only) */}
      {userTier === 'label' && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 text-left space-y-6">
          <div className="flex justify-between items-center flex-wrap gap-3">
            <div>
              <h3 className="font-semibold text-lg text-[#ff8c00]">Active Artist Roster</h3>
              <p className="text-sm text-neutral-400">Manage artists signed under your Label Executive account.</p>
            </div>
            <button 
              onClick={() => {
                if (rosterCount >= 4) {
                  alert('Roster limit reached! Label tier accounts are capped at 4 artists.');
                  return;
                }
                setIsAddArtistModalOpen(true);
              }}
              className="bg-neutral-800 hover:bg-neutral-700 text-emerald-400 font-bold px-4 py-2 rounded-xl text-xs border border-neutral-700 cursor-pointer flex items-center gap-1.5"
            >
              + Add Artist
            </button>
          </div>

                    <div className="bg-neutral-950/80 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-[11px] text-neutral-400">
            <span className="text-[#ff8c00] font-bold">Main Artist & Downgrade Rule:</span>{' '}
            Designate which artist is your <span className="text-white font-semibold">Main</span> artist. If you downgrade below Label tier, only the designated Main artist remains active while other roster artists stay saved until you upgrade again.
          </div>

          {rosterArtistsList.length === 0 ? (
            <div className="text-neutral-500 text-xs py-6 text-center bg-neutral-950 rounded-xl border border-neutral-800">
              No artists added to your roster yet. Click "+ Add Artist" to register your first talent!
            </div>
          ) : (
            <div className="space-y-3">
              {rosterArtistsList.map((artist) => {
                const isSelf = artist.id === userProfileId;
                const activeMainId = mainArtistProfileId || userProfileId;
                const isMainArtist = artist.id === activeMainId;
                                const targetHandle = artist.artist_handle || artist.handle || 'lakim';
                const artistPlayerUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/artist/${targetHandle}?view=player`;

                const formattedArtistName = artist.artist_handle
                  ?.trim()
                  .replace(/[-_]+/g, ' ')
                  .replace(/\b\w/g, (ch: string) => ch.toUpperCase());

                const displayName =
                  artist.stage_name?.trim() ||
                  formattedArtistName ||
                  artist.name?.trim() ||
                  artist.handle?.trim() ||
                  'Artist';


                              return (
                  <div key={artist.id} className="bg-neutral-950 p-3 rounded-xl border border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3">
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-white truncate">
                        {displayName}{' '}
                        {isMainArtist && (
                          <span className="text-[9px] bg-[#ff8c00]/20 text-[#ff8c00] px-1.5 py-0.5 rounded-full ml-1">
                            Main
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-[#ff8c00] truncate">@{targetHandle} (Audio Player)</div>
                    </div>
                    <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0 flex-wrap justify-start sm:justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-neutral-900">

                      {!isMainArtist && (
                        <button
                          type="button"
                          disabled={settingMainArtistId === artist.id}
                          onClick={() => handleSetMainArtist(artist)}
                          className="bg-[#ff8c00]/15 hover:bg-[#ff8c00]/25 text-[#ff8c00] font-bold px-3 py-1.5 rounded-lg text-xs whitespace-nowrap cursor-pointer border border-[#ff8c00]/40 disabled:opacity-50"
                        >
                          {settingMainArtistId === artist.id ? 'Setting...' : 'Set as Main'}
                        </button>
                      )}

                      <button
                        onClick={() => handleCopy(artistPlayerUrl, artist.id)}
                        className="bg-neutral-800 hover:bg-neutral-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs whitespace-nowrap cursor-pointer border border-neutral-700"
                      >
                        {copiedKey === artist.id ? 'Copied Player Link!' : 'Copy Player Link'}
                      </button>

                                           <button
                        type="button"
                        onClick={() => setSelectedArtistForEdit(artist)}
                        className="bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-bold px-3 py-1.5 rounded-lg text-xs whitespace-nowrap cursor-pointer border border-neutral-700"
                      >
                        Edit
                      </button>

                      {!isSelf ? (
                        <button
                          type="button"
                          onClick={async () => {
                            const handleLabel = artist.artist_handle || artist.handle || 'this artist';
                            if (
                              !confirm(
                                `Remove @${handleLabel} from your roster and move their tracks into a 30-day recovery window before permanent deletion?`
                              )
                            ) {
                              return;
                            }
                            try {
                              await softDeleteTracksMatchingHandles([
                                artist.artist_handle,
                                artist.handle,
                              ]);

                              if (mainArtistProfileId === artist.id) {
                                await _supabase
                                  .from('profiles')
                                  .update({ main_artist_profile_id: null, updated_at: new Date().toISOString() })
                                  .eq('id', userProfileId);
                                setMainArtistProfileId(null);
                              }

                              const { error } = await _supabase
                                .from('profiles')
                                .update({ parent_label_id: null, updated_at: new Date().toISOString() })
                                .eq('id', artist.id);

                              if (error) {
                                alert(`Failed to remove artist from roster: ${error.message}`);
                                return;
                              }
                              verifyAndLoadWorkspace();
                            } catch (err: any) {
                              alert(`Failed to remove artist: ${err?.message || 'Unknown error'}`);
                            }
                          }}
                          className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 cursor-pointer text-xs"
                        >
                          Remove
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={async () => {
                            const ownerArtistHandle = artist.artist_handle?.trim();
                            if (!ownerArtistHandle && !artist.name) {
                              alert('No artist metadata is currently assigned to your main account slot.');
                              return;
                            }

                            const otherRosterExists = rosterArtistsList.some(
                              (a) => a.id !== userProfileId
                            );
                            if (!otherRosterExists) {
                              alert(
                                'Add another artist to your roster first before clearing your primary account artist slot so your workspace always has an active artist.'
                              );
                              return;
                            }

                            if (
                              !confirm(
                                `Clear artist metadata (${ownerArtistHandle ? `@${ownerArtistHandle}` : artist.name}) from your main account row and move tracks under @${ownerArtistHandle || 'this slot'} into a 30-day recovery window? Your Label account itself stays intact.`
                              )
                            ) {
                              return;
                            }

                            try {
                              if (ownerArtistHandle) {
                                await softDeleteTracksMatchingHandles([ownerArtistHandle]);
                              }

                              const nextMainId =
                                mainArtistProfileId && mainArtistProfileId !== userProfileId
                                  ? mainArtistProfileId
                                  : rosterArtistsList.find((a) => a.id !== userProfileId)?.id || null;

                              const { error } = await _supabase
                                .from('profiles')
                                .update({
                                  name: null,
                                  artist_handle: null,
                                  main_artist_profile_id: nextMainId,
                                  updated_at: new Date().toISOString(),
                                })
                                .eq('id', userProfileId);

                              if (error) {
                                alert(`Failed to clear main artist slot: ${error.message}`);
                                return;
                              }

                              setMainArtistProfileId(nextMainId);
                              verifyAndLoadWorkspace();
                            } catch (err: any) {
                              alert(`Failed to clear main artist slot: ${err?.message || 'Unknown error'}`);
                            }
                          }}
                          className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 cursor-pointer text-xs"
                        >
                          Clear Slot
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}



      {/* Catalogue List */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 text-left space-y-6">
                <div className="flex flex-col gap-3">
          <div className="flex justify-between items-start sm:items-center flex-wrap gap-3">
            <div>
              <h3 className="font-semibold text-lg text-[#ff8c00]">Catalogue & Metadata</h3>
              <p className="text-sm text-neutral-400">Upload new masters, manage track metadata, and set pricing controls.</p>
            </div>

            <div className="flex items-center gap-2 flex-wrap ml-auto">
              <button 
                onClick={() => setIsSearchOpen(!isSearchOpen)}
                className={`font-bold px-3 py-2 rounded-xl text-xs border cursor-pointer transition-all flex items-center gap-1.5 ${
                  isSearchOpen ? 'bg-[#ff8c00] text-neutral-950 border-[#ff8c00]' : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border-neutral-700'
                }`}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
                {isSearchOpen ? 'Hide Search' : 'Search'}
              </button>
              <button 
                onClick={() => setIsReorderModalOpen(true)}
                className="bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-bold px-4 py-2 rounded-xl text-xs border border-neutral-700 cursor-pointer"
              >
                Reorder Tracks
              </button>
              <button 
                onClick={() => setIsUploadModalOpen(true)}
                className="bg-[#ff8c00] hover:bg-[#e07b00] text-neutral-950 font-bold px-4 py-2 rounded-xl text-xs cursor-pointer"
              >
                + Upload Track
              </button>
            </div>
          </div>

          {filteredTracks.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <label className="bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-bold px-3 py-1.5 rounded-xl text-xs border border-neutral-700 cursor-pointer flex items-center gap-2 select-none">
                <input
                  type="checkbox"
                  checked={
                    filteredTracks.length > 0 &&
                    filteredTracks.every((t) => selectedTrackIds.some((id) => String(id) === String(t.id)))
                  }
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedTrackIds(filteredTracks.map((t) => t.id));
                    } else {
                      setSelectedTrackIds([]);
                    }
                  }}
                  className="w-3.5 h-3.5 rounded accent-[#ff8c00] cursor-pointer"
                />
                <span>Select All</span>
              </label>

              {selectedTrackIds.length > 0 && (
                <button
                  type="button"
                  disabled={isDeletingBulk}
                  onClick={handleDeleteSelectedTracks}
                  className="bg-red-500/15 hover:bg-red-500/25 text-red-400 font-bold px-3.5 py-1.5 rounded-xl text-xs border border-red-500/40 cursor-pointer disabled:opacity-50"
                >
                  {isDeletingBulk ? 'Removing...' : `Delete Selected (${selectedTrackIds.length})`}
                </button>
              )}
            </div>
          )}
        </div>


        {/* Expandable Search Drawer */}
        {isSearchOpen && (
          <div className="bg-neutral-950 p-4 rounded-xl border border-neutral-800 space-y-2 animate-fadeIn">
            <div className="flex justify-between items-center">
              <label className="text-xs text-neutral-400 font-bold uppercase tracking-wider">Filter Catalogue</label>
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="text-xs text-[#ff8c00] hover:underline cursor-pointer"
                >
                  Clear filter
                </button>
              )}
            </div>
                       <input
              type="text"
              placeholder="Search by track title, album, or artist handle..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-neutral-900 border border-neutral-800 focus:border-[#ff8c00] px-4 py-2.5 rounded-xl text-base sm:text-xs text-white outline-none touch-manipulation"
              autoFocus
            />

          </div>
        )}

        {loadingData ? (
          <div className="text-center py-6 text-neutral-500 text-xs">Loading catalogue...</div>
        ) : displayedTracks.length === 0 ? (
          <div className="text-center py-8 text-neutral-500 text-xs bg-neutral-950 rounded-xl border border-neutral-800">
            {searchQuery ? `No tracks found matching "${searchQuery}"` : 'No tracks uploaded to your catalogue yet.'}
          </div>
        ) : (
          <div className="space-y-3">
                        {displayedTracks.map((track) => {
              const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
              const dropUrl = `${baseUrl}/artist/${track.artist_handle || labelCorporateHandle}?drop=${track.id}`;
              const downloadUrl = track.audio_file_path && supabaseUrl ? `${supabaseUrl}/storage/v1/object/public/v2-audio-vault/${track.audio_file_path}` : null;
              const artworkUrl = track.artwork_url || (track.artwork_file_path && supabaseUrl ? `${supabaseUrl}/storage/v1/object/public/v2-cover-art/${track.artwork_file_path}` : null);


                            const isTrackSelected = selectedTrackIds.some((id) => String(id) === String(track.id));

                            return (
                <div key={track.id} className="bg-neutral-950 border border-neutral-800/80 p-3.5 sm:p-4 rounded-xl flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-4">
                  <div className="flex items-center justify-between sm:justify-start gap-3 min-w-0">
                    <div className="flex items-center gap-3 min-w-0">
                      <input
                        type="checkbox"
                        checked={isTrackSelected}
                        onChange={() => toggleSelectTrack(track.id)}
                        aria-label={`Select ${track.title}`}
                        className="w-4 h-4 rounded accent-[#ff8c00] cursor-pointer flex-shrink-0"
                      />
                      <div className="w-10 h-10 rounded-lg bg-neutral-900 border border-neutral-800 overflow-hidden flex-shrink-0 flex items-center justify-center">
                        {artworkUrl ? (
                          <img src={artworkUrl} alt={track.title} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-[9px] font-black text-neutral-600">ART</span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className={`text-sm font-bold truncate ${track.is_archived ? 'text-neutral-500 line-through' : 'text-white'}`}>
                            {track.title}
                          </h4>
                          {track.is_archived && (
                            <span className="text-[9px] bg-amber-500/10 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-md font-extrabold uppercase tracking-wider flex-shrink-0">
                              Archived (10-Track Cap)
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-neutral-500 truncate block">
                          {track.album_name ? `Album: ${track.album_name}` : 'Direct Download Enabled'}{' '}
                          {(() => {
                            const cleanTrackHandle = track.artist_handle?.trim();
                            const cleanUserHandle = userHandle?.trim();
                            const cleanMainHandle = artistHandle?.trim();
                            const isLabelHandle =
                              Boolean(cleanUserHandle) &&
                              Boolean(cleanTrackHandle) &&
                              cleanTrackHandle!.toLowerCase() === cleanUserHandle!.toLowerCase();

                            const shownHandle =
                              !cleanTrackHandle || isLabelHandle
                                ? cleanMainHandle || cleanTrackHandle
                                : cleanTrackHandle;

                            return shownHandle ? `• @${shownHandle}` : '';
                          })()}
                        </span>
                      </div>
                    </div>

                    <span className="sm:hidden text-xs font-bold text-emerald-400 flex-shrink-0">${track.price}</span>
                  </div>

                  <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap justify-start sm:justify-end flex-shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-neutral-900">
                    <span className="hidden sm:inline text-sm font-bold text-emerald-400">${track.price}</span>

                    {downloadUrl && (
                      <a
                        href={downloadUrl}
                        download
                        className="bg-neutral-800 hover:bg-neutral-700 text-white font-bold px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-lg text-[11px] sm:text-xs cursor-pointer border border-neutral-700 transition-all whitespace-nowrap flex items-center gap-1"
                        title="Download Audio Master"
                      >
                        <svg className="w-3.5 h-3.5 text-[#ff8c00]" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                          <polyline points="7 10 12 15 17 10"></polyline>
                          <line x1="12" y1="15" x2="12" y2="3"></line>
                        </svg>
                        <span>Download</span>
                      </a>
                    )}

                    {userTier !== 'free' && (
                      <button
                        onClick={() => setSelectedTrackForEdit(track)}
                        className="bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-bold px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-lg text-[11px] sm:text-xs cursor-pointer border border-neutral-700 transition-all whitespace-nowrap flex items-center gap-1"
                        title="Edit Metadata"
                      >
                        <svg className="w-3.5 h-3.5 text-neutral-400" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                        </svg>
                        <span>Edit</span>
                      </button>
                    )}

                    {userTier !== 'free' && !track.is_archived && (
                      <button
                        onClick={() => handleCopy(dropUrl, `drop_${track.id}`)}
                        className="bg-neutral-800 hover:bg-neutral-700 text-[#ff8c00] font-bold px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-lg text-[11px] sm:text-xs cursor-pointer border border-neutral-700 transition-all whitespace-nowrap flex items-center gap-1"
                      >
                        <svg className="w-3.5 h-3.5 text-[#ff8c00]" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                        </svg>
                        <span>{copiedKey === `drop_${track.id}` ? 'Copied!' : 'Drop Link'}</span>
                      </button>
                    )}

                    <button
                      onClick={() => handleDeleteTrack(track.id, track.title, track.audio_file_path, track.artwork_file_path)}
                      className="px-2.5 py-1.5 sm:p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 cursor-pointer text-[11px] sm:text-xs flex items-center gap-1"
                      title="Delete Track"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                      </svg>
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              );

            })}
          </div>
        )}

        {filteredTracks.length > 3 && (
          <div className="pt-3 text-center">
            <button
              onClick={() => setShowAllTracks(!showAllTracks)}
              className="bg-neutral-900 hover:bg-neutral-800 text-[#ff8c00] font-bold px-5 py-2.5 rounded-xl text-xs border border-neutral-800 transition-all cursor-pointer"
            >
              {showAllTracks ? 'Show Less ' : `Show All Tracks (${filteredTracks.length}) ↓`}
            </button>
          </div>
        )}
      </div>

      {/* Albums & Projects Management Section */}
      {(userTier === 'artist' || userTier === 'label') && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 text-left space-y-6">
          <div className="flex justify-between items-center flex-wrap gap-3">
            <div>
              <h3 className="font-semibold text-lg text-[#ff8c00]">Albums & Projects</h3>
              <p className="text-sm text-neutral-400">Manage your published project groupings and track sequences.</p>
            </div>
                        <div className="flex items-center gap-2 flex-wrap">
              {uniqueAlbums.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const nextOpen = !isAlbumSearchOpen;
                    setIsAlbumSearchOpen(nextOpen);
                    if (!nextOpen) setAlbumSearchQuery('');
                  }}
                  className={`font-bold px-3 py-2 rounded-xl text-xs border cursor-pointer transition-all flex items-center gap-1.5 ${
                    isAlbumSearchOpen
                      ? 'bg-[#ff8c00] text-neutral-950 border-[#ff8c00]'
                      : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border-neutral-700'
                  }`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="11" cy="11" r="8"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                  </svg>
                  {isAlbumSearchOpen ? 'Hide Search' : 'Search'}
                </button>
              )}

              <button
                onClick={() => setIsAddToAlbumModalOpen(true)}
                className="bg-neutral-800 hover:bg-neutral-700 text-[#ff8c00] font-bold px-3 py-2 rounded-xl text-xs border border-neutral-700 cursor-pointer"
              >
                {uniqueAlbums.length > 0 ? '+ Add Songs to Album' : '+ Create Album'}
              </button>


              {uniqueAlbums.length > 1 && (
                <button
                  onClick={() => setIsAlbumGlobalReorderOpen(true)}
                  className="bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-bold px-3 py-2 rounded-xl text-xs border border-neutral-700 cursor-pointer"
                >
                  Reorder Albums
                </button>
              )}
            </div>
          </div>

                    {isAlbumSearchOpen && (
            <div className="bg-neutral-950 p-4 rounded-xl border border-neutral-800 space-y-2 animate-fadeIn">
              <div className="flex justify-between items-center">
                <label className="text-xs text-neutral-400 font-bold uppercase tracking-wider">Filter Albums & Projects</label>
                {albumSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setAlbumSearchQuery('')}
                    className="text-xs text-[#ff8c00] hover:underline cursor-pointer"
                  >
                    Clear filter
                  </button>
                )}
              </div>
              <input
                type="text"
                placeholder="Search by album/project title, song, or artist handle..."
                value={albumSearchQuery}
                onChange={(e) => setAlbumSearchQuery(e.target.value)}
                className="w-full bg-neutral-900 border border-neutral-800 focus:border-[#ff8c00] px-4 py-2.5 rounded-xl text-base sm:text-xs text-white outline-none touch-manipulation"
                autoFocus
              />
            </div>
          )}

          {uniqueAlbums.length === 0 ? (
            <div className="text-neutral-500 text-xs py-4 text-center bg-neutral-950 rounded-xl border border-neutral-800">
              No albums created yet. Add an album name when uploading tracks!
            </div>
          ) : displayedAlbums.length === 0 ? (
            <div className="text-neutral-500 text-xs py-6 text-center bg-neutral-950 rounded-xl border border-neutral-800">
              No albums or projects found matching &ldquo;{albumSearchQuery}&rdquo;.
            </div>
                    ) : (
            <div className="space-y-3">

              {displayedAlbums.map((albumName, idx) => {

                const albumTracksList = tracks.filter(t => 
                  t.album_name?.split(',').map((s: string) => s.trim()).includes(albumName)
                );

                                const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
                const masterArtUrl = albumMetaMap[albumName] || albumMetaMap[albumName?.trim().toLowerCase()];
                const firstTrackWithArt = albumTracksList.find(t => t.artwork_url || t.artwork_file_path);
                const trackArtUrl = firstTrackWithArt?.artwork_url || (firstTrackWithArt?.artwork_file_path && supabaseUrl ? `${supabaseUrl}/storage/v1/object/public/v2-cover-art/${firstTrackWithArt.artwork_file_path}` : null);
                const albumCoverUrl = masterArtUrl || trackArtUrl;


                return (
                  <div key={idx} className="bg-neutral-950 border border-neutral-800/80 p-3.5 sm:p-4 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4 transition-all hover:border-neutral-700">
                    <div className="flex items-center gap-3.5 truncate w-full sm:w-auto">
                      <div className="w-11 h-11 rounded-xl bg-neutral-900 border border-neutral-800 overflow-hidden flex-shrink-0 flex items-center justify-center shadow-inner">
                        {albumCoverUrl ? (
                          <img src={albumCoverUrl} alt={albumName} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-[8px] font-black text-neutral-600">PROJECT</span>
                        )}
                      </div>
                      <div className="truncate">
                        <h4 className="text-sm font-bold text-white truncate">{albumName}</h4>
                        <span className="text-[11px] text-neutral-400 truncate block">{albumTracksList.length} Tracks Assigned</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-end w-full sm:w-auto gap-1.5 pt-2 sm:pt-0 border-t sm:border-t-0 border-neutral-900">
                      <button
                        onClick={() => setSelectedAlbumForReorder(albumName)}
                        className="bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white px-3 py-2 rounded-lg text-xs cursor-pointer border border-neutral-800 hover:border-neutral-700 transition-all flex items-center gap-1.5 shadow-sm"
                        title="Manage Tracks Sequence"
                      >
                        <svg className="w-3.5 h-3.5 text-[#ff8c00]" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16m-7 6h7"></path>
                        </svg>
                        <span className="hidden sm:inline">Tracks</span>
                      </button>

                      <button
                        onClick={() => setSelectedAlbumForSettings(albumName)}
                        className="bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer border border-neutral-800 hover:border-neutral-700 flex items-center gap-1.5 shadow-sm"
                        title="Edit Master Cover Art"
                      >
                        <svg className="w-3.5 h-3.5 text-neutral-400" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                          <circle cx="8.5" cy="8.5" r="1.5" />
                          <polyline points="21 15 16 10 5 21" />
                        </svg>
                        <span className="hidden sm:inline">Cover</span>
                      </button>

                      <button
                        onClick={() => handleDeleteAlbum(albumName)}
                        className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 hover:border-red-500/40 cursor-pointer transition-all flex items-center justify-center shadow-sm"
                        title="Delete Album"
                      >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

                    {filteredAlbums.length > 3 && (
            <div className="pt-3 text-center">
              <button
                onClick={() => setShowAllAlbums(!showAllAlbums)}
                className="bg-neutral-900 hover:bg-neutral-800 text-[#ff8c00] font-bold px-5 py-2.5 rounded-xl text-xs border border-neutral-800 transition-all cursor-pointer"
              >
                {showAllAlbums ? 'Show Less' : `Show All Albums (${filteredAlbums.length}) ↓`}
              </button>
            </div>
          )}

        </div>
      )}


      {/* Share / Copy Links Modal */}
      {isShareModalOpen && (
        <div className="fixed inset-0 bg-neutral-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 touch-manipulation">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl w-full max-w-lg p-6 space-y-6 text-left shadow-2xl touch-manipulation">
            <div className="flex justify-between items-center border-b border-neutral-800 pb-4">
              <div>
                <h3 className="font-extrabold text-xl text-white">
                  {userTier === 'label' ? 'Label Storefront & Roster Player Links' : 'Your Storefront Link'}
                </h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  {userTier === 'label' 
                    ? 'Share your master label storefront or individual artist audio player links.' 
                    : 'Share your player link directly with fans.'}
                </p>
              </div>
              <button onClick={() => setIsShareModalOpen(false)} className="text-neutral-500 hover:text-white font-bold text-lg cursor-pointer">✕</button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5 bg-neutral-950 p-4 rounded-2xl border border-neutral-800">
                <label className="text-xs font-semibold text-neutral-300">
                  {userTier === 'label' ? 'Master Label Storefront (All Artists)' : 'Storefront Audio Player Link'}
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={mainStoreUrl}
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-base sm:text-xs text-neutral-300 focus:outline-none"
                  />
                  <button
                    onClick={() => handleCopy(mainStoreUrl, 'main_store')}
                    className="bg-[#ff8c00] hover:bg-[#e07b00] text-neutral-950 font-extrabold px-4 py-2 rounded-xl text-xs whitespace-nowrap cursor-pointer transition-all"
                  >
                    {copiedKey === 'main_store' ? 'Copied Storefront!' : 'Copy Storefront'}
                  </button>
                </div>
              </div>

              {userTier === 'label' && (
                <div className="space-y-3 pt-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400">Individual Roster Audio Player Links</h4>
                  {rosterArtistsList.length === 0 ? (
                    <p className="text-xs text-neutral-500 italic bg-neutral-950 p-3 rounded-xl border border-neutral-800">
                      No roster artists added yet. Add artists to generate their individual player links.
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                      {rosterArtistsList.map((artist) => {
                        const isSelf = artist.id === userProfileId;
                        const targetHandle = isSelf
  ? (artistHandle?.trim() || artist.artist_handle?.trim() || artist.handle?.trim() || '')
  : (artist.artist_handle?.trim() || artist.handle?.trim() || '');

const artistPlayerUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/artist/${targetHandle}`;

                        const formattedModalHandle = artist.artist_handle
                          ?.trim()
                          .replace(/[-_]+/g, ' ')
                          .replace(/\b\w/g, (ch: string) => ch.toUpperCase());

                        const resolvedRosterLabel =
                          artist.stage_name?.trim() ||
                          formattedModalHandle ||
                          artist.name?.trim() ||
                          artist.handle?.trim() ||
                          'Artist';

                        const displayName = isSelf
                          ? (artist.stage_name?.trim() || artist.name || artist.handle || 'Main Artist')
                          : resolvedRosterLabel;


                        return (
                          <div key={artist.id} className="bg-neutral-950 border border-neutral-800 p-4 rounded-xl flex justify-between items-center">
                            <div className="flex items-center gap-3">
                              <div>
                                <h4 className="text-sm font-bold text-white">
                                  {displayName} {isSelf && <span className="text-[10px] bg-[#ff8c00]/20 text-[#ff8c00] px-2 py-0.5 rounded-full ml-2">Main Artist (Slot 1)</span>}
                                </h4>
                                <span className="text-xs text-[#ff8c00]">Handle: @{targetHandle}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <button
                                onClick={() => handleCopy(artistPlayerUrl, artist.id)}
                                className="bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-bold px-3 py-1.5 rounded-lg text-xs cursor-pointer border border-neutral-700"
                              >
                                {copiedKey === artist.id ? 'Copied Player Link!' : 'Copy Player Link'}
                              </button>

                              {!isSelf && (
                                <button
                                  onClick={async () => {
                                    if (!confirm(`Are you sure you want to remove @${artist.handle} from your roster?`)) return;
                                    try {
                                      const { error } = await _supabase
                                        .from('profiles')
                                        .update({ parent_label_id: null, updated_at: new Date().toISOString() })
                                        .eq('id', artist.id);

                                      if (error) {
                                        alert(`Failed to remove artist from roster: ${error.message}`);
                                        return;
                                      }
                                      verifyAndLoadWorkspace();
                                    } catch (err: any) {
                                      alert(`Failed to remove artist: ${err?.message || 'Unknown error'}`);
                                    }
                                  }}
                                  className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 cursor-pointer text-xs"
                                >
                                  Remove
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="pt-2">
              <button
                onClick={() => setIsShareModalOpen(false)}
                className="w-full bg-neutral-800 hover:bg-neutral-700 text-white font-bold py-2.5 rounded-xl text-xs cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Direct Contact Support Modal */}
      {isSupportModalOpen && (
        <div className="fixed inset-0 bg-neutral-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 touch-manipulation">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl w-full max-w-md p-6 space-y-6 text-left shadow-2xl animate-fadeIn touch-manipulation">
            <div className="flex justify-between items-center border-b border-neutral-800 pb-4">
              <div>
                <h3 className="font-extrabold text-xl text-white">Contact Music Market</h3>
                <p className="text-xs text-neutral-400 mt-0.5">Directly routed to musicmarket@2G-ent.com</p>
              </div>
              <button onClick={() => setIsSupportModalOpen(false)} className="text-neutral-500 hover:text-white font-bold text-lg cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleSendSupportEmail} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-neutral-300">Inquiry Reason / Department</label>
                <select
                  value={supportCategory}
                  onChange={(e) => setSupportCategory(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 focus:border-[#ff8c00] rounded-xl px-3 py-2.5 text-base sm:text-xs text-white outline-none cursor-pointer"
                >
                  <option value="Payouts & Billing">Payouts & Billing</option>
                  <option value="FeedBack">Feedback</option>
                  <option value="General Technical Support">General Technical Support</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-neutral-300">Subject</label>
                <input
                  type="text"
                  placeholder="e.g. Question regarding release rollouts"
                  value={supportSubject}
                  onChange={(e) => setSupportSubject(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 focus:border-[#ff8c00] rounded-xl px-3 py-2.5 text-base sm:text-xs text-white outline-none"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-neutral-300">Message</label>
                <textarea
                  rows={4}
                  placeholder="Describe your inquiry in detail..."
                  value={supportMessage}
                  onChange={(e) => setSupportMessage(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 focus:border-[#ff8c00] rounded-xl p-3 text-base sm:text-xs text-white outline-none resize-none"
                  required
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsSupportModalOpen(false)}
                  className="flex-1 bg-neutral-800 hover:bg-neutral-700 text-white font-bold py-2.5 rounded-xl text-xs cursor-pointer transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSendingSupport}
                  className="flex-1 bg-[#ff8c00] hover:bg-[#e07b00] text-neutral-950 font-extrabold py-2.5 rounded-xl text-xs cursor-pointer transition-all shadow-lg shadow-[#ff8c00]/10"
                >
                  {isSendingSupport ? 'Launching...' : 'Send Inquiry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modals */}
      <ReorderModal 
        isOpen={isReorderModalOpen} 
        onClose={() => setIsReorderModalOpen(false)} 
        tracks={tracks} 
        onSave={(updated) => setTracks(updated)} 
      />
      
            <UploadTrackModal 
        isOpen={isUploadModalOpen} 
        onClose={() => setIsUploadModalOpen(false)} 
        onTrackAdded={(newTrack) => {
          if (newTrack) {
            setTracks((prev) => [newTrack, ...prev]);
          }
          verifyAndLoadWorkspace();
        }} 

        userTier={userTier} 
        currentTrackCount={tracks.length} 
        artistHandle={artistHandle || customHandle || userHandle || undefined} 
        parentLabelId={userProfileId || undefined} 
        rosterArtists={rosterArtistsList}
        existingAlbums={uniqueAlbums}
      />

            <AddToAlbumModal
        isOpen={isAddToAlbumModalOpen}
        onClose={() => setIsAddToAlbumModalOpen(false)}
        tracks={tracks}
        existingAlbums={uniqueAlbums}
        onTracksUpdated={(updated) => {
          setTracks(updated);
          verifyAndLoadWorkspace();
        }}
        userTier={userTier}
        rosterArtists={rosterArtistsList}
      />


      {isAddArtistModalOpen && (
        <AddArtistModal 
          isOpen={isAddArtistModalOpen} 
          onClose={() => setIsAddArtistModalOpen(false)} 
          parentLabelId={userProfileId}
          onArtistAdded={() => {
            setIsAddArtistModalOpen(false);
            verifyAndLoadWorkspace();
          }}
        />
      )}

      {selectedAlbumForReorder && (
        <AlbumReorderModal
          isOpen={!!selectedAlbumForReorder}
          onClose={() => setSelectedAlbumForReorder(null)}
          albumName={selectedAlbumForReorder}
          albumTracks={tracks
            .filter(t => t.album_name === selectedAlbumForReorder)
            .sort((a, b) => (a.album_order ?? 0) - (b.album_order ?? 0))}
          onSave={(updatedAlbumTracks) => {
            const updatedTracks = tracks.map(t => {
              const matched = updatedAlbumTracks.find(u => u.id === t.id);
              return matched ? { ...t, album_order: matched.album_order } : t;
            });

            setTracks(updatedTracks);
            verifyAndLoadWorkspace();
          }}
        />
      )}

      {isAlbumGlobalReorderOpen && (
        <GlobalAlbumReorderModal
          isOpen={isAlbumGlobalReorderOpen}
          onClose={() => setIsAlbumGlobalReorderOpen(false)}
          albums={uniqueAlbums}
          onSave={async (updatedNames) => {
            try {
              const updatePromises = updatedNames.map((albumName, newIndex) =>
                _supabase
                  .from('tracks_pro')
                  .update({ album_index: newIndex })
                  .eq('album_name', albumName)
              );

              const results = await Promise.all(updatePromises);
              const firstError = results.find(r => r.error)?.error;
              if (firstError) throw firstError;

              const sortedTracks = [...tracks].sort((a, b) => {
                const indexA = updatedNames.indexOf(a.album_name);
                const indexB = updatedNames.indexOf(b.album_name);
                if (indexA === -1) return 1;
                if (indexB === -1) return -1;
                return indexA - indexB;
              });
              setTracks(sortedTracks);
              verifyAndLoadWorkspace();
            } catch (err) {
              console.error('Error saving global album order:', err);
              alert('Failed to save album sequence.');
            } finally {
              setIsAlbumGlobalReorderOpen(false);
            }
          }}
        />
      )}

      {isLabelSetupModalOpen && (
        <div className="fixed inset-0 bg-neutral-950/90 backdrop-blur-md flex items-center justify-center z-50 p-4 touch-manipulation">
          <div className="bg-neutral-900 border border-[#ff8c00]/50 rounded-3xl w-full max-w-md p-6 space-y-6 text-left shadow-2xl animate-fadeIn touch-manipulation">
            <div className="border-b border-neutral-800 pb-4">
              <span className="text-[10px] bg-[#ff8c00] text-neutral-950 font-black uppercase px-2.5 py-0.5 rounded-md">
                Executive Action Required
              </span>
              <h3 className="font-extrabold text-xl text-white mt-2">Name Your Label Imprint</h3>
              <p className="text-xs text-neutral-400 mt-0.5">
                Welcome to the Label Tier! Enter your official label name below to generate your executive storefront and unlock your dashboard.
              </p>
            </div>

            <form onSubmit={handleSaveLabelSetup} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-300">Official Label Name</label>
                <input
                  type="text"
                  placeholder="e.g. 2G Entertainment"
                  value={labelInputName}
                  onChange={(e) => setLabelInputName(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 focus:border-[#ff8c00] rounded-xl px-3.5 py-3 text-base sm:text-sm text-white outline-none"
                  required
                  autoFocus
                />
                {labelInputName.trim() && (
                  <p className="text-[11px] text-neutral-400 pt-1 truncate">
                    Storefront Link: <span className="text-[#ff8c00] font-semibold">/artist/{generateSlug(labelInputName)}</span>
                  </p>
                )}
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={savingLabelSetup}
                  className="w-full bg-[#ff8c00] hover:bg-[#e07b00] text-neutral-950 font-extrabold py-3 rounded-xl text-xs cursor-pointer transition-all shadow-lg shadow-[#ff8c00]/10 disabled:opacity-50"
                >
                  {savingLabelSetup ? 'Initializing Workspace...' : 'Initialize Label Imprint →'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedAlbumForSettings && (
        <AlbumSettingsModal
          isOpen={!!selectedAlbumForSettings}
          onClose={() => setSelectedAlbumForSettings(null)}
          albumName={selectedAlbumForSettings}
          artistHandle={customHandle || tracks.find(t => t.album_name === selectedAlbumForSettings)?.artist_handle || ''}
          onSaved={() => {
            verifyAndLoadWorkspace();
          }}
        />
      )}

            {selectedTrackForEdit && (
        <EditTrackModal
          isOpen={!!selectedTrackForEdit}
          onClose={() => setSelectedTrackForEdit(null)}
          track={selectedTrackForEdit}
          userTier={userTier}
          existingAlbums={uniqueAlbums}
          onTrackUpdated={(updated) => {
            setTracks(prev => prev.map(t => t.id === updated.id ? updated : t));
          }}
        />
      )}

      {selectedArtistForEdit && (
        <EditArtistModal
          isOpen={!!selectedArtistForEdit}
          onClose={() => setSelectedArtistForEdit(null)}
          artist={selectedArtistForEdit}
          isLabelOwnerRow={selectedArtistForEdit.id === userProfileId}
          onArtistUpdated={() => {
            verifyAndLoadWorkspace();
          }}
        />
      )}


            {/* Unified Analytics Command Modal */}
     <AnalyticsModal
  isOpen={isAnalyticsModalOpen}
  onClose={() => setIsAnalyticsModalOpen(false)}
  artistHandle={(artistHandle || userHandle || '').trim().toLowerCase() || undefined}
  isAdminView={userTier === 'label'}
  isSuperAdmin={Boolean(userProfileId && isSuperAdmin)}
  userTier={userTier === 'artist' || userTier === 'label' ? userTier : 'free'}
  rosterArtists={userTier === 'label' || isSuperAdmin ? rosterArtistsList : []}
/>



    </div>
  );
}

function GlobalAlbumReorderModal({
  isOpen,
  onClose,
  albums,
  onSave,
}: {
  isOpen: boolean;
  onClose: () => void;
  albums: string[];
  onSave: (reorderedNames: string[]) => Promise<void>;
}) {
  const [list, setList] = useState<string[]>(albums);
  const [saving, setSaving] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  useEffect(() => {
    setList(albums);
  }, [albums, isOpen]);

  if (!isOpen) return null;

  const move = (index: number, dir: 'up' | 'down') => {
    const next = dir === 'up' ? index - 1 : index + 1;
    if (next < 0 || next >= list.length) return;
    const copy = [...list];
    [copy[index], copy[next]] = [copy[next], copy[index]];
    setList(copy);
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedIndex === null || draggedIndex === index) return;

    const updated = [...list];
    const draggedItem = updated[draggedIndex];
    updated.splice(draggedIndex, 1);
    updated.splice(index, 0, draggedItem);

    setDraggedIndex(index);
    setList(updated);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };




  return (
    <div className="fixed inset-0 bg-neutral-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 touch-manipulation">
      <div className="bg-neutral-900 border border-neutral-800 rounded-3xl w-full max-w-lg p-6 space-y-6 text-left shadow-2xl touch-manipulation">
        <div className="flex justify-between items-center border-b border-neutral-800 pb-4">
          <div>
            <h3 className="font-extrabold text-xl text-white">Reorder Albums</h3>
            <p className="text-xs text-neutral-400 mt-0.5">Drag and drop or use arrows to adjust your album sequence.</p>
          </div>
          <button onClick={onClose} className="text-neutral-500 hover:text-white font-bold text-lg cursor-pointer">✕</button>
        </div>

        <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
          {list.map((alb, idx) => (
            <div
              key={alb}
              draggable
              onDragStart={(e) => handleDragStart(e, idx)}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDragEnd={handleDragEnd}
              className={`bg-neutral-950 border p-3 rounded-xl flex items-center justify-between cursor-grab active:cursor-grabbing transition-all ${
                draggedIndex === idx 
                  ? 'border-[#ff8c00] bg-[#ff8c00]/10 opacity-60 shadow-lg' 
                  : 'border-neutral-800 hover:border-neutral-700'
              }`}
            >
              <div className="flex items-center gap-3 truncate">
                <span className="text-neutral-600 hover:text-neutral-400 font-bold text-xs select-none" title="Drag to reorder">
                  ⠿
                </span>
                <span className="text-neutral-500 font-bold text-xs w-5">{idx + 1}.</span>
                <span className="text-xs font-bold text-white truncate">{alb}</span>
              </div>

              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  disabled={idx === 0}
                  onClick={() => move(idx, 'up')}
                  className="p-1.5 rounded-lg bg-neutral-900 text-neutral-300 hover:bg-neutral-800 disabled:opacity-30 cursor-pointer text-xs border border-neutral-800"
                  title="Move Up"
                >
                  ▲
                </button>
                <button
                  type="button"
                  disabled={idx === list.length - 1}
                  onClick={() => move(idx, 'down')}
                  className="p-1.5 rounded-lg bg-neutral-900 text-neutral-300 hover:bg-neutral-800 disabled:opacity-30 cursor-pointer text-xs border border-neutral-800"
                  title="Move Down"
                >
                  ▼
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 bg-neutral-800 hover:bg-neutral-700 text-white font-bold py-2.5 rounded-xl text-xs cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              await onSave(list);
              setSaving(false);
            }}
            className="flex-1 bg-[#ff8c00] hover:bg-[#e07b00] text-neutral-950 font-extrabold py-2.5 rounded-xl text-xs cursor-pointer disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Album Order'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-neutral-950 text-white flex flex-col items-center p-6 touch-manipulation selection:bg-[#ff8c00] selection:text-black">

      <Suspense fallback={<div className="text-neutral-400 my-auto">Loading dashboard...</div>}>
        <DashboardContent />
      </Suspense>
    </div>
  );
}
