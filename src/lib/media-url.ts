export const mediaUrl = (id: string | null | undefined) => (id ? `/api/media/${id}` : null);

export function whatsappLink(number: string, text?: string) {
  const digits = number.replace(/\D/g, "");
  if (!digits) return null;
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

export function instagramLink(handle: string) {
  const h = handle.replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//, "").replace(/\/$/, "").trim();
  return h ? { url: `https://instagram.com/${h}`, handle: `@${h}` } : null;
}
