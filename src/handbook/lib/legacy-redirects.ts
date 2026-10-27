/** Old M2 handbook URLs → M3 learning paths */
export const SHARED_SLUG_REDIRECTS: Record<string, string> = {
  "what-is-support-hub": "/handbook/discover/welcome",
  "hub-vs-freshdesk": "/handbook/discover/welcome",
  "getting-started-google-sign-in": "/handbook/discover/getting-around",
  "navigation-and-interface": "/handbook/discover/getting-around",
  "understanding-the-dashboard": "/handbook/discover/getting-around",
  "attention-notifications-and-tasks": "/handbook/discover/getting-around",
  "module-overview": "/handbook/discover/welcome",
  "kpi-and-qa-concepts": "/handbook/workflows/qa-evaluations-and-appeals",
  "documentation-and-trackers": "/handbook/workflows",
  "roles-and-permissions": "/handbook/search?q=glossary",
  "reported-issues-and-support-updates": "/handbook/workflows/reported-issues",
  "daily-operational-practices": "/handbook/role",
  "terminology-glossary": "/handbook/search?q=glossary",
  "troubleshooting-and-faqs": "/handbook/search?q=troubleshooting",
};

/** Removed or renamed Discover chapter URLs → current intro pages */
export const DISCOVER_SLUG_REDIRECTS: Record<string, string> = {
  "modules-at-a-glance": "/handbook/discover/welcome",
};

export const PLAYBOOK_ROLE_REDIRECTS: Record<string, string> = {
  agent: "/handbook/role/agent",
  senior_agent: "/handbook/role/senior-agent",
  supervisor: "/handbook/role/supervisor",
  tech_agent: "/handbook/role/tech-agent",
  admin: "/handbook/role/admin",
};
