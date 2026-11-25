  const playStorefrontTrack = (track: Track) => {
    if (!track.audio_file_path) {
      alert("Audio file path is missing for this track.");
      return;
    }

    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.preload = 'auto';
    }

    const el = audioRef.current;
    el.pause();
    el.src = track.audio_file_path;
    el.load();
    el.onended = () => {
      setIsPlaying(false);
      stepTrackRef.current('next');
    };

    lastMediaTrackIdRef.current = null;
    setCurrentTrack(track);
    syncMediaSessionMetadata(track);
    bindMediaSessionHandlers();
    setIsPlaying(true);
    scrollToAlbumUpsellIfPresent(track, isPaidTier);

    el.play()
      .then(() => {
        logStorefrontEvent('play', track);
        if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
          navigator.mediaSession.playbackState = 'playing';
        }
      })
      .catch((err) => {
        console.error("Audio playback error:", err);
        setIsPlaying(false);
      });
  };

  const togglePlayTrack = (track: Track) => {
    const el = audioRef.current;
    if (currentTrack?.id === track.id && isPlaying && el && !el.paused) {
      el.pause();
      setIsPlaying(false);
      if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
        navigator.mediaSession.playbackState = 'paused';
      }
      return;
    }

    if (currentTrack?.id === track.id && !isPlaying && el && el.src) {
      syncMediaSessionMetadata(track);
      bindMediaSessionHandlers();
      setIsPlaying(true);
      el.play()
        .then(() => {
          if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
            navigator.mediaSession.playbackState = 'playing';
          }
        })
        .catch((err) => {
          console.error("Audio playback error:", err);
          setIsPlaying(false);
        });
      return;
    }

    playStorefrontTrack(track);
  };

  const handleStepTrack = (direction: 'prev' | 'next') => {
    if (sortedTracks.length === 0) return;

    const currentIndex = currentTrack
      ? sortedTracks.findIndex((t) => String(t.id) === String(currentTrack.id))
      : -1;

    let nextIndex = 0;
    if (currentIndex === -1) {
      nextIndex = 0;
    } else if (direction === 'next') {
      nextIndex = (currentIndex + 1) % sortedTracks.length;
    } else {
      nextIndex = (currentIndex - 1 + sortedTracks.length) % sortedTracks.length;
    }

    const targetTrack = sortedTracks[nextIndex];
    if (!targetTrack) return;

    playStorefrontTrack(targetTrack);
  };
