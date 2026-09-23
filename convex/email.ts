"use node";

import { v } from 'convex/values'
import { internalAction } from './_generated/server'
import { internal } from './_generated/api'
import nodemailer from 'nodemailer'
import type { Transporter } from 'nodemailer'
import { INVITE_EXPIRY_DAYS } from './inviteToken'
import { escapeHtml, errorMessage, getAppUrl } from './emailUtils'

/**
 * Outbound mail. Failures throw so they show up in the Convex dashboard's
 * scheduled-function log instead of being swallowed; invite delivery state
 * is also written back to the invite row for the UI.
 */

let transporter: Transporter | null = null

function getTransporter() {
  const user = process.env.GMAIL_USER
  const pass = process.env.GMAIL_APP_PASSWORD
  if (!user || !pass) {
    throw new Error(
      'GMAIL_USER / GMAIL_APP_PASSWORD are not set on the Convex deployment. ' +
        'Run: npx convex env set GMAIL_USER <email> && npx convex env set GMAIL_APP_PASSWORD <app password>',
    )
  }
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    })
  }
  return { transporter, from: user }
}

export const sendInvite = internalAction({
  args: { inviteId: v.id('invites') },
  handler: async (ctx, args) => {
    const invite = await ctx.runQuery(internal.invites.getById, { inviteId: args.inviteId })
    if (!invite || invite.status !== 'pending') return

    const fail = async (err: unknown) => {
      const message = errorMessage(err)
      await ctx.runMutation(internal.invites.markDelivery, {
        inviteId: args.inviteId,
        deliveryStatus: 'failed',
        lastError: message.slice(0, 500),
      })
      throw err
    }

    let link: string
    let mail: { transporter: Transporter; from: string }
    try {
      link = `${getAppUrl()}/invite/accept?token=${encodeURIComponent(invite.token)}`
      mail = getTransporter()
    } catch (err) {
      return await fail(err)
    }

    const teamName = escapeHtml(invite.teamName)
    const inviter = escapeHtml(invite.invitedByEmail)
    const expiry = `${INVITE_EXPIRY_DAYS} days`

    const subject = `${invite.invitedByEmail} invited you to ${invite.teamName} on Doko`
    const text = `Hi,\n\n${invite.invitedByEmail} invited you to join their team "${invite.teamName}" on Doko.\n\nAccept the invite here (link expires in ${expiry}):\n${link}\n\n- Doko`
    const html = `
      <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #0d9488; margin-top: 0;">You've been invited to join ${teamName}!</h2>
        <p style="color: #334155;"><strong>${inviter}</strong> has invited you to collaborate on <strong>Doko</strong>.</p>
        <div style="margin: 24px 0;">
          <a href="${link}" style="background-color: #0d9488; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">
            Accept Invitation
          </a>
        </div>
        <p style="color: #64748b; font-size: 13px; line-height: 1.5;">This link will expire in ${expiry} and only works when you sign in as <strong>${escapeHtml(invite.email)}</strong>.<br/>If the button doesn't work, copy and paste this link into your browser:<br/><a href="${link}" style="color: #0d9488;">${link}</a></p>
      </div>
    `

    try {
      const info = await mail.transporter.sendMail({
        from: `Doko <${mail.from}>`,
        to: invite.email,
        subject,
        text,
        html,
      })
      console.log(`[email] Invite sent to ${invite.email}, messageId: ${info.messageId}`)
      await ctx.runMutation(internal.invites.markDelivery, {
        inviteId: args.inviteId,
        deliveryStatus: 'sent',
      })
    } catch (err) {
      console.error('[email] Failed to send invite email:', err)
      await fail(err)
    }
  },
})

