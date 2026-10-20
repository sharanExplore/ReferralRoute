# Privacy Policy for ReferralRoute

**Last updated:** October 20, 2026

ReferralRoute ("we", "our", or "the extension") is a browser extension designed to help job seekers capture LinkedIn job postings, track applications, and organize referral outreach. We believe in privacy by design: ReferralRoute operates **entirely offline and client-side within your browser**.

This Privacy Policy explains what information ReferralRoute reads, how it is stored, and your rights and controls over that data.

---

## 1. Information ReferralRoute Reads

When you navigate to a LinkedIn job page and open the extension popup (or click "Scan"), ReferralRoute inspects the active webpage DOM exclusively within `linkedin.com` to extract publicly visible job posting details:

- **Job Identifier & Canonical URL:** The unique LinkedIn job ID and canonical URL (e.g., `https://www.linkedin.com/jobs/view/...`).
- **Job Title:** The title of the active job posting.
- **Company Name:** The name of the hiring organization.
- **Location & Workplace Type:** The listed job location and workplace arrangement (e.g., Remote, Hybrid, On-site).
- **Employment Type:** Job classification (e.g., Full-time, Contract, Internship), if specified on the page.
- **Salary Information:** Explicit compensation figures, only if publicly displayed on the listing.
- **Job Description Snippet:** Text content of the job listing description.

### What ReferralRoute Does NOT Read or Access:
- **No Personal Profile Data:** ReferralRoute does not access your personal LinkedIn profile, your private messages, your network connections list, or your search history.
- **No Credentials:** ReferralRoute never accesses, requests, or stores your passwords, cookies, session tokens, or authentication credentials.
- **No Other Websites:** ReferralRoute’s host permissions and content scripts are strictly restricted to `*://*.linkedin.com/*`. It cannot read or access pages on any other website.

---

## 2. Information ReferralRoute Stores

When you click **"Save Job to Route"**, ReferralRoute saves the job record locally on your computer using the browser's local extension storage API (`chrome.storage.local`). The stored record contains:

- `id`: Job identifier or local timestamp.
- `title`: Job title.
- `company`: Company name.
- `location`: Job location.
- `workplaceType`: Workplace type.
- `employmentType`: Employment type.
- `salary`: Salary snippet (if present).
- `canonicalUrl`: Direct link to the listing.
- `savedAt`: ISO timestamp of when you saved the job.
- `status`: Application pipeline status (e.g., "Saved").

---

## 3. Data Transmission & External Servers

- **Zero External Server Transmission:** ReferralRoute does **NOT** transmit any of your job data, browsing activity, or device information to external servers or developer servers.
- **No Third-Party Analytics:** We do not use Google Analytics, Mixpanel, telemetry SDKs, error tracking services, or any third-party tracking scripts.
- **No Remote Code Execution:** The extension contains zero dynamically fetched scripts, eval routines, or remote dependencies. All code and assets run locally from the installed extension package.

---

## 4. External Links Opened by the User

ReferralRoute provides convenience action buttons that open standard web pages in a new browser tab upon your explicit click:
- **"Search 1st & 2nd Connections on LinkedIn":** Opens a standard LinkedIn People Search query in a new browser tab using the target company's name.
- **"View Job ↗":** Opens the canonical LinkedIn job posting in a new browser tab.

These links are handled directly by your browser according to LinkedIn's own privacy policy and terms of service.

---

## 5. How You Can Delete Your Data

You have complete control over all data stored by ReferralRoute:

1. **Delete Individual Jobs:** In the extension popup, go to the **Pipeline** tab and click the **✕** button on any job card to immediately and permanently remove it from `chrome.storage.local`. Alternatively, on the **Capture** tab, click **"Saved to Pipeline (Click to Remove)"**.
2. **Clear All Data:** You can wipe all stored extension data at any time through your browser's extension settings:
   - **Microsoft Edge:** Go to `edge://extensions` > click **Details** under ReferralRoute > click **Extension options** / clear site data.
   - **Google Chrome:** Go to `chrome://extensions` > click **Details** under ReferralRoute > clear data.
3. **Uninstalling the Extension:** Removing ReferralRoute from your browser permanently deletes all data stored in `chrome.storage.local`.

---

## 6. Permissions Justification

ReferralRoute requests only the minimum permissions necessary for its stated single purpose:

| Permission | Technical Name | Purpose |
| :--- | :--- | :--- |
| **Storage** | `storage` | To persist your saved job listings locally on your device via `chrome.storage.local`. |
| **Active Tab** | `activeTab` | To interact with the current LinkedIn tab when you open the popup. |
| **Scripting** | `scripting` | To dynamically inject the DOM reader content script into an active LinkedIn tab if opened before the extension was installed or reloaded. |
| **Host Permissions** | `*://*.linkedin.com/*` | Restricts content script execution and DOM inspection strictly to LinkedIn job pages. |

---

## 7. Changes to This Policy

If we update ReferralRoute or add new features in future versions that affect data handling, we will update this Privacy Policy accordingly and reflect the revised date at the top of this document.

---

## 8. Contact & Developer Information

If you have questions, feedback, or concerns regarding this Privacy Policy or ReferralRoute, please contact:

- **Developer / Maintainer:** ReferralRoute Open Source Project
- **Support Email:** `[YOUR_SUPPORT_EMAIL@example.com]` *(Please update with your official contact email before store submission)*
- **GitHub Repository & Issue Tracker:** [https://github.com/sharanExplore/ReferralRoute/issues](https://github.com/sharanExplore/ReferralRoute/issues)
