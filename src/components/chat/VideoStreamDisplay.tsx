import React, { useEffect, useRef, useState } from 'react';

import { Flex } from '../base/Flex';
import { Icon } from '../base/Icon';
import { Spinner } from '../base/Spinner';
import { Surface } from '../base/Surface';
import { Text } from '../base/Text';
import { Video } from '../base/Video';

interface VideoStreamDisplayProps {
  stream: MediaStream | null;
}

// Top corners are always rounded; match message bubble shape
const TOP_RADIUS = '8px';
const OVERLAY_BORDER_RADIUS = `${TOP_RADIUS} ${TOP_RADIUS} 0 0`;
const OVERLAY_BG = '#111827';
const MUTED_TEXT_COLOR = 'rgba(255,255,255,0.7)';

export const VideoStreamDisplay: React.FC<VideoStreamDisplayProps> = ({ stream }) => {
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

  return (
    <Surface
      width='full'
      overflow='hidden'
      position='relative'
      style={{
        marginBottom: '4px',
        borderRadius: OVERLAY_BORDER_RADIUS,
        backgroundColor: '#000000',
        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)',
      }}
    >
      {/* Loading overlay */}
      {!isLoaded && !hasError && (
        <Flex
          position='absolute'
          inset='0'
          align='center'
          justify='center'
          style={{
            backgroundColor: OVERLAY_BG,
            borderRadius: OVERLAY_BORDER_RADIUS,
            zIndex: 10,
            transition: 'opacity 300ms',
            opacity: isLoaded ? 0 : 1,
          }}
        >
          <Flex direction='column' align='center' gap='md'>
            <Spinner size='lg' style={{ color: 'white' }} />
            <Text as='span' size='xs' weight='medium' style={{ color: MUTED_TEXT_COLOR }}>
              Loading stream...
            </Text>
          </Flex>
        </Flex>
      )}

      {/* Error overlay */}
      {hasError && (
        <Flex
          position='absolute'
          inset='0'
          align='center'
          justify='center'
          style={{
            backgroundColor: OVERLAY_BG,
            borderRadius: OVERLAY_BORDER_RADIUS,
            zIndex: 10,
          }}
        >
          <Flex
            direction='column'
            align='center'
            gap='md'
            style={{ textAlign: 'center', paddingLeft: '16px', paddingRight: '16px' }}
          >
            <Icon name='alertCircle' size={32} style={{ color: '#9ca3af' }} />
            <Text as='span' size='xs' weight='medium' style={{ color: MUTED_TEXT_COLOR }}>
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
        style={{
          width: '100%',
          height: 'auto',
          maxHeight: '192px',
          objectFit: 'contain',
          borderRadius: OVERLAY_BORDER_RADIUS,
          transition: 'opacity 500ms',
          opacity: isLoaded ? 1 : 0,
          minHeight: '120px',
          background: 'linear-gradient(135deg, #111827 0%, #374151 100%)',
        }}
      />

      {/* Live indicator badge */}
      {isLoaded && !hasError && (
        <Flex
          position='absolute'
          align='center'
          gap='sm'
          animate='fadeIn'
          style={{
            top: '8px',
            right: '8px',
            padding: '4px 8px',
            borderRadius: '9999px',
            backgroundColor: 'rgba(55,65,81,0.9)',
            backdropFilter: 'blur(4px)',
            zIndex: 20,
            boxShadow: '0 2px 8px rgba(31, 41, 55, 0.4)',
          }}
        >
          <Flex position='relative' align='center' justify='center'>
            <Surface
              position='absolute'
              rounded='full'
              animate='ping'
              style={{ width: '8px', height: '8px', backgroundColor: 'white', opacity: 0.75 }}
            />
            <Surface
              position='relative'
              rounded='full'
              style={{ width: '6px', height: '6px', backgroundColor: 'white' }}
            />
          </Flex>
          <Text
            as='span'
            size='xs'
            weight='semibold'
            style={{ color: 'white', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '10px' }}
          >
            Live
          </Text>
        </Flex>
      )}

      {/* Hover overlay with info */}
      <Flex
        position='absolute'
        inset='0'
        align='center'
        justify='center'
        style={{
          borderRadius: OVERLAY_BORDER_RADIUS,
          backgroundColor: 'rgba(0,0,0,0)',
          zIndex: 30,
          pointerEvents: 'none',
        }}
      >
        <Surface
          rounded='lg'
          style={{
            padding: '4px 12px',
            backgroundColor: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(4px)',
          }}
        >
          <Text as='div' size='xs' weight='medium' style={{ color: 'white' }}>
            Screen Sharing Active
          </Text>
        </Surface>
      </Flex>
    </Surface>
  );
};
