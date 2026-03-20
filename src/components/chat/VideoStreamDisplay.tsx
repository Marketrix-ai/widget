import React, { useEffect, useRef, useState } from 'react';

interface VideoStreamDisplayProps {
  stream: MediaStream | null;
  isUserMessage?: boolean;
}

export const VideoStreamDisplay: React.FC<VideoStreamDisplayProps> = ({ stream, isUserMessage = false }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playPromiseRef = useRef<Promise<void> | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (videoRef.current && stream) {
      const video = videoRef.current;

      // Reset states
      setIsLoaded(false);
      setHasError(false);

      // Cancel any pending play() request
      if (playPromiseRef.current) {
        playPromiseRef.current.catch(() => {
          // Ignore errors from cancelled play requests
        });
        playPromiseRef.current = null;
      }

      // Set the stream source
      video.srcObject = stream;

      // Handle video loaded event
      const handleLoadedMetadata = () => {
        setIsLoaded(true);
      };

      const handleError = () => {
        setHasError(true);
        setIsLoaded(false);
      };

      video.addEventListener('loadedmetadata', handleLoadedMetadata);
      video.addEventListener('error', handleError);

      // Attempt to play, handling AbortError gracefully
      const playPromise = video.play();
      playPromiseRef.current = playPromise;

      playPromise
        .then(() => {
          setIsLoaded(true);
        })
        .catch(error => {
          // AbortError is expected when a new stream loads - don't log it as an error
          if (error instanceof Error && error.name !== 'AbortError') {
            console.error('Error playing video stream:', error);
            setHasError(true);
          }
          playPromiseRef.current = null;
        });

      return () => {
        video.removeEventListener('loadedmetadata', handleLoadedMetadata);
        video.removeEventListener('error', handleError);
      };
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
      setIsLoaded(false);
      setHasError(false);
    };
  }, [stream]);

  if (!stream) return null;

  // Match message bubble border radius: user messages have rounded-l-lg rounded-tr-lg rounded-br-lg
  // So top corners should be rounded: top-left and top-right
  const borderRadiusClass = isUserMessage ? 'rounded-tl-lg rounded-tr-lg' : 'rounded-tr-lg rounded-tl-lg';

  return (
    <div
      className={`w-full overflow-hidden mb-1 ${borderRadiusClass} relative group`}
      style={{
        backgroundColor: '#000000',
        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)',
      }}
    >
      {/* Loading overlay */}
      {!isLoaded && !hasError && (
        <div
          className={`absolute inset-0 flex items-center justify-center bg-gray-900 ${borderRadiusClass} z-10 transition-opacity duration-300 ${
            isLoaded ? 'opacity-0' : 'opacity-100'
          }`}
        >
          <div className='flex flex-col items-center gap-2'>
            <div className='relative w-8 h-8'>
              <div className='absolute inset-0 border-2 border-white border-t-transparent rounded-full animate-spin' />
              <div
                className='absolute inset-0 border-2 border-transparent border-r-white rounded-full animate-spin'
                style={{ animationDirection: 'reverse', animationDuration: '0.8s' }}
              />
            </div>
            <span className='text-xs text-white/70 font-medium'>Loading stream...</span>
          </div>
        </div>
      )}

      {/* Error overlay */}
      {hasError && (
        <div className={`absolute inset-0 flex items-center justify-center bg-gray-900 ${borderRadiusClass} z-10`}>
          <div className='flex flex-col items-center gap-2 text-center px-4'>
            <svg className='w-8 h-8 text-gray-400' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
              />
            </svg>
            <span className='text-xs text-white/70 font-medium'>Failed to load stream</span>
          </div>
        </div>
      )}

      {/* Video element with smooth transitions */}
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className={`w-full h-auto max-h-48 object-contain ${borderRadiusClass} transition-opacity duration-500 ${
          isLoaded ? 'opacity-100' : 'opacity-0'
        }`}
        style={{
          minHeight: '120px',
          background: 'linear-gradient(135deg, #111827 0%, #374151 100%)',
        }}
      />

      {/* Live indicator badge */}
      {isLoaded && !hasError && (
        <div
          className='absolute top-2 right-2 flex items-center gap-1.5 px-2 py-1 rounded-full bg-gray-700/90 backdrop-blur-sm z-20 animate-fade-in'
          style={{
            boxShadow: '0 2px 8px rgba(31, 41, 55, 0.4)',
          }}
        >
          <div className='relative flex items-center justify-center'>
            <div className='absolute w-2 h-2 rounded-full bg-white animate-ping opacity-75' />
            <div className='relative w-1.5 h-1.5 rounded-full bg-white' />
          </div>
          <span className='text-[10px] font-semibold text-white uppercase tracking-wide'>Live</span>
        </div>
      )}

      {/* Hover overlay with info */}
      <div
        className={`absolute inset-0 ${borderRadiusClass} bg-black/0 group-hover:bg-black/20 transition-all duration-300 flex items-center justify-center opacity-0 group-hover:opacity-100 z-30 pointer-events-none`}
      >
        <div className='px-3 py-1.5 rounded-lg bg-black/70 backdrop-blur-sm text-white text-xs font-medium'>
          Screen Sharing Active
        </div>
      </div>
    </div>
  );
};
