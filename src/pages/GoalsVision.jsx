import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Target, Calendar, Eye, Crown, Save } from 'lucide-react';
import { useApp } from '../context/AppContext';
import Layout from '../components/Layout';

const timeHorizons = [
  {
    key: 'today',
    label: "Today's Top 3 Priorities",
    icon: Target,
    color: 'text-wb-blue-light',
    bgColor: 'bg-wb-blue/10',
    borderColor: 'border-wb-blue/30',
    description: 'What must happen today to move the needle?',
    type: 'priorities',
  },
  {
    key: 'weeklyWin',
    label: 'This Week\'s Main Win',
    icon: Target,
    color: 'text-wb-blue-light',
    bgColor: 'bg-wb-blue/10',
    borderColor: 'border-wb-blue/20',
    description: 'The single most important outcome this week.',
    type: 'text',
  },
  {
    key: 'monthlyTarget',
    label: 'This Month\'s Target',
    icon: Calendar,
    color: 'text-wb-blue-light',
    bgColor: 'bg-wb-blue/10',
    borderColor: 'border-wb-blue/20',
    description: 'What does a winning month look like?',
    type: 'text',
  },
  {
    key: 'ninetyDay',
    label: '90-Day Mission',
    icon: Target,
    color: 'text-wb-blue-light',
    bgColor: 'bg-wb-blue/15',
    borderColor: 'border-wb-blue/25',
    description: 'Your focused sprint goal for the next quarter.',
    type: 'text',
  },
  {
    key: 'twoYear',
    label: '2-Year Target',
    icon: Eye,
    color: 'text-wb-blue-light',
    bgColor: 'bg-wb-blue/15',
    borderColor: 'border-wb-blue/25',
    description: 'Where will you be in two years if you stay on track?',
    type: 'text',
  },
  {
    key: 'fiveYear',
    label: '5-Year Vision',
    icon: Eye,
    color: 'text-wb-blue-light',
    bgColor: 'bg-wb-blue/20',
    borderColor: 'border-wb-blue/30',
    description: 'The life and results you are building toward.',
    type: 'text',
  },
  {
    key: 'tenYear',
    label: '10-Year Identity',
    icon: Crown,
    color: 'text-wb-gold',
    bgColor: 'bg-wb-gold/10',
    borderColor: 'border-wb-gold/20',
    description: 'Who are you becoming? What identity are you casting votes for?',
    type: 'text',
  },
  {
    key: 'twentyYear',
    label: '20-Year Legacy',
    icon: Crown,
    color: 'text-wb-gold',
    bgColor: 'bg-wb-gold/10',
    borderColor: 'border-wb-gold/20',
    description: 'The lasting impact you want to leave behind.',
    type: 'text',
  },
];

