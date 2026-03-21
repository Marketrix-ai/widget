import { forwardRef } from 'react';

import { cn } from '@/lib/utils';

export type VideoProps = React.VideoHTMLAttributes<HTMLVideoElement>;

export const Video = forwardRef<HTMLVideoElement, VideoProps>(function Video({ className, ...props }, ref) {
  return <video {...props} ref={ref} className={cn(className)} />;
});
