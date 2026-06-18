import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
import * as bcrypt from "bcryptjs";
import { Platform } from "react-native";
import * as LocalAuthentication from "expo-local-authentication";

export type StoredUser = {
  username: string;
  passwordHash: string;
};

const BIOMETRIC_AUTHENTICATED_USER_KEY = "BIOMETRIC_AUTHENTICATED_USER";
const BIOMETRIC_CREDENTIAL_PREFIX = "BIOMETRIC_CREDENTIAL";
const BCRYPT_ROUNDS = 10;

async function setStoredValue(key: string, value: string) {
  if (Platform.OS === "web") {
    localStorage.setItem(key, value);
    return;
  }

  await SecureStore.setItemAsync(key, value);
}

async function getStoredValue(key: string) {
  if (Platform.OS === "web") {
    return localStorage.getItem(key);
  }

  return SecureStore.getItemAsync(key);
}

export async function hashPassword(password: string) {
  bcrypt.setRandomFallback((length) => Array.from(Crypto.getRandomBytes(length)));
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(password: string, passwordHash: string) {
  return bcrypt.compare(password, passwordHash);
}

export async function saveUser(username: string, password: string) {
  const passwordHash = await hashPassword(password);
  const key = getUserKey(username);
  await setStoredValue(
    key,
    JSON.stringify({ username, passwordHash })
  );
}

export async function getUser(key: string): Promise<StoredUser | null> {
  const user = await getStoredValue(key);
  return user ? JSON.parse(user) : null;
}

export function getUserKey(username: string) {
  return `USER_${username.trim().toLowerCase()}`;
}

function getBiometricCredentialKey(username: string) {
  return `${BIOMETRIC_CREDENTIAL_PREFIX}_${username.trim().toLowerCase()}`;
}

function getBiometricStoreOptions(username: string): SecureStore.SecureStoreOptions {
  return {
    requireAuthentication: true,
    authenticationPrompt: `Connexion biométrique - ${username}`,
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  };
}

export async function isBiometricAvailable() {
  if (Platform.OS === "web") {
    return false;
  }

  const [hasHardware, isEnrolled] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
  ]);

  return hasHardware && isEnrolled;
}

export function validatePassword(password: string) {
  if (password.length < 8) {
    return "Le mot de passe doit contenir au moins 8 caractères.";
  }
  if (!/[A-Z]/.test(password)) {
    return "Le mot de passe doit contenir au moins une majuscule.";
  }
  if (!/[a-z]/.test(password)) {
    return "Le mot de passe doit contenir au moins une minuscule.";
  }
  if (!/[0-9]/.test(password)) {
    return "Le mot de passe doit contenir au moins un chiffre.";
  }
  return null;
}

export async function registerBiometricAuthenticatedUser(username: string) {
  if (Platform.OS === "web") {
    await setStoredValue(BIOMETRIC_AUTHENTICATED_USER_KEY, username);
    return;
  }

  await SecureStore.setItemAsync(
    getBiometricCredentialKey(username),
    username,
    getBiometricStoreOptions(username)
  );
  await setStoredValue(BIOMETRIC_AUTHENTICATED_USER_KEY, username);
}

export async function requestBiometricRegistration(username: string) {
  if (Platform.OS === "web") {
    return false;
  }

  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: `Activer la biométrie - ${username}`,
    cancelLabel: "Annuler",
    fallbackLabel: "Utiliser le code du téléphone",
    disableDeviceFallback: false,
  });

  if (!result.success) {
    return false;
  }

  await registerBiometricAuthenticatedUser(username);
  return true;
}

export async function getBiometricAuthenticatedUser() {
  return getStoredValue(BIOMETRIC_AUTHENTICATED_USER_KEY);
}

export async function verifyBiometricAuthenticatedUser(username: string) {
  if (Platform.OS === "web") {
    return false;
  }

  const authenticatedUser = await SecureStore.getItemAsync(
    getBiometricCredentialKey(username),
    getBiometricStoreOptions(username)
  );

  return authenticatedUser === username;
}
