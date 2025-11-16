// Express types for file uploads
declare global {
  namespace Express {
    namespace Multer {
      interface File {
        fieldname: string;
        originalname: string;
        encoding: string;
        mimetype: string;
        size: number;
        destination: string;
        filename: string;
        path: string;
        buffer: Buffer;
      }
    }
    interface Request {
      file?: Multer.File;
      files?: { [fieldname: string]: Multer.File[] } | Multer.File[];
    }
  }

  // Window extensions for demo API and screen capture
  interface Window {
    currentDemoContext?: string;
    stepGuideNext?: (event?: Event) => void;
    stepGuidePrev?: (event?: Event) => void;
    screenCaptureStream?: MediaStream;
    screenCaptureOverlay?: HTMLElement;
  }

  // Navigator extensions for media devices
  interface Navigator {
    mediaDevices: MediaDevices;
  }

  // Document extensions for vendor-specific fullscreen properties
  interface Document {
    webkitFullscreenElement?: Element;
    mozFullScreenElement?: Element;
    msFullscreenElement?: Element;
  }

  // HTMLElement extensions for step guide functionality
  interface HTMLElement {
    stepSpotlight?: HTMLElement;
    stepBorder?: HTMLElement;
    spotlightResizeHandler?: () => void;
    spotlightScrollHandler?: () => void;
    textResizeObserver?: ResizeObserver;
    stepDescriptionText?: HTMLElement;
    textResizeHandler?: () => void;
    textScrollHandler?: () => void;
    updateTextPosition?: () => void;
    textPeriodicCheck?: ReturnType<typeof setInterval>; // Timer ID
    currentStep?: {
      step_number: number;
      action: string;
      element: string;
      text: string;
    };
    _tourClickHandler?: (e: Event) => void;
  }
}

// Export empty object to make this a module
export {};
