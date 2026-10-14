export type UserStatus = 'online' | 'away' | 'offline';

export interface Profile {
  id: string;
  display_name: string;
  username: string;
  user_id: string;
  avatar_url?: string;
  bio?: string;
  created_at: string;
  status: UserStatus;
}

export interface FriendRequest {
  id: string;
  requester_id: string;
  receiver_id: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  read_at?: string;
}

export interface ConversationSummary {
  id: string;
  participant_ids: string[];
  updated_at: string;
  last_message?: string;
  unread_count: number;
}
