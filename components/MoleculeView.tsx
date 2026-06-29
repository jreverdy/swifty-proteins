// Native implementation: renders the three.js viewer inside a react-native-webview.
// (Metro resolves MoleculeView.web.tsx for web builds instead of this file.)
import React, { forwardRef, useCallback, useImperativeHandle, useRef } from "react";
import { WebView, WebViewMessageEvent } from "react-native-webview";
import type { ViewerMessage } from "@/tools/moleculeViewer";
import type { MoleculeViewHandle, MoleculeViewProps } from "./MoleculeView.types";

const MoleculeView = forwardRef<MoleculeViewHandle, MoleculeViewProps>(function MoleculeView(
  { html, onViewerMessage, style },
  ref
) {
  const webRef = useRef<WebView>(null);

  useImperativeHandle(ref, () => ({
    requestScreenshot() {
      webRef.current?.injectJavaScript(
        `window.dispatchEvent(new MessageEvent('message', { data: JSON.stringify({ type: 'screenshot' }) })); true;`
      );
    },
  }));

  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      try {
        onViewerMessage(JSON.parse(event.nativeEvent.data) as ViewerMessage);
      } catch {
        // ignore non-JSON messages
      }
    },
    [onViewerMessage]
  );

  return (
    <WebView
      ref={webRef}
      originWhitelist={["*"]}
      source={{ html }}
      style={style}
      onMessage={handleMessage}
      javaScriptEnabled
      domStorageEnabled
      setSupportMultipleWindows={false}
      androidLayerType="hardware"
    />
  );
});

export default MoleculeView;
