import React from "react";
import * as SecureStore from "expo-secure-store";
import { View, TextInput, Button, StyleSheet, Alert, Text, TouchableOpacity } from "react-native";
import { useState } from "react";
import { getUser, getUserKey, hashPassword } from "@/tools/user";
import { useRouter } from "expo-router";
import { isAlphanumeric } from "@/tools/utils";

export default function SignupScreen() {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const router = useRouter();

    async function handleSignup() {
        if (isAlphanumeric(username) === false){
            Alert.alert("Le nom d'utilisateur ne doit comprendre que des caractères alphanumériques.");
            return;
        }
        const key = getUserKey(username)
        const existingUser = await getUser(key);
        if (existingUser) {
            Alert.alert("Un compte existe déjà. Veuillez vous connecter.");
            return;
        }
        const passwordHash = await hashPassword(password);
        await SecureStore.setItemAsync(
            key,
            JSON.stringify({ username, passwordHash })
        );
        // not working
        redirectToLogin();
        Alert.alert("Compte enregistré avec succès !");
    }

    function redirectToLogin() {
        router.push("/login");
    }

 return (
    <View style={styles.container}>
      <Text style={styles.title}>Inscription</Text>
      <TextInput
        style={styles.input}
        placeholder="Username"
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
        placeholderTextColor="#666"
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        placeholderTextColor="#666"
      />
      <TouchableOpacity style={styles.button} onPress={handleSignup}>
          <Text style={styles.buttonText}>S'inscrire</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.buttonSecondary} onPress={redirectToLogin}>
          <Text style={styles.buttonText}>Se connecter</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 40,
    textAlign: "center",
  },
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#25292e",
    padding: 16,
  },
  input: {
    width: "100%",
    maxWidth: 400,
    height: 48,
    backgroundColor: "#fff",
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 12,
    fontSize: 16,
  },
  button: {
    width: "100%",
    maxWidth: 200,
    height: 48,
    backgroundColor: "#2196F3",
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
    },

    buttonSecondary: {
    width: "100%",
    maxWidth: 200,
    height: 48,
    backgroundColor: "#535e61",
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    },

    buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
});
