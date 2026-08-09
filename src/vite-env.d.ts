interface DisplayMediaStreamOptions {
  video?: boolean | MediaTrackConstraints;
  audio?: boolean | MediaTrackConstraints;
  preferCurrentTab?: boolean;
}

declare module '*.css?inline' {
  const content: string;
  export default content;
}
