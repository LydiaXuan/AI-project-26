// 把一条素材组装成飞书交互卡片，按模块取不同的正文与头部颜色：
//   buying（同步买量）：青色头；正文 = buyingNote + 「，可供买量参考~」
//   review（测试复盘总结）：紫色头；正文 = summary
// 结构：头部(项目名) + (图 | 视频链接) + 运营同步行 + 文案。
import { effectText } from './effect.js';

// 运营同步行：运营（姓名）同步：该项目新应用了xx，效果
function syncLine(m) {
  const intro = m.owner ? `运营（${m.owner}）同步：` : '运营同步：';
  const attrsText = (Array.isArray(m.attrs) ? m.attrs : []).filter(Boolean).join('、');
  let line = intro;
  if (attrsText) line += `该项目新应用了${attrsText}`;
  const eff = effectText(m.effect);
  if (eff && eff !== '—') line += (attrsText ? '，' : '') + eff;
  return line;
}

// module: 'buying' | 'review'
export function buildCard(m, imageKey, module = 'buying') {
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

  // 运营同步行 + 文案：黄橙色底纹包裹（同一个 column_set 里）
  const inner = [{ tag: 'div', text: { tag: 'lark_md', content: syncLine(m) } }];
  let body = (module === 'review' ? m.summary : m.buyingNote) || '';
  body = body.trim();
  if (module === 'buying') body = body ? `${body}，可供买量参考~` : '可供买量参考~';
  if (body) inner.push({ tag: 'div', text: { tag: 'lark_md', content: body } });
  elements.push({
    tag: 'column_set',
    flex_mode: 'none',
    background_style: 'yellow',
    horizontal_spacing: 'default',
    columns: [
      { tag: 'column', width: 'weighted', weight: 1, vertical_align: 'top', elements: inner },
    ],
  });

  return {
    config: { wide_screen_mode: true },
    header: {
      title: { tag: 'plain_text', content: m.project || m.recordId },
      // 买量卡青色、复盘卡紫色
      template: module === 'review' ? 'purple' : 'turquoise',
    },
    elements,
  };
}
