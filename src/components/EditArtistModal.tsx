'use client';

import { useState, useEffect } from 'react';
import { supabase as _supabase } from '@/utils/supabase';

interface EditArtistModalProps {
  isOpen: boolean;
  onClose: () => void;
  artist: any | null;
  isLabelOwnerRow?: boolean;
  onArtistUpdated: () => void;
}

export default function EditArtistModal({
  isOpen,
  onClose,
  artist,
  isLabelOwnerRow = false,
  onArtistUpdated,
}: EditArtistModalProps) {
  const [name, setName] = useState('');
  const [artistHandle, setArtistHandle] = useState('');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

    useEffect(() => {
    if (isOpen && artist) {
      setName(artist.stage_name || artist.name || '');
      setArtistHandle(artist.artist_handle || (!isLabelOwnerRow ? artist.handle : '') || '');
      setErrorMsg(null);
    }
  }, [isOpen, artist, isLabelOwnerRow]);


  if (!isOpen || !artist) return null;

  const cleanSlug = (val: string) =>
    val
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!artist?.id) return;

    const trimmedName = name.trim();
    const formattedHandle = cleanSlug(artistHandle);

    if (!trimmedName) {
      setErrorMsg('Please enter an artist name.');
      return;
    }

    setSaving(true);
    setErrorMsg(null);

        try {
      const updatePayload: Record<string, any> = {
        name: trimmedName,
        stage_name: trimmedName,
        artist_handle: formattedHandle || null,
        updated_at: new Date().toISOString(),
      };


      // Child roster profiles use `handle` as their storefront/artist slug;
      // for the label owner's own row, preserve `handle` so the label storefront slug stays intact.
      if (!isLabelOwnerRow && formattedHandle) {
        updatePayload.handle = formattedHandle;
      }

      const { error } = await _supabase
        .from('profiles')
        .update(updatePayload)
        .eq('id', artist.id);

      if (error) throw error;

      onArtistUpdated();
      onClose();
    } catch (err: any) {
      console.error('Error updating artist:', err);
      setErrorMsg(err?.message || 'Failed to save artist details.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-neutral-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 touch-manipulation">
      <div className="bg-neutral-900 border border-neutral-800 rounded-3xl w-full max-w-md p-6 space-y-5 text-left shadow-2xl touch-manipulation">
        <div className="flex justify-between items-center border-b border-neutral-800 pb-4">
          <div>
            <h3 className="font-extrabold text-xl text-white">Edit Artist Details</h3>
            <p className="text-xs text-neutral-400 mt-0.5">
              {isLabelOwnerRow
                ? 'Update the artist name and handle attached to your primary account row.'
                : 'Update this roster artist’s display name and handle.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-neutral-500 hover:text-white font-bold text-lg cursor-pointer"
          >
            ✕
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-neutral-300">Artist Name *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Artist One"
              className="w-full bg-neutral-950 border border-neutral-800 focus:border-[#ff8c00] rounded-xl px-4 py-2.5 text-base sm:text-sm text-white outline-none"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-neutral-300">Artist Handle</label>
            <input
              type="text"
              value={artistHandle}
              onChange={(e) => setArtistHandle(e.target.value)}
              placeholder="e.g. artist-one"
              className="w-full bg-neutral-950 border border-neutral-800 focus:border-[#ff8c00] rounded-xl px-4 py-2.5 text-base sm:text-sm text-white outline-none"
            />
            {cleanSlug(artistHandle) && (
              <p className="text-[11px] text-neutral-400">
                Player URL: <span className="text-[#ff8c00] font-semibold">/artist/{cleanSlug(artistHandle)}</span>
              </p>
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
              type="submit"
              disabled={saving}
              className="flex-1 bg-[#ff8c00] hover:bg-[#e07b00] text-neutral-950 font-extrabold py-2.5 rounded-xl text-xs cursor-pointer disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
