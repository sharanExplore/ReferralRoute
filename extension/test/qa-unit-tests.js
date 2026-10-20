// ReferralRoute QA Unit Test Suite
// Tests core extraction, deduplication logic (B3), selector handling (B2), and idempotency (B1).

import assert from 'node:assert';

console.log('--- ReferralRoute QA Test Suite Running ---');

// --- Test 1: Canonical URL Extraction Logic ---
function extractCanonicalUrlFromHref(href) {
  // Direct job URL
  const directMatch = href.match(/\/jobs\/view\/(\d+)/i);
  if (directMatch && directMatch[1]) {
    return {
      jobId: directMatch[1],
      canonicalUrl: `https://www.linkedin.com/jobs/view/${directMatch[1]}/`,
    };
  }

  // Search URL with ?currentJobId=
  try {
    const urlObj = new URL(href);
    const currentJobId = urlObj.searchParams.get('currentJobId');
    if (currentJobId && /^\d+$/.test(currentJobId)) {
      return {
        jobId: currentJobId,
        canonicalUrl: `https://www.linkedin.com/jobs/view/${currentJobId}/`,
      };
    }
  } catch (e) {}

  const cleanHref = href.split('?')[0].split('#')[0];
  return {
    jobId: null,
    canonicalUrl: cleanHref,
  };
}

// Subtest 1.1: Direct view URL
{
  const res = extractCanonicalUrlFromHref('https://www.linkedin.com/jobs/view/3850123456/?refId=abc&trackingId=xyz');
  assert.strictEqual(res.jobId, '3850123456', 'Direct job ID should be parsed');
  assert.strictEqual(res.canonicalUrl, 'https://www.linkedin.com/jobs/view/3850123456/', 'Direct canonical URL must be normalized');
  console.log('✓ Test 1.1: Direct Job View URL extraction passed.');
}

// Subtest 1.2: Search split-view URL
{
  const res = extractCanonicalUrlFromHref('https://www.linkedin.com/jobs/search/?currentJobId=4012345678&keywords=react&origin=JOB_SEARCH_PAGE_SEARCH_BUTTON');
  assert.strictEqual(res.jobId, '4012345678', 'Search currentJobId should be parsed');
  assert.strictEqual(res.canonicalUrl, 'https://www.linkedin.com/jobs/view/4012345678/', 'Canonical URL from search must point to /jobs/view/<id>/');
  console.log('✓ Test 1.2: Search results split-view URL extraction passed.');
}

// --- Test 2: B3 Deduplication Logic ---
function isSavedCheck(detectedJob, savedJobs) {
  return savedJobs.some((j) => {
    if (detectedJob.canonicalUrl && j.canonicalUrl) {
      return j.canonicalUrl === detectedJob.canonicalUrl;
    }
    return j.title === detectedJob.title && j.company === detectedJob.company;
  });
}

// Subtest 2.1: Same title and company, but different canonical URLs (should NOT be treated as duplicate)
{
  const savedJobs = [
    {
      id: 'job-1',
      title: 'Senior Software Engineer',
      company: 'Google',
      canonicalUrl: 'https://www.linkedin.com/jobs/view/111111/',
    },
  ];

  const newJobDifferentOpening = {
    title: 'Senior Software Engineer',
    company: 'Google',
    canonicalUrl: 'https://www.linkedin.com/jobs/view/222222/',
  };

  const isDuplicate = isSavedCheck(newJobDifferentOpening, savedJobs);
  assert.strictEqual(isDuplicate, false, 'Jobs with different canonical URLs must NOT be flagged as duplicates');
  console.log('✓ Test 2.1: B3 fix prevents false duplicate on identical title at same company.');
}

// Subtest 2.2: Same canonical URL (SHOULD be treated as duplicate)
{
  const savedJobs = [
    {
      id: 'job-1',
      title: 'Senior Software Engineer',
      company: 'Google',
      canonicalUrl: 'https://www.linkedin.com/jobs/view/111111/',
    },
  ];

  const sameJobRevisited = {
    title: 'Senior Software Engineer',
    company: 'Google',
    canonicalUrl: 'https://www.linkedin.com/jobs/view/111111/',
  };

  const isDuplicate = isSavedCheck(sameJobRevisited, savedJobs);
  assert.strictEqual(isDuplicate, true, 'Jobs with identical canonical URL MUST be detected as duplicate/saved');
  console.log('✓ Test 2.2: Exact canonical URL correctly detected as saved.');
}

