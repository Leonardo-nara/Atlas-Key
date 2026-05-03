import * as ImagePicker from "expo-image-picker";

const ACCEPTED_MOBILE_IMAGE_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp"
];

const MAX_PROFILE_IMAGE_SIZE_BYTES = 3 * 1024 * 1024;

const IMAGE_PICKING_ERROR =
  "Não foi possível usar a imagem agora. Tente novamente com PNG, JPG ou WEBP.";

export interface PickedImageFile {
  uri: string;
  name: string;
  type: string;
  dataUrl?: string;
}

export async function pickImageFromLibrary(): Promise<PickedImageFile | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (!permission.granted) {
    throw new Error("Permita o acesso à galeria para escolher uma imagem.");
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    allowsEditing: true,
    aspect: [1, 1],
    base64: true,
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 0.82
  });

  if (result.canceled) {
    return null;
  }

  const asset = result.assets[0];
  const mimeType = asset.mimeType?.toLowerCase();

  if (!asset.uri || !mimeType || !ACCEPTED_MOBILE_IMAGE_MIME_TYPES.includes(mimeType)) {
    throw new Error(IMAGE_PICKING_ERROR);
  }

  if (asset.fileSize && asset.fileSize > MAX_PROFILE_IMAGE_SIZE_BYTES) {
    throw new Error("A imagem deve ter no máximo 3 MB.");
  }

  return {
    uri: asset.uri,
    name: asset.fileName ?? "foto-perfil.jpg",
    type: mimeType,
    dataUrl: asset.base64 ? `data:${mimeType};base64,${asset.base64}` : undefined
  };
}
