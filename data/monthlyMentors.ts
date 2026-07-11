/**
 * Monthly Mentor Board — DESIGNED TO ROTATE EVERY MONTH.
 *
 * NOTE ON IMAGERY: We deliberately do NOT use celebrity photos. Mentor cards
 * render symbolic leadership visuals — monograms, silhouettes, typography,
 * and cinematic gradient treatments — until licensed assets are added.
 */

export interface MonthlyMentor {
  id: string;
  name: string;
  field: string;
  coreLesson: string;
  monthlyFocus: string;
  signatureQuote: string;
  monogram: string;
  gradient: string; // Tailwind gradient classes for the symbolic visual
}

export const mentorBoardMonth = "July 2026";

export const monthlyMentors: MonthlyMentor[] = [
  {
    id: "jim-rohn",
    name: "Jim Rohn",
    field: "Personal Development",
    coreLesson: "Work harder on yourself than you do on your job.",
    monthlyFocus: "Daily disciplines and the compounding of small habits.",
    signatureQuote:
      "Success is nothing more than a few simple disciplines, practiced every day.",
    monogram: "JR",
    gradient: "from-gold-600/40 via-espresso-800 to-ink-900",
  },
  {
    id: "les-brown",
    name: "Les Brown",
    field: "Motivation & Speaking",
    coreLesson: "Someone's opinion of you does not have to become your reality.",
    monthlyFocus: "Voice, self-talk, and speaking your standards out loud.",
    signatureQuote: "You gotta be hungry!",
    monogram: "LB",
    gradient: "from-ember-500/40 via-espresso-800 to-ink-900",
  },
  {
    id: "marcus-aurelius",
    name: "Marcus Aurelius",
    field: "Stoic Philosophy",
    coreLesson: "You have power over your mind — not outside events.",
    monthlyFocus: "Morning reflection and emotional control under pressure.",
    signatureQuote:
      "Waste no more time arguing what a good man should be. Be one.",
    monogram: "MA",
    gradient: "from-focus-500/40 via-ink-800 to-ink-900",
  },
  {
    id: "robert-greene",
    name: "Robert Greene",
    field: "Strategy & Power",
    coreLesson: "Master the game so it can never be played against you.",
    monthlyFocus: "Reading rooms, patience, and strategic positioning.",
    signatureQuote: "The future belongs to those who learn more skills.",
    monogram: "RG",
    gradient: "from-ink-600 via-ink-800 to-ink-950",
  },
  {
    id: "kobe-bryant",
    name: "Kobe Bryant",
    field: "Elite Performance",
    coreLesson: "The Mamba Mentality — obsess over the process, not the applause.",
    monthlyFocus: "4am work: outworking your talent every single day.",
    signatureQuote: "The most important thing is to try and inspire people.",
    monogram: "KB",
    gradient: "from-gold-500/30 via-ink-800 to-ink-950",
  },
  {
    id: "michael-jordan",
    name: "Michael Jordan",
    field: "Competitive Greatness",
    coreLesson: "I've failed over and over — and that is why I succeed.",
    monthlyFocus: "Turning failure into fuel and practice into dominance.",
    signatureQuote: "Limits, like fears, are often just an illusion.",
    monogram: "MJ",
    gradient: "from-ember-500/30 via-ink-800 to-ink-950",
  },
  {
    id: "david-goggins",
    name: "David Goggins",
    field: "Mental Toughness",
    coreLesson: "The 40% rule — when your mind says done, you're barely started.",
    monthlyFocus: "Callousing the mind through voluntary hardship.",
    signatureQuote: "You are in danger of living a life so comfortable you'll die without ever realizing your potential.",
    monogram: "DG",
    gradient: "from-ink-500 via-ink-800 to-ink-950",
  },
  {
    id: "tim-grover",
    name: "Tim Grover",
    field: "Winning & Coaching",
    coreLesson: "Winning never lies — it demands everything and explains nothing.",
    monthlyFocus: "The 'cleaner' standard: done is decided before you start.",
    signatureQuote: "Being relentless means demanding more of yourself than anyone else could ever demand of you.",
    monogram: "TG",
    gradient: "from-bronze-500/40 via-espresso-800 to-ink-950",
  },
  {
    id: "barack-obama",
    name: "Barack Obama",
    field: "Leadership & Composure",
    coreLesson: "Calm is a leadership decision — especially under fire.",
    monthlyFocus: "Decision routines, composure, and playing the long game.",
    signatureQuote: "Change will not come if we wait for some other person or some other time.",
    monogram: "BO",
    gradient: "from-focus-500/30 via-ink-800 to-ink-950",
  },
];