export default function GoalsVision() {
  const { goals, setGoals, todayEntry } = useApp();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    weeklyWin: goals.weeklyWin || '',
    monthlyTarget: goals.monthlyTarget || '',
    ninetyDay: goals.ninetyDay || '',
    twoYear: goals.twoYear || '',
    fiveYear: goals.fiveYear || '',
    tenYear: goals.tenYear || '',
    twentyYear: goals.twentyYear || '',
  });

  const [saved, setSaved] = useState(false);

  const priorities = todayEntry?.morning?.priorities || ['', '', ''];

  function handleChange(key, value) {
    setForm(prev => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  function handleSave() {
    setGoals({ ...goals, ...form });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <Layout>
      <div className="page-container space-y-5 pb-8">
        {/* Header */}
        <div className="page-header">
          <div className="flex items-center gap-2 mb-1">
            <Eye size={20} className="text-wb-blue-light" />
            <span className="text-xs font-medium text-wb-muted uppercase tracking-wider">
              Winner's Bookmark Daily
            </span>
          </div>
          <h1 className="text-xl font-bold text-wb-white">Goals &amp; Vision</h1>
          <p className="text-sm text-wb-muted mt-1">
            Connect today's actions to your long-term legacy. Every horizon should reinforce the one above it.
          </p>
        </div>

        {/* Visual timeline connector */}
        <div className="card slide-up">
          <div className="flex items-center gap-2 mb-3">
            <Target size={16} className="text-wb-blue-light" />
            <span className="section-title">From Today to Legacy</span>
          </div>
          <div className="flex items-center gap-1 overflow-x-auto pb-1">
            {['Today', 'Week', 'Month', '90 Days', '2 Yr', '5 Yr', '10 Yr', '20 Yr'].map((label, i) => (
              <div key={label} className="flex items-center flex-shrink-0">
                <span className={`text-xs px-2 py-1 rounded-full border ${
                  i < 4
                    ? 'bg-wb-blue/10 border-wb-blue/30 text-wb-blue-light'
                    : 'bg-wb-gold/10 border-wb-gold/20 text-wb-gold'
                }`}>
                  {label}
                </span>
                {i < 7 && (
                  <span className="text-wb-muted text-xs mx-0.5">&rarr;</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Today's Priorities (read-only from morning entry) */}
        <div className="card slide-up">
          <div className="flex items-center gap-2 mb-1">
            <Target size={16} className="text-wb-blue-light" />
            <span className="section-title">Today's Top 3 Priorities</span>
          </div>
          <p className="text-xs text-wb-muted mb-3">
            Set these in your morning entry. Shown here for alignment.
          </p>
          <div className="space-y-2">
            {priorities.map((p, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-wb-blue/20 text-wb-blue-light text-xs flex items-center justify-center flex-shrink-0 mt-0.5 font-bold">
                  {i + 1}
                </span>
                <span className={`text-sm ${p ? 'text-wb-white' : 'text-wb-muted italic'}`}>
                  {p || 'Not set'}
                </span>
              </div>
            ))}
          </div>
          {!priorities.some(Boolean) && (
            <button
              onClick={() => navigate('/daily')}
              className="mt-3 text-xs text-wb-blue-light font-medium"
            >
              Go to morning entry &rarr;
            </button>
          )}
        </div>

        {/* Editable goal fields */}
        {timeHorizons.filter(h => h.type === 'text').map((horizon, idx) => {
          const Icon = horizon.icon;
          return (
            <div key={horizon.key} className="card slide-up" style={{ animationDelay: `${(idx + 1) * 50}ms` }}>
              <div className="flex items-center gap-2 mb-1">
                <Icon size={16} className={horizon.color} />
                <span className="section-title">{horizon.label}</span>
              </div>
              <p className="text-xs text-wb-muted mb-3">{horizon.description}</p>
              <textarea
                value={form[horizon.key]}
                onChange={e => handleChange(horizon.key, e.target.value)}
                placeholder={`Enter your ${horizon.label.toLowerCase()}...`}
                rows={3}
                className="w-full bg-wb-card border border-wb-border rounded-xl px-3 py-2.5 text-sm text-wb-white placeholder:text-wb-muted/50 focus:outline-none focus:border-wb-blue/50 resize-none transition-colors"
              />
            </div>
          );
        })}

        {/* Save button */}
        <div className="slide-up" style={{ animationDelay: '400ms' }}>
          <button
            onClick={handleSave}
            className={`btn-primary w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all ${
              saved ? 'bg-green-500/20 text-green-400 border border-green-400/30' : 'bg-wb-blue text-white'
            }`}
          >
            <Save size={16} />
            {saved ? 'Saved!' : 'Save All Goals'}
          </button>
        </div>

        {/* Motivational footer */}
        <div className="card slide-up text-center" style={{ animationDelay: '450ms' }}>
          <p className="text-xs text-wb-muted italic leading-relaxed">
            "The secret of your future is hidden in your daily routine."
          </p>
          <p className="text-xs text-wb-muted mt-1">— Mike Murdock</p>
        </div>
      </div>
    </Layout>
  );
}
