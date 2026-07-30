import React from 'react';
import { Sparkles } from 'lucide-react';

interface NavbarProps {
  onOpenGuide?: () => void;
  onOpenSuggestions?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenGuide,
  onOpenSuggestions
}) => {
  return (
    <header className="bg-white border-b border-slate-200 text-slate-800 sticky top-0 z-40 h-[64px] shadow-2xs">
      <div className="h-full px-6 flex items-center justify-between max-w-[1920px] mx-auto">
        
        {/* Left Big Title Banner: "初版文案直出" */}
        <div className="flex items-center space-x-3.5">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white font-black text-sm shadow-2xs shrink-0">
            ASO
          </div>

          <div className="flex items-center space-x-3">
            <h1 className="font-extrabold text-lg text-slate-900 tracking-tight">
              初版文案直出
            </h1>
            <span className="px-2.5 py-0.5 bg-blue-50 text-blue-700 font-mono font-bold text-xs rounded-full border border-blue-100 hidden sm:inline-block">
              Google Play 美区 ASO-X 引擎
            </span>
          </div>
        </div>

        {/* Right side is intentionally empty as requested ("这些文字右侧是空的, 除了名字不放东西") */}
        <div className="flex items-center space-x-3">
          {onOpenGuide && (
            <button
              onClick={onOpenGuide}
              className="px-3 py-1.5 text-xs font-semibold text-slate-500 hover:text-blue-600 transition"
            >
              算法指南
            </button>
          )}
          {onOpenSuggestions && (
            <button
              onClick={onOpenSuggestions}
              className="px-3 py-1.5 text-xs font-semibold text-slate-500 hover:text-blue-600 transition"
            >
              系统建议
            </button>
          )}
        </div>

      </div>
    </header>
  );
};
