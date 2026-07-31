export const metadata = { title: "Privacy Policy" };

const UPDATED = "30 July 2026";

export default function PrivacyPage() {
  return (
    <>
      <h1 className="text-2xl font-bold text-ink">Privacy Policy</h1>
      <p className="mt-1 text-sm text-muted">Last updated {UPDATED}</p>

      <p className="mt-6 text-sm leading-relaxed text-muted">
        Roost helps property owners track income, expenses and documents. This policy explains what
        we collect, why, and the choices you have. It is written to be read, not to be survived.
      </p>

      <Section title="What we collect">
        <li>
          <strong>Account details</strong> — your email address and the name you choose to display.
        </li>
        <li>
          <strong>Portfolio data you enter</strong> — properties, tenants, leases, rent, expenses,
          mortgages and any notes.
        </li>
        <li>
          <strong>Documents you upload</strong> — receipts and invoices, stored privately.
        </li>
        <li>
          <strong>Technical logs</strong> — error and request logs used to keep the service working.
          These record identifiers and messages, never your passwords or document contents.
        </li>
      </Section>

      <Section title="How we use it">
        <li>To run the product: showing your portfolio, calculating totals and generating reports.</li>
        <li>
          To read receipts you upload. The image is sent to Google&apos;s Gemini API solely to
          extract the vendor, date, amount and GST, and to answer questions you ask the assistant.
        </li>
        <li>To secure accounts, prevent abuse, and diagnose faults.</li>
      </Section>

      <Section title="Who can see your data">
        <li>
          <strong>Only you</strong>, plus anyone you explicitly invite to your workspace. Access is
          enforced at the database level, not just in the interface.
        </li>
        <li>
          <strong>Service providers</strong> that operate the product: Supabase (database, auth and
          file storage), Vercel (hosting) and Google (AI features). They process data on our
          instructions.
        </li>
        <li>
          We do <strong>not</strong> sell your data or use it for advertising.
        </li>
      </Section>

      <Section title="Your choices">
        <li>
          <strong>Export</strong> everything as CSV at any time from Settings.
        </li>
        <li>
          <strong>Delete</strong> your portfolio data from Settings, or ask us to delete your account
          entirely.
        </li>
        <li>
          <strong>Correct</strong> anything by editing it directly.
        </li>
      </Section>

      <Section title="Retention and security">
        <li>Your data is kept while your account is open, and removed when you delete it.</li>
        <li>
          Data is encrypted in transit. Documents live in a private bucket that only your workspace
          can read.
        </li>
        <li>
          No system is perfectly secure. If a breach affects you, we will tell you promptly.
        </li>
      </Section>

      <Section title="Contact">
        <li>
          Questions or requests about your data: contact the account owner who operates this
          deployment of Roost.
        </li>
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
