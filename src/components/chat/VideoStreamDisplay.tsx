import React, { useEffect, useRef } from 'react';

interface VideoStreamDisplayProps {
  stream: MediaStream | null;
  isUserMessage?: boolean;
}

export const VideoStreamDisplay: React.FC<VideoStreamDisplayProps> = ({
  stream,
  isUserMessage = false,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playPromiseRef = useRef<Promise<void> | null>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      const video = videoRef.current;

      // Cancel any pending play() request
      if (playPromiseRef.current) {
        playPromiseRef.current.catch(() => {
          // Ignore errors from cancelled play requests
        });
        playPromiseRef.current = null;
      }

      // Set the stream source
      video.srcObject = stream;

      // Attempt to play, handling AbortError gracefully
      const playPromise = video.play();
      playPromiseRef.current = playPromise;

      playPromise.catch((error) => {
        // AbortError is expected when a new stream loads - don't log it as an error
        if (error instanceof Error && error.name !== 'AbortError') {
          console.error('Error playing video stream:', error);
        }
        playPromiseRef.current = null;
      });
    }

    return () => {
      // Clean up: cancel any pending play() and clear srcObject
      if (playPromiseRef.current) {
        playPromiseRef.current.catch(() => {
          // Ignore errors from cancelled play requests
        });
        playPromiseRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, [stream]);

  if (!stream) return null;

  // Match message bubble border radius: user messages have rounded-l-lg rounded-tr-lg rounded-br-lg
  // So top corners should be rounded: top-left and top-right
  const borderRadiusClass = isUserMessage
    ? 'rounded-tl-lg rounded-tr-lg'
    : 'rounded-tr-lg rounded-tl-lg';

  return (
    <div className={`w-full overflow-hidden mb-1 ${borderRadiusClass}`}>
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className={`w-full h-auto max-h-48 object-contain ${borderRadiusClass}`}
      />
    </div>
  );
};
