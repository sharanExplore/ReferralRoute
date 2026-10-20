// ReferralRoute Referral Contact Utilities & Validation
// Pure helper functions for contact management, URL validation, and duplicate checking.

export const REFERRAL_STATUSES = [
  'Not contacted',
  'Messaged',
  'Replied',
  'Referral received',
];

/**
 * Validates and normalizes profile URLs (e.g. LinkedIn profiles).
 * Allows empty URLs (as profile URL is optional).
 * Automatically prepends https:// if missing.
 */
export function validateProfileUrl(url) {
  if (!url || typeof url !== 'string' || !url.trim()) {
    return { valid: true, cleanUrl: '' };
  }

  let trimmed = url.trim();
  // Auto-prepend https:// if protocol is omitted
  if (!/^https?:\/\//i.test(trimmed)) {
    trimmed = 'https://' + trimmed;
  }

  try {
    const parsed = new URL(trimmed);
    if (!parsed.hostname || !parsed.hostname.includes('.')) {
      return {
        valid: false,
        message: 'Invalid URL. Please enter a valid web or LinkedIn profile URL.',
      };
    }
    return { valid: true, cleanUrl: parsed.href };
  } catch (e) {
    return {
      valid: false,
      message: 'Invalid URL format. Please enter a valid URL.',
    };
  }
}

/**
 * Validates contact input fields before saving.
 * Checks for required name, valid URL, and duplicates within the same saved job.
 */
export function validateContactInput({
  name,
  profileUrl,
  jobId,
  existingContacts = [],
  currentContactId = null,
}) {
  const cleanName = (name || '').trim();
  if (!cleanName) {
    return { valid: false, error: 'Contact name is required.' };
  }

  if (!jobId) {
    return { valid: false, error: 'Please select a saved job for this contact.' };
  }

  const urlCheck = validateProfileUrl(profileUrl);
  if (!urlCheck.valid) {
    return { valid: false, error: urlCheck.message };
  }

  // Duplicate check scoped to the same job
  const isDuplicate = existingContacts.some((c) => {
    if (c.id === currentContactId) return false;
    if (c.jobId !== jobId) return false;

    // Duplicate by profile URL (if both provided)
    if (urlCheck.cleanUrl && c.profileUrl) {
      if (c.profileUrl.toLowerCase() === urlCheck.cleanUrl.toLowerCase()) {
        return true;
      }
    }

    // Duplicate by contact name (case-insensitive)
    if (c.name && c.name.trim().toLowerCase() === cleanName.toLowerCase()) {
      return true;
    }

    return false;
  });

  if (isDuplicate) {
    return {
      valid: false,
      error: 'A contact with this name or LinkedIn URL is already tracked for this job.',
    };
  }

  return {
    valid: true,
    data: {
      cleanName,
      cleanUrl: urlCheck.cleanUrl,
    },
  };
}

/**
 * Creates a normalized contact record.
 */
export function createContactRecord({
  jobId,
  name,
  role = '',
  profileUrl = '',
  status = 'Not contacted',
  notes = '',
}) {
  const now = new Date().toISOString();
  return {
    id: `contact-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    jobId,
    name: name.trim(),
    role: (role || '').trim(),
    profileUrl: profileUrl ? profileUrl.trim() : '',
    status: REFERRAL_STATUSES.includes(status) ? status : 'Not contacted',
    notes: (notes || '').trim(),
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Updates an existing contact record, validating status and updating the updatedAt timestamp.
 */
export function updateContactRecord(contact, updates = {}) {
  const now = new Date().toISOString();
  const nextStatus = updates.status && REFERRAL_STATUSES.includes(updates.status)
    ? updates.status
    : contact.status;

  return {
    ...contact,
    ...updates,
    status: nextStatus,
    name: updates.name !== undefined ? updates.name.trim() : contact.name,
    role: updates.role !== undefined ? updates.role.trim() : contact.role,
    profileUrl: updates.profileUrl !== undefined ? updates.profileUrl.trim() : contact.profileUrl,
    notes: updates.notes !== undefined ? updates.notes.trim() : contact.notes,
    updatedAt: now,
  };
}

/**
 * Filters contacts associated with a specific saved job.
 */
export function filterContactsByJob(contacts = [], jobId) {
  if (!jobId) return [];
  return contacts.filter((c) => c.jobId === jobId);
}

/**
 * Removes a specific contact by its ID.
 */
export function removeContactById(contacts = [], contactId) {
  return contacts.filter((c) => c.id !== contactId);
}

/**
 * Removes all contacts associated with a given job (for cascading deletion).
 */
export function removeContactsForJob(contacts = [], jobId) {
  return contacts.filter((c) => c.jobId !== jobId);
}

/**
 * Calculates count of contacts for each referral status.
 */
export function calculateStatusMetrics(contacts = []) {
  const metrics = {
    total: contacts.length,
    'Not contacted': 0,
    'Messaged': 0,
    'Replied': 0,
    'Referral received': 0,
  };

  for (const c of contacts) {
    if (metrics[c.status] !== undefined) {
      metrics[c.status]++;
    }
  }

  return metrics;
}

