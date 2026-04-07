import { useState } from 'react';
import { Lightbulb, Plus, Search, Filter, Edit3, Trash2, Tag } from 'lucide-react';
import { useApp } from '../context/AppContext';
import Layout from '../components/Layout';
import Modal from '../components/Modal';
import EmptyState from '../components/EmptyState';
import { BRAINSTORM_CATEGORIES } from '../data/frameworks';

const PRIORITIES = ['low', 'medium', 'high', 'critical'];
const STATUSES = ['captured', 'exploring', 'in-progress', 'completed', 'archived'];

const PRIORITY_COLORS = {
  low: 'text-wb-muted',
  medium: 'text-wb-blue-light',
  high: 'text-wb-gold',
  critical: 'text-red-400',
};

const emptyForm = {
  title: '',
  details: '',
  category: BRAINSTORM_CATEGORIES[0],
  tags: '',
  priority: 'medium',
  nextAction: '',
  status: 'captured',
  dueDate: '',
};

export default function BrainstormVault() {
  const { brainstorms, setBrainstorms } = useApp();
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const filtered = brainstorms.filter((item) => {
    const matchesSearch =
      !search ||
      item.title.toLowerCase().includes(search.toLowerCase()) ||
      (item.details && item.details.toLowerCase().includes(search.toLowerCase())) ||
      (item.tags && item.tags.some((t) => t.toLowerCase().includes(search.toLowerCase())));
    const matchesCategory =
      activeCategory === 'all' || item.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  function openNew() {
    setEditingId(null);
    setForm(emptyForm);
    setModalOpen(true);
  }

  function openEdit(item) {
    setEditingId(item.id);
    setForm({
      title: item.title,
      details: item.details || '',
      category: item.category || BRAINSTORM_CATEGORIES[0],
      tags: item.tags ? item.tags.join(', ') : '',
      priority: item.priority || 'medium',
      nextAction: item.nextAction || '',
      status: item.status || 'captured',
      dueDate: item.dueDate || '',
    });
    setModalOpen(true);
  }

  function handleSave() {
    if (!form.title.trim()) return;
    const tags = form.tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    if (editingId) {
      setBrainstorms(
        brainstorms.map((b) =>
          b.id === editingId
            ? { ...b, ...form, tags }
            : b
        )
      );
    } else {
      setBrainstorms([
        ...brainstorms,
        {
          ...form,
          tags,
          id: Date.now().toString(),
          date: new Date().toISOString().slice(0, 10),
        },
      ]);
    }
    setModalOpen(false);
  }

  function handleDelete(id) {
    setBrainstorms(brainstorms.filter((b) => b.id !== id));
  }

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  return (
    <Layout>
      <div className="page-container space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-header mb-0">Brainstorm Vault</h1>
            <p className="text-sm text-wb-muted mt-1">
              Capture and organize every spark of inspiration.
            </p>
          </div>
          <button onClick={openNew} className="btn-primary">
            <Plus className="w-4 h-4" />
            New Idea
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-wb-muted" />
          <input
            type="text"
            placeholder="Search ideas..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="wb-input w-full pl-10"
          />
        </div>

        {/* Category filter chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <Filter className="w-4 h-4 text-wb-muted flex-shrink-0" />
          <button
            onClick={() => setActiveCategory('all')}
            className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-full border transition-all ${
              activeCategory === 'all'
                ? 'bg-wb-blue/20 border-wb-blue/50 text-wb-blue-light'
                : 'bg-wb-dark border-wb-border text-wb-muted hover:border-wb-blue/30 hover:text-wb-white'
            }`}
          >
            All
          </button>
          {BRAINSTORM_CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-full border transition-all capitalize ${
                activeCategory === cat
                  ? 'bg-wb-blue/20 border-wb-blue/50 text-wb-blue-light'
                  : 'bg-wb-dark border-wb-border text-wb-muted hover:border-wb-blue/30 hover:text-wb-white'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Items */}
        {filtered.length === 0 && brainstorms.length === 0 ? (
          <EmptyState
            icon={Lightbulb}
            title="Brainstorm Vault is empty"
            description="Capture ideas before they disappear."
            action="Add First Idea"
            onAction={openNew}
          />
        ) : filtered.length === 0 ? (
          <p className="text-center text-wb-muted text-sm py-12">
            No ideas match your search or filter.
          </p>
        ) : (
          <div className="space-y-3">
            {filtered.map((item) => (
              <div
                key={item.id}
                className="wb-card p-4 space-y-2 cursor-pointer hover:border-wb-blue/40 transition-all"
                onClick={() => openEdit(item)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-wb-white font-semibold text-sm truncate">
                        {item.title}
                      </h3>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-wb-blue/10 border border-wb-blue/30 text-wb-blue-light capitalize">
                        {item.category}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className={`text-xs font-medium capitalize ${PRIORITY_COLORS[item.priority] || PRIORITY_COLORS.medium}`}>
                        {item.priority || 'medium'}
                      </span>
                      <span className="text-xs text-wb-muted capitalize">
                        {item.status || 'captured'}
                      </span>
                      {item.tags && item.tags.length > 0 && (
                        <span className="flex items-center gap-1 text-xs text-wb-muted">
                          <Tag className="w-3 h-3" />
                          {item.tags.slice(0, 3).join(', ')}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openEdit(item);
                      }}
                      className="btn-ghost p-1.5"
                      aria-label="Edit idea"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(item.id);
                      }}
                      className="btn-ghost p-1.5 hover:text-red-400"
                      aria-label="Delete idea"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modal */}
        <Modal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          title={editingId ? 'Edit Idea' : 'New Idea'}
        >
          <div className="space-y-4">
            <div>
              <label className="label">Title *</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => updateField('title', e.target.value)}
                placeholder="What's your idea?"
                className="wb-input w-full"
                required
              />
            </div>

            <div>
              <label className="label">Details</label>
              <textarea
                value={form.details}
                onChange={(e) => updateField('details', e.target.value)}
                placeholder="Describe your idea in more detail..."
                rows={3}
                className="wb-input w-full resize-none"
              />
            </div>

            <div>
              <label className="label">Category</label>
              <select
                value={form.category}
                onChange={(e) => updateField('category', e.target.value)}
                className="wb-input w-full"
              >
                {BRAINSTORM_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Tags (comma-separated)</label>
              <input
                type="text"
                value={form.tags}
                onChange={(e) => updateField('tags', e.target.value)}
                placeholder="e.g. startup, AI, marketing"
                className="wb-input w-full"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Priority</label>
                <select
                  value={form.priority}
                  onChange={(e) => updateField('priority', e.target.value)}
                  className="wb-input w-full"
                >
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Status</label>
                <select
                  value={form.status}
                  onChange={(e) => updateField('status', e.target.value)}
                  className="wb-input w-full"
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="label">Next Action</label>
              <input
                type="text"
                value={form.nextAction}
                onChange={(e) => updateField('nextAction', e.target.value)}
                placeholder="What's the next step for this idea?"
                className="wb-input w-full"
              />
            </div>

            <div>
              <label className="label">Due Date</label>
              <input
                type="date"
                value={form.dueDate}
                onChange={(e) => updateField('dueDate', e.target.value)}
                className="wb-input w-full"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setModalOpen(false)}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!form.title.trim()}
                className="btn-primary flex-1"
              >
                {editingId ? 'Save Changes' : 'Add Idea'}
              </button>
            </div>
          </div>
        </Modal>
      </div>
    </Layout>
  );
}
