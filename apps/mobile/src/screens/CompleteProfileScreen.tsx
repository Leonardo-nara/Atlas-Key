import { useEffect, useState } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import {
  CourierButton,
  CourierCard,
  CourierHeader,
  CourierScreen,
  FeedbackBanner,
  SectionTitle,
  courierTheme
} from "../components/courier-ui";
import { useAuth } from "../features/auth/auth-context";
import {
  buildCourierProfileForm,
  courierVehicleOptions,
  type CourierProfileFormValues,
  validateCourierProfileForm
} from "../features/courier/courier-profile";
import { pickImageFromLibrary } from "../lib/image-picker";
import { toMediaUrl } from "../lib/media-url";

type AppStackParamList = {
  CourierTabs: undefined;
  CompleteProfile: { forceCompletion: boolean } | undefined;
};

export function CompleteProfileScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const route = useRoute<RouteProp<AppStackParamList, "CompleteProfile">>();
  const {
    updateCourierProfile,
    uploadCourierProfileImage,
    removeCourierProfileImage,
    token,
    user
  } = useAuth();
  const [form, setForm] = useState<CourierProfileFormValues>(() =>
    buildCourierProfileForm(user)
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedProfileImage, setSelectedProfileImage] =
    useState<Awaited<ReturnType<typeof pickImageFromLibrary>>>(null);
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
      await updateCourierProfile({
        ...form,
        profilePhotoUrl: selectedProfileImage
          ? user?.courierProfile?.profilePhotoUrl ?? ""
          : form.profilePhotoUrl
      });

      if (selectedProfileImage) {
        await uploadCourierProfileImage(selectedProfileImage);
        setSelectedProfileImage(null);
      }

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

      if (field === "profilePhotoUrl") {
        setSelectedProfileImage(imageDataUrl);
        setField(field, imageDataUrl.uri);
      } else {
        setField(field, imageDataUrl.dataUrl ?? imageDataUrl.uri);
      }
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
    <CourierScreen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <CourierHeader
          description={
            forceCompletion
              ? "Complete os dados principais para liberar a operação no app."
              : "Atualize seus dados operacionais sempre que precisar."
          }
          title={forceCompletion ? "Complete seu perfil" : "Editar perfil"}
        />

        <CourierCard>
          <SectionTitle
            description="Essas informações ajudam a empresa a identificar você e seu veículo."
            title="Dados operacionais"
          />

          <Field
            label="Nome completo"
            value={form.name}
            onChangeText={(value) => setField("name", value)}
            testID="courier-profile-name"
          />
          <Field
            label="Telefone"
            value={form.phone}
            onChangeText={(value) => setField("phone", value)}
            testID="courier-profile-phone"
          />
          <Field
            label="Cidade"
            value={form.city}
            onChangeText={(value) => setField("city", value)}
            testID="courier-profile-city"
          />
          <Field
            autoCapitalize="characters"
            label="Placa"
            value={form.plate}
            onChangeText={(value) => setField("plate", value.toUpperCase())}
            testID="courier-profile-plate"
          />
          <Field
            label="Modelo do veículo"
            value={form.vehicleModel}
            onChangeText={(value) => setField("vehicleModel", value)}
            testID="courier-profile-vehicle-model"
          />

          <View style={styles.field}>
            <Text style={styles.label}>Tipo de veículo</Text>
            <View style={styles.optionsRow}>
              {courierVehicleOptions.map((option) => {
                const selected = form.vehicleType === option.value;

                return (
                  <Pressable
                    key={option.value}
                    accessibilityLabel={`Tipo de veículo ${option.label}`}
                    onPress={() => setField("vehicleType", option.value)}
                    style={[
                      styles.optionButton,
                      selected ? styles.optionSelected : undefined
                    ]}
                    testID={`courier-profile-vehicle-${option.value}`}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        selected ? styles.optionTextSelected : undefined
                      ]}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </CourierCard>

        <CourierCard>
          <SectionTitle
            description="Use imagens nítidas. Elas ajudam a empresa a reconhecer o motoboy certo."
            title="Fotos"
          />

          <Field
            autoCapitalize="none"
            label="URL da foto de perfil (opcional)"
            value={form.profilePhotoUrl}
            onChangeText={(value) => setField("profilePhotoUrl", value)}
            testID="courier-profile-photo-url"
          />
          <ImageUploadActions
            hasImage={Boolean(form.profilePhotoUrl)}
            onPick={() => void handlePickImage("profilePhotoUrl", "perfil")}
            onRemove={() => {
              setSelectedProfileImage(null);
              setField("profilePhotoUrl", "");
              void removeCourierProfileImage();
            }}
          />
          {form.profilePhotoUrl ? (
            <Image
              source={{
                uri: selectedProfileImage
                  ? selectedProfileImage.uri
                  : toMediaUrl(form.profilePhotoUrl) ?? form.profilePhotoUrl,
                headers:
                  !selectedProfileImage && token
                    ? { Authorization: `Bearer ${token}` }
                    : undefined
              }}
              style={styles.previewImage}
            />
          ) : null}

          <Field
            autoCapitalize="none"
            label="URL da foto do veículo (opcional)"
            value={form.vehiclePhotoUrl}
            onChangeText={(value) => setField("vehiclePhotoUrl", value)}
            testID="courier-profile-vehicle-photo-url"
          />
          <ImageUploadActions
            hasImage={Boolean(form.vehiclePhotoUrl)}
            onPick={() => void handlePickImage("vehiclePhotoUrl", "veículo")}
            onRemove={() => setField("vehiclePhotoUrl", "")}
          />
          {form.vehiclePhotoUrl ? (
            <Image source={{ uri: form.vehiclePhotoUrl }} style={styles.previewImage} />
          ) : null}
        </CourierCard>

        {error ? <FeedbackBanner message={error} tone="danger" /> : null}

        <CourierButton
          disabled={isSaving}
          label={
            isSaving
              ? "Salvando..."
              : forceCompletion
                ? "Salvar e continuar"
                : "Salvar perfil"
          }
          onPress={() => void handleSave()}
          testID="courier-profile-save"
        />

        {!forceCompletion ? (
          <CourierButton
            label="Voltar"
            onPress={() => navigation.goBack()}
            testID="courier-profile-back"
            variant="secondary"
          />
        ) : null}
      </ScrollView>
    </CourierScreen>
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
      <CourierButton label="Escolher da galeria" onPress={onPick} variant="secondary" />
      {hasImage ? (
        <CourierButton label="Remover imagem" onPress={onRemove} variant="danger" />
      ) : null}
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  autoCapitalize,
  testID
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  testID?: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        autoCapitalize={autoCapitalize}
        onChangeText={onChangeText}
        placeholderTextColor={courierTheme.colors.textMuted}
        style={styles.input}
        testID={testID}
        value={value}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 18,
    paddingBottom: 32
  },
  field: {
    gap: 8
  },
  label: {
    color: courierTheme.colors.text,
    fontWeight: "800"
  },
  input: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: courierTheme.colors.border,
    borderRadius: courierTheme.radii.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: courierTheme.colors.backgroundSecondary,
    color: courierTheme.colors.text
  },
  optionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  optionButton: {
    borderWidth: 1,
    borderColor: courierTheme.colors.border,
    borderRadius: courierTheme.radii.pill,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: courierTheme.colors.backgroundSecondary
  },
  optionSelected: {
    backgroundColor: courierTheme.colors.primary,
    borderColor: courierTheme.colors.primary
  },
  optionText: {
    color: courierTheme.colors.textMuted,
    fontWeight: "800"
  },
  optionTextSelected: {
    color: "#03111E"
  },
  previewImage: {
    width: "100%",
    height: 180,
    borderRadius: courierTheme.radii.md,
    backgroundColor: courierTheme.colors.surfaceElevated
  },
  imageActions: {
    gap: 10
  }
});
