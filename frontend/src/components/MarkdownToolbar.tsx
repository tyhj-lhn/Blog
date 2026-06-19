import {
  Bold,
  Italic,
  Heading,
  Strikethrough,
  Link,
  Image,
  Code,
  FileCode,
  Quote,
  List,
  ListOrdered,
  Minus,
} from 'lucide-react';

export interface MarkdownAction {
  type: 'wrap';
  before: string;
  after: string;
  placeholder: string;
}

interface MarkdownToolbarProps {
  onAction: (action: MarkdownAction) => void;
}

interface ToolbarButton {
  icon: React.ComponentType<{ size?: number }>;
  label: string;
  action: MarkdownAction;
}

const BUTTONS: ToolbarButton[] = [
  {
    icon: Bold,
    label: '粗体 (Ctrl+B)',
    action: { type: 'wrap', before: '**', after: '**', placeholder: '粗体' },
  },
  {
    icon: Italic,
    label: '斜体 (Ctrl+I)',
    action: { type: 'wrap', before: '*', after: '*', placeholder: '斜体' },
  },
  {
    icon: Heading,
    label: '标题',
    action: { type: 'wrap', before: '## ', after: '', placeholder: '标题' },
  },
  {
    icon: Strikethrough,
    label: '删除线',
    action: { type: 'wrap', before: '~~', after: '~~', placeholder: '删除线' },
  },
  {
    icon: Link,
    label: '链接',
    action: { type: 'wrap', before: '[', after: '](url)', placeholder: '链接文字' },
  },
  {
    icon: Image,
    label: '图片',
    action: { type: 'wrap', before: '![', after: '](url)', placeholder: '图片描述' },
  },
  {
    icon: Code,
    label: '行内代码',
    action: { type: 'wrap', before: '`', after: '`', placeholder: '代码' },
  },
  {
    icon: FileCode,
    label: '代码块',
    action: { type: 'wrap', before: '\n```\n', after: '\n```\n', placeholder: '代码块' },
  },
  {
    icon: Quote,
    label: '引用',
    action: { type: 'wrap', before: '\n> ', after: '', placeholder: '引用' },
  },
  {
    icon: List,
    label: '无序列表',
    action: { type: 'wrap', before: '\n- ', after: '', placeholder: '' },
  },
  {
    icon: ListOrdered,
    label: '有序列表',
    action: { type: 'wrap', before: '\n1. ', after: '', placeholder: '' },
  },
  {
    icon: Minus,
    label: '分割线',
    action: { type: 'wrap', before: '\n---\n', after: '', placeholder: '' },
  },
];

export default function MarkdownToolbar({ onAction }: MarkdownToolbarProps) {
  return (
    <div
      className="flex flex-wrap items-center gap-0.5 border border-zinc-200 border-b-0 rounded-t-lg bg-zinc-50 px-1.5 py-1"
      role="toolbar"
      aria-label="Markdown 格式工具栏"
    >
      {BUTTONS.map((btn) => {
        const Icon = btn.icon;
        return (
          <button
            key={btn.label}
            type="button"
            title={btn.label}
            aria-label={btn.label}
            onClick={() => onAction(btn.action)}
            className="min-w-9 min-h-9 flex items-center justify-center rounded text-zinc-500 hover:text-zinc-800 hover:bg-zinc-200/80 transition-colors cursor-pointer"
          >
            <Icon size={15} />
          </button>
        );
      })}
    </div>
  );
}
