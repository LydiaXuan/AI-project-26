export const EFFECT = {
  SUPERB:      'superb',      // 🏆 很好
  GOOD:        'good',        // 👍 不错
  BAD:         'bad',         // ❌ 很差
  NEUTRAL_P:   'neutral_p',   // ➖ 持平(+)
  NEUTRAL_N:   'neutral_n',   // ➖ 持平(-)
  EMPIRICAL_P: 'empirical_p', // 📈 经验决策(+)
  EMPIRICAL_N: 'empirical_n', // 📈 经验决策(-)
};

export const EFFECT_META = {
  [EFFECT.SUPERB]:      { label: '🏆 很好',        cls: 'badge-superb' },
  [EFFECT.GOOD]:        { label: '👍 不错',        cls: 'badge-good' },
  [EFFECT.BAD]:         { label: '❌ 很差',        cls: 'badge-bad' },
  [EFFECT.NEUTRAL_P]:   { label: '➖ 持平(+)',     cls: 'badge-neutral-p' },
  [EFFECT.NEUTRAL_N]:   { label: '➖ 持平(-)',     cls: 'badge-neutral-n' },
  [EFFECT.EMPIRICAL_P]: { label: '📈 经验决策(+)', cls: 'badge-empirical-p' },
  [EFFECT.EMPIRICAL_N]: { label: '📈 经验决策(-)', cls: 'badge-empirical-n' },
};

// Legacy effect keys from old data
const LEGACY_MAP = {
  great: 'superb',
  empirical: 'empirical_p',
};

/**
 * @param {number|null} ciLower   CI 下限 (%)
 * @param {number|null} ciUpper   CI 上限 (%)
 * @param {number|null} testFI    测试组首次安装数
 * @param {number|null} controlFI 原始组首次安装数
 */
export function calculateEffect(ciLower, ciUpper, testFI = null, controlFI = null) {
  const hasCI = ciLower !== null && ciUpper !== null && ciLower !== '' && ciUpper !== '';

  function empirical() {
    return (testFI != null && controlFI != null && Number(testFI) > Number(controlFI))
      ? EFFECT.EMPIRICAL_P : EFFECT.EMPIRICAL_N;
  }

  if (!hasCI) return empirical();

  const lo = parseFloat(ciLower);
  const hi = parseFloat(ciUpper);
  if (isNaN(lo) || isNaN(hi)) return empirical();

  // CI 整体 ≥ 0（全正）
  if (lo >= 0) return lo >= 10 ? EFFECT.SUPERB : EFFECT.GOOD;

  // CI 整体 < 0（全负）
  if (hi < 0) return EFFECT.BAD;

  // CI 跨 0（lo < 0, hi >= 0）
  // 稳定性检查：下限 ≤ -5% 或 上限 ≥ +10% → 结果不稳定，经验决策
  if (lo <= -5 || hi >= 10) return empirical();

  // 稳定跨0：用中间值判断趋势
  const mid = (lo + hi) / 2;
  if (mid >= 5) return EFFECT.GOOD;
  if (mid >= 0) return EFFECT.NEUTRAL_P;
  return EFFECT.NEUTRAL_N;
}

export function effectBadgeHTML(effect) {
  const key = LEGACY_MAP[effect] || effect;
  const m = EFFECT_META[key] || EFFECT_META[EFFECT.EMPIRICAL_N];
  return `<span class="effect-badge ${m.cls}">${m.label}</span>`;
}

export const EFFECT_OPTIONS = [
  { val: EFFECT.SUPERB,      label: '🏆 很好' },
  { val: EFFECT.GOOD,        label: '👍 不错' },
  { val: EFFECT.BAD,         label: '❌ 很差' },
  { val: EFFECT.NEUTRAL_P,   label: '➖ 持平(+)' },
  { val: EFFECT.NEUTRAL_N,   label: '➖ 持平(-)' },
  { val: EFFECT.EMPIRICAL_P, label: '📈 经验决策(+)' },
  { val: EFFECT.EMPIRICAL_N, label: '📈 经验决策(-)' },
];
