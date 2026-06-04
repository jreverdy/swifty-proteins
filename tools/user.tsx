import { Alert } from "react-native";
import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";


export async function hashPassword(password: string) {
  return await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    password
  );
}

export async function saveUser(username: string, password: string) {
  
  const passwordHash = await hashPassword(password);
  const key = getUserKey(username)
  await SecureStore.setItemAsync(
    key,
    JSON.stringify({ username, passwordHash })
  );
  Alert.alert("Compte enregistré avec succès !");
}

export async function getUser(key: string) {
  const user = await SecureStore.getItemAsync(key);
  return user ? JSON.parse(user) : null;
}

export function getUserKey(username: string) {
  return `USER_${username}`;
}
