import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  Platform,
} from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { cifErrorMessage, Molecule } from "@/tools/cif";
import { getMolecule, peekMolecule } from "@/tools/cache";
import {
  buildViewerHtml,
  buildViewerPayload,
  RenderModel,
  ViewerMessage,
} from "@/tools/moleculeViewer";
import MoleculeView from "@/components/MoleculeView";
import type { MoleculeViewHandle } from "@/components/MoleculeView.types";

const BACKGROUND = "#15171c";

type SelectedAtom = {
  id: string;
  element: string;
  x: number;
  y: number;
  z: number;
};

const MODELS: { key: RenderModel; label: string }[] = [
  { key: "ball-stick", label: "Ball & Stick" },
  { key: "stick", label: "Stick" },
  { key: "wireframe", label: "Wireframe" },
  { key: "space-filling", label: "Space-filling" },
];

export default function ProteinScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const ligandId = typeof id === "string" ? id : "";
  const router = useRouter();
  const viewRef = useRef<MoleculeViewHandle>(null);

  const [molecule, setMolecule] = useState<Molecule | null>(() => peekMolecule(ligandId));
  const [loading, setLoading] = useState(!molecule);
  const [errorText, setErrorText] = useState("");
  const [selected, setSelected] = useState<SelectedAtom | null>(null);
  const [model, setModel] = useState<RenderModel>("ball-stick");

  useEffect(() => {
    let cancelled = false;
    if (molecule) {
      return;
    }
    (async () => {
      try {
        setLoading(true);
        const loaded = await getMolecule(ligandId);
        if (!cancelled) {
          setMolecule(loaded);
          setErrorText("");
        }
      } catch (error) {
        if (!cancelled) {
          const { title, details } = cifErrorMessage(error);
          setErrorText(`${title}. ${details}`);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ligandId, molecule]);

  const html = useMemo(() => {
    if (!molecule) {
      return null;
    }
    return buildViewerHtml(buildViewerPayload(molecule, model, BACKGROUND));
  }, [molecule, model]);

  const shareScreenshot = useCallback(
    async (dataUrl: string) => {
      try {
        if (Platform.OS === "web") {
          // No native share sheet on web: trigger a download instead.
          const link = document.createElement("a");
          link.href = dataUrl;
          link.download = `${ligandId || "molecule"}.png`;
          link.click();
          return;
        }
        const base64 = dataUrl.replace(/^data:image\/png;base64,/, "");
        const fileUri = `${FileSystem.cacheDirectory}${ligandId || "molecule"}.png`;
        await FileSystem.writeAsStringAsync(fileUri, base64, {
          encoding: FileSystem.EncodingType.Base64,
        });
        const available = await Sharing.isAvailableAsync();
        if (!available) {
          Alert.alert("Sharing unavailable", "This device cannot share files.");
          return;
        }
        await Sharing.shareAsync(fileUri, {
          mimeType: "image/png",
          dialogTitle: `Ligand ${ligandId}`,
        });
      } catch (error) {
        console.error(error);
        Alert.alert("Share failed", "Could not capture or share the view.");
      }
    },
    [ligandId]
  );

  const onMessage = useCallback(
    (msg: ViewerMessage) => {
      if (msg.type === "select") {
        setSelected({ id: msg.id, element: msg.element, x: msg.x, y: msg.y, z: msg.z });
      } else if (msg.type === "deselect") {
        setSelected(null);
      } else if (msg.type === "error") {
        setErrorText(`Rendering error: ${msg.message}`);
      } else if (msg.type === "screenshot") {
        void shareScreenshot(msg.data);
      }
    },
    [shareScreenshot]
  );

  const onSharePress = useCallback(() => {
    viewRef.current?.requestScreenshot();
  }, []);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.iconButton} onPress={() => router.back()} accessibilityLabel="Back">
          <Text style={styles.iconText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>
          {ligandId}
        </Text>
        <TouchableOpacity
          style={styles.iconButton}
          onPress={onSharePress}
          disabled={!molecule}
          accessibilityLabel="Share"
        >
          <Text style={[styles.iconText, !molecule && styles.disabled]}>Share</Text>
        </TouchableOpacity>
      </View>

      {/* 3D viewer */}
      <View style={styles.viewer}>
        {html && (
          <MoleculeView
            ref={viewRef}
            html={html}
            onViewerMessage={onMessage}
            style={styles.webview}
          />
        )}

        {loading && (
          <View style={styles.overlay}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={styles.overlayText}>Loading {ligandId}…</Text>
          </View>
        )}

        {!!errorText && !loading && (
          <View style={styles.overlay}>
            <Text style={styles.errorText}>{errorText}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={() => router.back()}>
              <Text style={styles.retryText}>Go back</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Atom info tooltip */}
        {selected && (
          <View style={styles.tooltip} pointerEvents="none">
            <Text style={styles.tooltipTitle}>
              {selected.element} · {selected.id}
            </Text>
            <Text style={styles.tooltipLine}>
              x: {selected.x.toFixed(3)}  y: {selected.y.toFixed(3)}  z: {selected.z.toFixed(3)}
            </Text>
          </View>
        )}
      </View>

      {/* Model switcher (bonus: multiple visualization models) */}
      {molecule && !errorText && (
        <View style={styles.modelBar}>
          {MODELS.map((m) => (
            <TouchableOpacity
              key={m.key}
              style={[styles.modelButton, model === m.key && styles.modelButtonActive]}
              onPress={() => {
                setSelected(null);
                setModel(m.key);
              }}
            >
              <Text style={[styles.modelText, model === m.key && styles.modelTextActive]}>{m.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BACKGROUND },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingTop: Platform.OS === "ios" ? 56 : 16,
    paddingBottom: 12,
    backgroundColor: "#1d2026",
  },
  iconButton: { paddingVertical: 6, paddingHorizontal: 10, minWidth: 64 },
  iconText: { color: "#4da3ff", fontSize: 16, fontWeight: "600" },
  disabled: { color: "#555" },
  title: { color: "#fff", fontSize: 20, fontWeight: "bold", flex: 1, textAlign: "center" },
  viewer: { flex: 1, position: "relative" },
  webview: { flex: 1, backgroundColor: BACKGROUND },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(21,23,28,0.85)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  overlayText: { color: "#fff", marginTop: 12, fontSize: 16 },
  errorText: { color: "#ffb4a8", fontSize: 16, textAlign: "center", marginBottom: 16 },
  retryButton: { backgroundColor: "#2196F3", paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  retryText: { color: "#fff", fontWeight: "bold" },
  tooltip: {
    position: "absolute",
    top: 16,
    alignSelf: "center",
    backgroundColor: "rgba(0,0,0,0.8)",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  tooltipTitle: { color: "#fff", fontSize: 16, fontWeight: "bold", textAlign: "center" },
  tooltipLine: { color: "#cfd3da", fontSize: 12, marginTop: 4, textAlign: "center" },
  modelBar: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    backgroundColor: "#1d2026",
    paddingVertical: 8,
    paddingHorizontal: 6,
    gap: 6,
  },
  modelButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#2a2e36",
  },
  modelButtonActive: { backgroundColor: "#2196F3" },
  modelText: { color: "#aeb4bf", fontSize: 13, fontWeight: "600" },
  modelTextActive: { color: "#fff" },
});
