import { coverPrompt, panelPrompt, characterPortraitPrompt, characterBibleLine } from './prompts';

export function buildScript(project) {
  if (!project) return '';
  const lines = [];
  lines.push(`# ${project.title || 'Untitled Comic'}`);
  lines.push(`${project.genre || ''} · ${project.style || ''} · ${project.audience || ''}`.replace(/^ · | · $/g, ''));
  lines.push('');
  if (project.logline) { lines.push(`> ${project.logline}`); lines.push(''); }

  if (project.premise || project.heroJourney) {
    lines.push('## Story');
    if (project.premise)            lines.push(`**Premise:** ${project.premise}`);
    if (project.heroJourney)        lines.push(`**Hero’s Journey:** ${project.heroJourney}`);
    if (project.villainMotivation)  lines.push(`**Villain Motivation:** ${project.villainMotivation}`);
    if (project.supportingCharacters) lines.push(`**Supporting Cast:** ${project.supportingCharacters}`);
    if (project.conflict)           lines.push(`**Conflict:** ${project.conflict}`);
    if (project.stakes)             lines.push(`**Stakes:** ${project.stakes}`);
    if (project.emotionalArc)       lines.push(`**Emotional Arc:** ${project.emotionalArc}`);
    if (project.plotTwist)          lines.push(`**Plot Twist:** ${project.plotTwist}`);
    if (project.ending)             lines.push(`**Ending:** ${project.ending}`);
    if (project.sequelHook)         lines.push(`**Sequel Hook:** ${project.sequelHook}`);
    lines.push('');
  }

  if ((project.characters || []).length) {
    lines.push('## Character Bible');
    project.characters.forEach(c => {
      lines.push(`### ${c.name || 'Unnamed'} — ${c.role || ''}`);
      const fields = [
        ['Age', c.age], ['Personality', c.personality], ['Powers', c.powers], ['Weakness', c.weakness],
        ['Backstory', c.backstory], ['Motivation', c.motivation], ['Costume', c.costume],
        ['Weapon / Object', c.weapon], ['Face', c.face], ['Body', c.body], ['Palette', c.palette],
        ['Voice', c.voice], ['Consistency notes', c.consistencyNotes],
      ];
      fields.forEach(([k,v]) => { if (v) lines.push(`- **${k}:** ${v}`); });
      lines.push('');
    });
  }

  const w = project.world || {};
  if (Object.values(w).some(Boolean)) {
    lines.push('## World');
    Object.entries({
      Location: w.location, Period: w.period, Culture: w.culture, Technology: w.tech,
      Rules: w.rules, Environment: w.environment, Mood: w.mood, Palette: w.palette,
      Landmarks: w.landmarks, 'Social Conflict': w.conflict, 'Hidden Danger': w.danger,
      Description: w.description,
    }).forEach(([k,v]) => { if (v) lines.push(`- **${k}:** ${v}`); });
    lines.push('');
  }

  if ((project.pagesList || []).length) {
    lines.push('## Pages');
    project.pagesList.forEach(p => {
      lines.push(`### Page ${p.number}${p.summary ? ` — ${p.summary}` : ''}`);
      (p.panels || []).forEach(pn => {
        lines.push(`**Panel ${pn.number}** · ${pn.cameraAngle || 'shot'} · ${pn.emotion || 'mood'}`);
        if (pn.action)     lines.push(`Action: ${pn.action}`);
        if (pn.background) lines.push(`Background: ${pn.background}`);
        if (pn.dialogue)   lines.push(`Dialogue:\n${pn.dialogue.split('\n').map(l => '  ' + l).join('\n')}`);
        if (pn.captions)   lines.push(`Caption: ${pn.captions}`);
        if (pn.sfx)        lines.push(`SFX: ${pn.sfx}`);
        if (pn.continuity) lines.push(`Continuity: ${pn.continuity}`);
        lines.push('');
      });
    });
  }

  if (project.cover && project.cover.title) {
    lines.push('## Cover');
    Object.entries({
      Title: project.cover.title, Subtitle: project.cover.subtitle, Issue: project.cover.issue,
      Hero: project.cover.hero, 'Villain Presence': project.cover.villainPresence,
      Background: project.cover.background, Pose: project.cover.pose, Tagline: project.cover.tagline,
      Publisher: project.cover.publisher, Palette: project.cover.palette,
      Typography: project.cover.typography, 'Cover Style': project.cover.coverStyle,
      'Back Blurb': project.cover.blurb,
    }).forEach(([k,v]) => { if (v) lines.push(`- **${k}:** ${v}`); });
    lines.push('');
  }

  return lines.join('\n');
}

export function buildAllPanelPrompts(project) {
  if (!project) return '';
  const out = [];
  (project.pagesList || []).forEach(p => {
    (p.panels || []).forEach(pn => {
      out.push(`Page ${p.number} · Panel ${pn.number}`);
      out.push(pn.prompt || panelPrompt({
        style: project.style,
        action: pn.action, setting: pn.background || project.world?.location,
        cameraAngle: pn.cameraAngle, lighting: pn.lighting, emotion: pn.emotion,
        palette: project.world?.palette, characterBible: characterBibleLine(project.characters?.[0]),
        textPlacement: pn.dialogue ? 'dialogue balloon area top' : null,
      }));
      out.push('');
    });
  });
  return out.join('\n');
}

