import { Link } from "react-router-dom";
import { useState, type ReactNode } from "react";

type PublicPageContent = {
  title: string;
  eyebrow: string;
  description: string;
  sections: Array<{
    title: string;
    body: string[];
  }>;
};

const legalNotice =
  "Conteudo tecnico em preparacao. Requer revisao juridica profissional antes do lancamento publico.";

const pages: Record<string, PublicPageContent> = {
  privacy: {
    title: "Politica de Privacidade",
    eyebrow: "Privacidade",
    description:
      "Resumo publico de como o Mototake trata dados para operar contas, pedidos, entregas, pagamentos manuais, estoque, caixa e suporte.",
    sections: [
      {
        title: "Responsavel",
        body: [
          "Controlador: [RAZAO SOCIAL], CNPJ [CNPJ], endereco [ENDERECO].",
          "Contato de privacidade: [E-MAIL DE PRIVACIDADE]."
        ]
      },
      {
        title: "Dados tratados",
        body: [
          "Podemos tratar nome, e-mail, telefone, endereco, perfil, pedidos, entregas, comprovantes, imagens, vendas, caixa, estoque, sessoes, logs tecnicos e tokens de dispositivo quando notificacoes estiverem habilitadas.",
          "Os dados sao usados para operacao do app, seguranca, suporte, auditoria e cumprimento de obrigacoes."
        ]
      },
      {
        title: "Exclusao e retencao",
        body: [
          "Voce pode solicitar exclusao ou revisao de dados pelo canal de privacidade.",
          "Historicos de pedidos, vendas, caixa, pagamentos, comprovantes e auditoria podem ser preservados quando houver obrigacao legal, seguranca, antifraude, suporte ou defesa de direitos."
        ]
      }
    ]
  },
  terms: {
    title: "Termos de Uso",
    eyebrow: "Uso da plataforma",
    description:
      "Regras operacionais preliminares para empresas, clientes e motoboys que usam o Mototake.",
    sections: [
      {
        title: "Empresas",
        body: [
          "A empresa e responsavel por produtos, precos, estoque, taxas, atendimento, conferencia de pagamentos manuais e emissao fiscal quando aplicavel fora do sistema."
        ]
      },
      {
        title: "Clientes",
        body: [
          "O cliente deve informar dados corretos, acompanhar pedidos e enviar comprovantes verdadeiros quando usar Pix manual."
        ]
      },
      {
        title: "Motoboys",
        body: [
          "O motoboy deve manter perfil atualizado, aceitar apenas entregas que possa cumprir e usar dados de cliente e empresa somente para a entrega."
        ]
      }
    ]
  },
  "account-deletion": {
    title: "Solicitacao de Exclusao de Conta",
    eyebrow: "Conta e dados",
    description:
      "Canal tecnico para solicitar exclusao, bloqueio ou anonimizacao de conta, sem exclusao automatica destrutiva nesta fase.",
    sections: [
      {
        title: "Como solicitar",
        body: [
          "Envie nome completo, e-mail da conta, telefone, tipo de conta e motivo opcional para [E-MAIL DE PRIVACIDADE].",
          "A identidade do solicitante sera validada antes de qualquer acao."
        ]
      },
      {
        title: "O que pode ser preservado",
        body: [
          "Pedidos, vendas, caixa, estoque, pagamentos, comprovantes, auditoria e logs podem ser mantidos quando necessarios por obrigacao legal, seguranca, antifraude, suporte ou defesa de direitos."
        ]
      },
      {
        title: "Status atual",
        body: [
          "A exclusao automatica irreversivel nao esta habilitada. O processo deve ser operacional, registrado e revisado."
        ]
      }
    ]
  },
  support: {
    title: "Suporte Mototake",
    eyebrow: "Ajuda",
    description:
      "Canal publico de suporte para acesso, pedidos, entregas, pagamentos manuais, estoque, caixa e incidentes.",
    sections: [
      {
        title: "Contato",
        body: [
          "E-mail de suporte: [E-MAIL DE SUPORTE].",
          "Telefone/WhatsApp: [TELEFONE/WHATSAPP DE SUPORTE]."
        ]
      },
      {
        title: "Ao abrir um chamado",
        body: [
          "Informe perfil afetado, loja, data/hora, tela, acao executada, mensagem exibida e requestId quando existir.",
          "Nao envie senha, token, chave Pix completa ou comprovantes fora do canal combinado."
        ]
      },
      {
        title: "Severidade",
        body: [
          "Critico: indisponibilidade geral, dados expostos ou pedido/pagamento corrompido.",
          "Alto: fluxo principal bloqueado para uma empresa. Medio ou baixo: erro com contorno ou polimento."
        ]
      }
    ]
  }
};

