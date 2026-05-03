import { useEffect, useState } from "react";

import { useAuth } from "../features/auth/auth-context";
import { ProductForm } from "../features/products/ProductForm";
import {
  productsService,
  type ProductInput
} from "../features/products/products-service";
import { ApiError } from "../lib/http";
import { toMediaUrl } from "../lib/media-url";
import { PageHeader } from "../shared/ui/PageHeader";
import type { Product } from "../types/api";

export function ProductsPage() {
  const { token } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    if (!token) {
      return;
    }

    void loadProducts();
  }, [token]);

  useEffect(() => {
    if (!successMessage) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setSuccessMessage(null);
    }, 3500);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [successMessage]);

  async function loadProducts() {
    if (!token) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await productsService.list(token);
      setProducts(response);
    } catch (loadError) {
      setError(
        loadError instanceof ApiError
          ? loadError.message
          : "Nao foi possivel carregar os produtos."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(input: ProductInput) {
    if (!token) {
      return;
    }

    setSaving(true);
    setFormError(null);

    try {
      if (editingProduct) {
        await productsService.update(token, editingProduct.id, input);
        if (input.imageFile) {
          await productsService.uploadImage(token, editingProduct.id, input.imageFile);
        } else if (input.removeImage) {
          await productsService.removeImage(token, editingProduct.id);
        }
        setSuccessMessage("Produto atualizado com sucesso.");
      } else {
        const createdProduct = await productsService.create(token, input);
        if (input.imageFile) {
          await productsService.uploadImage(token, createdProduct.id, input.imageFile);
        }
        setSuccessMessage("Produto criado com sucesso.");
      }

      setEditingProduct(null);
      setShowForm(false);
      await loadProducts();
    } catch (submitError) {
      setFormError(
        submitError instanceof ApiError
          ? submitError.message
          : "Nao foi possivel salvar o produto."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(productId: string) {
    if (!token) {
      return;
    }

    const confirmed = window.confirm(
      "Tem certeza que deseja remover este produto do catalogo?"
    );

    if (!confirmed) {
      return;
    }

    setError(null);
    setDeletingProductId(productId);

    try {
      await productsService.remove(token, productId);
      setSuccessMessage("Produto removido com sucesso.");
      await loadProducts();
    } catch (deleteError) {
      setError(
        deleteError instanceof ApiError
          ? deleteError.message
          : "Nao foi possivel remover o produto."
      );
    } finally {
      setDeletingProductId(null);
    }
  }

  return (
    <section className="page-section">
      <PageHeader
        title="Produtos"
        description="Cadastre, edite e mantenha o catálogo da loja sincronizado com o backend."
        action={
          <button
            className="primary-button"
            onClick={() => {
              setEditingProduct(null);
              setShowForm(true);
            }}
            type="button"
          >
            Novo produto
          </button>
        }
      />

      {showForm ? (
        <ProductForm
          error={formError}
          initialValue={editingProduct}
          onCancel={() => {
            setShowForm(false);
            setEditingProduct(null);
            setFormError(null);
          }}
          onSubmit={handleSubmit}
          submitting={saving}
        />
      ) : null}

      {error ? <div className="feedback feedback-error">{error}</div> : null}
      {successMessage ? (
        <div className="feedback feedback-success">{successMessage}</div>
      ) : null}

      {loading ? (
        <div className="screen-state">Carregando produtos...</div>
      ) : (
        <div className="data-table panel">
          <div className="table-head table-row">
            <span>Nome</span>
            <span>Categoria</span>
            <span>Preço</span>
            <span>Status</span>
            <span>Ações</span>
          </div>
          {products.length === 0 ? (
            <div className="empty-state">
              Nenhum produto cadastrado ainda. Crie alguns itens para começar a receber pedidos.
            </div>
          ) : (
            products.map((product) => (
              <div className="table-row" key={product.id}>
                <div className="product-table-name">
                  {product.imageUrl ? (
                    <img
                      alt={`Imagem de ${product.name}`}
                      className="product-table-image"
                      src={toMediaUrl(product.imageUrl) ?? undefined}
                    />
                  ) : (
                    <div className="product-table-placeholder">
                      {product.name.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <div>
                  <strong>{product.name}</strong>
                  <p>{product.description || "Sem descrição"}</p>
                  </div>
                </div>
                <span>{product.category}</span>
                <span>R$ {product.price.toFixed(2)}</span>
                <span>{product.available ? "Disponível" : "Indisponível"}</span>
                <div className="row-actions">
                  <button
                    className="ghost-button"
                    onClick={() => {
                      setEditingProduct(product);
                      setShowForm(true);
                    }}
                    type="button"
                  >
                    Editar
                  </button>
                  <button
                    className="danger-button"
                    disabled={deletingProductId === product.id}
                    onClick={() => void handleDelete(product.id)}
                    type="button"
                  >
                    {deletingProductId === product.id ? "Removendo..." : "Remover"}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </section>
  );
}
