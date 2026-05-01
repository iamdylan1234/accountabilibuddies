import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

interface WeeklyEmailData {
  toEmail: string
  toName: string
  buddyName: string
  myScore: number
  buddyScore: number
  weekStart: string
  weekEnd: string
  challengeName: string
}

export async function sendWeeklyWrapUp(data: WeeklyEmailData) {
  const { toEmail, toName, buddyName, myScore, buddyScore, weekStart, weekEnd, challengeName } = data

  await resend.emails.send({
    from: 'Accountabilibuddies <onboarding@resend.dev>',
    to: toEmail,
    subject: `${challengeName} — Week in Review`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h1 style="font-size:24px;font-weight:900;color:#0077B6">Week in Review 🎯</h1>
        <p style="color:#666">Hi ${toName}, here's how you and ${buddyName} did this week.</p>
        <div style="display:flex;gap:16px;margin:24px 0">
          <div style="flex:1;background:#E8FBF7;border-radius:12px;padding:16px;text-align:center">
            <p style="font-size:12px;color:#666;margin:0">You</p>
            <p style="font-size:36px;font-weight:900;color:#0077B6;margin:4px 0">${myScore}%</p>
          </div>
          <div style="flex:1;background:#f5f5f5;border-radius:12px;padding:16px;text-align:center">
            <p style="font-size:12px;color:#666;margin:0">${buddyName}</p>
            <p style="font-size:36px;font-weight:900;color:#0077B6;margin:4px 0">${buddyScore}%</p>
          </div>
        </div>
        <p style="color:#666;font-size:14px">
          ${myScore > buddyScore ? "You're ahead this week! Keep it up 💪" :
            myScore < buddyScore ? `${buddyName} is ahead — time to catch up! 🔥` :
            "You're neck and neck! 🤝"}
        </p>
        <a href="${process.env.NEXT_PUBLIC_APP_URL}/wrap-up"
          style="display:block;background:linear-gradient(135deg,#00C9A7,#0077B6);color:white;text-align:center;padding:12px;border-radius:12px;font-weight:700;text-decoration:none;margin-top:24px">
          View full summary →
        </a>
      </div>
    `,
  })
}

interface MonthlyEmailData {
  toEmail: string
  toName: string
  buddyName: string
  myScore: number
  buddyScore: number
  challengeName: string
  won: boolean
  tied: boolean
}

export async function sendMonthlyWrapUp(data: MonthlyEmailData) {
  const { toEmail, toName, buddyName, myScore, buddyScore, challengeName, won, tied } = data

  await resend.emails.send({
    from: 'Accountabilibuddies <onboarding@resend.dev>',
    to: toEmail,
    subject: `${challengeName} — Final Results 🏆`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h1 style="font-size:24px;font-weight:900;color:#0077B6">Challenge Complete! 🎉</h1>
        <p style="color:#666">The ${challengeName} is over. Here are the final results.</p>
        <div style="display:flex;gap:16px;margin:24px 0">
          <div style="flex:1;background:${won || tied ? '#fffde7' : '#f5f5f5'};border:2px solid ${won ? '#F9F871' : '#e5e7eb'};border-radius:12px;padding:16px;text-align:center">
            ${won ? '<p style="font-size:11px;font-weight:900;color:#d97706;margin:0">🏆 WINNER</p>' : ''}
            <p style="font-size:12px;color:#666;margin:0">You</p>
            <p style="font-size:36px;font-weight:900;color:#0077B6;margin:4px 0">${myScore}%</p>
          </div>
          <div style="flex:1;background:${!won && !tied ? '#fffde7' : '#f5f5f5'};border:2px solid ${!won && !tied ? '#F9F871' : '#e5e7eb'};border-radius:12px;padding:16px;text-align:center">
            ${!won && !tied ? '<p style="font-size:11px;font-weight:900;color:#d97706;margin:0">🏆 WINNER</p>' : ''}
            <p style="font-size:12px;color:#666;margin:0">${buddyName}</p>
            <p style="font-size:36px;font-weight:900;color:#0077B6;margin:4px 0">${buddyScore}%</p>
          </div>
        </div>
        ${tied ? '<p style="text-align:center;color:#666">It\'s a tie! Great work both of you 🤝</p>' : ''}
        <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard"
          style="display:block;background:linear-gradient(135deg,#00C9A7,#0077B6);color:white;text-align:center;padding:12px;border-radius:12px;font-weight:700;text-decoration:none;margin-top:24px">
          Start a new challenge →
        </a>
      </div>
    `,
  })
}
