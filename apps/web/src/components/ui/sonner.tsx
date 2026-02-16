"use client"

import { useTheme } from "next-themes"
import { GoeyToaster as GoeyToasterBase, goeyToast } from "goey-toast"
import "goey-toast/styles.css"

function GoeyToaster() {
  const { resolvedTheme } = useTheme()

  return (
    <GoeyToasterBase
      position="top-right"
      theme={resolvedTheme === "dark" ? "dark" : "light"}
    />
  )
}

// Re-export goeyToast as "toast" for backward compatibility
const toast = goeyToast

export { GoeyToaster as Toaster, toast, goeyToast }
