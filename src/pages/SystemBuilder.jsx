import { useState } from 'react';
import { Cog, Plus, Edit3, Trash2, CheckCircle, XCircle } from 'lucide-react';
import { useApp } from '../context/AppContext';
import Layout from '../components/Layout';
import Modal from '../components/Modal';
import EmptyState from '../components/EmptyState';
import { LIFE_AREAS } from '../data/frameworks';

const EMPTY_SYSTEM = {
  name: '',
  area: LIFE_AREAS[0],
  purpose: '',
  desiredOutcome: '',
  trigger: '',
  routine: '',
  trackingMetric: '',
  obstacles: '',
  resetProtocol: '',
  reviewCadence: 'weekly',
  active: true,
};

export default function SystemBuilder() {
  const { systems, setSystems } = useApp();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ ...EMPTY_SYSTEM });

  function openNew() {
    setForm({ ...EMPTY_SYSTEM });
    setEditingId(null);
    setModalOpen(true);
  }

  function openEdit(system) {
    setForm({ ...system });
    setEditingId(system.id);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingId(null);
    setForm({ ...EMPTY_SYSTEM });
  }

  function handleChange(field, value) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  function handleSave() {
    if (!form.name.trim()) return;

    if (editingId) {
      setSystems(systems.map(s => s.id === editingId ? { ...form, id: editingId } : s));
    } else {
      const newSystem = {
        ...form,
        id: Date.now().toString(),
        createdAt: new Date().toISOString(),
      };
      setSystems([...systems, newSystem]);
    }
    closeModal();
  }

  function handleDelete(id) {
    setSystems(systems.filter(s => s.id !== id));
  }

  function toggleActive(id) {
    setSystems(systems.map(s => s.id === id ? { ...s, active: !s.active } : s));
  }

  return (
    <Layout>
      <div className="page-container animate-slide-up">
        {/* Header */}
        <div className="page-header">
          <div>
            <h1 className="section-title">System Builder</h1>
            <p className="text-wb-muted text-sm mt-1">
              Design repeatable systems that drive daily execution.
            </p>
          </div>
          <button onClick={openNew} className="btn-primary">
            <Plus className="w-4 h-4" />
            New System
          </button>
        </div>

        {/* Systems list or empty state */}
        {systems.length === 0 ? (
          <EmptyState
            icon={Cog}
            title="No systems yet"
            description="Systems reduce chaos and increase execution."
            action="Create First System"
            onAction={openNew}
          />
        ) : (
          <div className="space-y-4">
            {systems.map(system => (
              <div key={system.id} className="card p-5 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      onClick={() => toggleActive(system.id)}
                      className="flex-shrink-0"
                      aria-label={system.active ? 'Deactivate system' : 'Activate system'}
                    >
                      {system.active ? (
                        <CheckCircle className="w-5 h-5 text-green-400" />
                      ) : (
                        <XCircle className="w-5 h-5 text-wb-muted" />
                      )}
                    </button>
                    <div className="min-w-0">
                      <h3 className="text-wb-white font-semibold truncate">{system.name}</h3>
                      <span className="text-xs text-wb-blue-glow capitalize">{system.area}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => openEdit(system)}
                      className="p-2 rounded-lg hover:bg-wb-card text-wb-muted hover:text-wb-white transition-colors"
                      aria-label="Edit system"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(system.id)}
                      className="p-2 rounded-lg hover:bg-red-400/10 text-wb-muted hover:text-red-400 transition-colors"
                      aria-label="Delete system"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {system.purpose && (
                  <p className="text-wb-muted text-sm">{system.purpose}</p>
                )}

                <div className="flex flex-wrap gap-2 text-xs">
                  <span className={`px-2 py-0.5 rounded-full border ${
                    system.active
                      ? 'bg-green-400/10 text-green-400 border-green-400/20'
                      : 'bg-wb-dark text-wb-muted border-wb-border'
                  }`}>
                    {system.active ? 'Active' : 'Inactive'}
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-wb-blue/10 text-wb-blue-glow border border-wb-blue/20 capitalize">
                    {system.reviewCadence} review
                  </span>
                </div>

                {system.desiredOutcome && (
                  <div className="text-xs text-wb-muted">
                    <span className="text-wb-white font-medium">Desired outcome:</span>{' '}
                    {system.desiredOutcome}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Create / Edit Modal */}
        <Modal open={modalOpen} onClose={closeModal} title={editingId ? 'Edit System' : 'New System'}>
          <div className="space-y-4">
            {/* Name */}
            <div>
              <label className="label">Name</label>
              <input
                type="text"
                value={form.name}
                onChange={e => handleChange('name', e.target.value)}
                placeholder="e.g. Morning Execution Stack"
                className="wb-input w-full"
              />
            </div>

            {/* Area */}
            <div>
              <label className="label">Life Area</label>
              <select
                value={form.area}
                onChange={e => handleChange('area', e.target.value)}
                className="wb-input w-full"
              >
                {LIFE_AREAS.map(area => (
                  <option key={area} value={area}>{area}</option>
                ))}
              </select>
            </div>

            {/* Purpose */}
            <div>
              <label className="label">Purpose</label>
              <input
                type="text"
                value={form.purpose}
                onChange={e => handleChange('purpose', e.target.value)}
                placeholder="Why does this system exist?"
                className="wb-input w-full"
              />
            </div>

            {/* Desired Outcome */}
            <div>
              <label className="label">Desired Outcome</label>
              <input
                type="text"
                value={form.desiredOutcome}
                onChange={e => handleChange('desiredOutcome', e.target.value)}
                placeholder="What does success look like?"
                className="wb-input w-full"
              />
            </div>

            {/* Trigger */}
            <div>
              <label className="label">Trigger</label>
              <input
                type="text"
                value={form.trigger}
                onChange={e => handleChange('trigger', e.target.value)}
                placeholder="What starts this system? e.g. alarm at 5am"
                className="wb-input w-full"
              />
            </div>

            {/* Routine */}
            <div>
              <label className="label">Routine</label>
              <textarea
                value={form.routine}
                onChange={e => handleChange('routine', e.target.value)}
                placeholder="Step-by-step actions..."
                rows={3}
                className="wb-input w-full"
              />
            </div>

            {/* Tracking Metric */}
            <div>
              <label className="label">Tracking Metric</label>
              <input
                type="text"
                value={form.trackingMetric}
                onChange={e => handleChange('trackingMetric', e.target.value)}
                placeholder="How do you measure this? e.g. completion rate"
                className="wb-input w-full"
              />
            </div>

            {/* Obstacles */}
            <div>
              <label className="label">Obstacles</label>
              <textarea
                value={form.obstacles}
                onChange={e => handleChange('obstacles', e.target.value)}
                placeholder="What could derail this system?"
                rows={2}
                className="wb-input w-full"
              />
            </div>

            {/* Reset Protocol */}
            <div>
              <label className="label">Reset Protocol</label>
              <textarea
                value={form.resetProtocol}
                onChange={e => handleChange('resetProtocol', e.target.value)}
                placeholder="What to do when the system breaks down..."
                rows={2}
                className="wb-input w-full"
              />
            </div>

            {/* Review Cadence */}
            <div>
              <label className="label">Review Cadence</label>
              <select
                value={form.reviewCadence}
                onChange={e => handleChange('reviewCadence', e.target.value)}
                className="wb-input w-full"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="biweekly">Biweekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>

            {/* Active Toggle */}
            <div className="flex items-center justify-between">
              <label className="label mb-0">Active</label>
              <button
                type="button"
                onClick={() => handleChange('active', !form.active)}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  form.active ? 'bg-green-500' : 'bg-wb-border'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                    form.active ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button onClick={closeModal} className="btn-secondary flex-1">
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!form.name.trim()}
                className="btn-primary flex-1 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {editingId ? 'Save Changes' : 'Create System'}
              </button>
            </div>
          </div>
        </Modal>
      </div>
    </Layout>
  );
}
