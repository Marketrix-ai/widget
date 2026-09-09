/**
 * Module-level screen-share state — one `MediaStream` at a time. `startScreenShare` refuses when the
 * tenant has `use_screenshare` off (before any picker, so a stored config that lost its credentials cannot
 * reopen it), reuses a live stream, otherwise prompts `getDisplayMedia` preferring the current tab and
 * drops the reference when the visitor ends the share from the browser UI. `activeScreenStream` returns
 * the stream only while its video track is live; `stopScreenShare` and `isScreenSharing` are the
 * obvious pair.
 */
import { storageService } from './StorageService';

let activeStream: MediaStream | null = null;

export function activeScreenStream(): MediaStream | null {
  if (activeStream?.active && activeStream.getVideoTracks()[0]?.readyState === 'live') {
    return activeStream;
  }
  activeStream = null;
  return null;
}

export async function startScreenShare(): Promise<MediaStream> {
  if (storageService.getContext().config?.use_screenshare === false) {
    throw new Error('Screen sharing is disabled for this widget');
  }

  const liveStream = activeScreenStream();
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
  return activeScreenStream() !== null;
}
