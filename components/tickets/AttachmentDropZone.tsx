'use client'

import { useState, useCallback } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { useDropzone } from 'react-dropzone'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import { PaperclipIcon, UploadIcon, XIcon, DownloadIcon, ImageIcon, FileIcon } from 'lucide-react'
import { toast } from '@/components/ui/toast'
import { parseConvexError } from '@/lib/utils'

export function AttachmentDropZone({
  ticketId,
  userEmail,
}: {
  ticketId: Id<'tickets'>
  userEmail?: string
}) {
  const attachments = useQuery(api.attachments.byTicket, { ticketId, userEmail }) ?? []
  const generateUploadUrl = useMutation(api.attachments.generateUploadUrl)
  const record = useMutation(api.attachments.record)
  const removeAttachment = useMutation(api.attachments.remove)

  const [uploading, setUploading] = useState(false)

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return
      setUploading(true)

      try {
        for (const file of acceptedFiles) {
          if (file.size > 20 * 1024 * 1024) {
            toast.error('File too large', `${file.name} exceeds 20MB limit`)
            continue
          }

          const uploadUrl = await generateUploadUrl({ userEmail })
          const res = await fetch(uploadUrl, {
            method: 'POST',
            headers: { 'Content-Type': file.type || 'application/octet-stream' },
            body: file,
          })

          if (!res.ok) throw new Error(`Upload failed for ${file.name}`)
          const { storageId } = await res.json()

          await record({
            ticketId,
            storageId,
            filename: file.name,
            mimeType: file.type || 'application/octet-stream',
            size: file.size,
            userEmail,
          })
          toast.success('Attached file', file.name)
        }
      } catch (err: any) {
        toast.error('Upload error', parseConvexError(err))
      } finally {
        setUploading(false)
      }
    },
    [ticketId, generateUploadUrl, record, userEmail],
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop })

  const handleRemove = async (attachmentId: Id<'attachments'>, filename: string) => {
    try {
      await removeAttachment({ attachmentId, userEmail })
      toast.success('Attachment deleted', filename)
    } catch (err: any) {
      toast.error('Failed to remove attachment', parseConvexError(err))
    }
  }

  return (
    <div className="space-y-3 pt-4 border-t border-border/40">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <PaperclipIcon className="w-4 h-4 text-teal-400" />
        <span>Attachments ({attachments.length})</span>
      </div>

      <div
        {...getRootProps()}
        className={`p-4 border-2 border-dashed rounded-none transition-colors text-center cursor-pointer ${
          isDragActive
            ? 'border-teal-400 bg-teal-500/10'
            : 'border-border/60 hover:border-border bg-muted/10 hover:bg-muted/20'
        }`}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <UploadIcon className="w-5 h-5 text-teal-400/80" />
          <span>
            {uploading
              ? 'Uploading...'
              : isDragActive
              ? 'Drop files here'
              : 'Drag & drop files here, or click to browse'}
          </span>
          <span className="text-[10px] text-muted-foreground/70">Up to 20MB per file</span>
        </div>
      </div>

      {attachments.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
          {attachments.map(att => {
            const isImage = att.mimeType.startsWith('image/')
            const fileSizeKb = (att.size / 1024).toFixed(1)

            return (
              <div
                key={att._id}
                className="group relative flex items-center gap-3 p-2 bg-muted/20 border border-border/40 rounded-none hover:border-border transition-colors text-xs"
              >
                {isImage && att.url ? (
                  <img
                    src={att.url}
                    alt={att.filename}
                    className="w-12 h-12 object-cover border border-border/60 shrink-0"
                  />
                ) : (
                  <div className="w-12 h-12 bg-muted flex items-center justify-center border border-border/60 shrink-0">
                    <FileIcon className="w-5 h-5 text-muted-foreground" />
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <a
                    href={att.url ?? '#'}
                    target="_blank"
                    rel="noreferrer"
                    download={att.filename}
                    className="font-medium truncate block hover:text-teal-400 transition-colors"
                    title={att.filename}
                  >
                    {att.filename}
                  </a>
                  <div className="text-[10px] text-muted-foreground">{fileSizeKb} KB</div>
                </div>

                <div className="flex items-center gap-1">
                  {att.url && (
                    <a
                      href={att.url}
                      target="_blank"
                      rel="noreferrer"
                      download={att.filename}
                      className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                      title="Download file"
                    >
                      <DownloadIcon className="w-3.5 h-3.5" />
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => handleRemove(att._id, att.filename)}
                    className="p-1 text-muted-foreground hover:text-red-400 transition-colors"
                    title="Remove attachment"
                  >
                    <XIcon className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
