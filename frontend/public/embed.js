(function () {
  const SCRIPT_ID = "typeform-clone-embed";

  function createEmbed(element, options) {
    const url = new URL(options.url);
    url.searchParams.set("embed", "true");
    if (options.hideHeaders) url.searchParams.set("hide_headers", "true");
    
    const iframe = document.createElement("iframe");
    iframe.src = url.toString();
    iframe.style.border = "none";
    
    if (options.mode === "standard") {
      iframe.style.width = options.width || "100%";
      iframe.style.height = options.height || "500px";
      element.appendChild(iframe);
    } else if (options.mode === "fullpage") {
      iframe.style.position = "fixed";
      iframe.style.top = "0";
      iframe.style.left = "0";
      iframe.style.width = "100%";
      iframe.style.height = "100%";
      iframe.style.zIndex = "9999";
      document.body.appendChild(iframe);
    } else if (options.mode === "popup") {
      // Simplified popup overlay
      const overlay = document.createElement("div");
      overlay.style.position = "fixed";
      overlay.style.inset = "0";
      overlay.style.backgroundColor = "rgba(0,0,0,0.5)";
      overlay.style.zIndex = "9998";
      overlay.style.display = "flex";
      overlay.style.alignItems = "center";
      overlay.style.justifyContent = "center";
      
      iframe.style.width = options.width || "80%";
      iframe.style.height = options.height || "80%";
      iframe.style.backgroundColor = "white";
      iframe.style.borderRadius = "8px";
      iframe.style.boxShadow = "0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)";
      
      const closeBtn = document.createElement("button");
      closeBtn.innerHTML = "&times;";
      closeBtn.style.position = "absolute";
      closeBtn.style.top = "20px";
      closeBtn.style.right = "20px";
      closeBtn.style.fontSize = "24px";
      closeBtn.style.background = "none";
      closeBtn.style.border = "none";
      closeBtn.style.color = "white";
      closeBtn.style.cursor = "pointer";
      
      closeBtn.onclick = () => overlay.remove();
      
      overlay.appendChild(closeBtn);
      overlay.appendChild(iframe);
      
      if (options.openOnInit) {
        document.body.appendChild(overlay);
      }
      
      // Bind to launch button if provided
      if (options.launchButtonId) {
        const btn = document.getElementById(options.launchButtonId);
        if (btn) btn.onclick = () => document.body.appendChild(overlay);
      }
    }
  }

  window.TypeformClone = { createEmbed };

  // Auto-init for data-tf-live elements
  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-tf-live]").forEach((el) => {
      const url = el.getAttribute("data-tf-live");
      const mode = el.getAttribute("data-tf-mode") || "standard";
      const launchButtonId = el.getAttribute("data-tf-launch");
      if (url) {
        createEmbed(el, { mode, url, launchButtonId });
      }
    });
  });
})();
