'use client'

interface Props {
  text: string
}

export default function CopyButton({ text }: Props) {
  return (
    <button
      onClick={() => navigator.clipboard.writeText(text)}
      className="text-xs font-bold text-teal-600 whitespace-nowrap"
    >
      Copy
    </button>
  )
}
