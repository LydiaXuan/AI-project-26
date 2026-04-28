// Test effect calculation based on confidence interval bounds

export const EFFECT = {
  GREAT:     'great',      // 🏆 表现很好
  GOOD:      'good',       // ✅ 表现不错
  NEUTRAL_P: 'neutral_p',  // ⚖️ 不相上下（中位数正）
  NEUTRAL_N: 'neutral_n',  // ⚖️ 不相上下（中位数负，待复测）
  BAD:       'bad',        // 📉 表现不好
  EMPIRICAL: 'empirical',  // 📈 经验决策（无置信区间）
};

export const EFFECT_META = {
  [EFFECT.GREAT]:     { label: '🏆 表现很好', cls: 'badge-great',     note: '' },
  [EFFECT.GOOD]:      { label: '✅ 表现不错', cls: 'badge-good',      note: '' },
  [EFFECT.NEUTRAL_P]: { label: '⚖️ 不相上下', cls: 'badge-neutral-p', note: '待复测' },
  [EFFECT.NEUTRAL_N]: { label: '⚖️ 不相上下', cls: 'badge-neutral-n', note: '待复测' },
  [EFFECT.BAD]:       { label: '📉 表现不好', cls: 'badge-bad',       note: '' },
  [EFFECT.EMPIRICAL]: { label: '📈 经验决策', cls: 'badge-empirical', note: '纯增幅' },
};

/**
 * @param {number|null} ciLower  - CI 下限（%），如 -5.2
 * @param {number|null} ciUpper  - CI 上限（%），如 10.8
 * @returns {string} EFFECT constant
 */
export function calculateEffect(ciLower, ciUpper) {
  if (ciLower === null || ciUpper === null || ciLower === '' || ciUpper === '') {
    return EFFECT.EMPIRICAL;
  }

  const lo = parseFloat(ciLower);
  const hi = parseFloat(ciUpper);

  if (isNaN(lo) || isNaN(hi)) return EFFECT.EMPIRICAL;

  const median = (lo + hi) / 2;

  if (hi < 0) return EFFECT.BAD;                      // 区间全负
  if (median < 0) return EFFECT.BAD;                  // 中位数为负

  if (lo < 0 && hi > 0) {
    return median >= 0 ? EFFECT.NEUTRAL_P : EFFECT.NEUTRAL_N;
  }

  // lo >= 0, hi > 0, median > 0
  if (median > 10) return EFFECT.GREAT;
  if (median > 5)  return EFFECT.GOOD;
  return EFFECT.GOOD;                                  // 区间全正但中位数≤5%，仍算不错
}

export function effectBadgeHTML(effect) {
  const m = EFFECT_META[effect] || EFFECT_META[EFFECT.EMPIRICAL];
  const note = m.note ? `<span class="badge-note">${m.note}</span>` : '';
  return `<span class="effect-badge ${m.cls}">${m.label}${note}</span>`;
}
