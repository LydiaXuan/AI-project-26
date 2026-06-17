// 把一条素材组装成飞书交互卡片：头部(项目名 + 副标题一行) + (图 | 视频链接)。
import { effectText } from './effect.js';

export function buildCard(m, imageKey) {
  // 头部副标题（白字，字号比标题小）：新应用了xx，测试人：姓名 · 效果
  const attrsText = (Array.isArray(m.attrs) ? m.attrs : []).filter(Boolean).join('、');
  const subParts = [];
  if (attrsText) subParts.push(`新应用了${attrsText}`);
  if (m.owner) subParts.push(`测试人：${m.owner}`);
  let subtitle = subParts.join('，');
  const eff = effectText(m.effect);
  if (eff && eff !== '—') subtitle += (subtitle ? ' · ' : '') + eff;

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

  const header = {
    title: { tag: 'plain_text', content: m.project || m.recordId },
    template: 'blue',
  };
  if (subtitle) header.subtitle = { tag: 'plain_text', content: subtitle };

  return {
    config: { wide_screen_mode: true },
    header,
    elements,
  };
}
