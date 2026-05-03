import { useEffect, useState } from "react";
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { ScreenContainer } from "../components/ScreenContainer";
import { SectionHeader } from "../components/SectionHeader";
import { useAuth } from "../features/auth/auth-context";
import {
  buildCourierProfileForm,
  courierVehicleOptions,
  type CourierProfileFormValues,
  validateCourierProfileForm
} from "../features/courier/courier-profile";
import { pickImageFromLibrary } from "../lib/image-picker";
import { mobileShadow, mobileTheme } from "../theme";

type AppStackParamList = {
  CourierTabs: undefined;
  CompleteProfile: { forceCompletion: boolean } | undefined;
};

export function CompleteProfileScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const route = useRoute<RouteProp<AppStackParamList, "CompleteProfile">>();
  const { updateCourierProfile, user } = useAuth();
  const [form, setForm] = useState<CourierProfileFormValues>(() =>
    buildCourierProfileForm(user)
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const forceCompletion = route.params?.forceCompletion ?? false;

  useEffect(() => {
    setForm(buildCourierProfileForm(user));
  }, [user]);

  function setField<K extends keyof CourierProfileFormValues>(
    field: K,
    value: CourierProfileFormValues[K]
  ) {
    setForm((current) => ({
      ...current,
      [field]: value
    }));
  }

  async function handleSave() {
    const validationError = validateCourierProfileForm(form);

    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await updateCourierProfile(form);

      if (forceCompletion) {
        navigation.reset({
          index: 0,
          routes: [{ name: "CourierTabs" }]
        });
      } else {
        navigation.goBack();
      }
    } catch {
      setError("Não foi possível salvar seu perfil agora.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handlePickImage(
    field: "profilePhotoUrl" | "vehiclePhotoUrl",
    label: string
  ) {
    try {
      const imageDataUrl = await pickImageFromLibrary();

      if (!imageDataUrl) {
        return;
      }

      setField(field, imageDataUrl);
      setError(null);
    } catch (pickError) {
      if (pickError instanceof Error) {
        setError(pickError.message);
      } else {
        setError(`Não foi possível carregar a imagem de ${label}.`);
      }
    }
  }

  return (
    <ScreenContainer scrollable>
      <SectionHeader
        title={forceCompletion ? "Complete seu perfil" : "Editar perfil"}
        description={
          forceCompletion
            ? "Antes de operar no app, complete os dados principais do seu perfil de motoboy."
            : "Atualize seus dados operacionais sempre que precisar."
        }
      />

      <View style={styles.card}>
        <Field label="Nome completo" value={form.name} onChangeText={(value) => setField("name", value)} />
        <Field label="Telefone" value={form.phone} onChangeText={(value) => setField("phone", value)} />
        <Field label="Cidade" value={form.city} onChangeText={(value) => setField("city", value)} />
        <Field
          autoCapitalize="characters"
          label="Placa"
          value={form.plate}
          onChangeText={(value) => setField("plate", value.toUpperCase())}
        />
        <Field
          label="Modelo do veículo"
          value={form.vehicleModel}
          onChangeText={(value) => setField("vehicleModel", value)}
        />

        <View style={styles.field}>
          <Text style={styles.label}>Tipo de veículo</Text>
          <View style={styles.optionsRow}>
            {courierVehicleOptions.map((option) => {
              const selected = form.vehicleType === option.value;

              return (
                <Pressable
                  key={option.value}
                  onPress={() => setField("vehicleType", option.value)}
                  style={[styles.optionButton, selected ? styles.optionSelected : undefined]}
                >
                  <Text style={[styles.optionText, selected ? styles.optionTextSelected : undefined]}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Field
          autoCapitalize="none"
          label="URL da foto de perfil (opcional)"
          value={form.profilePhotoUrl}
          onChangeText={(value) => setField("profilePhotoUrl", value)}
        />
        <ImageUploadActions
          hasImage={Boolean(form.profilePhotoUrl)}
          onPick={() => void handlePickImage("profilePhotoUrl", "perfil")}
          onRemove={() => setField("profilePhotoUrl", "")}
        />
        {form.profilePhotoUrl ? (
          <Image source={{ uri: form.profilePhotoUrl }} style={styles.previewImage} />
        ) : null}

        <Field
          autoCapitalize="none"
          label="URL da foto do veículo (opcional)"
          value={form.vehiclePhotoUrl}
          onChangeText={(value) => setField("vehiclePhotoUrl", value)}
        />
        <ImageUploadActions
          hasImage={Boolean(form.vehiclePhotoUrl)}
          onPick={() => void handlePickImage("vehiclePhotoUrl", "veículo")}
          onRemove={() => setField("vehiclePhotoUrl", "")}
        />
        {form.vehiclePhotoUrl ? (
          <Image source={{ uri: form.vehiclePhotoUrl }} style={styles.previewImage} />
        ) : null}

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <Pressable
          disabled={isSaving}
          onPress={() => void handleSave()}
          style={({ pressed }) => [
            styles.primaryButton,
            pressed ? styles.buttonPressed : undefined,
            isSaving ? styles.buttonDisabled : undefined
          ]}
        >
          <Text style={styles.primaryText}>
            {isSaving ? "Salvando..." : forceCompletion ? "Salvar e continuar" : "Salvar perfil"}
          </Text>
        </Pressable>

        {!forceCompletion ? (
          <Pressable onPress={() => navigation.goBack()} style={styles.secondaryButton}>
            <Text style={styles.secondaryText}>Voltar</Text>
          </Pressable>
        ) : null}
      </View>
    </ScreenContainer>
  );
}

function ImageUploadActions({
  hasImage,
  onPick,
  onRemove
}: {
  hasImage: boolean;
  onPick: () => void;
  onRemove: () => void;
}) {
  return (
    <View style={styles.imageActions}>
      <Pressable onPress={onPick} style={styles.secondaryButton}>
        <Text style={styles.secondaryText}>Escolher da galeria</Text>
      </Pressable>
      {hasImage ? (
        <Pressable onPress={onRemove} style={styles.ghostButton}>
          <Text style={styles.ghostText}>Remover imagem</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  autoCapitalize
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        autoCapitalize={autoCapitalize}
        onChangeText={onChangeText}
        placeholderTextColor={mobileTheme.colors.textSoft}
        style={styles.input}
        value={value}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: mobileTheme.colors.surface,
    borderRadius: mobileTheme.radii.lg,
    padding: 20,
    gap: 16,
    borderWidth: 1,
    borderColor: mobileTheme.colors.border,
    ...mobileShadow
  },
  field: {
    gap: 8
  },
  label: {
    fontWeight: "700",
    color: mobileTheme.colors.text
  },
  input: {
    borderWidth: 1,
    borderColor: mobileTheme.colors.borderStrong,
    borderRadius: mobileTheme.radii.sm,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: mobileTheme.colors.surfaceMuted,
    color: mobileTheme.colors.text
  },
  optionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  optionButton: {
    borderWidth: 1,
    borderColor: mobileTheme.colors.borderStrong,
    borderRadius: mobileTheme.radii.pill,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: mobileTheme.colors.surfaceMuted
  },
  optionSelected: {
    backgroundColor: mobileTheme.colors.primaryStrong,
    borderColor: mobileTheme.colors.primaryStrong
  },
  optionText: {
    color: mobileTheme.colors.textMuted,
    fontWeight: "700"
  },
  optionTextSelected: {
    color: "#ffffff"
  },
  previewImage: {
    width: "100%",
    height: 180,
    borderRadius: mobileTheme.radii.sm,
    backgroundColor: mobileTheme.colors.surfaceStrong
  },
  imageActions: {
    gap: 10
  },
  errorBox: {
    padding: 12,
    borderRadius: mobileTheme.radii.sm,
    backgroundColor: mobileTheme.colors.dangerSoft
  },
  errorText: {
    color: mobileTheme.colors.danger
  },
  primaryButton: {
    backgroundColor: mobileTheme.colors.primaryStrong,
    paddingVertical: 14,
    borderRadius: mobileTheme.radii.sm,
    alignItems: "center"
  },
  secondaryButton: {
    backgroundColor: mobileTheme.colors.primarySoft,
    paddingVertical: 14,
    borderRadius: mobileTheme.radii.sm,
    alignItems: "center",
    borderWidth: 1,
    borderColor: mobileTheme.colors.borderStrong
  },
  buttonPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.985 }]
  },
  buttonDisabled: {
    opacity: 0.6
  },
  primaryText: {
    color: "#ffffff",
    fontWeight: "800",
    fontSize: 16
  },
  secondaryText: {
    color: mobileTheme.colors.primaryStrong,
    fontWeight: "800"
  },
  ghostButton: {
    paddingVertical: 12,
    borderRadius: mobileTheme.radii.sm,
    alignItems: "center",
    borderWidth: 1,
    borderColor: mobileTheme.colors.borderStrong,
    backgroundColor: mobileTheme.colors.surfaceMuted
  },
  ghostText: {
    color: mobileTheme.colors.textMuted,
    fontWeight: "700"
  }
});
