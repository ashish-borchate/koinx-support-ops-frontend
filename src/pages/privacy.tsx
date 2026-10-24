import { Link } from "react-router-dom";

export function PrivacyPolicyPage() {
  return (
    <div className="min-h-svh bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-6 py-4">
          <div>
            <p className="text-sm font-semibold text-primary">KoinX</p>
            <p className="text-sm text-muted-foreground">Support Operations</p>
          </div>
          <Link to="/login" className="text-sm font-medium text-primary hover:underline">Sign in</Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-10 text-foreground">
        <h1 className="text-3xl font-semibold tracking-tight">Privacy Policy</h1>
        <p className="mt-1 text-lg font-medium text-foreground/90">KoinX Support Operations</p>
        <p className="mt-2 text-sm text-muted-foreground">Last Updated: October 24, 2026</p>

        <section className="mt-10 space-y-8 text-sm leading-7 text-foreground/90">
          <div>
            <h2 className="text-base font-semibold text-foreground">1. Introduction</h2>
            <p className="mt-2">
              KoinX Support Operations is an internal platform designed to help authorized KoinX employees and contractors manage support
              activities, performance metrics, quality assurance, and operational workflows.
            </p>
            <p className="mt-2">
              This Privacy Policy explains how information is collected, used, and protected when accessing the platform.
            </p>
          </div>

          <div>
            <h2 className="text-base font-semibold text-foreground">2. Information We Collect</h2>
            <p className="mt-2">When you sign in using your Google account, we may collect:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Your name and email address.</li>
              <li>Your Google account&apos;s unique identifier.</li>
              <li>Basic profile information provided through Google Sign-In.</li>
              <li>Your assigned role and access permissions.</li>
              <li>
                Information related to your activity within the platform, including assigned tasks, support operations, and performance
                records.
              </li>
            </ul>
            <p className="mt-2">
              We do not access your Gmail messages, Google Drive files, contacts, or Google account password through Google Sign-In.
            </p>
          </div>

          <div>
            <h2 className="text-base font-semibold text-foreground">3. How We Use Your Information</h2>
            <p className="mt-2">We use this information to:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Authenticate your identity through Google Sign-In.</li>
              <li>Verify that you are an authorized employee or contractor.</li>
              <li>Assign appropriate access permissions.</li>
              <li>Manage internal support operations and employee workflows.</li>
              <li>Maintain platform security and prevent unauthorized access.</li>
            </ul>
            <p className="mt-2">We do not sell personal information or use Google Sign-In information for advertising.</p>
          </div>

          <div>
            <h2 className="text-base font-semibold text-foreground">4. Access and Data Sharing</h2>
            <p className="mt-2">
              Access to KoinX Support Operations is restricted to approved employees, contractors, and authorized administrators.
            </p>
            <p className="mt-2">
              Information may be processed through trusted service providers supporting authentication, hosting, and database infrastructure.
            </p>
            <p className="mt-2">Access to internal information is controlled through role-based permissions.</p>
          </div>

          <div>
            <h2 className="text-base font-semibold text-foreground">5. Data Storage and Security</h2>
            <p className="mt-2">
              We use reasonable technical and organizational measures to protect information, including authentication controls, encrypted
              connections, and restricted access permissions.
            </p>
            <p className="mt-2">No online system can guarantee absolute security.</p>
          </div>

          <div>
            <h2 className="text-base font-semibold text-foreground">6. Data Retention and Deletion</h2>
            <p className="mt-2">
              Information is retained for as long as reasonably necessary for internal operations, security, and applicable business or legal
              requirements.
            </p>
            <p className="mt-2">
              Authorized administrators may disable accounts and manage employee records. Requests for access, correction, or deletion of
              personal information can be directed to the contact below, subject to applicable retention requirements.
            </p>
          </div>

          <div>
            <h2 className="text-base font-semibold text-foreground">7. Third-Party Authentication</h2>
            <p className="mt-2">The platform uses Google Sign-In for authentication.</p>
            <p className="mt-2">
              Google processes authentication information according to its own privacy policies. Our platform receives only the information
              necessary to identify and authenticate users.
            </p>
          </div>

          <div>
            <h2 className="text-base font-semibold text-foreground">8. Changes to This Policy</h2>
            <p className="mt-2">
              We may update this Privacy Policy when platform features, security practices, or operational requirements change.
            </p>
            <p className="mt-2">The latest version will be available on this page.</p>
          </div>

          <div>
            <h2 className="text-base font-semibold text-foreground">9. Contact</h2>
            <p className="mt-2">For privacy-related questions or requests, contact:</p>
            <p className="mt-2 font-medium text-foreground">KoinX Support Operations</p>
            <p>
              Email:{" "}
              <a href="mailto:ashish.borchate@koinx.com" className="text-primary hover:underline">ashish.borchate@koinx.com</a>
            </p>
          </div>
        </section>
      </main>
      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        <Link to="/login" className="text-primary hover:underline">Back to sign in</Link>
      </footer>
    </div>
  );
}
