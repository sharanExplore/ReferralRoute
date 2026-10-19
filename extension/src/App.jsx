import React, { useState } from 'react';

// Sample fictional data for UI presentation
const SAMPLE_JOB = {
  id: 'job-stripe-01',
  title: 'Staff Frontend Engineer',
  company: 'Stripe',
  location: 'San Francisco, CA • Hybrid / Remote',
  salary: '$175,000 – $215,000 / yr',
  type: 'Full-time',
  posted: '2d ago',
  matchScore: '94% Match',
  skills: ['React', 'TypeScript', 'Design Systems', 'Web Performance'],
  department: 'Core Payments Infrastructure',
};

const SAMPLE_CONTACTS = [
  {
    id: 'c1',
    name: 'Alex Morgan',
    role: 'Staff Software Engineer at Stripe',
    degree: '1st Degree',
    connectionContext: 'Ex-Colleague at Meta • 14 Mutuals',
    initials: 'AM',
    avatarBg: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
    draftMessage:
      "Hi Alex, hope you're doing well! I saw Stripe is looking for a Staff Frontend Engineer on the Payments team. Given our time collaborating together, I'd love to ask a couple of quick questions about the team culture and if you'd be open to submitting an internal referral. Thanks a ton!",
  },
  {
    id: 'c2',
    name: 'Sarah Chen',
    role: 'Engineering Manager at Stripe',
    degree: '2nd Degree',
    connectionContext: 'Connected via David Miller (Senior Staff @ Vercel)',
    initials: 'SC',
    avatarBg: 'linear-gradient(135deg, #7c3aed 0%, #6366f1 100%)',
    draftMessage:
      "Hi Sarah, David Miller recommended I connect with you regarding frontend initiatives at Stripe. I noticed the open Staff Frontend role on your organization's board and would love to share my background if you have 5 minutes for a brief chat.",
  },
];

const SAMPLE_RECENT_JOBS = [
  {
    id: 'rec-1',
    title: 'Product Systems Designer',
    company: 'Linear',
    location: 'Remote',
    status: 'Referral Requested',
    statusColor: '#f59e0b',
    savedTime: 'Yesterday',
  },
  {
    id: 'rec-2',
    title: 'Senior Distributed Engineer',
    company: 'Datadog',
    location: 'New York, NY',
    status: 'Application Ready',
    statusColor: '#3b82f6',
    savedTime: '3d ago',
  },
  {
    id: 'rec-3',
    title: 'Design Systems Lead',
    company: 'Figma',
    location: 'San Francisco, CA',
    status: 'Interviewing',
    statusColor: '#10b981',
    savedTime: '5d ago',
  },
];