export const sendAssignmentNotification = internalAction({
  args: {
    ticketId: v.id('tickets'),
    assigneeId: v.string(),
    assignedByUserId: v.string(),
  },
  handler: async (ctx, args) => {
    const ticket = await ctx.runQuery(internal.tickets.getByIdInternal, { ticketId: args.ticketId })
    if (!ticket) return
    if (!ticket.teamId) {
      console.warn(`[email] Ticket ${ticket.key} has no team; skipping assignment email`)
      return
    }

    // The recipient must be a member of the ticket's team; never mail an arbitrary string.
    const assignee = await ctx.runQuery(internal.teamMembers.resolveMember, {
      teamId: ticket.teamId as never,
      idOrEmail: args.assigneeId,
    })
    if (!assignee) {
      console.warn(`[email] Assignee ${args.assigneeId} is not a member of team ${ticket.teamId}; skipping`)
      return
    }
    if (assignee.userId === args.assignedByUserId) return // self-assignment

    const assigner = await ctx.runQuery(internal.teamMembers.resolveMember, {
      teamId: ticket.teamId as never,
      idOrEmail: args.assignedByUserId,
    })
    const assignerLabel = assigner?.email ?? null

    const link = `${getAppUrl()}/tickets/${encodeURIComponent(ticket.key)}`
    const { transporter, from } = getTransporter()

    const key = escapeHtml(ticket.key)
    const title = escapeHtml(ticket.title)
    const priority = escapeHtml(ticket.priority)
    const status = escapeHtml(ticket.status)

    const subject = `[Doko] Ticket assigned: ${ticket.key} - ${ticket.title}`
    const text = `Hi,\n\n${assignerLabel ? `${assignerLabel} assigned you to` : 'You have been assigned to'} ticket ${ticket.key} on Doko.\n\nTitle: ${ticket.title}\nPriority: ${ticket.priority.toUpperCase()}\nStatus: ${ticket.status}\n\nView ticket:\n${link}\n\n- Doko`
    const html = `
      <div style="font-family: sans-serif; max-width: 550px; margin: 0 auto; padding: 24px; border: 1px solid #334155; border-radius: 12px; background-color: #0f172a; color: #f8fafc;">
        <div style="margin-bottom: 16px;">
          <span style="background-color: #14b8a6; color: #0f172a; padding: 4px 8px; border-radius: 4px; font-weight: 800; font-family: monospace; font-size: 14px;">D</span>
          <span style="font-weight: 700; font-size: 16px; color: #ffffff; margin-left: 8px;">Doko</span>
        </div>
        <h2 style="color: #2dd4bf; margin-top: 0; font-size: 20px;">You were assigned a ticket</h2>
        <p style="color: #cbd5e1; font-size: 14px; line-height: 1.6;">
          ${assignerLabel ? `<strong>${escapeHtml(assignerLabel)}</strong> assigned you to` : 'You have been assigned to'} ticket <strong style="color: #2dd4bf; font-family: monospace;">${key}</strong>.
        </p>

        <div style="background-color: #1e293b; border-left: 4px solid #14b8a6; padding: 16px; border-radius: 6px; margin: 20px 0;">
          <div style="font-size: 16px; font-weight: 600; color: #ffffff; margin-bottom: 8px;">${title}</div>
          <div style="font-size: 12px; font-family: monospace; color: #94a3b8;">
            Priority: <span style="color: #2dd4bf; text-transform: uppercase;">${priority}</span> &bull; Status: <span style="text-transform: uppercase;">${status}</span>
          </div>
        </div>

        <div style="margin: 24px 0;">
          <a href="${link}" style="background-color: #2dd4bf; color: #0f172a; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 700; display: inline-block;">
            Open Ticket ${key} →
          </a>
        </div>
        <p style="color: #64748b; font-size: 12px; line-height: 1.5;">
          If the button doesn't work, copy and paste this link:<br/><a href="${link}" style="color: #2dd4bf;">${link}</a>
        </p>
      </div>
    `

    const info = await transporter.sendMail({
      from: `Doko Notifications <${from}>`,
      to: assignee.email,
      subject,
      text,
      html,
    })
    console.log(`[email] Assignment email sent to ${assignee.email}, messageId: ${info.messageId}`)
  },
})
