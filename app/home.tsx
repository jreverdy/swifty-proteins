import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  StyleSheet,
  Platform,
  Pressable,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
} from "react-native";
import { Asset } from "expo-asset";
import * as FileSystem from "expo-file-system/legacy";
import { useRouter } from "expo-router";
import { getMolecule } from "@/tools/cache";
import { cifErrorMessage } from "@/tools/cif";

export default function LigandList() {
  const [ligands, setLigands] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    loadLigands();
  }, []);

  async function loadLigands() {
    try {
      // Metro needs require() for bundled text assets.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const asset = Asset.fromModule(require("../assets/ligands.txt"));
      await asset.downloadAsync();

      const fileUri = asset.localUri || asset.uri;
      const content =
        Platform.OS === "web"
          ? await fetch(asset.uri).then((response) => response.text())
          : await FileSystem.readAsStringAsync(fileUri);

      const lines = content
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
      setLigands(lines);
      setError("");
    } catch (loadError) {
      console.error(loadError);
      setError("Impossible de charger la liste des ligands.");
    }
  }

  const selectLigand = useCallback(
    async (ligand: string) => {
      if (loadingId) {
        return;
      }
      setError("");
      setLoadingId(ligand);
      try {
        // Fetch + parse before navigating, so the loading indicator stays on the list.
        await getMolecule(ligand);
        router.push({ pathname: "/protein", params: { id: ligand } });
      } catch (fetchError) {
        const { title, details } = cifErrorMessage(fetchError);
        if (Platform.OS === "web") {
          setError(`${title}. ${details}`);
        } else {
          Alert.alert(title, details);
        }
      } finally {
        setLoadingId(null);
      }
    },
    [loadingId, router]
  );

  const filteredLigands = ligands.filter((ligand) =>
    ligand.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Ligands</Text>
        <TouchableOpacity onPress={() => router.replace("/login")} style={styles.logout}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      <TextInput
        placeholder="Search for a ligand..."
        value={search}
        onChangeText={setSearch}
        style={styles.input}
        autoCapitalize="characters"
        autoCorrect={false}
        placeholderTextColor="#888"
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <FlatList
        data={filteredLigands}
        keyExtractor={(item) => item}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={20}
        windowSize={10}
        removeClippedSubviews
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
            onPress={() => selectLigand(item)}
            disabled={loadingId !== null}
            accessibilityRole="button"
            accessibilityLabel={`Open ligand ${item}`}
          >
            <Text style={styles.itemText}>{item}</Text>
            {loadingId === item ? (
              <ActivityIndicator size="small" color="#2196F3" />
            ) : (
              <Text style={styles.chevron}>›</Text>
            )}
          </Pressable>
        )}
        ListEmptyComponent={
          ligands.length > 0 ? <Text style={styles.empty}>No ligand matches “{search}”.</Text> : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#fff" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 20,
    marginBottom: 16,
  },
  title: { fontSize: 32, fontWeight: "bold", color: "#000" },
  logout: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, backgroundColor: "#535e61" },
  logoutText: { color: "#fff", fontWeight: "600" },
  input: {
    height: 44,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 12,
    fontSize: 16,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#ddd",
  },
  itemPressed: { backgroundColor: "#eef4ff" },
  itemText: { fontSize: 16, color: "#111", fontWeight: "500" },
  chevron: { fontSize: 22, color: "#bbb" },
  error: { color: "#b00020", marginBottom: 12, textAlign: "center" },
  empty: { textAlign: "center", color: "#888", marginTop: 24 },
});
