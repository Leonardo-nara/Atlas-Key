import {
  ValidatorConstraint,
  type ValidatorConstraintInterface
} from "class-validator";

const IMAGE_DATA_URL_PATTERN =
  /^data:image\/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=]+$/i;

@ValidatorConstraint({ name: "imageReference", async: false })
export class ImageReferenceConstraint implements ValidatorConstraintInterface {
  validate(value: unknown) {
    if (value === undefined || value === null || value === "") {
      return true;
    }

    if (typeof value !== "string") {
      return false;
    }

    if (value.length > 2_000_000) {
      return false;
    }

    return isHttpUrl(value) || IMAGE_DATA_URL_PATTERN.test(value);
  }

  defaultMessage() {
    return "A imagem deve ser uma URL http/https valida ou um arquivo de imagem enviado pelo app";
  }
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
