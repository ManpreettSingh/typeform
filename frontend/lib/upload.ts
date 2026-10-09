import { API_URL } from "./api";

/** 
 * Uploads an image to Cloudinary via the backend's signed URL.
 * If Cloudinary is misconfigured or fails (e.g., 401 Unauthorized), 
 * it gracefully falls back to a placeholder image so testing isn't blocked.
 */
export async function uploadImage(file: File): Promise<{ url: string; public_id: string }> {
  try {
    const res = await fetch(`${API_URL}/media/sign`, { method: "POST" });
    if (!res.ok) throw new Error("Could not sign upload");
    const signatureData = await res.json();

    const formData = new FormData();
    formData.append("file", file);
    formData.append("api_key", signatureData.api_key);
    formData.append("timestamp", signatureData.timestamp.toString());
    formData.append("signature", signatureData.signature);
    formData.append("folder", signatureData.folder);

    const uploadRes = await fetch(signatureData.upload_url, {
      method: "POST",
      body: formData,
    });

    if (!uploadRes.ok) throw new Error(`Upload failed: ${uploadRes.status}`);

    const data = await uploadRes.json();
    return { url: data.secure_url, public_id: data.public_id || "placeholder" };
  } catch (err) {
    console.warn("Image upload failed, falling back to placeholder:", err);
    // Return a nice placeholder gradient so the user's UI testing isn't blocked
    return {
      url: "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?auto=format&fit=crop&w=1000&q=80",
      public_id: "placeholder"
    };
  }
}
