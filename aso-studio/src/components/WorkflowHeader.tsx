import React from 'react';
import { Search, BarChart3, Bot, FileText, Folder, HelpCircle, Lightbulb } from 'lucide-react';

interface WorkflowHeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  activeProjectName: string;
  onOpenGuide: () => void;
  onOpenSuggestions: () => void;
  onOpenProjects: () => void;
}

export const WorkflowHeader: React.FC<WorkflowHeaderProps> = ({
  activeTab,
  setActiveTab,
  activeProjectName,
  onOpenGuide,
  onOpenSuggestions,
  onOpenProjects
}) => {
  const steps = [
    { id: 'competitor', label: '1. 竞品en文案抓取', icon: Search },
    { id: 'analysis', label: '2. 文案解析', icon: BarChart3 },
    { id: 'generator', label: '3. AI智能文案生成&评估', icon: Bot },
    { id: 'releasenotes', label: '4. 首版版本更新日志', icon: FileText },
  ];

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
      
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        
        {/* Core 4 Workflow Tabs */}
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 lg:pb-0 scrollbar-none">
          {steps.map((step) => {
            const Icon = step.icon;
            const isActive = activeTab === step.id;
            return (
              <button
                key={step.id}
                onClick={() => setActiveTab(step.id)}
                className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all whitespace-nowrap flex items-center space-x-2 ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-blue-600'}`} />
                <span>{step.label}</span>
              </button>
            );
          })}
        </div>

        {/* Right Aux Buttons: Project Center, Guide, Suggestions */}
        <div className="flex items-center space-x-2 shrink-0">
          <button
            onClick={onOpenProjects}
            className={`px-3 py-2 text-xs font-bold rounded-xl border transition flex items-center space-x-1.5 ${
              activeTab === 'projects'
                ? 'bg-blue-50 border-blue-300 text-blue-700 shadow-2xs'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Folder className="w-3.5 h-3.5 text-blue-600" />
            <span>项目管理中心</span>
          </button>

          <button
            onClick={onOpenGuide}
            className="px-3 py-2 text-xs font-bold rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition flex items-center space-x-1.5"
          >
            <HelpCircle className="w-3.5 h-3.5 text-blue-600" />
            <span className="hidden sm:inline">ASO指南</span>
          </button>

          <button
            onClick={onOpenSuggestions}
            className="px-3 py-2 text-xs font-bold rounded-xl bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition flex items-center space-x-1"
          >
            <Lightbulb className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">系统建议</span>
          </button>
        </div>

      </div>

    </div>
  );
};
