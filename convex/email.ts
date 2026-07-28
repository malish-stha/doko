import { v } from 'convex/values'
import { internalAction, internalQuery } from './_generated/server'
import { internal } from './_generated/api'
import { Resend } from 'resend'

export const getInvite = internalQuery({
  args: { inviteId: v.id('invites') },
  handler: async (ctx, args) => await ctx.db.get(args.inviteId),
})

export const sendInvite = internalAction({
  args: { inviteId: v.id('invites') },
  handler: async (ctx, args) => {
    const invite = await ctx.runQuery(internal.email.getInvite, {
      inviteId: args.inviteId,
    })
    if (!invite) return

    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) {
      console.warn('[email] RESEND_API_KEY missing, skipping email send')
      return
    }

    const resend = new Resend(apiKey)
    const appUrl = process.env.APP_URL ?? 'http://localhost:3000'
    const link = `${appUrl}/invite/accept?token=${invite.token}`

    try {
      const result = await resend.emails.send({
        from: 'Doko <onboarding@resend.dev>',
        to: invite.email,
        subject: `${invite.invitedByEmail} invited you to ${invite.teamName} on Doko`,
        text: `Hi,\n\n${invite.invitedByEmail} invited you to join their team "${invite.teamName}" on Doko — the 4-sentence morning brief tool.\n\nAccept the invite here (link expires in 7 days):\n${link}\n\n— Doko`,
      })

      if (result.error) {
        console.error('[email] Resend returned error:', result.error.message)
      } else {
        console.log(`[email] Invite email sent successfully to ${invite.email}, id: ${result.data?.id}`)
      }
    } catch (err) {
      console.error('[email] Failed to send invite email:', err)
    }
  },
})
