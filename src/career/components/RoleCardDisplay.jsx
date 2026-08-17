import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { ROLE_CARD_SECTIONS } from '../lib/careerDb';
import { AnimatedCollapse, CollapsiblePanel, SectionToggle } from './AnimatedToggles';

const EASE = [0.22, 1, 0.36, 1];

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.07, delayChildren: 0.12 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 18 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: EASE },
  },
};

const headlineVariants = {
  hidden: { opacity: 0, y: 28, scale: 0.98 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.75, ease: EASE },
  },
};

const lineVariants = {
  hidden: { scaleX: 0 },
  show: {
    scaleX: 1,
    transition: { duration: 0.9, ease: EASE, delay: 0.2 },
  },
};

const SECTION_GROUPS = [
  {
    id: 'arrived',
    title: 'How you arrived',
    keys: [
      'getting_the_role',
      'business_context',
      'mandate',
      'why_chosen',
      'saying_yes',
      'expectations', // legacy
    ],
  },
  {
    id: 'people',
    title: 'People & settling in',
    keys: [
      'getting_into_the_role',
      'people',
      'manager_and_team', // legacy
      'environment_factor', // legacy
    ],
  },
  {
    id: 'daytoday',
    title: 'The day-to-day',
    keys: ['micro_look'],
  },
  {
    id: 'bigger',
    title: 'The bigger picture',
    keys: ['macro_look', 'ending', 'extra_thoughts'],
  },
];

function defaultOpenState(groupIds) {
  return Object.fromEntries([
    ['insight', false],
    ...groupIds.map((id) => [id, false]),
  ]);
}

function sectionByKey(roleCard) {
  const map = Object.fromEntries(ROLE_CARD_SECTIONS.map((s) => [s.key, s]));
  return (key) => {
    const meta = map[key];
    const text = roleCard[key]?.trim();
    if (!meta || !text) return null;
    return { ...meta, text };
  };
}

function SectionCard({ section, featured = false, index = 0, editing = false, onChange }) {
  if (featured) {
    return (
      <article className="relative overflow-hidden rounded-sm bg-stone-900 px-6 py-7 text-[#F7F5F1] shadow-[0_8px_30px_rgba(28,25,23,0.12)] sm:px-8 sm:py-8">
        <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/5 blur-2xl" />
        <p className="text-[10px] font-medium uppercase tracking-[0.25em] text-stone-400">
          {section.label}
        </p>
        {editing ? (
          <textarea
            value={section.text}
            onChange={(e) => onChange?.(section.key, e.target.value)}
            rows={3}
            className="mt-4 w-full resize-none rounded-sm border border-white/20 bg-white/10 px-3 py-2 font-serif text-xl leading-relaxed text-[#F7F5F1] outline-none"
          />
        ) : (
          <p className="mt-4 font-serif text-xl leading-relaxed sm:text-2xl sm:leading-relaxed">
            {section.text}
          </p>
        )}
      </article>
    );
  }

  return (
    <article className="group rounded-sm border border-stone-200/90 bg-white p-5 shadow-[0_1px_2px_rgba(28,25,23,0.04)] transition-shadow hover:shadow-[0_4px_20px_rgba(28,25,23,0.06)] sm:p-6">
      <div className="flex items-start gap-4">
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-stone-200 text-[10px] font-medium tabular-nums text-stone-400 transition-colors group-hover:border-stone-300 group-hover:text-stone-600">
          {String(index + 1).padStart(2, '0')}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[10px] font-medium uppercase tracking-[0.22em] text-stone-400">
            {section.label}
          </h3>
          {editing ? (
            <textarea
              value={section.text}
              onChange={(e) => onChange?.(section.key, e.target.value)}
              rows={3}
              className="mt-3 w-full resize-none rounded-sm border border-stone-200 bg-stone-50 px-3 py-2 font-serif text-base leading-relaxed text-stone-700 outline-none focus:border-stone-400"
            />
          ) : (
            <p className="mt-3 whitespace-pre-wrap font-serif text-base leading-relaxed text-stone-700">
              {section.text}
            </p>
          )}
        </div>
      </div>
    </article>
  );
}

function GroupBlock({ title, sections, startIndex, open, onToggle, editing, onChange }) {
  if (!sections.length) return null;

  return (
    <motion.section variants={itemVariants} className="space-y-3">
      <SectionToggle open={open} onToggle={onToggle} label={title} count={sections.length} />
      <CollapsiblePanel open={open}>
        <div className="space-y-3 pt-1">
          {sections.map((section, i) => (
            <SectionCard
              key={section.key}
              section={section}
              index={startIndex + i}
              editing={editing}
              onChange={onChange}
            />
          ))}
        </div>
      </CollapsiblePanel>
    </motion.section>
  );
}

