import React from 'react';
import { X, CheckCircle2, AlertTriangle, ExternalLink, BookOpen, Layers } from 'lucide-react';

interface AlgorithmGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AlgorithmGuideModal: React.FC<AlgorithmGuideModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-3xl w-full p-6 shadow-xl relative space-y-5 text-slate-800 max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center space-x-2.5">
            <BookOpen className="w-5 h-5 text-blue-600" />
            <div>
              <h2 className="text-base font-bold text-slate-900">Google Play Store ASO 算法与文案优化最佳实践</h2>
              <p className="text-xs text-slate-500">结合 Play 管理中心帮助文档与 AppTweak 算法优化指南</p>
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
        <div className="space-y-4 text-xs leading-relaxed text-slate-700">

          {/* 1. Play Store Hard Character Limits */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
            <h3 className="font-bold text-blue-700 text-sm flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>1. 谷歌商店硬性字段限制 (Google Play Field Constraints)</span>
            </h3>
            <ul className="list-disc pl-5 space-y-1 text-slate-700">
              <li><strong>应用标题 (App Title):</strong> 严格限制 <strong>30 个字符</strong>（英文含空格）。建议为干净的原名或组合品牌词，严禁附加无意义后缀。</li>
              <li><strong>简短说明 (Short Description):</strong> 严格限制 <strong>80 个字符</strong>。在搜索结果与第一屏显眼展示，嵌入核心搜索词与高意向卖点，负责提升安装转化率 (CVR)。</li>
              <li><strong>完整说明 (Long Description):</strong> 上限 <strong>4,000 个字符</strong>。用于谷歌 Play 搜索索引与 AI 语义向量建库，需保持清晰排版（标题、双换行、项目符号）。</li>
            </ul>
          </div>

          {/* 2. AppTweak AI Search & Semantic Vector Indexing */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2.5">
            <h3 className="font-bold text-blue-700 text-sm flex items-center space-x-2">
              <Layers className="w-4 h-4" />
              <span>2. AppTweak AI 搜索与向量索引算法 (AI Semantic & Vector Optimization)</span>
            </h3>
            <ul className="list-disc pl-5 space-y-1.5 text-slate-700">
              <li>
                <strong>AI 语义与向量索引 (Vector Embeddings):</strong> 谷歌 Play 及生成式 AI（Gemini, ChatGPT 推荐引擎）依靠语义向量进行智能匹配。文案自然融合 LSA 潜在语义相关词与长尾搜索短语，大幅提升 AI 推荐权重。
              </li>
              <li>
                <strong>品类置信度算法 (Category Confidence Score):</strong> 算法根据动词、特征词与竞品词谱计算应用与目标品类的匹配度，使应用优先进入「相似应用推荐 (Similar Apps)」推流池。
              </li>
              <li>
                <strong>竞品词缝隙覆盖 (Competitor Keyword Gap):</strong> 智能比对竞品元数据，补齐行业核心高转化变现词与差异化卖点。
              </li>
            </ul>
          </div>

          {/* 3. Keyword Density & Anti-Stuffing */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
            <h3 className="font-bold text-blue-700 text-sm flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>3. 关键词密度黄金法则 (2.0% - 3.5%)</span>
            </h3>
            <p>
              谷歌商店算法自动抓取与分析长描述。核心目标关键词的频次密度应控制在 <strong>2.0% 至 3.5%</strong> 之间，既保证索引深度，又保持极佳阅读体验。
            </p>
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 space-y-1">
              <span className="font-bold flex items-center space-x-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>防过度堆砌警示 (Keyword Stuffing Penalty):</span>
              </span>
              <p>关键词密度高于 4.0% 或无意义罗列（例: "physics physics cannon cannon smash smash"）会触发谷歌降权机制，导致搜索排名急剧下滑！</p>
            </div>
          </div>

          {/* 4. Google Play Metadata Policy & Forbidden Terms */}
          <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 space-y-2.5">
            <h3 className="font-bold text-amber-900 text-sm flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-amber-700" />
              <span>4. 谷歌 Play 商店元数据政策红线 (Google Play Policy)</span>
            </h3>
            <p className="text-amber-950 font-semibold">
              为防止应用上架被驳回或封禁，生成引擎严格遵循 Google Play Console 开发者政策：
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-amber-900">
              <li>
                <strong>严禁绝对化数字与百分比 (Definitive Stats):</strong> 禁止使用 <span className="font-mono font-bold text-red-700 bg-red-100 px-1 rounded-xs">200+</span>, <span className="font-mono font-bold text-red-700 bg-red-100 px-1 rounded-xs">100%</span>, <span className="font-mono font-bold text-red-700 bg-red-100 px-1 rounded-xs">10,000+</span>, <span className="font-mono font-bold text-red-700 bg-red-100 px-1 rounded-xs">100% Free</span> 等太确定的绝对数字/比例声明。生成引擎会自动替换为定性修饰词（如 <i>hundreds of levels</i>, <i>endless challenges</i>, <i>free to play</i>）。
              </li>
              <li>
                <strong>严禁榜单/最高级词汇 (Superlatives & Ranking Claims):</strong> 禁止出现 <span className="font-mono font-bold text-red-700 bg-red-100 px-1 rounded-xs">Top</span>, <span className="font-mono font-bold text-red-700 bg-red-100 px-1 rounded-xs">#1</span>, <span className="font-mono font-bold text-red-700 bg-red-100 px-1 rounded-xs">Best</span>, <span className="font-mono font-bold text-red-700 bg-red-100 px-1 rounded-xs">No.1 Choice</span>, <span className="font-mono font-bold text-red-700 bg-red-100 px-1 rounded-xs">World's Best</span> 等未经核实的榜单排名声明。
              </li>
              <li>
                <strong>严禁促销与强诱导口号 (Promotional & Urgency Slogans):</strong> 禁止在标题/元数据中包含 <span className="font-mono font-bold text-red-700 bg-red-100 px-1 rounded-xs">Free</span>, <span className="font-mono font-bold text-red-700 bg-red-100 px-1 rounded-xs">Sale</span>, <span className="font-mono font-bold text-red-700 bg-red-100 px-1 rounded-xs">Discount</span>, <span className="font-mono font-bold text-red-700 bg-red-100 px-1 rounded-xs">Download Now</span>, <span className="font-mono font-bold text-red-700 bg-red-100 px-1 rounded-xs">Play Now!</span> 等价格或行动诱导。
              </li>
            </ul>
          </div>

          {/* Official References */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
            <h3 className="font-bold text-slate-900 text-sm">相关官方与行业参考链接：</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
              <a
                href="https://www.apptweak.com/en/aso-blog/app-store-optimization-aso-checklist-for-google-play"
                target="_blank"
                rel="noreferrer"
                className="p-2 bg-white rounded-lg border border-slate-200 text-blue-600 hover:underline flex items-center justify-between shadow-xs"
              >
                <span>AppTweak Google Play ASO Checklist</span>
                <ExternalLink className="w-3 h-3" />
              </a>
              <a
                href="https://www.apptweak.com/zh-cn/aso-blog/ai-reshaping-app-store-relevance"
                target="_blank"
                rel="noreferrer"
                className="p-2 bg-white rounded-lg border border-slate-200 text-blue-600 hover:underline flex items-center justify-between shadow-xs"
              >
                <span>AI 重塑应用商店相关性解析</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-lg shadow-sm transition"
          >
            知道了，返回工作台
          </button>
        </div>

      </div>
    </div>
  );
};
