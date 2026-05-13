// Storytelling frameworks used by the Story Engine.
export const FRAMEWORKS = [
  {
    id: 'three-act',
    name: 'Three-Act Structure',
    beats: [
      { id: 'setup',       label: 'Act I — Setup' },
      { id: 'inciting',    label: 'Inciting Incident' },
      { id: 'rising',      label: 'Act II — Rising Action' },
      { id: 'midpoint',    label: 'Midpoint Turn' },
      { id: 'crisis',      label: 'Crisis / All Is Lost' },
      { id: 'climax',      label: 'Act III — Climax' },
      { id: 'resolution',  label: 'Resolution' },
    ],
  },
  {
    id: 'hero-journey',
    name: 'Hero’s Journey',
    beats: [
      { id: 'ordinary',   label: 'Ordinary World' },
      { id: 'call',       label: 'Call to Adventure' },
      { id: 'refusal',    label: 'Refusal of the Call' },
      { id: 'mentor',     label: 'Meeting the Mentor' },
      { id: 'threshold',  label: 'Crossing the Threshold' },
      { id: 'trials',     label: 'Tests, Allies, Enemies' },
      { id: 'ordeal',     label: 'Ordeal' },
      { id: 'reward',     label: 'Reward' },
      { id: 'road-back',  label: 'The Road Back' },
      { id: 'resurrection', label: 'Resurrection' },
      { id: 'return',     label: 'Return with the Elixir' },
    ],
  },
  {
    id: 'save-the-cat',
    name: 'Save the Cat Beats',
    beats: [
      { id: 'open',        label: 'Opening Image' },
      { id: 'theme',       label: 'Theme Stated' },
      { id: 'catalyst',    label: 'Catalyst' },
      { id: 'debate',      label: 'Debate' },
      { id: 'break',       label: 'Break Into Two' },
      { id: 'bstory',      label: 'B-Story' },
      { id: 'fun',         label: 'Fun & Games' },
      { id: 'mid',         label: 'Midpoint' },
      { id: 'bad',         label: 'Bad Guys Close In' },
      { id: 'all-lost',    label: 'All Is Lost' },
      { id: 'soul',        label: 'Dark Night of the Soul' },
      { id: 'finale',      label: 'Finale' },
      { id: 'final-image', label: 'Final Image' },
    ],
  },
  {
    id: 'comic-issue',
    name: 'Comic Issue Pacing',
    beats: [
      { id: 'cold-open',   label: 'Cold-Open Hook (page 1)' },
      { id: 'status-quo',  label: 'Establish Status Quo' },
      { id: 'inciting',    label: 'Inciting Conflict' },
      { id: 'escalation',  label: 'Escalation Spread' },
      { id: 'reversal',    label: 'Reversal' },
      { id: 'climax',      label: 'Climax Splash' },
      { id: 'cliffhanger', label: 'Cliffhanger (final page)' },
    ],
  },
];

export const findFramework = (id) => FRAMEWORKS.find(f => f.id === id) || FRAMEWORKS[0];
