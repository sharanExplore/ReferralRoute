import React, { useState } from 'react';

export default function App() {
  const [clickCount, setClickCount] = useState(0);

  return (
    <div style={styles.container}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.logoRow}>
          <div style={styles.logoBadge}>
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#ffffff"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <div>
            <h1 style={styles.title}>ReferralRoute</h1>
            <span style={styles.statusBadge}>● Extension Active</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main style={styles.main}>
        <div style={styles.welcomeCard}>
          <h2 style={styles.welcomeTitle}>Welcome! 👋</h2>
          <p style={styles.welcomeText}>
            Your companion for tracking job applications and managing insider referral contacts.
          </p>
        </div>

        {/* Feature Highlights */}
        <div style={styles.section}>
          <h3 style={styles.sectionHeader}>Upcoming In Version 1</h3>
          <div style={styles.featureList}>
            <div style={styles.featureItem}>
              <span style={styles.featureIcon}>💼</span>
              <div>
                <strong>Job Capture</strong>
                <p style={styles.featureSub}>Save jobs with 1-click from job boards.</p>
              </div>
            </div>
            <div style={styles.featureItem}>
              <span style={styles.featureIcon}>🤝</span>
              <div>
                <strong>Referral Tracking</strong>
                <p style={styles.featureSub}>Log contacts and outreach progress.</p>
              </div>
            </div>
            <div style={styles.featureItem}>
              <span style={styles.featureIcon}>📊</span>
              <div>
                <strong>Pipeline Overview</strong>
                <p style={styles.featureSub}>Keep all your leads organized in one place.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Test React State Button */}
        <div style={styles.testSection}>
          <button
            onClick={() => setClickCount((prev) => prev + 1)}
            style={styles.testButton}
          >
            Test React Reactivity: {clickCount} {clickCount === 1 ? 'click' : 'clicks'}
          </button>
        </div>
      </main>

      {/* Footer */}
      <footer style={styles.footer}>
        <span>Step 1A • React + Vite + Manifest V3</span>
      </footer>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    backgroundColor: '#f8fafc',
    color: '#0f172a',
  },
  header: {
    padding: '16px 20px',
    backgroundColor: '#ffffff',
    borderBottom: '1px solid #e2e8f0',
  },
  logoRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  logoBadge: {
    width: '36px',
    height: '36px',
    borderRadius: '10px',
    background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 4px 6px -1px rgba(79, 70, 229, 0.25)',
  },
  title: {
    fontSize: '18px',
    fontWeight: '700',
    color: '#0f172a',
    letterSpacing: '-0.3px',
    lineHeight: '1.2',
  },
  statusBadge: {
    fontSize: '11px',
    color: '#16a34a',
    fontWeight: '600',
  },
  main: {
    flex: 1,
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  welcomeCard: {
    backgroundColor: '#ffffff',
    padding: '16px',
    borderRadius: '12px',
    border: '1px solid #e2e8f0',
    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)',
  },
  welcomeTitle: {
    fontSize: '15px',
    fontWeight: '600',
    marginBottom: '6px',
    color: '#1e293b',
  },
  welcomeText: {
    fontSize: '13px',
    color: '#64748b',
    lineHeight: '1.4',
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  sectionHeader: {
    fontSize: '12px',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    color: '#94a3b8',
  },
  featureList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  featureItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    padding: '10px 12px',
    backgroundColor: '#ffffff',
    borderRadius: '8px',
    border: '1px solid #f1f5f9',
  },
  featureIcon: {
    fontSize: '16px',
    marginTop: '2px',
  },
  featureSub: {
    fontSize: '11px',
    color: '#64748b',
  },
  testSection: {
    marginTop: 'auto',
    paddingTop: '8px',
  },
  testButton: {
    width: '100%',
    padding: '10px',
    fontSize: '13px',
    fontWeight: '600',
    color: '#4f46e5',
    backgroundColor: '#eef2ff',
    border: '1px solid #c7d2fe',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'background 0.2s',
  },
  footer: {
    padding: '10px 20px',
    textAlign: 'center',
    fontSize: '11px',
    color: '#94a3b8',
    borderTop: '1px solid #e2e8f0',
    backgroundColor: '#ffffff',
  },
};
