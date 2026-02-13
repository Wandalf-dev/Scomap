"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

function formatDisplay(digits: string): string {
  if (digits.length === 0) return ""
  const d = digits.slice(0, 10)
  const parts = [
    d.slice(0, 1),
    d.slice(1, 3),
    d.slice(3, 5),
    d.slice(5, 7),
    d.slice(7, 9),
  ].filter((p) => p.length > 0)
  return `+33 ${parts.join("-")}`
}

interface PhoneInputProps
  extends Omit<React.ComponentProps<"input">, "onChange" | "value"> {
  value?: string | null
  onChange?: (value: string) => void
}

function PhoneInput({ className, value, onChange, ...props }: PhoneInputProps) {
  const stored = value ?? ""
  const digits = stored.replace(/\D/g, "").replace(/^33/, "").slice(0, 10)
  const display = digits.length > 0 ? formatDisplay(digits) : ""

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value
    const allDigits = raw.replace(/\D/g, "")

    let local = allDigits
    if (local.startsWith("33")) {
      local = local.slice(2)
    }
    local = local.slice(0, 10)

    if (local.length > 0) {
      onChange?.(`+33${local}`)
    } else {
      onChange?.("")
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    const allowed = ["Backspace", "Delete", "ArrowLeft", "ArrowRight", "Tab", "Home", "End"]
    if (allowed.includes(e.key)) return
    if (e.ctrlKey || e.metaKey) return
    if (!/^\d$/.test(e.key)) {
      e.preventDefault()
    }
  }

  return (
    <input
      type="tel"
      data-slot="input"
      className={cn(
        "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground bg-white border-[#A08968] dark:bg-[#44403c] dark:border-[#78716c] h-9 w-full min-w-0 rounded-md border px-3 py-1 text-base shadow-sm dark:shadow-none transition-[color,box-shadow] outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
        "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        className
      )}
      value={display}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      placeholder="+33 0-00-00-00-00"
      {...props}
    />
  )
}

export { PhoneInput }
