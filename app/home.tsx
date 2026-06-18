import React, { useEffect, useState } from "react";
import { View, Text, FlatList, TextInput, StyleSheet, Platform } from "react-native";
import { Asset } from "expo-asset";
import * as FileSystem from "expo-file-system/legacy";


export default function LigandList() {
  const [ligands, setLigands] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

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
      const content = Platform.OS === "web"
        ? await fetch(asset.uri).then(response => response.text())
        : await FileSystem.readAsStringAsync(fileUri);

      const lines = content.split("\n").map(line => line.trim()).filter(Boolean);
      setLigands(lines);
      setError("");
    } catch (loadError) {
      console.error(loadError);
      setError("Impossible de charger la liste des ligands.");
    }
  }

  const filteredLigands = ligands.filter(ligand =>
    ligand.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <View style={styles.container}>
        <Text style={styles.title}>Ligands list</Text>
        <TextInput
        placeholder="Search for a ligand..."
        value={search}
        onChangeText={setSearch}
        style={styles.input}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <FlatList
        data={filteredLigands}
        keyExtractor={(item) => item}
        renderItem={({ item }) => (
            <Text style={styles.item}>{item}</Text>
        )}
        />
    </View>
  );
}

const styles = StyleSheet.create({
    title: {
        fontSize: 32,
        fontWeight: "bold",
        color: "#000000",
        marginBottom: 20,
        marginTop: 20,
        textAlign: "center",
    },
    container: { flex: 1, padding: 16 },
    input: {
        height: 40,
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 10,
        marginBottom: 12,
    },
    item: {
        padding: 12,
        borderBottomWidth: 1,
  },
    error: {
        color: "#b00020",
        marginBottom: 12,
        textAlign: "center",
    },
});
