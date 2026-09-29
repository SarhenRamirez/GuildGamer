export type Role = 'USER' | 'ADMIN';
export type Availability = 'AVAILABLE' | 'AWAY' | 'UNAVAILABLE';
export type SkillLevel = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'PRO';
export type Platform = 'PC' | 'PLAYSTATION' | 'XBOX' | 'NINTENDO_SWITCH' | 'MOBILE';
export type CommunicationPreference = 'TEXT' | 'VOICE' | 'BOTH';
export type SessionStatus = 'OPEN' | 'FULL' | 'IN_PROGRESS' | 'FINISHED' | 'CANCELLED';
export type SessionKind = 'CASUAL' | 'TOURNAMENT';
export type JoinMode = 'AUTOMATIC' | 'MANUAL';
export type MemberStatus = 'PENDING' | 'INVITED' | 'ACCEPTED' | 'REJECTED' | 'LEFT' | 'KICKED';
export type ReviewTag = 'GOOD_TEAMMATE' | 'GOOD_COMMUNICATION' | 'RESPECTFUL' | 'SKILLED' | 'PUNCTUAL';
export type ReportReason = 'SPAM' | 'HARASSMENT' | 'FAKE_ACCOUNT' | 'INAPPROPRIATE_CONTENT' | 'OTHER';
export type ReportStatus = 'OPEN' | 'REVIEWING' | 'RESOLVED' | 'DISMISSED';
export type PostKind = 'GENERAL' | 'CLIP' | 'ACHIEVEMENT' | 'DEBATE';

export interface UserSummary {
  id: string;
  username: string;
  avatarUrl: string | null;
}

export interface GameSummary {
  id: string;
  name: string;
  slug: string;
  coverUrl: string | null;
}

export interface Game extends GameSummary {
  genre: string;
  platforms: Platform[];
  tags: string[];
  playersCount?: number;
  openSessions?: number;
}

export interface UserGame {
  platform: Platform;
  gamerTag: string | null;
  skillLevel: SkillLevel | null;
  rank: string | null;
  role: string | null;
  isFavorite: boolean;
  game: GameSummary;
}

export interface PublicUser extends UserSummary {
  bannerUrl: string | null;
  accentColor: string | null;
  bio: string | null;
  skillLevel: SkillLevel;
  languages: string[];
  availability: Availability;
  communicationPreference: CommunicationPreference;
  role: Role;
  createdAt: string;
  isPremium: boolean;
}

export interface Me extends PublicUser {
  email: string;
  authProvider: 'LOCAL' | 'GOOGLE';
}

export interface Profile extends PublicUser {
  email?: string;
  games: UserGame[];
  reputation: { averageStars: number | null; reviewCount: number; tags: Partial<Record<ReviewTag, number>> };
  stats: { sessionsPlayed: number };
}

export interface SessionMemberView {
  status: MemberStatus;
  joinedAt: string;
  user: UserSummary & { availability?: Availability };
  gameProfile?: { rank: string | null; role: string | null; skillLevel: SkillLevel | null; gamerTag: string | null } | null;
}

export interface SessionSummary {
  id: string;
  title: string;
  description: string | null;
  platform: Platform;
  kind: SessionKind;
  mode: string | null;
  maxPlayers: number;
  skillLevel: SkillLevel;
  language: string | null;
  micRequired: boolean;
  joinMode: JoinMode;
  status: SessionStatus;
  startsAt: string;
  endsAt: string | null;
  createdAt: string;
  game: GameSummary;
  creator: UserSummary;
  playersCount: number;
  spotsLeft: number;
  matchScore?: number;
}

export interface SessionDetail extends SessionSummary {
  members: SessionMemberView[];
  pendingRequests?: SessionMemberView[];
  invited?: SessionMemberView[];
  joinInfo?: string | null;
  myStatus: MemberStatus | null;
  isCreator: boolean;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface ChatMessage {
  id: string;
  content: string;
  sessionId: string | null;
  createdAt: string;
  sender: UserSummary;
}

export interface DirectMessage {
  id: string;
  content: string;
  recipientId: string;
  readAt: string | null;
  createdAt: string;
  sender: UserSummary;
  partnerId?: string;
}

export interface Conversation {
  partner: UserSummary;
  lastMessage: DirectMessage;
  unread: number;
}

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  data: Record<string, string> | null;
  readAt: string | null;
  createdAt: string;
}

export interface Friend {
  friendshipId: string;
  since: string;
  user: UserSummary & { availability: Availability; skillLevel: SkillLevel };
  playing: { sessionId: string; title: string; kind: SessionKind; game: string } | null;
}

export interface FriendRequests {
  incoming: { id: string; createdAt: string; user: UserSummary & { availability: Availability } }[];
  outgoing: { id: string; createdAt: string; user: UserSummary & { availability: Availability } }[];
}

export interface UploadedFile {
  id: string;
  url: string;
  mimeType: string;
  sizeBytes: number;
}

export interface Post {
  id: string;
  kind: PostKind;
  game: { id: string; name: string; slug: string } | null;
  authorRank: string | null;
  content: string | null;
  createdAt: string;
  author: UserSummary;
  files: UploadedFile[];
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
}

export interface PostComment {
  id: string;
  content: string;
  createdAt: string;
  author: UserSummary;
}

export interface Review {
  id: string;
  stars: number;
  tags: ReviewTag[];
  comment: string | null;
  createdAt: string;
  author: UserSummary;
  session: { id: string; title: string; game: { name: string } };
}

export interface PendingReview {
  session: { id: string; title: string; startsAt: string; game: GameSummary };
  teammates: UserSummary[];
}

export interface VoiceParticipant {
  socketId: string;
  userId: string;
  username: string;
  muted: boolean;
  deafened: boolean;
  speaking: boolean;
}

export interface VoiceRoom {
  id: string;
  name: string;
  createdAt: string;
  owner: UserSummary;
  participants: VoiceParticipant[];
}

export interface SubscriptionInfo {
  isPremium: boolean;
  subscription: { plan: 'FREE' | 'PREMIUM'; status: string; currentPeriodEnd: string | null; createdAt: string } | null;
  payments: { id: string; amountCents: number; currency: string; status: string; provider: string; createdAt: string }[];
}

export interface Plans {
  provider: 'mock' | 'stripe';
  premium: { priceCents: number; currency: string; intervalDays: number; features: string[] };
}

export interface AdvancedStats {
  sessionsPlayed: number;
  sessionsCreated: number;
  reviewsGiven: number;
  totalHours: number;
  byGame: { game: { id: string; name: string }; sessions: number; hours: number }[];
  topTeammates: { user: UserSummary; sessions: number }[];
}
