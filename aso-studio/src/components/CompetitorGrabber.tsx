import React, { useState } from 'react';
import { CompetitorInfo } from '../types';
import { Copy, Check, ExternalLink, ArrowRight, FileText, CheckCircle2 } from 'lucide-react';
import { FormattedDescriptionView } from './FormattedDescriptionView';

interface CompetitorGrabberProps {
  competitors: CompetitorInfo[];
  selectedCompetitorId: string;
  onSelectCompetitor: (comp: CompetitorInfo) => void;
  onAddNewCompetitor: (newComp: CompetitorInfo) => void;
  onNavigateToAnalysis: () => void;
}

export const CompetitorGrabber: React.FC<CompetitorGrabberProps> = ({
  competitors,
  selectedCompetitorId,
  onSelectCompetitor,
  onAddNewCompetitor,
  onNavigateToAnalysis
}) => {
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  const activeCompetitor = competitors.find(c => c.id === selectedCompetitorId) || competitors[0];

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(key);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
      
      {/* Competitor Header Info Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-5 gap-4">
        <div className="flex items-center space-x-4">
          {/* App Icon directly from Google Play Link */}
          <div className="relative shrink-0">
            <img
              src={activeCompetitor?.iconUrl}
              alt={activeCompetitor?.name}
              onError={(e) => {
                (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(activeCompetitor?.name || 'app')}`;
              }}
              className="w-14 h-14 rounded-2xl object-cover border border-slate-200/80 shadow-xs"
            />
            <span className="absolute -bottom-1 -right-1 bg-emerald-500 text-white rounded-full p-0.5 border-2 border-white">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </span>
          </div>

          <div>
            <div className="flex items-center space-x-2">
              <h2 className="font-extrabold text-slate-900 text-base">
                {activeCompetitor?.name || '未选择竞品'}
              </h2>
              <span className="text-[11px] bg-amber-50 text-amber-800 font-bold px-2 py-0.5 rounded-md border border-amber-200/60 flex items-center space-x-1">
                <span>★</span>
                <span>{activeCompetitor?.rating || 4.5}</span>
              </span>
            </div>

            <p className="text-xs text-slate-500 font-sans mt-1">
              {activeCompetitor?.category} · {activeCompetitor?.downloads} 下载量
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3 shrink-0">
          {activeCompetitor?.url && (
            <a
              href={activeCompetitor.url}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-blue-600 font-bold hover:bg-blue-50 px-3.5 py-2 rounded-xl border border-blue-200 transition flex items-center space-x-1.5"
            >
              <span>查看谷歌商店原页</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}

          <button
            onClick={onNavigateToAnalysis}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition flex items-center space-x-1.5 shadow-2xs"
          >
            <span>转到 2. 文案解析</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Copy Listing Content Sections (Clean, Flat, Standard English Typography) */}
      {activeCompetitor ? (
        <div className="space-y-6">
          
          {/* Section 1: Title */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <FileText className="w-4 h-4 text-blue-600" />
                <span className="text-xs font-bold text-slate-800">
                  英文标题 (Title)
                </span>
                <span className="text-[11px] font-mono font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                  {activeCompetitor.title.length} / 30 字符
                </span>
              </div>

              <button
                onClick={() => handleCopy(activeCompetitor.title, 'title')}
                className="text-xs text-blue-600 font-bold hover:bg-blue-50 px-2.5 py-1 rounded-lg transition border border-transparent hover:border-blue-200 flex items-center space-x-1"
              >
                {copiedSection === 'title' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-600">已复制</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>复制标题</span>
                  </>
                )}
              </button>
            </div>

            {/* Standard English Text Display */}
            <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-3.5 text-sm font-semibold text-slate-900 font-sans tracking-normal leading-normal">
              {activeCompetitor.title}
            </div>

            <p className="text-xs text-slate-500 font-normal px-1">
              中文参考: {activeCompetitor.titleZh}
            </p>
          </div>

          {/* Section 2: Short Description */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <FileText className="w-4 h-4 text-blue-600" />
                <span className="text-xs font-bold text-slate-800">
                  英文短描述 (Short Description)
                </span>
                <span className="text-[11px] font-mono font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                  {activeCompetitor.shortDescription.length} / 80 字符
                </span>
              </div>

              <button
                onClick={() => handleCopy(activeCompetitor.shortDescription, 'short')}
                className="text-xs text-blue-600 font-bold hover:bg-blue-50 px-2.5 py-1 rounded-lg transition border border-transparent hover:border-blue-200 flex items-center space-x-1"
              >
                {copiedSection === 'short' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-600">已复制</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>复制短描述</span>
                  </>
                )}
              </button>
            </div>

            {/* Standard English Text Display */}
            <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-3.5 text-xs font-medium text-slate-800 font-sans tracking-normal leading-relaxed">
              {activeCompetitor.shortDescription}
            </div>

            <p className="text-xs text-slate-500 font-normal px-1">
              中文参考: {activeCompetitor.shortDescriptionZh}
            </p>
          </div>

          {/* Section 3: Long Description */}
          <div className="pt-2 border-t border-slate-100">
            <FormattedDescriptionView
              text={activeCompetitor.longDescription}
              translatedText={activeCompetitor.longDescriptionZh}
              title="英文长描述排版与符号效果 (Long Description Preview)"
              onCopy={() => handleCopy(activeCompetitor.longDescription, 'long')}
              copied={copiedSection === 'long'}
            />
          </div>

        </div>
      ) : (
        <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
          暂无选中的竞品数据，请使用顶部「+ 批量导入竞品链接」导入。
        </div>
      )}

    </div>
  );
};
