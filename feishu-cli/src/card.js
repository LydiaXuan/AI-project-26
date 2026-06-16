// 把一条素材组装成飞书交互卡片：(图 | 视频链接) + 项目名 + 一行字。
import { effectText } from './effect.js';

const typeLabel = (t) => (t === 'ab' ? 'A/B' : t === 'direct' ? '直接更新' : t || '');

export function buildCard(m, imageKey) {
  const parts = [effectText(m.effect), `采用「${m.variantName}」`];
  if (typeLabel(m.type)) parts.push(typeLabel(m.type));
  const oneLine = parts.join(' · ');

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
  elements.push({ tag: 'div', text: { tag: 'lark_md', content: oneLine } });

  return {
    config: { wide_screen_mode: true },
    header: {
      title: { tag: 'plain_text', content: m.project || m.recordId },
      template: 'blue',
    },
    elements,
  };
}
