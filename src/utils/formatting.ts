export const formatMessageTime = (date: Date): string => {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

export const getModeDisplayName = (mode: 'show' | 'tell' | 'do'): string => {
  switch (mode) {
    case 'show':
      return 'Show';
    case 'tell':
      return 'Tell';
    case 'do':
      return 'Do';
    default:
      return mode;
  }
};

export const getModeDescription = (mode: 'show' | 'tell' | 'do'): string => {
  switch (mode) {
    case 'show':
      return 'I\'ll show you how to do this';
    case 'tell':
      return 'I\'ll explain this to you';
    case 'do':
      return 'I\'ll do this for you';
    default:
      return '';
  }
};
