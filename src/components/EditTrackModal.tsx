'use client';

import { useState, useEffect } from 'react';
import { supabase as _supabase } from '@/utils/supabase';

const PRESET_GENRES = [
  'Hip-Hop', 'Rap', 'R&B', 'Trap', 'Drill', 'Soul', 'Pop', 'Afrobeats',
  'Electronic / Dance', 'Rock / Alternative', 'Instrumental / Beat', 'Other'
];

interface EditTrackModalProps {
  isOpen: boolean;
  onClose: () => void;
  track: any;
  userTier: string;
  onTrackUpdated: (updatedTrack: any) => void;
  existingAlbums?: string[];
}

export default function EditTrackModal({
  isOpen,
  onClose,
  track,
  userTier,
  onTrackUpdated,
  existingAlbums = [],
}: EditTrackModalProps) {
  const [title, setTitle] = useState('');
  const [genre, setGenre] = useState('Hip-Hop');
  const [price, setPrice] = useState('0.99');
  const [albumName, setAlbumName] = useState('');

  // Artwork state
  const [artworkFile, setArtworkFile] = useState<File | null>(null);
  const [currentArtworkUrl, setCurrentArtworkUrl] = useState<string | null>(null);

  const [spotifyUrl, setSpotifyUrl] = useState('');
  const [appleMusicUrl, setAppleMusicUrl] = useState('');
  const [tidalUrl, setTidalUrl] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [pandoraUrl, setPandoraUrl] = useState('');

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (track) {
      setTitle(track.title || '');
      setGenre(track.genre || 'Hip-Hop');
      setPrice(String(track.price ?? '0.99'));
      setAlbumName(track.album_name || '');
      setSpotifyUrl(track.spotify_url || '');
      setAppleMusicUrl(track.apple_music_url || '');
      setTidalUrl(track.tidal_url || '');
      setYoutubeUrl(track.youtube_url || '');
      setPandoraUrl(track.pandora_url || '');

      // Resolve existing artwork preview
      const artUrl = track.artwork_url || (track.artwork_file_path ? `https://chhwujiajdhaihupvuix.supabase.co/storage/v1/object/public/v2-cover-art/${track.artwork_file_path}` : null);
      setCurrentArtworkUrl(artUrl);
      setArtworkFile(null); // Reset file picker selection
    }
  }, [track]);

  if (!isOpen || !track) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg(null);

    try {
      let artworkPath = track.artwork_file_path;

      // Upload new artwork file to v2-cover-art bucket if selected
      if (artworkFile) {
        const artworkFileName = `art-${Date.now()}-${artworkFile.name}`;
        const { data: artUpload, error: artError } = await _supabase.storage
          .from('v2-cover-art')
          .upload(artworkFileName, artworkFile);

        if (artError) throw artError;
        if (artUpload) {
          artworkPath = artUpload.path;
        }
      }

      const updatePayload: any = {
        title: title.trim(),
        genre,
        price: parseFloat(price) || 0,
        artwork_file_path: artworkPath,
      };

      if (userTier === 'artist' || userTier === 'label') {
        updatePayload.album_name = albumName.trim() || null;
        updatePayload.spotify_url = spotifyUrl.trim() || null;
        updatePayload.apple_music_url = appleMusicUrl.trim() || null;
        updatePayload.tidal_url = tidalUrl.trim() || null;
        updatePayload.youtube_url = youtubeUrl.trim() || null;
        updatePayload.pandora_url = pandoraUrl.trim() || null;
      }

      const { data: updated, error } = await _supabase
        .from('tracks_pro')
        .update(updatePayload)
        .eq('id', track.id)
        .select('*')
        .single();

      if (error) throw error;

      alert(`Success! Track metadata & artwork for "${updated.title}" was updated.`);
      onTrackUpdated(updated);
      onClose();
    } catch (err: any) {
      console.error('Error updating track:', err);
      setErrorMsg(err.message || 'Failed to update track record.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-neutral-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 touch-manipulation">
      <div className="bg-neutral-900 border border-neutral-800 rounded-3xl w-full max-w-lg p-6 space-y-6 text-left shadow-2xl max-h-[90vh] overflow-y-auto touch-manipulation">
        <div className="flex justify-between items-center border-b border-neutral-800 pb-4">
          <div>
            <h3 className="font-extrabold text-xl text-white">Edit Track, Artwork & DSP Links</h3>
            <p className="text-xs text-neutral-400 mt-0.5">Update metadata, attach cover art, and link streaming platforms.</p>
          </div>
          <button onClick={onClose} className="text-neutral-500 hover:text-white font-bold text-lg cursor-pointer">✕</button>
        </div>

        {errorMsg && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4">
          {/* Artwork Preview & Upload Section */}
          <div className="p-4 bg-neutral-950 border border-neutral-800 rounded-2xl flex items-center gap-4">
            <div className="w-16 h-16 rounded-xl bg-neutral-900 border border-neutral-800 overflow-hidden flex-shrink-0 flex items-center justify-center">
              {currentArtworkUrl ? (
                <img src={currentArtworkUrl} alt="Cover Preview" className="w-full h-full object-cover" />
              ) : (
                <span className="text-[9px] font-black text-neutral-600">NO ART</span>
              )}
            </div>
            <div className="space-y-1.5 flex-1">
              <label className="text-xs font-semibold text-neutral-300 block">Update Track Artwork (.jpg/.png)</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setArtworkFile(e.target.files?.[0] || null)}
                className="w-full text-xs text-neutral-400 file:mr-2 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-neutral-800 file:text-neutral-200 hover:file:bg-neutral-700 cursor-pointer"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-300">Track Title *</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-base sm:text-sm text-white focus:outline-none focus:border-[#ff8c00]"
              />
            </div>
            
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-300">Genre *</label>
              <select
                required
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-base sm:text-sm text-white focus:outline-none focus:border-[#ff8c00] cursor-pointer"
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
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-base sm:text-sm text-white focus:outline-none focus:border-[#ff8c00]"
              />
            </div>
            
            {(userTier === 'artist' || userTier === 'label') ? (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-300">Album / Project Name</label>
                <input
                  type="text"
                  value={albumName}
                  onChange={(e) => setAlbumName(e.target.value)}
                  placeholder="e.g. Deluxe EP"
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-base sm:text-sm text-white focus:outline-none focus:border-[#ff8c00]"
                />
              </div>
            ) : (
              <div className="space-y-1.5 opacity-40">
                <label className="text-xs font-semibold text-neutral-500">Album Assignment (Artist+)</label>
                <input type="text" disabled placeholder="Upgrade to unlock" className="w-full bg-neutral-950 border border-neutral-900 rounded-xl px-4 py-2.5 text-sm text-neutral-600 cursor-not-allowed" />
              </div>
            )}
          </div>

          {(userTier === 'artist' || userTier === 'label') ? (
            <div className="border-t border-neutral-800 pt-4 space-y-3">
              <span className="text-xs font-bold text-[#ff8c00] uppercase tracking-wider block">Streaming Platform Links</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input type="url" value={spotifyUrl} onChange={(e) => setSpotifyUrl(e.target.value)} placeholder="Spotify URL" className="bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-base sm:text-xs text-white focus:outline-none focus:border-[#ff8c00]" />
                <input type="url" value={appleMusicUrl} onChange={(e) => setAppleMusicUrl(e.target.value)} placeholder="Apple Music URL" className="bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-base sm:text-xs text-white focus:outline-none focus:border-[#ff8c00]" />
                <input type="url" value={tidalUrl} onChange={(e) => setTidalUrl(e.target.value)} placeholder="Tidal URL" className="bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-base sm:text-xs text-white focus:outline-none focus:border-[#ff8c00]" />
                <input type="url" value={youtubeUrl} onChange={(e) => setYoutubeUrl(e.target.value)} placeholder="YouTube URL" className="bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-base sm:text-xs text-white focus:outline-none focus:border-[#ff8c00]" />
                <input type="url" value={pandoraUrl} onChange={(e) => setPandoraUrl(e.target.value)} placeholder="Pandora URL" className="bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-base sm:text-xs text-white focus:outline-none focus:border-[#ff8c00]" />
              </div>
            </div>
          ) : (
            <div className="border-t border-neutral-800 pt-3">
              <p className="text-[11px] text-neutral-500 italic">💡 Upgrade to Artist or Label tier to attach streaming platform links to your tracks.</p>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 bg-neutral-800 hover:bg-neutral-700 text-white font-bold py-2.5 rounded-xl text-xs cursor-pointer">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 bg-[#ff8c00] hover:bg-[#e07b00] text-neutral-950 font-extrabold py-2.5 rounded-xl text-xs cursor-pointer disabled:opacity-50">
              {saving ? 'Uploading Art & Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
