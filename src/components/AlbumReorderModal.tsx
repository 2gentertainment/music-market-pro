'use client';

import { useState, useEffect } from 'react';
import { supabase as _supabase } from '@/utils/supabase';

interface AlbumReorderModalProps {
  isOpen: boolean;
  onClose: () => void;
  albumName: string;
  albumTracks: Array<any>;
  onSave: (updatedTracks: Array<any>) => void;
}

const handleSaveAlbumCover = async (file: File, albumName: string, artistHandle: string) => {
  try {
    // 1. Upload to v2-cover-art bucket
    const fileName = `album-master-${Date.now()}-${file.name}`;
    const { data: uploadData, error: uploadError } = await _supabase.storage
      .from('v2-cover-art')
      .upload(fileName, file);

    if (uploadError) throw uploadError;

    const filePath = uploadData.path;
    const { data: { session } } = await _supabase.auth.getSession();

    // 2. Upsert into albums_meta table
    const { error: dbError } = await _supabase
      .from('albums_meta')
      .upsert([
        {
          user_id: session?.user?.id,
          artist_handle: artistHandle,
          album_name: albumName,
          artwork_file_path: filePath,
        }
      ], { onConflict: 'artist_handle,album_name' });

    if (dbError) throw dbError;
  } catch (err: any) {
    console.error('Error saving album cover:', err);
    throw err;
  }
};


export default function AlbumReorderModal({
  isOpen,
  onClose,
  albumName,
  albumTracks,
  onSave,
}: AlbumReorderModalProps) {
  const [tracks, setTracks] = useState(() =>
    [...albumTracks].sort((a, b) => (a.album_order ?? 0) - (b.album_order ?? 0))
  );
  const [saving, setSaving] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  
  // --- NEW: State for Master Album Cover File ---
  const [albumCoverFile, setAlbumCoverFile] = useState<File | null>(null);

  useEffect(() => {
    setTracks(
      [...albumTracks].sort((a, b) => (a.album_order ?? 0) - (b.album_order ?? 0))
    );
    setAlbumCoverFile(null); // Reset file selection on open
  }, [albumTracks, isOpen]);

  if (!isOpen) return null;

  const moveTrack = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= tracks.length) return;
    const updated = [...tracks];
    const temp = updated[index];
    updated[index] = updated[newIndex];
    updated[newIndex] = temp;
    setTracks(updated);
  };

  // --- Drag and Drop Handlers ---
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedIndex === null || draggedIndex === index) return;

    const updated = [...tracks];
    const draggedItem = updated[draggedIndex];
    updated.splice(draggedIndex, 1);
    updated.splice(index, 0, draggedItem);

    setDraggedIndex(index);
    setTracks(updated);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const handleSaveSequence = async () => {
    setSaving(true);
    try {
      // 1. If an artist chose a dedicated master album cover file, upload it to albums_meta first
      if (albumCoverFile && tracks.length > 0) {
        const artistHandle = tracks[0]?.artist_handle || '';
        await handleSaveAlbumCover(albumCoverFile, albumName, artistHandle);
      }

      // 2. Save track sequencing
      const updates = tracks.map((track, i) => ({
        id: track.id,
        album_order: i,
      }));

      const { error } = await _supabase.rpc('update_album_track_orders', {
        track_updates: updates,
      });

      if (error) throw error;

      const reorderedTracks = tracks.map((track, i) => ({
        ...track,
        album_order: i,
      }));

      onSave(reorderedTracks);
      onClose();
    } catch (err: any) {
      console.error('Error saving album sequence:', err);
      alert(`Failed to update project settings: ${err?.message || 'Database error'}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-neutral-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 touch-manipulation">
      <div className="bg-neutral-900 border border-neutral-800 rounded-3xl w-full max-w-lg p-6 space-y-5 text-left shadow-2xl touch-manipulation">
        <div className="flex justify-between items-center border-b border-neutral-800 pb-4">
          <div>
            <h3 className="font-extrabold text-xl text-white">Manage Album: {albumName}</h3>
            <p className="text-xs text-neutral-400 mt-0.5">Set master artwork and reorder track sequencing.</p>
          </div>
          <button onClick={onClose} className="text-neutral-500 hover:text-white font-bold text-lg cursor-pointer">✕</button>
        </div>

        {/* --- NEW: Master Album Cover Upload Field --- */}
        <div className="bg-neutral-950 border border-neutral-800 p-3.5 rounded-2xl space-y-2">
          <label className="text-[11px] font-bold text-[#ff8c00] uppercase tracking-wider block">
            Master Project Cover Art (Optional Override)
          </label>
          <p className="text-[11px] text-neutral-400">
            Upload a dedicated project cover here. It will lock in statically for all album cards and storefront bundles.
          </p>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setAlbumCoverFile(e.target.files?.[0] || null)}
            className="w-full text-xs text-neutral-400 file:mr-2 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-[#ff8c00] file:text-neutral-950 hover:file:bg-[#e07b00] cursor-pointer"
          />
        </div>

        <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
          {tracks.length === 0 ? (
            <div className="text-center py-6 text-neutral-500 text-xs">No tracks found in this album.</div>
          ) : (
            tracks.map((track, idx) => {
              const artUrl = track.artwork_url || (track.artwork_file_path ? `https://chhwujiajdhaihupvuix.supabase.co/storage/v1/object/public/v2-cover-art/${track.artwork_file_path}` : null);

              return (
                <div
                  key={track.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, idx)}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDragEnd={handleDragEnd}
                  className={`border p-3 rounded-xl flex items-center justify-between cursor-grab active:cursor-grabbing transition-all ${
                    draggedIndex === idx 
                      ? 'border-[#ff8c00] bg-[#ff8c00]/10 opacity-60 shadow-lg' 
                      : 'bg-neutral-950 border-neutral-800 hover:border-neutral-700'
                  }`}
                >
                  <div className="flex items-center gap-3 truncate max-w-[320px]">
                    <span className="text-neutral-600 hover:text-neutral-400 font-bold text-xs select-none" title="Drag to reorder">
                      ⠿
                    </span>
                    <span className="text-neutral-500 font-bold text-xs w-5 flex-shrink-0">{idx + 1}.</span>
                    
                    <div className="w-8 h-8 rounded-lg bg-neutral-900 border border-neutral-800 overflow-hidden flex-shrink-0 flex items-center justify-center">
                      {artUrl ? (
                        <img src={artUrl} alt={track.title} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-[8px] font-bold text-neutral-600">ART</span>
                      )}
                    </div>

                    <span className="text-xs font-bold text-white truncate">
                      {track.title}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => moveTrack(idx, 'up')}
                      className="p-1.5 rounded-lg bg-neutral-900 text-neutral-300 hover:bg-neutral-800 disabled:opacity-30 cursor-pointer text-xs border border-neutral-800"
                      title="Move Up"
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      disabled={idx === tracks.length - 1}
                      onClick={() => moveTrack(idx, 'down')}
                      className="p-1.5 rounded-lg bg-neutral-900 text-neutral-300 hover:bg-neutral-800 disabled:opacity-30 cursor-pointer text-xs border border-neutral-800"
                      title="Move Down"
                    >
                      ▼
                    </button>
                  </div>
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
            disabled={saving || tracks.length === 0}
            onClick={handleSaveSequence}
            className="flex-1 bg-[#ff8c00] hover:bg-[#e07b00] text-neutral-950 font-extrabold py-2.5 rounded-xl text-xs cursor-pointer disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Sequence & Cover'}
          </button>
        </div>
      </div>
    </div>
  );
}
