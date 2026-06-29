// Web implementation: react-native-webview is not supported on web, so we render
// the same self-contained viewer HTML in an <iframe>. The viewer posts its messages
// to window.parent (see send() in moleculeViewer.ts) and listens for screenshot
// requests via postMessage to its own window.
import React, { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import type { ViewerMessage } from "@/tools/moleculeViewer";
import type { MoleculeViewHandle, MoleculeViewProps } from "./MoleculeView.types";

const MoleculeView = forwardRef<MoleculeViewHandle, MoleculeViewProps>(function MoleculeView(
  { html, onViewerMessage },
  ref
) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useImperativeHandle(ref, () => ({
    requestScreenshot() {
      iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ type: "screenshot" }), "*");
    },
  }));

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (typeof event.data !== "string") {
        return;
      }
      try {
        onViewerMessage(JSON.parse(event.data) as ViewerMessage);
      } catch {
        // ignore non-JSON messages
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [onViewerMessage]);

  return (
    <iframe
      ref={iframeRef}
      srcDoc={html}
      title="molecule-viewer"
      style={{ border: "none", width: "100%", height: "100%", background: "#15171c" }}
    />
  );
});

export default MoleculeView;
