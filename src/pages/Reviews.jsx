import { useState } from 'react';
import { BookOpen, Plus, Calendar, ChevronRight, Trash2, Edit3 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import Layout from '../components/Layout';
import Modal from '../components/Modal';
import EmptyState from '../components/EmptyState';

const REVIEW_TYPES = ['Daily', 'Weekly', 'Monthly', 'Quarterly'];

const FIELD_CONFIGS = {
  Daily: [
    { key: 'whatWorked', label: 'What Worked', type: 'input' },
    { key: 'whatDidnt', label: "What Didn't Work", type: 'input' },
    { key: 'keyLesson', label: 'Key Lesson', type: 'input' },
    { key: 'priorityForTomorrow', label: 'Priority for Tomorrow', type: 'input' },
  ],
  Weekly: [
    { key: 'topWins', label: 'Top Wins', type: 'textarea' },
    { key: 'biggestChallenge', label: 'Biggest Challenge', type: 'input' },
    { key: 'systemsToImprove', label: 'Systems to Improve', type: 'input' },
    { key: 'nextWeekPriorities', label: 'Next Week Priorities', type: 'textarea' },
    { key: 'oneThingToLetGo', label: 'One Thing to Let Go', type: 'input' },
  ],
  Monthly: [
    { key: 'monthSummary', label: 'Month Summary', type: 'textarea' },
    { key: 'goalsHit', label: 'Goals Hit', type: 'input' },
    { key: 'goalsMissed', label: 'Goals Missed', type: 'input' },
    { key: 'biggestGrowth', label: 'Biggest Growth', type: 'input' },
    { key: 'biggestSetback', label: 'Biggest Setback', type: 'input' },
    { key: 'nextMonthFocus', label: 'Next Month Focus', type: 'input' },
  ],
  Quarterly: [
    { key: 'quarterSummary', label: 'Quarter Summary', type: 'textarea' },
    { key: 'ninetyDayReview', label: '90-Day Review', type: 'input' },
    { key: 'whatToKeep', label: 'What to Keep', type: 'input' },
    { key: 'whatToStop', label: 'What to Stop', type: 'input' },
    { key: 'whatToStart', label: 'What to Start', type: 'input' },
    { key: 'nextQuarterMission', label: 'Next Quarter Mission', type: 'input' },
  ],
};

const TYPE_COLORS = {
  Daily: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  Weekly: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  Monthly: 'bg-green-500/20 text-green-400 border-green-500/30',
  Quarterly: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
};

function buildEmptyContent(type) {
  const obj = {};
  FIELD_CONFIGS[type].forEach((f) => {
    obj[f.key] = '';
  });
  return obj;
}

export default function Reviews() {
  const { reviews, setReviews } = useApp();
  const [activeTab, setActiveTab] = useState('Daily');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingReview, setEditingReview] = useState(null);
  const [formData, setFormData] = useState(() => buildEmptyContent('Daily'));

  const filteredReviews = reviews.filter((r) => r.type === activeTab);

  function openNewReview() {
    setEditingReview(null);
    setFormData(buildEmptyContent(activeTab));
    setModalOpen(true);
  }

  function openEditReview(review) {
    setEditingReview(review);
    setFormData({ ...review.content });
    setModalOpen(true);
  }

  function handleFieldChange(key, value) {
    setFormData((prev) => ({ ...prev, [key]: value }));
  }

  function handleSave() {
    if (editingReview) {
      setReviews(
        reviews.map((r) =>
          r.id === editingReview.id ? { ...r, content: { ...formData } } : r
        )
      );
    } else {
      const newReview = {
        id: Date.now().toString(),
        type: activeTab,
        date: new Date().toISOString().slice(0, 10),
        content: { ...formData },
        createdAt: new Date().toISOString(),
      };
      setReviews([newReview, ...reviews]);
    }
    setModalOpen(false);
    setEditingReview(null);
  }

  function handleDelete(id) {
    setReviews(reviews.filter((r) => r.id !== id));
  }

  function handleTabChange(type) {
    setActiveTab(type);
  }

  const fields = FIELD_CONFIGS[activeTab];

  return (
    <Layout>
      <div className="page-container pb-28">
        {/* Header */}
        <div className="page-header flex items-center justify-between">
          <div>
            <h1 className="section-title flex items-center gap-2">
              <BookOpen size={22} className="text-wb-blue-glow" />
              Reviews
            </h1>
            <p className="text-sm text-wb-muted mt-1">
              Reflect. Learn. Grow.
            </p>
          </div>
          <button onClick={openNewReview} className="btn-primary flex items-center gap-1.5 text-sm">
            <Plus size={16} />
            New Review
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2 mt-6 scrollbar-hide">
          {REVIEW_TYPES.map((type) => (
            <button
              key={type}
              onClick={() => handleTabChange(type)}
              className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all border ${
                activeTab === type
                  ? 'bg-wb-blue/20 text-wb-blue-glow border-wb-blue/30'
                  : 'bg-wb-card text-wb-muted border-wb-border hover:text-wb-white'
              }`}
            >
              {type}
            </button>
          ))}
        </div>

        {/* Review Cards or Empty State */}
        {filteredReviews.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="No reviews yet"
            description="Reviews turn experience into wisdom."
            action="Start a Review"
            onAction={openNewReview}
          />
        ) : (
          <div className="space-y-3 mt-6">
            {filteredReviews.map((review) => (
              <div key={review.id} className="card p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Calendar size={14} className="text-wb-muted" />
                    <span className="text-sm text-wb-muted">{review.date}</span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full border font-medium ${TYPE_COLORS[review.type]}`}
                    >
                      {review.type}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEditReview(review)}
                      className="btn-secondary p-1.5 rounded-lg"
                    >
                      <Edit3 size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(review.id)}
                      className="btn-secondary p-1.5 rounded-lg text-red-400 hover:text-red-300"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  {FIELD_CONFIGS[review.type].slice(0, 3).map((field) => (
                    review.content[field.key] ? (
                      <div key={field.key} className="flex items-start gap-2">
                        <ChevronRight size={12} className="text-wb-blue-glow mt-1 flex-shrink-0" />
                        <div>
                          <span className="label text-xs text-wb-muted">{field.label}</span>
                          <p className="text-sm text-wb-white leading-relaxed">
                            {review.content[field.key]}
                          </p>
                        </div>
                      </div>
                    ) : null
                  ))}
                  {FIELD_CONFIGS[review.type].length > 3 && (
                    <button
                      onClick={() => openEditReview(review)}
                      className="text-xs text-wb-blue-glow hover:underline mt-1"
                    >
                      View all fields...
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Review Modal */}
      <Modal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingReview(null);
        }}
        title={editingReview ? `Edit ${activeTab} Review` : `New ${activeTab} Review`}
      >
        <div className="space-y-4">
          {fields.map((field) => (
            <div key={field.key}>
              <label className="label text-sm text-wb-muted mb-1 block">{field.label}</label>
              {field.type === 'textarea' ? (
                <textarea
                  value={formData[field.key] || ''}
                  onChange={(e) => handleFieldChange(field.key, e.target.value)}
                  rows={3}
                  className="w-full bg-wb-dark border border-wb-border rounded-xl px-3 py-2 text-sm text-wb-white placeholder-wb-muted/50 focus:outline-none focus:border-wb-blue/50 resize-none"
                  placeholder={`Enter ${field.label.toLowerCase()}...`}
                />
              ) : (
                <input
                  type="text"
                  value={formData[field.key] || ''}
                  onChange={(e) => handleFieldChange(field.key, e.target.value)}
                  className="w-full bg-wb-dark border border-wb-border rounded-xl px-3 py-2 text-sm text-wb-white placeholder-wb-muted/50 focus:outline-none focus:border-wb-blue/50"
                  placeholder={`Enter ${field.label.toLowerCase()}...`}
                />
              )}
            </div>
          ))}
          <button onClick={handleSave} className="btn-primary w-full mt-4">
            {editingReview ? 'Save Changes' : 'Save Review'}
          </button>
        </div>
      </Modal>
    </Layout>
  );
}
