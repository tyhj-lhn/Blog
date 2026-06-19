import { useState } from 'react';
import { MessageCircle, Globe, Mail, Calendar } from 'lucide-react';
import type { Comment } from '../types';
import CommentForm from './CommentForm';

const BORDER_COLORS = [
  'border-l-blue-400',
  'border-l-emerald-400',
  'border-l-violet-400',
  'border-l-amber-400',
  'border-l-rose-400',
  'border-l-cyan-400',
];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface CommentNodeProps {
  comment: Comment;
  onSubmitReply: (data: {
    username: string;
    email?: string;
    websiteUrl?: string;
    content: string;
    parentId?: number;
  }) => Promise<void>;
  depth: number;
}

function CommentNode({ comment, onSubmitReply, depth }: CommentNodeProps) {
  const [showReplyForm, setShowReplyForm] = useState(false);
  const borderColor = BORDER_COLORS[depth % BORDER_COLORS.length];

  const handleReply = async (data: {
    username: string;
    email?: string;
    websiteUrl?: string;
    content: string;
    parentId?: number;
  }) => {
    await onSubmitReply({ ...data, parentId: comment.id });
    setShowReplyForm(false);
  };

  return (
    <div className={`border-l-2 ${borderColor} pl-4`}>
      <div className="py-3">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-semibold text-zinc-800">{comment.username}</span>
          {comment.email && (
            <a
              href={`mailto:${comment.email}`}
              className="text-zinc-400 hover:text-blue-500 transition-colors"
              title={comment.email}
            >
              <Mail size={12} />
            </a>
          )}
          {comment.websiteUrl && (
            <a
              href={comment.websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-zinc-400 hover:text-blue-500 transition-colors"
              title={comment.websiteUrl}
            >
              <Globe size={12} />
            </a>
          )}
          <span className="text-zinc-400 flex items-center gap-1 ml-auto">
            <Calendar size={12} />
            <time dateTime={comment.createdAt}>{formatDate(comment.createdAt)}</time>
          </span>
        </div>
        <p className="mt-1 text-sm text-zinc-700 leading-relaxed whitespace-pre-wrap">
          {comment.content}
        </p>
        <button
          onClick={() => setShowReplyForm(!showReplyForm)}
          className="mt-2 inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-blue-600 transition-colors cursor-pointer min-h-11"
        >
          <MessageCircle size={12} />
          {showReplyForm ? '取消回复' : '回复'}
        </button>
        {showReplyForm && (
          <div className="mt-3">
            <CommentForm
              onSubmit={handleReply}
              parentId={comment.id}
              onCancel={() => setShowReplyForm(false)}
            />
          </div>
        )}
      </div>
      {comment.children.length > 0 && (
        <div className="space-y-0">
          {comment.children.map((child) => (
            <CommentNode
              key={child.id}
              comment={child}
              onSubmitReply={onSubmitReply}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface CommentTreeProps {
  comments: Comment[];
  onSubmitReply: (data: {
    username: string;
    email?: string;
    websiteUrl?: string;
    content: string;
    parentId?: number;
  }) => Promise<void>;
}

export default function CommentTree({ comments, onSubmitReply }: CommentTreeProps) {
  if (comments.length === 0) {
    return <p className="text-zinc-400 text-sm py-8 text-center">暂无评论，来发表第一条吧</p>;
  }

  return (
    <div className="space-y-3">
      {comments.map((comment) => (
        <CommentNode
          key={comment.id}
          comment={comment}
          onSubmitReply={onSubmitReply}
          depth={0}
        />
      ))}
    </div>
  );
}
