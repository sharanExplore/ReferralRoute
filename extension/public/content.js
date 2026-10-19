// ReferralRoute Content Script - LinkedIn Job Detector (Manifest V3)
// Prioritizes the active job details panel with resilient fallbacks and zero fabricated data.

(function () {
  // Safe listener lifecycle:
  // Remove any previously attached listener in this window (prevents duplicates),
  // while ensuring newly injected scripts always register a fresh listener.
  if (typeof window !== 'undefined' && window.__REFERRAL_ROUTE_MESSAGE_LISTENER__) {
    try {
      chrome.runtime.onMessage.removeListener(window.__REFERRAL_ROUTE_MESSAGE_LISTENER__);
    } catch (e) {
      // Ignored if previous runtime context was invalidated by extension reload
    }
  }

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
   * Locates the active job details container on split-view search or single-view pages.
   */
  function getActiveJobDetailsContainer() {
    const containerSelectors = [
      '.scaffold-layout__detail',
      '[data-view-name="job-details"]',
      '.jobs-search__job-details--container',
      '.jobs-details__main-content',
      '.jobs-search__job-details',
      '.job-view-layout',
      'main.scaffold-layout__main',
      'main',
    ];

    for (const sel of containerSelectors) {
      const el = document.querySelector(sel);
      if (el && el.innerText && el.innerText.trim().length > 30) {
        return el;
      }
    }
    return document;
  }

  /**
   * Extracts clean canonical LinkedIn job ID and URL
   */
  function extractCanonicalUrl(detailPane) {
    const href = window.location.href;

    // 1. Direct job URL format: /jobs/view/1234567890/
    const directMatch = href.match(/\/jobs\/view\/(\d+)/i);
    if (directMatch && directMatch[1]) {
      return {
        jobId: directMatch[1],
        canonicalUrl: `https://www.linkedin.com/jobs/view/${directMatch[1]}/`,
      };
    }

    // 2. Search or collections URL with ?currentJobId=1234567890
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

    // 3. Anchor link inside the active details pane pointing to /jobs/view/<id>
    if (detailPane && detailPane.querySelector) {
      const viewLink = detailPane.querySelector('a[href*="/jobs/view/"]');
      if (viewLink && viewLink.href) {
        const match = viewLink.href.match(/\/jobs\/view\/(\d+)/i);
        if (match && match[1]) {
          return {
            jobId: match[1],
            canonicalUrl: `https://www.linkedin.com/jobs/view/${match[1]}/`,
          };
        }
      }
    }

    // 4. Check active job card attribute in search DOM
    const activeItem = document.querySelector(
      '.jobs-search-results-list__list-item--active[data-occludable-job-id], .jobs-search-results-list__list-item--active [data-job-id], [data-job-id].active, .jobs-search-results-list__list-item--active'
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

    // 5. Clean base URL fallback without tracking queries
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
   * Prioritizes the active selected job-details panel.
   */
  function scanLinkedInJob() {
    const detailPane = getActiveJobDetailsContainer();
    const { jobId, canonicalUrl } = extractCanonicalUrl(detailPane);
    const jsonLdData = extractFromJsonLd() || {};

    // 1. Job Title Selectors (Scoped to detail pane first)
    const titleSelectors = [
      'h1.job-details-jobs-unified-top-card__job-title',
      'h2.job-details-jobs-unified-top-card__job-title',
      '.job-details-jobs-unified-top-card__job-title a',
      '.job-details-jobs-unified-top-card__job-title',
      'h1.t-24',
      'h2.t-24',
      '.t-24.t-bold',
      'h1.t-bold',
      'h2.t-bold',
      '.jobs-unified-top-card__job-title',
      'h1.top-card-layout__title',
      'h1.topcard__title',
    ];

    let title = null;
    // Query scoped inside the selected job details panel first
    if (detailPane && detailPane.querySelector) {
      for (const sel of titleSelectors) {
        const el = detailPane.querySelector(sel);
        if (el && el.innerText && el.innerText.trim().length > 1) {
          title = cleanText(el.innerText);
          break;
        }
      }

      // Fallback inside detailPane: any h1/h2 that isn't visually hidden
      if (!title) {
        const heading = detailPane.querySelector(
          'h1:not(.visually-hidden):not([aria-hidden="true"]), h2:not(.visually-hidden):not([aria-hidden="true"])'
        );
        if (heading && heading.innerText && heading.innerText.trim().length > 2) {
          title = cleanText(heading.innerText);
        }
      }
    }

    // Document-level fallback if not found in detailPane
    if (!title) {
      for (const sel of titleSelectors) {
        const el = document.querySelector(sel);
        if (el && el.innerText && el.innerText.trim().length > 1) {
          title = cleanText(el.innerText);
          break;
        }
      }
    }
    if (!title && jsonLdData.title) {
      title = jsonLdData.title;
    }

    // 2. Company Name Selectors (Scoped to detail pane first)
    const companySelectors = [
      'a[href*="/company/"]', // LinkedIn universal company profile link
      '.job-details-jobs-unified-top-card__company-name a',
      '.job-details-jobs-unified-top-card__company-name',
      '.jobs-unified-top-card__company-name a',
      '.jobs-unified-top-card__company-name',
      '[class*="company-name"] a',
      '[class*="company-name"]',
      'a[data-tracking-control-name*="org-name"]',
      'a[data-tracking-control-name*="company_name"]',
      'a.topcard__org-name-link',
      '.topcard__org-name-link',
      '.top-card-layout__first-subline a',
    ];

    let company = null;
    if (detailPane && detailPane.querySelector) {
      for (const sel of companySelectors) {
        const el = detailPane.querySelector(sel);
        if (el && el.innerText && el.innerText.trim().length > 0) {
          company = cleanText(el.innerText);
          break;
        }
      }
    }

    if (!company) {
      for (const sel of companySelectors) {
        const el = document.querySelector(sel);
        if (el && el.innerText && el.innerText.trim().length > 0) {
          company = cleanText(el.innerText);
          break;
        }
      }
    }
    if (!company && jsonLdData.company) {
      company = jsonLdData.company;
    }

    // Broad fallback: only use active search list item if both title and company are from that same item
    if (!title || !company) {
      const activeCard = document.querySelector(
        '.jobs-search-results-list__list-item--active, [data-job-id].active'
      );
      if (activeCard) {
        const cardTitleEl = activeCard.querySelector(
          '[class*="job-card-list__title"], .job-card-list__title, a[class*="job-card"]'
        );
        const cardCompanyEl = activeCard.querySelector(
          '[class*="primary-description"], .job-card-container__primary-description'
        );
        if (cardTitleEl && cardCompanyEl) {
          if (!title) title = cleanText(cardTitleEl.innerText);
          if (!company) company = cleanText(cardCompanyEl.innerText);
        }
      }
    }

    // 3. Location Selectors (Scoped to detail pane first)
    const locationSelectors = [
      '.job-details-jobs-unified-top-card__primary-description-container span.tvm__text',
      '.job-details-jobs-unified-top-card__primary-description-container',
      '[class*="primary-description-container"]',
      '.jobs-unified-top-card__bullet',
      '.job-details-jobs-unified-top-card__bullet',
      'span.topcard__flavor--bullet',
      '.top-card-layout__first-subline span:last-child',
    ];

    let location = null;
    const searchScope = detailPane || document;
    for (const sel of locationSelectors) {
      const el = searchScope.querySelector(sel);
      if (el && el.innerText && el.innerText.trim()) {
        const raw = cleanText(el.innerText);
        if (raw) {
          // If the string contains bullet points (e.g. "India (Remote) · 1 week ago · 40 applicants"), take the location segment
          const segments = raw.split(/[·•]/);
          const candidate = segments.find(
            (seg) =>
              seg.trim().length > 1 &&
              !/\b(ago|reposted|applicants?|easy apply|promoted)\b/i.test(seg)
          );
          if (candidate) {
            location = cleanText(candidate);
            break;
          }
        }
      }
    }
    if (!location && jsonLdData.location) {
      location = jsonLdData.location;
    }

    // 4. Workplace Type (Remote, Hybrid, On-site)
    let workplaceType = null;
    const workplaceEl = searchScope.querySelector(
      '.job-details-jobs-unified-top-card__workplace-type, [class*="workplace-type"], .ui-label.ui-label--accent-3'
    );
    if (workplaceEl && workplaceEl.innerText.trim()) {
      workplaceType = cleanText(workplaceEl.innerText);
    } else {
      // Check for keywords in the location or top-card description text
      const tcText = searchScope.innerText || '';
      if (/\bhybrid\b/i.test(location || tcText)) workplaceType = 'Hybrid';
      else if (/\bremote\b/i.test(location || tcText)) workplaceType = 'Remote';
      else if (/\bon-site\b/i.test(location || tcText)) workplaceType = 'On-site';
    }

    // 5. Employment Type (Full-time, Contract, etc.)
    let employmentType = jsonLdData.employmentType || null;
    if (!employmentType) {
      const insights = searchScope.querySelectorAll(
        '.job-details-jobs-unified-top-card__job-insight, [class*="job-insight"], [class*="preference-item"]'
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
        } else if (/Temporary/i.test(t)) {
          employmentType = 'Temporary';
          break;
        }
      }
    }

    // 6. Salary (Only if explicitly displayed on the page)
    let salary = jsonLdData.salary || null;
    if (!salary) {
      const insights = searchScope.querySelectorAll(
        '.job-details-jobs-unified-top-card__job-insight, [class*="job-insight"], [class*="salary"]'
      );
      for (const el of insights) {
        const t = cleanText(el.innerText);
        if (t && /[$€£₹]\s*[\d,]+|\b(?:yr|hr|salary)\b/i.test(t)) {
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
      '[class*="description-content"]',
      '.jobs-box__html-content',
      '.show-more-less-html__markup',
      'article',
    ];

    let description = null;
    for (const sel of descriptionSelectors) {
      const el = searchScope.querySelector(sel);
      if (el && el.innerText && el.innerText.trim().length > 10) {
        description = cleanText(el.innerText);
        break;
      }
    }
    if (!description && jsonLdData.description) {
      description = jsonLdData.description;
    }

    // Strict validation: Must have at least a Job Title or Company to be considered an active job page
    if (!title && !company) {
      return {
        success: false,
        reason: 'NOT_A_JOB_PAGE',
        message:
          'No job details found on this LinkedIn page. Please make sure a job listing is active or selected.',
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

  // Register safe message handler
  const messageHandler = (request, sender, sendResponse) => {
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
  };

  if (typeof window !== 'undefined') {
    window.__REFERRAL_ROUTE_MESSAGE_LISTENER__ = messageHandler;
  }
  chrome.runtime.onMessage.addListener(messageHandler);
})();
