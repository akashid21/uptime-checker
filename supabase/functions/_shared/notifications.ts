export type NotificationEvent = 'incident_started' | 'incident_resolved'

export interface IncidentNotification {
  event: NotificationEvent
  recipient: { email: string; name?: string | null }
  monitorName: string
  monitorUrl: string
  statusCode: number | null
  startedAt: string
  endedAt?: string | null
  durationMinutes?: number | null
  errorMessage?: string | null
}

interface EmailMessage {
  to: { email: string; name?: string | null }[]
  subject: string
  htmlContent: string
  textContent: string
}

interface EmailProvider {
  send(message: EmailMessage): Promise<{ messageId?: string }>
}

const BREVO_ENDPOINT = 'https://api.brevo.com/v3/smtp/email'

function requiredEnv(name: string): string {
  const value = Deno.env.get(name)?.trim()
  if (!value) throw new Error(`Missing required email configuration: ${name}`)
  return value
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;',
  })[character] || character)
}

function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(new Date(value)) + ' UTC'
}

function formatDuration(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined) return 'Duration unavailable'
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'}`
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return `${hours}h${remainingMinutes ? ` ${remainingMinutes}m` : ''}`
}

function buildMessage(notification: IncidentNotification): EmailMessage {
  const isStarted = notification.event === 'incident_started'
  const monitorName = escapeHtml(notification.monitorName)
  const monitorUrl = escapeHtml(notification.monitorUrl)
  const statusCode = notification.statusCode ? `HTTP ${notification.statusCode}` : 'No HTTP response'
  const subject = isStarted
    ? `[PulseCheck] ${notification.monitorName} is down`
    : `[PulseCheck] ${notification.monitorName} has recovered`
  const headline = isStarted ? 'Your monitor is down' : 'Your monitor has recovered'
  const summary = isStarted
    ? 'PulseCheck could not reach this service after the configured retries.'
    : 'PulseCheck can reach this service again and has closed the incident.'
  const details = isStarted
    ? `Started: ${formatTimestamp(notification.startedAt)}\nResult: ${statusCode}${notification.errorMessage ? `\nError: ${notification.errorMessage}` : ''}`
    : `Started: ${formatTimestamp(notification.startedAt)}\nResolved: ${formatTimestamp(notification.endedAt || new Date().toISOString())}\nDowntime: ${formatDuration(notification.durationMinutes)}`
  const safeDetails = details.split('\n').map((line) => `<div style="margin:5px 0">${escapeHtml(line)}</div>`).join('')

  return {
    to: [notification.recipient],
    subject,
    htmlContent: `<!doctype html><html><body style="margin:0;background:#f4f7fb;color:#172033;font-family:Arial,sans-serif"><div style="max-width:600px;margin:32px auto;background:#fff;border:1px solid #dce3ed;border-radius:12px;overflow:hidden"><div style="padding:24px 28px;background:#101827;color:#fff"><div style="font-size:13px;color:#8fe1bf;font-weight:700;letter-spacing:.08em;text-transform:uppercase">PulseCheck</div><h1 style="margin:12px 0 0;font-size:24px">${headline}</h1></div><div style="padding:28px"><p style="margin:0 0 20px;font-size:16px;line-height:1.5">${escapeHtml(summary)}</p><div style="padding:16px;background:#f4f7fb;border-radius:8px;font-size:14px;line-height:1.5"><strong>${monitorName}</strong><div style="margin-top:4px;color:#526176;word-break:break-all">${monitorUrl}</div><div style="margin-top:14px">${safeDetails}</div></div><p style="margin:24px 0 0;color:#526176;font-size:13px;line-height:1.5">You will only receive notifications when this incident starts or ends. Intermediate checks do not send email.</p></div></div></body></html>`,
    textContent: `${headline}\n\n${summary}\n\nMonitor: ${notification.monitorName}\nURL: ${notification.monitorUrl}\n${details}\n\nYou will only receive notifications when this incident starts or ends. Intermediate checks do not send email.`,
  }
}

function createBrevoProvider(): EmailProvider {
  const apiKey = requiredEnv('BREVO_API_KEY')
  const senderEmail = requiredEnv('NOTIFICATION_FROM_EMAIL')
  const senderName = Deno.env.get('NOTIFICATION_FROM_NAME')?.trim() || 'PulseCheck'

  return {
    async send(message) {
      const response = await fetch(BREVO_ENDPOINT, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'api-key': apiKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          sender: { email: senderEmail, name: senderName },
          ...message,
        }),
      })

      if (!response.ok) {
        const body = await response.text()
        throw new Error(`Brevo rejected the email (${response.status}): ${body.slice(0, 300)}`)
      }

      return await response.json()
    },
  }
}

function createProvider(): EmailProvider {
  const provider = Deno.env.get('EMAIL_PROVIDER')?.trim().toLowerCase() || 'brevo'
  if (provider === 'brevo') return createBrevoProvider()
  throw new Error(`Unsupported EMAIL_PROVIDER: ${provider}`)
}

export async function sendIncidentNotification(notification: IncidentNotification): Promise<{ messageId?: string }> {
  return createProvider().send(buildMessage(notification))
}
