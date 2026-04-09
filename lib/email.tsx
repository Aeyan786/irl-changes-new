import { Resend } from "resend"

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null

const FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL || "Infinite Running League <no-reply@saatish.com>"

const RED = "#CC0000"
const RED_DARK = "#aa0000"
const TEXT_PRIMARY = "#111827"
const TEXT_SECONDARY = "#6b7280"
const LOGO_URL = "https://infiniterunningleague.com/wp-content/uploads/2024/10/idl-small-black-red-e1769808366237.png"


function getSiteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
}

function getEmailTemplate({
  title,
  preheader,
  content,
  ctaText,
  ctaLink,
}: {
  title: string
  preheader: string
  content: string
  ctaText?: string
  ctaLink?: string
}) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f1f1;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Oxygen,Ubuntu,sans-serif;
">
  <!-- preheader -->
  <span style="display:none;font-size:1px;color:#f1f1f1;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${preheader}</span>

  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f1f1;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;">

          <!-- HEADER -->
          <tr>
            <td style="background-color:${RED};border-radius:12px 12px 0 0;padding:24px 36px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align:middle;">
                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="vertical-align:middle;">
                          <div style="background-color:#ffffff;border-radius:8px;width:42px;height:42px;text-align:center;line-height:42px;display:inline-block;">
                            <img src="${LOGO_URL}" alt="IRL" width="28" height="28" style="display:inline-block;vertical-align:middle;" />
                          </div>
                        </td>
                        <td style="padding-left:12px;vertical-align:middle;">
                          <p style="margin:0;color:#ffffff;font-size:17px;font-weight:bold;letter-spacing:0.3px;">Infinite Running League</p>
                          <p style="margin:2px 0 0;color:rgba(255,255,255,0.7);font-size:11px;letter-spacing:1.5px;text-transform:uppercase;">Official Communication</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- RED ACCENT LINE -->
          <tr><td style="height:3px;background-color:${RED_DARK};"></td></tr>

          <!-- BODY -->
          <tr>
            <td style="background-color:#ffffff;padding:36px 36px 28px;">
              <h1 style="margin:0 0 20px;font-size:22px;font-weight:700;color:${TEXT_PRIMARY};line-height:1.3;">${title}</h1>
              ${content}
              ${ctaText && ctaLink ? `
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px;">
                <tr>
                  <td align="center">
                    <a href="${ctaLink}" style="display:inline-block;background-color:${RED};color:#ffffff;text-decoration:none;padding:13px 32px;border-radius:8px;font-weight:600;font-size:15px;letter-spacing:0.2px;">${ctaText}</a>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-top:14px;">
                    <p style="margin:0;font-size:12px;color:#9ca3af;">Or copy this link:</p>
                    <p style="margin:4px 0 0;font-size:12px;color:${RED};word-break:break-all;">${ctaLink}</p>
                  </td>
                </tr>
              </table>
              ` : ""}
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="background-color:#1a1a1a;border-radius:0 0 12px 12px;padding:22px 36px;text-align:center;">
              <img src="${LOGO_URL}" alt="IRL" width="20" height="20" style="display:inline-block;vertical-align:middle;margin-bottom:6px;" />
              <p style="margin:4px 0 0;font-size:13px;font-weight:bold;color:#ffffff;">Infinite Running League</p>
              <p style="margin:8px 0 0;font-size:12px;color:#6b7280;">
                Questions? <a href="mailto:support@saatish.com" style="color:${RED};text-decoration:none;">support@saatish.com</a>
              </p>
              <p style="margin:6px 0 0;font-size:11px;color:#4b5563;">&copy; ${new Date().getFullYear()} Infinite Running League. All rights reserved.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`
}

async function safeSend(options: {
  to: string
  subject: string
  html: string
}): Promise<{ success: boolean; error?: string }> {
  if (!resend) {
    console.warn("[IRL Email] RESEND_API_KEY is not set. Skipping email send to:", options.to)
    return { success: false, error: "Email service not configured (missing RESEND_API_KEY)" }
  }

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [options.to],
      subject: options.subject,
      html: options.html,
    })

    if (error) {
      console.error("[IRL Email] Resend API error:", error)
      return { success: false, error: error.message }
    }

    console.log("[IRL Email] Sent successfully:", { id: data?.id, to: options.to, subject: options.subject })
    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    console.error("[IRL Email] Exception sending email:", message)
    return { success: false, error: message }
  }
}

// ── Highlight box helper ──────────────────────────────────────────
function highlightBox(rows: { label: string; value: string }[]) {
  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;border-radius:0 8px 8px 0;border-left:4px solid ${RED};background-color:#fff5f5;overflow:hidden;">
      ${rows.map(({ label, value }) => `
        <tr>
          <td style="padding:10px 16px;font-size:14px;color:${TEXT_SECONDARY};width:40%;">${label}</td>
          <td style="padding:10px 16px;font-size:14px;color:${TEXT_PRIMARY};font-weight:600;">${value}</td>
        </tr>
      `).join("")}
    </table>
  `
}

function bodyText(text: string) {
  return `<p style="margin:0 0 14px;font-size:15px;color:${TEXT_SECONDARY};line-height:1.65;">${text}</p>`
}

// ── Public email functions ──────────────────────────────────────────

