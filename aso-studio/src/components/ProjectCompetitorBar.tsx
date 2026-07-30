import React, { useState } from 'react';
import { CompetitorInfo, Project } from '../types';
import { Link, Plus, CheckSquare, Square, Trash2, ExternalLink, Sparkles, Folder, ChevronDown, Check, Loader2 } from 'lucide-react';

interface ProjectCompetitorBarProps {
  projects: Project[];
  activeProjectId: string;
  onSelectProject: (id: string) => void;
  onCreateProjectClick: () => void;
  activeProject: Project;
  selectedCompetitorId: string;
  isAllSelected: boolean;
  onSelectCompetitor: (id: string) => void;
  onToggleSelectAll: () => void;
  onAddCompetitorBatch: (urlsText: string) => Promise<void> | void;
  onDeleteCompetitor: (id: string) => void;
}

export const ProjectCompetitorBar: React.FC<ProjectCompetitorBarProps> = ({
  projects,
  activeProjectId,
  onSelectProject,
  onCreateProjectClick,
  activeProject,
  selectedCompetitorId,
  isAllSelected,
  onSelectCompetitor,
  onToggleSelectAll,
  onAddCompetitorBatch,
  onDeleteCompetitor
}) => {
  const [urlsInput, setUrlsInput] = useState('');
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const competitors = activeProject?.competitors || [];

  const handleBatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlsInput.trim() || isImporting) return;
    setIsImporting(true);
    try {
      await onAddCompetitorBatch(urlsInput);
      setUrlsInput('');
      setShowBatchModal(false);
    } catch (err) {
      console.error('Batch import failed:', err);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
      
      {/* Top Bar: Project Switcher & Quick Meta */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
        
        {/* Project Selector */}
        <div className="relative">
          <button
            onClick={() => setShowProjectDropdown(!showProjectDropdown)}
            className="flex items-center space-x-2 bg-slate-50 hover:bg-slate-100 p-2.5 rounded-xl border border-slate-200 text-left transition"
          >
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
              <Folder className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="font-extrabold text-xs text-slate-900">
                  {activeProject?.name || '当前项目'}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </div>
              <p className="text-[10px] text-slate-500 font-mono">
                {activeProject?.packageName} · {activeProject?.category}
              </p>
            </div>
          </button>

          {/* Project Dropdown Menu */}
          {showProjectDropdown && (
            <div className="absolute left-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50">
              <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                切换 ASO 项目 ({projects.length})
              </div>
              <div className="max-h-48 overflow-y-auto">
                {projects.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      onSelectProject(p.id);
                      setShowProjectDropdown(false);
                    }}
                    className={`w-full px-3 py-2 text-left text-xs flex items-center justify-between hover:bg-slate-50 ${
                      p.id === activeProjectId ? 'font-bold text-blue-600 bg-blue-50/50' : 'text-slate-700'
                    }`}
                  >
                    <span className="truncate">{p.name}</span>
                    {p.id === activeProjectId && <Check className="w-3.5 h-3.5 text-blue-600" />}
                  </button>
                ))}
              </div>
              <div className="p-2 border-t border-slate-100">
                <button
                  onClick={() => {
                    onCreateProjectClick();
                    setShowProjectDropdown(false);
                  }}
                  className="w-full py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg transition text-center flex items-center justify-center space-x-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ 新建 ASO 项目</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Actions: Batch Add Links Modal Trigger & Toggle All Analysis */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowBatchModal(!showBatchModal)}
            className="px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-bold text-xs rounded-xl transition flex items-center space-x-1.5"
          >
            <Link className="w-3.5 h-3.5" />
            <span>+ 批量导入竞品链接</span>
          </button>

          <button
            onClick={onToggleSelectAll}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 border ${
              isAllSelected
                ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            {isAllSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
            <span>{isAllSelected ? '已全选共同分析' : '全选所有竞品共同分析'}</span>
          </button>
        </div>

      </div>

      {/* Batch Links Drawer / Inline Modal Input */}
      {showBatchModal && (
        <form onSubmit={handleBatchSubmit} className="bg-blue-50/60 border border-blue-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-blue-900 flex items-center space-x-1.5">
              <Link className="w-4 h-4 text-blue-600" />
              <span>批量录入美区 Google Play 竞品链接</span>
            </span>
            <span className="text-[10px] text-blue-700 font-mono">支持逗号或换行分隔多个链接</span>
          </div>
          <textarea
            rows={2}
            value={urlsInput}
            onChange={(e) => setUrlsInput(e.target.value)}
            placeholder="例如: https://play.google.com/store/apps/details?id=com.app1, https://play.google.com/store/apps/details?id=com.app2"
            className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-xs text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
          />
          <div className="flex justify-end space-x-2">
            <button
              type="button"
              onClick={() => setShowBatchModal(false)}
              className="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 font-bold text-xs rounded-lg hover:bg-slate-50"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={!urlsInput.trim() || isImporting}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg transition disabled:opacity-50 flex items-center space-x-1.5"
            >
              {isImporting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                  <span>正在抓取谷歌商店图标与文案...</span>
                </>
              ) : (
                <span>确定导入</span>
              )}
            </button>
          </div>
        </form>
      )}

      {/* Bottom Horizontal Competitors Row */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-slate-700">
            录入竞品库 ({competitors.length} 款): 点击图标即刻选中与分析
          </span>
          <span className="text-[11px] text-slate-400">
            {isAllSelected ? '当前处于全选汇总模式' : '已选择单个竞品'}
          </span>
        </div>

        {/* Scrollable Horizontal Row */}
        <div className="flex items-center space-x-3 overflow-x-auto pb-2 pt-1 scrollbar-thin">
          {competitors.map((comp) => {
            const isSelected = !isAllSelected && comp.id === selectedCompetitorId;
            return (
              <div
                key={comp.id}
                onClick={() => onSelectCompetitor(comp.id)}
                className={`shrink-0 cursor-pointer p-2 rounded-xl border transition-all flex items-center space-x-2.5 relative group ${
                  isSelected
                    ? 'bg-blue-50 border-blue-500 ring-2 ring-blue-200 shadow-2xs'
                    : isAllSelected
                    ? 'bg-blue-50/30 border-blue-200'
                    : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <img
                  src={comp.iconUrl}
                  alt={comp.name}
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(comp.name)}`;
                  }}
                  className="w-9 h-9 rounded-lg object-cover border border-slate-200 shadow-2xs"
                />

                <div className="min-w-0 pr-1">
                  <div className="font-bold text-xs text-slate-900 truncate max-w-[120px]">
                    {comp.name}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    {comp.rating} ★ · {comp.downloads}
                  </div>
                </div>

                {isSelected && (
                  <span className="w-4 h-4 bg-blue-600 text-white rounded-full flex items-center justify-center text-[9px] font-bold">
                    ✓
                  </span>
                )}

                {/* Delete button on hover */}
                {competitors.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteCompetitor(comp.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-600 hover:bg-white rounded transition"
                    title="删除竞品"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
};
