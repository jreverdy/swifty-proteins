import React, { useEffect, useState } from "react";
import { View, TextInput, StyleSheet, Alert, Text, TouchableOpacity, Platform } from "react-native";
import {
    getBiometricAuthenticatedUser,
    getUser,
    getUserKey,
    isBiometricAvailable,
    verifyBiometricAuthenticatedUser,
    verifyPassword,
} from "@/tools/user";
import { useRouter } from "expo-router";
import { isAlphanumeric } from "@/tools/utils";

export default function LoginScreen() {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [biometricAvailable, setBiometricAvailable] = useState(false);
    const [biometricUser, setBiometricUser] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [message, setMessage] = useState("");
    const router = useRouter();

    useEffect(() => {
        async function checkBiometricAvailability() {
            const [deviceBiometricAvailable, storedBiometricUser] = await Promise.all([
                isBiometricAvailable(),
                getBiometricAuthenticatedUser(),
            ]);
            const storedUser = storedBiometricUser
                ? await getUser(getUserKey(storedBiometricUser))
                : null;

            setBiometricUser(storedUser?.username ?? null);
            setBiometricAvailable(deviceBiometricAvailable);
        }

        checkBiometricAvailability();
    }, []);

    function showMessage(title: string, details?: string) {
        const text = details ? `${title} ${details}` : title;
        setMessage(text);
        // Alert.alert maps to a blocking window.alert on web; the inline message covers it there.
        if (Platform.OS !== "web") {
            Alert.alert(title, details);
        }
    }

    async function handleLogin() {
        const normalizedUsername = username.trim();
        setMessage("");

        if (isSubmitting) {
            return;
        }
        if (isAlphanumeric(normalizedUsername) === false){
            showMessage("Le nom d'utilisateur ne doit comprendre que des caractères alphanumériques.");
            return;
        }
        if (!password) {
            showMessage("Veuillez saisir votre mot de passe.");
            return;
        }

        setIsSubmitting(true);
        try {
            const key = getUserKey(normalizedUsername)
            const storedUser = await getUser(key);
            if (!storedUser) {
                showMessage("Identifiants incorrects");
                return;
            }

            const isPasswordValid = await verifyPassword(password, storedUser.passwordHash);

            if (!isPasswordValid) {
                showMessage("Mot de passe incorrect");
                return;
            }
            router.replace("/home");
        } catch (error) {
            console.error(error);
            showMessage("Connexion impossible", "Veuillez réessayer.");
        } finally {
            setIsSubmitting(false);
        }
    }

    async function handleBiometricLogin() {
        const requestedUsername = username.trim();
        const targetUsername = requestedUsername || biometricUser;

        if (!targetUsername) {
            showMessage("Connexion biométrique indisponible", "Saisissez le compte associé à la biométrie.");
            return;
        }

        if (isAlphanumeric(targetUsername) === false) {
            showMessage("Le nom d'utilisateur ne doit comprendre que des caractères alphanumériques.");
            return;
        }

        const storedUser = await getUser(getUserKey(targetUsername));
        if (!storedUser) {
            showMessage("Compte introuvable");
            return;
        }

        try {
            const isBiometricUserValid = await verifyBiometricAuthenticatedUser(storedUser.username);
            if (!isBiometricUserValid) {
                showMessage("Authentification échouée", "La biométrie n'est plus valide pour ce compte.");
                return;
            }
            router.replace("/home");
        } catch (error) {
            console.error(error);
            showMessage(
                "Authentification échouée",
                "Réessayez ou connectez-vous avec votre mot de passe."
            );
        }
    }

    function redirectToSignup() {
        router.push("/signup");
    }

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Connexion</Text>
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
            <TouchableOpacity style={styles.button} onPress={handleLogin}>
                <Text style={styles.buttonText}>{isSubmitting ? "Connexion..." : "Se connecter"}</Text>
            </TouchableOpacity>
            {biometricAvailable && (
                <TouchableOpacity style={styles.buttonBiometric} onPress={handleBiometricLogin}>
                    <Text style={styles.buttonText}>Biométrie {biometricUser ? `(${biometricUser})` : ""}</Text>
                </TouchableOpacity>
            )}
            {message ? <Text style={styles.message}>{message}</Text> : null}
            <TouchableOpacity style={styles.buttonSecondary} onPress={redirectToSignup}>
                <Text style={styles.buttonText}>Créer un compte</Text>
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

        buttonBiometric: {
        width: "100%",
        maxWidth: 200,
        height: 48,
        backgroundColor: "#2e7d32",
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

        message: {
        width: "100%",
        maxWidth: 400,
        color: "#ffddd2",
        textAlign: "center",
        marginBottom: 12,
    },

});
