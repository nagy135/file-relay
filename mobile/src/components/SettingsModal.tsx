import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { loadFiles } from "../lib/api";
import { DEFAULT_SETTINGS } from "../lib/config";
import { normalizeBaseUrl } from "../lib/connection";
import type { Settings } from "../lib/types";
import { writeSettings } from "../lib/storage";
import { Button, colors, IconButton, s } from "./ui";

export default function SettingsModal({
  initial,
  onClose,
  onSave,
}: {
  initial: Settings;
  onClose: () => void;
  onSave: (settings: Settings) => void;
}) {
  const [draft, setDraft] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const update = (key: keyof Settings, value: string) =>
    setDraft((old) => ({ ...old, [key]: value }));
  async function save(signOut = false) {
    setBusy(true);
    setError("");
    try {
      const next = signOut
        ? { ...initial, username: "", password: "" }
        : {
            ...draft,
            baseUrl: normalizeBaseUrl(draft.baseUrl),
            username: draft.username.trim(),
          };
      if (!signOut && !!next.username !== !!next.password)
        throw new Error(
          "Enter both dashboard credentials, or leave both blank to use uploads only.",
        );
      if (next.username.includes(":"))
        throw new Error("The dashboard username cannot contain a colon.");
      if (next.username && !signOut) await loadFiles(next);
      await writeSettings(next);
      onSave(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save settings.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      animationType="slide"
      onRequestClose={() => {
        if (!busy) onClose();
      }}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: 24, gap: 22 }}
          >
            <View style={s.between}>
              <Text style={{ ...s.title, fontSize: 26 }}>Settings</Text>
              <IconButton
                label="Close settings"
                icon="x"
                disabled={busy}
                onPress={onClose}
              />
            </View>
            <Text style={s.body}>
              Connect to your relay. Use the same username and password as the
              web dashboard.
            </Text>
            <View style={{ gap: 8 }}>
              <Text style={s.label}>Relay URL</Text>
              <TextInput
                accessibilityLabel="Relay URL"
                style={s.input}
                value={draft.baseUrl}
                onChangeText={(value) => update("baseUrl", value)}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                maxLength={250}
                editable={!busy}
                placeholder={DEFAULT_SETTINGS.baseUrl}
              />
            </View>
            <View style={{ gap: 8 }}>
              <Text style={s.label}>Dashboard username</Text>
              <TextInput
                accessibilityLabel="Dashboard username"
                style={s.input}
                value={draft.username}
                onChangeText={(value) => update("username", value)}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="username"
                maxLength={128}
                editable={!busy}
              />
            </View>
            <View style={{ gap: 8 }}>
              <Text style={s.label}>Dashboard password</Text>
              <TextInput
                accessibilityLabel="Dashboard password"
                style={s.input}
                value={draft.password}
                onChangeText={(value) => update("password", value)}
                secureTextEntry
                autoComplete="current-password"
                maxLength={128}
                editable={!busy}
              />
            </View>
            <Text style={s.body}>
              Credentials are encrypted on this device. Sharing and uploading
              files does not require a dashboard account.
            </Text>
            {!!error && (
              <Text accessibilityRole="alert" style={s.error}>
                {error}
              </Text>
            )}
            {busy && <ActivityIndicator color={colors.accent} />}
            <Button
              label={busy ? "Connecting…" : "Save connection"}
              icon="check"
              primary
              disabled={busy}
              onPress={() => {
                void save();
              }}
            />
            {!!initial.username && (
              <Button
                label="Sign out of dashboard"
                icon="log-out"
                disabled={busy}
                onPress={() => {
                  void save(true);
                }}
              />
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}
