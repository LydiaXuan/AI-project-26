import React, { useState } from 'react';
import { Project } from '../types';
import { Folder, Plus, Search, ChevronRight, Edit2, Trash2, Check, X } from 'lucide-react';

interface SidebarProps {
  projects: Project[];
  activeProjectId: string;
  onSelectProject: (id: string) => void;
  onCreateProjectClick: () => void;
  onRenameProject: (id: string, newName: string) => void;
  onDeleteProject: (id: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  projects,
  activeProjectId,
  onSelectProject,
  onCreateProjectClick,
  onRenameProject,
  onDeleteProject
}) => {
  const [filterText, setFilterText] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);

  const showNotice = (msg: string) => {
    setNoticeMessage(msg);
    setTimeout(() => setNoticeMessage(null), 3000);
  };

  const filteredProjects = projects.filter(p =>
    p.name.toLowerCase().includes(filterText.toLowerCase()) ||
    p.category.toLowerCase().includes(filterText.toLowerCase()) ||
    p.packageName.toLowerCase().includes(filterText.toLowerCase())
  );

  const startRename = (e: React.MouseEvent, p: Project) => {
    e.stopPropagation();
    setConfirmDeleteId(null);
    setEditingId(p.id);
    setEditingName(p.name);
  };

  const saveRename = (e: React.FormEvent, id: string) => {
    e.preventDefault();
    if (editingName.trim()) {
      onRenameProject(id, editingName.trim());
    }
    setEditingId(null);
  };

  const cancelRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(null);
  };

  const handleDeleteClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (projects.length <= 1) {
      showNotice('至少需要保留一个 ASO 项目！');
      return;
    }
    setConfirmDeleteId(id);
  };

  return (
    <aside className="w-[280px] shrink-0 bg-white border-r border-slate-200 p-4 space-y-4 flex flex-col justify-between min-h-[calc(100vh-64px)] sticky top-[64px] shadow-2xs">
      
      <div className="space-y-3.5">
        
        {/* Sidebar Header */}
        <div className="flex items-center justify-between pt-1 px-1">
          <div className="flex items-center space-x-2">
            <Folder className="w-4 h-4 text-blue-600" />
            <h2 className="text-xs font-extrabold text-slate-900 tracking-tight">
              项目库 ({projects.length})
            </h2>
          </div>

          <button
            onClick={onCreateProjectClick}
            className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] rounded-lg transition shadow-2xs flex items-center space-x-1 shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>新建项目</span>
          </button>
        </div>

        {/* Notice Message Toast if any */}
        {noticeMessage && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-bold px-3 py-1.5 rounded-xl shadow-2xs text-center animate-fadeIn">
            {noticeMessage}
          </div>
        )}

        {/* Search Input */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="搜索项目..."
            className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
          />
        </div>

        {/* Projects List */}
        <div className="space-y-2 max-h-[calc(100vh-230px)] overflow-y-auto pr-0.5">
          {filteredProjects.map((proj) => {
            const isActive = proj.id === activeProjectId;
            const isEditing = editingId === proj.id;

            return (
              <div
                key={proj.id}
                onClick={() => !isEditing && onSelectProject(proj.id)}
                className={`w-full text-left p-3 rounded-2xl transition-all border group relative cursor-pointer ${
                  isActive
                    ? 'bg-blue-50/90 border-blue-300 text-blue-900 shadow-2xs'
                    : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700'
                }`}
              >
                {/* Active Bar Indicator */}
                {isActive && (
                  <span className="absolute left-0 top-3 bottom-3 w-1 bg-blue-600 rounded-r-full" />
                )}

                {isEditing ? (
                  <form onSubmit={(e) => saveRename(e, proj.id)} className="flex items-center space-x-1 pl-1">
                    <input
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      autoFocus
                      className="w-full bg-white border border-blue-400 rounded-lg px-2 py-1 text-xs text-slate-900 font-bold focus:outline-none"
                    />
                    <button
                      type="submit"
                      onClick={(e) => e.stopPropagation()}
                      className="p-1 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                      title="保存"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={cancelRename}
                      className="p-1 bg-slate-200 text-slate-600 rounded-md hover:bg-slate-300"
                      title="取消"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </form>
                ) : (
                  <div className="flex items-center justify-between pl-1">
                    <div className="flex items-center space-x-2.5 min-w-0 flex-1">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${
                        isActive ? 'bg-blue-600 text-white shadow-2xs' : 'bg-slate-100 text-slate-600 group-hover:bg-blue-100 group-hover:text-blue-700'
                      }`}>
                        {proj.name.charAt(0)}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className={`text-xs truncate leading-snug ${isActive ? 'font-extrabold text-blue-950' : 'font-bold text-slate-800'}`}>
                          {proj.name}
                        </p>
                        <div className="flex items-center space-x-1.5 mt-0.5">
                          <span className="text-[10px] text-slate-400 truncate">
                            {proj.packageName.split('.').pop() || proj.packageName}
                          </span>
                          <span className="text-[9px] px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded-md font-mono shrink-0">
                            {proj.competitors.length} 竞品
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Action icons or inline confirm */}
                    {confirmDeleteId === proj.id ? (
                      <div className="flex items-center space-x-1 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded-lg shrink-0">
                        <span className="text-[10px] text-red-700 font-bold">删除?</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteProject(proj.id);
                            setConfirmDeleteId(null);
                          }}
                          className="px-1.5 py-0.5 bg-red-600 text-white text-[10px] font-bold rounded hover:bg-red-700"
                        >
                          是
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDeleteId(null);
                          }}
                          className="px-1.5 py-0.5 bg-slate-200 text-slate-700 text-[10px] font-bold rounded hover:bg-slate-300"
                        >
                          否
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity ml-1">
                        <button
                          onClick={(e) => startRename(e, proj)}
                          className="p-1 text-slate-400 hover:text-blue-600 hover:bg-white rounded-lg transition"
                          title="重命名项目"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => handleDeleteClick(e, proj.id)}
                          className="p-1 text-slate-400 hover:text-red-600 hover:bg-white rounded-lg transition"
                          title={projects.length > 1 ? "删除项目" : "至少保留一个项目"}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {filteredProjects.length === 0 && (
            <div className="p-4 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
              无匹配项目
            </div>
          )}
        </div>

      </div>

      {/* Footer Info */}
      <div className="bg-slate-50 border border-slate-200 p-3 rounded-2xl space-y-1 text-xs text-slate-500">
        <div className="flex items-center justify-between font-bold text-slate-700 text-[11px]">
          <span>当前存量项目</span>
          <span className="text-blue-600 font-mono">{projects.length} 个</span>
        </div>
        <p className="text-[10px] text-slate-400 leading-relaxed">
          Hover 项目可进行重命名或删除。点击进行全局切换。
        </p>
      </div>

    </aside>
  );
};
