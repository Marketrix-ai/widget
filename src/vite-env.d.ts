// Extend DisplayMediaStreamOptions to include preferCurrentTab
interface DisplayMediaStreamOptions {
  video?: boolean | MediaTrackConstraints;
  audio?: boolean | MediaTrackConstraints;
  preferCurrentTab?: boolean;
}

declare const __BUILD_COMMIT__: string;

// Allow importing CSS as a string for Shadow DOM style injection
declare module '*.css?inline' {
  const content: string;
  export default content;
}
