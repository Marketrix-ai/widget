import React, { useEffect, useRef } from 'react';

interface ScreenSharePreviewProps {
  stream: MediaStream | null;
  isVisible: boolean;
  onClose: () => void;
}

export const ScreenSharePreview: React.FC<ScreenSharePreviewProps> = ({
  stream,
  isVisible,
  onClose,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      // Ensure the video plays after setting the stream
      videoRef.current.play().catch(console.error);
    }
  }, [stream]);

  if (!isVisible || !stream) return null;

  return (
    <div className="fixed top-4 right-4 w-80 h-60 bg-black rounded-lg shadow-xl border border-gray-300 overflow-hidden z-50">
      <div className="relative w-full h-full">
        {/* Video element */}
        <video
          ref={videoRef}
          autoPlay
          muted
          className="w-full h-full object-cover"
        />
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600 transition-colors"
          aria-label="Close screen preview"
        >
          ×
        </button>
      </div>
    </div>
  );
};
