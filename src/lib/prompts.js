import { findStyle } from '../data/styles';

const NEG_DEFAULT = [
  'no distorted hands',
  'no misspelled text',
  'no extra limbs',
  'no blurry faces',
  'no inconsistent costume',
  'no extra fingers',
  'no warped eyes',
  'no off-model anatomy',
].join(', ');

const join = (...parts) => parts.filter(Boolean).map(s => String(s).trim()).filter(Boolean).join(', ');

export function characterBibleLine(c) {
  if (!c) return '';
  return join(
    c.name && `${c.name}`,
    c.age && `${c.age}`,
    c.body, c.face,
    c.costume && `wearing ${c.costume}`,
    c.weapon && `carrying ${c.weapon}`,
    c.palette && `color palette ${c.palette}`,
  );
}

export function panelPrompt({ style, character, action, setting, cameraAngle, lighting, emotion, palette, composition, texture, cinematic, textPlacement, negative, characterBible }) {
  const s = findStyle(style);
  const charDesc = characterBible || characterBibleLine(character) || character?.name || 'main character';
  const head = `Create ${s.prefix} featuring ${charDesc} doing ${action || '[ACTION]'} in ${setting || '[SETTING]'}.`;
  const tech = `Use ${cameraAngle || 'medium shot'}, ${lighting || 'cinematic key light'}, ${emotion ? emotion + ' mood' : 'cinematic mood'}, ${palette || 'rich grounded palette'}, ${composition || 'rule-of-thirds composition'}${texture ? ', ' + texture : ''}${cinematic ? ', ' + cinematic : ''}.`;
  const consistency = characterBible ? `Keep character features consistent: ${characterBible}.` : '';
  const text = textPlacement ? `Leave space for ${textPlacement}.` : '';
  const neg = `Negative prompt: ${negative ? negative + ', ' : ''}${NEG_DEFAULT}.`;
  return [head, tech, consistency, text, neg].filter(Boolean).join(' ');
}

export function coverPrompt(c) {
  const s = findStyle(c.style);
  return [
    `Design ${s.prefix} as a ${c.coverStyle || 'cinematic'} comic book cover for "${c.title || '[TITLE]'}"${c.subtitle ? `, subtitle "${c.subtitle}"` : ''}${c.issue ? `, issue #${c.issue}` : ''}.`,
    `Feature ${c.hero || 'the main hero'} in ${c.pose || 'a dramatic hero pose'}${c.villainPresence ? `, with ${c.villainPresence} looming behind` : ''}.`,
    `Background: ${c.background || 'a striking cinematic backdrop'}. Tagline placement: "${c.tagline || ''}".`,
    `Color palette: ${c.palette || 'rich cinematic palette'}. Typography direction: ${c.typography || 'bold display serif with metallic foil'}. Publisher mark: ${c.publisher || 'Winnersbookmark Incorporated'}.`,
    `Negative prompt: ${NEG_DEFAULT}.`,
  ].join(' ');
}

export function characterPortraitPrompt(c, style) {
  const s = findStyle(style);
  return [
    `Generate ${s.prefix} as a full-body character reference sheet of ${c.name || '[NAME]'}, ${c.age || 'adult'}, ${c.role || 'protagonist'}.`,
    `Build: ${c.body || 'athletic'}. Face: ${c.face || 'expressive features'}. Personality reads as ${c.personality || 'confident'}.`,
    `Costume: ${c.costume || 'signature outfit'}. Signature object: ${c.weapon || 'none'}. Color palette: ${c.palette || 'studio palette'}.`,
    `Three views: front, 3/4, profile. Same scale, neutral background, model-sheet lighting.`,
    `Consistency notes: ${c.consistencyNotes || 'lock proportions, hair, color, costume details for future panels'}.`,
    `Negative prompt: ${NEG_DEFAULT}.`,
  ].join(' ');
}

export function worldPrompt(w, style) {
  const s = findStyle(style);
  return [
    `Generate ${s.prefix} as an establishing environment plate of ${w.location || '[LOCATION]'} during ${w.period || 'the story’s era'}.`,
    `Mood: ${w.mood || 'cinematic'}. Color palette: ${w.palette || 'grounded cinematic palette'}.`,
    `Show culture & technology level: ${w.culture || 'unique culture'}, ${w.tech || 'tech level'}.`,
    `Landmarks visible: ${w.landmarks || 'key landmark'}. Hidden danger hint: ${w.danger || 'subtle threat'}.`,
    `Negative prompt: ${NEG_DEFAULT}.`,
  ].join(' ');
}

// ============== Master prompt builder (per-tool variants) ==============
export function masterPromptForTool({ tool, project, kind = 'panel', payload = {} }) {
  const base = describeProject(project);
  switch (tool) {
    case 'chatgpt':
    case 'claude':
    case 'gemini':
      return [
        `Act as a senior comic book writer and editor.`,
        `Project: ${base}`,
        `Task: ${kind === 'script' ? 'Write a full comic script with page-by-page panel breakdown, dialogue, and captions.' : kind === 'logline' ? 'Generate 5 punchy loglines and pick the strongest.' : 'Generate the requested asset below.'}`,
        payload.brief ? `Brief: ${payload.brief}` : '',
        `Constraints: keep dialogue under 25 words per balloon; one panel per beat; cliffhanger on last page.`,
      ].filter(Boolean).join('\n');
    case 'midjourney':
      return `${payload.image || panelPrompt({ style: project?.style, ...payload })} --ar ${payload.ar || '2:3'} --style raw --v 6`;
    case 'leonardo':
      return `${payload.image || panelPrompt({ style: project?.style, ...payload })}\nModel: Leonardo Vision XL. Guidance 7. Style: Illustration.`;
    case 'ideogram':
      return `${payload.image || panelPrompt({ style: project?.style, ...payload })}\nText to include exactly: "${payload.text || ''}". Render clean readable letters.`;
    case 'dalle':
      return `${payload.image || panelPrompt({ style: project?.style, ...payload })}\nNatural-language image generation; high detail; aspect 2:3.`;
    case 'runway':
    case 'pika':
    case 'kling':
    case 'veo':
      return [
        `Generate a 5-second cinematic shot from a still image of: ${payload.image || panelPrompt({ style: project?.style, ...payload })}`,
        `Camera move: ${payload.camera || 'slow push-in'}. Atmosphere: ${payload.atmosphere || 'cinematic'}.`,
        `Aspect: ${payload.ar || '16:9'}. Motion intensity: medium. Hold subject identity.`,
      ].join('\n');
    case 'canva':
      return [
        `In Canva, build a comic cover layout for "${project?.title || '[TITLE]'}".`,
        `Use generated key art as background. Title typography: ${payload.typography || 'bold display serif with foil texture'}.`,
        `Include: title, subtitle, issue number, tagline, publisher mark "Designed by Winnersbookmark Incorporated".`,
      ].join('\n');
    case 'photoshop':
      return [
        `In Photoshop, finish the panel: lettering pass, balloon placement, captions, SFX, dust & grain pass.`,
        `Source image: ${payload.image || 'generated panel art'}. Title typography: ${payload.typography || 'comic display sans'}.`,
        `Export: 300dpi CMYK if print, 72dpi sRGB if web.`,
      ].join('\n');
    default:
      return panelPrompt({ style: project?.style, ...payload });
  }
}

export function describeProject(p) {
  if (!p) return '';
  return `"${p.title || 'Untitled'}" — ${p.genre || 'genre'}, ${p.audience || 'audience'}, ${p.style || 'style'}; logline: ${p.logline || '—'}.`;
}

export const NEGATIVE_DEFAULT = NEG_DEFAULT;
