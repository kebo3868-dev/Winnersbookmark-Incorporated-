// Lightweight heuristic continuity checker. Flags potential issues only — never destructive.
export function runContinuityCheck(project) {
  const issues = [];
  const add = (severity, area, message) => issues.push({ severity, area, message });

  if (!project) return issues;

  // Character consistency
  const chars = project.characters || [];
  chars.forEach(c => {
    if (!c.name) add('warn', 'Character', 'Character missing a name — locking consistency will be hard.');
    if (!c.costume) add('info', 'Character', `${c.name || 'Unnamed character'} has no costume description.`);
    if (!c.palette) add('info', 'Character', `${c.name || 'Unnamed character'} has no color palette set — visual drift is likely.`);
  });

  // Page coverage
  const pages = project.pagesList || [];
  if (pages.length === 0) add('warn', 'Pages', 'No pages built yet. Add at least one page in the Page Builder.');
  pages.forEach(p => {
    const panels = p.panels || [];
    if (!p.summary) add('info', 'Pages', `Page ${p.number}: no scene summary.`);
    if (panels.length === 0) add('warn', 'Pages', `Page ${p.number}: no panels yet.`);
    panels.forEach(pn => {
      if (!pn.action) add('info', 'Panels', `Page ${p.number} · Panel ${pn.number}: missing action.`);
      if (!pn.cameraAngle) add('info', 'Panels', `Page ${p.number} · Panel ${pn.number}: missing camera angle.`);
    });
  });

  // Dialogue repetition
  const allDialogue = pages.flatMap(p => (p.panels || []).flatMap(pn => (pn.dialogue || '').split('\n')))
    .map(s => s.trim().toLowerCase()).filter(Boolean);
  const seen = new Map();
  allDialogue.forEach(d => seen.set(d, (seen.get(d) || 0) + 1));
  [...seen.entries()].filter(([_, n]) => n > 1 && _.length > 6).forEach(([line, n]) => {
    add('info', 'Dialogue', `Repeated line (${n}×): "${line}"`);
  });

  // Conflict / stakes / cliffhanger
  if (!project.conflict) add('warn', 'Story', 'No central conflict set in Story Engine.');
  if (!project.stakes)   add('warn', 'Story', 'No stakes defined — readers won’t feel pressure.');
  if (!project.sequelHook && pages.length >= 6) add('info', 'Story', 'Consider a cliffhanger / sequel hook for the final page.');

  // Costume drift hint (very rough)
  pages.forEach(p => (p.panels || []).forEach(pn => {
    if (pn.action && /costume change|new outfit|different uniform/i.test(pn.action)) {
      add('info', 'Continuity', `Page ${p.number} · Panel ${pn.number}: costume change referenced — verify visual.`);
    }
  }));

  return issues;
}
