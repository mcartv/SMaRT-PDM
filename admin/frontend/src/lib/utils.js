// SMaRT-PDM: utils — utils (admin frontend); supports admin-side UI behavior.
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge"

// cn: handles cn for the utils flow.
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
