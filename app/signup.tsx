import React, { useState } from "react";
import { View, TextInput, StyleSheet, Alert, Text, TouchableOpacity, Platform } from "react-native";
import {
    getUser,
    getUserKey,
    isBiometricAvailable,
    requestBiometricRegistration,
    saveUser,
    validatePassword,
} from "@/tools/user";
import { useRouter } from "expo-router";
import { isAlphanumeric } from "@/tools/utils";

export default function SignupScreen() {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [enableBiometrics, setEnableBiometrics] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [message, setMessage] = useState("");
    const router = useRouter();

    function showMessage(title: string, details?: string) {
        const text = details ? `${title} ${details}` : title;
        setMessage(text);
        // Alert.alert maps to a blocking window.alert on web; the inline message covers it there.
        if (Platform.OS !== "web") {
            Alert.alert(title, details);
        }
    }

    async function handleSignup() {
        const normalizedUsername = username.trim();
        const passwordError = validatePassword(password);
        setMessage("");

        if (isSubmitting) {
            return;
        }
        if (isAlphanumeric(normalizedUsername) === false){
            showMessage("Le nom d'utilisateur ne doit comprendre que des caractères alphanumériques.");
            return;
        }
        if (passwordError) {
            showMessage(passwordError);
            return;
        }

        setIsSubmitting(true);
        try {
            const key = getUserKey(normalizedUsername)
            const existingUser = await getUser(key);
            if (existingUser) {
                showMessage("Un compte existe déjà. Veuillez vous connecter.");
                return;
            }
            await saveUser(normalizedUsername, password);

            if (enableBiometrics) {
                const biometricAvailable = await isBiometricAvailable();
                if (!biometricAvailable) {
                    showMessage("Biométrie indisponible", "Configurez Face ID, Touch ID ou une empreinte sur votre appareil.");
                    router.replace("/login");
                    return;
                }

                const biometricRegistered = await requestBiometricRegistration(normalizedUsername);
                if (!biometricRegistered) {
                    showMessage("Biométrie non activée", "Votre compte a été créé, mais la biométrie n'a pas été enregistrée.");
                    router.replace("/login");
                    return;
                }
            }

            setMessage("Compte enregistré avec succès !");
            router.replace("/login");
        } catch (error) {
            console.error(error);
            showMessage("Inscription impossible", "Veuillez réessayer.");
        } finally {
            setIsSubmitting(false);
        }
    }

    function redirectToLogin() {
        router.replace("/login");
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
      <TouchableOpacity
        style={[styles.toggleButton, enableBiometrics && styles.toggleButtonActive]}
        onPress={() => setEnableBiometrics((enabled) => !enabled)}
      >
          <Text style={styles.buttonText}>
            {enableBiometrics ? "Biométrie activée" : "Activer la biométrie"}
          </Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.button} onPress={handleSignup}>
          <Text style={styles.buttonText}>{isSubmitting ? "Création..." : "S'inscrire"}</Text>
      </TouchableOpacity>
      {message ? <Text style={styles.message}>{message}</Text> : null}
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

    toggleButton: {
    width: "100%",
    maxWidth: 200,
    height: 48,
    backgroundColor: "#535e61",
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
    },

    toggleButtonActive: {
    backgroundColor: "#2e7d32",
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
  message: {
    width: "100%",
    maxWidth: 400,
    color: "#ffddd2",
    textAlign: "center",
    marginBottom: 12,
  },
});
