function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-8 text-lg font-semibold text-foreground first:mt-0">{children}</h2>;
}

function BodyP({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">{children}</p>;
}

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-3 rounded-lg border border-border/50 bg-card/80 px-4 py-3">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <div className="mt-2 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </div>
  );
}

function WhyItem({ title, body }: { title: string; body: string }) {
  return (
    <li className="rounded-xl border border-border/70 bg-card px-4 py-3">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{body}</p>
    </li>
  );
}

export function DiscoverArticleContent({ slug }: { slug: string }) {
  if (slug === "welcome") {
    return (
      <div className="prose-handbook max-w-none">
        <BodyP>
          Support Hub helps our team stay organised, track performance, maintain accurate documentation and follow up on
          important work.
        </BodyP>
        <BodyP>
          Customer conversations happen in Freshdesk. Support Hub is where we manage the internal work that supports those
          conversations.
        </BodyP>
        <H2>Why we use Support Hub</H2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          <WhyItem title="Stay organised" body="See your assigned tasks, important updates and work that needs attention." />
          <WhyItem title="Track performance" body="Review KPI results, QA evaluations and coaching feedback." />
          <WhyItem
            title="Keep information accurate"
            body="Manage documentation, integration instructions and operational issues."
          />
          <WhyItem
            title="Work together"
            body="Share feedback, follow up on responsibilities and keep everyone informed."
          />
        </ul>
        <H2>Who uses Support Hub?</H2>
        <BodyP>
          Support Hub is used by Agents, Senior Agents, Supervisors, Tech Agents and Admins.
        </BodyP>
        <BodyP>
          Each role has different responsibilities. Your handbook shows you what matters for your role, while Workflow
          Guides explain how processes work across the team.
        </BodyP>
      </div>
    );
  }

  if (slug === "getting-around") {
    return (
      <div className="prose-handbook max-w-none space-y-1">
        <H2>Signing in</H2>
        <InfoCard title="Signing in">
          <ul className="list-disc space-y-1.5 pl-4">
            <li>Use your approved account to sign in to Support Hub.</li>
            <li>Sign in with Google when available, or your account password.</li>
            <li>New team members need an Admin-created account before they can sign in.</li>
          </ul>
        </InfoCard>

        <H2>Your Dashboard</H2>
        <InfoCard title="Your Dashboard">
          <p>
            Start each shift on the Dashboard for assigned work, pending acknowledgements, attention items, and important
            updates. Some follow-up still lives in its module tracker—open the relevant module when a task points you
            there.
          </p>
        </InfoCard>

        <H2>Staying informed</H2>
        <InfoCard title="Staying informed">
          <p>
            Support Updates share operational and product changes. Read what applies to you and acknowledge updates when
            the Hub requires it, including materially revised announcements.
          </p>
        </InfoCard>
      </div>
    );
  }

  return null;
}

export function discoverArticleSubtitle(slug: string): string {
  const map: Record<string, string> = {
    welcome: "Your workspace for everything happening behind the scenes in KoinX Support.",
    "getting-around": "Learn how to access Support Hub, find your work and stay updated.",
  };
  return map[slug] ?? "";
}