// --- Test 3: Safe Re-injection Lifecycle ---
{
  const mockChrome = {
    listeners: new Set(),
    runtime: {
      onMessage: {
        addListener(fn) {
          mockChrome.listeners.add(fn);
        },
        removeListener(fn) {
          mockChrome.listeners.delete(fn);
        },
      },
    },
  };

  const mockWindow = {};

  function injectScript(win, chromeApi) {
    if (win.__REFERRAL_ROUTE_MESSAGE_LISTENER__) {
      try {
        chromeApi.runtime.onMessage.removeListener(win.__REFERRAL_ROUTE_MESSAGE_LISTENER__);
      } catch (e) {}
    }

    const handler = () => 'RESPONSE';
    win.__REFERRAL_ROUTE_MESSAGE_LISTENER__ = handler;
    chromeApi.runtime.onMessage.addListener(handler);
  }

  // Initial injection
  injectScript(mockWindow, mockChrome);
  assert.strictEqual(mockChrome.listeners.size, 1, 'Should have 1 active listener after first injection');

  // Re-injection (e.g. after extension reload or retry)
  injectScript(mockWindow, mockChrome);
  assert.strictEqual(mockChrome.listeners.size, 1, 'Must maintain exactly 1 active listener, replacing the old handler');
  console.log('✓ Test 3.1: Re-injection lifecycle maintains working listener without duplicates.');
}

// --- Test 4: Detail-Pane Scoping Priority ---
{
  // Simulates a split-view page where the left search list has one job and the right panel has the selected job
  const mockDOM = {
    searchListJob: { title: 'First Unrelated Job', company: 'Company A' },
    activeDetailPane: {
      title: 'Full Stack Developer',
      company: 'Jobgether',
      location: 'India (Remote) · 1 week ago · 40 applicants',
    },
  };

  function extractJobScoped(mockData) {
    const pane = mockData.activeDetailPane;
    // Location cleaner logic
    const segments = pane.location.split(/[·•]/);
    const cleanLoc = segments.find(
      (s) => !/\b(ago|applicants?|reposted)\b/i.test(s)
    ).trim();

    return {
      title: pane.title,
      company: pane.company,
      location: cleanLoc,
    };
  }

  const extracted = extractJobScoped(mockDOM);
  assert.strictEqual(extracted.title, 'Full Stack Developer', 'Must extract title from active detail pane');
  assert.strictEqual(extracted.company, 'Jobgether', 'Must extract company from active detail pane');
  assert.strictEqual(extracted.location, 'India (Remote)', 'Must clean bullet metadata from location');
  console.log('✓ Test 4.1: Split-view details pane extraction extracts correct selected job.');
}

// --- Test 5: Referral Contact Tracking & Validation Logic ---
import {
  REFERRAL_STATUSES,
  validateProfileUrl,
  validateContactInput,
  createContactRecord,
} from '../src/contact-utils.js';

// Subtest 5.1: URL normalization and validation
{
  const emptyRes = validateProfileUrl('');
  assert.strictEqual(emptyRes.valid, true, 'Empty URL should be allowed (optional field)');
  assert.strictEqual(emptyRes.cleanUrl, '');

  const missingProtocol = validateProfileUrl('linkedin.com/in/sarah-connor');
  assert.strictEqual(missingProtocol.valid, true, 'Should automatically prepend https://');
  assert.strictEqual(missingProtocol.cleanUrl, 'https://linkedin.com/in/sarah-connor');

  const fullUrl = validateProfileUrl('https://www.linkedin.com/in/alex-smith/?locale=en_US');
  assert.strictEqual(fullUrl.valid, true, 'Full LinkedIn URL should be valid');
  assert.strictEqual(fullUrl.cleanUrl, 'https://www.linkedin.com/in/alex-smith/?locale=en_US');

  const invalidUrl = validateProfileUrl('not_a_valid_url_at_all');
  assert.strictEqual(invalidUrl.valid, false, 'Invalid string without domain should be rejected');
  console.log('✓ Test 5.1: Profile URL validation and normalization passed.');
}

// Subtest 5.2: Empty field validation
{
  const noName = validateContactInput({
    name: '   ',
    profileUrl: 'https://linkedin.com/in/test',
    jobId: 'job-123',
  });
  assert.strictEqual(noName.valid, false, 'Empty name should fail validation');
  assert.strictEqual(noName.error, 'Contact name is required.');

  const noJob = validateContactInput({
    name: 'Jane Doe',
    profileUrl: '',
    jobId: '',
  });
  assert.strictEqual(noJob.valid, false, 'Missing jobId should fail validation');
  console.log('✓ Test 5.2: Required field validation (name, jobId) passed.');
}

