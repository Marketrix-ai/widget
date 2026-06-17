/**
 * Screen Share Service
 * Manages screensharing state and provides shared access to the active MediaStream
 * for use across the widget (chatWindow, toolExecutor, etc.)
 */

let activeStream: MediaStream | null = null;

/**
 * Start screen sharing. If already active, returns the existing stream.
 * @returns Promise resolving to the MediaStream
 */
export async function startScreenShare(): Promise<MediaStream> {
  if (activeStream?.active) {
    const videoTracks = activeStream.getVideoTracks();
    if (videoTracks.length > 0 && videoTracks[0].readyState === 'live') {
      return activeStream;
    }
  }

  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: true,
    audio: false,
    preferCurrentTab: true,
  } as DisplayMediaStreamOptions);

  if (!stream || stream.getVideoTracks().length === 0) {
    throw new Error('Screen sharing permission denied or no video track available');
  }

  activeStream = stream;

  stream.getVideoTracks()[0].addEventListener('ended', () => {
    activeStream = null;
  });

  return stream;
}

function getActiveStream(): MediaStream | null {
  // Check if stream is still active
  if (activeStream?.active) {
    const videoTracks = activeStream.getVideoTracks();
    if (videoTracks.length > 0 && videoTracks[0].readyState === 'live') {
      return activeStream;
    }
  }

  activeStream = null;
  return null;
}

export function stopScreenShare(): void {
  if (activeStream) {
    activeStream.getTracks().forEach(track => track.stop());
    activeStream = null;
  }
}

export function isScreenSharing(): boolean {
  return getActiveStream() !== null;
}
