// Extend DisplayMediaStreamOptions to include preferCurrentTab
interface DisplayMediaStreamOptions {
  video?: boolean | MediaTrackConstraints;
  audio?: boolean | MediaTrackConstraints;
  preferCurrentTab?: boolean;
}

// Allow importing CSS as a string for Shadow DOM style injection
declare module '*.css?inline' {
  const content: string;
  export default content;
}