export async function sendTeamInviteEmail(
  to: string,
  recipientName: string,
  teamName: string,
  inviterName: string,
  inviteLink: string
) {
  const html = getEmailTemplate({
    title: "You're Invited to Join a Team!",
    preheader: `${inviterName} has invited you to join ${teamName} on IRL`,
    content: `
      ${bodyText(`Hi <strong style="font-weight:normal;color:${TEXT_PRIMARY};">${recipientName}</strong>,`)}
      ${bodyText(`<strong style="font-weight:normal;color:${TEXT_PRIMARY};">${inviterName}</strong> has invited you to join their team <strong style="font-weight:normal;color:${TEXT_PRIMARY};">"${teamName}"</strong> on the Infinite Running League platform.`)}
      ${highlightBox([
        { label: "Team", value: teamName },
        { label: "Invited by", value: inviterName },
      ])}
      ${bodyText("Click the button below to accept this invitation and join the team. If you don't have an account yet, you'll be prompted to create one.")}
    `,
    ctaText: "Accept Invitation",
    ctaLink: inviteLink,
  })

  return safeSend({
    to,
    subject: `You're invited to join ${teamName} on IRL`,
    html,
  })
}

export async function sendInvitationAcceptedEmail(
  to: string,
  managerName: string,
  runnerName: string,
  teamName: string
) {
  const html = getEmailTemplate({
    title: "New Team Member Joined! 🎉",
    preheader: `${runnerName} has joined your team ${teamName}`,
    content: `
      ${bodyText(`Hi <strong style="font-weight:normal;color:${TEXT_PRIMARY};">${managerName}</strong>,`)}
      ${bodyText(`Great news! <strong style="font-weight:normal;color:${TEXT_PRIMARY};">${runnerName}</strong> has accepted your invitation and joined your team <strong style="font-weight:normal;color:${TEXT_PRIMARY};">"${teamName}"</strong>.`)}
      ${highlightBox([
        { label: "New Member", value: runnerName },
        { label: "Team", value: teamName },
      ])}
      ${bodyText("You can now view their profile and include them in race registrations.")}
    `,
    ctaText: "View Team",
    ctaLink: `${getSiteUrl()}/manager/teams`,
  })

  return safeSend({
    to,
    subject: `${runnerName} has joined ${teamName}`,
    html,
  })
}

export async function sendJoinRequestEmail(
  to: string,
  managerName: string,
  runnerName: string,
  teamName: string
) {
  const html = getEmailTemplate({
    title: "New Join Request",
    preheader: `${runnerName} wants to join your team ${teamName}`,
    content: `
      ${bodyText(`Hi <strong style="font-weight:normal;color:${TEXT_PRIMARY};">${managerName}</strong>,`)}
      ${bodyText(`<strong style="font-weight:normal;color:${TEXT_PRIMARY};">${runnerName}</strong> has requested to join your team <strong style="font-weight:normal;color:${TEXT_PRIMARY};">"${teamName}"</strong>.`)}
      ${highlightBox([
        { label: "Runner", value: runnerName },
        { label: "Team", value: teamName },
      ])}
      ${bodyText("Please review this request and accept or decline it from your manager portal.")}
    `,
    ctaText: "Review Request",
    ctaLink: `${getSiteUrl()}/manager/invitations`,
  })

  return safeSend({
    to,
    subject: `${runnerName} wants to join ${teamName}`,
    html,
  })
}

export async function sendInvitationRejectedEmail(
  to: string,
  recipientName: string,
  teamName: string
) {
  const html = getEmailTemplate({
    title: "Invitation Update",
    preheader: `Update on your invitation to ${teamName}`,
    content: `
      ${bodyText(`Hi <strong style="font-weight:normal;color:${TEXT_PRIMARY};">${recipientName}</strong>,`)}
      ${bodyText(`Unfortunately, your request to join <strong style="font-weight:normal;color:${TEXT_PRIMARY};">"${teamName}"</strong> was not approved at this time.`)}
      ${bodyText("Don't be discouraged! There are many other teams on the Infinite Running League platform that you can explore and join.")}
    `,
    ctaText: "Find Other Teams",
    ctaLink: `${getSiteUrl()}/runner/teams`,
  })

  return safeSend({
    to,
    subject: `Update on your request to join ${teamName}`,
    html,
  })
}

export async function sendRegistrationSuccessEmail(
  to: string,
  recipientName: string,
  teamName: string,
  raceName: string,
  raceDate: string,
  amount: number
) {
  const formattedAmount = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount / 100)

  const formattedDate = new Date(raceDate).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  const html = getEmailTemplate({
    title: "Registration Confirmed! 🏃",
    preheader: `Your registration for ${raceName} has been confirmed`,
    content: `
      ${bodyText(`Hi <strong style="font-weight:normal;color:${TEXT_PRIMARY};">${recipientName}</strong>,`)}
      ${bodyText(`Your registration for <strong style="font-weight:normal;color:${TEXT_PRIMARY};">"${raceName}"</strong> has been successfully completed.`)}
      ${highlightBox([
        { label: "Race", value: raceName },
        { label: "Date", value: formattedDate },
        { label: "Team", value: teamName },
        { label: "Amount Paid", value: formattedAmount },
      ])}
      ${bodyText("Mark your calendar and get ready for race day! You can view all your registrations and race details in your dashboard.")}
    `,
    ctaText: "View My Registrations",
    ctaLink: `${getSiteUrl()}/runner/registrations`,
  })

  return safeSend({
    to,
    subject: `Registration Confirmed: ${raceName}`,
    html,
  })
}
