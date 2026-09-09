/**
 * Ambient types the bundle needs: `preferCurrentTab` on `DisplayMediaStreamOptions` (not yet in lib.dom),
 * the `?inline` CSS import the Shadow DOM stylesheet is loaded through, and `.svg` asset imports.
 */
interface DisplayMediaStreamOptions {
  video?: boolean | MediaTrackConstraints;
  audio?: boolean | MediaTrackConstraints;
  preferCurrentTab?: boolean;
}

declare module '*.css?inline' {
  const content: string;
  export default content;
}

declare module '*.svg' {
  const value: string;
  export default value;
}
