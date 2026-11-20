'use client';

import { useState, useEffect } from 'react';
import { supabase as _supabase } from '@/utils/supabase';

interface AddToAlbumModalProps {
  isOpen: boolean;
  onClose: () => void;
  tracks: Array<any>;
  existingAlbums: Array<string>;
  onTracksUpdated: (updatedTracks: Array<any>) => void;
  userTier?: string;                // 👈 Added userTier support
  rosterArtists?: Array<any>;       // 👈 Added rosterArtists support
}

export default function AddToAlbumModal({
  isOpen,
  onClose,
  tracks,
  existingAlbums,
  onTracksUpdated,
  userTier,
  rosterArtists,
}: AddToAlbumModalProps) {
  const [isCreatingNew, setIsCreatingNew] = useState<boolean>(existingAlbums.length === 0);
  const [newAlbumName, setNewAlbumName] = useState<string>('');
  const [selectedAlbum, setSelectedAlbum] = useState<string>(existingAlbums[0] || '');
  const [selectedTrackIds, setSelectedTrackIds] = useState<Set<string>>(new Set());
  const [selectedAlbumArtist, setSelectedAlbumArtist] = useState<string>(''); // 👈 Added artist assignment state
  const [saving, setSaving] = useState(false);

  // Sync mode when modal opens
  useEffect(() => {
    if (isOpen) {
      if (existingAlbums.length === 0) {
        setIsCreatingNew(true);
        setSelectedAlbum('');
        setSelectedTrackIds(new Set());
      } else {
        setIsCreatingNew(false);
        setSelectedAlbum((prev) => (prev && existingAlbums.includes(prev) ? prev : existingAlbums[0]));
      }
      setNewAlbumName('');
           setSelectedAlbumArtist(rosterArtists?.[0]?.artist_handle || rosterArtists?.[0]?.handle || '');

    }
  }, [isOpen, existingAlbums, rosterArtists]);

  // Pre-check tracks that already belong to the selected album
  useEffect(() => {
    if (!isCreatingNew && selectedAlbum) {
      const currentInAlbum = tracks
        .filter((t) => {
          const list = t.album_name ? t.album_name.split(',').map((s: string) => s.trim()) : [];
          return list.includes(selectedAlbum);
        })
        .map((t) => String(t.id));
      setSelectedTrackIds(new Set(currentInAlbum));
    } else if (isCreatingNew) {
      setSelectedTrackIds(new Set());
    }
  }, [selectedAlbum, isCreatingNew, tracks, isOpen]);

  if (!isOpen) return null;

  const toggleTrackSelection = (trackId: string | number) => {
    const idStr = String(trackId);
    const next = new Set(selectedTrackIds);
    if (next.has(idStr)) {
      next.delete(idStr);
    } else {
      next.add(idStr);
    }
    setSelectedTrackIds(next);
  };

  const handleSave = async () => {
    const targetAlbum = isCreatingNew ? newAlbumName.trim() : selectedAlbum.trim();

    if (!targetAlbum) {
      alert('Please enter or select a valid album name.');
      return;
    }

    setSaving(true);
    try {
      const updatedTracks = tracks.map(track => {
        const idStr = String(track.id);
        const isSelected = selectedTrackIds.has(idStr);
        
        // Parse existing comma-separated albums into a clean list
        const existingAlbumsList = track.album_name 
          ? track.album_name.split(',').map((s: string) => s.trim()).filter(Boolean)
          : [];

        let newArtistHandle = track.artist_handle;

        if (isSelected) {
          // Add targetAlbum if not already present
          if (!existingAlbumsList.includes(targetAlbum)) {
            existingAlbumsList.push(targetAlbum);
          }
          // 👇 If label tier and creating a new album, explicitly assign the chosen roster artist handle
          if (userTier === 'label' && isCreatingNew && selectedAlbumArtist) {
            newArtistHandle = selectedAlbumArtist;
          }
        } else if (!isCreatingNew) {
          // Remove targetAlbum if unselected in edit mode
          const index = existingAlbumsList.indexOf(targetAlbum);
          if (index !== -1) {
            existingAlbumsList.splice(index, 1);
          }
        }

        const newAlbumString = existingAlbumsList.length > 0 ? existingAlbumsList.join(', ') : null;
        return { ...track, album_name: newAlbumString, artist_handle: newArtistHandle };
      });

      // Save changes to Supabase for modified tracks
      for (const track of updatedTracks) {
        const originalTrack = tracks.find(t => t.id === track.id);
        if (originalTrack?.album_name !== track.album_name || originalTrack?.artist_handle !== track.artist_handle) {
          const { error } = await _supabase
            .from('tracks_pro')
            .update({ album_name: track.album_name, artist_handle: track.artist_handle })
            .eq('id', track.id);
          if (error) throw error;
        }
      }

      onTracksUpdated(updatedTracks);
      onClose();
    } catch (err: any) {
      console.error('Error updating album tracks:', err);
      alert(`Failed to update album assignment: ${err?.message || 'Database error'}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-neutral-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-neutral-900 border border-neutral-800 rounded-3xl w-full max-w-lg p-6 space-y-6 text-left shadow-2xl">
        <div className="flex justify-between items-center border-b border-neutral-800 pb-4">
          <div>
            <h3 className="font-extrabold text-xl text-white">Manage Project Album Songs</h3>
            <p className="text-xs text-neutral-400 mt-0.5">Add tracks across multiple albums without removing them from others.</p>
          </div>
          <button onClick={onClose} className="text-neutral-500 hover:text-white font-bold text-lg cursor-pointer">✕</button>
        </div>

        {/* Album Selector or New Album Input */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">
              {isCreatingNew ? 'New Album / Project Title' : 'Target Album / Project'}
            </label>
            {existingAlbums.length > 0 && (
              <button
                type="button"
                onClick={() => setIsCreatingNew(!isCreatingNew)}
                className="text-[11px] font-bold text-[#ff8c00] hover:underline cursor-pointer"
              >
                {isCreatingNew ? 'Select Existing Album' : '+ Create New Album'}
              </button>
            )}
          </div>

          {isCreatingNew ? (
            <input
              type="text"
              placeholder="Enter new album or EP title..."
              value={newAlbumName}
              onChange={(e) => setNewAlbumName(e.target.value)}
              className="w-full bg-neutral-950 border border-neutral-800 focus:border-[#ff8c00] rounded-xl px-3 py-2.5 text-xs text-white outline-none"
              autoFocus
            />
          ) : (
            <select
              value={selectedAlbum}
              onChange={(e) => setSelectedAlbum(e.target.value)}
              className="w-full bg-neutral-950 border border-neutral-800 focus:border-[#ff8c00] rounded-xl px-3 py-2.5 text-xs text-white outline-none cursor-pointer"
            >
              {existingAlbums.map((alb) => (
                <option key={alb} value={alb}>{alb}</option>
              ))}
            </select>
          )}
        </div>

        {/* 👇 Label Tier: Assign Artist to New Album Project */}
        {userTier === 'label' && isCreatingNew && rosterArtists && rosterArtists.length > 0 && (
          <div className="space-y-2 pt-1">
            <label className="text-xs font-semibold text-neutral-300 uppercase tracking-wider block">
              Assign Album to Roster Artist
            </label>
            <select
              value={selectedAlbumArtist}
              onChange={(e) => setSelectedAlbumArtist(e.target.value)}
              className="w-full bg-neutral-950 border border-neutral-800 focus:border-[#ff8c00] rounded-xl px-3 py-2.5 text-xs text-white outline-none cursor-pointer"
            >
                            {rosterArtists.map((artist) => {
                const handleToUse = artist.artist_handle || artist.handle;
                const displayName = artist.name || handleToUse;
                return (
                  <option key={artist.id || handleToUse} value={handleToUse}>
                    {displayName} (@{handleToUse})
                  </option>
                );
              })}

            </select>
          </div>
        )}

        {/* Tracks List with Multi-Album Indicators */}
        <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
          {tracks.length === 0 ? (
            <div className="text-center py-6 text-neutral-500 text-xs">No tracks available in your catalogue.</div>
          ) : (
            tracks.map((track) => {
              const isChecked = selectedTrackIds.has(String(track.id));
              const artUrl = track.artwork_url || (track.artwork_file_path ? `https://chhwujiajdhaihupvuix.supabase.co/storage/v1/object/public/v2-cover-art/${track.artwork_file_path}` : null);
              
              const trackAlbums = track.album_name ? track.album_name.split(',').map((s: string) => s.trim()) : [];
              const isInThisAlbum = !isCreatingNew && trackAlbums.includes(selectedAlbum);
              const isInOtherAlbums = trackAlbums.length > 0 && (!isInThisAlbum || trackAlbums.length > 1);

              return (
                <div
                  key={track.id}
                  onClick={() => toggleTrackSelection(track.id)}
                  className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                    isChecked
                      ? 'bg-[#ff8c00]/10 border-[#ff8c00]/60 shadow-[0_0_12px_rgba(255,140,0,0.15)]'
                      : 'bg-neutral-950 border-neutral-800 hover:border-neutral-700'
                  }`}
                >
                  <div className="flex items-center gap-3.5 truncate pr-2">
                    {/* Custom Checkbox */}
                    <div className={`w-5 h-5 rounded-lg border flex items-center justify-center flex-shrink-0 transition-colors ${
                      isChecked ? 'bg-[#ff8c00] border-[#ff8c00] text-neutral-950 font-bold text-xs' : 'bg-neutral-900 border-neutral-700'
                    }`}>
                      {isChecked && '✓'}
                    </div>

                    {/* Thumbnail Artwork */}
                    <div className="w-10 h-10 rounded-lg bg-neutral-900 border border-neutral-800 overflow-hidden flex-shrink-0 flex items-center justify-center">
                      {artUrl ? (
                        <img src={artUrl} alt={track.title} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-[8px] font-bold text-neutral-600">ART</span>
                      )}
                    </div>

                    {/* Track Info */}
                    <div className="truncate">
                      <h4 className="text-xs font-bold text-white truncate">{track.title}</h4>
                      <p className="text-[10px] text-neutral-400 truncate">
                        {track.album_name ? `Albums: ${track.album_name}` : 'Unassigned Single'} {track.artist_handle ? `• @${track.artist_handle}` : ''}
                      </p>
                    </div>
                  </div>

                  <span className={`text-[10px] font-bold px-2 py-1 rounded-md flex-shrink-0 ${
                    isInThisAlbum 
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' 
                      : isInOtherAlbums
                      ? 'bg-[#ff8c00]/10 text-[#ff8c00] border border-[#ff8c00]/30'
                      : 'bg-neutral-900 text-neutral-500 border border-neutral-800'
                  }`}>
                    {isInThisAlbum ? 'In Album' : (isInOtherAlbums ? 'In Other Album' : 'Available')}
                  </span>
                </div>
              );
            })
          )}
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
            onClick={handleSave}
            className="flex-1 bg-[#ff8c00] hover:bg-[#e07b00] text-neutral-950 font-extrabold py-2.5 rounded-xl text-xs cursor-pointer disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Album Assignments'}
          </button>
        </div>
      </div>
    </div>
  );
}