export default function App() {
  const [activeTab, setActiveTab] = useState('capture');
  const [isSaved, setIsSaved] = useState(false);
  const [activeOutreachContact, setActiveOutreachContact] = useState(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const triggerToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 2500);
  };

  const handleToggleSave = () => {
    if (!isSaved) {
      setIsSaved(true);
      triggerToast('Job added to your ReferralRoute pipeline!');
    } else {
      setIsSaved(false);
      triggerToast('Job removed from pipeline.');
    }
  };

  const handleCopyDraft = (text) => {
    navigator.clipboard?.writeText(text);
    setCopySuccess(true);
    triggerToast('Outreach template copied to clipboard!');
    setTimeout(() => setCopySuccess(false), 2000);
  };

  return (
    <div style={styles.container}>
      {/* Toast Alert Banner */}
      {toastMessage && (
        <div style={styles.toastBanner}>
          <span style={styles.toastDot} />
          {toastMessage}
        </div>
      )}

      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <div style={styles.logoBadge}>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#ffffff"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="6" cy="6" r="3" />
              <circle cx="18" cy="18" r="3" />
              <path d="M9 6h4a4 4 0 0 1 4 4v4" />
            </svg>
          </div>
          <div>
            <div style={styles.brandTitleRow}>
              <h1 style={styles.title}>ReferralRoute</h1>
              <span style={styles.demoBadge}>Sample Preview</span>
            </div>
            <p style={styles.tagline}>Intelligent Referral & Job Tracker</p>
          </div>
        </div>

        <div style={styles.headerRight}>
          <div style={styles.liveIndicator}>
            <span style={styles.pulsingGreenDot} />
            <span style={styles.liveText}>Ready</span>
          </div>
        </div>
      </header>

      {/* Main Content Area Based on Active Tab */}
      <main style={styles.main}>
        {activeTab === 'capture' && (
          <>
            {/* Disclaimer pill */}
            <div style={styles.sampleDisclaimer}>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#60a5fa"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
              <span>Demonstration UI • Displaying fictional role sample</span>
            </div>

            {/* Detected Job Card */}
            <section style={styles.card}>
              <div style={styles.cardHeaderRow}>
                <div style={styles.companyAvatar}>
                  <span>S</span>
                </div>
                <div style={styles.cardHeaderContent}>
                  <div style={styles.cardBadgeRow}>
                    <span style={styles.companyName}>{SAMPLE_JOB.company}</span>
                    <span style={styles.matchBadge}>{SAMPLE_JOB.matchScore}</span>
                  </div>
                  <h2 style={styles.jobTitle}>{SAMPLE_JOB.title}</h2>
                  <p style={styles.locationText}>{SAMPLE_JOB.location}</p>
                </div>
              </div>

              {/* Meta Stats Badges */}
              <div style={styles.metaRow}>
                <span style={styles.metaBadge}>💰 {SAMPLE_JOB.salary}</span>
                <span style={styles.metaBadge}>⏱ {SAMPLE_JOB.type}</span>
                <span style={styles.metaBadge}>📅 {SAMPLE_JOB.posted}</span>
              </div>

              {/* Skill Tags */}
              <div style={styles.skillsContainer}>
                {SAMPLE_JOB.skills.map((skill) => (
                  <span key={skill} style={styles.skillPill}>
                    {skill}
                  </span>
                ))}
              </div>

              {/* Save Job Action CTA */}
              <div style={styles.ctaRow}>
                <button
                  onClick={handleToggleSave}
                  style={isSaved ? styles.savedButton : styles.primaryButton}
                >
                  {isSaved ? (
                    <>
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      Saved to Pipeline
                    </>
                  ) : (
                    <>
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                      </svg>
                      Save Job to Route
                    </>
                  )}
                </button>
              </div>
            </section>

            {/* Referral Contacts Preview Section */}
            <section style={styles.section}>
              <div style={styles.sectionHeaderRow}>
                <div style={styles.sectionTitleGroup}>
                  <h3 style={styles.sectionTitle}>Referral Contacts</h3>
                  <span style={styles.countBadge}>2 Found</span>
                </div>
                <span style={styles.sectionSubtext}>Fictional Match Sample</span>
              </div>

              <div style={styles.contactList}>
                {SAMPLE_CONTACTS.map((contact) => (
                  <div key={contact.id} style={styles.contactCard}>
                    <div style={styles.contactTopRow}>
                      <div
                        style={{
                          ...styles.contactAvatar,
                          background: contact.avatarBg,
                        }}
                      >
                        {contact.initials}
                      </div>

                      <div style={styles.contactDetails}>
                        <div style={styles.contactNameRow}>
                          <span style={styles.contactName}>{contact.name}</span>
                          <span
                            style={
                              contact.degree.includes('1st')
                                ? styles.degree1st
                                : styles.degree2nd
                            }
                          >
                            {contact.degree}
                          </span>
                        </div>
                        <p style={styles.contactRole}>{contact.role}</p>
                        <p style={styles.contactContext}>
                          {contact.connectionContext}
                        </p>
                      </div>
                    </div>

                    <div style={styles.contactActionRow}>
                      <button
                        onClick={() => setActiveOutreachContact(contact)}
                        style={styles.draftButton}
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                          <polyline points="22,6 12,13 2,6" />
                        </svg>
                        Draft Referral Outreach
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Recent Saved Jobs Pipeline */}
            <section style={styles.section}>
              <div style={styles.sectionHeaderRow}>
                <div style={styles.sectionTitleGroup}>
                  <h3 style={styles.sectionTitle}>Recent Pipeline</h3>
                </div>
                <span style={styles.sectionSubtext}>Active Searches</span>
              </div>

              <div style={styles.recentList}>
                {SAMPLE_RECENT_JOBS.map((recJob) => (
                  <div key={recJob.id} style={styles.recentItem}>
                    <div style={styles.recentLeft}>
                      <span style={styles.recentTitle}>{recJob.title}</span>
                      <span style={styles.recentMeta}>
                        {recJob.company} • {recJob.location}
                      </span>
                    </div>

                    <div style={styles.recentRight}>
                      <span
                        style={{
                          ...styles.recentStatusBadge,
                          color: recJob.statusColor,
                          borderColor: `${recJob.statusColor}44`,
                          backgroundColor: `${recJob.statusColor}18`,
                        }}
                      >
                        {recJob.status}
                      </span>
                      <span style={styles.recentTime}>{recJob.savedTime}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

        {/* Tab 2: Referrals Overview */}
        {activeTab === 'referrals' && (
          <div style={styles.tabContent}>
            <div style={styles.tabHeadingBlock}>
              <h2 style={styles.tabHeading}>Referral Network</h2>
              <p style={styles.tabDesc}>
                Manage insider connections and outreach templates (Fictional
                Sample Mode).
              </p>
            </div>

            <div style={styles.statsGrid}>
              <div style={styles.statBox}>
                <span style={styles.statNumber}>14</span>
                <span style={styles.statLabel}>Target Contacts</span>
              </div>
              <div style={styles.statBox}>
                <span style={styles.statNumber}>6</span>
                <span style={styles.statLabel}>Outreach Drafts</span>
              </div>
              <div style={styles.statBox}>
                <span style={styles.statNumber}>3</span>
                <span style={styles.statLabel}>Introductions</span>
              </div>
            </div>

            <div style={styles.infoNotice}>
              <p style={styles.infoNoticeText}>
                <strong>💡 Tip:</strong> Personalized 1-on-1 referrals have an
                8x higher interview conversion rate than cold applications.
              </p>
            </div>
          </div>
        )}

        {/* Tab 3: Pipeline Overview */}
        {activeTab === 'pipeline' && (
          <div style={styles.tabContent}>
            <div style={styles.tabHeadingBlock}>
              <h2 style={styles.tabHeading}>Application Pipeline</h2>
              <p style={styles.tabDesc}>
                Overview of your ongoing referral routes and status.
              </p>
            </div>

            <div style={styles.pipelineFunnel}>
              <div style={styles.funnelStage}>
                <div style={styles.stageBarBlue} />
                <div style={styles.stageMeta}>
                  <span style={styles.stageTitle}>Bookmarked / Saved</span>
                  <span style={styles.stageCount}>4 roles</span>
                </div>
              </div>
              <div style={styles.funnelStage}>
                <div style={styles.stageBarAmber} />
                <div style={styles.stageMeta}>
                  <span style={styles.stageTitle}>Referral In Progress</span>
                  <span style={styles.stageCount}>2 contacts</span>
                </div>
              </div>
              <div style={styles.funnelStage}>
                <div style={styles.stageBarGreen} />
                <div style={styles.stageMeta}>
                  <span style={styles.stageTitle}>Referred & Applied</span>
                  <span style={styles.stageCount}>3 roles</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Settings */}
        {activeTab === 'settings' && (
          <div style={styles.tabContent}>
            <div style={styles.tabHeadingBlock}>
              <h2 style={styles.tabHeading}>Preferences</h2>
              <p style={styles.tabDesc}>
                Configuration and Chrome extension options.
              </p>
            </div>

            <div style={styles.settingsGroup}>
              <div style={styles.settingsItem}>
                <div>
                  <span style={styles.settingsItemTitle}>Auto-detect Opportunities</span>
                  <p style={styles.settingsItemSub}>
                    Inspect page content on job boards (Simulated)
                  </p>
                </div>
                <input
                  type="checkbox"
                  defaultChecked
                  style={styles.checkboxInput}
                />
              </div>

              <div style={styles.settingsItem}>
                <div>
                  <span style={styles.settingsItemTitle}>Dark Navy Mode</span>
                  <p style={styles.settingsItemSub}>
                    High-contrast dark navy color palette
                  </p>
                </div>
                <input
                  type="checkbox"
                  defaultChecked
                  style={styles.checkboxInput}
                />
              </div>

              <div style={styles.settingsItem}>
                <div>
                  <span style={styles.settingsItemTitle}>Manifest V3 Popup</span>
                  <p style={styles.settingsItemSub}>
                    Optimized for 380px Chrome side-panel & popup
                  </p>
                </div>
                <span style={styles.versionTag}>v1.0.0</span>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Draft Message Modal Overlay */}
      {activeOutreachContact && (
        <div style={styles.modalBackdrop}>
          <div style={styles.modalContent}>
            <div style={styles.modalHeader}>
              <div style={styles.modalTitleGroup}>
                <h4 style={styles.modalTitle}>Outreach Draft</h4>
                <span style={styles.modalSubtitle}>
                  To: {activeOutreachContact.name} ({activeOutreachContact.degree})
                </span>
              </div>
              <button
                onClick={() => setActiveOutreachContact(null)}
                style={styles.closeButton}
              >
                ✕
              </button>
            </div>

            <textarea
              readOnly
              value={activeOutreachContact.draftMessage}
              style={styles.draftTextArea}
            />

            <div style={styles.modalActions}>
              <button
                onClick={() =>
                  handleCopyDraft(activeOutreachContact.draftMessage)
                }
                style={styles.copyButton}
              >
                {copySuccess ? '✓ Copied to Clipboard!' : '📋 Copy Draft Template'}
              </button>
              <button
                onClick={() => setActiveOutreachContact(null)}
                style={styles.modalSecondaryButton}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Navigation */}
      <nav style={styles.bottomNav}>
        <button
          onClick={() => setActiveTab('capture')}
          style={activeTab === 'capture' ? styles.navItemActive : styles.navItem}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
          >
            <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
          </svg>
          <span style={styles.navLabel}>Capture</span>
        </button>

        <button
          onClick={() => setActiveTab('referrals')}
          style={activeTab === 'referrals' ? styles.navItemActive : styles.navItem}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
          >
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          <span style={styles.navLabel}>Referrals</span>
        </button>

        <button
          onClick={() => setActiveTab('pipeline')}
          style={activeTab === 'pipeline' ? styles.navItemActive : styles.navItem}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
          >
            <line x1="18" y1="20" x2="18" y2="10" />
            <line x1="12" y1="20" x2="12" y2="4" />
            <line x1="6" y1="20" x2="6" y2="14" />
          </svg>
          <span style={styles.navLabel}>Pipeline</span>
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          style={activeTab === 'settings' ? styles.navItemActive : styles.navItem}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
          <span style={styles.navLabel}>Settings</span>
        </button>
      </nav>
    </div>
  );
}

// Dark navy and blue accent design styles
const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    width: '380px',
    minHeight: '560px',
    backgroundColor: '#0b0f19',
    color: '#f8fafc',
    position: 'relative',
    paddingBottom: '56px', // space for bottom navigation
  },
  toastBanner: {
    position: 'absolute',
    top: '12px',
    left: '12px',
    right: '12px',
    zIndex: 100,
    backgroundColor: '#1e3a8a',
    color: '#eff6ff',
    fontSize: '12px',
    fontWeight: '500',
    padding: '8px 12px',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4)',
    border: '1px solid #3b82f6',
    animation: 'fadeIn 0.2s ease',
  },
  toastDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    backgroundColor: '#60a5fa',
  },
  header: {
    padding: '14px 16px',
    backgroundColor: '#0f172a',
    borderBottom: '1px solid #1e293b',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  logoBadge: {
    width: '32px',
    height: '32px',
    borderRadius: '8px',
    background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 2px 10px rgba(37, 99, 235, 0.4)',
  },
  brandTitleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  title: {
    fontSize: '15px',
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: '-0.3px',
    lineHeight: '1.2',
  },
  demoBadge: {
    fontSize: '9px',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: '0.4px',
    padding: '2px 6px',
    borderRadius: '4px',
    backgroundColor: '#1e293b',
    color: '#93c5fd',
    border: '1px solid #334155',
  },
  tagline: {
    fontSize: '10px',
    color: '#94a3b8',
    marginTop: '1px',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
  },
  liveIndicator: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    backgroundColor: '#111827',
    padding: '4px 8px',
    borderRadius: '12px',
    border: '1px solid #1f293d',
  },
  pulsingGreenDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    backgroundColor: '#10b981',
    boxShadow: '0 0 6px #10b981',
  },
  liveText: {
    fontSize: '10px',
    fontWeight: '600',
    color: '#10b981',
  },
  main: {
    flex: 1,
    padding: '14px 14px 8px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  sampleDisclaimer: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    border: '1px solid #1e293b',
    padding: '6px 10px',
    borderRadius: '6px',
    fontSize: '11px',
    color: '#94a3b8',
  },
  card: {
    backgroundColor: '#111827',
    borderRadius: '12px',
    padding: '14px',
    border: '1px solid #1e293b',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.25)',
  },
  cardHeaderRow: {
    display: 'flex',
    gap: '12px',
    marginBottom: '10px',
  },
  companyAvatar: {
    width: '38px',
    height: '38px',
    borderRadius: '8px',
    backgroundColor: '#6366f1',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '18px',
    fontWeight: '800',
    color: '#ffffff',
    flexShrink: 0,
    boxShadow: '0 2px 8px rgba(99, 102, 241, 0.3)',
  },
  cardHeaderContent: {
    flex: 1,
    minWidth: 0,
  },
  cardBadgeRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '2px',
  },
  companyName: {
    fontSize: '11px',
    fontWeight: '600',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: '0.4px',
  },
  matchBadge: {
    fontSize: '10px',
    fontWeight: '700',
    padding: '2px 6px',
    borderRadius: '10px',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    color: '#34d399',
    border: '1px solid rgba(16, 185, 129, 0.3)',
  },
  jobTitle: {
    fontSize: '15px',
    fontWeight: '700',
    color: '#f8fafc',
    lineHeight: '1.25',
    marginBottom: '3px',
  },
  locationText: {
    fontSize: '11px',
    color: '#94a3b8',
  },
  metaRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px',
    margin: '10px 0',
  },
  metaBadge: {
    fontSize: '11px',
    color: '#cbd5e1',
    backgroundColor: '#1a2236',
    padding: '3px 8px',
    borderRadius: '6px',
    border: '1px solid #243049',
  },
  skillsContainer: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '5px',
    marginBottom: '14px',
  },
  skillPill: {
    fontSize: '10px',
    fontWeight: '500',
    color: '#93c5fd',
    backgroundColor: 'rgba(37, 99, 235, 0.12)',
    padding: '3px 7px',
    borderRadius: '4px',
    border: '1px solid rgba(59, 130, 246, 0.25)',
  },
  ctaRow: {
    display: 'flex',
    gap: '8px',
  },
  primaryButton: {
    flex: 1,
    padding: '10px 14px',
    borderRadius: '8px',
    background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
    color: '#ffffff',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    boxShadow: '0 4px 14px rgba(37, 99, 235, 0.35)',
    transition: 'all 0.15s ease',
  },
  savedButton: {
    flex: 1,
    padding: '10px 14px',
    borderRadius: '8px',
    backgroundColor: '#064e3b',
    border: '1px solid #10b981',
    color: '#a7f3d0',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    transition: 'all 0.15s ease',
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  sectionHeaderRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 2px',
  },
  sectionTitleGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  sectionTitle: {
    fontSize: '12px',
    fontWeight: '700',
    color: '#cbd5e1',
    textTransform: 'uppercase',
    letterSpacing: '0.4px',
  },
  countBadge: {
    fontSize: '10px',
    fontWeight: '700',
    padding: '1px 6px',
    borderRadius: '10px',
    backgroundColor: '#1e293b',
    color: '#60a5fa',
    border: '1px solid #3b82f6',
  },
  sectionSubtext: {
    fontSize: '10px',
    color: '#64748b',
  },
  contactList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  contactCard: {
    backgroundColor: '#111827',
    borderRadius: '10px',
    padding: '12px',
    border: '1px solid #1e293b',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  contactTopRow: {
    display: 'flex',
    gap: '10px',
    alignItems: 'flex-start',
  },
  contactAvatar: {
    width: '34px',
    height: '34px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '12px',
    fontWeight: '700',
    color: '#ffffff',
    flexShrink: 0,
  },
  contactDetails: {
    flex: 1,
    minWidth: 0,
  },
  contactNameRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '4px',
  },
  contactName: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#f8fafc',
  },
  degree1st: {
    fontSize: '9px',
    fontWeight: '700',
    padding: '1px 5px',
    borderRadius: '4px',
    backgroundColor: 'rgba(37, 99, 235, 0.2)',
    color: '#93c5fd',
    border: '1px solid rgba(59, 130, 246, 0.4)',
  },
  degree2nd: {
    fontSize: '9px',
    fontWeight: '700',
    padding: '1px 5px',
    borderRadius: '4px',
    backgroundColor: 'rgba(124, 58, 237, 0.2)',
    color: '#c4b5fd',
    border: '1px solid rgba(139, 92, 246, 0.4)',
  },
  contactRole: {
    fontSize: '11px',
    color: '#cbd5e1',
    marginTop: '1px',
  },
  contactContext: {
    fontSize: '10px',
    color: '#64748b',
    marginTop: '2px',
  },
  contactActionRow: {
    display: 'flex',
    justifyContent: 'flex-end',
  },
  draftButton: {
    width: '100%',
    padding: '6px 10px',
    borderRadius: '6px',
    backgroundColor: '#172554',
    border: '1px solid #1e40af',
    color: '#93c5fd',
    fontSize: '11px',
    fontWeight: '600',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    transition: 'background 0.15s ease',
  },
  recentList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  recentItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#111827',
    padding: '9px 12px',
    borderRadius: '8px',
    border: '1px solid #1e293b',
  },
  recentLeft: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  recentTitle: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#f1f5f9',
  },
  recentMeta: {
    fontSize: '10px',
    color: '#64748b',
  },
  recentRight: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: '3px',
  },
  recentStatusBadge: {
    fontSize: '9px',
    fontWeight: '600',
    padding: '2px 6px',
    borderRadius: '4px',
    border: '1px solid transparent',
  },
  recentTime: {
    fontSize: '9px',
    color: '#64748b',
  },
  tabContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    paddingTop: '6px',
  },
  tabHeadingBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  tabHeading: {
    fontSize: '16px',
    fontWeight: '700',
    color: '#ffffff',
  },
  tabDesc: {
    fontSize: '11px',
    color: '#94a3b8',
    lineHeight: '1.4',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '8px',
  },
  statBox: {
    backgroundColor: '#111827',
    padding: '12px 8px',
    borderRadius: '8px',
    border: '1px solid #1e293b',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
    textAlign: 'center',
  },
  statNumber: {
    fontSize: '18px',
    fontWeight: '800',
    color: '#3b82f6',
  },
  statLabel: {
    fontSize: '10px',
    color: '#94a3b8',
  },
  infoNotice: {
    backgroundColor: '#0f172a',
    padding: '12px',
    borderRadius: '8px',
    border: '1px solid #1e3a8a',
  },
  infoNoticeText: {
    fontSize: '11px',
    color: '#93c5fd',
    lineHeight: '1.4',
  },
  pipelineFunnel: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  funnelStage: {
    backgroundColor: '#111827',
    padding: '10px 12px',
    borderRadius: '8px',
    border: '1px solid #1e293b',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  stageBarBlue: {
    width: '4px',
    height: '28px',
    borderRadius: '2px',
    backgroundColor: '#3b82f6',
  },
  stageBarAmber: {
    width: '4px',
    height: '28px',
    borderRadius: '2px',
    backgroundColor: '#f59e0b',
  },
  stageBarGreen: {
    width: '4px',
    height: '28px',
    borderRadius: '2px',
    backgroundColor: '#10b981',
  },
  stageMeta: {
    flex: 1,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stageTitle: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#f8fafc',
  },
  stageCount: {
    fontSize: '11px',
    color: '#94a3b8',
  },
  settingsGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  settingsItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#111827',
    padding: '12px',
    borderRadius: '8px',
    border: '1px solid #1e293b',
  },
  settingsItemTitle: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#f8fafc',
  },
  settingsItemSub: {
    fontSize: '10px',
    color: '#64748b',
    marginTop: '2px',
  },
  checkboxInput: {
    accentColor: '#3b82f6',
    cursor: 'pointer',
    width: '16px',
    height: '16px',
  },
  versionTag: {
    fontSize: '11px',
    fontWeight: '700',
    color: '#60a5fa',
    backgroundColor: '#1e293b',
    padding: '2px 8px',
    borderRadius: '4px',
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(11, 15, 25, 0.88)',
    backdropFilter: 'blur(3px)',
    zIndex: 200,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '16px',
  },
  modalContent: {
    backgroundColor: '#0f172a',
    borderRadius: '12px',
    border: '1px solid #1e3a8a',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)',
    width: '100%',
    padding: '14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  modalTitleGroup: {
    display: 'flex',
    flexDirection: 'column',
  },
  modalTitle: {
    fontSize: '14px',
    fontWeight: '700',
    color: '#ffffff',
  },
  modalSubtitle: {
    fontSize: '11px',
    color: '#93c5fd',
    marginTop: '1px',
  },
  closeButton: {
    backgroundColor: 'transparent',
    color: '#94a3b8',
    fontSize: '14px',
    cursor: 'pointer',
    padding: '2px 6px',
  },
  draftTextArea: {
    width: '100%',
    height: '110px',
    backgroundColor: '#070b13',
    border: '1px solid #1e293b',
    borderRadius: '8px',
    padding: '10px',
    color: '#e2e8f0',
    fontSize: '11px',
    lineHeight: '1.45',
    resize: 'none',
    fontFamily: 'inherit',
    outline: 'none',
  },
  modalActions: {
    display: 'flex',
    gap: '8px',
  },
  copyButton: {
    flex: 2,
    padding: '9px',
    borderRadius: '6px',
    backgroundColor: '#2563eb',
    color: '#ffffff',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
    boxShadow: '0 2px 8px rgba(37, 99, 235, 0.4)',
  },
  modalSecondaryButton: {
    flex: 1,
    padding: '9px',
    borderRadius: '6px',
    backgroundColor: '#1e293b',
    color: '#cbd5e1',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  bottomNav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '52px',
    backgroundColor: '#090d16',
    borderTop: '1px solid #162032',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-around',
    padding: '0 4px',
    zIndex: 50,
  },
  navItem: {
    flex: 1,
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '2px',
    backgroundColor: 'transparent',
    color: '#64748b',
    cursor: 'pointer',
    transition: 'color 0.15s ease',
  },
  navItemActive: {
    flex: 1,
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '2px',
    backgroundColor: 'transparent',
    color: '#3b82f6',
    cursor: 'pointer',
  },
  navLabel: {
    fontSize: '10px',
    fontWeight: '600',
  },
};
