import { Resend } from 'resend'

export interface OtpMail {
  email: string
  otp: string
}

/** Sends the sign-in code. Injected into the auth instance so tests never reach Resend. */
export interface Mailer {
  sendOtp(mail: OtpMail): Promise<void>
}

/** Plain Spanish email; the subject carries the code so it is readable from the notification (U3). */
export function buildOtpEmail(otp: string): { subject: string; text: string } {
  return {
    subject: `${otp} es tu código de acceso`,
    text: [
      `Tu código de acceso es ${otp}.`,
      '',
      'Escríbelo en la app para entrar. Caduca en 10 minutos.',
      'Si no lo has pedido tú, ignora este correo.',
    ].join('\n'),
  }
}

export function createResendMailer(opts: { apiKey: string; from: string }): Mailer {
  const resend = new Resend(opts.apiKey)
  return {
    async sendOtp({ email, otp }) {
      const { subject, text } = buildOtpEmail(otp)
      const { error } = await resend.emails.send({ from: opts.from, to: email, subject, text })
      if (error) throw new Error(`Resend failed: ${error.message}`)
    },
  }
}

export interface TestMailer extends Mailer {
  sent: OtpMail[]
  lastCodeFor(email: string): string | undefined
}

/** Test sink: records every code instead of sending it. */
export function createTestMailer(): TestMailer {
  const sent: OtpMail[] = []
  return {
    sent,
    async sendOtp(mail) {
      sent.push(mail)
    },
    lastCodeFor(email) {
      const target = email.toLowerCase()
      return sent.findLast((m) => m.email === target)?.otp
    },
  }
}
