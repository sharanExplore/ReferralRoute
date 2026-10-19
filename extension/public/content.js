// ReferralRoute Content Script - LinkedIn Job Detector (Manifest V3)
// Strictly handles LinkedIn DOM extraction without fabricating missing details.

(function () {
  /**
   * Cleans raw text extracted from DOM nodes
   */
  function cleanText(text) {
    if (!text) return null;
    const cleaned = text
      .replace(/\s+/g, ' ')
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .trim();
    return cleaned.length > 0 ? cleaned : null;
  }

  /**
   * Extracts clean canonical LinkedIn job ID and URL
   */
  function extractCanonicalUrl() {
    const href = window.location.href;

    // Direct job URL: /jobs/view/1234567890/
    const directMatch = href.match(/\/jobs\/view\/(\d+)/i);
    if (directMatch && directMatch[1]) {
      return {
        jobId: directMatch[1],
        canonicalUrl: `https://www.linkedin.com/jobs/view/${directMatch[1]}/`,
      };
    }

    // Search or collections URL with ?currentJobId=1234567890
    try {
      const urlObj = new URL(href);
      const currentJobId = urlObj.searchParams.get('currentJobId');
      if (currentJobId && /^\d+$/.test(currentJobId)) {
        return {
          jobId: currentJobId,
          canonicalUrl: `https://www.linkedin.com/jobs/view/${currentJobId}/`,
        };
      }
    } catch (e) {
      // Fallback
    }

    // Check active job card attribute in search DOM
    const activeItem = document.querySelector(
      '.jobs-search-results-list__list-item--active[data-occludable-job-id], [data-job-id].active, [data-occludable-job-id]'
    );
    if (activeItem) {
      const attrId =
        activeItem.getAttribute('data-occludable-job-id') ||
        activeItem.getAttribute('data-job-id');
      if (attrId && /^\d+$/.test(attrId)) {
        return {
          jobId: attrId,
          canonicalUrl: `https://www.linkedin.com/jobs/view/${attrId}/`,
        };
      }
    }

    // Base URL fallback without tracking queries
    const cleanHref = href.split('?')[0].split('#')[0];
    return {
      jobId: null,
      canonicalUrl: cleanHref,
    };
  }

  /**
   * Attempt extraction from Schema.org JSON-LD
   */
  function extractFromJsonLd() {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (const script of scripts) {
      try {
        const parsed = JSON.parse(script.innerText);
        const data = Array.isArray(parsed)
          ? parsed.find((item) => item['@type'] === 'JobPosting')
          : parsed['@type'] === 'JobPosting'
          ? parsed
          : null;

        if (data) {
          let loc = null;
          if (typeof data.jobLocation?.address === 'string') {
            loc = data.jobLocation.address;
          } else if (data.jobLocation?.address?.addressLocality) {
            loc = `${data.jobLocation.address.addressLocality}${
              data.jobLocation.address.addressRegion
                ? ', ' + data.jobLocation.address.addressRegion
                : ''
            }`;
          }

          let sal = null;
          if (data.baseSalary?.value?.value) {
            sal = `${data.baseSalary.currency || '$'}${data.baseSalary.value.value} ${
              data.baseSalary.value.unitText || ''
            }`.trim();
          }

          return {
            title: cleanText(data.title),
            company: cleanText(data.hiringOrganization?.name),
            location: cleanText(loc),
            salary: cleanText(sal),
            employmentType: cleanText(data.employmentType),
            description: cleanText(data.description),
          };
        }
      } catch (err) {
        // Ignore JSON parse errors for non-matching script tags
      }
    }
    return null;
  }

  /**
   * Main DOM Extraction Engine
   */
  function scanLinkedInJob() {
    const { jobId, canonicalUrl } = extractCanonicalUrl();
    const jsonLdData = extractFromJsonLd() || {};

    // 1. Job Title Selectors
    const titleSelectors = [
      'h1.job-details-jobs-unified-top-card__job-title',
      '.jobs-unified-top-card__job-title',
      'h1.t-24',
      'h2.job-details-jobs-unified-top-card__job-title',
      'h1.top-card-layout__title',
      'h1.topcard__title',
      '.jobs-search__job-details--wrapper h1',
      '.jobs-search-results-list__list-item--active .job-card-list__title',
    ];

    let title = null;
    for (const sel of titleSelectors) {
      const el = document.querySelector(sel);
      if (el && el.innerText.trim()) {
        title = cleanText(el.innerText);
        break;
      }
    }
    if (!title && jsonLdData.title) {
      title = jsonLdData.title;
    }

    // 2. Company Name Selectors
    const companySelectors = [
      '.job-details-jobs-unified-top-card__company-name a',
      '.job-details-jobs-unified-top-card__company-name',
      '.jobs-unified-top-card__company-name a',
      '.jobs-unified-top-card__company-name',
      'a.topcard__org-name-link',
      '.topcard__org-name-link',
      '.top-card-layout__first-subline a',
      '.jobs-search-results-list__list-item--active .job-card-container__primary-description',
      '.jobs-search__job-details--wrapper a[href*="/company/"]',
    ];

    let company = null;
    for (const sel of companySelectors) {
      const el = document.querySelector(sel);
      if (el && el.innerText.trim()) {
        company = cleanText(el.innerText);
        break;
      }
    }
    if (!company && jsonLdData.company) {
      company = jsonLdData.company;
    }

    // 3. Location Selectors
    const locationSelectors = [
      '.job-details-jobs-unified-top-card__primary-description-container span.tvm__text',
      '.jobs-unified-top-card__bullet',
      '.job-details-jobs-unified-top-card__bullet',
      'span.topcard__flavor--bullet',
      '.top-card-layout__first-subline span:last-child',
      '.jobs-search-results-list__list-item--active .job-card-container__metadata-item',
    ];

    let location = null;
    for (const sel of locationSelectors) {
      const el = document.querySelector(sel);
      if (el && el.innerText.trim()) {
        const text = cleanText(el.innerText);
        if (text && !text.includes('·') && !text.includes('ago')) {
          location = text;
          break;
        }
      }
    }
    if (!location && jsonLdData.location) {
      location = jsonLdData.location;
    }

    // 4. Workplace Type (Remote, Hybrid, On-site)
    let workplaceType = null;
    const workplaceEl = document.querySelector(
      '.job-details-jobs-unified-top-card__workplace-type, .ui-label.ui-label--accent-3'
    );
    if (workplaceEl && workplaceEl.innerText.trim()) {
      workplaceType = cleanText(workplaceEl.innerText);
    } else {
      // Check for keywords in top-card text
      const topCard = document.querySelector(
        '.job-details-jobs-unified-top-card, .jobs-unified-top-card'
      );
      if (topCard) {
        const tcText = topCard.innerText;
        if (/hybrid/i.test(tcText)) workplaceType = 'Hybrid';
        else if (/remote/i.test(tcText)) workplaceType = 'Remote';
        else if (/on-site/i.test(tcText)) workplaceType = 'On-site';
      }
    }

    // 5. Employment Type (Full-time, Contract, etc.)
    let employmentType = jsonLdData.employmentType || null;
    if (!employmentType) {
      const insights = document.querySelectorAll(
        '.job-details-jobs-unified-top-card__job-insight, .jobs-unified-top-card__job-insight'
      );
      for (const el of insights) {
        const t = el.innerText;
        if (/Full-time/i.test(t)) {
          employmentType = 'Full-time';
          break;
        } else if (/Part-time/i.test(t)) {
          employmentType = 'Part-time';
          break;
        } else if (/Contract/i.test(t)) {
          employmentType = 'Contract';
          break;
        } else if (/Internship/i.test(t)) {
          employmentType = 'Internship';
          break;
        }
      }
    }

    // 6. Salary (Only if explicitly displayed)
    let salary = jsonLdData.salary || null;
    if (!salary) {
      const insights = document.querySelectorAll(
        '.job-details-jobs-unified-top-card__job-insight, .jobs-unified-top-card__job-insight, .job-details-jobs-unified-top-card__salary'
      );
      for (const el of insights) {
        const t = cleanText(el.innerText);
        if (t && /[$€£₹]\s*[\d,]+|\b(?:yr|hr|salary)\b/i.test(t)) {
          // Verify it's not a generic non-salary text
          salary = t;
          break;
        }
      }
    }

    // 7. Job Description
    const descriptionSelectors = [
      '#job-details',
      '.jobs-description__content',
      '.jobs-description-content__text',
      '.jobs-box__html-content',
      '.show-more-less-html__markup',
    ];

    let description = null;
    for (const sel of descriptionSelectors) {
      const el = document.querySelector(sel);
      if (el && el.innerText.trim()) {
        description = cleanText(el.innerText);
        break;
      }
    }
    if (!description && jsonLdData.description) {
      description = jsonLdData.description;
    }

    // Verification: Must have at least a Job Title or Company to be considered an active job page
    if (!title && !company) {
      return {
        success: false,
        reason: 'NOT_A_JOB_PAGE',
        message:
          'No job details found on this LinkedIn page. Please make sure you are viewing an active job listing.',
      };
    }

    return {
      success: true,
      data: {
        jobId,
        title: title || 'Title Not Specified',
        company: company || 'Company Not Specified',
        location: location || null,
        workplaceType: workplaceType || null,
        employmentType: employmentType || null,
        salary: salary || null,
        description: description || null,
        canonicalUrl,
        extractedAt: new Date().toISOString(),
      },
    };
  }

  // Listen for extraction requests from ReferralRoute popup
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'SCAN_LINKEDIN_JOB') {
      try {
        const result = scanLinkedInJob();
        sendResponse(result);
      } catch (err) {
        sendResponse({
          success: false,
          reason: 'EXTRACTION_ERROR',
          message: `Error inspecting LinkedIn page: ${err.message}`,
        });
      }
    }
    return true; // Keep asynchronous channel open
  });
})();
