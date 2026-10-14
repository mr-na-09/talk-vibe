export type MessageDirection = 'incoming' | 'outgoing';

export interface ChatMessage {
  id: string;
  content: string;
  time: string;
  direction: MessageDirection;
  status?: 'sent' | 'delivered' | 'read';
}

export interface Contact {
  id: string;
  name: string;
  handle: string;
  avatar: string;
  status: 'online' | 'away' | 'offline';
  lastSeen: string;
  accent: string;
  bio: string;
}

export interface Conversation {
  id: string;
  contact: Contact;
  lastMessage: string;
  unread: number;
  muted: boolean;
  typing: boolean;
  messages: ChatMessage[];
}

export const currentUser = {
  name: 'Aisha Morgan',
  handle: 'aisha',
  userId: 'TV-8K4M2P',
  avatar: 'AM',
  accent: 'from-indigo-500 to-violet-500',
};

export const contacts: Contact[] = [
  {
    id: 'leo',
    name: 'Leo Martins',
    handle: '@leo',
    avatar: 'LM',
    status: 'online',
    lastSeen: 'online now',
    accent: 'from-emerald-500 to-cyan-500',
    bio: 'Product designer shipping polished digital experiences.',
  },
  {
    id: 'sana',
    name: 'Sana Khan',
    handle: '@sana',
    avatar: 'SK',
    status: 'away',
    lastSeen: 'last active 6m ago',
    accent: 'from-fuchsia-500 to-pink-500',
    bio: 'Growth lead focused on community and retention.',
  },
  {
    id: 'marcus',
    name: 'Marcus Lee',
    handle: '@marcus',
    avatar: 'ML',
    status: 'offline',
    lastSeen: 'offline for 1h',
    accent: 'from-amber-500 to-orange-500',
    bio: 'Frontend engineer shipping resilient UI systems.',
  },
  {
    id: 'noor',
    name: 'Noor Ahmad',
    handle: '@noor',
    avatar: 'NA',
    status: 'online',
    lastSeen: 'online now',
    accent: 'from-violet-500 to-indigo-500',
    bio: 'Customer success and onboarding specialist.',
  },
];

export const conversations: Conversation[] = [
  {
    id: 'leo',
    contact: contacts[0],
    lastMessage: 'The launch deck is ready for review around 3 PM.',
    unread: 2,
    muted: false,
    typing: true,
    messages: [
      { id: 'm1', content: 'Morning! Want to sync on the launch plan?', time: '09:12', direction: 'incoming' },
      { id: 'm2', content: 'Absolutely. I can review the deck after lunch.', time: '09:14', direction: 'outgoing', status: 'read' },
      { id: 'm3', content: 'Perfect. I also shared the notes for the onboarding flow.', time: '09:15', direction: 'incoming' },
      { id: 'm4', content: 'The launch deck is ready for review around 3 PM.', time: '09:17', direction: 'incoming' },
    ],
  },
  {
    id: 'sana',
    contact: contacts[1],
    lastMessage: 'I booked the community call for Friday morning.',
    unread: 0,
    muted: false,
    typing: false,
    messages: [
      { id: 'm5', content: 'I booked the community call for Friday morning.', time: 'Yesterday', direction: 'incoming' },
      { id: 'm6', content: 'Great, I will prepare the welcome sequence.', time: 'Yesterday', direction: 'outgoing', status: 'read' },
    ],
  },
  {
    id: 'marcus',
    contact: contacts[2],
    lastMessage: 'Can we recheck the API contract before the release?',
    unread: 4,
    muted: true,
    typing: false,
    messages: [
      { id: 'm7', content: 'Can we recheck the API contract before the release?', time: 'Mon', direction: 'incoming' },
      { id: 'm8', content: 'Yes, let’s align the payload after the migration.', time: 'Mon', direction: 'outgoing', status: 'delivered' },
    ],
  },
  {
    id: 'noor',
    contact: contacts[3],
    lastMessage: 'Thanks for the updated handshake copy.',
    unread: 1,
    muted: false,
    typing: false,
    messages: [
      { id: 'm9', content: 'Thanks for the updated handshake copy.', time: 'Sun', direction: 'incoming' },
      { id: 'm10', content: 'Of course — I’ll share the final version shortly.', time: 'Sun', direction: 'outgoing', status: 'read' },
    ],
  },
];

export const friendRequests = [
  { id: 'fr-1', name: 'Evelyn Park', handle: '@evelyn', avatar: 'EP', accent: 'from-pink-500 to-rose-500', status: 'pending' },
  { id: 'fr-2', name: 'Milo Wright', handle: '@milo', avatar: 'MW', accent: 'from-cyan-500 to-blue-500', status: 'pending' },
];

export const notifications = [
  { id: 'n1', title: 'New friend request', description: 'Evelyn Park wants to connect', time: '2m ago' },
  { id: 'n2', title: 'Unread messages', description: '3 conversations need your attention', time: '18m ago' },
  { id: 'n3', title: 'System update', description: 'Two-factor security checks have been enabled', time: '1h ago' },
];

export const stats = [
  { label: 'Active chats', value: '14' },
  { label: 'Unread', value: '7' },
  { label: 'Response time', value: '1m 32s' },
];
