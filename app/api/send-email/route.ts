import { NextResponse } from 'next/server'
import nodemailer from 'nodemailer'

export async function POST(req: Request) {
  try {
    const { to, subject, text, html } = await req.json()

    const user = process.env.GMAIL_USER
    const pass = process.env.GMAIL_APP_PASSWORD

    if (!user || !pass) {
      return NextResponse.json(
        { error: 'GMAIL_USER or GMAIL_APP_PASSWORD not configured' },
        { status: 400 },
      )
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user,
        pass,
      },
    })

    const info = await transporter.sendMail({
      from: `Doko <${user}>`,
      to,
      subject,
      text,
      html,
    })

    console.log('[nodemailer] Email sent:', info.messageId)
    return NextResponse.json({ success: true, messageId: info.messageId })
  } catch (error: any) {
    console.error('[nodemailer] Failed to send email:', error)
    return NextResponse.json(
      { error: error?.message ?? 'Failed to send email' },
      { status: 500 },
    )
  }
}
