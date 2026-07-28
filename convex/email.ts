"use node";

import { v } from 'convex/values'
import { internalAction } from './_generated/server'
import { internal } from './_generated/api'
import nodemailer from 'nodemailer'

export const sendInvite = internalAction({
  args: { inviteId: v.id('invites') },
  handler: async (ctx, args) => {
    const invite = await ctx.runQuery(internal.invites.getById, {
      inviteId: args.inviteId,
    })
    if (!invite) return

    const user = process.env.GMAIL_USER
    const pass = process.env.GMAIL_APP_PASSWORD

    if (!user || !pass) {
      console.warn(
        '[email] GMAIL_USER or GMAIL_APP_PASSWORD not set in Convex environment variables.',
      )
      console.warn(
        '[email] Set them via CLI: npx convex env set GMAIL_USER <email> && npx convex env set GMAIL_APP_PASSWORD <pass>',
      )
      return
    }

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ??
      process.env.APP_URL ??
      'http://localhost:3000'
    const link = `${appUrl}/invite/accept?token=${invite.token}`

    const subject = `${invite.invitedByEmail} invited you to ${invite.teamName} on Doko`
    const text = `Hi,\n\n${invite.invitedByEmail} invited you to join their team "${invite.teamName}" on Doko.\n\nAccept the invite here (link expires in 7 days):\n${link}\n\n— Doko`
    const html = `
      <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #0d9488; margin-top: 0;">You've been invited to join ${invite.teamName}!</h2>
        <p style="color: #334155;"><strong>${invite.invitedByEmail}</strong> has invited you to collaborate on <strong>Doko</strong>.</p>
        <div style="margin: 24px 0;">
          <a href="${link}" style="background-color: #0d9488; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">
            Accept Invitation
          </a>
        </div>
        <p style="color: #64748b; font-size: 13px; line-height: 1.5;">This link will expire in 7 days.<br/>If the button doesn't work, copy and paste this link into your browser:<br/><a href="${link}" style="color: #0d9488;">${link}</a></p>
      </div>
    `

    try {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user, pass },
      })

      const info = await transporter.sendMail({
        from: `Doko <${user}>`,
        to: invite.email,
        subject,
        text,
        html,
      })

      console.log(
        `[email] Invite email sent via Nodemailer to ${invite.email}, messageId: ${info.messageId}`,
      )
    } catch (err) {
      console.error('[email] Failed to send invite email via Nodemailer:', err)
    }
  },
})
