export const metadata = { title: "Terms of Service" };

const UPDATED = "30 July 2026";

export default function TermsPage() {
  return (
    <>
      <h1 className="text-2xl font-bold text-ink">Terms of Service</h1>
      <p className="mt-1 text-sm text-muted">Last updated {UPDATED}</p>

      <p className="mt-6 text-sm leading-relaxed text-muted">
        By creating an account you agree to these terms. They are deliberately short.
      </p>

      <Section title="Using Roost">
        <li>You must be able to form a binding contract and provide accurate account details.</li>
        <li>You are responsible for activity under your account and for keeping your password safe.</li>
        <li>
          Don&apos;t use Roost to break the law, upload other people&apos;s data without a right to
          do so, or attempt to access another workspace.
        </li>
      </Section>

      <Section title="Your data is yours">
        <li>You keep ownership of everything you enter and upload.</li>
        <li>
          You grant us only the permission needed to run the service — storing, processing and
          displaying your data back to you and anyone you invite.
        </li>
        <li>You can export or delete your data at any time from Settings.</li>
      </Section>

      <Section title="Not financial or tax advice">
        <li>
          Roost records and summarises figures you provide. Tax-deductibility flags, AI suggestions
          and reports are <strong>informational only</strong>.
        </li>
        <li>
          Always confirm treatment with a registered tax agent or accountant before lodging. We are
          not licensed advisers.
        </li>
        <li>
          AI features can make mistakes. Check extracted receipt values and assistant answers before
          relying on them.
        </li>
      </Section>

      <Section title="Availability and liability">
        <li>
          The service is provided &ldquo;as is&rdquo;. We aim for reliability but do not guarantee
          uninterrupted access.
        </li>
        <li>
          To the extent permitted by law, we are not liable for indirect or consequential loss,
          including lost profits or tax penalties.
        </li>
        <li>
          Keep your own copies of critical records. The CSV export exists for exactly this.
        </li>
      </Section>

      <Section title="Changes and ending your account">
        <li>We may update these terms; material changes will be noted by the date above.</li>
        <li>You can stop using Roost and delete your data at any time.</li>
        <li>We may suspend accounts that abuse the service or put other users at risk.</li>
      </Section>

      <Section title="Governing law">
        <li>These terms are governed by the laws of Victoria, Australia.</li>
      </Section>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-7">
      <h2 className="text-base font-semibold text-ink">{title}</h2>
      <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-muted">
        {children}
      </ul>
    </section>
  );
}
