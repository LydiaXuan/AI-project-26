// 把一条素材组装成飞书交互卡片：(图 | 视频链接) + 项目名 + 主信息行 + 效果行。
import { effectText } from './effect.js';

const typeLabel = (t) => (t === 'ab' ? 'A/B' : t === 'direct' ? '直接更新' : t || '');

export function buildCard(m, imageKey) {
  // 主信息行：xx项目，新应用了xx（icon/五图/置顶/视频），测试人：姓名
  const attrsText = (Array.isArray(m.attrs) ? m.attrs : []).filter(Boolean).join('、');
  const mainParts = [`${m.project || m.recordId}项目`];
  if (attrsText) mainParts.push(`新应用了${attrsText}`);
  if (m.owner) mainParts.push(`测试人：${m.owner}`);
  const mainLine = mainParts.join('，');

  // 效果行（保留）：效果 · 采用变体 · 类型
  const effParts = [effectText(m.effect), `采用「${m.variantName}」`];
  if (typeLabel(m.type)) effParts.push(typeLabel(m.type));
  const effLine = effParts.join(' · ');

  const elements = [];

  // 有图就上图
  if (imageKey) {
    elements.push({ tag: 'img', img_key: imageKey, alt: { tag: 'plain_text', content: m.project } });
  }
  // 有视频 URL 就放一个可点击链接
  if (m.videoUrl) {
    elements.push({
      tag: 'div',
      text: { tag: 'lark_md', content: `🎬 视频链接：[${m.videoUrl}](${m.videoUrl})` },
    });
  }
  // 兜底：图和视频都没有，给个提示文字
  if (!imageKey && !m.videoUrl) {
    elements.push({
      tag: 'div',
      text: { tag: 'lark_md', content: '_（无素材内容）_' },
    });
  }
  elements.push({ tag: 'div', text: { tag: 'lark_md', content: `**${mainLine}**` } });
  elements.push({ tag: 'div', text: { tag: 'lark_md', content: effLine } });

  return {
    config: { wide_screen_mode: true },
    header: {
      title: { tag: 'plain_text', content: m.project || m.recordId },
      template: 'blue',
    },
    elements,
  };
}
