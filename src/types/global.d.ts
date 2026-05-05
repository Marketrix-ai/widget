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
}

// Export empty object to make this a module
export {};
