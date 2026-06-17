// 把一条素材组装成飞书交互卡片，按模块取不同的正文：
//   buying（同步买量）：正文取 m.buyingNote
//   review（测试复盘总结）：正文取 m.summary
// 两个模块结构一致：头部(项目名) + 模块正文 + (图 | 视频链接) + 灰底信息框。
import { effectText } from './effect.js';

// 灰底框文案：新应用了xx，测试人：姓名 · 效果（两个模块都带）
function infoLine(m) {
  const attrsText = (Array.isArray(m.attrs) ? m.attrs : []).filter(Boolean).join('、');
  const parts = [];
  if (attrsText) parts.push(`新应用了${attrsText}`);
  if (m.owner) parts.push(`测试人：${m.owner}`);
  let info = parts.join('，');
  const eff = effectText(m.effect);
  if (eff && eff !== '—') info += (info ? ' · ' : '') + eff;
  return info;
}

// module: 'buying' | 'review'
export function buildCard(m, imageKey, module = 'buying') {
  const bodyText = module === 'review' ? m.summary : m.buyingNote;
  const elements = [];

  // 模块正文：紧跟在标题下方
  if (bodyText && bodyText.trim()) {
    elements.push({ tag: 'div', text: { tag: 'lark_md', content: bodyText.trim() } });
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

  // 灰底信息框（放在图片下方）
  const info = infoLine(m);
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
      // 买量卡青色、复盘卡蓝色，落在同一个群也好区分
      template: module === 'review' ? 'blue' : 'turquoise',
    },
    elements,
  };
}
