/**
 * Inline screen-share viewport for a chat message: a live MediaStream shown as a muted, auto-playing
 * video, with a loading overlay, a failure overlay, a "Live" pill and a persistent banner. `Overlay` is
 * the shared centred scrim used by both the loading and failure states.
 *
 * The video rebinds whenever `stream` changes, clearing the loaded/failed flags and nulling `srcObject`
 * on cleanup so a stopped stream isn't retained. A benign `play()` abort (a replacement racing the
 * previous play) is ignored; any other playback error surfaces as the failure overlay. The video stays
 * mounted at zero opacity while loading rather than being removed, so it can still fire its load event.
 * The viewport always sits on a fixed dark background regardless of tenant theme.
 */
import React, { useEffect, useRef, useState } from 'react';

import { Flex, Stack } from '../base/Flex';
import { Icon } from '../base/Icon';
import { LiveDot } from '../base/LiveDot';
import { Spinner } from '../base/Spinner';
import { Surface } from '../base/Surface';
import { Text } from '../base/Text';

interface VideoStreamDisplayProps {
  stream: MediaStream;
}

const TOP_RADIUS = '8px';
const OVERLAY_BORDER_RADIUS = `${TOP_RADIUS} ${TOP_RADIUS} 0 0`;
const OVERLAY_BG = 'var(--overlay-dark)';
const MUTED_TEXT_COLOR = 'rgba(255,255,255,0.7)';
const VIDEO_WHITE = '#ffffff';
const VIDEO_SURFACE_BLACK = '#000000';
const VIDEO_CARD_SHADOW = '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)';
const VIDEO_ERROR_ICON_COLOR = '#9ca3af';
const LIVE_PILL_BG = 'rgba(55,65,81,0.9)';
const CAPTION_BG = 'rgba(0,0,0,0.7)';
const VIDEO_LOADING_GRADIENT_STOP = '#374151';

const Overlay: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <Flex
    position='absolute'
    inset='0'
    align='center'
    justify='center'
    style={{ backgroundColor: OVERLAY_BG, borderRadius: OVERLAY_BORDER_RADIUS, zIndex: 10 }}
  >
    <Stack align='center' gap='md' style={{ textAlign: 'center', padding: '0 16px' }}>
      {children}
      <Text as='span' size='xs' weight='medium' style={{ color: MUTED_TEXT_COLOR }}>
        {label}
      </Text>
    </Stack>
  </Flex>
);

export const VideoStreamDisplay: React.FC<VideoStreamDisplayProps> = ({ stream }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    setIsLoaded(false);
    setHasError(false);

    video.srcObject = stream;

    const handleLoadedMetadata = () => {
      setIsLoaded(true);
    };

    const handleError = () => {
      setHasError(true);
      setIsLoaded(false);
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('error', handleError);

    video.play().catch(error => {
      if (error instanceof Error && error.name !== 'AbortError') {
        console.error('Error playing video stream:', error);
        setHasError(true);
      }
    });

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('error', handleError);
      video.srcObject = null;
    };
  }, [stream]);

  return (
    <Surface
      width='full'
      overflow='hidden'
      position='relative'
      style={{
        marginBottom: '4px',
        borderRadius: OVERLAY_BORDER_RADIUS,
        backgroundColor: VIDEO_SURFACE_BLACK,
        boxShadow: VIDEO_CARD_SHADOW,
      }}
    >
      {!isLoaded && !hasError && (
        <Overlay label='Loading stream...'>
          <Spinner size='lg' style={{ color: VIDEO_WHITE }} />
        </Overlay>
      )}

      {hasError && (
        <Overlay label='Failed to load stream'>
          <Icon name='alertCircle' size={32} style={{ color: VIDEO_ERROR_ICON_COLOR }} />
        </Overlay>
      )}

      <video
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
          background: `linear-gradient(135deg, var(--overlay-dark) 0%, ${VIDEO_LOADING_GRADIENT_STOP} 100%)`,
        }}
      />

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
            borderRadius: 'var(--radius-pill)',
            backgroundColor: LIVE_PILL_BG,
            backdropFilter: 'blur(4px)',
            zIndex: 20,
            boxShadow: '0 2px 8px var(--foreground-faint)',
          }}
        >
          <LiveDot style={{ color: VIDEO_WHITE }} />
          <Text
            as='span'
            size='xs'
            weight='semibold'
            style={{ color: VIDEO_WHITE, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '10px' }}
          >
            Live
          </Text>
        </Flex>
      )}

      <Flex
        position='absolute'
        inset='0'
        align='center'
        justify='center'
        style={{
          borderRadius: OVERLAY_BORDER_RADIUS,
          backgroundColor: 'transparent',
          zIndex: 30,
          pointerEvents: 'none',
        }}
      >
        <Surface
          rounded='lg'
          style={{
            padding: '4px 12px',
            backgroundColor: CAPTION_BG,
            backdropFilter: 'blur(4px)',
          }}
        >
          <Text as='div' size='xs' weight='medium' style={{ color: VIDEO_WHITE }}>
            Screen Sharing Active
          </Text>
        </Surface>
      </Flex>
    </Surface>
  );
};
