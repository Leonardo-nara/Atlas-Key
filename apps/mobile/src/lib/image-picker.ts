import * as ImagePicker from "expo-image-picker";

const ACCEPTED_MOBILE_IMAGE_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif"
];

const IMAGE_PICKING_ERROR =
  "Nao foi possivel usar a imagem agora. Tente novamente com PNG, JPG, WEBP ou GIF.";

export async function pickImageFromLibrary() {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (!permission.granted) {
    throw new Error("Permita o acesso a galeria para escolher uma imagem.");
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    allowsEditing: true,
    aspect: [1, 1],
    base64: true,
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 0.75
  });

  if (result.canceled) {
    return null;
  }

  const asset = result.assets[0];
  const mimeType = asset.mimeType?.toLowerCase();

  if (!asset.base64 || !mimeType || !ACCEPTED_MOBILE_IMAGE_MIME_TYPES.includes(mimeType)) {
    throw new Error(IMAGE_PICKING_ERROR);
  }

  return `data:${mimeType};base64,${asset.base64}`;
}
