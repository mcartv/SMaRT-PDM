// SMaRT-PDM: use mobile — use mobile (admin frontend); supports admin-side UI behavior.
import * as React from "react"

const MOBILE_BREAKPOINT = 768

// useIsMobile: handles use is mobile for the use mobile flow.
export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState(undefined)

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    // onChange: handles on change for the use mobile flow.
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    mql.addEventListener("change", onChange)
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    return () => mql.removeEventListener("change", onChange);
  }, [])

  return !!isMobile
}
