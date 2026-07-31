/* =========================================================
   Cirurgia Segura — Protótipo (dados fictícios)
   Definições do checklist OMS + dados de simulação (seed)
   ========================================================= */

// Itens do checklist de Cirurgia Segura da OMS (núcleo imutável na V1)
const WHO_CHECKLIST = {
  sign_in: {
    titulo: 'Sign In',
    subtitulo: 'Antes da indução anestésica',
    itens: [
      { key: 'identidade', label: 'Paciente confirmou identidade, sítio cirúrgico, procedimento e consentimento' },
      { key: 'sitio_demarcado', label: 'Sítio cirúrgico demarcado (ou não se aplica)' },
      { key: 'seguranca_anestesica', label: 'Verificação de segurança anestésica concluída' },
      { key: 'oximetro', label: 'Oxímetro de pulso instalado e funcionando' },
      { key: 'alergias', label: 'Alergias conhecidas verificadas' },
      { key: 'via_aerea', label: 'Risco de via aérea difícil / broncoaspiração avaliado, com equipamento e apoio disponíveis' },
      { key: 'risco_sangramento', label: 'Risco de perda sanguínea > 500 ml (7 ml/kg em crianças) avaliado, com acessos e hemocomponentes previstos' },
    ],
  },
  time_out: {
    titulo: 'Time Out',
    subtitulo: 'Antes da incisão cirúrgica — pausa com toda a equipe',
    itens: [
      { key: 'equipe_apresentada', label: 'Todos os membros da equipe se apresentaram pelo nome e função' },
      { key: 'confirmacao_verbal', label: 'Cirurgião, anestesia e enfermagem confirmaram verbalmente paciente, sítio e procedimento' },
      { key: 'antibiotico', label: 'Profilaxia antimicrobiana realizada nos últimos 60 minutos' },
      { key: 'eventos_cirurgiao', label: 'Cirurgião revisou etapas críticas, duração prevista e perda sanguínea esperada' },
      { key: 'eventos_anestesia', label: 'Anestesia revisou preocupações específicas com o paciente' },
      { key: 'eventos_enfermagem', label: 'Enfermagem confirmou esterilização e questões de equipamentos/materiais' },
      { key: 'imagens', label: 'Exames de imagem essenciais disponíveis e exibidos' },
    ],
  },
  sign_out: {
    titulo: 'Sign Out',
    subtitulo: 'Antes da saída da sala de operação',
    itens: [
      { key: 'procedimento_registrado', label: 'Nome do procedimento realizado confirmado e registrado' },
      { key: 'contagem', label: 'Contagem de instrumentais, compressas e agulhas correta', critico: true },
      { key: 'amostras', label: 'Amostras cirúrgicas identificadas e rotuladas (incluindo nome do paciente)' },
      { key: 'equipamentos', label: 'Problemas com equipamentos identificados e endereçados' },
      { key: 'recuperacao', label: 'Preocupações para recuperação e manejo pós-operatório revisadas' },
    ],
  },
};

const ETAPAS_ORDEM = ['sign_in', 'time_out', 'sign_out'];

const NC_CATEGORIAS = [
  { key: 'material_indisponivel', label: 'Material indisponível' },
  { key: 'divergencia_identificacao', label: 'Divergência de identificação' },
  { key: 'falha_equipamento', label: 'Falha de equipamento' },
  { key: 'medicacao', label: 'Medicação / profilaxia' },
  { key: 'contagem_divergente', label: 'Divergência de contagem' },
  { key: 'outro', label: 'Outro' },
];

const STATUS_LABELS = {
  aguardando_sign_in: 'Aguardando Sign In',
  aguardando_time_out: 'Aguardando Time Out',
  em_cirurgia: 'Em cirurgia — Aguardando Sign Out',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
};

