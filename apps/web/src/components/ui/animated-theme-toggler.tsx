"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useTheme } from "next-themes"
import { flushSync } from "react-dom"

import { cn } from "@/lib/utils"
import { MoonIcon } from "@/components/ui/moon-icon"
import { SunIcon } from "@/components/ui/sun-icon"

interface AnimatedThemeTogglerProps extends React.ComponentPropsWithoutRef<"button"> {
  duration?: number
}

export const AnimatedThemeToggler = ({
  className,
  duration = 400,
  ...props
}: AnimatedThemeTogglerProps) => {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => setMounted(true), [])

  const toggleTheme = useCallback(async () => {
    if (!buttonRef.current) return

    const next = resolvedTheme === "dark" ? "light" : "dark"

    if (!document.startViewTransition) {
      setTheme(next)
      return
    }

    await document.startViewTransition(() => {
      flushSync(() => {
        setTheme(next)
      })
    }).ready

    const { top, left, width, height } =
      buttonRef.current.getBoundingClientRect()
    const x = left + width / 2
    const y = top + height / 2
    const maxRadius = Math.hypot(
      Math.max(left, window.innerWidth - left),
      Math.max(top, window.innerHeight - top)
    )

    document.documentElement.animate(
      {
        clipPath: [
          `circle(0px at ${x}px ${y}px)`,
          `circle(${maxRadius}px at ${x}px ${y}px)`,
        ],
      },
      {
        duration,
        easing: "ease-in-out",
        pseudoElement: "::view-transition-new(root)",
      }
    )
  }, [resolvedTheme, setTheme, duration])

  return (
    <button
      ref={buttonRef}
      onClick={toggleTheme}
      className={cn("cursor-pointer", className)}
      {...props}
    >
      {mounted ? (resolvedTheme === "dark" ? <SunIcon size={18} /> : <MoonIcon size={18} />) : <MoonIcon size={18} />}
      <span className="sr-only">Toggle theme</span>
    </button>
  )
}
