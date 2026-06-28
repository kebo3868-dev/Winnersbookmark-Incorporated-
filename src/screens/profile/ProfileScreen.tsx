import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import ScreenHeader from '../../components/ScreenHeader';
import PremiumGate from '../../components/PremiumGate';
import { TESTO_DISCLAIMER } from '../../data/testosterone';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name?: string | null): string {
  if (!name) return 'U';
  const parts = name.trim().split(/\s+/);
  const initials = parts
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join('');
  return initials || 'U';
}

function formatMemberSince(isoDate?: string): string {
  if (!isoDate) return 'Member since —';
  try {
    const date = new Date(isoDate);
    const month = date.toLocaleString('default', { month: 'long' });
    const year = date.getFullYear();
    return `Member since ${month} ${year}`;
  } catch {
    return 'Member since —';
  }
}

function prettifyGoal(goal?: string): string {
  if (!goal) return 'Not set';
  return goal
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ─── Section Card Wrapper ──────────────────────────────────────────────────────

function SectionCard({ children }: { children: React.ReactNode }) {
  return <div className="glass card-pad mb-4">{children}</div>;
}

// ─── Preference Row ───────────────────────────────────────────────────────────

function PrefRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-ink-line last:border-b-0">
      <span className="label text-ghost">{label}</span>
      <span className="text-paper font-medium text-sm text-right max-w-[55%]">{value}</span>
    </div>
  );
}

// ─── Toggle component ─────────────────────────────────────────────────────────

