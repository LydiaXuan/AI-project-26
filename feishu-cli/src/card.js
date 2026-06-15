// 把一条素材组装成飞书交互卡片：图 + 项目名 + 一行字。
import { effectText } from './effect.js';

const typeLabel = (t) => (t === 'ab' ? 'A/B' : t === 'direct' ? '直接更新' : t || '');

export function buildCard(m, imageKey) {
  // 一行字：效果 · 采用变体 ·（类型）
  const parts = [effectText(m.effect), `采用「${m.variantName}」`];
  if (typeLabel(m.type)) parts.push(typeLabel(m.type));
  const oneLine = parts.join(' · ');

  const elements = [];
  if (imageKey) {
    elements.push({ tag: 'img', img_key: imageKey, alt: { tag: 'plain_text', content: m.project } });
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