export default function RoleCardDisplay({ roleCard, transcript, onStartNew, onSave }) {
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [openSections, setOpenSections] = useState(() =>
    defaultOpenState(SECTION_GROUPS.map((g) => g.id))
  );
  const [draft, setDraft] = useState(roleCard);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editing) setDraft(roleCard);
  }, [roleCard, editing]);

  if (!roleCard) return null;

  const card = editing ? draft : roleCard;
  const getSection = sectionByKey(card);
  const insight = getSection('biggest_insight');

  const groups = SECTION_GROUPS.map((group) => ({
    ...group,
    sections: group.keys.map(getSection).filter(Boolean),
  })).filter((g) => g.sections.length > 0);

  const toggleSection = (id) => {
    setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleFieldChange = (key, value) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    if (!onSave) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(draft);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  let sectionCounter = 0;

  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={containerVariants}
      className="mx-auto w-full max-w-xl pb-10"
    >
      <motion.div
        variants={itemVariants}
        className="overflow-hidden rounded-sm border border-stone-200/80 bg-white/60 shadow-[0_2px_40px_rgba(28,25,23,0.06)] backdrop-blur-sm"
      >
        <div className="relative px-6 pb-8 pt-10 text-center sm:px-10 sm:pt-12">
          <motion.div
            className="mx-auto mb-6 h-px w-12 origin-center bg-stone-800"
            variants={lineVariants}
          />
          <motion.p
            variants={itemVariants}
            className="text-[10px] font-medium uppercase tracking-[0.3em] text-stone-400"
          >
            Your role card
          </motion.p>
          {card.headline &&
            (editing ? (
              <textarea
                value={draft.headline || ''}
                onChange={(e) => handleFieldChange('headline', e.target.value)}
                rows={2}
                className="mx-auto mt-5 w-full max-w-lg resize-none rounded-sm border border-stone-200 bg-white px-3 py-2 text-center font-serif text-3xl font-medium leading-[1.2] text-stone-900 outline-none focus:border-stone-400 sm:text-[2.35rem]"
              />
            ) : (
              <motion.h1
                variants={headlineVariants}
                className="mx-auto mt-5 max-w-lg font-serif text-3xl font-medium leading-[1.2] text-stone-900 sm:text-[2.35rem]"
              >
                {card.headline}
              </motion.h1>
            ))}
          <motion.div
            variants={lineVariants}
            className="mx-auto mt-8 h-px w-full max-w-xs origin-center bg-gradient-to-r from-transparent via-stone-200 to-transparent"
          />
          {onSave && (
            <div className="mt-6 flex justify-center gap-3">
              {!editing ? (
                <button
                  type="button"
                  onClick={() => {
                    setDraft(roleCard);
                    setEditing(true);
                  }}
                  className="text-xs font-medium uppercase tracking-[0.15em] text-stone-400 hover:text-stone-700"
                >
                  Edit card
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setEditing(false)}
                    className="text-xs font-medium uppercase tracking-[0.15em] text-stone-400 hover:text-stone-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="text-xs font-medium uppercase tracking-[0.15em] text-stone-700 hover:text-stone-900 disabled:opacity-50"
                  >
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        <div className="space-y-6 px-5 pb-8 sm:space-y-8 sm:px-8 sm:pb-10">
          {insight && (
            <motion.section variants={itemVariants} className="space-y-3">
              <SectionToggle
                open={openSections.insight}
                onToggle={() => toggleSection('insight')}
                label="Key insight"
                count={1}
              />
              <CollapsiblePanel open={openSections.insight}>
                <div className="pt-1">
                  <SectionCard
                    section={insight}
                    featured
                    editing={editing}
                    onChange={handleFieldChange}
                  />
                </div>
              </CollapsiblePanel>
            </motion.section>
          )}

          {groups.map((group) => {
            const startIndex = sectionCounter;
            sectionCounter += group.sections.length;
            return (
              <GroupBlock
                key={group.id}
                title={group.title}
                sections={group.sections}
                startIndex={startIndex}
                open={!!openSections[group.id]}
                onToggle={() => toggleSection(group.id)}
                editing={editing}
                onChange={handleFieldChange}
              />
            );
          })}
        </div>
      </motion.div>

      {transcript?.length > 0 && (
        <motion.div variants={itemVariants} className="mt-8">
          <AnimatedCollapse
            open={transcriptOpen}
            onToggle={() => setTranscriptOpen((v) => !v)}
            title="Full transcript"
            subtitle={`${transcript.length} questions`}
          >
            <div className="space-y-6">
              {transcript.map((item) => (
                <div key={item.question_key} className="border-l-2 border-stone-100 pl-4">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-stone-400">
                    {item.question_key || `Question ${item.question_number}`}
                  </p>
                  <p className="mt-1 text-sm text-stone-500">{item.question_text}</p>
                  {item.probes?.length > 0 && (
                    <ul className="mt-2 space-y-1 text-xs italic text-stone-400">
                      {item.probes.map((p) => (
                        <li key={p}>Follow-up: {p}</li>
                      ))}
                    </ul>
                  )}
                  <p className="mt-2 whitespace-pre-wrap font-serif text-sm leading-relaxed text-stone-700">
                    {item.response_text || '—'}
                  </p>
                </div>
              ))}
            </div>
          </AnimatedCollapse>
        </motion.div>
      )}

      {onStartNew && (
        <motion.div variants={itemVariants} className="mt-8">
          <motion.button
            type="button"
            onClick={onStartNew}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            className="w-full rounded-sm border border-stone-300 bg-white py-4 text-sm font-medium tracking-wide text-stone-700 shadow-sm transition-colors hover:border-stone-400 hover:bg-stone-50"
          >
            Reflect on another role
          </motion.button>
        </motion.div>
      )}
    </motion.div>
  );
}