export function PrivacyPage() {
  return <PublicLegalPage content={pages.privacy} />;
}

export function TermsPage() {
  return <PublicLegalPage content={pages.terms} />;
}

export function AccountDeletionPage() {
  return (
    <PublicLegalPage content={pages["account-deletion"]}>
      <DeletionRequestBox />
    </PublicLegalPage>
  );
}

export function SupportPage() {
  return <PublicLegalPage content={pages.support} />;
}

function PublicLegalPage({
  content,
  children
}: {
  content: PublicPageContent;
  children?: ReactNode;
}) {
  return (
    <main className="public-page">
      <section className="public-hero">
        <p className="section-kicker">{content.eyebrow}</p>
        <h1>{content.title}</h1>
        <p className="muted-text">{content.description}</p>
        <div className="feedback feedback-warning">{legalNotice}</div>
      </section>

      <section className="public-content">
        {content.sections.map((section) => (
          <article className="panel public-section" key={section.title}>
            <h2>{section.title}</h2>
            {section.body.map((paragraph) => (
              <p className="muted-text" key={paragraph}>
                {paragraph}
              </p>
            ))}
          </article>
        ))}
        {children}
      </section>

      <nav className="public-footer" aria-label="Links publicos">
        <Link to="/login">Entrar no painel</Link>
        <Link to="/privacy">Privacidade</Link>
        <Link to="/terms">Termos</Link>
        <Link to="/account-deletion">Exclusao de conta</Link>
        <Link to="/support">Suporte</Link>
      </nav>
    </main>
  );
}

function DeletionRequestBox() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [accountType, setAccountType] = useState("cliente");
  const [reason, setReason] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setResult(null);

    if (!name.trim() || !email.trim() || !accepted) {
      setError("Preencha nome, email e confirme a ciencia sobre retencao.");
      return;
    }

    const requestText = [
      "Solicitacao de exclusao/anomizacao de conta Mototake",
      `Nome: ${name.trim()}`,
      `Email da conta: ${email.trim()}`,
      `Tipo de conta: ${accountType}`,
      `Motivo: ${reason.trim() || "Nao informado"}`,
      "Confirmo que entendo que historicos legais, financeiros, operacionais ou de seguranca podem ser preservados quando necessario."
    ].join("\n");

    setResult(requestText);
  }

  return (
    <article className="panel public-section">
      <h2>Formulario de solicitacao</h2>
      <p className="muted-text">
        Este formulario prepara o texto da solicitacao. O envio definitivo deve
        ocorrer pelo e-mail oficial de privacidade quando ele for definido.
      </p>

      <form className="form-grid" onSubmit={handleSubmit}>
        <label className="field">
          <span>Nome completo</span>
          <input value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label className="field">
          <span>Email da conta</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label className="field">
          <span>Tipo de conta</span>
          <select
            value={accountType}
            onChange={(event) => setAccountType(event.target.value)}
          >
            <option value="cliente">Cliente</option>
            <option value="motoboy">Motoboy</option>
            <option value="empresa">Empresa</option>
          </select>
        </label>
        <label className="field">
          <span>Motivo opcional</span>
          <textarea
            rows={3}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </label>
        <label className="checkbox-field">
          <input
            checked={accepted}
            onChange={(event) => setAccepted(event.target.checked)}
            type="checkbox"
          />
          <span>
            Entendo que alguns historicos podem ser preservados por obrigacao
            legal, seguranca, auditoria ou defesa de direitos.
          </span>
        </label>

        {error ? <div className="feedback feedback-error">{error}</div> : null}
        {result ? (
          <div className="feedback feedback-info">
            <strong>Texto gerado para envio ao canal oficial:</strong>
            <pre className="public-request-preview">{result}</pre>
          </div>
        ) : null}

        <button className="primary-button" type="submit">
          Gerar solicitacao
        </button>
      </form>
    </article>
  );
}
