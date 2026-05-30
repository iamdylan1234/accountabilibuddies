import LegalPage from '@/components/legal/LegalPage'

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" effectiveDate="May 2026">
      <h2 className="text-lg font-bold text-gray-900 mt-4 mb-2">Acceptance</h2>
      <p>
        By using Accountabilibuddies you agree to these terms. If you do not agree,
        do not use the service.
      </p>

      <h2 className="text-lg font-bold text-gray-900 mt-6 mb-2">Use of the service</h2>
      <p>
        Accountabilibuddies is a habit-accountability app where you pair with one buddy,
        set monthly goals, and check in daily. You are responsible for keeping your
        account credentials secure and for the content of the goals and messages you
        create. Do not use the service to harass, threaten, or deceive your buddy.
      </p>

      <h2 className="text-lg font-bold text-gray-900 mt-6 mb-2">Account termination</h2>
      <p>
        You may delete your account at any time from the Settings screen. We may suspend
        or terminate accounts that violate these terms.
      </p>

      <h2 className="text-lg font-bold text-gray-900 mt-6 mb-2">Disclaimer of warranties</h2>
      <p>
        The service is provided &quot;as is&quot; without warranty of any kind. We do
        not guarantee that the service will be uninterrupted, error-free, or that any
        habit will improve as a result of using it.
      </p>

      <h2 className="text-lg font-bold text-gray-900 mt-6 mb-2">Changes to these terms</h2>
      <p>
        We may update these terms from time to time. The effective date above will be
        updated when we do. Continued use after a change constitutes acceptance.
      </p>

      <h2 className="text-lg font-bold text-gray-900 mt-6 mb-2">Contact</h2>
      <p>
        Questions about these terms? Email{' '}
        <a className="text-teal-600" href="mailto:help@accountabilibuddies.app">help@accountabilibuddies.app</a>.
      </p>
    </LegalPage>
  )
}
