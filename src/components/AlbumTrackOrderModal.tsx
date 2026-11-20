'use client';

import { useState, useEffect } from 'react';
import { supabase as _supabase } from '@/utils/supabase';

interface AlbumTrackOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  albumName: string;
  albumTracks: Array<any>;
  onSave: (updatedTracks: Array<any>) => void;
}

export default function AlbumTrackOrderModal({
  isOpen,
  onClose,
  albumName,
  albumTracks,
  onSave,
}: AlbumTrackOrderModalProps) {
  // Sort incoming tracks strictly by their current album_order
  const [tracks, setTracks] = useState(() =>
    [...albumTracks].sort((a, b) => (a.album_order ?? 0) - (b.album_order ?? 0))
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setTracks(
      [...albumTracks].sort((a, b) => (a.album_order ?? 0) - (b.album_order ?? 0))
    );
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

  const handleSaveSequence = async () => {
    setSaving(true);
    try {
      // Prepare the payload mapping each track ID to its new local album_order index
      const updates = tracks.map((track, i) => ({
        id: track.id,
        album_order: i,
      }));

      // Execute the atomic database RPC call safely in a single round-trip
      const { error } = await _supabase.rpc('update_album_track_orders', {
        track_updates: updates,
      });

      if (error) throw error;

      // Pass back tracks updated with their new local album_order indices
      const reorderedTracks = tracks.map((track, i) => ({
        ...track,
        album_order: i,
      }));

      onSave(reorderedTracks);
      onClose();
    } catch (err: any) {
      console.error('Error saving album track sequence via RPC:', err);
      alert(`Failed to update internal track order: ${err?.message || 'Database error'}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-neutral-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 touch-manipulation">
      <div className="bg-neutral-900 border border-neutral-800 rounded-3xl w-full max-w-lg p-6 space-y-6 text-left shadow-2xl touch-manipulation">
        <div className="flex justify-between items-center border-b border-neutral-800 pb-4">
          <div>
            <h3 className="font-extrabold text-xl text-white">Manage Tracks: {albumName}</h3>
            <p className="text-xs text-neutral-400 mt-0.5">Reorder track sequencing inside this project independently.</p>
          </div>
          <button onClick={onClose} className="text-neutral-500 hover:text-white font-bold text-lg cursor-pointer">✕</button>
        </div>

        <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
          {tracks.length === 0 ? (
            <div className="text-center py-6 text-neutral-500 text-xs">No tracks found in this album.</div>
          ) : (
            tracks.map((track, idx) => {
              const artUrl = track.artwork_url || (track.artwork_file_path ? `https://chhwujiajdhaihupvuix.supabase.co/storage/v1/object/public/v2-cover-art/${track.artwork_file_path}` : null);

              return (
                <div key={track.id} className="bg-neutral-950 border border-neutral-800 p-3 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-3 truncate max-w-[320px]">
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

                  <div className="flex items-center gap-1 flex-shrink-0">
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
            {saving ? 'Saving...' : 'Save Track Order'}
          </button>
        </div>
      </div>
    </div>
  );
}
