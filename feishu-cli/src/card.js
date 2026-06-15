// 把一条素材组装成飞书交互卡片。imageKey 为已上传图片的 key（可空）。
import { effectText } from './effect.js';

const typeLabel = (t) => (t === 'ab' ? 'A/B 测试' : t === 'direct' ? '直接更新' : t || '—');

export function buildCard(m, imageKey) {
  const lines = [
    `**项目**：${m.project || '—'}`,
    `**实验类型**：${typeLabel(m.type)}`,
    m.component ? `**组件**：${m.component}` : '',
    m.ratio ? `**流量比例**：${m.ratio}` : '',
    m.confidence ? `**置信度**：${m.confidence}%` : '',
    `**采用变体**：${m.variantName}`,
    `**效果**：${effectText(m.effect)}`,
    (m.startDate || m.endDate) ? `**周期**：${m.startDate || '?'} ~ ${m.endDate || '进行中'}` : '',
  ].filter(Boolean);

  const elements = [];
  if (imageKey) {
    elements.push({ tag: 'img', img_key: imageKey, alt: { tag: 'plain_text', content: m.project } });
  }
  elements.push({ tag: 'div', text: { tag: 'lark_md', content: lines.join('\n') } });
  if (m.summary) {
    elements.push({ tag: 'hr' });
    elements.push({ tag: 'div', text: { tag: 'lark_md', content: `**复盘**：${m.summary}` } });
  }

  return {
    config: { wide_screen_mode: true },
    header: {
      title: { tag: 'plain_text', content: `🎨 采用素材 · ${m.project || m.recordId}` },
      template: 'blue',
    },
    elements,
  };
}
