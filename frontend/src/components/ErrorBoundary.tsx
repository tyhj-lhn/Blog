import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-zinc-50 flex items-center justify-center px-4">
          <div className="max-w-md text-center">
            <h1 className="font-heading text-3xl text-zinc-800 mb-4">
              哎呀，出错了
            </h1>
            <p className="text-zinc-500 mb-6 leading-relaxed">
              页面遇到了一点问题。请尝试刷新页面，或者返回首页。
            </p>
            <div className="flex items-center justify-center gap-4">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors cursor-pointer text-sm"
              >
                刷新页面
              </button>
              <a
                href="/"
                className="px-5 py-2.5 border border-zinc-300 text-zinc-700 rounded-lg hover:bg-zinc-100 transition-colors text-sm"
              >
                返回首页
              </a>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
