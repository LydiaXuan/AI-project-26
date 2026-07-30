import React, { useState } from 'react';
import { CompetitorInfo, Project } from '../types';
import { Plus, Link, Trash2, Check, ExternalLink, Sparkles, Layers, Star, Layers3, CheckSquare, Square, FileText, BarChart2 } from 'lucide-react';

interface RightDataPanelProps {
  activeProject: Project;
  selectedCompetitorId: string;
  isAllSelected: boolean;
  onSelectCompetitor: (id: string) => void;
  onToggleSelectAll: () => void;
  onAddCompetitorBatch: (urlsText: string) => void;
  onDeleteCompetitor: (id: string) => void;
  onApplyKeywordsToWriter?: (keywords: string[]) => void;
}

export const RightDataPanel: React.FC<RightDataPanelProps> = ({
  activeProject,
  selectedCompetitorId,
  isAllSelected,
  onSelectCompetitor,
  onToggleSelectAll,
  onAddCompetitorBatch,
  onDeleteCompetitor,
  onApplyKeywordsToWriter
}) => {
  const [urlsInput, setUrlsInput] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [activeTextTab, setActiveTextTab] = useState<'title' | 'short' | 'long'>('title');

  const competitors = activeProject.competitors || [];
  const selectedCompetitor = competitors.find(c => c.id === selectedCompetitorId) || competitors[0];

  const handleBatchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlsInput.trim()) return;

    setIsAdding(true);
    setTimeout(() => {
      onAddCompetitorBatch(urlsInput);
      setUrlsInput('');
      setIsAdding(false);
    }, 400);
  };

  // Compute aggregated data for "全选所有产品共同分析"
  const allKeywords = competitors.flatMap(c => c.keywords || []);
  const keywordMap: Record<string, { count: number; category: string; word: string }> = {};
  allKeywords.forEach(k => {
    if (!keywordMap[k.word]) {
      keywordMap[k.word] = { count: 0, category: k.category, word: k.word };
    }
    keywordMap[k.word].count += k.count;
  });
  const aggregatedKeywords = Object.values(keywordMap).sort((a, b) => b.count - a.count);

  const aggregatedCommonPoints = Array.from(new Set(competitors.flatMap(c => c.commonPoints || c.coreFeatures || [])));
  const aggregatedDiffPoints = Array.from(new Set(competitors.flatMap(c => c.differentiationPoints || [])));

  return (
    <aside className="w-[340px] shrink-0 bg-white border-l border-slate-200 p-4 space-y-4 rounded-xl min-h-[calc(100vh-60px)] sticky top-[60px] flex flex-col justify-between shadow-2xs">
      
      <div className="space-y-4">
        
        {/* 顶部: Panel Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <div className="flex items-center space-x-2">
            <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
              <BarChart2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-xs">竞品数据管理中心</h3>
              <p className="text-[10px] text-slate-400">已录入 {competitors.length} 款竞品对比</p>
            </div>
          </div>
        </div>

        {/* 上部: Title 1. 竞品链接 & 批量导入框 (支持,逗号或换行分隔) */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-slate-800 text-xs flex items-center space-x-1.5">
              <Link className="w-3.5 h-3.5 text-blue-600" />
              <span>1. 竞品链接</span>
            </h4>
            <span className="text-[9px] bg-blue-100 text-blue-800 font-medium px-1.5 py-0.5 rounded">
              支持逗号/换行分隔
            </span>
          </div>

          <form onSubmit={handleBatchSubmit} className="space-y-2">
            <textarea
              rows={2}
              value={urlsInput}
              onChange={(e) => setUrlsInput(e.target.value)}
              placeholder="直接输入或粘贴竞品链接，以逗号(,)或换行分隔：&#10;https://play.google.com/store/apps/details?id=com.app1, https://play.google.com/store/apps/details?id=com.app2"
              className="w-full bg-white border border-slate-200 rounded-lg p-2 text-[11px] text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 placeholder:text-slate-400"
            />
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isAdding || !urlsInput.trim()}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-[11px] rounded-md transition shadow-2xs flex items-center space-x-1"
              >
                <Plus className="w-3 h-3" />
                <span>{isAdding ? '解析中...' : '批量导入链接'}</span>
              </button>
            </div>
          </form>
        </div>

        {/* 中部: 横排竞品 Icon 展示，可点击切换，提供「全选所有产品共同分析」 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              2. 竞品图标横排 (点击选择/切换):
            </span>
            <button
              onClick={onToggleSelectAll}
              className={`px-2 py-0.5 rounded text-[10px] font-bold transition flex items-center space-x-1 border ${
                isAllSelected
                  ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
              }`}
            >
              {isAllSelected ? <CheckSquare className="w-3 h-3" /> : <Square className="w-3 h-3" />}
              <span>全选共同分析</span>
            </button>
          </div>

          {/* Horizontal Icon Row */}
          <div className="flex items-center space-x-2 overflow-x-auto pb-2 pt-1 px-1 scrollbar-thin">
            {competitors.map((comp) => {
              const isSelected = !isAllSelected && comp.id === selectedCompetitorId;
              return (
                <div
                  key={comp.id}
                  onClick={() => onSelectCompetitor(comp.id)}
                  title={`${comp.name} (${comp.rating}★)`}
                  className={`shrink-0 cursor-pointer relative group transition-all transform hover:scale-105 ${
                    isSelected
                      ? 'ring-2 ring-blue-600 ring-offset-2 scale-105'
                      : isAllSelected
                      ? 'opacity-90 ring-1 ring-blue-300 ring-offset-1'
                      : 'opacity-70 hover:opacity-100'
                  }`}
                >
                  <img
                    src={comp.iconUrl}
                    alt={comp.name}
                    className="w-10 h-10 rounded-xl object-cover border border-slate-200 shadow-2xs"
                  />
                  {isSelected && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-blue-600 text-white rounded-full flex items-center justify-center text-[9px] font-black border border-white">
                      ✓
                    </span>
                  )}
                  {competitors.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteCompetitor(comp.id);
                      }}
                      className="absolute -bottom-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition shadow-2xs"
                      title="删除竞品"
                    >
                      <Trash2 className="w-2.5 h-2.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* 下部: 对应产品的标题、短描述、长描述，支持单个分析或全选所有产品共同分析 */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-3">
          
          {/* Header Switcher */}
          <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
            <span className="text-[11px] font-bold text-slate-800 flex items-center space-x-1">
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              <span>
                {isAllSelected ? '全选竞品·共同解析矩阵' : `产品详情: ${selectedCompetitor?.name}`}
              </span>
            </span>

            {!isAllSelected && selectedCompetitor && (
              <a
                href={selectedCompetitor.url}
                target="_blank"
                rel="noreferrer"
                className="text-[10px] text-blue-600 hover:underline flex items-center space-x-0.5"
              >
                <span>商店页面</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            )}
          </div>

          {/* Mode A: Single Selected Product Copy & Breakdown */}
          {!isAllSelected && selectedCompetitor && (
            <div className="space-y-3">
              {/* Text Tabs: Title / Short / Long */}
              <div className="flex items-center space-x-1 bg-white p-1 rounded-lg border border-slate-200 text-[10px] font-bold">
                <button
                  onClick={() => setActiveTextTab('title')}
                  className={`flex-1 py-1 rounded transition text-center ${
                    activeTextTab === 'title' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  标题
                </button>
                <button
                  onClick={() => setActiveTextTab('short')}
                  className={`flex-1 py-1 rounded transition text-center ${
                    activeTextTab === 'short' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  短描述
                </button>
                <button
                  onClick={() => setActiveTextTab('long')}
                  className={`flex-1 py-1 rounded transition text-center ${
                    activeTextTab === 'long' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  长描述
                </button>
              </div>

              {/* Text Content Display */}
              <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-xs text-slate-700 space-y-1.5 max-h-[140px] overflow-y-auto">
                {activeTextTab === 'title' && (
                  <div>
                    <p className="font-bold text-slate-900 font-mono text-[11px]">{selectedCompetitor.title}</p>
                    <p className="text-[10px] text-slate-400 mt-1">{selectedCompetitor.titleZh}</p>
                  </div>
                )}
                {activeTextTab === 'short' && (
                  <div>
                    <p className="font-medium text-slate-800 text-[11px]">{selectedCompetitor.shortDescription}</p>
                    <p className="text-[10px] text-slate-400 mt-1">{selectedCompetitor.shortDescriptionZh}</p>
                  </div>
                )}
                {activeTextTab === 'long' && (
                  <div>
                    <p className="whitespace-pre-wrap text-[10px] text-slate-600 font-sans leading-relaxed">
                      {selectedCompetitor.longDescription}
                    </p>
                  </div>
                )}
              </div>

              {/* Key Features & Keywords */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-500">核心提取关键词:</span>
                  {onApplyKeywordsToWriter && (
                    <button
                      onClick={() => onApplyKeywordsToWriter(selectedCompetitor.keywords.map(k => k.word))}
                      className="text-[9px] text-blue-600 font-bold hover:underline"
                    >
                      + 快捷应用到生成器
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-1">
                  {selectedCompetitor.keywords.slice(0, 6).map((k, idx) => (
                    <span key={idx} className="px-1.5 py-0.5 bg-blue-50 text-blue-800 text-[9px] font-mono rounded border border-blue-100">
                      {k.word} ({k.count}次)
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Mode B: All Competitors Combined Analysis Matrix (全选所有产品共同分析) */}
          {isAllSelected && (
            <div className="space-y-3 text-xs">
              <div>
                <span className="text-[10px] font-bold text-blue-900 block mb-1">
                  🎯 共同高频关键词 (共 {aggregatedKeywords.length} 个):
                </span>
                <div className="flex flex-wrap gap-1 max-h-[80px] overflow-y-auto">
                  {aggregatedKeywords.slice(0, 10).map((k, idx) => (
                    <span key={idx} className="px-1.5 py-0.5 bg-blue-100 text-blue-900 text-[9px] font-mono font-bold rounded">
                      {k.word} ({k.count}次)
                    </span>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] font-bold text-emerald-800 block">
                  ✅ 竞品核心共通点 (Common Features):
                </span>
                <ul className="text-[10px] text-slate-700 list-disc list-inside space-y-0.5 bg-emerald-50/50 p-2 rounded border border-emerald-100">
                  {aggregatedCommonPoints.slice(0, 3).map((pt, idx) => (
                    <li key={idx} className="truncate">{pt}</li>
                  ))}
                </ul>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] font-bold text-amber-800 block">
                  ⚡ 竞品差异点 & 卖点 (Differentiators):
                </span>
                <ul className="text-[10px] text-slate-700 list-disc list-inside space-y-0.5 bg-amber-50/50 p-2 rounded border border-amber-100">
                  {aggregatedDiffPoints.slice(0, 3).map((pt, idx) => (
                    <li key={idx} className="truncate">{pt}</li>
                  ))}
                </ul>
              </div>

              {onApplyKeywordsToWriter && (
                <button
                  onClick={() => onApplyKeywordsToWriter(aggregatedKeywords.slice(0, 12).map(k => k.word))}
                  className="w-full py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px] rounded-lg transition shadow-2xs text-center"
                >
                  一键导入全量核心高频词至文案生成器
                </button>
              )}
            </div>
          )}

        </div>

      </div>

      {/* Footer Info */}
      <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-[10px] text-slate-400 space-y-1">
        <p className="font-semibold text-slate-700">💡 Google Play ASO 提示：</p>
        <p>
          可以在顶部填入链接批量导入，在中部点击 Icon 快速切看单个，或者勾选「全选共同分析」提取全量词库与异同点。
        </p>
      </div>

    </aside>
  );
};
