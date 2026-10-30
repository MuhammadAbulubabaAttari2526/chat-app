export const initials = (name = '') => name.slice(0, 2).toUpperCase();

export function avatarColor(name = '') {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return `hsl(${h} 38% 40%)`;
}

const sameDay = (a, b) => a.toDateString() === b.toDateString();

export function formatTime(date) {
  return new Date(date).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function formatDayLabel(date) {
  const d = new Date(date);
  const now = new Date();
  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);
  if (sameDay(d, now)) return 'Today';
  if (sameDay(d, yesterday)) return 'Yesterday';
  return d.toLocaleDateString([], {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric',
  });
}

// For the conversation list: time today, "Yesterday", else short date
export function formatListTime(date) {
  const d = new Date(date);
  const now = new Date();
  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);
  if (sameDay(d, now)) return formatTime(d);
  if (sameDay(d, yesterday)) return 'Yesterday';
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function formatLastSeen(date) {
  if (!date) return 'offline';
  const d = new Date(date);
  const now = new Date();
  const mins = Math.floor((now - d) / 60000);
  if (mins < 1) return 'last seen just now';
  if (mins < 60) return `last seen ${mins} min ago`;
  if (sameDay(d, now)) return `last seen today at ${formatTime(d)}`;
  return `last seen ${formatListTime(d)} at ${formatTime(d)}`;
}

export const statusRank = { sending: 0, failed: 0, sent: 1, delivered: 2, read: 3 };
