import { useEffect, useState } from "react";

import type { Product } from "../../types/api";
import type { ProductInput } from "./products-service";

const MAX_PRODUCT_IMAGE_FILE_SIZE = 1_500_000;
const ACCEPTED_PRODUCT_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif"
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

  useEffect(() => {
    if (!initialValue) {
      setForm(emptyForm);
      setLocalError(null);
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
  }, [initialValue]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLocalError(null);
    await onSubmit({
      ...form,
      description: form.description?.trim() || undefined,
      imageUrl: form.imageUrl?.trim() || undefined
    });
  }

  async function handleImageFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    if (!ACCEPTED_PRODUCT_IMAGE_TYPES.includes(file.type)) {
      setLocalError("Use uma imagem PNG, JPG, WEBP ou GIF.");
      return;
    }

    if (file.size > MAX_PRODUCT_IMAGE_FILE_SIZE) {
      setLocalError("A imagem deve ter no maximo 1,5 MB.");
      return;
    }

    try {
      const nextImageUrl = await readFileAsDataUrl(file);
      setForm((current) => ({ ...current, imageUrl: nextImageUrl }));
      setLocalError(null);
    } catch {
      setLocalError("Nao foi possivel ler a imagem selecionada.");
    }
  }

  const hasImage = Boolean(form.imageUrl?.trim());

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
            Voce pode usar uma URL externa ou escolher uma imagem do computador.
          </p>
        </div>
        <div className="product-image-upload-actions">
          <label className="secondary-button file-upload-button">
            Escolher imagem
            <input
              accept=".png,.jpg,.jpeg,.webp,.gif,image/png,image/jpeg,image/webp,image/gif"
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
          <img alt={`Preview de ${form.name || "produto"}`} src={form.imageUrl} />
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

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }

      reject(new Error("Nao foi possivel ler a imagem."));
    };

    reader.onerror = () => {
      reject(new Error("Nao foi possivel ler a imagem."));
    };

    reader.readAsDataURL(file);
  });
}
