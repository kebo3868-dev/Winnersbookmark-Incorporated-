// Master Prompt Builder targets — each transforms the same scene into the format that tool prefers.
export const AI_TOOLS = [
  { id: 'chatgpt',   name: 'ChatGPT',     kind: 'text',  description: 'OpenAI conversational model. Best for full scripts & dialogue.' },
  { id: 'claude',    name: 'Claude',      kind: 'text',  description: 'Anthropic — long, nuanced story development.' },
  { id: 'gemini',    name: 'Gemini',      kind: 'text',  description: 'Google — strong at structured outlines.' },
  { id: 'midjourney',name: 'Midjourney',  kind: 'image', description: 'Painterly cinematic image generation.' },
  { id: 'leonardo',  name: 'Leonardo AI', kind: 'image', description: 'Stylized illustration, comic-friendly.' },
  { id: 'ideogram',  name: 'Ideogram',    kind: 'image', description: 'Best for prompts that include readable text.' },
  { id: 'dalle',     name: 'DALL·E',      kind: 'image', description: 'OpenAI image — natural-language prompts.' },
  { id: 'runway',    name: 'Runway',      kind: 'video', description: 'Image-to-video & cinematic motion.' },
  { id: 'pika',      name: 'Pika',        kind: 'video', description: 'Short clip generation from a panel.' },
  { id: 'kling',     name: 'Kling',       kind: 'video', description: 'High-realism cinematic video.' },
  { id: 'veo',       name: 'Veo',         kind: 'video', description: 'Google video — long-form cinematic.' },
  { id: 'canva',     name: 'Canva',       kind: 'design',description: 'Layout cover & socials directly.' },
  { id: 'photoshop', name: 'Photoshop',   kind: 'design',description: 'Final retouching & lettering pass.' },
];

export const findTool = (id) => AI_TOOLS.find(t => t.id === id) || AI_TOOLS[0];
