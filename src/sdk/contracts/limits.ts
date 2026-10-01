/**
 * Numeric caps and the http(s) URL rules (`isHttpUrl`, `normalizeApplicationUrl`) shared by the api and its consumers.
 * Zod-free, so meet, the app and PersonaOS import the api's own values without putting zod in a browser bundle.
 */

export const ANSWER_TEXT_MAX_LENGTH = 10_000;
export const SELECTION_MAX_ITEMS = 64;
export const SELECTION_ITEM_MAX_LENGTH = 256;
export const PASSWORD_MAX_LENGTH = 256;
export const SURVEY_PASSWORD_MIN_LENGTH = 4;
export const HEATMAP_VIEWPORT_MIN_WIDTH = { tablet: 640, desktop: 1024 } as const;
export const SUBMISSION_ANSWER_MAX_COUNT = 200;
export const RATING_SCALE_MAX_SPAN = 100;
export const EMAIL_MAX_LENGTH = 255;
export const PAGE_SIZE_MAX = 200;

export const CHANGE_NOTE_MAX_LENGTH = 300;
export const RESEARCH_QUESTION_MAX_LENGTH = 2000;
export const SHORT_TEXT_MAX_LENGTH = 2000;
export const LONG_TEXT_MAX_LENGTH = 10_000;
export const BIG5_SCORE_MIN = 0;
export const BIG5_SCORE_MAX = 100;
export const APPLICATION_PERSONA_GENERATE_MAX_COUNT = 10;
export const PERSONA_LIBRARY_IMPORT_MAX = 10;
export const PERSONA_CANDIDATES_MAX = 50;
export const MAX_RIDER_PERSONA_USERS = 50;

export const MAX_SIMULATION_STEPS = 1000;
export const DEFAULT_SIMULATION_STEPS = 100;
export const EXPERIENCE_LEVEL_MIN = 1;
export const EXPERIENCE_LEVEL_MAX = 5;
export const DEFAULT_EXPERIENCE_LEVEL = 5;

export const NOTIFICATION_DELAY_MINUTES_MIN = 1;
export const NOTIFICATION_DELAY_MINUTES_MAX = 120;

export const AGENT_DISPATCH_IDLE_TIMEOUT_MS = 300_000;

export const INTERNAL_SIGNUP_RANGES = ['24h', '7d', '30d', '1y'] as const;
export const INTERNAL_SIGNUP_USERS_LIMIT = 100;
export const INTERNAL_OPERATIONS_PAGE_SIZE = 25;
export const INTERNAL_JOB_SIMULATIONS_LIMIT = 100;
export const INTERNAL_JOB_QA_RUNS_LIMIT = 50;

export const MAX_REQUEST_BODY_BYTES = 100 * 1024 * 1024;
export const IMPORT_MAX_FILES = 20;
export const IMPORT_MAX_URLS = 20;

export const DOCUMENT_EXTENSION_MIME: Readonly<Record<string, string>> = Object.freeze({
  '.pdf': 'application/pdf',
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.markdown': 'text/markdown',
  '.csv': 'text/csv',
  '.html': 'text/html',
  '.htm': 'text/html',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.json': 'application/json',
});

export const CHAT_ATTACHMENT_EXTENSION_MIME: Readonly<Record<string, string>> = Object.freeze({
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  ...DOCUMENT_EXTENSION_MIME,
});

export const IMPORT_MATERIAL_ACCEPT = [...Object.keys(DOCUMENT_EXTENSION_MIME), '.zip'].join(',');
export const CHAT_ATTACHMENT_ACCEPT = Object.keys(CHAT_ATTACHMENT_EXTENSION_MIME).join(',');

export const isHttpUrl = (value: string, base?: string): boolean => {
  try {
    return ['http:', 'https:'].includes(new URL(value, base).protocol);
  } catch (error) {
    if (error instanceof TypeError) return false;
    throw error;
  }
};

export const normalizeApplicationUrl = (url: string): string => {
  const trimmed = url.trim();
  return !trimmed || /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
};
