// 从 public/js/effects.js 移植，保持判定规则完全一致。
export function computeEffect(v, control) {
  const hasCI = v.ciLow !== '' && v.ciLow != null && v.ciHigh !== '' && v.ciHigh != null;
  const lo = parseFloat(v.ciLow), hi = parseFloat(v.ciHigh);
  const inst = parseFloat(v.installs), cInst = parseFloat(control?.installs);
  if (hasCI && !isNaN(lo) && !isNaN(hi)) {
    if (lo > 0) return 'superb';
    if (hi < 0) return 'bad';
    if (!isNaN(inst) && !isNaN(cInst)) {
      const diff = (inst - cInst) / cInst;
      if (diff > 0.05) return 'good';
      if (diff > 0) return 'neutral_p';
      return 'neutral_n';
    }
    return 'neutral_p';
  }
  if (!isNaN(inst) && !isNaN(cInst)) return inst > cInst ? 'exp_p' : 'exp_n';
  return null;
}

export const EFFECT_META = {
  superb:    { icon: '🏆', label: '很好' },
  good:      { icon: '👍', label: '不错' },
  neutral_p: { icon: '➖', label: '持平(+)' },
  neutral_n: { icon: '➖', label: '持平(-)' },
  exp_p:     { icon: '📈', label: '经验决策(+)' },
  exp_n:     { icon: '📈', label: '经验决策(-)' },
  bad:       { icon: '❌', label: '很差' },
};

export function effectText(eff) {
  const m = EFFECT_META[eff];
  return m ? `${m.icon} ${m.label}` : '—';
}
