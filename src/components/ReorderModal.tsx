'use client';

import { useState, useEffect } from 'react';
import { supabase as _supabase } from '@/utils/supabase';

interface ReorderModalProps {
  isOpen: boolean;
  onClose: () => void;
  tracks: Array<any>;
  onSave: (updatedTracks: Array<any>) => void;
}

export default function ReorderModal({ isOpen, onClose, tracks: initialTracks, onSave }: ReorderModalProps) {
  const [tracks, setTracks] = useState(initialTracks);
  const [saving, setSaving] = useState(false);
  const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  useEffect(() => {
    setTracks(initialTracks);
  }, [initialTracks, isOpen]);

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

  const handleDragStart = (index: number) => {
    setDraggedItemIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (targetIndex: number) => {
    if (draggedItemIndex === null || draggedItemIndex === targetIndex) {
      setDraggedItemIndex(null);
      setDragOverIndex(null);
      return;
    }

    const updated = [...tracks];
    const [movedItem] = updated.splice(draggedItemIndex, 1);
    updated.splice(targetIndex, 0, movedItem);

    setTracks(updated);
    setDraggedItemIndex(null);
    setDragOverIndex(null);
  };

  const handleSaveSequence = async () => {
    setSaving(true);
    try {
      // Domain 1 Isolation: Update ONLY track_order
      const updatePromises = tracks.map((track, i) => 
        _supabase
          .from('tracks_pro')
          .update({ track_order: i })
          .eq('id', track.id)
      );

      const results = await Promise.all(updatePromises);
      const firstError = results.find(r => r.error)?.error;
      if (firstError) throw firstError;

      onSave(tracks);
      onClose();
    } catch (err) {
      console.error('Error saving track sequence:', err);
      alert('Failed to update track order.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-neutral-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 touch-manipulation">
      <div className="bg-neutral-900 border border-neutral-800 rounded-3xl w-full max-w-lg p-6 space-y-6 text-left shadow-2xl touch-manipulation">
        <div className="flex justify-between items-center border-b border-neutral-800 pb-4">
          <div>
            <h3 className="font-extrabold text-xl text-white">Reorder Primary Tracks</h3>
            <p className="text-xs text-neutral-400 mt-0.5">Drag and drop or use arrows to adjust your track sequence.</p>
          </div>
          <button onClick={onClose} className="text-neutral-500 hover:text-white font-bold text-lg cursor-pointer">✕</button>
        </div>

        <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
          {tracks.length === 0 ? (
            <div className="text-center py-6 text-neutral-500 text-xs">No tracks found.</div>
          ) : (
            tracks.map((track, idx) => {
              const artUrl = track.artwork_url || (track.artwork_file_path ? `https://chhwujiajdhaihupvuix.supabase.co/storage/v1/object/public/v2-cover-art/${track.artwork_file_path}` : null);

              return (
                <div 
                  key={track.id} 
                  draggable
                  onDragStart={() => handleDragStart(idx)}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDragLeave={handleDragLeave}
                  onDrop={() => handleDrop(idx)}
                  className={`bg-neutral-950 border p-3 rounded-xl flex items-center justify-between cursor-grab active:cursor-grabbing transition-all ${
                    dragOverIndex === idx 
                      ? 'border-[#ff8c00] bg-[#ff8c00]/10 shadow-[0_0_15px_rgba(255,140,0,0.2)]' 
                      : 'border-neutral-800 hover:border-neutral-700'
                  }`}
                >
                  <div className="flex items-center gap-3 truncate max-w-[320px]">
                    <span className="text-neutral-600 font-mono text-xs select-none flex-shrink-0">⋮⋮</span>
                    <span className="text-neutral-500 font-bold text-xs w-5 flex-shrink-0">{idx + 1}.</span>
                    <div className="w-8 h-8 rounded-lg bg-neutral-900 border border-neutral-800 overflow-hidden flex-shrink-0 flex items-center justify-center">
                      {artUrl ? (
                        <img src={artUrl} alt={track.title} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-[8px] font-bold text-neutral-600">ART</span>
                      )}
                    </div>
                    <span className="text-xs font-bold text-white truncate">{track.title}</span>
                  </div>
                  
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => moveTrack(idx, 'up')}
                      className="p-1.5 rounded-lg bg-neutral-900 text-neutral-300 hover:bg-neutral-800 disabled:opacity-30 cursor-pointer text-xs border border-neutral-800"
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      disabled={idx === tracks.length - 1}
                      onClick={() => moveTrack(idx, 'down')}
                      className="p-1.5 rounded-lg bg-neutral-900 text-neutral-300 hover:bg-neutral-800 disabled:opacity-30 cursor-pointer text-xs border border-neutral-800"
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
            {saving ? 'Saving...' : 'Save Sequence'}
          </button>
        </div>
      </div>
    </div>
  );
}
