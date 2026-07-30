import React from 'react';
import { X, Lightbulb, CheckCircle2, Rocket, Zap, ShieldAlert, Sparkles, Globe2, BarChart2 } from 'lucide-react';

interface AsoSuggestionsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AsoSuggestionsModal: React.FC<AsoSuggestionsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-3xl w-full p-6 shadow-xl relative space-y-6 text-slate-800 max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center space-x-2.5">
            <Lightbulb className="w-5 h-5 text-blue-600" />
            <div>
              <h2 className="text-base font-bold text-slate-900">ASO 工作台已实现功能总结与后续优化建议</h2>
              <p className="text-xs text-slate-500">系统成果梳理及进阶增长功能规划</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg bg-slate-50 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="space-y-5 text-xs text-slate-700 leading-relaxed">

          {/* Section 1: Accomplished Features Summary */}
          <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 space-y-3">
            <h3 className="font-bold text-blue-700 text-sm flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>✅ 5 大核心功能模块对接完成情况：</span>
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-1 shadow-xs">
                <span className="font-bold text-slate-900">1. 竞品抽取与中英对照解析</span>
                <p className="text-slate-500 text-[11px]">支持解析竞品 Title/Short/Long Description，完成精准中英对照翻译、高频词分类（动作词/实体词/情感词/类别词）与玩法特色抽取。</p>
              </div>

              <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-1 shadow-xs">
                <span className="font-bold text-slate-900">2. Google Play 商店模拟器</span>
                <p className="text-slate-500 text-[11px]">还原 Android 真机商店外观，高亮目标关键词分布，内置 3D 画质游戏截图画廊与自定义中文卖点字幕。</p>
              </div>

              <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-1 shadow-xs">
                <span className="font-bold text-slate-900">3. 词频密度与防堆砌分析</span>
                <p className="text-slate-500 text-[11px]">实时监控 2.0% - 3.5% 黄金密度，触发 &gt;3.5% 堆砌降权预警，并集成实时在线编辑器。</p>
              </div>

              <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-1 shadow-xs">
                <span className="font-bold text-slate-900">4. 版本更新日志生成器</span>
                <p className="text-slate-500 text-[11px]">支持首发 v1.0 及后续迭代，输出“精彩亮点版”、“一句话简洁版”与“爽快宣传版”并带双语一键复制。</p>
              </div>

              <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-1 md:col-span-2 shadow-xs">
                <span className="font-bold text-slate-900">5. Gemini AI 商业算法优化器</span>
                <p className="text-slate-500 text-[11px]">调用 Gemini 3.6 Flash 模型，根据关键词与品类契合度一键撰写全套高转化 ASO 标杆文案。</p>
              </div>
            </div>
          </div>

          {/* Section 2: Future Expansion & Recommendations */}
          <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 space-y-3">
            <h3 className="font-bold text-blue-700 text-sm flex items-center space-x-2">
              <Rocket className="w-4 h-4" />
              <span>🚀 进阶优化与可新增扩展功能建议（Future Roadmap）：</span>
            </h3>

            <div className="space-y-2.5">
              
              <div className="p-3 bg-white rounded-lg border border-slate-200 flex items-start space-x-3 shadow-xs">
                <Globe2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-slate-900">1. 多语言定制化商店面 (Custom Store Listings & Multi-Region Localization)</h4>
                  <p className="text-slate-500 text-[11px] mt-0.5">
                    根据 AppTweak 建议，不同国家搜索偏好差异巨大。后续可扩展德国 (DE)、日本 (JA)、西班牙 (ES)、韩国 (KR) 的本土化文案生成与 Cultural Adaption 自动配词。
                  </p>
                </div>
              </div>

              <div className="p-3 bg-white rounded-lg border border-slate-200 flex items-start space-x-3 shadow-xs">
                <BarChart2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-slate-900">2. A/B 测试素材变体生成器 (Store Listing A/B Experiments)</h4>
                  <p className="text-slate-500 text-[11px] mt-0.5">
                    一键同时生成 3 套差异化长短描述与不同配色主题的截图（例如：聚焦物理拆除 vs. 聚焦烧脑解谜），直接导入 Google Play Console 开展 A/B 实验。
                  </p>
                </div>
              </div>

              <div className="p-3 bg-white rounded-lg border border-slate-200 flex items-start space-x-3 shadow-xs">
                <Sparkles className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-slate-900">3. Google Play Publishing API 自动更新对接</h4>
                  <p className="text-slate-500 text-[11px] mt-0.5">
                    通过 Play Developer API 密钥，实现在本工作台中点击“一键上传”，直接将调优好的文案与更新日志一键发布至谷歌开发者后台草稿箱。
                  </p>
                </div>
              </div>

              <div className="p-3 bg-white rounded-lg border border-slate-200 flex items-start space-x-3 shadow-xs">
                <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-slate-900">4. 玩家评论情绪与关键词监测 (Review Sentiment Analysis)</h4>
                  <p className="text-slate-500 text-[11px] mt-0.5">
                    抓取上线后玩家在 Play 商店的评价，利用 Gemini 识别高频抱怨词与赞赏词，将玩家口中的爆词（例: "satisfying explosion", "ragdoll physics"）反哺回商店长描述中。
                  </p>
                </div>
              </div>

            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-lg shadow-sm transition"
          >
            关闭并继续使用
          </button>
        </div>

      </div>
    </div>
  );
};
