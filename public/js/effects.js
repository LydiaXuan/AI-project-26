// 效果自动计算
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
  superb:    { icon: '🏆', label: '很好',       cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  good:      { icon: '👍', label: '不错',       cls: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
  neutral_p: { icon: '➖', label: '持平(+)',    cls: 'bg-slate-100 text-slate-600 border-slate-200' },
  neutral_n: { icon: '➖', label: '持平(-)',    cls: 'bg-slate-100 text-slate-500 border-slate-200' },
  exp_p:     { icon: '📈', label: '经验决策(+)', cls: 'bg-indigo-50 text-indigo-600 border-indigo-100' },
  exp_n:     { icon: '📈', label: '经验决策(-)', cls: 'bg-amber-50 text-amber-700 border-amber-100' },
  bad:       { icon: '❌', label: '很差',       cls: 'bg-rose-100 text-rose-700 border-rose-200' },
};

export function effectBadgeHTML(eff) {
  const m = EFFECT_META[eff]; if (!m) return '<span class="text-slate-400 text-xs">--</span>';
  return `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold border ${m.cls}">${m.icon} ${m.label}</span>`;
}
