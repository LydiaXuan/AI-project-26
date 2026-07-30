import React from 'react';
import { Copy, Check, FileText } from 'lucide-react';

interface FormattedDescriptionViewProps {
  text: string;
  translatedText?: string;
  title?: string;
  maxLength?: number;
  onCopy?: () => void;
  copied?: boolean;
}

export function formatLongDescriptionText(rawText: string): string {
  if (!rawText) return '';
  // Unescape literal \n strings if present from raw JSON stringification
  let clean = rawText.replace(/\\n/g, '\n');

  // Normalize excessive empty lines to maximum 2 newlines
  clean = clean.replace(/\n{3,}/g, '\n\n');

  // If text has no newlines or very few newlines despite being long (>150 chars),
  // auto-insert linebreaks before common headers, emojis, and bullet points!
  if (!clean.includes('\n') || (clean.length > 150 && clean.split('\n').length < 3)) {
    clean = clean
      .replace(/([.!?]|[\u4e00-\u9fa5])\s*([A-Z0-9\s—–-]{3,35}:)/g, '$1\n\n$2')
      .replace(/([.!?]|[\u4e00-\u9fa5])\s*([\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}])/gu, '$1\n\n$2')
      .replace(/([.!?]|[\u4e00-\u9fa5])\s*([•\-*]\s+|[0-9]+\.\s+)/g, '$1\n$2');
  }

  return clean.trim();
}

export const FormattedDescriptionView: React.FC<FormattedDescriptionViewProps> = ({
  text,
  translatedText,
  title = "英文长描述原文 (Long Description)",
  maxLength = 4000,
  onCopy,
  copied = false
}) => {
  const formattedEn = formatLongDescriptionText(text);
  const formattedZh = translatedText ? formatLongDescriptionText(translatedText) : '';

  return (
    <div className="space-y-2">
      {/* Header bar with title, length and copy button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <FileText className="w-4 h-4 text-blue-600 shrink-0" />
          <span className="text-xs font-bold text-slate-800">{title}</span>
          <span className="text-[11px] font-mono font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
            {formattedEn.length} / {maxLength} 字符
          </span>
        </div>

        {onCopy && (
          <button
            onClick={onCopy}
            className="text-xs text-blue-600 font-bold hover:bg-blue-50 px-2.5 py-1 rounded-lg transition border border-transparent hover:border-blue-200 flex items-center space-x-1 cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-600">已复制</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>复制长描述</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Direct Google Play Store raw text rendering with native linebreaks and formatting */}
      <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-4 text-xs sm:text-sm font-normal text-slate-900 font-sans leading-relaxed max-h-96 overflow-y-auto whitespace-pre-wrap">
        {formattedEn}
      </div>

      {/* Optional Chinese translation reference */}
      {formattedZh && (
        <details className="mt-2 text-xs text-slate-500 font-normal group">
          <summary className="cursor-pointer text-blue-600 hover:underline font-bold py-1">
            查看中文参考翻译全文
          </summary>
          <div className="mt-2 bg-slate-50/50 p-3.5 rounded-xl border border-slate-200/60 whitespace-pre-wrap leading-relaxed text-slate-700 font-sans text-xs sm:text-sm">
            {formattedZh}
          </div>
        </details>
      )}
    </div>
  );
};
