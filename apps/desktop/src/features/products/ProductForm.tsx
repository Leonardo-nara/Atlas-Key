import { useEffect, useState } from "react";

import type { Product } from "../../types/api";
import { toMediaUrl } from "../../lib/media-url";
import type { ProductInput } from "./products-service";

const MAX_PRODUCT_IMAGE_FILE_SIZE = 3 * 1024 * 1024;
const ACCEPTED_PRODUCT_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp"
];

interface ProductFormProps {
  initialValue?: Product | null;
  submitting: boolean;
  error: string | null;
  onCancel: () => void;
  onSubmit: (input: ProductInput) => Promise<void>;
}

const emptyForm: ProductInput = {
  name: "",
  description: "",
  price: 0,
  category: "",
  imageUrl: "",
  available: true
};

export function ProductForm({
  initialValue,
  submitting,
  error,
  onCancel,
  onSubmit
}: ProductFormProps) {
  const [form, setForm] = useState<ProductInput>(emptyForm);
  const [localError, setLocalError] = useState<string | null>(null);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [removeExistingImage, setRemoveExistingImage] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!initialValue) {
      setForm(emptyForm);
      setLocalError(null);
      setSelectedImageFile(null);
      setRemoveExistingImage(false);
      setPreviewUrl(null);
      return;
    }

    setForm({
      name: initialValue.name,
      description: initialValue.description ?? "",
      price: initialValue.price,
      category: initialValue.category,
      imageUrl: initialValue.imageUrl ?? "",
      available: initialValue.available
    });
    setLocalError(null);
    setSelectedImageFile(null);
    setRemoveExistingImage(false);
    setPreviewUrl(toMediaUrl(initialValue.imageUrl));
  }, [initialValue]);

  useEffect(() => {
    if (!selectedImageFile) {
      return;
    }

    const objectUrl = URL.createObjectURL(selectedImageFile);
    setPreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [selectedImageFile]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLocalError(null);
    await onSubmit({
      ...form,
      description: form.description?.trim() || undefined,
      imageUrl: form.imageUrl?.trim() || undefined,
      imageFile: selectedImageFile,
      removeImage: removeExistingImage
    });
  }

  async function handleImageFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    if (!ACCEPTED_PRODUCT_IMAGE_TYPES.includes(file.type)) {
      setLocalError("Use uma imagem PNG, JPG ou WEBP.");
      return;
    }

    if (file.size > MAX_PRODUCT_IMAGE_FILE_SIZE) {
      setLocalError("A imagem deve ter no maximo 3 MB.");
      return;
    }

    setSelectedImageFile(file);
    setRemoveExistingImage(false);
    setForm((current) => ({ ...current, imageUrl: "" }));
    setLocalError(null);
  }

  const hasImage = Boolean(previewUrl || form.imageUrl?.trim());

  return (
    <form className="panel form-grid" onSubmit={handleSubmit}>
      <div className="panel-heading">
        <h3>{initialValue ? "Editar produto" : "Novo produto"}</h3>
        <button className="ghost-button" onClick={onCancel} type="button">
          Cancelar
        </button>
      </div>

      <div className="form-columns">
        <label className="field">
          <span>Nome</span>
          <input
            value={form.name}
            onChange={(event) =>
              setForm((current) => ({ ...current, name: event.target.value }))
            }
            required
          />
        </label>

        <label className="field">
          <span>Categoria</span>
          <input
            value={form.category}
            onChange={(event) =>
              setForm((current) => ({ ...current, category: event.target.value }))
            }
            required
          />
        </label>

        <label className="field">
          <span>Preço</span>
          <input
            value={form.price}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                price: Number(event.target.value)
              }))
            }
            min="0"
            step="0.01"
            required
            type="number"
          />
        </label>

        <label className="field">
          <span>URL da imagem</span>
          <input
            value={form.imageUrl}
            onChange={(event) =>
              setForm((current) => ({ ...current, imageUrl: event.target.value }))
            }
            placeholder="https://... ou escolha uma imagem do computador"
          />
        </label>
      </div>

      <div className="product-image-upload">
        <div className="product-image-upload-copy">
          <strong>Imagem do produto</strong>
          <p className="muted-text">
            Escolha uma imagem do computador. O backend salva no storage configurado.
          </p>
        </div>
        <div className="product-image-upload-actions">
          <label className="secondary-button file-upload-button">
            Escolher imagem
            <input
              accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
              className="file-upload-input"
              onChange={handleImageFileChange}
              type="file"
            />
          </label>
          {hasImage ? (
            <button
              className="ghost-button"
              onClick={() => {
                setForm((current) => ({ ...current, imageUrl: "" }));
                setSelectedImageFile(null);
                setPreviewUrl(null);
                setRemoveExistingImage(true);
                setLocalError(null);
              }}
              type="button"
            >
              Remover imagem
            </button>
          ) : null}
        </div>
      </div>

      {hasImage ? (
        <div className="product-image-preview">
          <img
            alt={`Preview de ${form.name || "produto"}`}
            src={previewUrl ?? form.imageUrl}
          />
        </div>
      ) : null}

      <label className="field">
        <span>Descrição</span>
        <textarea
          rows={4}
          value={form.description}
          onChange={(event) =>
            setForm((current) => ({ ...current, description: event.target.value }))
          }
        />
      </label>

      <label className="checkbox-field">
        <input
          checked={form.available}
          onChange={(event) =>
            setForm((current) => ({ ...current, available: event.target.checked }))
          }
          type="checkbox"
        />
        <span>Produto disponivel para venda</span>
      </label>

      {error || localError ? (
        <div className="feedback feedback-error">{error ?? localError}</div>
      ) : null}

      <button className="primary-button" disabled={submitting} type="submit">
        {submitting ? "Salvando..." : initialValue ? "Salvar alterações" : "Criar produto"}
      </button>
    </form>
  );
}
