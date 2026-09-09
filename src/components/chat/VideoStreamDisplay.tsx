/**
 * Inline screen-share viewport for a chat message: a live MediaStream rendered as a muted,
 * auto-playing <video>, with a loading overlay, a failure overlay, a "Live" pill and a persistent
 * "Screen Sharing Active" banner.
 *
 * `Overlay` is the centred full-bleed scrim carrying a spinner or icon above a caption, shared by the
 * loading and failure states; `VideoStreamDisplay` binds the stream, tracks loaded/failed and layers
 * the rest over it.
 *
 * The bind effect is keyed on `stream`: a replacement clears both flags and rebinds the
 * `loadedmetadata`/`error` listeners, and cleanup nulls `srcObject` so a stopped stream is not
 * retained. `play()` rejecting with AbortError is exactly that replacement racing the previous play —
 * the one benign rejection; anything else is logged with its error and surfaced as the failure
 * overlay. `muted` + `autoPlay` is what makes autoplay legal without a user gesture, and `playsInline`
 * stops iOS Safari taking the stream fullscreen over the host page. The video stays mounted at
 * opacity 0 while loading, since unmounting it leaves nothing for `loadedmetadata` to fire on.
 *
 * Corners are rounded on top only because `MessageItem` collapses the bubble padding to 0 for a video
 * message, so this sits flush in the bubble's top corners. Stacking is deliberate — overlays 10, Live
 * pill 20, banner 30 — and the banner is `pointerEvents: 'none'` so its full-bleed wrapper never
 * swallows clicks meant for the message.
 */
import React, { useEffect, useRef, useState } from 'react';

import { Flex } from '../base/Flex';
import { Icon } from '../base/Icon';
import { Spinner } from '../base/Spinner';
import { Surface } from '../base/Surface';
import { Text } from '../base/Text';

interface VideoStreamDisplayProps {
  stream: MediaStream;
}

const TOP_RADIUS = '8px';
const OVERLAY_BORDER_RADIUS = `${TOP_RADIUS} ${TOP_RADIUS} 0 0`;
const OVERLAY_BG = '#111827';
const MUTED_TEXT_COLOR = 'rgba(255,255,255,0.7)';

const Overlay: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <Flex
    position='absolute'
    inset='0'
    align='center'
    justify='center'
    style={{ backgroundColor: OVERLAY_BG, borderRadius: OVERLAY_BORDER_RADIUS, zIndex: 10 }}
  >
    <Flex direction='column' align='center' gap='md' style={{ textAlign: 'center', padding: '0 16px' }}>
      {children}
      <Text as='span' size='xs' weight='medium' style={{ color: MUTED_TEXT_COLOR }}>
        {label}
      </Text>
    </Flex>
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
        backgroundColor: '#000000',
        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)',
      }}
    >
      {!isLoaded && !hasError && (
        <Overlay label='Loading stream...'>
          <Spinner size='lg' style={{ color: 'white' }} />
        </Overlay>
      )}

      {hasError && (
        <Overlay label='Failed to load stream'>
          <Icon name='alertCircle' size={32} style={{ color: '#9ca3af' }} />
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
          background: 'linear-gradient(135deg, #111827 0%, #374151 100%)',
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
              rounded='pill'
              animate='ping'
              style={{ width: '8px', height: '8px', backgroundColor: 'white', opacity: 0.75 }}
            />
            <Surface
              position='relative'
              rounded='pill'
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
