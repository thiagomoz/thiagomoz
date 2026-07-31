# Cirurgia Segura — Protótipo funcional

Protótipo de apoio à Cirurgia Segura (checklist OMS digital + indicadores), conforme o **PRD Draft v1**.
Fase de mestrado em Tecnologia em Saúde: **uso exclusivo de dados fictícios**, avaliação de usabilidade
em ambiente controlado. Sem integração assistencial real.

> ⚠ Todas as telas exibem o banner **"AMBIENTE DE SIMULAÇÃO — DADOS FICTÍCIOS"**.

## Como rodar

É uma PWA 100% estática — não precisa de build nem backend nesta fase:

```bash
# qualquer servidor estático serve, ex.:
npx serve cirurgia-segura
# ou
python3 -m http.server 8000 --directory cirurgia-segura
```

Abra no navegador (tablet ou desktop). Em HTTPS a PWA fica instalável (manifest + service worker).

## Usuários de simulação

| Perfil | E-mail | Senha | PIN |
|---|---|---|---|
| Enfermeira | `ana.enfermeira@simulacao.br` | `demo123` | `1234` |
| Enfermeiro | `bruno.enfermeiro@simulacao.br` | `demo123` | `1234` |
| Gestora | `carla.gestora@simulacao.br` | `demo123` | `1234` |
| Admin | `diego.admin@simulacao.br` | `demo123` | `1234` |

Permissões cumulativas (Admin ⊃ Gestor ⊃ Enfermeiro), como no PRD.

## O que está implementado (V1 do plano de entrega)

| RF | Requisito | Status |
|---|---|---|
| RF-01 | Login e-mail/senha, bloqueio após 5 erros (5 min), re-login por PIN após 15 min de inatividade, bloqueio de rota por perfil, e-mail preservado em erro | ✅ |
| RF-02 | Cadastro de paciente fictício, identificador único, validação de nascimento futuro, busca com estado vazio + CTA, banner de simulação | ✅ |
| RF-03 | Procedimento (paciente, tipo, sala, caráter, data/hora, equipe), status por etapa, cancelamento com motivo, aviso de 2 procedimentos ativos na mesma sala | ✅ |
| RF-04/05/06 | Sign In, Time Out e Sign Out em **tela única**, alvos ≥ 44 px, Conforme/NC/N.A., sequência obrigatória, confirmação idempotente (duplo toque), rascunho restaurado após reinício do tablet, contexto do paciente fixo no topo (Time Out), justificativa **obrigatória** para NC de contagem, procedimento concluído imutável com visão consolidada e **adendos** | ✅ |
| RF-07 | NC via bottom-sheet: categorias pré-definidas, observação e ação tomada opcionais (≤ 10 s), vinculada a item + procedimento + autor + timestamp | ✅ |
| RF-08 | Painel do gestor: filtros período/sala/tipo/caráter aplicados a todos os cards simultaneamente; total de procedimentos, taxa 3/3, completude por etapa, NCs por categoria, ranking de itens, tempo médio por etapa; estado vazio explícito | ✅ |
| RF-09 | Export CSV (1 linha por resposta de item) com filtros ativos; relatório imprimível (PDF via imprimir); emissão registrada no audit log | ✅ (PDF dedicado fica p/ V1.5) |
| RF-10 | Trilha de auditoria append-only (login, cadastros, confirmações, NCs, adendos, exportações, sync), com filtros; sem nenhuma operação de edição/exclusão | ✅ |
| RF-11 | Fluxo crítico funciona offline (armazenamento local), badge "pendente de sincronização", sincronização automática ao reconectar preservando timestamps originais, indicador online/offline/sincronizando | ✅ (simulado client-side) |
| RF-12 | Configuração do checklist | ➖ V2 (checklist OMS fixo, como previsto) |

## Arquitetura desta fase

- **PWA estática** (HTML/CSS/JS puros, sem dependências) — `index.html`, `app.js`, `data.js`, `styles.css`, `sw.js`.
- Os dados vivem em `localStorage`, **simulando o backend Supabase** previsto no PRD (auth, RLS e
  Postgres entram na próxima iteração; o modelo de dados do código já segue o esboço da seção 7 do PRD:
  `users`, `patients`, `procedures`, `checklist_stages`, `stage_items`, `nonconformities`, `audit_log`).
- Seed determinístico com ~16 procedimentos fictícios nos últimos 30 dias (completos, incompletos,
  cancelado e em andamento) para o painel nascer populado. O admin pode restaurar o seed em
  *Administração → Dados de simulação* entre sessões de avaliação.
- Gráficos com paleta validada para daltonismo e modo claro/escuro automático.

## Próximos passos sugeridos (V1.5 / V2)

- Backend real (Supabase Auth + Postgres com RLS por perfil, audit log sem UPDATE/DELETE).
- Sincronização offline real (IndexedDB + fila de replicação com resolução de conflitos).
- Relatório PDF dedicado com metadados de emissão.
- Instrumento de avaliação de usabilidade (SUS ou similar, a definir com o orientador) — os
  timestamps por etapa já são coletados desde já, como pede a seção 9 do PRD.
