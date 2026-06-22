import { ShieldAlert } from 'lucide-react';

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="select-none cursor-default bg-zinc-900 text-zinc-400 text-sm">
      <div className="max-w-4xl mx-auto px-4 py-10">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Left: copyright */}
          <div className="flex items-center gap-2 text-zinc-500">
            <span className="font-logo text-base text-zinc-300">MemoryStory</span>
            <span>© {year}</span>
          </div>

          {/* Center: disclaimer */}
          <div className="flex items-start gap-2 max-w-md text-center md:text-left">
            <ShieldAlert size={16} className="shrink-0 mt-0.5 text-zinc-500" />
            <p className="text-zinc-500 leading-relaxed">
              本站为个人博客，所有文章仅代表作者个人观点，与任何机构无关。
              转载文章版权归原作者所有，如有侵权请联系删除。
            </p>
          </div>

          {/* Right: ICP filing */}
          <div className="text-center md:text-right space-y-1">
            <p className="text-zinc-500">
              <a
                href="https://beian.miit.gov.cn/"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-zinc-300 transition-colors"
              >
                ICP备案号：待备案
              </a>
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
