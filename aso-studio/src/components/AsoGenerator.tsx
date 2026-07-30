import React, { useState } from 'react';
import { AsoCopy, CompetitorInfo } from '../types';
import { Bot, Sparkles, Check, ArrowRight, RefreshCw, Sliders, Tag, FileText, CheckCircle2, Copy, HelpCircle, X, Plus, Trash2 } from 'lucide-react';
import { FormattedDescriptionView } from './FormattedDescriptionView';
import { SmartWordTrimmer } from './SmartWordTrimmer';

interface AsoGeneratorProps {
  currentCopy: AsoCopy;
  competitors?: CompetitorInfo[];
  activeProjectName?: string;
  onApplyGeneratedCopy: (generated: AsoCopy) => void;
  onNavigateToSimulator: () => void;
}

export const AsoGenerator: React.FC<AsoGeneratorProps> = ({
  currentCopy,
  competitors = [],
  activeProjectName = '',
  onApplyGeneratedCopy,
  onNavigateToSimulator
}) => {
  const [appName, setAppName] = useState(activeProjectName || currentCopy.appName || '');
  const [subGenre, setSubGenre] = useState(currentCopy.subGenre || 'Games > Puzzle');
  
  const initialKeywords = currentCopy.targetKeywords && currentCopy.targetKeywords.length > 0
    ? currentCopy.targetKeywords
    : [];
  const [keywordsList, setKeywordsList] = useState<string[]>(initialKeywords);
  const [newKeywordInput, setNewKeywordInput] = useState('');
  const [coreFeaturesInput, setCoreFeaturesInput] = useState('');
  const [isSummarizingFeatures, setIsSummarizingFeatures] = useState(false);

  // AI Auto-synthesis handler for selling points from competitors & active project theme
  const handleAutoSynthesizeFeatures = async (overrideAppName?: string) => {
    setIsSummarizingFeatures(true);
    const targetName = overrideAppName || appName || activeProjectName;
    try {
      const res = await fetch('/api/gemini/summarize-features', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          competitors: (competitors || []).map(c => ({
            name: c.name,
            title: c.title,
            coreFeatures: c.coreFeatures,
            commonPoints: c.commonPoints,
            differentiationPoints: c.differentiationPoints,
            shortDescriptionZh: c.shortDescriptionZh
          })),
          appName: targetName,
          subGenre,
          targetKeywords: keywordsList
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.sellingPoints) {
          setCoreFeaturesInput(data.sellingPoints);
        }
      }
    } catch (err) {
      console.error('Failed to summarize features:', err);
    } finally {
      setIsSummarizingFeatures(false);
    }
  };

  // Sync state when active project's currentCopy changes or project switches
  React.useEffect(() => {
    const targetName = currentCopy.appName || activeProjectName || '';
    if (targetName) {
      setAppName(targetName);
    }
    setSubGenre(currentCopy.subGenre || 'Games > Puzzle');
    if (currentCopy.targetKeywords && currentCopy.targetKeywords.length > 0) {
      setKeywordsList(currentCopy.targetKeywords);
    } else {
      setKeywordsList([]);
    }
    setGeneratedOutput(null);

    // Auto-synthesize selling points directly for the active project
    handleAutoSynthesizeFeatures(targetName);
  }, [currentCopy.appName, activeProjectName, currentCopy.subGenre]);
  const [tone, setTone] = useState('爽快解压与极高满足感 (Satisfying & Exciting)');
  const [isLoading, setIsLoading] = useState(false);
  const [generatedOutput, setGeneratedOutput] = useState<AsoCopy | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isApplied, setIsApplied] = useState(false);
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [showKeywordSelector, setShowKeywordSelector] = useState(false);
  const [shorteningField, setShorteningField] = useState<string | null>(null);
  const [warningDialog, setWarningDialog] = useState<{ message: string; action: () => void } | null>(null);

  // Extract all available keywords from competitors list for multi-select import
  const allExtractedKeywords = Array.from(new Set(competitors.flatMap(c => c.keywords.map(k => k.word))));

  const removeKeyword = (kwToRemove: string) => {
    setKeywordsList(prev => prev.filter(kw => kw !== kwToRemove));
  };

  const addKeywords = (rawText: string) => {
    if (!rawText.trim()) return;
    const parts = rawText.split(/[,，\n]/).map(s => s.trim()).filter(Boolean);
    setKeywordsList(prev => {
      const existing = new Set(prev.map(p => p.toLowerCase()));
      const toAdd = parts.filter(p => !existing.has(p.toLowerCase()));
      return [...prev, ...toAdd];
    });
    setNewKeywordInput('');
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',' || e.key === '，') {
      e.preventDefault();
      addKeywords(newKeywordInput);
    } else if (e.key === 'Backspace' && !newKeywordInput && keywordsList.length > 0) {
      setKeywordsList(prev => prev.slice(0, -1));
    }
  };

  const toggleImportKeyword = (kw: string) => {
    const normalized = kw.trim();
    if (!normalized) return;
    setKeywordsList(prev => {
      if (prev.some(k => k.toLowerCase() === normalized.toLowerCase())) {
        return prev.filter(k => k.toLowerCase() !== normalized.toLowerCase());
      } else {
        return [...prev, normalized];
      }
    });
  };

  const clearAllKeywords = () => {
    setKeywordsList([]);
  };

  const handleGenerateAndEvaluate = async () => {
    if (!appName.trim()) {
      setErrorMsg('请输入产品名称');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    setIsApplied(false);

    try {
      const keywordsArray = keywordsList.filter(Boolean);

      // Generate Google Play Copy
      const response = await fetch('/api/gemini/generate-aso', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appName,
          subGenre,
          targetKeywords: keywordsArray,
          coreFeatures: coreFeaturesInput,
          tone,
          competitors: competitors.map(c => ({
            title: c.title,
            subGenre: c.category,
            keywords: c.keywords.slice(0, 10).map(k => k.word),
            coreFeatures: c.coreFeatures,
            commonPoints: c.commonPoints,
            differentiationPoints: c.differentiationPoints
          }))
        })
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || '生成 ASO 文案失败');
      }

      const data = await response.json();

      const newCopy: AsoCopy = {
        appName: data.appName || appName,
        title: data.title || '',
        shortDescription: data.shortDescription || '',
        longDescription: data.longDescription || '',
        targetKeywords: data.targetKeywords || keywordsArray,
        subGenre: data.subGenre || subGenre
      };

      setGeneratedOutput(newCopy);

    } catch (err: any) {
      setErrorMsg(err.message || '生成过程中出现错误，请检查网络后重试');
    } finally {
      setIsLoading(false);
    }
  };

  const handleShortenSingleField = async (fieldKey: 'title' | 'shortDescription' | 'longDescription', currentText: string, limit: number) => {
    if (!currentText || currentText.length <= limit) return;
    setShorteningField(fieldKey);
    try {
      const res = await fetch('/api/gemini/shorten-field', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: currentText,
          maxLen: limit,
          fieldName: fieldKey === 'title' ? 'Title' : fieldKey === 'shortDescription' ? 'Short Description' : 'Long Description'
        })
      });
      if (!res.ok) throw new Error('精简失败');
      const data = await res.json();
      if (data.shortenedText && generatedOutput) {
        setGeneratedOutput({
          ...generatedOutput,
          [fieldKey]: data.shortenedText
        });
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'AI 单字段精简失败');
    } finally {
      setShorteningField(null);
    }
  };

  const handleAutoShortenAll = async () => {
    if (!generatedOutput) return;
    if (generatedOutput.title.length > 30) {
      await handleShortenSingleField('title', generatedOutput.title, 30);
    }
    if (generatedOutput.shortDescription.length > 80) {
      await handleShortenSingleField('shortDescription', generatedOutput.shortDescription, 80);
    }
    if (generatedOutput.longDescription.length > 4000) {
      await handleShortenSingleField('longDescription', generatedOutput.longDescription, 4000);
    }
    setWarningDialog(null);
  };

  const handleCopy = (text: string, sectionKey: string, maxLen?: number) => {
    if (maxLen && text.length > maxLen) {
      setWarningDialog({
        message: `当前复制的内容超出了 Google Play 限制（当前 ${text.length} / 上限 ${maxLen} 字符），建议先使用 AI 一键精简。`,
        action: () => {
          navigator.clipboard.writeText(text);
          setCopiedSection(sectionKey);
          setTimeout(() => setCopiedSection(null), 2000);
          setWarningDialog(null);
        }
      });
      return;
    }
    navigator.clipboard.writeText(text);
    setCopiedSection(sectionKey);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const handleApply = () => {
    if (generatedOutput) {
      onApplyGeneratedCopy(generatedOutput);
      setIsApplied(true);
      setTimeout(() => setIsApplied(false), 2500);
    }
  };

  return (
    <div className="space-y-6">

      {/* Header Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm relative overflow-hidden space-y-3">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-blue-50 border border-blue-100 text-blue-600">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">3. AI 智能 ASO 文案生成</h2>
            <p className="text-xs text-slate-500">
              基于 Google Play Console 官方算法规则与 AppTweak AI 搜索语义相关性指南，结合竞品动态特征分析自动输出。
            </p>
          </div>
        </div>

        <div className="bg-gradient-to-r from-blue-50/80 via-slate-50 to-indigo-50/80 border border-blue-100 rounded-lg p-3 text-[11px] text-slate-600 space-y-1">
          <div className="font-bold text-blue-900 flex items-center space-x-1.5">
            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            <span>智能语义算法与品类置信度 (Dynamic Category Confidence) 说明：</span>
          </div>
          <p className="leading-relaxed">
            • <strong>纯品牌标题锁定</strong>：严格保持输入的原生应用名称作为 Title，不随意叠加任何后缀/修饰词；核心搜索词与品类词优先高频且自然地植入在<strong>短描述（≤80字符）</strong>与长描述前三行（Above-the-Fold）。
          </p>
          <p className="leading-relaxed">
            • <strong>动态品类特征词嵌入</strong>：非静态死板套用词库，系统将根据你输入的<strong>具体产品属性、所属品类与竞品词库</strong>，实时提取并植入领域核心实体词（Entity Words），提升 Google NLP 对应用归类至目标推荐池的置信度。
          </p>
          <p className="leading-relaxed">
            • <strong>AppTweak 密度规范</strong>：严格将长描述核心词密度控制在 <strong>2.0% - 3.5%</strong>，避免堆砌词汇被降权，保持高情感分（Positive Sentiment Score）与自然的自然语言表达。
          </p>
        </div>
      </div>

      {/* Form & Output Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Form Column */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2 border-b border-slate-100 pb-3">
            <Sliders className="w-4 h-4 text-blue-600" />
            <span>输入产品信息与重点关键词</span>
          </h3>

          {/* App Name Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">
              产品名称 (Product Name):
            </label>
            <input
              type="text"
              value={appName}
              onChange={(e) => setAppName(e.target.value)}
              placeholder="例: Rotate 3D / Screw Puzzle"
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
            />
          </div>

          {/* Sub-Genre Category */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">
              所属游戏品类 (Sub-Genre):
            </label>
            <select
              value={subGenre}
              onChange={(e) => setSubGenre(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
            >
              <option value="Games &gt; Puzzle / Physics">Games &gt; Puzzle (物理解谜)</option>
              <option value="Games &gt; Action / Demolition">Games &gt; Action (动作爆破)</option>
              <option value="Games &gt; Casual / Simulation">Games &gt; Casual (极简解压)</option>
              <option value="Games &gt; Arcade">Games &gt; Arcade (街机休闲)</option>
            </select>
          </div>

          {/* Target Keywords Input + Interactive Tag Chips + Quick Multi-Select */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <label className="text-xs font-semibold text-slate-700">
                  重点目标关键词 ({keywordsList.length} 个):
                </label>
                {keywordsList.length > 0 && (
                  <button
                    type="button"
                    onClick={clearAllKeywords}
                    className="text-[10px] text-slate-400 hover:text-red-600 transition cursor-pointer"
                    title="清空所有词"
                  >
                    清空
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => setShowKeywordSelector(!showKeywordSelector)}
                className="text-[11px] text-blue-600 font-bold hover:underline flex items-center space-x-1 cursor-pointer"
              >
                <Tag className="w-3 h-3" />
                <span>{showKeywordSelector ? '收起竞品词库' : '从竞品词库快捷多选导入'}</span>
              </button>
            </div>

            {/* Keyword Chips Container */}
            <div className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 min-h-[90px] focus-within:ring-2 focus-within:ring-blue-100 focus-within:border-blue-500 transition">
              <div className="flex flex-wrap gap-1.5 items-center">
                {keywordsList.map((kw, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center space-x-1 bg-blue-50/90 text-blue-800 border border-blue-200 text-xs font-mono font-medium px-2 py-1 rounded-md group hover:bg-blue-100/90 transition"
                  >
                    <span>{kw}</span>
                    <button
                      type="button"
                      onClick={() => removeKeyword(kw)}
                      className="text-blue-400 hover:text-red-600 rounded p-0.5 transition cursor-pointer ml-0.5"
                      title={`删除关键词: ${kw}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}

                {/* Inline Input Field */}
                <div className="flex items-center flex-1 min-w-[140px] space-x-1">
                  <input
                    type="text"
                    value={newKeywordInput}
                    onChange={(e) => setNewKeywordInput(e.target.value)}
                    onKeyDown={handleInputKeyDown}
                    onBlur={() => {
                      if (newKeywordInput.trim()) {
                        addKeywords(newKeywordInput);
                      }
                    }}
                    placeholder={keywordsList.length === 0 ? "输入关键词，按 Enter 或逗号添加..." : "+ 添加新词..."}
                    className="w-full bg-transparent text-xs text-slate-800 font-mono focus:outline-none placeholder:text-slate-400 py-1"
                  />
                  {newKeywordInput.trim() && (
                    <button
                      type="button"
                      onClick={() => addKeywords(newKeywordInput)}
                      className="p-1 bg-blue-600 text-white rounded text-[10px] font-bold shrink-0 hover:bg-blue-700 transition cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Keyword Multi-Select Picker from Competitor Pool */}
            {showKeywordSelector && (
              <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl space-y-2 text-xs">
                <span className="font-bold text-blue-900 text-[10px] block">
                  点击勾选/取消竞品提取词库（自动同步至上方关键词列表）：
                </span>
                <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
                  {allExtractedKeywords.map((kw, i) => {
                    const isSelected = keywordsList.some(k => k.toLowerCase() === kw.toLowerCase());
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => toggleImportKeyword(kw)}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-mono transition border flex items-center space-x-1 cursor-pointer ${
                          isSelected
                            ? 'bg-blue-600 text-white border-blue-600 font-bold shadow-2xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:border-blue-300 hover:bg-blue-50/50'
                        }`}
                      >
                        <span>{isSelected ? '✓' : '+'}</span>
                        <span>{kw}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Core Features */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700">
                玩法亮点与核心卖点:
              </label>
              <div className="flex items-center space-x-2">
                <span className="text-[11px] text-purple-800 font-bold bg-purple-50 px-2 py-0.5 rounded border border-purple-200/80 flex items-center space-x-1">
                  <Sparkles className={`w-3 h-3 text-purple-600 ${isSummarizingFeatures ? 'animate-spin' : ''}`} />
                  <span>{isSummarizingFeatures ? 'AI 竞品提取中...' : 'AI 已基于竞品分析自动写入'}</span>
                </span>
                <button
                  type="button"
                  onClick={() => handleAutoSynthesizeFeatures()}
                  disabled={isSummarizingFeatures}
                  className="text-[11px] text-slate-500 hover:text-purple-700 transition cursor-pointer underline"
                  title="重新调用 AI 提取竞品卖点"
                >
                  刷新
                </button>
              </div>
            </div>
            <textarea
              value={coreFeaturesInput}
              onChange={(e) => setCoreFeaturesInput(e.target.value)}
              rows={3}
              placeholder="已基于前面竞品分析 AI 自动提炼写入..."
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 leading-relaxed"
            />
          </div>

          {errorMsg && (
            <p className="text-xs text-red-600 bg-red-50 p-2.5 rounded-lg border border-red-200">
              {errorMsg}
            </p>
          )}

          <button
            onClick={handleGenerateAndEvaluate}
            disabled={isLoading}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-2xs transition flex items-center justify-center space-x-2 disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>正在根据算法生成 ASO 文案...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>生成美区 ASO 商店文案</span>
              </>
            )}
          </button>
        </div>

        {/* Output Column */}
        <div className="lg:col-span-7 space-y-5">
          
          {generatedOutput ? (
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-5">
              
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>生成结果与字符规则校验</span>
                </h3>

                <button
                  onClick={handleApply}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 ${
                    isApplied ? 'bg-emerald-600 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white shadow-2xs'
                  }`}
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{isApplied ? '已同步至项目' : '同步应用至当前项目'}</span>
                </button>
              </div>

              {/* Title Result */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1.5">
                <div className="flex items-center justify-between text-[10px] text-slate-500 font-bold">
                  <div className="flex items-center space-x-2">
                    <span>标题 (TITLE - {generatedOutput.title.length}/30 字符):</span>
                    {generatedOutput.title.length <= 30 ? (
                      <span className="text-[9px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-bold border border-emerald-200">
                        ✓ 符合 30 字符限制
                      </span>
                    ) : (
                      <span className="text-[9px] bg-red-50 text-red-700 px-1.5 py-0.5 rounded font-bold border border-red-200 flex items-center space-x-1">
                        <span>✕ 超出 {generatedOutput.title.length - 30} 字符</span>
                      </span>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    {generatedOutput.title.length > 30 && (
                      <button
                        onClick={() => handleShortenSingleField('title', generatedOutput.title, 30)}
                        disabled={shorteningField === 'title'}
                        className="text-[10px] bg-blue-600 hover:bg-blue-700 text-white font-bold px-2 py-0.5 rounded-md flex items-center space-x-1 cursor-pointer transition shadow-2xs disabled:opacity-50"
                      >
                        {shorteningField === 'title' ? (
                          <div className="w-2.5 h-2.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Sparkles className="w-3 h-3" />
                        )}
                        <span>✨ AI 智能一键精简</span>
                      </button>
                    )}
                    <button onClick={() => handleCopy(generatedOutput.title, 'genTitle', 30)} className="text-blue-600 hover:underline cursor-pointer">
                      {copiedSection === 'genTitle' ? '已复制' : '复制'}
                    </button>
                  </div>
                </div>
                <p className="font-bold text-slate-900 text-xs font-mono">{generatedOutput.title}</p>
                
                <SmartWordTrimmer
                  text={generatedOutput.title}
                  maxLength={30}
                  label="Title"
                  onApplyTrimmed={(trimmed) => setGeneratedOutput({ ...generatedOutput, title: trimmed })}
                  onShortenWithAi={() => handleShortenSingleField('title', generatedOutput.title, 30)}
                  isAiLoading={shorteningField === 'title'}
                />
              </div>

              {/* Short Desc Result */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1.5">
                <div className="flex items-center justify-between text-[10px] text-slate-500 font-bold">
                  <div className="flex items-center space-x-2">
                    <span>短描述 (SHORT DESCRIPTION - {generatedOutput.shortDescription.length}/80 字符):</span>
                    {generatedOutput.shortDescription.length <= 80 ? (
                      <span className="text-[9px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-bold border border-emerald-200">
                        ✓ 符合 80 字符限制
                      </span>
                    ) : (
                      <span className="text-[9px] bg-red-50 text-red-700 px-1.5 py-0.5 rounded font-bold border border-red-200">
                        ✕ 超出 {generatedOutput.shortDescription.length - 80} 字符
                      </span>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    {generatedOutput.shortDescription.length > 80 && (
                      <button
                        onClick={() => handleShortenSingleField('shortDescription', generatedOutput.shortDescription, 80)}
                        disabled={shorteningField === 'shortDescription'}
                        className="text-[10px] bg-blue-600 hover:bg-blue-700 text-white font-bold px-2 py-0.5 rounded-md flex items-center space-x-1 cursor-pointer transition shadow-2xs disabled:opacity-50"
                      >
                        {shorteningField === 'shortDescription' ? (
                          <div className="w-2.5 h-2.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Sparkles className="w-3 h-3" />
                        )}
                        <span>✨ AI 智能一键精简</span>
                      </button>
                    )}
                    <button onClick={() => handleCopy(generatedOutput.shortDescription, 'genShort', 80)} className="text-blue-600 hover:underline cursor-pointer">
                      {copiedSection === 'genShort' ? '已复制' : '复制'}
                    </button>
                  </div>
                </div>
                <p className="font-semibold text-slate-800 text-xs font-mono">{generatedOutput.shortDescription}</p>

                <SmartWordTrimmer
                  text={generatedOutput.shortDescription}
                  maxLength={80}
                  label="Short Description"
                  onApplyTrimmed={(trimmed) => setGeneratedOutput({ ...generatedOutput, shortDescription: trimmed })}
                  onShortenWithAi={() => handleShortenSingleField('shortDescription', generatedOutput.shortDescription, 80)}
                  isAiLoading={shorteningField === 'shortDescription'}
                />
              </div>

              {/* Long Desc Result */}
              <div>
                <FormattedDescriptionView
                  text={generatedOutput.longDescription}
                  title="生成英文长描述 (Long Description)"
                  onCopy={() => handleCopy(generatedOutput.longDescription, 'genLong', 4000)}
                  copied={copiedSection === 'genLong'}
                />

                <SmartWordTrimmer
                  text={generatedOutput.longDescription}
                  maxLength={4000}
                  label="Long Description"
                  onApplyTrimmed={(trimmed) => setGeneratedOutput({ ...generatedOutput, longDescription: trimmed })}
                  onShortenWithAi={() => handleShortenSingleField('longDescription', generatedOutput.longDescription, 4000)}
                  isAiLoading={shorteningField === 'longDescription'}
                />
              </div>

            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-400 space-y-3 shadow-sm">
              <Bot className="w-10 h-10 mx-auto text-slate-300" />
              <p className="text-xs">填入产品名称与重点关键词后，点击「生成美区 ASO 商店文案」获取高转化 ASO 文本。</p>
            </div>
          )}

        </div>

      </div>

      {/* Over Limit Warning & Auto-Fix Modal */}
      {warningDialog && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-2xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center space-x-3 text-amber-600">
              <div className="p-2 bg-amber-50 rounded-lg border border-amber-200">
                <HelpCircle className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-sm text-slate-900">字符长度溢出友情提示</h3>
            </div>
            
            <p className="text-xs text-slate-600 leading-relaxed">
              {warningDialog.message}
            </p>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
              <button
                onClick={warningDialog.action}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                仍要直接复制
              </button>

              <button
                onClick={handleAutoShortenAll}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-2xs transition flex items-center space-x-1.5 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>✨ 一键 AI 自动精简</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
