'use client';

import { useState, useEffect } from 'react';
import { supabase as _supabase } from '@/utils/supabase';

const PRESET_GENRES = [
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
  'Other'
];

interface UploadTrackModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTrackAdded: (newTrack: any) => void;
  userTier: string;
  currentTrackCount: number;
  artistHandle?: string;
  parentLabelId?: string;
  rosterArtists?: Array<any>;
  existingAlbums?: Array<string>;
}

export default function UploadTrackModal({
  isOpen,
  onClose,
  onTrackAdded,
  userTier,
  currentTrackCount,
  artistHandle,
  parentLabelId,
  rosterArtists = [],
  existingAlbums = [],
}: UploadTrackModalProps) {
  const [title, setTitle] = useState('');
  const [genre, setGenre] = useState('Hip-Hop');
  const [price, setPrice] = useState('0.99');
  
  // Album selection mode state
  const [albumMode, setAlbumMode] = useState<'none' | 'existing' | 'new'>('none');
  const [selectedExistingAlbum, setSelectedExistingAlbum] = useState('');
  const [customAlbumName, setCustomAlbumName] = useState('');
  const [albumPrice, setAlbumPrice] = useState('7.99');

  const [uploadMode, setUploadMode] = useState<'single' | 'batch'>('single');
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [batchItems, setBatchItems] = useState<Array<{ id: string; file: File; title: string }>>([]);
  const [uploadProgressText, setUploadProgressText] = useState<string | null>(null);
  const [artworkFile, setArtworkFile] = useState<File | null>(null);


  // Streaming platform URLs
  const [spotifyUrl, setSpotifyUrl] = useState('');
  const [appleMusicUrl, setAppleMusicUrl] = useState('');
  const [tidalUrl, setTidalUrl] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [pandoraUrl, setPandoraUrl] = useState('');

    const [selectedArtistHandle, setSelectedArtistHandle] = useState<string>(artistHandle || '');
  const [agreedToCopyrightWarranty, setAgreedToCopyrightWarranty] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const normalizedRosterOptions = Array.from(
    new Map(
      (rosterArtists || [])
        .map((artist) => {
          const handleValue = (artist?.artist_handle || artist?.handle || '').trim();
          if (!handleValue) return null;
          const isMain =
            Boolean(artistHandle) &&
            handleValue.toLowerCase() === artistHandle!.trim().toLowerCase();
          return [
            handleValue.toLowerCase(),
            {
              key: artist.id || handleValue,
              value: handleValue,
              label: `${artist.name || handleValue} (@${handleValue})${isMain ? ' • Main' : ''}`,
            },
          ] as const;
        })
        .filter(Boolean) as Array<readonly [string, { key: string; value: string; label: string }]>
    ).values()
  );

   const formatTitleFromFilename = (fileName: string) => {
    const withoutExt = fileName.replace(/\.[^/.]+$/, '');
    const cleaned = withoutExt
      .replace(/^[\d\s._-]+/, '')
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return cleaned || withoutExt;
  };

  const handleBatchFilesSelected = (filesList: FileList | null) => {
    if (!filesList || filesList.length === 0) {
      setBatchItems([]);
      return;
    }

    const nextItems = Array.from(filesList).map((file, idx) => ({
      id: `${Date.now()}-${idx}-${file.name}`,
      file,
      title: formatTitleFromFilename(file.name),
    }));
    setBatchItems(nextItems);
  };

  const handleBatchTitleChange = (id: string, nextTitle: string) => {
    setBatchItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, title: nextTitle } : item))
    );
  };

  const removeBatchItem = (id: string) => {
    setBatchItems((prev) => prev.filter((item) => item.id !== id));
  };

    const artistStorageKey = parentLabelId
    ? `mm_upload_artist_${parentLabelId}`
    : 'mm_upload_artist_default';

  useEffect(() => {
    if (isOpen) {
      let savedHandle = '';
      try {
        savedHandle = localStorage.getItem(artistStorageKey)?.trim() || '';
      } catch {
        savedHandle = '';
      }

      const matchedSavedOption = normalizedRosterOptions.find(
        (opt) => opt.value.toLowerCase() === savedHandle.toLowerCase()
      );

      const preferred =
        matchedSavedOption?.value ||
        artistHandle?.trim() ||
        normalizedRosterOptions[0]?.value ||
        '';

      setSelectedArtistHandle(preferred);
      if (preferred) {
        try {
          localStorage.setItem(artistStorageKey, preferred);
        } catch {
          // Ignore storage quota/private-mode errors
        }
      }

      setErrorMsg(null);
      setUploadProgressText(null);
      if (userTier === 'free') {
        setUploadMode('single');
        setBatchItems([]);
      }
    }
  }, [isOpen, artistHandle, parentLabelId, rosterArtists, userTier]);




  if (!isOpen) return null;


  const finalAlbumName = albumMode === 'existing' 
    ? selectedExistingAlbum 
    : albumMode === 'new' 
    ? customAlbumName.trim() 
    : '';

    const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (userTier === 'free' && currentTrackCount >= 10) {
      alert('Free tier track limit reached (10 tracks max). Please upgrade to upload more.');
      return;
    }

    if (userTier === 'label' && !selectedArtistHandle) {
      setErrorMsg('Please assign the track to a roster artist before publishing.');
      return;
    }

        const isPaidBatch =
      (userTier === 'artist' || userTier === 'label') && uploadMode === 'batch';

    if (isPaidBatch) {
      if (batchItems.length === 0) {
        setErrorMsg('Please select one or more audio files for batch upload.');
        return;
      }
      if (batchItems.some((item) => !item.title.trim())) {
        setErrorMsg('Please make sure every track in your batch has a title.');
        return;
      }
    } else {
      if (!title.trim()) {
        setErrorMsg('Please enter a track title.');
        return;
      }
      if (!audioFile) {
        setErrorMsg('Please select an audio file to upload.');
        return;
      }
    }

    if (!agreedToCopyrightWarranty) {
      setErrorMsg('You must warrant that you own or hold valid licenses for this audio and instrumental before publishing.');
      return;
    }

    setUploading(true);
    setErrorMsg(null);
    setUploadProgressText(null);

    try {
      const { data: { session } } = await _supabase.auth.getSession();
      const userId = session?.user?.id;

      // Upload shared artwork file once to v2-cover-art bucket if provided
      let artworkPath = null;
      if (artworkFile) {
        const artworkFileName = `art-${Date.now()}-${artworkFile.name}`;
        const { data: artUpload, error: artError } = await _supabase.storage
          .from('v2-cover-art')
          .upload(artworkFileName, artworkFile);
        if (!artError && artUpload) {
          artworkPath = artUpload.path;
        }
      }

      const resolvedHandle =
        userTier === 'label'
          ? selectedArtistHandle.trim() || null
          : artistHandle?.trim() || normalizedRosterOptions[0]?.value || null;

      const itemsToPublish = isPaidBatch
        ? batchItems.map((item, idx) => ({
            file: item.file,
            trackTitle: item.title.trim(),
            batchIndex: idx,
          }))
        : [
            {
              file: audioFile!,
              trackTitle: title.trim(),
              batchIndex: 0,
            },
          ];

      const publishedTitles: string[] = [];

      for (let i = 0; i < itemsToPublish.length; i++) {
        const entry = itemsToPublish[i];
        if (itemsToPublish.length > 1) {
          setUploadProgressText(`Uploading ${i + 1} of ${itemsToPublish.length}: "${entry.trackTitle}"...`);
        }

        const audioFileName = `${Date.now()}-${i}-${entry.file.name}`;
        const { data: audioUpload, error: audioError } = await _supabase.storage
          .from('v2-audio-vault')
          .upload(audioFileName, entry.file);

        if (audioError) throw audioError;
        const audioPath = audioUpload?.path || audioFileName;

        const trackPayload: any = {
          title: entry.trackTitle,
          genre,
          price: parseFloat(price) || 0,
          audio_file_path: audioPath,
          artwork_file_path: artworkPath,
          artist_handle: resolvedHandle,
          user_id: userId,
          copyright_warranted: true,
          created_at: new Date().toISOString(),
        };

        if (userTier === 'artist' || userTier === 'label') {
          trackPayload.album_name = finalAlbumName || null;
          trackPayload.album_price = finalAlbumName ? (parseFloat(albumPrice) || 7.99) : null;

          if (albumMode === 'new' && finalAlbumName) {
            trackPayload.album_index = existingAlbums.length;
          }

          trackPayload.spotify_url = spotifyUrl || null;
          trackPayload.apple_music_url = appleMusicUrl || null;
          trackPayload.tidal_url = tidalUrl || null;
          trackPayload.youtube_url = youtubeUrl || null;
          trackPayload.pandora_url = pandoraUrl || null;
        }

        const { data: insertedTrack, error: insertError } = await _supabase
          .from('tracks_pro')
          .insert([trackPayload])
          .select('*')
          .single();

        if (insertError) throw insertError;
        if (!insertedTrack) throw new Error('No track data returned from database insert.');

        onTrackAdded(insertedTrack);
        publishedTitles.push(entry.trackTitle);
      }

      if (publishedTitles.length > 1) {
        alert(`Success! Published ${publishedTitles.length} tracks to your catalogue.`);
      } else {
        alert(`Success! "${publishedTitles[0]}" was published to your catalogue.`);
      }

      // Reset form
      setUploadMode('single');
      setTitle('');
      setBatchItems([]);
      setUploadProgressText(null);
      setGenre('Hip-Hop');
      setPrice('0.99');
      setAlbumMode('none');
      setSelectedExistingAlbum('');
      setCustomAlbumName('');
      setAlbumPrice('7.99');
      setAudioFile(null);
      setArtworkFile(null);
      setSpotifyUrl('');
      setAppleMusicUrl('');
      setTidalUrl('');
      setYoutubeUrl('');
      setPandoraUrl('');
      setAgreedToCopyrightWarranty(false);
      onClose();
    } catch (err: any) {
      console.error('Upload error:', err);
      setErrorMsg(err.message || 'Failed to upload track.');
    } finally {
      setUploading(false);
      setUploadProgressText(null);
    }

  };



  return (
    <div className="fixed inset-0 bg-neutral-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-neutral-900 border border-neutral-800 rounded-3xl w-full max-w-lg p-6 space-y-6 text-left shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center border-b border-neutral-800 pb-4">
          <div>
            <h3 className="font-extrabold text-xl text-white">Upload New Track</h3>
            <p className="text-xs text-neutral-400 mt-0.5">
              {userTier === 'free' && 'Free Tier: Core track upload and pricing.'}
              {userTier === 'artist' && 'Artist Tier: Core upload + streaming links & project metadata.'}
              {userTier === 'label' && 'Label Executive: Full suite + roster artist assignment.'}
            </p>
          </div>
          <button onClick={onClose} className="text-neutral-500 hover:text-white font-bold text-lg cursor-pointer">✕</button>
        </div>

                {(userTier === 'artist' || userTier === 'label') && (
          <div className="flex items-center gap-2 bg-neutral-950 p-1 rounded-xl border border-neutral-800">
                        <button
              type="button"
              onClick={() => {
                setUploadMode('single');
                if (albumMode === 'new') {
                  setAlbumMode('none');
                }
                setErrorMsg(null);
              }}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                uploadMode === 'single'
                  ? 'bg-[#ff8c00] text-neutral-950'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Single Track
            </button>

                        <button
              type="button"
              onClick={() => {
                setUploadMode('batch');
                if (albumMode === 'none') {
                  setAlbumMode('new');
                }
                setErrorMsg(null);
              }}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                uploadMode === 'batch'
                  ? 'bg-[#ff8c00] text-neutral-950'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <span>Multi-Track Batch</span>
              <span className="text-[10px] uppercase px-1.5 py-0.2 rounded bg-black/20">Album</span>
            </button>

          </div>
        )}

        {uploadProgressText && (
          <div className="p-3 bg-[#ff8c00]/10 border border-[#ff8c00]/40 rounded-xl text-[#ff8c00] text-xs font-bold">
            {uploadProgressText}
          </div>
        )}

        {errorMsg && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleUpload} className="space-y-4">

          {userTier === 'label' && (
            <div className="space-y-1.5 p-3 bg-neutral-950 border border-[#ff8c00]/30 rounded-xl">
              <label className="text-xs font-bold text-[#ff8c00] uppercase tracking-wider block">Assign Track To Roster Artist *</label>
              <select
required
value={selectedArtistHandle}
onChange={(e) => {
const nextHandle = e.target.value;
setSelectedArtistHandle(nextHandle);
try {
if (nextHandle) {
localStorage.setItem(artistStorageKey, nextHandle);
} else {
localStorage.removeItem(artistStorageKey);
}
} catch {
// Ignore storage quota/private-mode errors
}
}}
className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#ff8c00]"
>
                   <option value="">-- Select Roster Artist --</option>
                {normalizedRosterOptions.map((opt) => (
                  <option key={opt.key} value={opt.value}>
                    {opt.label}
                  </option>
                ))}



              </select>
            </div>
          )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(userTier === 'artist' || userTier === 'label') && uploadMode === 'batch' ? (
              <div className="space-y-1.5 flex flex-col justify-center bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2">
                <span className="text-xs font-bold text-[#ff8c00]">Batch Queue ({batchItems.length} tracks)</span>
                <span className="text-[11px] text-neutral-400">
                  Titles auto-fill from filenames below and stay editable.
                </span>
              </div>
            ) : (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-300">Track Title *</label>
                <input
                  type="text"
                  required={uploadMode === 'single' || userTier === 'free'}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Midnight Vibes"
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#ff8c00]"
                />
              </div>
            )}
            
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-300">Genre *</label>

              <select
                required
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#ff8c00] cursor-pointer"
              >
                {PRESET_GENRES.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-300">Track Price ($ USD)</label>
              <input
                type="number"
                step="0.01"
                required
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#ff8c00]"
              />
            </div>
            
            {(userTier === 'artist' || userTier === 'label') ? (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-300">Project / Album Assignment</label>
                <select
                  value={albumMode}
                  onChange={(e) => setAlbumMode(e.target.value as any)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#ff8c00] cursor-pointer"
                >
                  <option value="none">-- Standalone Single (No Album) --</option>
                  {existingAlbums.length > 0 && <option value="existing">Add to Existing Album</option>}
                  <option value="new">+ Create New Album</option>
                </select>
              </div>
            ) : (
              <div className="space-y-1.5 opacity-40">
                <label className="text-xs font-semibold text-neutral-500">Album Assignment (Artist+)</label>
                <input
                  type="text"
                  disabled
                  placeholder="Upgrade to unlock"
                  className="w-full bg-neutral-950 border border-neutral-900 rounded-xl px-4 py-2.5 text-sm text-neutral-600 cursor-not-allowed"
                />
              </div>
            )}
          </div>

          {/* Conditional Album Sub-inputs */}
          {albumMode === 'existing' && (
            <div className="space-y-1.5 p-3 bg-neutral-950 border border-neutral-800 rounded-xl animate-fadeIn">
              <label className="text-xs font-bold text-[#ff8c00]">Select Existing Album</label>
              <select
                required
                value={selectedExistingAlbum}
                onChange={(e) => setSelectedExistingAlbum(e.target.value)}
                className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-[#ff8c00]"
              >
                <option value="">-- Choose Album --</option>
                {existingAlbums.map((alb) => (
                  <option key={alb} value={alb}>{alb}</option>
                ))}
              </select>
            </div>
          )}

          {albumMode === 'new' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-neutral-950 border border-[#ff8c00]/40 rounded-xl animate-fadeIn">
              <div className="space-y-1">
                <label className="text-xs font-bold text-[#ff8c00]">New Album Name</label>
                <input
                  type="text"
                  required
                  value={customAlbumName}
                  onChange={(e) => setCustomAlbumName(e.target.value)}
                  placeholder="e.g. Deluxe EP"
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-[#ff8c00]"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-[#ff8c00]">Bundle Price ($)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={albumPrice}
                  onChange={(e) => setAlbumPrice(e.target.value)}
                  placeholder="7.99"
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-[#ff8c00]"
                />
              </div>
              <div className="sm:col-span-2 pt-1">
                <p className="text-[10px] text-emerald-400 font-medium">
                  💡 Tip: The artwork uploaded below will serve as the lead cover art for this new album project.
                </p>
              </div>
            </div>
          )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(userTier === 'artist' || userTier === 'label') && uploadMode === 'batch' ? (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-300">Audio Master Files (.mp3/.wav) *</label>
                <input
                  type="file"
                  accept="audio/*"
                  multiple
                  required={batchItems.length === 0}
                  onChange={(e) => handleBatchFilesSelected(e.target.files)}
                  className="w-full text-xs text-neutral-400 file:mr-2 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-[#ff8c00] file:text-neutral-950 hover:file:bg-[#e07b00] cursor-pointer"
                />
              </div>
            ) : (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-300">Audio Master File (.mp3/.wav) *</label>
                <input
                  type="file"
                  accept="audio/*"
                  required={uploadMode === 'single' || userTier === 'free'}
                  onChange={(e) => setAudioFile(e.target.value ? e.target.files?.[0] || null : e.target.files?.[0] || null)}
                  className="w-full text-xs text-neutral-400 file:mr-2 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-[#ff8c00] file:text-neutral-950 hover:file:bg-[#e07b00] cursor-pointer"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-300">
                {(userTier === 'artist' || userTier === 'label') && uploadMode === 'batch'
                  ? 'Shared Artwork (.jpg/.png)'
                  : albumMode === 'new'
                  ? 'Album / Track Artwork (.jpg/.png) *'
                  : 'Artwork Image (.jpg/.png)'}
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setArtworkFile(e.target.files?.[0] || null)}
                className="w-full text-xs text-neutral-400 file:mr-2 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-neutral-800 file:text-neutral-200 hover:file:bg-neutral-700 cursor-pointer"
              />
            </div>
          </div>

          {(userTier === 'artist' || userTier === 'label') && uploadMode === 'batch' && batchItems.length > 0 && (
            <div className="space-y-2 p-3 bg-neutral-950 border border-neutral-800 rounded-xl max-h-48 overflow-y-auto">
              <div className="flex justify-between items-center">
                <span className="text-[11px] font-bold text-[#ff8c00] uppercase tracking-wider">
                  Tracks to Publish ({batchItems.length})
                </span>
                <span className="text-[10px] text-neutral-500">Edit titles as needed</span>
              </div>
              {batchItems.map((item, idx) => (
                <div key={item.id} className="flex items-center gap-2 bg-neutral-900 border border-neutral-800 rounded-lg px-2.5 py-2">
                  <span className="text-[11px] font-bold text-neutral-500 w-5">{idx + 1}.</span>
                  <input
                    type="text"
                    value={item.title}
                    onChange={(e) => handleBatchTitleChange(item.id, e.target.value)}
                    placeholder="Track title"
                    className="flex-1 bg-neutral-950 border border-neutral-800 focus:border-[#ff8c00] rounded-lg px-2.5 py-1.5 text-xs text-white outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => removeBatchItem(item.id)}
                    className="text-red-400 hover:text-red-300 text-xs font-bold px-2 py-1 cursor-pointer"
                    title="Remove from batch"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}


                    {(userTier === 'artist' || userTier === 'label') && (
            <div className="border-t border-neutral-800 pt-4 space-y-3">
              <div className="space-y-1">
                <span className="text-xs font-bold text-[#ff8c00] uppercase tracking-wider block">Streaming Platform Links</span>
                {uploadMode === 'batch' && (
                  <p className="text-[11px] text-neutral-400">
                    Any links entered here apply to all tracks in this batch—leave blank to add individual song links via <span className="text-white font-semibold">Edit</span> afterward.
                  </p>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

                <input
                  type="url"
                  value={spotifyUrl}
                  onChange={(e) => setSpotifyUrl(e.target.value)}
                  placeholder="Spotify URL"
                  className="bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#ff8c00]"
                />
                <input
                  type="url"
                  value={appleMusicUrl}
                  onChange={(e) => setAppleMusicUrl(e.target.value)}
                  placeholder="Apple Music URL"
                  className="bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#ff8c00]"
                />
                <input
                  type="url"
                  value={tidalUrl}
                  onChange={(e) => setTidalUrl(e.target.value)}
                  placeholder="Tidal URL"
                  className="bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#ff8c00]"
                />
                <input
                  type="url"
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  placeholder="YouTube URL"
                  className="bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#ff8c00]"
                />
                <input
                  type="url"
                  value={pandoraUrl}
                  onChange={(e) => setPandoraUrl(e.target.value)}
                  placeholder="Pandora URL"
                  className="bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#ff8c00]"
                />
              </div>
            </div>
          )}

          <div className="border-t border-neutral-800 pt-4 flex items-start gap-3 text-left">
            <input
              type="checkbox"
              id="uploadWarranty"
              required
              checked={agreedToCopyrightWarranty}
              onChange={(e) => setAgreedToCopyrightWarranty(e.target.checked)}
              className="mt-1 w-4 h-4 rounded border-neutral-800 bg-neutral-950 text-[#ff8c00] focus:ring-[#ff8c00] cursor-pointer accent-[#ff8c00] flex-shrink-0"
            />
            <label htmlFor="uploadWarranty" className="text-[11px] text-neutral-400 leading-relaxed cursor-pointer">
              I warrant that I own 100% of the rights or hold explicit, valid licenses for this master audio and instrumental. I agree to indemnify and hold harmless <span className="text-white font-medium">2G Entertainment</span> and <span className="text-white font-medium">Music Market</span> from any copyright infringement claims, damages, or liabilities arising from this upload.
            </label>
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
              type="submit"
              disabled={uploading}
              className="flex-1 bg-[#ff8c00] hover:bg-[#e07b00] text-neutral-950 font-extrabold py-2.5 rounded-xl text-xs cursor-pointer disabled:opacity-50"
            >
                            {uploading
                ? 'Uploading...'
                : (userTier === 'artist' || userTier === 'label') && uploadMode === 'batch'
                ? `Publish ${batchItems.length > 0 ? `${batchItems.length} Tracks` : 'Batch'}`
                : 'Publish Track'}

            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
