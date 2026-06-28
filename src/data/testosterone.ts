import type { TestosteroneCard, HabitItem } from '../types';

// IMPORTANT DISCLAIMER: All content in this section is general wellness and
// lifestyle education only. Nothing here constitutes medical advice, diagnosis,
// or treatment. Users with hormonal concerns should consult a qualified physician.

export const TESTO_DISCLAIMER =
  'This content is for general wellness and educational purposes only. It does not constitute medical advice, diagnosis, or treatment. Results vary by individual. Consult a qualified healthcare professional for any health concerns.';

export const TESTO_CARDS: TestosteroneCard[] = [
  {
    id: 'testo_sleep',
    title: 'Sleep and Hormones',
    category: 'Recovery',
    excerpt:
      'The majority of your daily testosterone is produced during sleep. Shortchanging sleep is shortchanging your results — full stop.',
    thumbnailUrl: '/assets/testo/sleep.jpg',
    isPremium: false,
    disclaimer: TESTO_DISCLAIMER,
    keyPoints: [
      'Most testosterone is produced during deep sleep (NREM stages 3–4)',
      'Sleeping less than 6 hours can reduce morning testosterone levels measurably',
      '7–9 hours is the optimal range for most men',
      'Consistent sleep schedule matters — irregular sleep disrupts circadian rhythm',
      'Prioritize a dark, cool, quiet sleep environment',
    ],
    content: [
      'Sleep is not a passive state — it is active recovery. During the deep sleep phases, your body releases growth hormone, repairs muscle tissue, and produces the majority of your daily testosterone.',
      "Studies show that men who sleep less than 6 hours per night show significantly lower morning testosterone levels compared to those sleeping 7–9 hours. The difference is not small — it's meaningful for performance, body composition, and wellbeing.",
      'Practical steps: Set a consistent bedtime and wake time. Sleep in a dark room (blackout curtains if needed). Keep the room cool — 65–68°F / 18–20°C is optimal. Cut screens at least 30 minutes before sleep. Avoid alcohol within 3 hours of bed — it disrupts sleep architecture even if it helps you fall asleep.',
      'One good week of sleep will not fully compensate for months of poor sleep. Build consistent habits. This is not optional.',
    ],
  },
  {
    id: 'testo_lifting',
    title: 'Lift Heavy, Lift Right',
    category: 'Training',
    excerpt:
      'Resistance training, particularly compound movements, is one of the most direct lifestyle levers that supports healthy testosterone habits.',
    thumbnailUrl: '/assets/testo/lifting.jpg',
    isPremium: false,
    disclaimer: TESTO_DISCLAIMER,
    keyPoints: [
      'Compound barbell movements (squat, deadlift, bench, row) produce the largest anabolic stimulus',
      'Progressive overload is the mechanism — consistently lifting more over time',
      'Training volume and intensity both matter',
      'Overtraining without recovery is counterproductive',
      '3–5 sessions per week is optimal for most men',
    ],
    content: [
      'Resistance training — specifically heavy compound movements — triggers an acute hormonal response that, over time, supports a healthier physiological environment. The squat, deadlift, bench press, and overhead press are the cornerstones of this approach.',
      'The key principle is progressive overload: you must consistently challenge your muscles with increasing demands. This means more weight, more reps, more volume — over time. Comfortable training is maintenance training at best.',
      'Training frequency matters. 3–5 resistance training sessions per week is ideal. Too little volume limits stimulus. Too much volume without recovery is counterproductive and adds stress load that works against your goals.',
      'Rest between sessions allows adaptation to occur. Training destroys — sleep and nutrition build. Both halves of the equation are required.',
    ],
  },
  {
    id: 'testo_body_fat',
    title: 'Drop Excess Body Fat',
    category: 'Body Composition',
    excerpt:
      'Excess body fat, particularly around the midsection, is associated with a less favorable hormonal environment. Getting leaner has compounding benefits.',
    thumbnailUrl: '/assets/testo/body-fat.jpg',
    isPremium: false,
    disclaimer: TESTO_DISCLAIMER,
    keyPoints: [
      'Adipose (fat) tissue contains aromatase, an enzyme that converts hormones',
      'Reducing body fat — particularly visceral fat — is one of the most impactful lifestyle changes',
      'Waist circumference is a useful proxy for visceral fat',
      'Achieving and maintaining a healthy body composition is a long-term strategy',
      'Rapid crash dieting is counterproductive — causes muscle loss and metabolic stress',
    ],
    content: [
      'Body composition matters beyond appearance. Excess body fat — particularly the visceral fat stored around the abdomen — creates a less favorable hormonal environment. The mechanism is well understood: fat tissue contains an enzyme that converts hormones, shifting the hormonal balance.',
      'The most important takeaway is practical: getting leaner through a combination of resistance training, a moderate calorie deficit, and high protein intake is one of the most impactful lifestyle changes a man can make for his overall wellbeing.',
      'This does not mean being as lean as possible at all times. It means achieving and maintaining a healthy body composition — roughly 10–20% body fat for most men is a reasonable target range. Below 10% may not be sustainable or necessary for most goals.',
      'Prioritize progressive fat loss over rapid weight loss. Crash diets lose muscle alongside fat and create excessive hormonal and metabolic stress. Lose weight at 0.5–1kg per week maximum.',
    ],
  },
  {
    id: 'testo_stress',
    title: 'Stress and Cortisol',
    category: 'Lifestyle',
    excerpt:
      'Chronic stress drives up cortisol — the body\'s primary stress hormone. When cortisol is chronically elevated, it works against your physiological goals.',
    thumbnailUrl: '/assets/testo/stress.jpg',
    isPremium: false,
    disclaimer: TESTO_DISCLAIMER,
    keyPoints: [
      'Cortisol is the primary stress hormone — acute cortisol is normal and useful',
      'Chronic stress creates chronically elevated cortisol which disrupts sleep, metabolism, and recovery',
      'Common stress drivers: overwork, under-recovery, poor sleep, nutritional deficiency, overtraining',
      'Stress management is not a soft skill — it is a physiological necessity',
      'Daily practices: breathwork, walks, training, adequate sleep, limiting stimulants',
    ],
    content: [
      'Cortisol is your body\'s primary stress hormone. In short bursts, it is useful — it mobilizes energy, sharpens focus, and helps you handle demands. The problem is chronic stress, which keeps cortisol elevated around the clock.',
      'Chronically high cortisol disrupts sleep quality, increases fat storage (particularly in the abdominal region), promotes muscle breakdown, impairs recovery, and creates a cascade of negative physiological effects.',
      'The most common drivers of chronic cortisol in men: excessive work pressure without recovery, poor sleep, overtraining without adequate rest, nutritional deficiency (skipping meals, under-eating), and lifestyle stimulant overuse.',
      'Managing stress is not about becoming soft — it is about being strategic. Daily walks, structured breathing exercises, adequate time off, social connection, and protecting your sleep are not luxuries. They are tools that keep you performing at a high level sustainably.',
    ],
  },
  {
    id: 'testo_recovery',
    title: 'Recovery Matters',
    category: 'Recovery',
    excerpt:
      'What you do between training sessions determines how much of your training investment actually converts to results.',
    thumbnailUrl: '/assets/testo/recovery.jpg',
    isPremium: false,
    disclaimer: TESTO_DISCLAIMER,
    keyPoints: [
      'Muscle is built during recovery, not during training',
      'Sleep is the foundation of all recovery',
      'Nutrition — especially protein and carbs post-workout — drives recovery',
      'Active recovery (walking, mobility) is superior to complete sedentary rest',
      'Deload weeks every 4–8 weeks prevent accumulated fatigue',
    ],
    content: [
      'Training is a stimulus. Recovery is where the adaptation happens. Men who train hard but neglect recovery are investing money in a business and never collecting the return.',
      'The recovery hierarchy: 1) Sleep 2) Nutrition 3) Stress management 4) Active recovery and mobility. If your sleep is poor and your nutrition is inconsistent, no recovery tool or supplement will compensate.',
      'Post-workout: consume protein and carbohydrates within 1–2 hours of training. This is not required to the exact minute, but prioritizing post-workout nutrition significantly improves recovery.',
      'Every 4–8 weeks, consider a deload: reduce training volume by 40–50% for one week. This allows accumulated fatigue to dissipate so you can come back stronger.',
      'Active recovery — a 20–30 minute walk, light mobility work, or stretching — is more effective than complete rest on off days. Movement promotes blood flow, reduces soreness, and maintains habit consistency.',
    ],
  },
  {
    id: 'testo_foods',
    title: 'Foods That Support Performance',
    category: 'Nutrition',
    excerpt:
      'These specific foods have legitimate nutritional profiles that support a healthy physiological environment for active men.',
    thumbnailUrl: '/assets/testo/foods.jpg',
    isPremium: false,
    disclaimer: TESTO_DISCLAIMER,
    keyPoints: [
      'Eggs: complete protein + healthy fats including zinc',
      'Beef and lamb: zinc, iron, complete amino acid profile',
      'Salmon and sardines: omega-3 fatty acids, vitamin D',
      'Avocado and olive oil: monounsaturated fats, anti-inflammatory',
      'Cruciferous vegetables: broccoli, cabbage — nutrient dense with micronutrient benefit',
      'Brazil nuts: selenium — important micronutrient for metabolic function',
      'Pomegranate and berries: antioxidants and flavonoids',
    ],
    content: [
      "Your hormonal environment is built from what you eat. Fat is particularly important — it is the raw material for steroid hormones. Men who eat very low fat diets consistently show less favorable hormonal profiles. Healthy fats are not optional.",
      "Zinc is an essential mineral for many biological processes. Foods rich in zinc: beef, lamb, oysters, pumpkin seeds, eggs. If you train hard and sweat a lot, zinc depletion can occur. Prioritize zinc-rich foods in your diet.",
      "Vitamin D functions as a hormone in the body and plays roles in numerous physiological processes. Most men who live in northern climates or have desk jobs are deficient. Get regular sun exposure when possible. Consider a Vitamin D3 supplement during winter months.",
      "The anti-inflammatory diet principle is relevant here: omega-3 rich foods (salmon, sardines, mackerel, walnuts, flaxseed), polyphenol-rich foods (berries, olive oil, green tea), and cruciferous vegetables support the overall physiological environment.",
      "Alcohol reduces sleep quality, disrupts recovery, adds empty calories, and should be minimized for any man serious about his physique and performance. There is no amount of alcohol that improves your fitness results.",
    ],
  },
  {
    id: 'testo_habits_hurt',
    title: 'Daily Habits That Work Against You',
    category: 'Lifestyle',
    excerpt:
      'These common behaviors silently undermine your physique and performance. Eliminating them is as important as adding good ones.',
    thumbnailUrl: '/assets/testo/habits-hurt.jpg',
    isPremium: false,
    disclaimer: TESTO_DISCLAIMER,
    keyPoints: [
      'Poor sleep — less than 7 hours consistently',
      'Alcohol — disrupts sleep, recovery, and body composition',
      'Excessive sitting / sedentary lifestyle',
      'Chronic calorie restriction / crash dieting',
      'Overtraining without recovery',
      'Chronic stress without management',
      'Nutrient deficiencies (particularly zinc, vitamin D, omega-3)',
    ],
    content: [
      "The most impactful changes are often eliminating what works against you rather than adding new things. Here are the main offenders.",
      "ALCOHOL: Even moderate alcohol consumption disrupts sleep architecture, increases cortisol, reduces muscle protein synthesis, and adds empty calories. There is no version of alcohol that helps your fitness goals.",
      "POOR SLEEP: Consistently sleeping under 7 hours creates a negative feedback loop across your entire physiology — not just your hormone levels. It impairs willpower, appetite regulation, cognitive performance, and recovery simultaneously.",
      "EXCESSIVE SITTING: A sedentary lifestyle — even when combined with gym training — is associated with poorer health outcomes than an active lifestyle without formal gym time. Walk more. Stand more. Move consistently throughout the day.",
      "CRASH DIETING: Severe calorie restriction signals physical stress, promotes muscle breakdown, disrupts hormonal balance, and is almost always followed by rebound weight gain. Sustainable deficits of 300–500 calories daily are more effective over time.",
    ],
  },
  {
    id: 'testo_sunlight',
    title: 'Sunlight, Movement & Natural Rhythms',
    category: 'Lifestyle',
    excerpt:
      'Your body is calibrated to the sun. Morning light, daily movement, and circadian alignment are underrated pillars of the masculine physique.',
    thumbnailUrl: '/assets/testo/sunlight.jpg',
    isPremium: false,
    disclaimer: TESTO_DISCLAIMER,
    keyPoints: [
      'Morning sunlight exposure sets your circadian clock',
      'Circadian alignment improves sleep quality and hormone timing',
      'Vitamin D from sunlight is the most bioavailable form',
      '10,000+ steps daily is a meaningful movement baseline',
      'Cold exposure (optional) — cold showers or ice baths may support recovery',
    ],
    content: [
      'Getting outside — particularly in the morning — is one of the most underrated habits for men serious about performance. Morning sunlight exposure (10–30 minutes within 1 hour of waking) sets your circadian rhythm, which governs sleep quality, wake time alertness, and the timing of many physiological processes.',
      "Vitamin D from sun exposure is more bioavailable than supplemental Vitamin D. Where climate allows, getting regular sun exposure on large skin surface areas (arms and legs, not just face) for 15–30 minutes daily has meaningful health benefits.",
      'Daily movement baseline matters. 8,000–12,000 steps per day, even without formal exercise, is associated with significantly better metabolic health. If your job is sedentary, deliberately build movement into your day — walking meetings, standing, morning and evening walks.',
      'Cold exposure — cold showers, cold plunges — has a growing body of research around recovery and alertness, though the direct physiological effects are modest. The real benefit may be discipline training: building the habit of doing uncomfortable things voluntarily is the kind of mental practice that carries over into your training and life.',
    ],
  },
];

export const HABIT_ITEMS: HabitItem[] = [
  { id: 'habit_sleep', label: 'Slept 7+ hours', icon: '🌙', category: 'sleep' },
  { id: 'habit_trained', label: 'Trained today', icon: '💪', category: 'training' },
  { id: 'habit_protein', label: 'Hit protein target', icon: '🥩', category: 'nutrition' },
  { id: 'habit_walked', label: 'Walked outside', icon: '☀️', category: 'lifestyle' },
  { id: 'habit_alcohol', label: 'Avoided alcohol', icon: '🚫', category: 'lifestyle' },
  { id: 'habit_stress', label: 'Managed stress well', icon: '🧘', category: 'lifestyle' },
  { id: 'habit_hydration', label: 'Hydration complete', icon: '💧', category: 'nutrition' },
];
