import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { WorkflowHeader } from './components/WorkflowHeader';
import { ProjectCompetitorBar } from './components/ProjectCompetitorBar';
import { ProjectCenter } from './components/ProjectCenter';
import { CompetitorGrabber } from './components/CompetitorGrabber';
import { CompetitorAnalyzer } from './components/CompetitorAnalyzer';
import { ReleaseNotesGenerator } from './components/ReleaseNotesGenerator';
import { AsoGenerator } from './components/AsoGenerator';
import { AlgorithmGuideModal } from './components/AlgorithmGuideModal';
import { AsoSuggestionsModal } from './components/AsoSuggestionsModal';

import { INITIAL_PROJECTS, INITIAL_COMPETITORS, INITIAL_ASO_COPY } from './data/presets';
import { Project, CompetitorInfo, AsoCopy } from './types';

const STORAGE_KEY = 'asox_projects_v6';

export default function App() {
  // Load projects from localStorage or default presets
  const [projects, setProjects] = useState<Project[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Failed to load saved projects', e);
    }
    return INITIAL_PROJECTS;
  });

  const [activeProjectId, setActiveProjectId] = useState<string>(projects[0]?.id || 'p-1');
  const [activeTab, setActiveTab] = useState<string>('competitor'); // Default to 1. 竞品en文案抓取

  const [isGuideOpen, setIsGuideOpen] = useState<boolean>(false);
  const [isSuggestionsOpen, setIsSuggestionsOpen] = useState<boolean>(false);

  // Active project helper
  const activeProject = projects.find(p => p.id === activeProjectId) || projects[0];

  // Selected competitor inside active project
  const [selectedCompetitorId, setSelectedCompetitorId] = useState<string>(
    activeProject?.competitors?.[0]?.id || 'c1'
  );

  // Toggle for "全选所有产品共同分析"
  const [isAllSelected, setIsAllSelected] = useState<boolean>(false);

  // Sync projects state to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
    } catch (e) {
      console.error('Failed to save projects to localStorage', e);
    }
  }, [projects]);

  // Handle switching active project
  const handleSelectProject = (projectId: string) => {
    setActiveProjectId(projectId);
    setIsAllSelected(false);
    const targetProject = projects.find(p => p.id === projectId);
    if (targetProject && targetProject.competitors?.length > 0) {
      setSelectedCompetitorId(targetProject.competitors[0].id);
    } else {
      setSelectedCompetitorId('');
    }
    if (activeTab === 'projects') {
      setActiveTab('competitor');
    }
  };

  // Handle Project Creation
  const handleCreateProject = (newProj: Project) => {
    setProjects(prev => [newProj, ...prev]);
    setActiveProjectId(newProj.id);
    setIsAllSelected(false);
    if (newProj.competitors?.length > 0) {
      setSelectedCompetitorId(newProj.competitors[0].id);
    } else {
      setSelectedCompetitorId('');
    }
    setActiveTab('competitor');
  };

  // Quick New Project handler
  const handleQuickCreateProject = () => {
    const id = `p-${Date.now()}`;
    const projName = `新 ASO 项目 ${projects.length + 1}`;
    const newProj: Project = {
      id,
      name: projName,
      category: 'Games > Puzzle',
      packageName: `com.asox.game${projects.length + 1}`,
      updatedAt: new Date().toLocaleDateString(),
      targetKeywords: ['3d', 'puzzle', 'casual', 'brain', 'physics'],
      competitors: [],
      asoCopy: {
        appName: projName,
        title: projName,
        shortDescription: '',
        longDescription: '',
        targetKeywords: ['3d', 'puzzle', 'casual', 'brain', 'physics'],
        subGenre: 'Games > Puzzle'
      }
    };
    handleCreateProject(newProj);
  };

  // Handle Project Rename
  const handleRenameProject = (id: string, newName: string) => {
    setProjects(prev => prev.map(p => {
      if (p.id === id) {
        return {
          ...p,
          name: newName,
          asoCopy: {
            ...p.asoCopy,
            appName: (!p.asoCopy.appName || p.asoCopy.appName === p.name) ? newName : p.asoCopy.appName
          }
        };
      }
      return p;
    }));
  };

  // Handle Project Duplicate
  const handleDuplicateProject = (id: string) => {
    const target = projects.find(p => p.id === id);
    if (!target) return;
    const newProj: Project = JSON.parse(JSON.stringify(target));
    newProj.id = `p-${Date.now()}`;
    newProj.name = `${target.name} (副本)`;
    newProj.updatedAt = new Date().toLocaleDateString();
    handleCreateProject(newProj);
  };

  // Handle Project Delete
  const handleDeleteProject = (id: string) => {
    setProjects(prev => {
      const remaining = prev.filter(p => p.id !== id);
      if (activeProjectId === id) {
        if (remaining.length > 0) {
          setActiveProjectId(remaining[0].id);
          if (remaining[0].competitors?.length > 0) {
            setSelectedCompetitorId(remaining[0].competitors[0].id);
          } else {
            setSelectedCompetitorId('');
          }
        } else {
          setActiveProjectId('');
          setSelectedCompetitorId('');
        }
      }
      return remaining;
    });
    setIsAllSelected(false);
  };

  // Handle updating active project's AsoCopy
  const handleUpdateActiveAsoCopy = (updatedCopy: AsoCopy) => {
    setProjects(prev => prev.map(p => {
      if (p.id === activeProjectId) {
        return {
          ...p,
          asoCopy: updatedCopy,
          updatedAt: new Date().toLocaleDateString()
        };
      }
      return p;
    }));
  };

  // Batch add competitor links with real server AI & Google Play scraping
  const handleBatchAddCompetitors = async (urlsText: string) => {
    const lines = urlsText
      .split(/[\n,;]+/)
      .map(l => l.trim())
      .filter(Boolean);

    if (lines.length === 0) return;

    const newCompetitors: CompetitorInfo[] = [];

    for (let index = 0; index < lines.length; index++) {
      const rawUrl = lines[index];
      let pkgName = 'com.example.competitor';
      try {
        const match = rawUrl.match(/id=([a-zA-Z0-9_.]+)/);
        if (match && match[1]) pkgName = match[1];
      } catch (e) {}

      const cleanTitle = pkgName.split('.').pop() || 'Competitor App';
      const formattedName = cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1);
      const fullUrl = rawUrl.startsWith('http') ? rawUrl : `https://play.google.com/store/apps/details?id=${pkgName}`;

      try {
        const response = await fetch('/api/gemini/analyze-competitor', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: fullUrl, name: formattedName })
        });

        if (response.ok) {
          const data = await response.json();
          newCompetitors.push({
            id: `c-batch-${Date.now()}-${index}`,
            name: data.title ? data.title.slice(0, 25) : formattedName,
            url: fullUrl,
            iconUrl: data.iconUrl || `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(pkgName)}`,
            rating: data.rating || 4.6,
            downloads: data.downloads || '1M+',
            category: data.category || 'GAME_PUZZLE',
            title: data.title || `${formattedName}: Physics Demolition Destruction Puzzle`,
            titleZh: data.titleZh || `${formattedName}: 3D 物理破坏与解压益智关卡`,
            shortDescription: data.shortDescription || `Smash and destroy 3D physics structures in this ultimate relaxation puzzle!`,
            shortDescriptionZh: data.shortDescriptionZh || `在终极解压益智中粉碎破坏 3D 物理建筑物！`,
            longDescription: data.longDescription || `WELCOME TO ${formattedName.toUpperCase()}!\nExperience state-of-the-art rigid body physics, destruction mechanics, and satisfying ASMR demolition soundscapes.`,
            longDescriptionZh: data.longDescriptionZh || `欢迎来到 ${formattedName.toUpperCase()}！\n体验业界前沿刚体物理学解算、摧毁机制与治愈 ASMR 毁灭音效。`,
            keywords: data.keywords || [
              { word: 'physics', count: 18, category: 'action', density: 2.8, translation: '物理学/物理轨迹' },
              { word: 'demolition', count: 14, category: 'entity', density: 2.2, translation: '拆除/爆破' }
            ],
            coreFeatures: data.coreFeatures || ['真实 3D 物理解算', '全场景可粉碎构筑物'],
            commonPoints: data.commonPoints || ['多重爆炸道具装备', '解压摧毁音效设计'],
            differentiationPoints: data.differentiationPoints || ['粒子级碎片计算', '自定义破坏编辑器']
          });
          continue;
        }
      } catch (err) {
        console.error('Batch competitor fetch error:', err);
      }

      // Fallback if fetch fails
      newCompetitors.push({
        id: `c-batch-${Date.now()}-${index}`,
        name: formattedName,
        url: fullUrl,
        iconUrl: `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(pkgName)}`,
        rating: 4.6,
        downloads: '1M+',
        category: 'GAME_PUZZLE',
        title: `${formattedName}: Physics Demolition Destruction Puzzle`,
        titleZh: `${formattedName}: 3D 物理破坏与解压益智关卡`,
        shortDescription: `Smash and destroy 3D physics structures in this ultimate relaxation puzzle!`,
        shortDescriptionZh: `在终极解压益智中粉碎破坏 3D 物理建筑物！`,
        longDescription: `WELCOME TO ${formattedName.toUpperCase()}!\nExperience state-of-the-art rigid body physics, destruction mechanics, and satisfying ASMR demolition soundscapes.`,
        longDescriptionZh: `欢迎来到 ${formattedName.toUpperCase()}！\n体验业界前沿刚体物理学解算、摧毁机制与治愈 ASMR 毁灭音效。`,
        keywords: [
          { word: 'physics', count: 18, category: 'action', density: 2.8, translation: '物理学' }
        ],
        coreFeatures: ['真实 3D 刚体物理解算'],
        commonPoints: ['解压摧毁双重音效设计'],
        differentiationPoints: ['粒子级碎片计算']
      });
    }

    setProjects(prev => prev.map(p => {
      if (p.id === activeProjectId) {
        return {
          ...p,
          competitors: [...newCompetitors, ...p.competitors],
          updatedAt: new Date().toLocaleDateString()
        };
      }
      return p;
    }));

    if (newCompetitors.length > 0) {
      setSelectedCompetitorId(newCompetitors[0].id);
    }
  };

  // Delete a competitor
  const handleDeleteCompetitor = (compId: string) => {
    setProjects(prev => prev.map(p => {
      if (p.id === activeProjectId) {
        const remaining = p.competitors.filter(c => c.id !== compId);
        return {
          ...p,
          competitors: remaining,
          updatedAt: new Date().toLocaleDateString()
        };
      }
      return p;
    }));

    // If deleted competitor was currently selected, select another remaining competitor or clear
    if (selectedCompetitorId === compId) {
      const remainingCompetitors = activeProject?.competitors.filter(c => c.id !== compId) || [];
      if (remainingCompetitors.length > 0) {
        setSelectedCompetitorId(remainingCompetitors[0].id);
      } else {
        setSelectedCompetitorId('');
      }
    }
  };

  // Apply competitor words to active project's ASO copy generator (clean overwrite with imported keywords)
  const handleApplyKeywordsToWriter = (keywordsArray: string[]) => {
    if (activeProject) {
      const cleanKeywords = Array.from(new Set(keywordsArray));
      handleUpdateActiveAsoCopy({
        ...activeProject.asoCopy,
        targetKeywords: cleanKeywords
      });
    }
    setActiveTab('generator');
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 font-sans flex flex-col justify-between selection:bg-blue-600 selection:text-white">
      
      {/* 1. Top Title Bar: "初版文案直出" (Clean and empty on the right) */}
      <Navbar
        onOpenGuide={() => setIsGuideOpen(true)}
        onOpenSuggestions={() => setIsSuggestionsOpen(true)}
      />

      {/* 2. Main Area under the Top Title Bar: Left Sidebar + Right Main Workspace */}
      <div className="flex-1 flex w-full max-w-[1920px] mx-auto">
        
        {/* Left Sidebar: Projects List with Rename & Delete features */}
        <Sidebar
          projects={projects}
          activeProjectId={activeProjectId}
          onSelectProject={handleSelectProject}
          onCreateProjectClick={handleQuickCreateProject}
          onRenameProject={handleRenameProject}
          onDeleteProject={handleDeleteProject}
        />

        {/* Right Main Content Workspace */}
        <main className="flex-1 p-6 space-y-6 overflow-y-auto min-w-0">
          
          {/* Workflow Step Tabs Bar */}
          <WorkflowHeader
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            activeProjectName={activeProject?.name || ''}
            onOpenGuide={() => setIsGuideOpen(true)}
            onOpenSuggestions={() => setIsSuggestionsOpen(true)}
            onOpenProjects={() => setActiveTab('projects')}
          />

          {/* Project & Competitor Quick Bar (Horizontal Selector) */}
          {activeTab !== 'projects' && activeProject && (
            <ProjectCompetitorBar
              projects={projects}
              activeProjectId={activeProjectId}
              onSelectProject={handleSelectProject}
              onCreateProjectClick={handleQuickCreateProject}
              activeProject={activeProject}
              selectedCompetitorId={selectedCompetitorId}
              isAllSelected={isAllSelected}
              onSelectCompetitor={(id) => {
                setIsAllSelected(false);
                setSelectedCompetitorId(id);
              }}
              onToggleSelectAll={() => setIsAllSelected(!isAllSelected)}
              onAddCompetitorBatch={handleBatchAddCompetitors}
              onDeleteCompetitor={handleDeleteCompetitor}
            />
          )}

          {/* Core Views */}
          {activeTab === 'projects' && (
            <ProjectCenter
              projects={projects}
              activeProjectId={activeProjectId}
              onSelectProject={handleSelectProject}
              onCreateProject={handleCreateProject}
              onUpdateProjectName={handleRenameProject}
              onDuplicateProject={handleDuplicateProject}
              onDeleteProject={handleDeleteProject}
            />
          )}

          {activeTab === 'competitor' && activeProject && (
            <CompetitorGrabber
              competitors={activeProject.competitors}
              selectedCompetitorId={selectedCompetitorId}
              onSelectCompetitor={(comp) => setSelectedCompetitorId(comp.id)}
              onAddNewCompetitor={(newComp) => {
                setProjects(prev => prev.map(p => {
                  if (p.id === activeProjectId) {
                    return {
                      ...p,
                      competitors: [newComp, ...p.competitors],
                      updatedAt: new Date().toLocaleDateString()
                    };
                  }
                  return p;
                }));
                setSelectedCompetitorId(newComp.id);
              }}
              onNavigateToAnalysis={() => setActiveTab('analysis')}
            />
          )}

          {activeTab === 'analysis' && activeProject && (
            <CompetitorAnalyzer
              competitors={activeProject.competitors}
              selectedCompetitorId={selectedCompetitorId}
              isAllSelected={isAllSelected}
              onSelectCompetitor={(comp) => {
                setIsAllSelected(false);
                setSelectedCompetitorId(comp.id);
              }}
              onToggleSelectAll={() => setIsAllSelected(!isAllSelected)}
              onApplyToAsoWriter={(comp) => handleApplyKeywordsToWriter(comp.keywords.map(k => k.word))}
              onApplyAllKeywordsToWriter={handleApplyKeywordsToWriter}
            />
          )}

          {activeTab === 'generator' && activeProject && (
            <AsoGenerator
              key={activeProject.id}
              currentCopy={activeProject.asoCopy}
              competitors={activeProject.competitors}
              activeProjectName={activeProject.name}
              onApplyGeneratedCopy={handleUpdateActiveAsoCopy}
              onNavigateToSimulator={() => setActiveTab('analysis')}
            />
          )}

          {activeTab === 'releasenotes' && activeProject && (
            <ReleaseNotesGenerator
              appName={activeProject.asoCopy.appName || activeProject.name}
            />
          )}

        </main>

      </div>

      {/* Modals */}
      <AlgorithmGuideModal
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
      />

      <AsoSuggestionsModal
        isOpen={isSuggestionsOpen}
        onClose={() => setIsSuggestionsOpen(false)}
      />

    </div>
  );
}
