'use client'

import { useState } from 'react'

/**
 * Share links, built as plain URLs rather than the networks' own widgets.
 *
 * Every official share button ships a third-party script that tracks the reader
 * whether or not they click it. On a site whose whole pitch is careful handling
 * of members' information, that trade is not available to us. These are ordinary
 * links: nothing loads, nothing is sent, until someone chooses to share.
 */
export default function ShareButtons({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false)

  const encodedUrl = encodeURIComponent(url)
  const encodedTitle = encodeURIComponent(title)

  const targets = [
    { name: 'Facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}` },
    { name: 'X', href: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}` },
    { name: 'WhatsApp', href: `https://wa.me/?text=${encodedTitle}%20${encodedUrl}` },
    { name: 'Email', href: `mailto:?subject=${encodedTitle}&body=${encodedUrl}` },
  ]

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard access can be refused outright. Saying so beats a button that
      // appears to do nothing.
      window.prompt('Copy this link', url)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-gray-600">Share:</span>
      {targets.map((target) => (
        <a
          key={target.name}
          href={target.href}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded border px-3 py-1 text-sm hover:bg-gray-50"
        >
          {target.name}
        </a>
      ))}
      <button onClick={copyLink} className="rounded border px-3 py-1 text-sm hover:bg-gray-50">
        {copied ? 'Link copied' : 'Copy link'}
      </button>
    </div>
  )
}
