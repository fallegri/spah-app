import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateGestion(): string {
  const now = new Date();
  const year = now.getFullYear();
  const semester = now.getMonth() < 6 ? "I" : "II";
  return `${year}-${semester}`;
}
