// 把一条素材组装成飞书交互卡片：
// 头部(项目名) + 团队复盘总结 + (图 | 视频链接) + 灰底信息框(应用属性/测试人/效果)。
import { effectText } from './effect.js';

export function buildCard(m, imageKey) {
  const elements = [];

  // 团队复盘总结：紧跟在标题下方
  if (m.summary && m.summary.trim()) {
    elements.push({ tag: 'div', text: { tag: 'lark_md', content: m.summary.trim() } });
  }

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

  // 灰底信息框（放在图片下方）：新应用了xx，测试人：姓名 · 效果
  const attrsText = (Array.isArray(m.attrs) ? m.attrs : []).filter(Boolean).join('、');
  const infoParts = [];
  if (attrsText) infoParts.push(`新应用了${attrsText}`);
  if (m.owner) infoParts.push(`测试人：${m.owner}`);
  let info = infoParts.join('，');
  const eff = effectText(m.effect);
  if (eff && eff !== '—') info += (info ? ' · ' : '') + eff;
  if (info) {
    elements.push({
      tag: 'column_set',
      flex_mode: 'none',
      background_style: 'grey',
      horizontal_spacing: 'default',
      columns: [
        {
          tag: 'column',
          width: 'weighted',
          weight: 1,
          vertical_align: 'top',
          elements: [{ tag: 'div', text: { tag: 'lark_md', content: info } }],
        },
      ],
    });
  }

  return {
    config: { wide_screen_mode: true },
    header: {
      title: { tag: 'plain_text', content: m.project || m.recordId },
      template: 'blue',
    },
    elements,
  };
}
