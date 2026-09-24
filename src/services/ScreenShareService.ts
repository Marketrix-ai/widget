/**
 * Module-level screen-share store — one `MediaStream` at a time, read by React through
 * `useSyncExternalStore(subscribeScreenShare, activeScreenStream)`.
 *
 * `startScreenShare` reuses a live stream, otherwise prompts `getDisplayMedia` preferring the current tab;
 * `stopScreenShare` releases every track. `activeScreenStream` returns the stream only while its video
 * track is live. Every change, including the visitor ending the share from the browser's own UI, notifies
 * subscribers. Concurrent `startScreenShare` callers share one in-flight prompt, so a second picker never opens.
 */

let activeStream: MediaStream | null = null;
let pendingStart: Promise<MediaStream> | null = null;
const listeners = new Set<() => void>();

function setActiveStream(stream: MediaStream | null): void {
  activeStream = stream;
  listeners.forEach(listener => listener());
}

export function subscribeScreenShare(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function activeScreenStream(): MediaStream | null {
  return activeStream?.active && activeStream.getVideoTracks()[0]?.readyState === 'live' ? activeStream : null;
}

export async function startScreenShare(): Promise<MediaStream> {
  const liveStream = activeScreenStream();
  if (liveStream) return liveStream;

  pendingStart ??= (async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
        preferCurrentTab: true,
      });
      const track = stream.getVideoTracks()[0];
      if (!track) throw new Error('Screen sharing permission denied or no video track available');

      track.addEventListener('ended', () => {
        if (activeStream === stream) setActiveStream(null);
      });
      setActiveStream(stream);
      return stream;
    } finally {
      pendingStart = null;
    }
  })();
  return pendingStart;
}

export function stopScreenShare(): void {
  if (!activeStream) return;
  activeStream.getTracks().forEach(track => track.stop());
  setActiveStream(null);
}
