// ---- Shared API response types ----

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  totalPages: number;
}

export interface ApiError {
  error: { code: string; message: string; details?: unknown };
}

// ---- User ----

export interface User {
  id: number;
  username: string;
  email: string;
  role: 'ADMIN';
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

// ---- Post ----

export type PostStatus = 'DRAFT' | 'PUBLISHED';

export interface PostSummary {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  coverImage: string | null;
  status: PostStatus;
  tags: string[];
  viewCount: number;
  likeCount: number;
  createdAt: string;
  author: { id: number; username: string };
  _count: { comments: number };
}

export interface Post extends PostSummary {
  content: string;
  updatedAt: string;
}

// ---- Comment ----

export interface Comment {
  id: number;
  content: string;
  postId: number;
  username: string;
  email: string | null;
  websiteUrl: string | null;
  parentId: number | null;
  createdAt: string;
  depth: number;
  children: Comment[];
}

// ---- Tag ----

export interface Tag {
  tag: string;
  count: number;
}

// ---- Guestbook ----

export interface GuestbookEntry {
  id: number;
  nickname: string;
  message: string;
  createdAt: string;
}

// ---- Admin ----

export interface AdminStats {
  totalPosts: number;
  publishedPosts: number;
  draftPosts: number;
  totalComments: number;
  totalGuestbook: number;
  recentPosts: Pick<PostSummary, 'id' | 'title' | 'slug' | 'coverImage' | 'status' | 'viewCount' | 'createdAt'>[];
  recentComments: (Pick<Comment, 'id' | 'content' | 'username' | 'createdAt'> & {
    post: { id: number; title: string };
  })[];
}

export interface AdminComment {
  id: number;
  content: string;
  username: string;
  email: string | null;
  postId: number;
  post: { id: number; title: string };
  createdAt: string;
}

export interface Wallpaper {
  id: number;
  type: 'image' | 'video';
  url: string;
  updatedAt: string;
}

export interface UploadedFile {
  filename: string;
  url: string;
  type: 'image' | 'video';
  size: number;
  modifiedAt: string;
}