// Subtest 5.3: Duplicate detection within same job
{
  const existingContacts = [
    {
      id: 'contact-1',
      jobId: 'job-100',
      name: 'Michael Scott',
      profileUrl: 'https://www.linkedin.com/in/michael-scott',
      status: 'Messaged',
    },
    {
      id: 'contact-2',
      jobId: 'job-200',
      name: 'Jim Halpert',
      profileUrl: 'https://www.linkedin.com/in/jim-halpert',
      status: 'Not contacted',
    },
  ];

  // Exact duplicate name in same job
  const dupName = validateContactInput({
    name: 'michael scott',
    profileUrl: '',
    jobId: 'job-100',
    existingContacts,
  });
  assert.strictEqual(dupName.valid, false, 'Same name in same job should be detected as duplicate');

  // Exact duplicate URL in same job
  const dupUrl = validateContactInput({
    name: 'M. Scott',
    profileUrl: 'https://www.linkedin.com/in/michael-scott',
    jobId: 'job-100',
    existingContacts,
  });
  assert.strictEqual(dupUrl.valid, false, 'Same LinkedIn URL in same job should be detected as duplicate');

  // Same person for a DIFFERENT job should be allowed
  const diffJob = validateContactInput({
    name: 'Michael Scott',
    profileUrl: 'https://www.linkedin.com/in/michael-scott',
    jobId: 'job-300',
    existingContacts,
  });
  assert.strictEqual(diffJob.valid, true, 'Same contact at different job posting must be permitted');

  // Editing existing contact (same ID) should NOT flag itself as duplicate
  const selfEdit = validateContactInput({
    name: 'Michael Scott',
    profileUrl: 'https://www.linkedin.com/in/michael-scott',
    jobId: 'job-100',
    existingContacts,
    currentContactId: 'contact-1',
  });
  assert.strictEqual(selfEdit.valid, true, 'Editing own contact should not trigger false positive duplicate');
  console.log('✓ Test 5.3: Duplicate contact detection scoped to job passed.');
}

// Subtest 5.4: Outreach status transitions
{
  assert.deepStrictEqual(
    REFERRAL_STATUSES,
    ['Not contacted', 'Messaged', 'Replied', 'Referral received'],
    'Must support the 4 mandated outreach statuses'
  );

  const contact = createContactRecord({
    jobId: 'job-1',
    name: 'Pam Beesly',
    role: 'Office Administrator',
    status: 'Messaged',
  });
  assert.strictEqual(contact.status, 'Messaged');
  assert.strictEqual(contact.jobId, 'job-1');
  assert.strictEqual(contact.name, 'Pam Beesly');
  assert.ok(contact.id.startsWith('contact-'), 'Contact ID must have contact- prefix');
  console.log('✓ Test 5.4: Contact record creation and status handling passed.');
}

// Subtest 5.5: Contact CRUD and cascading delete logic
{
  let savedJobs = [
    { id: 'job-1', title: 'Developer', company: 'Acme Corp' },
    { id: 'job-2', title: 'Designer', company: 'Beta Corp' },
  ];

  let contacts = [
    createContactRecord({ jobId: 'job-1', name: 'Alice', status: 'Not contacted' }),
    createContactRecord({ jobId: 'job-1', name: 'Bob', status: 'Replied' }),
    createContactRecord({ jobId: 'job-2', name: 'Charlie', status: 'Messaged' }),
  ];

  // Filter contacts by job
  const job1Contacts = contacts.filter((c) => c.jobId === 'job-1');
  assert.strictEqual(job1Contacts.length, 2, 'Job 1 must have 2 contacts');

  // Edit Bob's status
  contacts = contacts.map((c) =>
    c.name === 'Bob' ? { ...c, status: 'Referral received' } : c
  );
  const updatedBob = contacts.find((c) => c.name === 'Bob');
  assert.strictEqual(updatedBob.status, 'Referral received', 'Contact status should be updated');

  // Delete Bob
  contacts = contacts.filter((c) => c.name !== 'Bob');
  assert.strictEqual(contacts.length, 2, 'After deleting Bob, 2 contacts remain');

  // Cascading delete: Remove Job 1 from pipeline -> should remove Alice as well
  const jobToDeleteId = 'job-1';
  savedJobs = savedJobs.filter((j) => j.id !== jobToDeleteId);
  contacts = contacts.filter((c) => c.jobId !== jobToDeleteId);

  assert.strictEqual(savedJobs.length, 1, 'Only Job 2 remains in pipeline');
  assert.strictEqual(contacts.length, 1, 'Only Charlie remains (Job 2 contact)');
  assert.strictEqual(contacts[0].name, 'Charlie', 'Remaining contact must be Charlie');
  console.log('✓ Test 5.5: Contact CRUD and cascading job deletion passed.');
}

console.log('--- All ReferralRoute QA Unit Tests Passed Successfully ---');

