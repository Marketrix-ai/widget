let activeStream: MediaStream | null = null;

function getLiveStream(): MediaStream | null {
  if (activeStream?.active && activeStream.getVideoTracks()[0]?.readyState === 'live') {
    return activeStream;
  }
  activeStream = null;
  return null;
}

export async function startScreenShare(): Promise<MediaStream> {
  const liveStream = getLiveStream();
  if (liveStream) return liveStream;

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

export function stopScreenShare(): void {
  if (activeStream) {
    activeStream.getTracks().forEach(track => track.stop());
    activeStream = null;
  }
}

export function isScreenSharing(): boolean {
  return getLiveStream() !== null;
}
