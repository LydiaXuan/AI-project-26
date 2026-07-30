import React, { useState } from 'react';
import { Project } from '../types';
import { Folder, Plus, Search, Trash2, Copy, Edit3, ArrowRight, Layers, Tag, Check, Calendar, Globe, Sparkles } from 'lucide-react';

interface ProjectCenterProps {
  projects: Project[];
  activeProjectId: string;
  onSelectProject: (projectId: string) => void;
  onCreateProject: (newProject: Omit<Project, 'id' | 'updatedAt'>) => void;
  onUpdateProjectName: (projectId: string, newName: string) => void;
  onDuplicateProject: (projectId: string) => void;
  onDeleteProject: (projectId: string) => void;
}

export const ProjectCenter: React.FC<ProjectCenterProps> = ({
  projects,
  activeProjectId,
  onSelectProject,
  onCreateProject,
  onUpdateProjectName,
  onDuplicateProject,
  onDeleteProject
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);

  const showNotice = (msg: string) => {
    setNoticeMessage(msg);
    setTimeout(() => setNoticeMessage(null), 3000);
  };

  // Form states for creating new project
  const [newName, setNewName] = useState('');
  const [newPackage, setNewPackage] = useState('');
  const [newCategory, setNewCategory] = useState('Games > Puzzle');
  const [newKeywords, setNewKeywords] = useState('');

  const filteredProjects = projects.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.packageName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    const keywordsArray = newKeywords
      .split(',')
      .map(k => k.trim())
      .filter(Boolean);

    onCreateProject({
      name: newName,
      packageName: newPackage || `com.app.${newName.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
      category: newCategory,
      targetKeywords: keywordsArray.length ? keywordsArray : ['game', 'puzzle', '3d'],
      competitors: [],
      asoCopy: {
        appName: newName,
        title: newName.slice(0, 30),
        shortDescription: 'Discover the ultimate experience with fun and engaging features!',
        longDescription: `Welcome to ${newName}! Experience next-gen features, engaging levels, and smooth controls. Download today!`,
        targetKeywords: keywordsArray,
        subGenre: newCategory
      }
    });

    setNewName('');
    setNewPackage('');
    setNewKeywords('');
    setIsCreateModalOpen(false);
  };

  const handleStartRename = (proj: Project, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingProjectId(proj.id);
    setEditingName(proj.name);
  };

  const handleSaveRename = (projId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (editingName.trim()) {
      onUpdateProjectName(projId, editingName.trim());
    }
    setEditingProjectId(null);
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner / Hero Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-100 text-blue-600">
            <Folder className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
              <span>ASO 项目管理中心 (Project Cards Dashboard)</span>
              <span className="text-xs font-semibold px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-100 rounded-md">
                已存储 {projects.length} 个项目
              </span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              按项目单独隔离与保存竞品词库、Google Play 算法参数、AI 文案与更新日志。数据自动同步于本地浏览器。
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-lg shadow-sm transition flex items-center space-x-2 shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>创建新 ASO 项目</span>
        </button>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索项目名称、包名或分类..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
          />
        </div>
        <p className="text-xs text-slate-400">
          提示：点击下方任一项目卡片即可直接加载并进入全套 ASO 工作台
        </p>
      </div>

      {/* Notice Banner */}
      {noticeMessage && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold px-4 py-2 rounded-xl shadow-2xs text-center animate-fadeIn">
          {noticeMessage}
        </div>
      )}

      {/* Projects Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredProjects.map((proj) => {
          const isActive = proj.id === activeProjectId;
          const isEditingThis = editingProjectId === proj.id;

          return (
            <div
              key={proj.id}
              onClick={() => onSelectProject(proj.id)}
              className={`bg-white border rounded-xl p-5 shadow-sm transition-all duration-200 cursor-pointer flex flex-col justify-between space-y-4 hover:shadow-md relative group ${
                isActive ? 'border-blue-500 ring-2 ring-blue-100' : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              {/* Active Badge */}
              {isActive && (
                <div className="absolute top-3 right-3 bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center space-x-1 shadow-2xs">
                  <Check className="w-3 h-3" />
                  <span>当前活跃项目</span>
                </div>
              )}

              {/* Top Header info */}
              <div className="space-y-2 pr-12">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs shrink-0">
                    {proj.name.charAt(0)}
                  </div>
                  
                  {isEditingThis ? (
                    <div className="flex items-center space-x-1 flex-1" onClick={e => e.stopPropagation()}>
                      <input
                        type="text"
                        value={editingName}
                        onChange={e => setEditingName(e.target.value)}
                        className="text-xs font-bold text-slate-900 border border-blue-400 rounded px-2 py-1 w-full"
                      />
                      <button
                        onClick={e => handleSaveRename(proj.id, e)}
                        className="px-2 py-1 bg-blue-600 text-white text-[10px] rounded font-bold"
                      >
                        保存
                      </button>
                    </div>
                  ) : (
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 leading-tight group-hover:text-blue-600 transition">
                        {proj.name}
                      </h3>
                      <p className="text-[11px] font-mono text-slate-400 truncate max-w-[200px]">
                        {proj.packageName}
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex items-center space-x-2 pt-1">
                  <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-medium rounded border border-slate-200">
                    {proj.category}
                  </span>
                  <span className="text-[10px] text-slate-400 flex items-center space-x-1">
                    <Calendar className="w-3 h-3" />
                    <span>更新于 {proj.updatedAt}</span>
                  </span>
                </div>
              </div>

              {/* Key Indicators */}
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 block font-medium">目标高频词:</span>
                  <span className="font-bold text-slate-800 font-mono text-xs">
                    {proj.targetKeywords.length} 个关键词
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-medium">已录入竞品:</span>
                  <span className="font-bold text-blue-600 font-mono text-xs">
                    {proj.competitors.length} 款竞品
                  </span>
                </div>
              </div>

              {/* Keywords Tag Preview */}
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  关键词库预览:
                </span>
                <div className="flex flex-wrap gap-1">
                  {proj.targetKeywords.slice(0, 5).map((kw, i) => (
                    <span key={i} className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded font-mono">
                      {kw}
                    </span>
                  ))}
                  {proj.targetKeywords.length > 5 && (
                    <span className="text-[10px] text-slate-400">+{proj.targetKeywords.length - 5}</span>
                  )}
                </div>
              </div>

              {/* Action Buttons Row */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between" onClick={e => e.stopPropagation()}>
                <button
                  onClick={() => onSelectProject(proj.id)}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-md shadow-2xs transition flex items-center space-x-1"
                >
                  <span>进入工作台</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>

                <div className="flex items-center space-x-1 text-slate-400">
                  <button
                    onClick={e => handleStartRename(proj, e)}
                    title="重命名项目"
                    className="p-1.5 hover:text-slate-700 hover:bg-slate-100 rounded transition"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onDuplicateProject(proj.id)}
                    title="复制项目"
                    className="p-1.5 hover:text-slate-700 hover:bg-slate-100 rounded transition"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>

                  {confirmDeleteId === proj.id ? (
                    <div className="flex items-center space-x-1 bg-red-50 border border-red-200 px-2 py-0.5 rounded-lg">
                      <span className="text-[10px] text-red-700 font-bold">确定删除?</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteProject(proj.id);
                          setConfirmDeleteId(null);
                        }}
                        className="px-2 py-0.5 bg-red-600 text-white text-[10px] font-bold rounded hover:bg-red-700"
                      >
                        是
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmDeleteId(null);
                        }}
                        className="px-2 py-0.5 bg-slate-200 text-slate-700 text-[10px] font-bold rounded hover:bg-slate-300"
                      >
                        否
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (projects.length <= 1) {
                          showNotice('至少需要保留一个 ASO 项目！');
                          return;
                        }
                        setConfirmDeleteId(proj.id);
                      }}
                      title="删除项目"
                      className="p-1.5 hover:text-red-600 hover:bg-red-50 rounded transition cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

            </div>
          );
        })}
      </div>

      {/* Modal: Create New Project */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-lg w-full p-6 shadow-xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                <Folder className="w-5 h-5 text-blue-600" />
                <span>新建 Google Play ASO 项目</span>
              </h3>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">
                  项目/游戏名称 (App / Game Name): <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="例如: Blast Cannon 3D: Demolition"
                  className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 shadow-2xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">
                  Google Play 包名 (Package ID):
                </label>
                <input
                  type="text"
                  value={newPackage}
                  onChange={e => setNewPackage(e.target.value)}
                  placeholder="com.company.appname (选填，自动生成)"
                  className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-xs text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 shadow-2xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">
                  所属细分品类 (Sub-Genre):
                </label>
                <select
                  value={newCategory}
                  onChange={e => setNewCategory(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 shadow-2xs"
                >
                  <option value="Games > Puzzle">Games &gt; Puzzle (物理解谜)</option>
                  <option value="Games > Action">Games &gt; Action (动作爆破)</option>
                  <option value="Games > Casual">Games &gt; Casual (极简消除/解压)</option>
                  <option value="Games > Role Playing">Games &gt; Role Playing (角色扮演/放置)</option>
                  <option value="Games > Arcade">Games &gt; Arcade (街机挑战)</option>
                  <option value="Applications > Productivity">Applications &gt; Productivity (工具效率)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 flex justify-between">
                  <span>初始目标搜索词 (Target Keywords):</span>
                  <span className="text-[10px] text-blue-600 font-medium">英文逗号分隔</span>
                </label>
                <input
                  type="text"
                  value={newKeywords}
                  onChange={e => setNewKeywords(e.target.value)}
                  placeholder="cannon, smash, physics, demolition, puzzle"
                  className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-xs text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 shadow-2xs"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-lg transition"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-lg shadow-sm transition"
                >
                  立即创建项目
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
