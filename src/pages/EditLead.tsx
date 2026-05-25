import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import { leadsDB } from '../lib/database';
import { useToast } from '../context/ToastContext';
import { PageLoading } from '../components/LoadingSpinner';
import type { Lead, YesNoUnknown } from '../types';

interface FormState {
  restaurant_name: string;
  owner_name: string;
  city: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  cuisine: string;
  rating: string;
  review_count: string;
  lead_source: string;
  google_maps_url: string;
  google_place_id: string;
  has_online_ordering: YesNoUnknown;
  has_reservations: YesNoUnknown;
  has_catering_page: YesNoUnknown;
  has_contact_form: YesNoUnknown;
  notes: string;
  recommended_offer: string;
  main_bottleneck: string;
}

export default function EditLead() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [form, setForm] = useState<FormState>({
    restaurant_name: '',
    owner_name: '',
    city: '',
    address: '',
    phone: '',
    email: '',
    website: '',
    cuisine: '',
    rating: '',
    review_count: '',
    lead_source: 'Google Search',
    google_maps_url: '',
    google_place_id: '',
    has_online_ordering: 'unknown',
    has_reservations: 'unknown',
    has_catering_page: 'unknown',
    has_contact_form: 'unknown',
    notes: '',
    recommended_offer: '',
    main_bottleneck: '',
  });

  useEffect(() => {
    if (!id) return;
    const found = leadsDB.getById(id);
    if (found) {
      setLead(found);
      setForm({
        restaurant_name: found.restaurant_name,
        owner_name: found.owner_name,
        city: found.city,
        address: found.address,
        phone: found.phone,
        email: found.email,
        website: found.website,
        cuisine: found.cuisine,
        rating: found.rating ? String(found.rating) : '',
        review_count: found.review_count ? String(found.review_count) : '',
        lead_source: found.lead_source,
        google_maps_url: found.google_maps_url,
        google_place_id: found.google_place_id,
        has_online_ordering: found.has_online_ordering,
        has_reservations: found.has_reservations,
        has_catering_page: found.has_catering_page,
        has_contact_form: found.has_contact_form,
        notes: found.notes,
        recommended_offer: found.recommended_offer,
        main_bottleneck: found.main_bottleneck,
      });
    }
    setLoading(false);
  }, [id]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors(prev => ({ ...prev, [key]: undefined }));
  }

  function validate(): boolean {
    const e: Partial<Record<keyof FormState, string>> = {};
    if (!form.restaurant_name.trim()) e.restaurant_name = 'Restaurant name is required';
    if (!form.city.trim()) e.city = 'City is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!validate() || !id) return;
    setSaving(true);
    try {
      leadsDB.update(id, {
        restaurant_name: form.restaurant_name.trim(),
        owner_name: form.owner_name.trim(),
        city: form.city.trim(),
        address: form.address.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        website: form.website.trim(),
        cuisine: form.cuisine.trim(),
        rating: form.rating ? parseFloat(form.rating) : 0,
        review_count: form.review_count ? parseInt(form.review_count) : 0,
        lead_source: form.lead_source,
        google_maps_url: form.google_maps_url.trim(),
        google_place_id: form.google_place_id.trim(),
        has_online_ordering: form.has_online_ordering,
        has_reservations: form.has_reservations,
        has_catering_page: form.has_catering_page,
        has_contact_form: form.has_contact_form,
        notes: form.notes.trim(),
        recommended_offer: form.recommended_offer.trim(),
        main_bottleneck: form.main_bottleneck.trim(),
      });
      toast('Lead updated successfully', 'success');
      navigate(`/leads/${id}`);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <PageLoading />;
  if (!lead) return (
    <div className="max-w-3xl mx-auto px-4 pt-10 text-center">
      <p className="text-chalk text-lg font-semibold mb-2">Lead not found</p>
      <Link to="/leads" className="btn-ghost text-sm">Back to Leads</Link>
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 pb-32 pt-5 fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link to={`/leads/${id}`} className="icon-btn w-9 h-9">
          <ArrowLeft size={16} />
        </Link>
        <div>
          <p className="eyebrow">Edit Lead</p>
          <h1 className="display-title text-paper">{lead.restaurant_name}</h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <div className="glass p-5 space-y-4">
          <h2 className="section-title">Restaurant Info</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Restaurant Name *</label>
              <input
                type="text"
                value={form.restaurant_name}
                onChange={e => set('restaurant_name', e.target.value)}
                className={errors.restaurant_name ? 'border-danger' : ''}
              />
              {errors.restaurant_name && <p className="text-danger text-xs mt-1">{errors.restaurant_name}</p>}
            </div>
            <div>
              <label className="label">Owner / Manager Name</label>
              <input type="text" value={form.owner_name} onChange={e => set('owner_name', e.target.value)} />
            </div>
            <div>
              <label className="label">City *</label>
              <input
                type="text"
                value={form.city}
                onChange={e => set('city', e.target.value)}
                className={errors.city ? 'border-danger' : ''}
              />
              {errors.city && <p className="text-danger text-xs mt-1">{errors.city}</p>}
            </div>
            <div>
              <label className="label">Address</label>
              <input type="text" value={form.address} onChange={e => set('address', e.target.value)} />
            </div>
            <div>
              <label className="label">Phone</label>
              <input type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} />
            </div>
            <div>
              <label className="label">Public Business Email</label>
              <input type="email" value={form.email} onChange={e => set('email', e.target.value)} />
            </div>
            <div>
              <label className="label">Website URL</label>
              <input type="url" value={form.website} onChange={e => set('website', e.target.value)} />
            </div>
            <div>
              <label className="label">Cuisine Type</label>
              <input type="text" value={form.cuisine} onChange={e => set('cuisine', e.target.value)} />
            </div>
            <div>
              <label className="label">Google Rating (0–5)</label>
              <input type="number" min={0} max={5} step={0.1} value={form.rating} onChange={e => set('rating', e.target.value)} />
            </div>
            <div>
              <label className="label">Review Count</label>
              <input type="number" min={0} value={form.review_count} onChange={e => set('review_count', e.target.value)} />
            </div>
            <div>
              <label className="label">Lead Source</label>
              <select value={form.lead_source} onChange={e => set('lead_source', e.target.value)}>
                <option>Google Search</option>
                <option>Google Maps</option>
                <option>Referral</option>
                <option>Manual Entry</option>
                <option>Social Media</option>
                <option>Other</option>
              </select>
            </div>
            <div>
              <label className="label">Google Maps URL</label>
              <input type="url" value={form.google_maps_url} onChange={e => set('google_maps_url', e.target.value)} />
            </div>
          </div>
        </div>

        {/* Digital Presence */}
        <div className="glass p-5 space-y-4">
          <h2 className="section-title">Digital Presence Checklist</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {(
              [
                ['has_online_ordering', 'Has Online Ordering'],
                ['has_reservations', 'Has Reservation System'],
                ['has_catering_page', 'Has Catering / Private Party Page'],
                ['has_contact_form', 'Has Contact Form'],
              ] as [keyof FormState, string][]
            ).map(([key, label]) => (
              <div key={key}>
                <label className="label">{label}</label>
                <select
                  value={form[key] as string}
                  onChange={e => set(key, e.target.value as YesNoUnknown)}
                >
                  <option value="unknown">Unknown</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </div>
            ))}
          </div>
        </div>

        {/* Audit / Offer Info */}
        <div className="glass p-5 space-y-4">
          <h2 className="section-title">Audit Summary (Optional)</h2>
          <div>
            <label className="label">Recommended Offer</label>
            <input type="text" value={form.recommended_offer} onChange={e => set('recommended_offer', e.target.value)} placeholder="Essential AI Front Desk" />
          </div>
          <div>
            <label className="label">Main Bottleneck</label>
            <input type="text" value={form.main_bottleneck} onChange={e => set('main_bottleneck', e.target.value)} placeholder="No online ordering — revenue loss during off-hours" />
          </div>
        </div>

        {/* Notes */}
        <div className="glass p-5">
          <label className="label">Notes</label>
          <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={4} />
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button type="submit" className="btn-gold" disabled={saving}>
            <Save size={15} /> {saving ? 'Saving…' : 'Save Changes'}
          </button>
          <Link to={`/leads/${id}`} className="btn-ghost">Cancel</Link>
        </div>
      </form>
    </div>
  );
}
