import { useState, useRef } from "react";
import { ImagePlus, X, CheckCircle } from "lucide-react";
import { NIP98 } from "@nostrify/nostrify";

// Default public Blossom servers — user can override
const BLOSSOM_SERVERS = [
  "https://blossom.primal.net",
  "https://blossom.band",
  "https://cdn.satellite.earth",
];

async function uploadToBlossom({ file, signer, server = BLOSSOM_SERVERS[0] }) {
  const url = `${server}/upload`;

  // Build the request first (needed for NIP-98 payload hash)
  const arrayBuffer = await file.arrayBuffer();
  const request = new Request(url, {
    method: "PUT",
    body: arrayBuffer,
    headers: { "Content-Type": file.type },
  });

  // Generate NIP-98 auth event
  const template = await NIP98.template(request, { validatePayload: true });
  template.pubkey = await signer.getPublicKey();
  const authEvent = await signer.signEvent(template);
  const authHeader = "Nostr " + btoa(JSON.stringify(authEvent));

  // Upload
  const res = await fetch(url, {
    method: "PUT",
    body: arrayBuffer,
    headers: {
      "Content-Type": file.type,
      "Authorization": authHeader,
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.status);
    throw new Error(`Upload failed (${res.status}): ${text}`);
  }

  const json = await res.json();
  // BUD-02: response has { url, sha256, ... }
  const uploadedUrl = json?.url;
  if (!uploadedUrl) throw new Error("No URL in Blossom response");
  return uploadedUrl;
}

export function ImageUpload({ onUpload, label = "Upload Photo", signer }) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [uploaded, setUploaded] = useState(false);
  const [error, setError] = useState("");
  const [manualUrl, setManualUrl] = useState(false);
  const [manualInput, setManualInput] = useState("");
  const fileRef = useRef();

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Please select an image file."); return; }
    if (file.size > 25 * 1024 * 1024) { setError("Image must be under 25MB."); return; }

    setPreview(URL.createObjectURL(file));
    setUploading(true);
    setError("");

    // Try each Blossom server in order
    let lastError;
    for (const server of BLOSSOM_SERVERS) {
      try {
        const url = await uploadToBlossom({ file, signer, server });
        setUploaded(true);
        onUpload(url);
        setUploading(false);
        return;
      } catch (e) {
        lastError = e;
      }
    }

    setError("All Blossom servers failed: " + lastError?.message);
    setPreview(null);
    setUploading(false);
  }

  function handleManualUrl(e) {
    const v = e.target.value;
    setManualInput(v);
    if (v.startsWith("http")) {
      setPreview(v);
      onUpload(v);
    }
  }

  function clear() {
    setPreview(null); setUploaded(false); setError("");
    setManualInput(""); setManualUrl(false);
    if (fileRef.current) fileRef.current.value = "";
    onUpload("");
  }

  return (
    <div className="image-upload">
      {!preview ? (
        <>
          <div className="upload-zone" onClick={() => !manualUrl && fileRef.current?.click()}>
            {uploading ? (
              <div className="upload-uploading">
                <div className="pulse-dot" />
                <span>Uploading via Blossom…</span>
              </div>
            ) : (
              <>
                <ImagePlus size={24} />
                <span className="upload-label">{label}</span>
                <span className="upload-sub">Tap to choose from camera roll · Stored on Blossom</span>
              </>
            )}
          </div>

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFile}
            style={{ display: "none" }}
          />

          {!signer && (
            <p className="dim-small" style={{ marginTop: "4px" }}>
              You must be logged in to upload.
            </p>
          )}

          {!manualUrl ? (
            <button className="upload-manual-toggle" onClick={() => setManualUrl(true)}>
              Or paste an image URL instead
            </button>
          ) : (
            <input
              value={manualInput}
              onChange={handleManualUrl}
              placeholder="https://…"
              autoFocus
            />
          )}
        </>
      ) : (
        <div className="upload-preview">
          <img src={preview} alt="Preview" className="upload-preview-img" />
          <div className="upload-preview-footer">
            {uploaded && !uploading && (
              <span className="upload-success">
                <CheckCircle size={13} color="#39ff14" /> Uploaded to Blossom
              </span>
            )}
            {uploading && <span className="dim-small">Uploading…</span>}
            <button className="icon-btn" onClick={clear}><X size={14} /></button>
          </div>
        </div>
      )}

      {error && <div className="error-msg">{error}</div>}
    </div>
  );
}
