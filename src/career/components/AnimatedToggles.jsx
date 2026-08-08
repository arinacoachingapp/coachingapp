import { motion } from 'framer-motion';

const EASE = [0.22, 1, 0.36, 1];

/** Binary on/off pill toggle with sliding indicator. */
export function AnimatedToggle({ checked, onChange, labelOn = 'On', labelOff = 'Off', size = 'sm' }) {
  const padding = size === 'sm' ? 'p-0.5' : 'p-1';
  const btn = size === 'sm' ? 'px-2.5 py-1.5 text-[10px]' : 'px-3 py-2 text-xs';

  return (
    <div
      className={`relative inline-flex rounded-sm border border-stone-200 bg-stone-100/80 ${padding}`}
      role="group"
      aria-label={`${labelOn} / ${labelOff}`}
    >
      <motion.div
        className={`absolute bottom-0.5 top-0.5 rounded-[2px] bg-white shadow-sm`}
        style={{ width: 'calc(50% - 2px)' }}
        animate={{ left: checked ? 'calc(50%)' : '2px' }}
        transition={{ type: 'spring', stiffness: 500, damping: 35 }}
      />
      <button
        type="button"
        onClick={() => onChange(false)}
        className={`relative z-10 ${btn} font-medium uppercase tracking-wider transition-colors ${
          !checked ? 'text-stone-800' : 'text-stone-400'
        }`}
      >
        {labelOff}
      </button>
      <button
        type="button"
        onClick={() => onChange(true)}
        className={`relative z-10 ${btn} font-medium uppercase tracking-wider transition-colors ${
          checked ? 'text-stone-800' : 'text-stone-400'
        }`}
      >
        {labelOn}
      </button>
    </div>
  );
}

/** Segmented control — one of N options with sliding indicator. */
export function AnimatedToggleGroup({ value, onChange, options, size = 'sm' }) {
  const btn = size === 'sm' ? 'px-2.5 py-1.5 text-[10px]' : 'px-3 py-2 text-xs';
  const activeIndex = Math.max(0, options.findIndex((o) => o.value === value));
  const count = options.length;
  const segmentPct = 100 / count;

  return (
    <div
      className="relative inline-flex rounded-sm border border-stone-200 bg-stone-100/80 p-0.5"
      role="tablist"
    >
      <motion.div
        className="absolute bottom-0.5 top-0.5 rounded-[2px] bg-white shadow-sm"
        style={{ width: `calc(${segmentPct}% - 2px)` }}
        animate={{ left: `calc(${activeIndex * segmentPct}% + 1px)` }}
        transition={{ type: 'spring', stiffness: 500, damping: 35 }}
      />
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={value === option.value}
          onClick={() => onChange(option.value)}
          className={`relative z-10 min-w-[3.5rem] ${btn} font-medium uppercase tracking-wider transition-colors ${
            value === option.value ? 'text-stone-800' : 'text-stone-400'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/** Expand/collapse row with animated chevron and content. */
export function AnimatedCollapse({
  open,
  onToggle,
  title,
  subtitle,
  children,
  variant = 'default',
}) {
  const isDark = variant === 'dark';

  return (
    <div
      className={`overflow-hidden rounded-sm border ${
        isDark ? 'border-stone-700 bg-stone-900' : 'border-stone-200 bg-white'
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        className={`flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors ${
          isDark ? 'hover:bg-stone-800/50' : 'hover:bg-stone-50'
        }`}
        aria-expanded={open}
      >
        <div className="min-w-0">
          <span
            className={`block text-sm font-medium ${
              isDark ? 'text-stone-200' : 'text-stone-700'
            }`}
          >
            {title}
          </span>
          {subtitle && (
            <span className={`mt-0.5 block text-xs ${isDark ? 'text-stone-500' : 'text-stone-400'}`}>
              {subtitle}
            </span>
          )}
        </div>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.3, ease: EASE }}
          className={`shrink-0 text-sm ${isDark ? 'text-stone-500' : 'text-stone-400'}`}
        >
          ↓
        </motion.span>
      </button>
      <div
        className="grid transition-[grid-template-rows] duration-300 ease-out"
        style={{ gridTemplateRows: open ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden">
          <div
            className={`border-t px-5 py-5 ${
              isDark ? 'border-stone-800' : 'border-stone-100'
            }`}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Collapsible content panel — children stay mounted (avoids disappear glitches). */
export function CollapsiblePanel({ open, children, className = '' }) {
  return (
    <div
      className={`grid transition-[grid-template-rows] duration-300 ease-out ${className}`}
      style={{ gridTemplateRows: open ? '1fr' : '0fr' }}
    >
      <div className="min-h-0 overflow-hidden">
        {children}
      </div>
    </div>
  );
}

/** Section header toggle with animated chevron. */
export function SectionToggle({ open, onToggle, label, count }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className="group flex w-full items-center gap-4 text-left"
    >
      <motion.span
        animate={{ rotate: open ? 90 : 0 }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        className="flex h-5 w-5 shrink-0 items-center justify-center text-stone-400 transition-colors group-hover:text-stone-600"
      >
        ›
      </motion.span>
      <h2 className="shrink-0 text-[10px] font-medium uppercase tracking-[0.25em] text-stone-400 transition-colors group-hover:text-stone-600">
        {label}
      </h2>
      {count != null && (
        <span className="text-[10px] tabular-nums text-stone-300">{count}</span>
      )}
      <div className="h-px flex-1 bg-gradient-to-r from-stone-200 to-transparent transition-colors group-hover:from-stone-300" />
    </button>
  );
}