export function buildCharacterBible(project) {
  if (!project) return '';
  return (project.characters || []).map(c => {
    return [
      `## ${c.name || 'Unnamed'}`,
      c.role && `Role: ${c.role}`,
      c.age && `Age: ${c.age}`,
      c.personality && `Personality: ${c.personality}`,
      c.powers && `Powers/Skills: ${c.powers}`,
      c.weakness && `Weakness: ${c.weakness}`,
      c.backstory && `Backstory: ${c.backstory}`,
      c.motivation && `Motivation: ${c.motivation}`,
      c.costume && `Costume: ${c.costume}`,
      c.weapon && `Signature object: ${c.weapon}`,
      c.face && `Face: ${c.face}`,
      c.body && `Body: ${c.body}`,
      c.palette && `Palette: ${c.palette}`,
      c.voice && `Voice: ${c.voice}`,
      c.consistencyNotes && `Consistency: ${c.consistencyNotes}`,
      '',
      `Portrait prompt: ${characterPortraitPrompt(c, project.style)}`,
    ].filter(Boolean).join('\n');
  }).join('\n\n---\n\n');
}

export function buildCoverPrompt(project) {
  if (!project?.cover) return '';
  return coverPrompt({ ...project.cover, style: project.style });
}

export function buildPublishingChecklist(project) {
  const cl = project?.publishingChecklist || [];
  return cl.map(t => `- [${t.done ? 'x' : ' '}] ${t.label}`).join('\n');
}

export function buildOutline(project) {
  if (!project) return '';
  const pages = project.pagesList || [];
  return pages.map(p => {
    const beats = (p.panels || []).map(pn => `  ${pn.number}. ${pn.action || '—'}`).join('\n');
    return `Page ${p.number}: ${p.summary || '—'}\n${beats}`;
  }).join('\n\n');
}

export function buildSocialKit(project) {
  if (!project) return '';
  const title = project.title || 'My Comic';
  const log = project.logline || 'a new cinematic comic experience';
  return [
    `## TikTok Caption`,
    `New comic dropping. "${title}" — ${log} 🎬 #comicbook #indiecomics #${(project.genre || 'comic').replace(/\s+/g,'')}`,
    ``,
    `## Instagram Caption`,
    `Introducing "${title}". ${log} A premium ${project.style || 'cinematic'} comic. Built panel by panel. Read the issue → link in bio.`,
    ``,
    `## Hashtags`,
    `#comicbook #graphicnovel #${(project.genre || 'comic').replace(/\s+/g,'')} #${(project.style || 'style').replace(/[^a-z0-9]/gi,'')} #aiart #indiecomics #storytelling #characterdesign #panel #covers`,
    ``,
    `## YouTube Shorts Script (30s)`,
    `Hook (0-3s): "What if ${log.toLowerCase()}?"`,
    `Reveal (3-10s): show cover. read title aloud. tease genre.`,
    `Beats (10-25s): three fastest panels. each one is a punch.`,
    `CTA (25-30s): "Read the full issue. Link in bio."`,
    ``,
    `## Trailer Voiceover`,
    `In a world where ${(project.world?.location || 'a forgotten city')} keeps its secrets, ${(project.mainCharacter || 'one figure')} stands between us and what waits underneath. ${title}. Coming soon.`,
    ``,
    `## Character Reveal Post`,
    `Meet ${(project.characters?.[0]?.name || 'the lead')}. ${(project.characters?.[0]?.personality || 'sharp, loyal, dangerous')}. The world of "${title}" begins here.`,
    ``,
    `## Behind-the-Scenes Post`,
    `Started with a ${project.framework || 'three-act'} outline. Locked the character bible. Generated ${project.pagesList?.length || 0} pages of cinematic panels. This is how "${title}" was built.`,
    ``,
    `## Launch Announcement`,
    `It’s here. "${title}" is live. ${log} A new chapter of cinematic comics from Winnersbookmark Incorporated.`,
    ``,
    `## Carousel Breakdown`,
    `Slide 1: Title card.   Slide 2: Logline.   Slide 3: Hero.   Slide 4: Villain.   Slide 5: World.   Slide 6: First panel.   Slide 7: Cliffhanger.   Slide 8: Read now CTA.`,
  ].join('\n');
}

export function buildExportPayload(project) {
  return {
    script:        buildScript(project),
    bible:         buildCharacterBible(project),
    prompts:       buildAllPanelPrompts(project),
    outline:       buildOutline(project),
    cover:         buildCoverPrompt(project),
    checklist:     buildPublishingChecklist(project),
    social:        buildSocialKit(project),
    json:          JSON.stringify(project, null, 2),
  };
}

export function downloadText(filename, text) {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
