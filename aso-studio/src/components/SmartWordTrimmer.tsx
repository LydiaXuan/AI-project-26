import React, { useState, useMemo } from 'react';
import { Scissors, Sparkles, AlertTriangle, Check, ArrowRight, RefreshCw, Trash2 } from 'lucide-react';

interface SmartWordTrimmerProps {
  text: string;
  maxLength: number;
  label: string;
  onApplyTrimmed: (trimmedText: string) => void;
  onShortenWithAi?: () => Promise<void>;
  isAiLoading?: boolean;
}

// Common filler/redundant words in English and Chinese for quick trimming suggestions
const COMMON_FILLERS_EN = [
  'very', 'really', 'ultimate', 'amazing', 'awesome', 'totally', 'brand new', 'now available',
  'extremely', 'completely', 'the most', 'best ever', 'all new', 'just', 'absolutely',
  'super', 'experience', 'unbeatable', 'incredible', 'fantastic', 'dive into', 'get ready for'
];

const COMMON_FILLERS_ZH = [
  '非常', '极其', '超级', '全新的', '绝佳的', '完全', '立马', '马上', '体验', '尽情', '独家', '第一', '最强'
];

export const SmartWordTrimmer: React.FC<SmartWordTrimmerProps> = ({
  text,
  maxLength,
  label,
  onApplyTrimmed,
  onShortenWithAi,
  isAiLoading = false
}) => {
  const [customTrim, setCustomTrim] = useState<string>(text);

  const overflowCount = Math.max(0, text.length - maxLength);
  const isOverflow = overflowCount > 0;

  // Split text into safe and overflow parts
  const safePart = text.slice(0, maxLength);
  const overflowPart = text.slice(maxLength);

  // Find quick redundant filler words present in current text
  const detectedFillers = useMemo(() => {
    const list: string[] = [];
    const lower = text.toLowerCase();
    
    for (const word of COMMON_FILLERS_EN) {
      if (lower.includes(word)) {
        list.push(word);
      }
    }
    for (const word of COMMON_FILLERS_ZH) {
      if (text.includes(word)) {
        list.push(word);
      }
    }
    return list;
  }, [text]);

  // Handle removing a detected word
  const handleRemoveWord = (wordToRemove: string) => {
    const regex = new RegExp(wordToRemove, 'gi');
    const cleaned = text.replace(regex, '').replace(/\s{2,}/g, ' ').replace(/\s+([,.!?])/g, '$1').trim();
    onApplyTrimmed(cleaned);
  };

  // Quick smart clean cut at sentence boundary or word boundary
  const handleQuickTruncate = () => {
    let sliced = text.slice(0, maxLength);
    if (/\s/.test(sliced) && maxLength <= 120) {
      const lastSpace = sliced.lastIndexOf(' ');
      if (lastSpace > Math.floor(maxLength * 0.6)) {
        sliced = sliced.slice(0, lastSpace);
      }
    }
    const cleaned = sliced.replace(/[\s,;:，；：.]*$/, '').trim();
    onApplyTrimmed(cleaned);
  };

  if (!isOverflow) {
    return null;
  }

  return (
    <div className="mt-3 bg-amber-50/90 border border-amber-200 rounded-xl p-3.5 space-y-3 text-xs shadow-2xs animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2 text-amber-900 font-bold">
          <div className="p-1 bg-amber-100 rounded-md border border-amber-300">
            <Scissors className="w-3.5 h-3.5 text-amber-700" />
          </div>
          <span>【智能语义高亮与删词助手】 {label} 超出 <span className="text-red-700 font-mono font-black">{overflowCount}</span> 字符</span>
        </div>

        {onShortenWithAi && (
          <button
            onClick={onShortenWithAi}
            disabled={isAiLoading}
            className="px-2.5 py-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-lg shadow-2xs transition flex items-center space-x-1 cursor-pointer text-[11px] disabled:opacity-50"
          >
            {isAiLoading ? (
              <RefreshCw className="w-3 h-3 animate-spin" />
            ) : (
              <Sparkles className="w-3 h-3 text-amber-200" />
            )}
            <span>AI 重构精简</span>
          </button>
        )}
      </div>

      {/* Visual Character Overflow Highlighting */}
      <div className="bg-white p-2.5 rounded-lg border border-amber-200 font-mono text-[11px] leading-relaxed break-words">
        <span className="text-slate-800">{safePart}</span>
        <mark className="bg-red-200 text-red-900 font-bold px-1 rounded-xs underline decoration-red-500 decoration-2 ml-0.5" title="超出字数限制的部分">
          {overflowPart}
        </mark>
      </div>

      {/* Suggested Trimmings / Redundant Words */}
      <div className="space-y-1.5 pt-1 border-t border-amber-200/60">
        <div className="text-[11px] font-bold text-amber-900 flex items-center justify-between">
          <span>可删除的冗余修饰词建议 (点击直接扣除)：</span>
          <button
            onClick={handleQuickTruncate}
            className="text-[10px] text-amber-800 hover:text-amber-950 font-bold underline cursor-pointer"
          >
            按自然词界直接裁切 (-{overflowCount}字)
          </button>
        </div>

        {detectedFillers.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {detectedFillers.map((word, idx) => (
              <button
                key={idx}
                onClick={() => handleRemoveWord(word)}
                className="px-2 py-0.5 bg-red-100 hover:bg-red-200 text-red-800 rounded-md border border-red-200 font-mono text-[10px] flex items-center space-x-1 transition cursor-pointer group"
                title={`点击在文本中剔除词汇 "${word}"`}
              >
                <Trash2 className="w-2.5 h-2.5 text-red-600 group-hover:scale-110 transition" />
                <span>剔除 "{word}"</span>
              </button>
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-amber-700 italic">
            未检测到明显副词/形容词冗余，建议使用 AI 重构或手动微调句子结构。
          </p>
        )}
      </div>
    </div>
  );
};
