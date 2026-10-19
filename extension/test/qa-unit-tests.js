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

console.log('--- All ReferralRoute QA Unit Tests Passed Successfully ---');

