import React, { useState, useEffect, useCallback } from 'react';
import {
  REFERRAL_STATUSES,
  validateContactInput,
  createContactRecord,
  updateContactRecord,
  filterContactsByJob,
  removeContactById,
  removeContactsForJob,
  calculateStatusMetrics,
} from './contact-utils.js';

export function getStatusBadgeStyle(status) {
  switch (status) {
    case 'Messaged':
      return {
        backgroundColor: 'rgba(37, 99, 235, 0.2)',
        color: '#93c5fd',
        borderColor: 'rgba(59, 130, 246, 0.5)',
      };
    case 'Replied':
      return {
        backgroundColor: 'rgba(168, 85, 247, 0.2)',
        color: '#c084fc',
        borderColor: 'rgba(168, 85, 247, 0.5)',
      };
    case 'Referral received':
      return {
        backgroundColor: 'rgba(16, 185, 129, 0.2)',
        color: '#34d399',
        borderColor: 'rgba(16, 185, 129, 0.5)',
      };
    case 'Not contacted':
    default:
      return {
        backgroundColor: '#1e293b',
        color: '#94a3b8',
        borderColor: '#334155',
      };
  }
}

export default function App() {
  const [activeTab, setActiveTab] = useState('capture');
  const [scanStatus, setScanStatus] = useState('SCANNING'); // 'SCANNING' | 'SUCCESS' | 'NOT_LINKEDIN' | 'NO_JOB' | 'ERROR'
  const [detectedJob, setDetectedJob] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [savedJobs, setSavedJobs] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [isAddingContact, setIsAddingContact] = useState(false);
  const [editingContactId, setEditingContactId] = useState(null);
  const [contactFormData, setContactFormData] = useState({
    name: '',
    role: '',
    profileUrl: '',
    status: 'Not contacted',
    notes: '',
  });
  const [contactFormError, setContactFormError] = useState('');
  const [toastMessage, setToastMessage] = useState('');
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [showArchInfo, setShowArchInfo] = useState(false);
  const [copiedDraft, setCopiedDraft] = useState(false);

  const triggerToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 2600);
  };

  // Load saved jobs and referral contacts from chrome.storage.local
  const loadSavedData = useCallback(() => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['savedJobs', 'referralContacts', 'contacts'], (result) => {
        if (result && Array.isArray(result.savedJobs)) {
          setSavedJobs(result.savedJobs);
        } else {
          setSavedJobs([]);
        }

        const loadedContacts = result?.referralContacts || result?.contacts;
        if (Array.isArray(loadedContacts)) {
          setContacts(loadedContacts);
        } else {
          setContacts([]);
        }
      });
    }
  }, []);

  // Scan the active tab for LinkedIn job postings
  const scanActiveTab = useCallback(() => {
    setScanStatus('SCANNING');
    setErrorMessage('');
    setDetectedJob(null);

    const scanStartTime = Date.now();
    const renderWithFeedbackDelay = (fn) => {
      const elapsed = Date.now() - scanStartTime;
      const minDelay = 250; // Ensure user visibly sees loading state during scans
      if (elapsed < minDelay) {
        setTimeout(fn, minDelay - elapsed);
      } else {
        fn();
      }
    };

    if (typeof chrome === 'undefined' || !chrome.tabs) {
      // Running outside Chrome Extension environment (e.g. standalone browser test)
      renderWithFeedbackDelay(() => {
        setScanStatus('NOT_LINKEDIN');
        setErrorMessage(
          'Chrome extension API not detected. Please run this inside Chrome with the extension loaded.'
        );
      });
      return;
    }

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const currentTab = tabs && tabs[0];
      if (!currentTab || !currentTab.url) {
        renderWithFeedbackDelay(() => {
          setScanStatus('ERROR');
          setErrorMessage('Unable to inspect active browser tab.');
        });
        return;
      }

      const url = currentTab.url.toLowerCase();
      // Strictly enforce LinkedIn-only
      if (!url.includes('linkedin.com')) {
        renderWithFeedbackDelay(() => {
          setScanStatus('NOT_LINKEDIN');
          setErrorMessage(
            'ReferralRoute exclusively supports LinkedIn. Please navigate to a LinkedIn job posting.'
          );
        });
        return;
      }

      const processExtractionResponse = (response) => {
        if (!response) {
          setScanStatus('ERROR');
          setErrorMessage(
            'Unable to communicate with the LinkedIn page. Please reload the tab and retry.'
          );
          return;
        }

        if (response.success && response.data) {
          setDetectedJob(response.data);
          setScanStatus('SUCCESS');
        } else {
          setScanStatus('NO_JOB');
          setErrorMessage(
            response.message ||
              'No job listing detected on this page. Please make sure a job listing is active or selected.'
          );
        }
      };

      // Check if content script responds, otherwise inject dynamically
      const handleScanResponse = (response) => {
        if (chrome.runtime.lastError) {
          // Attempt dynamic injection with scripting API
          if (chrome.scripting) {
            chrome.scripting.executeScript(
              {
                target: { tabId: currentTab.id },
                files: ['content.js'],
              },
              () => {
                if (chrome.runtime.lastError) {
                  renderWithFeedbackDelay(() => {
                    setScanStatus('ERROR');
                    setErrorMessage(
                      'Could not connect to the LinkedIn page. Please reload the LinkedIn tab (F5) and retry.'
                    );
                  });
                  return;
                }
                // Retry sending message after script injection
                chrome.tabs.sendMessage(
                  currentTab.id,
                  { type: 'SCAN_LINKEDIN_JOB' },
                  (retryRes) => {
                    if (chrome.runtime.lastError) {
                      renderWithFeedbackDelay(() => {
                        setScanStatus('ERROR');
                        setErrorMessage(
                          'Could not establish connection to the LinkedIn page. Please refresh the tab.'
                        );
                      });
                      return;
                    }
                    renderWithFeedbackDelay(() => {
                      processExtractionResponse(retryRes);
                    });
                  }
                );
              }
            );
            return;
          }

          renderWithFeedbackDelay(() => {
            setScanStatus('ERROR');
            setErrorMessage(
              'Unable to communicate with the page. Please refresh your LinkedIn tab.'
            );
          });
          return;
        }

        renderWithFeedbackDelay(() => {
          processExtractionResponse(response);
        });
      };

      chrome.tabs.sendMessage(
        currentTab.id,
        { type: 'SCAN_LINKEDIN_JOB' },
        handleScanResponse
      );
    });
  }, []);

  useEffect(() => {
    loadSavedData();
    scanActiveTab();
  }, [loadSavedData, scanActiveTab]);

  // Check if current detected job is saved (prioritizing canonicalUrl; fallback to title+company only if canonicalUrl is absent)
  const isCurrentJobSaved = Boolean(
    detectedJob &&
      savedJobs.some((j) => {
        if (detectedJob.canonicalUrl && j.canonicalUrl) {
          return j.canonicalUrl === detectedJob.canonicalUrl;
        }
        return j.title === detectedJob.title && j.company === detectedJob.company;
      })
  );

  // Helper to persist contacts in state and chrome.storage.local
  const persistContacts = (updatedContacts) => {
    setContacts(updatedContacts);
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.set({ referralContacts: updatedContacts });
    }
  };

  // Save or remove job in chrome.storage.local (with cascading contact cleanup)
  const handleToggleSaveJob = () => {
    if (!detectedJob) return;

    if (isCurrentJobSaved) {
      // Find job being removed
      const jobToRemove = savedJobs.find((j) => {
        if (detectedJob.canonicalUrl && j.canonicalUrl) {
          return j.canonicalUrl === detectedJob.canonicalUrl;
        }
        return j.title === detectedJob.title && j.company === detectedJob.company;
      });

      // Remove job
      const updatedJobs = savedJobs.filter((j) => {
        if (detectedJob.canonicalUrl && j.canonicalUrl) {
          return j.canonicalUrl !== detectedJob.canonicalUrl;
        }
        return !(j.title === detectedJob.title && j.company === detectedJob.company);
      });

      // Cascade remove contacts associated with this job
      const updatedContacts = jobToRemove
        ? removeContactsForJob(contacts, jobToRemove.id)
        : contacts;

      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        chrome.storage.local.set(
          { savedJobs: updatedJobs, referralContacts: updatedContacts },
          () => {
            setSavedJobs(updatedJobs);
            setContacts(updatedContacts);
            if (jobToRemove && selectedJobId === jobToRemove.id) {
              setSelectedJobId(null);
            }
            triggerToast('Job removed from saved pipeline.');
          }
        );
      } else {
        setSavedJobs(updatedJobs);
        setContacts(updatedContacts);
        if (jobToRemove && selectedJobId === jobToRemove.id) {
          setSelectedJobId(null);
        }
      }
    } else {
      // Prevent duplicates
      const jobRecord = {
        id: detectedJob.jobId || `job-${Date.now()}`,
        title: detectedJob.title,
        company: detectedJob.company,
        location: detectedJob.location,
        workplaceType: detectedJob.workplaceType,
        employmentType: detectedJob.employmentType,
        salary: detectedJob.salary,
        canonicalUrl: detectedJob.canonicalUrl,
        savedAt: new Date().toISOString(),
        status: 'Saved',
      };

      const updated = [jobRecord, ...savedJobs];
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        chrome.storage.local.set({ savedJobs: updated }, () => {
          setSavedJobs(updated);
          triggerToast('Job saved to ReferralRoute pipeline!');
        });
      } else {
        setSavedJobs(updated);
      }
    }
  };

  // Remove specific job from pipeline tab (with cascading contact cleanup)
  const handleRemoveFromPipeline = (jobToRemove) => {
    const updatedJobs = savedJobs.filter((j) => j.id !== jobToRemove.id);
    const updatedContacts = removeContactsForJob(contacts, jobToRemove.id);

    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.set(
        { savedJobs: updatedJobs, referralContacts: updatedContacts },
        () => {
          setSavedJobs(updatedJobs);
          setContacts(updatedContacts);
          if (selectedJobId === jobToRemove.id) {
            setSelectedJobId(null);
          }
          triggerToast('Removed job and associated contacts from pipeline.');
        }
      );
    } else {
      setSavedJobs(updatedJobs);
      setContacts(updatedContacts);
      if (selectedJobId === jobToRemove.id) {
        setSelectedJobId(null);
      }
      triggerToast('Removed job and associated contacts from pipeline.');
    }
  };

  // Contact CRUD Handlers
  const handleStartAddContact = () => {
    setEditingContactId(null);
    setContactFormData({
      name: '',
      role: '',
      profileUrl: '',
      status: 'Not contacted',
      notes: '',
    });
    setContactFormError('');
    setIsAddingContact(true);
  };

  const handleStartEditContact = (contact) => {
    setIsAddingContact(false);
    setEditingContactId(contact.id);
    setContactFormData({
      name: contact.name || '',
      role: contact.role || '',
      profileUrl: contact.profileUrl || '',
      status: contact.status || 'Not contacted',
      notes: contact.notes || '',
    });
    setContactFormError('');
  };

  const handleCancelContactForm = () => {
    setIsAddingContact(false);
    setEditingContactId(null);
    setContactFormData({
      name: '',
      role: '',
      profileUrl: '',
      status: 'Not contacted',
      notes: '',
    });
    setContactFormError('');
  };

  const handleSaveContact = (jobId) => {
    const validation = validateContactInput({
      name: contactFormData.name,
      profileUrl: contactFormData.profileUrl,
      jobId,
      existingContacts: contacts,
      currentContactId: editingContactId,
    });

    if (!validation.valid) {
      setContactFormError(validation.error);
      return;
    }

    if (editingContactId) {
      const existing = contacts.find((c) => c.id === editingContactId);
      if (!existing) return;

      const updated = updateContactRecord(existing, {
        name: validation.data.cleanName,
        role: contactFormData.role,
        profileUrl: validation.data.cleanUrl,
        status: contactFormData.status,
        notes: contactFormData.notes,
      });

      const updatedList = contacts.map((c) => (c.id === editingContactId ? updated : c));
      persistContacts(updatedList);
      triggerToast('Contact updated successfully!');
    } else {
      const newContact = createContactRecord({
        jobId,
        name: validation.data.cleanName,
        role: contactFormData.role,
        profileUrl: validation.data.cleanUrl,
        status: contactFormData.status,
        notes: contactFormData.notes,
      });

      const updatedList = [newContact, ...contacts];
      persistContacts(updatedList);
      triggerToast('Referral contact added!');
    }

    handleCancelContactForm();
  };

  const handleDeleteContact = (contactId) => {
    const updated = removeContactById(contacts, contactId);
    persistContacts(updated);
    if (editingContactId === contactId) {
      handleCancelContactForm();
    }
    triggerToast('Contact deleted.');
  };

  const handleQuickStatusChange = (contactId, newStatus) => {
    const existing = contacts.find((c) => c.id === contactId);
    if (!existing) return;

    const updated = updateContactRecord(existing, { status: newStatus });
    const updatedList = contacts.map((c) => (c.id === contactId ? updated : c));
    persistContacts(updatedList);
    triggerToast(`Status updated: "${newStatus}"`);
  };

  // Launch LinkedIn People Search for 1st & 2nd degree connections at the company
  const handleSearchCompanyConnections = (companyName) => {
    if (!companyName) return;
    const query = encodeURIComponent(companyName);
    const searchUrl = `https://www.linkedin.com/search/results/people/?keywords=${query}&network=%5B%22F%22%2C%22S%22%5D`;
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.create({ url: searchUrl });
    } else {
      window.open(searchUrl, '_blank');
    }
  };

  // Open canonical job URL in new tab
  const handleOpenJobUrl = (url) => {
    if (!url) return;
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.create({ url });
    } else {
      window.open(url, '_blank');
    }
  };

  // Copy referral message draft
  const handleCopyReferralDraft = (text) => {
    navigator.clipboard?.writeText(text);
    setCopiedDraft(true);
    triggerToast('Outreach draft copied to clipboard!');
    setTimeout(() => setCopiedDraft(false), 2000);
  };

  const referralDraftTemplate = detectedJob
    ? `Hi [Name], I noticed you work at ${detectedJob.company}. I'm preparing an application for the ${detectedJob.title} role and would love to ask 2 quick questions about your team's focus. If open to it, I'd greatly appreciate an internal referral. Thanks for your time!`
    : '';

  return (
    <div style={styles.container}>
      {/* Toast Alert */}
      {toastMessage && (
        <div style={styles.toastBanner}>
          <span style={styles.toastDot} />
          <span>{toastMessage}</span>
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
              <span style={styles.platformBadge}>LinkedIn</span>
            </div>
            <p style={styles.tagline}>Job Capture & Referral Workflow</p>
          </div>
        </div>

        <div style={styles.headerRight}>
          <button
            onClick={scanActiveTab}
            title="Scan active LinkedIn tab"
            style={styles.refreshButton}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={scanStatus === 'SCANNING' ? styles.spinningIcon : {}}
            >
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
            <span style={styles.refreshText}>Scan</span>
          </button>
        </div>
      </header>

      {/* Main Content View */}
      <main style={styles.main}>
        {activeTab === 'capture' && (
          <>
            {/* Status: SCANNING */}
            {scanStatus === 'SCANNING' && (
              <div style={styles.stateCard}>
                <div style={styles.spinner} />
                <h3 style={styles.stateTitle}>Scanning LinkedIn Page...</h3>
                <p style={styles.stateDesc}>
                  Reading active job listing details, company, and location.
                </p>
              </div>
            )}

            {/* Status: NOT LINKEDIN */}
            {scanStatus === 'NOT_LINKEDIN' && (
              <div style={styles.stateCard}>
                <div style={styles.stateIconCircle}>
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#60a5fa"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
                    <rect x="2" y="9" width="4" height="12" />
                    <circle cx="4" cy="4" r="2" />
                  </svg>
                </div>
                <h3 style={styles.stateTitle}>LinkedIn Exclusive</h3>
                <p style={styles.stateDesc}>
                  ReferralRoute only operates on LinkedIn job postings. Please
                  open a job listing on LinkedIn and click Scan.
                </p>
                <button
                  onClick={() =>
                    handleOpenJobUrl('https://www.linkedin.com/jobs/')
                  }
                  style={styles.secondaryActionBtn}
                >
                  Go to LinkedIn Jobs
                </button>
              </div>
            )}

            {/* Status: NO JOB DETECTED */}
            {scanStatus === 'NO_JOB' && (
              <div style={styles.stateCard}>
                <div style={styles.stateIconCircleWarn}>
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth="2"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                </div>
                <h3 style={styles.stateTitle}>No Job Listing Detected</h3>
                <p style={styles.stateDesc}>{errorMessage}</p>
                <div style={styles.tipsBox}>
                  <strong>How to use:</strong>
                  <ul style={styles.tipsList}>
                    <li>Open any job on <code>linkedin.com/jobs/view/...</code></li>
                    <li>Or select a job from LinkedIn Search results</li>
                    <li>Then click the Scan button above</li>
                  </ul>
                </div>
                <button onClick={scanActiveTab} style={styles.primaryActionBtn}>
                  Retry Scan
                </button>
              </div>
            )}

            {/* Status: ERROR */}
            {scanStatus === 'ERROR' && (
              <div style={styles.stateCard}>
                <div style={styles.stateIconCircleWarn}>
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#ef4444"
                    strokeWidth="2"
                  >
                    <polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                </div>
                <h3 style={styles.stateTitle}>Detection Error</h3>
                <p style={styles.stateDesc}>{errorMessage}</p>
                <button onClick={scanActiveTab} style={styles.primaryActionBtn}>
                  Retry Connection
                </button>
              </div>
            )}

            {/* Status: SUCCESS (Detected Real LinkedIn Job) */}
            {scanStatus === 'SUCCESS' && detectedJob && (
              <>
                {/* Detected Job Card */}
                <section style={styles.card}>
                  <div style={styles.cardHeaderRow}>
                    <div style={styles.companyAvatar}>
                      {detectedJob.company ? detectedJob.company.charAt(0).toUpperCase() : '💼'}
                    </div>
                    <div style={styles.cardHeaderContent}>
                      <div style={styles.cardBadgeRow}>
                        <span style={styles.companyName}>
                          {detectedJob.company || 'Company Not Specified'}
                        </span>
                        <span style={styles.liveDetectedBadge}>● Live Detected</span>
                      </div>
                      <h2 style={styles.jobTitle}>{detectedJob.title}</h2>
                      {detectedJob.location ? (
                        <p style={styles.locationText}>📍 {detectedJob.location}</p>
                      ) : (
                        <p style={styles.missingFieldText}>Location not specified on page</p>
                      )}
                    </div>
                  </div>

                  {/* Metadata Chips (Only renders if present on page) */}
                  <div style={styles.metaRow}>
                    {detectedJob.workplaceType && (
                      <span style={styles.metaBadge}>🏢 {detectedJob.workplaceType}</span>
                    )}
                    {detectedJob.employmentType && (
                      <span style={styles.metaBadge}>⏱ {detectedJob.employmentType}</span>
                    )}
                    {detectedJob.salary && (
                      <span style={styles.metaBadgeSalary}>💰 {detectedJob.salary}</span>
                    )}
                  </div>

                  {/* Canonical URL preview */}
                  {detectedJob.canonicalUrl && (
                    <div style={styles.canonicalUrlRow}>
                      <span style={styles.urlLabel}>Canonical:</span>
                      <a
                        href="#job"
                        onClick={(e) => {
                          e.preventDefault();
                          handleOpenJobUrl(detectedJob.canonicalUrl);
                        }}
                        style={styles.urlLink}
                        title={detectedJob.canonicalUrl}
                      >
                        {detectedJob.canonicalUrl.replace('https://www.linkedin.com', '')}
                      </a>
                    </div>
                  )}

                  {/* Description Snippet */}
                  {detectedJob.description && (
                    <div style={styles.descriptionSection}>
                      <div style={styles.descriptionHeader}>
                        <span style={styles.descTitle}>Job Description</span>
                        <button
                          onClick={() => setShowFullDescription((p) => !p)}
                          style={styles.expandDescBtn}
                        >
                          {showFullDescription ? 'Collapse' : 'Expand'}
                        </button>
                      </div>
                      <p
                        style={
                          showFullDescription
                            ? styles.descriptionFull
                            : styles.descriptionSnippet
                        }
                      >
                        {detectedJob.description}
                      </p>
                    </div>
                  )}

                  {/* Save Job Action CTA */}
                  <div style={styles.ctaRow}>
                    <button
                      onClick={handleToggleSaveJob}
                      style={isCurrentJobSaved ? styles.savedButton : styles.primaryButton}
                    >
                      {isCurrentJobSaved ? (
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
                          Saved to Pipeline (Click to Remove)
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

                {/* Referral-Finding Workflow Section */}
                <section style={styles.section}>
                  <div style={styles.sectionHeaderRow}>
                    <div style={styles.sectionTitleGroup}>
                      <h3 style={styles.sectionTitle}>Referral Route Workflow</h3>
                    </div>
                    <span style={styles.companyHighlight}>
                      {detectedJob.company}
                    </span>
                  </div>

                  {/* Transparent Honest Notice */}
                  <div style={styles.honestNoticeCard}>
                    <div style={styles.noticeIcon}>ℹ️</div>
                    <div style={styles.noticeContent}>
                      <strong style={styles.noticeStrong}>
                        Employee Discovery In Development
                      </strong>
                      <p style={styles.noticeText}>
                        Scanning a job post and retrieving verified employee rosters
                        are distinct operations. Automatic employee matching is not
                        yet connected.
                      </p>
                    </div>
                  </div>

                  {/* Immediate Action: Live LinkedIn People Search */}
                  <div style={styles.referralActionCard}>
                    <h4 style={styles.referralCardHeading}>
                      Find Connections at {detectedJob.company}
                    </h4>
                    <p style={styles.referralCardDesc}>
                      Filter LinkedIn for 1st & 2nd degree connections currently
                      working at {detectedJob.company} to ask for an internal referral.
                    </p>
                    <button
                      onClick={() =>
                        handleSearchCompanyConnections(detectedJob.company)
                      }
                      style={styles.linkedinSearchBtn}
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z" />
                      </svg>
                      Search 1st & 2nd Connections on LinkedIn
                    </button>
                  </div>

                  {/* Outreach Message Drafter */}
                  <div style={styles.draftCard}>
                    <div style={styles.draftHeader}>
                      <span style={styles.draftLabel}>Personalized Outreach Draft</span>
                      <button
                        onClick={() =>
                          handleCopyReferralDraft(referralDraftTemplate)
                        }
                        style={styles.copyDraftBtn}
                      >
                        {copiedDraft ? '✓ Copied' : '📋 Copy Draft'}
                      </button>
                    </div>
                    <textarea
                      readOnly
                      value={referralDraftTemplate}
                      style={styles.draftTextArea}
                    />
                  </div>

                  {/* Architecture & Discovery Info Drawer */}
                  <div style={styles.archDrawer}>
                    <button
                      onClick={() => setShowArchInfo((prev) => !prev)}
                      style={styles.archToggleBtn}
                    >
                      <span>⚙️ What is needed for automated referral discovery?</span>
                      <span>{showArchInfo ? '▲' : '▼'}</span>
                    </button>
                    {showArchInfo && (
                      <div style={styles.archContent}>
                        <p style={styles.archStep}>
                          <strong>1. LinkedIn Directory Access:</strong> Automated discovery requires permissioned company directory indexing or official LinkedIn API credentials.
                        </p>
                        <p style={styles.archStep}>
                          <strong>2. Connection Graph Mapping:</strong> Matching 1st-degree past colleagues vs 2nd-degree mutual introducers.
                        </p>
                        <p style={styles.archStep}>
                          <strong>3. Backend Pipeline:</strong> Securely mapping user networks to target employer domain rosters without scraping risks.
                        </p>
                      </div>
                    )}
                  </div>
                </section>
              </>
            )}
          </>
        )}

        {/* Tab 2: Saved Pipeline (Backed by chrome.storage.local) */}
        {activeTab === 'pipeline' && (
          <div style={styles.tabContent}>
            {selectedJobId && savedJobs.some((j) => j.id === selectedJobId) ? (
              (() => {
                const selectedJob = savedJobs.find((j) => j.id === selectedJobId);
                const jobContacts = filterContactsByJob(contacts, selectedJob.id);

                return (
                  <>
                    {/* Back navigation & Hub badge */}
                    <div style={styles.detailNavRow}>
                      <button
                        onClick={() => {
                          setSelectedJobId(null);
                          handleCancelContactForm();
                        }}
                        style={styles.backButton}
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.4"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <line x1="19" y1="12" x2="5" y2="12" />
                          <polyline points="12 19 5 12 12 5" />
                        </svg>
                        <span>Back to Pipeline</span>
                      </button>
                      <span style={styles.detailScopeBadge}>Job Referral Hub</span>
                    </div>

                    {/* Opened Job Summary Card */}
                    <div style={styles.detailJobCard}>
                      <div style={styles.detailJobHeaderRow}>
                        <div style={styles.companyAvatarSmall}>
                          {selectedJob.company
                            ? selectedJob.company.charAt(0).toUpperCase()
                            : '💼'}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <h3 style={styles.detailJobTitle}>{selectedJob.title}</h3>
                          <span style={styles.detailJobCompany}>{selectedJob.company}</span>
                        </div>
                        <span style={styles.pipelineStatusBadge}>
                          {selectedJob.status || 'Saved'}
                        </span>
                      </div>

                      <div style={styles.pipelineMetaRow}>
                        {selectedJob.location && (
                          <span style={styles.pipelineMetaPill}>📍 {selectedJob.location}</span>
                        )}
                        {selectedJob.workplaceType && (
                          <span style={styles.pipelineMetaPill}>🏢 {selectedJob.workplaceType}</span>
                        )}
                        {selectedJob.salary && (
                          <span style={styles.pipelineMetaPillSalary}>💰 {selectedJob.salary}</span>
                        )}
                      </div>

                      <div style={styles.detailActionsRow}>
                        <button
                          onClick={() => handleSearchCompanyConnections(selectedJob.company)}
                          style={styles.findReferralsMainBtn}
                          title="Open LinkedIn search for connections at this company"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z" />
                          </svg>
                          Find Referrals
                        </button>

                        {selectedJob.canonicalUrl && (
                          <button
                            onClick={() => handleOpenJobUrl(selectedJob.canonicalUrl)}
                            style={styles.detailViewJobBtn}
                            title="Open canonical LinkedIn job page"
                          >
                            View Job ↗
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Referral Contacts Section */}
                    <div style={styles.contactsSection}>
                      <div style={styles.contactsSectionHeader}>
                        <div style={styles.contactsTitleGroup}>
                          <h4 style={styles.contactsSectionTitle}>Referral Contacts</h4>
                          <span style={styles.contactsCountBadge}>
                            {jobContacts.length}
                          </span>
                        </div>
                        {!isAddingContact && !editingContactId && (
                          <button
                            onClick={handleStartAddContact}
                            style={styles.addContactButton}
                          >
                            + Add Contact
                          </button>
                        )}
                      </div>

                      {/* Add / Edit Contact Form */}
                      {(isAddingContact || editingContactId) && (
                        <div style={styles.contactFormCard}>
                          <div style={styles.contactFormHeader}>
                            <span style={styles.contactFormTitle}>
                              {editingContactId ? 'Edit Referral Contact' : 'Track New Referral Contact'}
                            </span>
                            <button
                              onClick={handleCancelContactForm}
                              style={styles.formCloseBtn}
                              title="Cancel"
                            >
                              ✕
                            </button>
                          </div>

                          {contactFormError && (
                            <div style={styles.formErrorBanner}>
                              <span>⚠️</span>
                              <span>{contactFormError}</span>
                            </div>
                          )}

                          <div style={styles.formFields}>
                            <div style={styles.formField}>
                              <label style={styles.formLabel}>
                                Contact Name <span style={styles.requiredStar}>*</span>
                              </label>
                              <input
                                type="text"
                                placeholder="e.g. Alex Morgan"
                                value={contactFormData.name}
                                onChange={(e) =>
                                  setContactFormData((prev) => ({ ...prev, name: e.target.value }))
                                }
                                style={styles.formInput}
                              />
                            </div>

                            <div style={styles.formField}>
                              <label style={styles.formLabel}>Role / Job Title</label>
                              <input
                                type="text"
                                placeholder="e.g. Engineering Manager, Senior Designer"
                                value={contactFormData.role}
                                onChange={(e) =>
                                  setContactFormData((prev) => ({ ...prev, role: e.target.value }))
                                }
                                style={styles.formInput}
                              />
                            </div>

                            <div style={styles.formField}>
                              <label style={styles.formLabel}>LinkedIn Profile URL</label>
                              <input
                                type="text"
                                placeholder="e.g. linkedin.com/in/alexmorgan"
                                value={contactFormData.profileUrl}
                                onChange={(e) =>
                                  setContactFormData((prev) => ({
                                    ...prev,
                                    profileUrl: e.target.value,
                                  }))
                                }
                                style={styles.formInput}
                              />
                            </div>

                            <div style={styles.formField}>
                              <label style={styles.formLabel}>Outreach Status</label>
                              <select
                                value={contactFormData.status}
                                onChange={(e) =>
                                  setContactFormData((prev) => ({
                                    ...prev,
                                    status: e.target.value,
                                  }))
                                }
                                style={styles.formSelect}
                              >
                                {REFERRAL_STATUSES.map((status) => (
                                  <option key={status} value={status}>
                                    {status}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div style={styles.formField}>
                              <label style={styles.formLabel}>Notes</label>
                              <textarea
                                placeholder="Outreach notes, mutual connections, conversation notes..."
                                value={contactFormData.notes}
                                onChange={(e) =>
                                  setContactFormData((prev) => ({
                                    ...prev,
                                    notes: e.target.value,
                                  }))
                                }
                                style={styles.formTextarea}
                              />
                            </div>

                            <div style={styles.formBtnRow}>
                              <button
                                onClick={() => handleSaveContact(selectedJob.id)}
                                style={styles.formSubmitBtn}
                              >
                                {editingContactId ? 'Update Contact' : 'Save Contact'}
                              </button>
                              <button
                                onClick={handleCancelContactForm}
                                style={styles.formCancelBtn}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Contacts List */}
                      {jobContacts.length === 0 &&
                      !isAddingContact &&
                      !editingContactId ? (
                        <div style={styles.emptyContactsCard}>
                          <span style={{ fontSize: '24px' }}>👥</span>
                          <h5 style={styles.emptyContactsTitle}>No referral contacts tracked yet</h5>
                          <p style={styles.emptyContactsDesc}>
                            Search for connections at {selectedJob.company} on LinkedIn and track them here to manage your outreach.
                          </p>
                          <button
                            onClick={handleStartAddContact}
                            style={styles.emptyAddContactBtn}
                          >
                            + Add First Contact
                          </button>
                        </div>
                      ) : (
                        <div style={styles.contactsList}>
                          {jobContacts.map((contact) => (
                            <div key={contact.id} style={styles.contactItemCard}>
                              <div style={styles.contactCardHeaderRow}>
                                <div style={styles.contactCardIdentity}>
                                  <div style={styles.contactAvatar}>
                                    {contact.name ? contact.name.charAt(0).toUpperCase() : '👤'}
                                  </div>
                                  <div style={{ minWidth: 0 }}>
                                    <h5 style={styles.contactCardName}>{contact.name}</h5>
                                    {contact.role ? (
                                      <span style={styles.contactCardRole}>{contact.role}</span>
                                    ) : (
                                      <span style={styles.contactCardRoleMuted}>
                                        Role not specified
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Status Selector Dropdown */}
                                <select
                                  value={contact.status}
                                  onChange={(e) =>
                                    handleQuickStatusChange(contact.id, e.target.value)
                                  }
                                  style={{
                                    ...styles.statusDropdown,
                                    ...getStatusBadgeStyle(contact.status),
                                  }}
                                  title="Change outreach status"
                                >
                                  {REFERRAL_STATUSES.map((status) => (
                                    <option key={status} value={status}>
                                      {status}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              {/* Profile Link */}
                              {contact.profileUrl && (
                                <div style={styles.contactUrlRow}>
                                  <svg
                                    width="12"
                                    height="12"
                                    viewBox="0 0 24 24"
                                    fill="currentColor"
                                    style={{ flexShrink: 0, color: '#0a66c2' }}
                                  >
                                    <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z" />
                                  </svg>
                                  <a
                                    href="#profile"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      handleOpenJobUrl(contact.profileUrl);
                                    }}
                                    style={styles.contactUrlLink}
                                    title={contact.profileUrl}
                                  >
                                    {contact.profileUrl.replace(/^https?:\/\/(www\.)?linkedin\.com\//i, '')}
                                  </a>
                                </div>
                              )}

                              {/* Notes */}
                              {contact.notes && (
                                <div style={styles.contactNotesBox}>
                                  <span style={styles.notesLabel}>Notes:</span> {contact.notes}
                                </div>
                              )}

                              {/* Card Actions */}
                              <div style={styles.contactCardActions}>
                                <button
                                  onClick={() => handleStartEditContact(contact)}
                                  style={styles.contactEditBtn}
                                  title="Edit contact"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleDeleteContact(contact.id)}
                                  style={styles.contactDeleteBtn}
                                  title="Delete contact"
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                );
              })()
            ) : (
              <>
                <div style={styles.tabHeadingBlock}>
                  <div style={styles.tabTitleRow}>
                    <h2 style={styles.tabHeading}>Saved Jobs Pipeline</h2>
                    <span style={styles.pipelineCountBadge}>
                      {savedJobs.length} {savedJobs.length === 1 ? 'Job' : 'Jobs'}
                    </span>
                  </div>
                  <p style={styles.tabDesc}>
                    Click any job to open and manage its tracked referral contacts.
                  </p>
                </div>

                {savedJobs.length === 0 ? (
                  <div style={styles.emptyPipelineCard}>
                    <span style={styles.emptyIcon}>📂</span>
                    <h4 style={styles.emptyTitle}>No Jobs Saved Yet</h4>
                    <p style={styles.emptyDesc}>
                      Open a LinkedIn job posting and click &quot;Save Job to Route&quot; on the Capture tab to track it here.
                    </p>
                  </div>
                ) : (
                  <div style={styles.pipelineList}>
                    {savedJobs.map((job) => {
                      const jobContacts = filterContactsByJob(contacts, job.id);
                      return (
                        <div key={job.id} style={styles.pipelineItem}>
                          <div
                            style={styles.pipelineItemClickableHeader}
                            onClick={() => setSelectedJobId(job.id)}
                            title="Click to view details and manage referral contacts"
                          >
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <h4 style={styles.pipelineJobTitle}>{job.title}</h4>
                              <span style={styles.pipelineCompany}>{job.company}</span>
                            </div>
                            <span style={styles.pipelineStatusBadge}>
                              {job.status || 'Saved'}
                            </span>
                          </div>

                          <div style={styles.pipelineMetaRow}>
                            {job.location && (
                              <span style={styles.pipelineMetaPill}>📍 {job.location}</span>
                            )}
                            {job.workplaceType && (
                              <span style={styles.pipelineMetaPill}>🏢 {job.workplaceType}</span>
                            )}
                            {job.salary && (
                              <span style={styles.pipelineMetaPillSalary}>💰 {job.salary}</span>
                            )}
                            <span style={styles.pipelineContactsPill}>
                              👤 {jobContacts.length} {jobContacts.length === 1 ? 'Contact' : 'Contacts'}
                            </span>
                          </div>

                          <div style={styles.pipelineActions}>
                            <button
                              onClick={() => setSelectedJobId(job.id)}
                              style={styles.pipelineManageContactsBtn}
                              title="Open job and manage referral contacts"
                            >
                              Manage Contacts ({jobContacts.length})
                            </button>

                            <button
                              onClick={() => handleSearchCompanyConnections(job.company)}
                              style={styles.pipelineReferralBtn}
                              title="Search referral contacts for this company on LinkedIn"
                            >
                              Find Referrals
                            </button>

                            {job.canonicalUrl && (
                              <button
                                onClick={() => handleOpenJobUrl(job.canonicalUrl)}
                                style={styles.pipelineLinkBtn}
                                title="Open canonical LinkedIn job page"
                              >
                                View ↗
                              </button>
                            )}

                            <button
                              onClick={() => handleRemoveFromPipeline(job)}
                              style={styles.pipelineDeleteBtn}
                              title="Remove from pipeline"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Tab 3: Referrals Overview & Outreach Metrics */}
        {activeTab === 'referrals' && (
          <div style={styles.tabContent}>
            <div style={styles.tabHeadingBlock}>
              <h2 style={styles.tabHeading}>Referral Engine</h2>
              <p style={styles.tabDesc}>
                Strategic workflows and outreach tracking across saved opportunities.
              </p>
            </div>

            {/* Outreach Pipeline Metrics Grid */}
            {(() => {
              const metrics = calculateStatusMetrics(contacts);
              return (
                <div style={styles.metricsContainer}>
                  <div style={styles.metricsHeader}>
                    <span style={styles.metricsTitle}>Outreach Pipeline Status</span>
                    <span style={styles.totalContactsBadge}>
                      {metrics.total} Total {metrics.total === 1 ? 'Contact' : 'Contacts'}
                    </span>
                  </div>
                  <div style={styles.metricsGrid}>
                    <div style={styles.metricCardNotContacted}>
                      <span style={styles.metricNumber}>{metrics['Not contacted']}</span>
                      <span style={styles.metricLabel}>Not Contacted</span>
                    </div>
                    <div style={styles.metricCardMessaged}>
                      <span style={styles.metricNumber}>{metrics['Messaged']}</span>
                      <span style={styles.metricLabel}>Messaged</span>
                    </div>
                    <div style={styles.metricCardReplied}>
                      <span style={styles.metricNumber}>{metrics['Replied']}</span>
                      <span style={styles.metricLabel}>Replied</span>
                    </div>
                    <div style={styles.metricCardReceived}>
                      <span style={styles.metricNumber}>{metrics['Referral received']}</span>
                      <span style={styles.metricLabel}>Referral Recv</span>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Tracked Contacts Quick List (if contacts exist) */}
            {contacts.length > 0 && (
              <div style={styles.allContactsCard}>
                <div style={styles.allContactsHeader}>
                  <span style={styles.allContactsTitle}>Tracked Contacts</span>
                  <span style={styles.allContactsSub}>Across Pipeline</span>
                </div>
                <div style={styles.allContactsList}>
                  {contacts.slice(0, 6).map((c) => {
                    const job = savedJobs.find((j) => j.id === c.jobId);
                    return (
                      <div key={c.id} style={styles.allContactRow}>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <span style={styles.allContactName}>{c.name}</span>
                          <span style={styles.allContactJob}>
                            {c.role ? `${c.role} · ` : ''}
                            {job?.company || 'Saved Job'}
                          </span>
                        </div>
                        <span
                          style={{
                            ...styles.miniStatusBadge,
                            ...getStatusBadgeStyle(c.status),
                          }}
                        >
                          {c.status}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div style={styles.referralExplainerCard}>
              <div style={styles.explainerHeader}>
                <span style={styles.explainerBadge}>Architecture Roadmap</span>
                <h3 style={styles.explainerTitle}>Two Distinct Capabilities</h3>
              </div>
              <div style={styles.comparisonGrid}>
                <div style={styles.compBoxActive}>
                  <span style={styles.compStatus}>✓ Active in v1.0</span>
                  <h4 style={styles.compTitle}>Job DOM Extraction & Contact Tracking</h4>
                  <p style={styles.compText}>
                    Inspects LinkedIn postings, saves pipeline jobs, and tracks employee referral contacts with 4-stage outreach states.
                  </p>
                </div>
                <div style={styles.compBoxNext}>
                  <span style={styles.compStatusPending}>⌛ Upcoming Phase</span>
                  <h4 style={styles.compTitle}>Automated Network Graph Discovery</h4>
                  <p style={styles.compText}>
                    Requires authenticated directory permissions or backend graph syncing to automatically index 1st & 2nd degree team connections.
                  </p>
                </div>
              </div>
            </div>

            {detectedJob && (
              <div style={styles.activeJobContextCard}>
                <span style={styles.activeJobContextLabel}>Active Target Company:</span>
                <div style={styles.activeJobContextRow}>
                  <strong>{detectedJob.company}</strong>
                  <button
                    onClick={() => handleSearchCompanyConnections(detectedJob.company)}
                    style={styles.quickSearchBtn}
                  >
                    Search Employees ↗
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Settings & Info */}
        {activeTab === 'settings' && (
          <div style={styles.tabContent}>
            <div style={styles.tabHeadingBlock}>
              <h2 style={styles.tabHeading}>Extension Settings</h2>
              <p style={styles.tabDesc}>
                Manifest V3 permissions and LinkedIn scope.
              </p>
            </div>

            <div style={styles.settingsGroup}>
              <div style={styles.settingsItem}>
                <div>
                  <span style={styles.settingsItemTitle}>Platform Scope</span>
                  <p style={styles.settingsItemSub}>
                    Exclusively restricted to <code>*.linkedin.com</code>
                  </p>
                </div>
                <span style={styles.versionTag}>LinkedIn Only</span>
              </div>

              <div style={styles.settingsItem}>
                <div>
                  <span style={styles.settingsItemTitle}>Storage Engine</span>
                  <p style={styles.settingsItemSub}>
                    Chrome Local Storage (<code>chrome.storage.local</code>)
                  </p>
                </div>
                <span style={styles.versionTag}>Persistent</span>
              </div>

              <div style={styles.settingsItem}>
                <div>
                  <span style={styles.settingsItemTitle}>Extension Version</span>
                  <p style={styles.settingsItemSub}>
                    Chrome Extension Manifest V3
                  </p>
                </div>
                <span style={styles.versionTag}>v1.0.0</span>
              </div>
            </div>
          </div>
        )}
      </main>

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
          <span style={styles.navLabel}>Pipeline ({savedJobs.length})</span>
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
          <span style={styles.navLabel}>
            Referrals{contacts.length > 0 ? ` (${contacts.length})` : ''}
          </span>
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

// Dark navy theme styling
const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    width: '380px',
    minHeight: '560px',
    backgroundColor: '#0b0f19',
    color: '#f8fafc',
    position: 'relative',
    paddingBottom: '56px',
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
    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.5)',
    border: '1px solid #3b82f6',
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
  platformBadge: {
    fontSize: '9px',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: '0.4px',
    padding: '2px 6px',
    borderRadius: '4px',
    backgroundColor: '#0a66c2',
    color: '#ffffff',
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
  refreshButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    backgroundColor: '#1e293b',
    border: '1px solid #334155',
    color: '#93c5fd',
    padding: '5px 9px',
    borderRadius: '6px',
    fontSize: '11px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'background 0.15s ease',
  },
  refreshText: {
    fontSize: '11px',
  },
  spinningIcon: {
    animation: 'spin 1s linear infinite',
  },
  main: {
    flex: 1,
    padding: '14px 14px 8px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  stateCard: {
    backgroundColor: '#111827',
    borderRadius: '12px',
    border: '1px solid #1e293b',
    padding: '24px 16px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    gap: '10px',
  },
  spinner: {
    width: '32px',
    height: '32px',
    border: '3px solid #1e293b',
    borderTop: '3px solid #3b82f6',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  stateIconCircle: {
    width: '44px',
    height: '44px',
    borderRadius: '50%',
    backgroundColor: '#172554',
    border: '1px solid #1e40af',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateIconCircleWarn: {
    width: '44px',
    height: '44px',
    borderRadius: '50%',
    backgroundColor: '#2e1065',
    border: '1px solid #6b21a8',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateTitle: {
    fontSize: '15px',
    fontWeight: '700',
    color: '#f8fafc',
  },
  stateDesc: {
    fontSize: '12px',
    color: '#94a3b8',
    lineHeight: '1.45',
  },
  tipsBox: {
    backgroundColor: '#0a0f1d',
    border: '1px solid #1e293b',
    borderRadius: '8px',
    padding: '10px 12px',
    textAlign: 'left',
    fontSize: '11px',
    color: '#cbd5e1',
    width: '100%',
  },
  tipsList: {
    paddingLeft: '18px',
    marginTop: '6px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  primaryActionBtn: {
    marginTop: '6px',
    width: '100%',
    padding: '10px',
    backgroundColor: '#2563eb',
    color: '#ffffff',
    fontSize: '12px',
    fontWeight: '600',
    borderRadius: '8px',
    cursor: 'pointer',
  },
  secondaryActionBtn: {
    marginTop: '6px',
    width: '100%',
    padding: '10px',
    backgroundColor: '#1e293b',
    color: '#93c5fd',
    border: '1px solid #334155',
    fontSize: '12px',
    fontWeight: '600',
    borderRadius: '8px',
    cursor: 'pointer',
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
    marginBottom: '8px',
  },
  companyAvatar: {
    width: '40px',
    height: '40px',
    borderRadius: '8px',
    backgroundColor: '#1d4ed8',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '18px',
    fontWeight: '800',
    color: '#ffffff',
    flexShrink: 0,
    boxShadow: '0 2px 8px rgba(29, 78, 216, 0.3)',
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
    fontSize: '12px',
    fontWeight: '600',
    color: '#93c5fd',
  },
  liveDetectedBadge: {
    fontSize: '9px',
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
    marginBottom: '2px',
  },
  locationText: {
    fontSize: '11px',
    color: '#cbd5e1',
  },
  missingFieldText: {
    fontSize: '11px',
    color: '#64748b',
    fontStyle: 'italic',
  },
  metaRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px',
    margin: '8px 0',
  },
  metaBadge: {
    fontSize: '11px',
    color: '#cbd5e1',
    backgroundColor: '#1a2236',
    padding: '3px 8px',
    borderRadius: '6px',
    border: '1px solid #243049',
  },
  metaBadgeSalary: {
    fontSize: '11px',
    color: '#34d399',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    padding: '3px 8px',
    borderRadius: '6px',
    border: '1px solid rgba(16, 185, 129, 0.25)',
    fontWeight: '600',
  },
  canonicalUrlRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    backgroundColor: '#0a0f1d',
    padding: '5px 8px',
    borderRadius: '6px',
    border: '1px solid #1e293b',
    marginBottom: '10px',
  },
  urlLabel: {
    fontSize: '10px',
    color: '#64748b',
  },
  urlLink: {
    fontSize: '10px',
    color: '#60a5fa',
    textDecoration: 'none',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    flex: 1,
  },
  descriptionSection: {
    backgroundColor: '#0a0f1d',
    borderRadius: '8px',
    padding: '8px 10px',
    border: '1px solid #1e293b',
    marginBottom: '12px',
  },
  descriptionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '4px',
  },
  descTitle: {
    fontSize: '10px',
    fontWeight: '700',
    color: '#94a3b8',
    textTransform: 'uppercase',
  },
  expandDescBtn: {
    background: 'none',
    color: '#60a5fa',
    fontSize: '10px',
    cursor: 'pointer',
    padding: 0,
  },
  descriptionSnippet: {
    fontSize: '11px',
    color: '#94a3b8',
    lineHeight: '1.4',
    maxHeight: '44px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
  },
  descriptionFull: {
    fontSize: '11px',
    color: '#cbd5e1',
    lineHeight: '1.45',
    maxHeight: '180px',
    overflowY: 'auto',
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
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  sectionHeaderRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitleGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  sectionTitle: {
    fontSize: '12px',
    fontWeight: '700',
    color: '#cbd5e1',
    textTransform: 'uppercase',
    letterSpacing: '0.4px',
  },
  companyHighlight: {
    fontSize: '11px',
    fontWeight: '600',
    color: '#60a5fa',
  },
  honestNoticeCard: {
    display: 'flex',
    gap: '10px',
    backgroundColor: '#111827',
    border: '1px solid #1e293b',
    borderRadius: '8px',
    padding: '10px 12px',
  },
  noticeIcon: {
    fontSize: '16px',
  },
  noticeContent: {
    flex: 1,
  },
  noticeStrong: {
    fontSize: '11px',
    color: '#e2e8f0',
    display: 'block',
    marginBottom: '2px',
  },
  noticeText: {
    fontSize: '10px',
    color: '#94a3b8',
    lineHeight: '1.4',
  },
  referralActionCard: {
    backgroundColor: '#111827',
    border: '1px solid #1e3a8a',
    borderRadius: '8px',
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  referralCardHeading: {
    fontSize: '12px',
    fontWeight: '700',
    color: '#f8fafc',
  },
  referralCardDesc: {
    fontSize: '11px',
    color: '#94a3b8',
    lineHeight: '1.4',
  },
  linkedinSearchBtn: {
    padding: '9px 12px',
    backgroundColor: '#0a66c2',
    color: '#ffffff',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    boxShadow: '0 2px 8px rgba(10, 102, 194, 0.4)',
  },
  draftCard: {
    backgroundColor: '#111827',
    border: '1px solid #1e293b',
    borderRadius: '8px',
    padding: '10px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  draftHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  draftLabel: {
    fontSize: '11px',
    fontWeight: '600',
    color: '#cbd5e1',
  },
  copyDraftBtn: {
    backgroundColor: '#1e293b',
    color: '#93c5fd',
    fontSize: '10px',
    fontWeight: '600',
    padding: '3px 8px',
    borderRadius: '4px',
    cursor: 'pointer',
    border: '1px solid #334155',
  },
  draftTextArea: {
    width: '100%',
    height: '68px',
    backgroundColor: '#070b13',
    border: '1px solid #1e293b',
    borderRadius: '6px',
    padding: '8px',
    color: '#e2e8f0',
    fontSize: '11px',
    lineHeight: '1.4',
    resize: 'none',
    fontFamily: 'inherit',
    outline: 'none',
  },
  archDrawer: {
    backgroundColor: '#0b1120',
    borderRadius: '8px',
    border: '1px solid #1e293b',
    overflow: 'hidden',
  },
  archToggleBtn: {
    width: '100%',
    padding: '8px 12px',
    backgroundColor: 'transparent',
    color: '#94a3b8',
    fontSize: '10px',
    fontWeight: '600',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    cursor: 'pointer',
  },
  archContent: {
    padding: '10px 12px',
    borderTop: '1px solid #1e293b',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    fontSize: '10px',
    color: '#94a3b8',
    lineHeight: '1.4',
  },
  archStep: {
    marginBottom: '2px',
  },
  tabContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  tabHeadingBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  tabTitleRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tabHeading: {
    fontSize: '15px',
    fontWeight: '700',
    color: '#ffffff',
  },
  pipelineCountBadge: {
    fontSize: '10px',
    fontWeight: '700',
    backgroundColor: '#1e293b',
    color: '#60a5fa',
    padding: '2px 8px',
    borderRadius: '10px',
    border: '1px solid #3b82f6',
  },
  tabDesc: {
    fontSize: '11px',
    color: '#94a3b8',
  },
  emptyPipelineCard: {
    backgroundColor: '#111827',
    borderRadius: '10px',
    border: '1px solid #1e293b',
    padding: '28px 16px',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '6px',
  },
  emptyIcon: {
    fontSize: '28px',
    marginBottom: '4px',
  },
  emptyTitle: {
    fontSize: '14px',
    fontWeight: '700',
    color: '#f8fafc',
  },
  emptyDesc: {
    fontSize: '11px',
    color: '#94a3b8',
    lineHeight: '1.4',
    maxWidth: '260px',
  },
  pipelineList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  pipelineItem: {
    backgroundColor: '#111827',
    borderRadius: '8px',
    border: '1px solid #1e293b',
    padding: '10px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  pipelineItemHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  pipelineJobTitle: {
    fontSize: '13px',
    fontWeight: '700',
    color: '#f1f5f9',
    lineHeight: '1.2',
  },
  pipelineCompany: {
    fontSize: '11px',
    color: '#60a5fa',
    fontWeight: '600',
  },
  pipelineStatusBadge: {
    fontSize: '9px',
    fontWeight: '700',
    padding: '2px 6px',
    borderRadius: '4px',
    backgroundColor: 'rgba(37, 99, 235, 0.15)',
    color: '#93c5fd',
    border: '1px solid rgba(59, 130, 246, 0.3)',
  },
  pipelineMetaRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '4px',
  },
  pipelineMetaPill: {
    fontSize: '9px',
    color: '#cbd5e1',
    backgroundColor: '#1a2236',
    padding: '2px 6px',
    borderRadius: '4px',
  },
  pipelineMetaPillSalary: {
    fontSize: '9px',
    color: '#34d399',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    padding: '2px 6px',
    borderRadius: '4px',
    fontWeight: '600',
  },
  pipelineActions: {
    display: 'flex',
    gap: '6px',
    marginTop: '4px',
    alignItems: 'center',
  },
  pipelineReferralBtn: {
    flex: 1,
    padding: '5px 8px',
    borderRadius: '4px',
    backgroundColor: '#172554',
    border: '1px solid #1e40af',
    color: '#93c5fd',
    fontSize: '10px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  pipelineLinkBtn: {
    padding: '5px 8px',
    borderRadius: '4px',
    backgroundColor: '#1e293b',
    border: '1px solid #334155',
    color: '#cbd5e1',
    fontSize: '10px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  pipelineDeleteBtn: {
    padding: '5px 8px',
    borderRadius: '4px',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    color: '#f87171',
    fontSize: '10px',
    fontWeight: '700',
    cursor: 'pointer',
  },
  referralExplainerCard: {
    backgroundColor: '#111827',
    borderRadius: '10px',
    border: '1px solid #1e293b',
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  explainerHeader: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  explainerBadge: {
    fontSize: '9px',
    fontWeight: '700',
    color: '#60a5fa',
    textTransform: 'uppercase',
  },
  explainerTitle: {
    fontSize: '13px',
    fontWeight: '700',
    color: '#f8fafc',
  },
  comparisonGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  compBoxActive: {
    backgroundColor: '#0a0f1d',
    border: '1px solid #1e3a8a',
    borderRadius: '6px',
    padding: '8px 10px',
  },
  compBoxNext: {
    backgroundColor: '#0a0f1d',
    border: '1px solid #334155',
    borderRadius: '6px',
    padding: '8px 10px',
  },
  compStatus: {
    fontSize: '9px',
    fontWeight: '700',
    color: '#10b981',
    display: 'block',
    marginBottom: '2px',
  },
  compStatusPending: {
    fontSize: '9px',
    fontWeight: '700',
    color: '#f59e0b',
    display: 'block',
    marginBottom: '2px',
  },
  compTitle: {
    fontSize: '11px',
    fontWeight: '700',
    color: '#f8fafc',
    marginBottom: '2px',
  },
  compText: {
    fontSize: '10px',
    color: '#94a3b8',
    lineHeight: '1.35',
  },
  activeJobContextCard: {
    backgroundColor: '#111827',
    borderRadius: '8px',
    border: '1px solid #1e293b',
    padding: '10px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  activeJobContextLabel: {
    fontSize: '10px',
    color: '#64748b',
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  activeJobContextRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    color: '#f8fafc',
    fontSize: '13px',
  },
  quickSearchBtn: {
    padding: '4px 8px',
    borderRadius: '4px',
    backgroundColor: '#0a66c2',
    color: '#ffffff',
    fontSize: '10px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  settingsGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
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
  versionTag: {
    fontSize: '11px',
    fontWeight: '700',
    color: '#60a5fa',
    backgroundColor: '#1e293b',
    padding: '2px 8px',
    borderRadius: '4px',
  },
  // Pipeline details & referral hub styling
  detailNavRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '2px',
  },
  backButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    backgroundColor: '#1e293b',
    border: '1px solid #334155',
    color: '#93c5fd',
    padding: '6px 10px',
    borderRadius: '6px',
    fontSize: '11px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  detailScopeBadge: {
    fontSize: '10px',
    fontWeight: '700',
    color: '#60a5fa',
    backgroundColor: 'rgba(37, 99, 235, 0.15)',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    padding: '2px 8px',
    borderRadius: '10px',
    textTransform: 'uppercase',
    letterSpacing: '0.4px',
  },
  detailJobCard: {
    backgroundColor: '#111827',
    borderRadius: '10px',
    border: '1px solid #1e293b',
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  detailJobHeaderRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  companyAvatarSmall: {
    width: '34px',
    height: '34px',
    borderRadius: '6px',
    backgroundColor: '#1d4ed8',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '15px',
    fontWeight: '800',
    color: '#ffffff',
    flexShrink: 0,
  },
  detailJobTitle: {
    fontSize: '13px',
    fontWeight: '700',
    color: '#f8fafc',
    lineHeight: '1.25',
    margin: 0,
  },
  detailJobCompany: {
    fontSize: '11px',
    color: '#60a5fa',
    fontWeight: '600',
  },
  detailActionsRow: {
    display: 'flex',
    gap: '8px',
    marginTop: '4px',
  },
  findReferralsMainBtn: {
    flex: 1,
    padding: '8px 12px',
    borderRadius: '6px',
    backgroundColor: '#0a66c2',
    color: '#ffffff',
    fontSize: '11px',
    fontWeight: '600',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    cursor: 'pointer',
    border: 'none',
    boxShadow: '0 2px 6px rgba(10, 102, 194, 0.3)',
  },
  detailViewJobBtn: {
    padding: '8px 12px',
    borderRadius: '6px',
    backgroundColor: '#1e293b',
    border: '1px solid #334155',
    color: '#cbd5e1',
    fontSize: '11px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  contactsSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    marginTop: '4px',
  },
  contactsSectionHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  contactsTitleGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  contactsSectionTitle: {
    fontSize: '12px',
    fontWeight: '700',
    color: '#cbd5e1',
    textTransform: 'uppercase',
    letterSpacing: '0.4px',
    margin: 0,
  },
  contactsCountBadge: {
    fontSize: '10px',
    fontWeight: '700',
    backgroundColor: '#1e293b',
    color: '#60a5fa',
    padding: '1px 6px',
    borderRadius: '10px',
    border: '1px solid #3b82f6',
  },
  addContactButton: {
    padding: '4px 10px',
    borderRadius: '6px',
    backgroundColor: '#2563eb',
    color: '#ffffff',
    fontSize: '11px',
    fontWeight: '600',
    cursor: 'pointer',
    border: 'none',
  },
  contactFormCard: {
    backgroundColor: '#111827',
    borderRadius: '10px',
    border: '1px solid #2563eb',
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    boxShadow: '0 4px 14px rgba(37, 99, 235, 0.2)',
  },
  contactFormHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  contactFormTitle: {
    fontSize: '12px',
    fontWeight: '700',
    color: '#93c5fd',
  },
  formCloseBtn: {
    background: 'none',
    border: 'none',
    color: '#94a3b8',
    fontSize: '14px',
    cursor: 'pointer',
    padding: '2px',
  },
  formErrorBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    border: '1px solid rgba(239, 68, 68, 0.4)',
    color: '#fca5a5',
    padding: '6px 10px',
    borderRadius: '6px',
    fontSize: '11px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  formFields: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  formField: {
    display: 'flex',
    flexDirection: 'column',
    gap: '3px',
  },
  formLabel: {
    fontSize: '10px',
    fontWeight: '600',
    color: '#cbd5e1',
    textTransform: 'uppercase',
  },
  requiredStar: {
    color: '#f87171',
  },
  formInput: {
    width: '100%',
    padding: '7px 9px',
    backgroundColor: '#070b13',
    border: '1px solid #1e293b',
    borderRadius: '6px',
    color: '#f8fafc',
    fontSize: '11px',
    outline: 'none',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
  },
  formSelect: {
    width: '100%',
    padding: '7px 9px',
    backgroundColor: '#070b13',
    border: '1px solid #1e293b',
    borderRadius: '6px',
    color: '#f8fafc',
    fontSize: '11px',
    outline: 'none',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
    cursor: 'pointer',
  },
  formTextarea: {
    width: '100%',
    height: '52px',
    padding: '7px 9px',
    backgroundColor: '#070b13',
    border: '1px solid #1e293b',
    borderRadius: '6px',
    color: '#f8fafc',
    fontSize: '11px',
    outline: 'none',
    fontFamily: 'inherit',
    resize: 'none',
    boxSizing: 'border-box',
  },
  formBtnRow: {
    display: 'flex',
    gap: '8px',
    marginTop: '4px',
  },
  formSubmitBtn: {
    flex: 1,
    padding: '8px',
    backgroundColor: '#2563eb',
    color: '#ffffff',
    fontSize: '11px',
    fontWeight: '600',
    borderRadius: '6px',
    cursor: 'pointer',
    border: 'none',
  },
  formCancelBtn: {
    padding: '8px 12px',
    backgroundColor: '#1e293b',
    border: '1px solid #334155',
    color: '#94a3b8',
    fontSize: '11px',
    fontWeight: '600',
    borderRadius: '6px',
    cursor: 'pointer',
  },
  emptyContactsCard: {
    backgroundColor: '#111827',
    borderRadius: '8px',
    border: '1px solid #1e293b',
    padding: '20px 14px',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '6px',
  },
  emptyContactsTitle: {
    fontSize: '13px',
    fontWeight: '700',
    color: '#f8fafc',
    margin: 0,
  },
  emptyContactsDesc: {
    fontSize: '11px',
    color: '#94a3b8',
    lineHeight: '1.4',
    margin: 0,
  },
  emptyAddContactBtn: {
    marginTop: '6px',
    padding: '6px 12px',
    backgroundColor: '#1e293b',
    border: '1px solid #3b82f6',
    color: '#93c5fd',
    borderRadius: '6px',
    fontSize: '11px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  contactsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  contactItemCard: {
    backgroundColor: '#111827',
    borderRadius: '8px',
    border: '1px solid #1e293b',
    padding: '10px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  contactCardHeaderRow: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '8px',
  },
  contactCardIdentity: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flex: 1,
    minWidth: 0,
  },
  contactAvatar: {
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    backgroundColor: '#1e293b',
    border: '1px solid #334155',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '12px',
    fontWeight: '700',
    color: '#60a5fa',
    flexShrink: 0,
  },
  contactCardName: {
    fontSize: '12px',
    fontWeight: '700',
    color: '#ffffff',
    margin: 0,
    lineHeight: '1.2',
  },
  contactCardRole: {
    fontSize: '10px',
    color: '#cbd5e1',
  },
  contactCardRoleMuted: {
    fontSize: '10px',
    color: '#64748b',
    fontStyle: 'italic',
  },
  statusDropdown: {
    padding: '3px 8px',
    borderRadius: '6px',
    fontSize: '10px',
    fontWeight: '600',
    borderWidth: '1px',
    borderStyle: 'solid',
    outline: 'none',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  contactUrlRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    backgroundColor: '#0a0f1d',
    padding: '4px 8px',
    borderRadius: '4px',
    border: '1px solid #1e293b',
  },
  contactUrlLink: {
    fontSize: '10px',
    color: '#60a5fa',
    textDecoration: 'none',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    flex: 1,
  },
  contactNotesBox: {
    backgroundColor: '#070b13',
    borderRadius: '4px',
    border: '1px solid #1e293b',
    padding: '6px 8px',
    fontSize: '10px',
    color: '#cbd5e1',
    lineHeight: '1.35',
  },
  notesLabel: {
    fontWeight: '700',
    color: '#94a3b8',
  },
  contactCardActions: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: '6px',
    marginTop: '2px',
  },
  contactEditBtn: {
    padding: '3px 8px',
    backgroundColor: '#1e293b',
    border: '1px solid #334155',
    color: '#cbd5e1',
    fontSize: '10px',
    fontWeight: '600',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  contactDeleteBtn: {
    padding: '3px 8px',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    color: '#f87171',
    fontSize: '10px',
    fontWeight: '700',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  pipelineItemClickableHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    cursor: 'pointer',
  },
  pipelineContactsPill: {
    fontSize: '9px',
    color: '#93c5fd',
    backgroundColor: 'rgba(37, 99, 235, 0.15)',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    padding: '2px 6px',
    borderRadius: '4px',
    fontWeight: '600',
  },
  pipelineManageContactsBtn: {
    flex: 1,
    padding: '5px 8px',
    borderRadius: '4px',
    backgroundColor: '#1e3a8a',
    border: '1px solid #2563eb',
    color: '#eff6ff',
    fontSize: '10px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  metricsContainer: {
    backgroundColor: '#111827',
    borderRadius: '10px',
    border: '1px solid #1e293b',
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  metricsHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metricsTitle: {
    fontSize: '12px',
    fontWeight: '700',
    color: '#f8fafc',
  },
  totalContactsBadge: {
    fontSize: '10px',
    fontWeight: '700',
    color: '#60a5fa',
    backgroundColor: '#1e293b',
    padding: '2px 8px',
    borderRadius: '10px',
    border: '1px solid #3b82f6',
  },
  metricsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '6px',
  },
  metricCardNotContacted: {
    backgroundColor: '#0a0f1d',
    border: '1px solid #334155',
    borderRadius: '6px',
    padding: '8px 4px',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  metricCardMessaged: {
    backgroundColor: '#0a0f1d',
    border: '1px solid rgba(59, 130, 246, 0.4)',
    borderRadius: '6px',
    padding: '8px 4px',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  metricCardReplied: {
    backgroundColor: '#0a0f1d',
    border: '1px solid rgba(168, 85, 247, 0.4)',
    borderRadius: '6px',
    padding: '8px 4px',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  metricCardReceived: {
    backgroundColor: '#0a0f1d',
    border: '1px solid rgba(16, 185, 129, 0.4)',
    borderRadius: '6px',
    padding: '8px 4px',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  metricNumber: {
    fontSize: '14px',
    fontWeight: '800',
    color: '#ffffff',
  },
  metricLabel: {
    fontSize: '8px',
    fontWeight: '600',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: '0.2px',
  },
  allContactsCard: {
    backgroundColor: '#111827',
    borderRadius: '10px',
    border: '1px solid #1e293b',
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  allContactsHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  allContactsTitle: {
    fontSize: '12px',
    fontWeight: '700',
    color: '#f8fafc',
  },
  allContactsSub: {
    fontSize: '10px',
    color: '#64748b',
  },
  allContactsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  allContactRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0a0f1d',
    padding: '6px 8px',
    borderRadius: '6px',
    border: '1px solid #1e293b',
    gap: '8px',
  },
  allContactName: {
    fontSize: '11px',
    fontWeight: '600',
    color: '#f1f5f9',
    display: 'block',
  },
  allContactJob: {
    fontSize: '10px',
    color: '#60a5fa',
    display: 'block',
  },
  miniStatusBadge: {
    fontSize: '9px',
    fontWeight: '700',
    padding: '2px 6px',
    borderRadius: '4px',
    borderWidth: '1px',
    borderStyle: 'solid',
    flexShrink: 0,
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
