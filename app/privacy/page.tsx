import LegalPage from '@/components/legal/LegalPage'

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" effectiveDate="May 2026">
      <h2 className="text-lg font-bold text-gray-900 mt-4 mb-2">Introduction</h2>
      <p>
        Accountabilibuddies (&quot;we&quot;, &quot;us&quot;) operates the Accountabilibuddies
        application. This policy explains what data we collect, why, and how we use it.
      </p>

      <h2 className="text-lg font-bold text-gray-900 mt-6 mb-2">Information we collect</h2>
      <p>
        When you sign up we collect your name, email address, and a password (stored hashed
        by our authentication provider, Supabase). While using the app we store the goals,
        check-ins, daily messages, and reactions you create, plus your buddy pairings.
      </p>

      <h2 className="text-lg font-bold text-gray-900 mt-6 mb-2">How we use your information</h2>
      <p>
        We use your data to provide the service: showing your dashboard, sharing check-ins
        with your buddy, sending notification pushes, and computing your stats. We do not
        sell your data and do not share it with third parties except service providers
        strictly necessary to operate the app (Supabase for storage, Resend for email,
        Vercel for hosting, Google FCM for push delivery on Android).
      </p>

      <h2 className="text-lg font-bold text-gray-900 mt-6 mb-2">Your rights</h2>
      <p>
        You can edit your name, change your password, and permanently delete your account
        from the Settings screen. Deleting your account removes your profile, all your
        challenges, goals, check-ins, and notification subscriptions.
      </p>

      <h2 className="text-lg font-bold text-gray-900 mt-6 mb-2">Contact</h2>
      <p>
        Questions about this policy or your data? Email{' '}
        <a className="text-teal-600" href="mailto:help@accountabilibuddies.app">help@accountabilibuddies.app</a>.
      </p>
    </LegalPage>
  )
}
