interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_AGENT_SERVER_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

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
