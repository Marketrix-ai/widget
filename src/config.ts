export const API_URL_GLOBAL_SET = {
  API_END_POINT: typeof window !== 'undefined' && window.location.hostname === 'localhost'
    ? 'http://localhost:8080'
    : 'https://api.marketrix.com',
};