// ---------------------------------------------------------
// Seed de simulação (tudo fictício)
// ---------------------------------------------------------
function buildSeed() {
  const now = Date.now();
  const DIA = 24 * 60 * 60 * 1000;
  const uid = (p, n) => `${p}-${String(n).padStart(3, '0')}`;

  const users = [
    { id: 'u-001', nome: 'Ana Ribeiro', email: 'ana.enfermeira@simulacao.br', senha: 'demo123', pin: '1234', perfil: 'enfermeiro', ativo: true },
    { id: 'u-002', nome: 'Bruno Costa', email: 'bruno.enfermeiro@simulacao.br', senha: 'demo123', pin: '1234', perfil: 'enfermeiro', ativo: true },
    { id: 'u-003', nome: 'Carla Mendes', email: 'carla.gestora@simulacao.br', senha: 'demo123', pin: '1234', perfil: 'gestor', ativo: true },
    { id: 'u-004', nome: 'Diego Alves', email: 'diego.admin@simulacao.br', senha: 'demo123', pin: '1234', perfil: 'admin', ativo: true },
  ];

  const salas = ['Sala 01', 'Sala 02', 'Sala 03'];
  const tiposProcedimento = [
    'Colecistectomia videolaparoscópica',
    'Herniorrafia inguinal',
    'Apendicectomia',
    'Cesariana',
    'Artroplastia de joelho',
    'Safenectomia',
  ];

  const patients = [
    { nome: 'Maria Silva (fictícia)', nascimento: '1965-03-12', identificador: 'SIM-0001', alergias: 'Dipirona' },
    { nome: 'João Pereira (fictício)', nascimento: '1978-11-02', identificador: 'SIM-0002', alergias: '' },
    { nome: 'Antônia Souza (fictícia)', nascimento: '1990-06-25', identificador: 'SIM-0003', alergias: 'Látex' },
    { nome: 'Carlos Andrade (fictício)', nascimento: '1955-01-30', identificador: 'SIM-0004', alergias: 'Penicilina' },
    { nome: 'Fernanda Lima (fictícia)', nascimento: '1988-09-14', identificador: 'SIM-0005', alergias: '' },
    { nome: 'José Nogueira (fictício)', nascimento: '1947-07-08', identificador: 'SIM-0006', alergias: '' },
  ].map((p, i) => ({ id: uid('pac', i + 1), ficticio: true, ...p }));

  // gerador pseudo-aleatório determinístico (para o seed ser estável)
  let s = 42;
  const rnd = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];

  const procedures = [];
  const stages = [];
  const stageItems = [];
  const ncs = [];
  const audit = [];
  let stageN = 0, itemN = 0, ncN = 0, auditN = 0;

  const logSeed = (userId, acao, entidade, entidadeId, ts, payload) => {
    audit.push({
      id: uid('aud', ++auditN), user_id: userId, acao, entidade, entidade_id: entidadeId,
      payload: payload || null, dispositivo: 'Tablet (simulação)', criado_em: new Date(ts).toISOString(),
    });
  };

  // 16 procedimentos nos últimos 30 dias com perfis variados
  const cenarios = [
    ...Array(10).fill('completo'),   // 3/3 etapas
    'sem_sign_out', 'sem_sign_out',  // ficaram em cirurgia (não aderiram ao sign out)
    'so_sign_in',                    // parou no sign in
    'cancelado',
    'aguardando',                    // agendado para hoje, ainda não iniciado
    'em_andamento',                  // sign in feito hoje, aguardando time out
  ];

  cenarios.forEach((cenario, i) => {
    const diasAtras = (cenario === 'aguardando' || cenario === 'em_andamento') ? 0 : 1 + Math.floor(rnd() * 29);
    const hora = 7 + Math.floor(rnd() * 10);
    const inicio = now - diasAtras * DIA - (24 - hora) * 3600 * 1000;
    const enfermeiro = pick(['u-001', 'u-002']);
    const procId = uid('proc', i + 1);
    const carater = rnd() < 0.75 ? 'eletiva' : 'urgencia';

    const proc = {
      id: procId,
      patient_id: pick(patients).id,
      tipo: pick(tiposProcedimento),
      sala: pick(salas),
      carater,
      data_prevista: new Date(inicio).toISOString(),
      status: 'aguardando_sign_in',
      equipe_texto: 'Dr. Fictício (cirurgião), Dra. Simulada (anestesia), Téc. Exemplo (instrumentação)',
      criado_por: enfermeiro,
      criado_em: new Date(inicio - 30 * 60000).toISOString(),
      cancelamento: null,
      adendos: [],
      sync: 'synced',
    };
    logSeed(enfermeiro, 'criou_procedimento', 'procedures', procId, inicio - 30 * 60000);

    if (cenario === 'cancelado') {
      proc.status = 'cancelado';
      proc.cancelamento = { motivo: 'Paciente com quadro febril na admissão (simulado)', por: enfermeiro, em: new Date(inicio).toISOString() };
      logSeed(enfermeiro, 'cancelou_procedimento', 'procedures', procId, inicio, { motivo: proc.cancelamento.motivo });
      procedures.push(proc);
      return;
    }

    const etapasARodar =
      cenario === 'completo' ? 3 :
      cenario === 'sem_sign_out' ? 2 :
      (cenario === 'so_sign_in' || cenario === 'em_andamento') ? 1 : 0;

    let t = inicio;
    for (let e = 0; e < etapasARodar; e++) {
      const etapa = ETAPAS_ORDEM[e];
      const durMin = etapa === 'sign_in' ? 2 + rnd() * 2 : etapa === 'time_out' ? 1.5 + rnd() * 1.5 : 2 + rnd() * 3;
      const iniciadoEm = t;
      const confirmadoEm = t + durMin * 60000;
      // intervalo entre etapas (indução / cirurgia)
      t = confirmadoEm + (etapa === 'sign_in' ? 20 : etapa === 'time_out' ? 60 + rnd() * 60 : 0) * 60000;

      const stageId = uid('stg', ++stageN);
      const autor = e === 2 && rnd() < 0.3 ? (enfermeiro === 'u-001' ? 'u-002' : 'u-001') : enfermeiro; // troca de plantão ocasional
      stages.push({
        id: stageId, procedure_id: procId, etapa,
        iniciado_em: new Date(iniciadoEm).toISOString(),
        confirmado_em: new Date(confirmadoEm).toISOString(),
        confirmado_por: autor,
      });

      WHO_CHECKLIST[etapa].itens.forEach((item) => {
        let resposta = 'conforme';
        const r = rnd();
        if (r < 0.055) resposta = 'nc';
        else if (r < 0.11 && (item.key === 'sitio_demarcado' || item.key === 'imagens' || item.key === 'amostras')) resposta = 'na';
        const itemId = uid('itm', ++itemN);
        stageItems.push({ id: itemId, stage_id: stageId, item_key: item.key, resposta });
        if (resposta === 'nc') {
          const categoria =
            item.key === 'contagem' ? 'contagem_divergente' :
            item.key === 'antibiotico' ? 'medicacao' :
            item.key === 'identidade' || item.key === 'confirmacao_verbal' ? 'divergencia_identificacao' :
            item.key === 'oximetro' || item.key === 'equipamentos' ? 'falha_equipamento' :
            pick(['material_indisponivel', 'falha_equipamento', 'outro']);
          const ncId = uid('nc', ++ncN);
          ncs.push({
            id: ncId, stage_item_id: itemId, procedure_id: procId, etapa, item_key: item.key,
            categoria,
            observacao: item.key === 'contagem' ? 'Divergência de 1 compressa; recontagem realizada (simulado)' : 'Registro de simulação',
            acao_tomada: item.key === 'contagem' ? 'Recontagem e comunicação ao cirurgião' : 'Contornado em sala',
            registrado_por: autor, registrado_em: new Date(confirmadoEm - 30000).toISOString(),
          });
          logSeed(autor, 'registrou_nc', 'nonconformities', ncId, confirmadoEm - 30000, { categoria, item: item.key });
        }
      });
      logSeed(autor, 'confirmou_etapa', 'checklist_stages', stageId, confirmadoEm, { etapa, procedimento: procId });
    }

    proc.status =
      etapasARodar === 3 ? 'concluido' :
      etapasARodar === 2 ? 'em_cirurgia' :
      etapasARodar === 1 ? 'aguardando_time_out' : 'aguardando_sign_in';
    procedures.push(proc);
  });

  return {
    version: 1,
    settings: { simulacao: true },
    users, salas, tiposProcedimento, patients, procedures, stages, stageItems, ncs, audit,
    counters: { pac: patients.length, proc: procedures.length, stg: stageN, itm: itemN, nc: ncN, aud: auditN, usr: users.length },
  };
}
