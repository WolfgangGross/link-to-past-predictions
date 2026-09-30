/** Full-screen intro clip: a white flash, then the video fades in over it. Resolves when it ends or is skipped. */
export function playIntro(src: string): Promise<void> {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.style.cssText =
      "position:fixed;inset:0;z-index:10;background:#fff;opacity:0;transition:opacity 150ms ease-out,background-color 900ms ease-in;";
    const video = document.createElement("video");
    video.src = src;
    video.playsInline = true;
    video.style.cssText = "width:100%;height:100%;object-fit:contain;opacity:0;transition:opacity 900ms ease-in;";
    overlay.append(video);
    document.body.append(overlay);

    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      window.removeEventListener("keydown", onKey);
      overlay.style.transition = "none";
      overlay.style.backgroundColor = "#0e0e12";
      video.pause();
      resolve();
      // Leave the overlay up for one frame so the next scene is drawn before it disappears.
      requestAnimationFrame(() => {
        overlay.style.transition = "opacity 400ms ease-out";
        overlay.style.opacity = "0";
        setTimeout(() => overlay.remove(), 450);
      });
    };
    const onKey = (e: KeyboardEvent) => {
      if (!e.repeat && (e.code === "Escape" || e.code === "Space" || e.code === "Enter")) finish();
    };
    video.addEventListener("ended", finish);
    video.addEventListener("error", finish);

    requestAnimationFrame(() => {
      overlay.style.opacity = "1"; // the flash
      setTimeout(() => {
        window.addEventListener("keydown", onKey);
        void video.play().then(
          () => {
            video.style.opacity = "1";
            overlay.style.backgroundColor = "#0e0e12";
          },
          finish,
        );
      }, 200);
    });
  });
}
