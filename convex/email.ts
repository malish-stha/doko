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
    const text = `Hi,\n\n${invite.invitedByEmail} invited you to join their team "${invite.teamName}" on Doko.\n\nAccept the invite here (link expires in 7 days):\n${link}\n\n- Doko`
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

export const sendAssignmentNotification = internalAction({
  args: {
    ticketId: v.id('tickets'),
    assigneeId: v.string(),
    assignedByEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const ticket = await ctx.runQuery(internal.tickets.getByIdInternal, {
      ticketId: args.ticketId,
    })
    if (!ticket) return

    // Find assignee's email address
    let recipientEmail = args.assigneeId.includes('@') ? args.assigneeId : null
    if (!recipientEmail) {
      const targetUser = await ctx.runQuery(internal.users.getByUserIdInternal, {
        userId: args.assigneeId,
      })
      recipientEmail = targetUser?.email ?? null
    }

    if (!recipientEmail) {
      console.warn(`[email] Could not resolve email address for assignee: ${args.assigneeId}`)
      return
    }

    // Do not email if user assigned ticket to themselves
    if (
      args.assignedByEmail &&
      recipientEmail.trim().toLowerCase() === args.assignedByEmail.trim().toLowerCase()
    ) {
      return
    }

    const user = process.env.GMAIL_USER
    const pass = process.env.GMAIL_APP_PASSWORD

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ??
      process.env.APP_URL ??
      'http://localhost:3000'
    const link = `${appUrl}/board?ticket=${ticket.key}`

    const subject = `[Doko] Ticket assigned: ${ticket.key} - ${ticket.title}`
    const text = `Hi,\n\nYou have been assigned to ticket ${ticket.key} on Doko.\n\nTitle: ${ticket.title}\nPriority: ${ticket.priority.toUpperCase()}\nStatus: ${ticket.status}\n\nView ticket:\n${link}\n\n- Doko`
    const html = `
      <div style="font-family: sans-serif; max-width: 550px; margin: 0 auto; padding: 24px; border: 1px solid #334155; border-radius: 12px; background-color: #0f172a; color: #f8fafc;">
        <div style="margin-bottom: 16px;">
          <span style="background-color: #14b8a6; color: #0f172a; padding: 4px 8px; border-radius: 4px; font-weight: 800; font-family: monospace; font-size: 14px;">D</span>
          <span style="font-weight: 700; font-size: 16px; color: #ffffff; margin-left: 8px;">Doko</span>
        </div>
        <h2 style="color: #2dd4bf; margin-top: 0; font-size: 20px;">You were assigned a ticket</h2>
        <p style="color: #cbd5e1; font-size: 14px; line-height: 1.6;">
          ${args.assignedByEmail ? `<strong>${args.assignedByEmail}</strong> assigned you to` : 'You have been assigned to'} ticket <strong style="color: #2dd4bf; font-family: monospace;">${ticket.key}</strong>.
        </p>

        <div style="background-color: #1e293b; border-left: 4px solid #14b8a6; padding: 16px; border-radius: 6px; margin: 20px 0;">
          <div style="font-size: 16px; font-weight: 600; color: #ffffff; margin-bottom: 8px;">${ticket.title}</div>
          <div style="font-size: 12px; font-family: monospace; color: #94a3b8;">
            Priority: <span style="color: #2dd4bf; text-transform: uppercase;">${ticket.priority}</span> &bull; Status: <span style="text-transform: uppercase;">${ticket.status}</span>
          </div>
        </div>

        <div style="margin: 24px 0;">
          <a href="${link}" style="background-color: #2dd4bf; color: #0f172a; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 700; display: inline-block;">
            Open Ticket ${ticket.key} →
          </a>
        </div>
        <p style="color: #64748b; font-size: 12px; line-height: 1.5;">
          If the button doesn't work, copy and paste this link:<br/><a href="${link}" style="color: #2dd4bf;">${link}</a>
        </p>
      </div>
    `

    if (!user || !pass) {
      console.log(
        `[email] Assignment notification (env vars missing): Assigned ticket ${ticket.key} to ${recipientEmail}`,
      )
      return
    }

    try {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user, pass },
      })

      const info = await transporter.sendMail({
        from: `Doko Notifications <${user}>`,
        to: recipientEmail,
        subject,
        text,
        html,
      })

      console.log(
        `[email] Ticket assignment email sent via Nodemailer to ${recipientEmail}, messageId: ${info.messageId}`,
      )
    } catch (err) {
      console.error('[email] Failed to send ticket assignment email via Nodemailer:', err)
    }
  },
})
