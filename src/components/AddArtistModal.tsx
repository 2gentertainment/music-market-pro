'use client';

import { useState } from 'react';

interface AddArtistModalProps {
  isOpen: boolean;
  onClose: () => void;
  parentLabelId: string | null;
  onArtistAdded: () => void;
}

export default function AddArtistModal({ isOpen, onClose, parentLabelId, onArtistAdded }: AddArtistModalProps) {
  const [artistName, setArtistName] = useState('');
  const [handle, setHandle] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAddArtist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!parentLabelId) {
      setErrorMsg('Label executive profile ID missing.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const formattedHandle = handle.toLowerCase().replace(/\s+/g, '-');

            const response = await fetch('/api/artist/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: artistName,
          stage_name: artistName.trim(),
          handle: formattedHandle,
          parent_label_id: parentLabelId,
        }),
      });


      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to add artist.');
      }

      onArtistAdded();
      setArtistName('');
      setHandle('');
      onClose();
    } catch (err: any) {
      console.error('Error adding artist:', err);
      setErrorMsg(err?.message || 'Failed to add artist to roster.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-neutral-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 touch-manipulation">
      <div className="bg-neutral-900 border border-neutral-800 rounded-3xl w-full max-w-md p-6 space-y-6 text-left shadow-2xl touch-manipulation">
        <div className="flex justify-between items-center border-b border-neutral-800 pb-4">
          <div>
            <h3 className="font-extrabold text-xl text-white">Add Artist to Roster</h3>
            <p className="text-xs text-neutral-400 mt-0.5">Register a new artist under your Label Executive account.</p>
          </div>
          <button onClick={onClose} className="text-neutral-500 hover:text-white font-bold text-lg">✕</button>
        </div>

        {errorMsg && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleAddArtist} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-neutral-300">Artist Stage / Display Name</label>
            <input
              type="text"
              required
              value={artistName}
              onChange={(e) => {
                setArtistName(e.target.value);
                setHandle(e.target.value.toLowerCase().replace(/\s+/g, '-'));
              }}
              placeholder="e.g. Lou Kain"
              className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-base sm:text-sm text-white focus:outline-none focus:border-[#ff8c00]"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-neutral-300">Unique URL Handle / Slug</label>
            <input
              type="text"
              required
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              placeholder="e.g. lou-kain"
              className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-base sm:text-sm text-white focus:outline-none focus:border-[#ff8c00]"
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
              type="submit"
              disabled={loading}
              className="flex-1 bg-[#ff8c00] hover:bg-[#e07b00] text-neutral-950 font-extrabold py-2.5 rounded-xl text-xs cursor-pointer disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save Artist'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