function Toggle({
  enabled,
  onToggle,
}: {
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      role="switch"
      aria-checked={enabled}
      onClick={onToggle}
      className={`relative inline-flex w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none shrink-0 ${
        enabled ? 'bg-gold' : 'bg-ink-line'
      }`}
    >
      <span
        className={`inline-block w-5 h-5 rounded-full bg-paper shadow transition-transform duration-200 mt-0.5 ml-0.5 ${
          enabled ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

// ─── Legal Row ────────────────────────────────────────────────────────────────

function LegalRow({
  label,
  isOpen,
  onToggle,
  expandedText,
}: {
  label: string;
  isOpen: boolean;
  onToggle: () => void;
  expandedText: string;
}) {
  return (
    <div className="border-b border-ink-line last:border-b-0">
      <button
        className="flex items-center justify-between w-full py-3 text-left"
        onClick={onToggle}
      >
        <span className="text-paper text-sm font-medium">{label}</span>
        <svg
          className={`w-4 h-4 text-ghost transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && (
        <p className="text-ghost text-xs leading-relaxed pb-3">{expandedText}</p>
      )}
    </div>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { appState } = useApp();

  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(
    appState.notificationsEnabled ?? false
  );
  const [showRecalcNote, setShowRecalcNote] = useState(false);

  function handleSignOut() {
    signOut();
    navigate('/welcome');
  }

  return (
    <div className="page">
      <ScreenHeader title="Profile" />

      <div className="px-4 pt-4">

        {/* ── A) Profile Header ──────────────────────────────────────────── */}
        <SectionCard>
          <div className="flex flex-col items-center text-center py-2">
            {/* Avatar */}
            <div
              className="w-18 h-18 rounded-full flex items-center justify-center"
              style={{
                width: 72,
                height: 72,
                background: 'linear-gradient(135deg, #D4AF37 0%, #F0D060 100%)',
              }}
            >
              <span className="text-ink-black font-bold text-2xl">
                {getInitials(user?.name)}
              </span>
            </div>

            {/* Name */}
            <h2 className="text-paper text-xl font-bold mt-3">
              {user?.name ?? 'Guest User'}
            </h2>

            {/* Email */}
            {user?.email && (
              <p className="text-ghost text-sm mt-0.5">{user.email}</p>
            )}

            {/* Member since */}
            <p className="text-mist text-xs mt-1">
              {formatMemberSince(user?.createdAt)}
            </p>

            {/* Premium badge */}
            <div className="mt-3">
              {user?.isPremium ? (
                <span className="chip-gold">✦ Premium Member</span>
              ) : (
                <span className="chip">Free Account</span>
              )}
            </div>
          </div>
        </SectionCard>

        {/* ── B) Training Preferences ────────────────────────────────────── */}
        <SectionCard>
          <h3 className="section-title mb-1">Training Preferences</h3>
          <div className="divider mb-2" />

          <PrefRow
            label="Goal"
            value={prettifyGoal(user?.goal)}
          />
          <PrefRow
            label="Training Level"
            value={
              user?.trainingLevel
                ? user.trainingLevel.charAt(0).toUpperCase() +
                  user.trainingLevel.slice(1)
                : 'Not set'
            }
          />
          <PrefRow
            label="Days Per Week"
            value={
              user?.trainingDaysPerWeek
                ? `${user.trainingDaysPerWeek} days`
                : 'Not set'
            }
          />
          <PrefRow
            label="Location"
            value={
              user?.workoutLocation
                ? user.workoutLocation.charAt(0).toUpperCase() +
                  user.workoutLocation.slice(1)
                : 'Not set'
            }
          />
          <PrefRow
            label="Preferred Duration"
            value={
              user?.preferredDurationMin
                ? `${user.preferredDurationMin} min`
                : 'Not set'
            }
          />

          <p className="text-ghost text-xs mt-3 leading-relaxed">
            To update preferences, complete a new onboarding session.
          </p>
        </SectionCard>

        {/* ── C) Nutrition Targets ───────────────────────────────────────── */}
        <SectionCard>
          <h3 className="section-title mb-1">Nutrition Targets</h3>
          <div className="divider mb-2" />

          <PrefRow
            label="Calorie Target"
            value={`${appState.nutritionTargets.calories} kcal`}
          />
          <PrefRow
            label="Protein Target"
            value={`${appState.nutritionTargets.proteinG}g`}
          />

          <button
            className="btn-ghost w-full mt-3"
            onClick={() => setShowRecalcNote(true)}
          >
            Recalculate Targets
          </button>

          {showRecalcNote && (
            <p className="text-ghost text-xs mt-2 text-center leading-relaxed">
              Recalculation uses your current profile stats. Feature available in the full app.
            </p>
          )}
        </SectionCard>

        {/* ── D) App Settings ────────────────────────────────────────────── */}
        <SectionCard>
          <h3 className="section-title mb-1">App Settings</h3>
          <div className="divider mb-2" />

          <div className="flex items-center justify-between py-3">
            <span className="label text-ghost">Push Notifications</span>
            <Toggle
              enabled={notificationsEnabled}
              onToggle={() => setNotificationsEnabled((v) => !v)}
            />
          </div>
          <p className="text-ghost text-xs leading-relaxed">
            Notifications require device permissions — scaffold only
          </p>
        </SectionCard>

        {/* ── E) Subscription Section ────────────────────────────────────── */}
        <SectionCard>
          {user?.isPremium ? (
            <div className="flex flex-col items-center text-center gap-3 py-2">
              <span className="chip-gold">✦ Premium Active</span>
              <p className="text-paper text-sm leading-relaxed">
                You have full access to all Winners Bookmark content.
              </p>
            </div>
          ) : (
            <div>
              <p className="eyebrow mb-1">UPGRADE</p>
              <h3 className="section-title mb-3">Unlock Premium</h3>

              <ul className="space-y-2 mb-4">
                {[
                  'All programs & workouts',
                  'Full nutrition database',
                  'Advanced tracking',
                ].map((benefit) => (
                  <li key={benefit} className="flex items-center gap-2 text-paper text-sm">
                    <span className="text-gold text-xs">✦</span>
                    {benefit}
                  </li>
                ))}
              </ul>

              <button className="btn-gold w-full">
                Unlock Premium — Scaffold Only
              </button>
              <p className="text-ghost text-xs text-center mt-2">
                Payment integration coming prior to launch
              </p>
            </div>
          )}
        </SectionCard>

        {/* ── F) Legal & Info ────────────────────────────────────────────── */}
        <SectionCard>
          <h3 className="section-title mb-1">Legal &amp; Information</h3>
          <div className="divider mb-2" />

          <LegalRow
            label="Privacy Policy"
            isOpen={showPrivacy}
            onToggle={() => setShowPrivacy((v) => !v)}
            expandedText="Full privacy policy coming prior to launch."
          />
          <LegalRow
            label="Terms of Service"
            isOpen={showTerms}
            onToggle={() => setShowTerms((v) => !v)}
            expandedText="Terms of service coming prior to launch."
          />
          <LegalRow
            label="Disclaimer"
            isOpen={showDisclaimer}
            onToggle={() => setShowDisclaimer((v) => !v)}
            expandedText={TESTO_DISCLAIMER}
          />

          <div className="mt-4 space-y-1">
            <p className="text-ghost text-xs text-center">
              Winners Bookmark Fitness v1.0.0 — Phase 1
            </p>
            <p className="text-ghost text-xs text-center">
              Designed by Winners Bookmark Incorporated
            </p>
          </div>
        </SectionCard>

        {/* ── G) Sign Out ────────────────────────────────────────────────── */}
        <div className="mb-4">
          <button className="btn-ghost w-full" onClick={handleSignOut}>
            Sign Out
          </button>
        </div>

        {/* Bottom padding */}
        <div className="pb-32" />
      </div>
    </div>
  );
}
