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
