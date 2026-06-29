import type { StyleProp, ViewStyle } from "react-native";
import type { ViewerMessage } from "@/tools/moleculeViewer";

export type MoleculeViewProps = {
  /** Full self-contained HTML document for the three.js viewer. */
  html: string;
  /** Called with each message emitted by the viewer (select / deselect / screenshot / …). */
  onViewerMessage: (msg: ViewerMessage) => void;
  style?: StyleProp<ViewStyle>;
};

export type MoleculeViewHandle = {
  /** Ask the viewer to capture the current frame; the PNG comes back as a `screenshot` message. */
  requestScreenshot: () => void;
};
