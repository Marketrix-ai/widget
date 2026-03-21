import React, { useEffect, useRef, useState } from 'react';

import { Flex } from '../base/Flex';
import { Icon } from '../base/Icon';
import { Surface } from '../base/Surface';
import { Text } from '../base/Text';
import { Video } from '../base/Video';

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
    <Surface
      className={`w-full overflow-hidden mb-1 ${borderRadiusClass} relative group`}
      style={{
        backgroundColor: '#000000',
        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)',
      }}
    >
      {/* Loading overlay */}
      {!isLoaded && !hasError && (
        <Flex
          className={`absolute inset-0 items-center justify-center bg-gray-900 ${borderRadiusClass} z-10 transition-opacity duration-300 ${
            isLoaded ? 'opacity-0' : 'opacity-100'
          }`}
        >
          <Flex className='flex-col items-center gap-2'>
            <Surface className='relative w-8 h-8'>
              <Surface className='absolute inset-0 border-2 border-white border-t-transparent rounded-full animate-spin' />
              <Surface
                className='absolute inset-0 border-2 border-transparent border-r-white rounded-full animate-spin'
                style={{ animationDirection: 'reverse', animationDuration: '0.8s' }}
              />
            </Surface>
            <Text as='span' className='text-xs text-white/70 font-medium'>
              Loading stream...
            </Text>
          </Flex>
        </Flex>
      )}

      {/* Error overlay */}
      {hasError && (
        <Flex className={`absolute inset-0 items-center justify-center bg-gray-900 ${borderRadiusClass} z-10`}>
          <Flex className='flex-col items-center gap-2 text-center px-4'>
            <Icon name='alertCircle' size={32} className='text-gray-400' />
            <Text as='span' className='text-xs text-white/70 font-medium'>
              Failed to load stream
            </Text>
          </Flex>
        </Flex>
      )}

      {/* Video element with smooth transitions */}
      <Video
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
        <Flex
          className='absolute top-2 right-2 items-center gap-1.5 px-2 py-1 rounded-full bg-gray-700/90 backdrop-blur-sm z-20 animate-fade-in'
          style={{
            boxShadow: '0 2px 8px rgba(31, 41, 55, 0.4)',
          }}
        >
          <Flex className='relative items-center justify-center'>
            <Surface className='absolute w-2 h-2 rounded-full bg-white animate-ping opacity-75' />
            <Surface className='relative w-1.5 h-1.5 rounded-full bg-white' />
          </Flex>
          <Text as='span' className='text-[10px] font-semibold text-white uppercase tracking-wide'>
            Live
          </Text>
        </Flex>
      )}

      {/* Hover overlay with info */}
      <Flex
        className={`absolute inset-0 ${borderRadiusClass} bg-black/0 group-hover:bg-black/20 transition-all duration-300 items-center justify-center opacity-0 group-hover:opacity-100 z-30 pointer-events-none`}
      >
        <Surface className='px-3 py-1.5 rounded-lg bg-black/70 backdrop-blur-sm'>
          <Text as='div' className='text-white text-xs font-medium'>
            Screen Sharing Active
          </Text>
        </Surface>
      </Flex>
    </Surface>
  );
};
