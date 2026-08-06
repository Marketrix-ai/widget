interface DisplayMediaStreamOptions {
  video?: boolean | MediaTrackConstraints;
  audio?: boolean | MediaTrackConstraints;
  preferCurrentTab?: boolean;
}

declare const __BUILD_COMMIT__: string;

// Backs the Shadow DOM style injection in bootstrap.tsx.
declare module '*.css?inline' {
  const content: string;
  export default content;
}
