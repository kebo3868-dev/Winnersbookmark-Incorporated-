// Visual styles — each carries a unique prompt prefix template used by the panel/cover generators.
export const STYLES = [
  {
    id: 'us-superhero',
    name: 'American Superhero',
    blurb: 'Bold inks, vibrant primaries, dynamic poses — Marvel / DC Bronze-to-Modern era.',
    prefix: 'a vibrant american superhero comic panel, bold black inks, saturated primary colors, dynamic foreshortening, four-color halftone shading',
  },
  {
    id: 'graphic-noir',
    name: 'Dark Cinematic Graphic Novel',
    blurb: 'Cinematic chiaroscuro, painterly tones — Hellboy, Sin City, Batman: Year One energy.',
    prefix: 'a dark cinematic graphic novel panel, painterly chiaroscuro lighting, muted desaturated palette, moody contrast, gritty texture',
  },
  {
    id: 'manga',
    name: 'Manga',
    blurb: 'B/W ink, screentone, expressive eyes, speed lines.',
    prefix: 'a high-quality black and white manga panel, screentone shading, crisp ink lines, expressive eyes, speed lines, dynamic angle',
  },
  {
    id: 'anime',
    name: 'Anime',
    blurb: 'Cel-shaded anime, sharp linework, vivid colors.',
    prefix: 'a polished anime comic panel, cel-shaded coloring, sharp clean linework, vivid saturated palette, cinematic composition',
  },
  {
    id: 'storybook',
    name: 'Children’s Storybook',
    blurb: 'Soft watercolor, friendly characters, gentle palette.',
    prefix: 'a warm children’s storybook illustration panel, soft watercolor textures, friendly rounded character design, gentle pastel palette',
  },
  {
    id: 'vintage-newspaper',
    name: 'Vintage Newspaper Comic',
    blurb: '1950s newsprint style, Ben-Day dots, limited colors.',
    prefix: 'a vintage 1950s newspaper comic strip panel, Ben-Day dot shading, limited 4-color palette, aged newsprint texture, retro linework',
  },
  {
    id: 'noir-detective',
    name: 'Noir Detective',
    blurb: 'Black & white pulp, harsh shadows, rain, smoke.',
    prefix: 'a black-and-white noir detective comic panel, harsh single-source lighting, deep shadows, rain and cigarette smoke, pulp atmosphere',
  },
  {
    id: 'hyperreal',
    name: 'Hyper-Realistic Cinematic',
    blurb: 'Photoreal cinematic frame, film grain, depth of field.',
    prefix: 'a hyper-realistic cinematic comic panel, photoreal rendering, anamorphic lens, film grain, shallow depth of field, color-graded',
  },
  {
    id: 'saturday-cartoon',
    name: 'Saturday Morning Cartoon',
    blurb: 'Bouncy, colorful, simplified shapes, 90s TV vibe.',
    prefix: 'a 90s saturday morning cartoon comic panel, bouncy simplified shapes, bright cheerful palette, thick outlines, expressive faces',
  },
  {
    id: 'urban-cartoon',
    name: 'Urban Cartoon (Boondocks-inspired)',
    blurb: 'Stylized urban cartoon — sharp linework, anime-meets-street energy.',
    prefix: 'a stylized urban cartoon comic panel inspired by modern anime-meets-street aesthetics, crisp linework, confident character design, urban color palette',
  },
  {
    id: '90s-comic',
    name: '1990s Comic Book',
    blurb: 'Exaggerated anatomy, gritty inks, foil-cover energy.',
    prefix: 'a 1990s comic book panel, exaggerated anatomy, gritty heavy inks, glossy saturated colors, dynamic crosshatching, foil-cover energy',
  },
  {
    id: 'fantasy-illustration',
    name: 'Fantasy Illustration',
    blurb: 'High-fantasy painted look — magic light, epic scale.',
    prefix: 'an epic fantasy illustration comic panel, painterly rendering, magical rim light, mythic scale, rich jewel-tone palette',
  },
  {
    id: 'horror-novel',
    name: 'Horror Graphic Novel',
    blurb: 'Dread, fog, blood, hand-painted shadows.',
    prefix: 'a horror graphic novel panel, oppressive shadows, fog, blood and bone accents, painterly dread, desaturated palette with crimson highlights',
  },
  {
    id: 'edu-textbook',
    name: 'Educational Textbook Comic',
    blurb: 'Clean infographic-style panels, friendly diagrams.',
    prefix: 'an educational textbook comic panel, clean infographic illustration style, friendly diagrammatic detail, balanced palette, readable composition',
  },
  {
    id: 'luxury-editorial',
    name: 'Luxury Editorial Comic',
    blurb: 'Editorial fashion-mag composition — gold, ink, paper-white.',
    prefix: 'a luxury editorial comic panel, fashion-magazine composition, restrained palette of gold, ink-black, paper-white, refined typography hints',
  },
  {
    id: 'webtoon',
    name: 'Webtoon Vertical Scroll',
    blurb: 'Mobile-first vertical panels — clean color, expressive faces.',
    prefix: 'a webtoon vertical-scroll comic panel, vertical 9:16 composition, clean digital coloring, expressive close-ups, mobile-optimized framing',
  },
];

export const findStyle = (id) => STYLES.find(s => s.id === id) || STYLES[0];
