import { useEffect, useState } from "react";

import type { Product } from "../../types/api";
import type { ProductInput } from "./products-service";

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

  useEffect(() => {
    if (!initialValue) {
      setForm(emptyForm);
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
  }, [initialValue]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSubmit({
      ...form,
      description: form.description?.trim() || undefined,
      imageUrl: form.imageUrl?.trim() || undefined
    });
  }

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
            placeholder="https://..."
          />
        </label>
      </div>

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

      {error ? <div className="feedback feedback-error">{error}</div> : null}

      <button className="primary-button" disabled={submitting} type="submit">
        {submitting ? "Salvando..." : initialValue ? "Salvar alterações" : "Criar produto"}
      </button>
    </form>
  );
}
