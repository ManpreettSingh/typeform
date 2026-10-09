export type SocialNetwork = "facebook" | "linkedin" | "x" | "buffer" | "linktree";

/** The "Share in:" row of Typeform's Share page, in its order. */
export const SOCIAL_NETWORKS: readonly { id: SocialNetwork; label: string }[] = [
  { id: "facebook", label: "Facebook" },
  { id: "linkedin", label: "LinkedIn" },
  { id: "x", label: "X" },
  { id: "buffer", label: "Buffer" },
  { id: "linktree", label: "Linktree" },
];

/**
 * Where "Share in: <network>" opens. Linktree has no public share link, so it goes to the dashboard
 * (the caller copies the form link first).
 */
export function socialShareUrl(network: SocialNetwork, url: string, title: string): string {
  const u = encodeURIComponent(url);
  const text = title.trim() ? `&text=${encodeURIComponent(title.trim())}` : "";
  switch (network) {
    case "facebook":
      return `https://www.facebook.com/sharer/sharer.php?u=${u}`;
    case "linkedin":
      return `https://www.linkedin.com/sharing/share-offsite/?url=${u}`;
    case "x":
      return `https://x.com/intent/post?url=${u}${text}`;
    case "buffer":
      return `https://buffer.com/add?url=${u}${text}`;
    case "linktree":
      return "https://linktr.ee/admin";
  }
}
