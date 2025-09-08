export const formatTimestamp = (date: Date): string => {
  const now = new Date();
  const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
  
  if (diffInMinutes < 1) {
    return 'Just now';
  } else if (diffInMinutes < 60) {
    return `${diffInMinutes}m ago`;
  } else if (diffInMinutes < 1440) {
    const hours = Math.floor(diffInMinutes / 60);
    return `${hours}h ago`;
  } else {
    return date.toLocaleDateString();
  }
};

export const formatMessageTime = (date: Date): string => {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

export const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
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
