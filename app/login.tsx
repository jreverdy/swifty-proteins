import React, { useState } from "react";
import { View, TextInput, Button, StyleSheet, Alert, Text, TouchableOpacity } from "react-native";
import { getUser, getUserKey, hashPassword } from "@/tools/user";
import { useRouter } from "expo-router";
import { isAlphanumeric } from "@/tools/utils";


export default function LoginScreen() {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const router = useRouter();

    async function handleLogin() {
        if (isAlphanumeric(username) === false){
            Alert.alert("Le nom d'utilisateur ne doit comprendre que des caractères alphanumériques.");
            return;
        }

        const key = getUserKey(username)
        const storedUser = await getUser(key);
        console.log("storeUser", storedUser)
        if (!storedUser) {
            Alert.alert("Identifiants incorrects");
            return;
        }

        const passwordHash = await hashPassword(password);

        if (storedUser.passwordHash !== passwordHash) {
            Alert.alert("Mot de passe incorrect");
            return;
        }
        router.replace("/home");
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
                <Text style={styles.buttonText}>Se connecter</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.buttonSecondary} onPress={redirectToSignup}>
                <Text style={styles.buttonText}>S'inscrire</Text>
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
