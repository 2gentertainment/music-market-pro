'use client';

import { useState } from 'react';
import { supabase as _supabase } from '@/utils/supabase';

export default function AlbumSettingsModal({
  isOpen,
  onClose,
  albumName,
  artistHandle,
  onSaved,
}: {
  isOpen: boolean;
  onClose: () => void;
  albumName: string;
  artistHandle: string;
  onSaved: () => void;
}) {
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!coverFile) {
      onClose();
      return;
    }

    setSaving(true);
    try {
      // 1. Upload image to v2-cover-art storage bucket
      const fileName = `album-master-${Date.now()}-${coverFile.name}`;
      const { data: uploadData, error: uploadError } = await _supabase.storage
        .from('v2-cover-art')
        .upload(fileName, coverFile);

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

      alert('Project master cover updated successfully!');
      onSaved();
      onClose();
    } catch (err: any) {
      console.error('Error saving master album cover:', err);
      alert(`Failed to save cover: ${err?.message || 'Unknown error'}`);
    } finally {
      setSaving(false);
      setCoverFile(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-neutral-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 touch-manipulation">
      <div className="bg-neutral-900 border border-neutral-800 rounded-3xl w-full max-w-md p-6 space-y-5 text-left shadow-2xl touch-manipulation">
        <div className="flex justify-between items-center border-b border-neutral-800 pb-4">
          <div>
            <h3 className="font-extrabold text-lg text-white">Project Cover Art</h3>
            <p className="text-xs text-neutral-400 mt-0.5">Manage master artwork for "{albumName}".</p>
          </div>
          <button onClick={onClose} className="text-neutral-500 hover:text-white font-bold text-lg cursor-pointer">✕</button>
        </div>

        <div className="space-y-3">
          <label className="text-xs font-bold text-[#ff8c00] uppercase tracking-wider block">
            Upload New Master Artwork
          </label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setCoverFile(e.target.files?.[0] || null)}
            className="w-full text-xs text-neutral-400 file:mr-2 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-[#ff8c00] file:text-neutral-950 hover:file:bg-[#e07b00] cursor-pointer"
          />
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
            disabled={saving || !coverFile}
            onClick={handleSave}
            className="flex-1 bg-[#ff8c00] hover:bg-[#e07b00] text-neutral-950 font-extrabold py-2.5 rounded-xl text-xs cursor-pointer disabled:opacity-50"
          >
            {saving ? 'Uploading...' : 'Save Cover Art'}
          </button>
        </div>
      </div>
    </div>
  );
}
