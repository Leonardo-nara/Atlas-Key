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
      setError("Nao foi possivel salvar seu perfil agora.");
    } finally {
      setIsSaving(false);
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
          label="Modelo do veiculo"
          value={form.vehicleModel}
          onChangeText={(value) => setField("vehicleModel", value)}
        />

        <View style={styles.field}>
          <Text style={styles.label}>Tipo de veiculo</Text>
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
        {form.profilePhotoUrl ? (
          <Image source={{ uri: form.profilePhotoUrl }} style={styles.previewImage} />
        ) : null}

        <Field
          autoCapitalize="none"
          label="URL da foto da moto/veiculo (opcional)"
          value={form.vehiclePhotoUrl}
          onChangeText={(value) => setField("vehiclePhotoUrl", value)}
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
        style={styles.input}
        value={value}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fffaf0",
    borderRadius: 24,
    padding: 20,
    gap: 16,
    borderWidth: 1,
    borderColor: "#ead8b2"
  },
  field: {
    gap: 8
  },
  label: {
    fontWeight: "600",
    color: "#1f2933"
  },
  input: {
    borderWidth: 1,
    borderColor: "#d8c7aa",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "#ffffff"
  },
  optionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  optionButton: {
    borderWidth: 1,
    borderColor: "#d8c7aa",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#ffffff"
  },
  optionSelected: {
    backgroundColor: "#b65b1c",
    borderColor: "#b65b1c"
  },
  optionText: {
    color: "#6b4a1f",
    fontWeight: "600"
  },
  optionTextSelected: {
    color: "#fffaf0"
  },
  previewImage: {
    width: "100%",
    height: 180,
    borderRadius: 16,
    backgroundColor: "#efe1ca"
  },
  errorBox: {
    padding: 12,
    borderRadius: 14,
    backgroundColor: "#fff1f1"
  },
  errorText: {
    color: "#a82929"
  },
  primaryButton: {
    backgroundColor: "#b65b1c",
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center"
  },
  secondaryButton: {
    backgroundColor: "#efe1ca",
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center"
  },
  buttonPressed: {
    opacity: 0.9
  },
  buttonDisabled: {
    opacity: 0.6
  },
  primaryText: {
    color: "#fffaf0",
    fontWeight: "700",
    fontSize: 16
  },
  secondaryText: {
    color: "#8a5a00",
    fontWeight: "700"
  }
});
