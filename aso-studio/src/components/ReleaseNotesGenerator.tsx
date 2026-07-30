import React, { useState } from 'react';
import { ReleaseNotes } from '../types';
import { FileText, Sparkles, Copy, Check, RefreshCw, Send, CheckCircle2, Zap, AlertCircle } from 'lucide-react';
import { SmartWordTrimmer } from './SmartWordTrimmer';

interface ReleaseNotesGeneratorProps {
  appName: string;
}

export const ReleaseNotesGenerator: React.FC<ReleaseNotesGeneratorProps> = ({ appName }) => {
  const [version, setVersion] = useState('v1.0.0');
  const [isFirstLaunch, setIsFirstLaunch] = useState(true);
  const [updatesInput, setUpdatesInput] = useState('首发上线！优化游戏流畅度与物理爆破体验，新增丰富关卡玩法与特种音效，支持离线流畅游玩。');
  const [isLoading, setIsLoading] = useState(false);
  const [notes, setNotes] = useState<ReleaseNotes | null>(null);
  const [activeVariantTab, setActiveVariantTab] = useState<'concise' | 'highlights' | 'exciting'>('concise');
  const [activeLangTab, setActiveLangTab] = useState<'en' | 'zh'>('en');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isShortening, setIsShortening] = useState(false);
  const [warningDialog, setWarningDialog] = useState<{ message: string; action: () => void } | null>(null);

  const handleShortenCurrentNote = async () => {
    if (!notes) return;
    const langKey = activeLangTab === 'en' ? 'english' : 'chinese';
    const textToShorten = notes[langKey][activeVariantTab];
    const limit = activeVariantTab === 'concise' ? 80 : 100;
    if (!textToShorten || textToShorten.length <= limit) return;

    setIsShortening(true);
    try {
      const res = await fetch('/api/gemini/shorten-field', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: textToShorten,
          maxLen: limit,
          fieldName: `Release Note (${activeVariantTab})`
        })
      });
      if (!res.ok) throw new Error('精简失败');
      const data = await res.json();
      if (data.shortenedText) {
        setNotes({
          ...notes,
          [langKey]: {
            ...notes[langKey],
            [activeVariantTab]: data.shortenedText
          }
        });
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'AI 单字段精简失败');
    } finally {
      setIsShortening(false);
      setWarningDialog(null);
    }
  };

  const handleGenerate = async () => {
    setIsLoading(true);
    setErrorMsg(null);

    try {
      const response = await fetch('/api/gemini/generate-release-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appName: appName || 'Smash Cannon 3D',
          version,
          updates: updatesInput,
          isFirstLaunch
        })
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || '生成更新日志失败');
      }

      const data = await response.json();
      setNotes(data);
    } catch (err: any) {
      setErrorMsg(err.message || '生成日志时发生错误');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = (text: string, key: string) => {
    if (text.length > maxAllowedLen) {
      setWarningDialog({
        message: `当前版本日志超出了字符限制（当前 ${text.length} / 上限 ${maxAllowedLen} 字符），建议使用 AI 一键精简。`,
        action: () => {
          navigator.clipboard.writeText(text);
          setCopiedKey(key);
          setTimeout(() => setCopiedKey(null), 2000);
          setWarningDialog(null);
        }
      });
      return;
    }
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const getCurrentVariantText = () => {
    if (!notes) return '';
    const langObj = activeLangTab === 'en' ? notes.english : notes.chinese;
    return langObj[activeVariantTab] || '';
  };

  const currentText = getCurrentVariantText();
  const maxAllowedLen = activeVariantTab === 'concise' ? 80 : 100;
  const textLength = currentText.length;
  const isCompliant = textLength <= maxAllowedLen;

  return (
    <div className="space-y-6">

      {/* Top Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-blue-50 border border-blue-100 text-blue-600">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">4. 首版版本更新日志模式 (Release Notes Generator)</h2>
            <p className="text-xs text-slate-500">
              专为 Google Play 与 App Store 首发及版本更新打造。自动生成精炼简短的更新文案（控制在 100 字符以内）与多种风格变体。
            </p>
          </div>
        </div>
      </div>

      {/* Generator Form & Output Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Input Form Column */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3">
            设定更新参数与版本号
          </h3>

          {/* Version */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">
              版本号 (Version Number):
            </label>
            <input
              type="text"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              placeholder="v1.0.0"
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
            />
          </div>

          {/* First Launch Toggle */}
          <div className="flex items-center justify-between bg-blue-50/60 p-3 rounded-xl border border-blue-100">
            <div>
              <span className="text-xs font-bold text-blue-900 block">首发上线版本 (v1.0 First Launch)</span>
              <p className="text-[10px] text-blue-700">勾选将针对游戏/应用首发推荐算法定制更新语</p>
            </div>
            <input
              type="checkbox"
              checked={isFirstLaunch}
              onChange={(e) => setIsFirstLaunch(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 bg-white border-slate-300"
            />
          </div>

          {/* Update Details */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">
              本版本更新要点 / 首发特性描述:
            </label>
            <textarea
              value={updatesInput}
              onChange={(e) => setUpdatesInput(e.target.value)}
              rows={4}
              placeholder="描述此版本的更新内容或首发特性..."
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
            />
          </div>

          {errorMsg && (
            <p className="text-xs text-red-600 bg-red-50 p-2.5 rounded-lg border border-red-200">
              {errorMsg}
            </p>
          )}

          <button
            onClick={handleGenerate}
            disabled={isLoading}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-2xs transition flex items-center justify-center space-x-2 disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>正在生成多版样式日志...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>生成不同样式版本更新文案</span>
              </>
            )}
          </button>
        </div>

        {/* Output Column */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-3 gap-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
              <Zap className="w-4 h-4 text-blue-600" />
              <span>不同样式版本更新文案</span>
            </h3>

            {notes && (
              <div className="bg-slate-100 p-1 rounded-lg border border-slate-200 flex text-xs font-bold">
                <button
                  onClick={() => setActiveLangTab('en')}
                  className={`px-3 py-1 rounded-md transition ${
                    activeLangTab === 'en' ? 'bg-blue-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  英文 (EN)
                </button>
                <button
                  onClick={() => setActiveLangTab('zh')}
                  className={`px-3 py-1 rounded-md transition ${
                    activeLangTab === 'zh' ? 'bg-blue-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  中文 (ZH)
                </button>
              </div>
            )}
          </div>

          {notes ? (
            <div className="space-y-4">
              
              {/* Style Variant Tabs */}
              <div className="grid grid-cols-3 gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200 text-xs font-bold">
                <button
                  onClick={() => setActiveVariantTab('concise')}
                  className={`py-2 rounded-lg transition text-center flex flex-col items-center justify-center ${
                    activeVariantTab === 'concise'
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <span>⚡ 一句话简短版</span>
                  <span className="text-[9px] opacity-80">(80字符以内)</span>
                </button>

                <button
                  onClick={() => setActiveVariantTab('highlights')}
                  className={`py-2 rounded-lg transition text-center flex flex-col items-center justify-center ${
                    activeVariantTab === 'highlights'
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <span>🌟 核心要点版</span>
                  <span className="text-[9px] opacity-80">(100字符以内)</span>
                </button>

                <button
                  onClick={() => setActiveVariantTab('exciting')}
                  className={`py-2 rounded-lg transition text-center flex flex-col items-center justify-center ${
                    activeVariantTab === 'exciting'
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <span>🔥 玩家吸引版</span>
                  <span className="text-[9px] opacity-80">(100字符以内)</span>
                </button>
              </div>

              {/* Character Limit Badge */}
              <div className="flex items-center justify-between text-xs px-1">
                <span className="text-[11px] font-bold text-slate-500">
                  当前字数: <span className={`font-mono ${isCompliant ? 'text-emerald-600' : 'text-amber-600 font-bold'}`}>{textLength}</span> / {maxAllowedLen} 字符限制
                </span>
                <div className="flex items-center space-x-2">
                  {!isCompliant && (
                    <button
                      onClick={handleShortenCurrentNote}
                      disabled={isShortening}
                      className="text-[10px] bg-blue-600 hover:bg-blue-700 text-white font-bold px-2.5 py-1 rounded-lg flex items-center space-x-1 cursor-pointer transition shadow-2xs disabled:opacity-50"
                    >
                      {isShortening ? (
                        <div className="w-2.5 h-2.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Sparkles className="w-3 h-3" />
                      )}
                      <span>✨ AI 智能一键精简</span>
                    </button>
                  )}
                  {isCompliant ? (
                    <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded font-bold border border-emerald-200 flex items-center space-x-1">
                      <Check className="w-3 h-3" />
                      <span>符合 {maxAllowedLen} 字符限制标准</span>
                    </span>
                  ) : (
                    <span className="text-[10px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded font-bold border border-amber-200 flex items-center space-x-1">
                      <AlertCircle className="w-3 h-3" />
                      <span>超出 {textLength - maxAllowedLen} 字符</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Content Display Card */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3 min-h-40">
                <div className="flex justify-between items-center text-[11px] border-b border-slate-200/80 pb-2">
                  <span className="font-bold text-slate-800 font-mono">
                    {version} - {activeLangTab === 'en' ? 'English Version Log' : '中文版本日志'}
                  </span>
                  <button
                    onClick={() => handleCopy(currentText, 'releaseNote')}
                    className="text-xs text-blue-600 hover:underline font-bold flex items-center space-x-1 bg-white px-2.5 py-1 rounded border border-slate-200 shadow-2xs"
                  >
                    {copiedKey === 'releaseNote' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey === 'releaseNote' ? '已复制' : '一键复制文案'}</span>
                  </button>
                </div>

                <p className="text-xs text-slate-800 leading-relaxed font-mono whitespace-pre-line bg-white p-3 rounded-lg border border-slate-200">
                  {currentText}
                </p>

                <SmartWordTrimmer
                  text={currentText}
                  maxLength={maxAllowedLen}
                  label={`Release Notes (${activeVariantTab})`}
                  onApplyTrimmed={(trimmed) => {
                    if (notes) {
                      const langKey = activeLangTab === 'en' ? 'english' : 'chinese';
                      setNotes({
                        ...notes,
                        [langKey]: {
                          ...notes[langKey],
                          [activeVariantTab]: trimmed
                        }
                      });
                    }
                  }}
                  onShortenWithAi={handleShortenCurrentNote}
                  isAiLoading={isShortening}
                />
              </div>

            </div>
          ) : (
            <div className="h-64 border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center text-center p-6 text-slate-400 space-y-3">
              <FileText className="w-10 h-10 text-slate-300" />
              <p className="text-xs max-w-xs">
                输入版本号与首发要点，点击「生成不同样式版本更新文案」一键获取一句话短文案（80 字符以内）。
              </p>
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
                <AlertCircle className="w-5 h-5" />
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
                onClick={handleShortenCurrentNote}
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
