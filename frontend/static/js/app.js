let usuarioLogado = "";
let adminLogado = false;
let pollingSessaoId = null;
const CHAVE_USUARIOS_SALVOS = "login_usuarios_salvos_v1";
const CHAVE_SENHAS_SALVAS = "login_senhas_salvas_v1";
const CHAVE_PREF_SALVAR_SENHA = "login_pref_salvar_senha_v1";
const MAX_USUARIOS_SALVOS = 8;
const filtrosDashboard = {
  ram: new Set(),
  cpu: new Set(),
  windows: new Set(),
  mostrarTodos: false
};

function obterUsuariosSalvos() {
  try {
    const bruto = localStorage.getItem(CHAVE_USUARIOS_SALVOS);
    const lista = JSON.parse(bruto || "[]");
    if (!Array.isArray(lista)) {
      return [];
    }

    const vistos = new Set();
    const normalizada = [];
    lista.forEach((nome) => {
      const limpo = String(nome || "").trim();
      const chave = limpo.toLowerCase();
      if (!limpo || vistos.has(chave)) {
        return;
      }
      vistos.add(chave);
      normalizada.push(limpo);
    });
    return normalizada;
  } catch (_err) {
    return [];
  }
}

function persistirUsuariosSalvos(lista) {
  try {
    localStorage.setItem(CHAVE_USUARIOS_SALVOS, JSON.stringify(lista.slice(0, MAX_USUARIOS_SALVOS)));
  } catch (_err) {
    // Ignore localStorage failures.
  }
}

function obterSenhasSalvas() {
  try {
    const bruto = localStorage.getItem(CHAVE_SENHAS_SALVAS);
    const dados = JSON.parse(bruto || "{}");
    if (!dados || typeof dados !== "object" || Array.isArray(dados)) {
      return {};
    }
    return dados;
  } catch (_err) {
    return {};
  }
}

function persistirSenhasSalvas(senhas) {
  try {
    localStorage.setItem(CHAVE_SENHAS_SALVAS, JSON.stringify(senhas));
  } catch (_err) {
    // Ignore localStorage failures.
  }
}

function registrarSenhaSalva(nomeUsuario, senha) {
  const nome = String(nomeUsuario || "").trim();
  const senhaLimpa = String(senha || "");
  if (!nome || !senhaLimpa) {
    return;
  }

  const chave = nome.toLowerCase();
  const senhas = obterSenhasSalvas();
  senhas[chave] = senhaLimpa;
  persistirSenhasSalvas(senhas);
}

function removerSenhaSalva(nomeUsuario) {
  const nome = String(nomeUsuario || "").trim();
  if (!nome) {
    return;
  }
  const chave = nome.toLowerCase();
  const senhas = obterSenhasSalvas();
  if (Object.prototype.hasOwnProperty.call(senhas, chave)) {
    delete senhas[chave];
    persistirSenhasSalvas(senhas);
  }
}

function obterSenhaSalva(nomeUsuario) {
  const nome = String(nomeUsuario || "").trim();
  if (!nome) {
    return "";
  }
  const chave = nome.toLowerCase();
  const senhas = obterSenhasSalvas();
  return String(senhas[chave] || "");
}

function obterPreferenciasSalvarSenha() {
  try {
    const bruto = localStorage.getItem(CHAVE_PREF_SALVAR_SENHA);
    const dados = JSON.parse(bruto || "{}");
    if (!dados || typeof dados !== "object" || Array.isArray(dados)) {
      return {};
    }
    return dados;
  } catch (_err) {
    return {};
  }
}

function persistirPreferenciasSalvarSenha(preferencias) {
  try {
    localStorage.setItem(CHAVE_PREF_SALVAR_SENHA, JSON.stringify(preferencias));
  } catch (_err) {
    // Ignore localStorage failures.
  }
}

function obterPreferenciaSalvarSenha(nomeUsuario) {
  const nome = String(nomeUsuario || "").trim().toLowerCase();
  if (!nome) {
    return null;
  }
  const preferencias = obterPreferenciasSalvarSenha();
  if (!Object.prototype.hasOwnProperty.call(preferencias, nome)) {
    return null;
  }
  return Boolean(preferencias[nome]);
}

function definirPreferenciaSalvarSenha(nomeUsuario, salvar) {
  const nome = String(nomeUsuario || "").trim().toLowerCase();
  if (!nome) {
    return;
  }
  const preferencias = obterPreferenciasSalvarSenha();
  preferencias[nome] = Boolean(salvar);
  persistirPreferenciasSalvarSenha(preferencias);
}

function devePerguntarSalvarSenha(nomeUsuario, senhaAtual) {
  const senhaSalva = obterSenhaSalva(nomeUsuario);
  const preferencia = obterPreferenciaSalvarSenha(nomeUsuario);

  // Primeira vez: ainda não decidiu para este usuário.
  if (!senhaSalva && preferencia === null) {
    return { perguntar: true, motivo: "primeiro_uso" };
  }

  // Senha mudou em relação à salva localmente.
  if (senhaSalva && senhaSalva !== senhaAtual) {
    return { perguntar: true, motivo: "senha_alterada" };
  }

  return { perguntar: false, motivo: "sem_alteracao" };
}

function aplicarEscolhaSalvarSenha(nomeUsuario, senhaAtual, salvarSenha) {
  definirPreferenciaSalvarSenha(nomeUsuario, salvarSenha);
  if (salvarSenha) {
    registrarSenhaSalva(nomeUsuario, senhaAtual);
  } else {
    removerSenhaSalva(nomeUsuario);
  }
}

function mostrarPromptSalvarSenha(nomeUsuario, senhaAtual, motivo) {
  const idPrompt = "promptSalvarSenha";
  const existente = document.getElementById(idPrompt);
  if (existente) {
    existente.remove();
  }

  const prompt = document.createElement("div");
  prompt.id = idPrompt;
  prompt.className = "senha-save-prompt";

  const titulo = motivo === "senha_alterada" ? "Senha alterada detectada" : "Salvar senha neste computador?";
  const descricao =
    motivo === "senha_alterada"
      ? `Foi detectada uma senha diferente para ${nomeUsuario}. Deseja atualizar a senha salva localmente?`
      : `Primeiro login de ${nomeUsuario} neste navegador. Deseja salvar a senha localmente?`;

  prompt.innerHTML = `
    <div class="senha-save-title">${titulo}</div>
    <div class="senha-save-text">${descricao}</div>
    <label class="switch-inline senha-save-switch" for="salvarSenhaToggle">
      <input id="salvarSenhaToggle" type="checkbox" class="switch-input" checked>
      <span class="switch-slider" aria-hidden="true"></span>
      <span class="switch-text">Salvar senha localmente</span>
    </label>
    <div class="senha-save-actions">
      <button type="button" class="btn secondary" id="senhaSaveCancelar">Agora nao</button>
      <button type="button" class="btn" id="senhaSaveAplicar">Aplicar</button>
    </div>
  `;

  document.body.appendChild(prompt);

  const btnAplicar = prompt.querySelector("#senhaSaveAplicar");
  const btnCancelar = prompt.querySelector("#senhaSaveCancelar");
  const toggle = prompt.querySelector("#salvarSenhaToggle");

  btnAplicar?.addEventListener("click", () => {
    aplicarEscolhaSalvarSenha(nomeUsuario, senhaAtual, Boolean(toggle?.checked));
    prompt.remove();
  });

  btnCancelar?.addEventListener("click", () => {
    prompt.remove();
  });
}

function registrarUsuarioSalvo(nomeUsuario) {
  const nome = String(nomeUsuario || "").trim();
  if (!nome) {
    return;
  }

  const lista = obterUsuariosSalvos().filter((item) => item.toLowerCase() !== nome.toLowerCase());
  lista.unshift(nome);
  persistirUsuariosSalvos(lista);
}

function renderizarSugestoesUsuarios(filtro = "") {
  const box = document.getElementById("usuariosSugestoes");
  const inputUsuario = document.getElementById("usuario");
  if (!box || !inputUsuario) {
    return;
  }

  const termo = String(filtro || "").trim().toLowerCase();
  const usuarios = obterUsuariosSalvos().filter((nome) => nome.toLowerCase().includes(termo));

  box.innerHTML = "";
  if (!usuarios.length) {
    box.classList.add("hidden");
    return;
  }

  const fragment = document.createDocumentFragment();
  usuarios.forEach((nome) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "login-suggestion-item";
    btn.textContent = nome;
    btn.addEventListener("click", () => {
      inputUsuario.value = nome;
      box.classList.add("hidden");
      document.getElementById("senha")?.focus();
    });
    fragment.appendChild(btn);
  });

  box.appendChild(fragment);
  box.classList.remove("hidden");
}

function configurarSugestoesUsuariosLogin() {
  const wrapper = document.getElementById("loginUsuarioWrapper");
  const inputUsuario = document.getElementById("usuario");
  const box = document.getElementById("usuariosSugestoes");
  if (!wrapper || !inputUsuario || !box) {
    return;
  }

  const mostrar = () => renderizarSugestoesUsuarios(inputUsuario.value);

  inputUsuario.addEventListener("focus", mostrar);
  inputUsuario.addEventListener("click", mostrar);
  inputUsuario.addEventListener("input", mostrar);

  document.addEventListener("click", (event) => {
    if (!wrapper.contains(event.target)) {
      box.classList.add("hidden");
    }
  });
}

function renderizarSugestaoSenha() {
  const box = document.getElementById("senhaSugestoes");
  const inputUsuario = document.getElementById("usuario");
  const inputSenha = document.getElementById("senha");
  if (!box || !inputUsuario || !inputSenha) {
    return;
  }

  const usuario = inputUsuario.value.trim();
  const senhaSalva = obterSenhaSalva(usuario);

  box.innerHTML = "";
  if (!usuario || !senhaSalva) {
    box.classList.add("hidden");
    return;
  }

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "login-suggestion-item";
  btn.textContent = `Usar senha salva para ${usuario}`;
  btn.addEventListener("click", () => {
    inputSenha.value = senhaSalva;
    box.classList.add("hidden");
  });

  box.appendChild(btn);
  box.classList.remove("hidden");
}

function configurarSugestaoSenhaLogin() {
  const wrapper = document.getElementById("loginSenhaWrapper");
  const inputSenha = document.getElementById("senha");
  const box = document.getElementById("senhaSugestoes");
  if (!wrapper || !inputSenha || !box) {
    return;
  }

  // Evita sugestoes nativas (ex: senha forte/salva do navegador) e prioriza apenas a sugestao local da aplicacao.
  inputSenha.setAttribute("autocomplete", "off");
  inputSenha.setAttribute("autocapitalize", "none");
  inputSenha.setAttribute("spellcheck", "false");
  inputSenha.setAttribute("data-lpignore", "true");
  inputSenha.setAttribute("data-1p-ignore", "true");

  const mostrar = () => renderizarSugestaoSenha();

  inputSenha.addEventListener("focus", mostrar);
  inputSenha.addEventListener("click", mostrar);
  document.getElementById("usuario")?.addEventListener("input", () => {
    box.classList.add("hidden");
  });

  document.addEventListener("click", (event) => {
    if (!wrapper.contains(event.target)) {
      box.classList.add("hidden");
    }
  });
}

const modalComputadorState = {
  aberto: false,
  x: 0,
  y: 0,
  alvoX: 0,
  alvoY: 0,
  escala: 1,
  arrastando: false,
  inicioX: 0,
  inicioY: 0,
  origemX: 0,
  origemY: 0,
  frameArrasto: null
};

const LIMITE_ESCALA_MIN = 0.85;
const LIMITE_ESCALA_MAX = 1.35;

function aplicarTransformModal() {
  const card = document.getElementById("computadorFloatingCard");
  if (!card) {
    return;
  }
  card.style.transform = `translate3d(calc(-50% + ${modalComputadorState.x}px), calc(-50% + ${modalComputadorState.y}px), 0) scale(${modalComputadorState.escala})`;
}

function agendarTransformModal() {
  if (modalComputadorState.frameArrasto !== null) {
    return;
  }
  modalComputadorState.frameArrasto = requestAnimationFrame(() => {
    modalComputadorState.frameArrasto = null;
    modalComputadorState.x = modalComputadorState.alvoX;
    modalComputadorState.y = modalComputadorState.alvoY;
    aplicarTransformModal();
  });
}

function resetTransformModal() {
  modalComputadorState.x = 0;
  modalComputadorState.y = 0;
  modalComputadorState.alvoX = 0;
  modalComputadorState.alvoY = 0;
  modalComputadorState.escala = 1;
  aplicarTransformModal();
}

function abrirModalComputador(registro, historico) {
  const overlay = document.getElementById("computadorOverlay");
  const titulo = document.getElementById("floatingTitulo");
  const meta = document.getElementById("floatingMeta");
  const campos = document.getElementById("floatingCampos");
  const timeline = document.getElementById("floatingHistorico");

  if (!overlay || !titulo || !meta || !campos || !timeline) {
    return;
  }

  titulo.textContent = `Detalhes: ${registro.computador || "Computador"}`;
  meta.textContent = `Usuario: ${registro.usuario || "-"} | IP: ${registro.ip || "-"} | Serial: ${registro.serial || "-"}`;

  campos.innerHTML = "";
  campos.appendChild(renderCampos(registro));

  timeline.innerHTML = "<strong>Historico de mudancas</strong>";
  if (!historico.length) {
    const vazio = document.createElement("div");
    vazio.className = "timeline-item";
    vazio.textContent = "Sem historico registrado para este computador.";
    timeline.appendChild(vazio);
  } else {
    historico.forEach((h) => {
      const itemLinha = document.createElement("div");
      itemLinha.className = "timeline-item";
      itemLinha.textContent = `${h.data} - ${h.mudanca}`;
      timeline.appendChild(itemLinha);
    });
  }

  modalComputadorState.aberto = true;
  resetTransformModal();
  overlay.classList.add("open");
  document.body.classList.add("modal-open");
}

function fecharModalComputador(event = null) {
  const overlay = document.getElementById("computadorOverlay");
  if (!overlay) {
    return;
  }

  if (event && event.target !== overlay) {
    return;
  }

  modalComputadorState.aberto = false;
  modalComputadorState.arrastando = false;
  overlay.classList.remove("dragging");
  overlay.classList.remove("open");
  document.body.classList.remove("modal-open");
}

function iniciarInteracoesModal() {
  const card = document.getElementById("computadorFloatingCard");
  const header = document.getElementById("computadorFloatingHeader");
  const closeBtn = document.getElementById("floatingCloseBtn");
  const overlay = document.getElementById("computadorOverlay");
  if (!card || !header || !overlay) {
    return;
  }

  if (closeBtn) {
    closeBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      fecharModalComputador();
    });
  }

  header.addEventListener("pointerdown", (event) => {
    if (event.target && event.target.closest(".floating-close")) {
      return;
    }
    if (!modalComputadorState.aberto || event.button !== 0) {
      return;
    }

    modalComputadorState.arrastando = true;
    modalComputadorState.inicioX = event.clientX;
    modalComputadorState.inicioY = event.clientY;
    modalComputadorState.origemX = modalComputadorState.x;
    modalComputadorState.origemY = modalComputadorState.y;
    modalComputadorState.alvoX = modalComputadorState.x;
    modalComputadorState.alvoY = modalComputadorState.y;

    header.classList.add("dragging");
    card.classList.add("dragging");
    overlay.classList.add("dragging");
    header.setPointerCapture(event.pointerId);
  });

  header.addEventListener("pointermove", (event) => {
    if (!modalComputadorState.arrastando) {
      return;
    }

    const dx = event.clientX - modalComputadorState.inicioX;
    const dy = event.clientY - modalComputadorState.inicioY;
    modalComputadorState.alvoX = modalComputadorState.origemX + dx;
    modalComputadorState.alvoY = modalComputadorState.origemY + dy;
    agendarTransformModal();
  });

  const encerrarArrasto = (event) => {
    if (!modalComputadorState.arrastando) {
      return;
    }
    modalComputadorState.arrastando = false;
    header.classList.remove("dragging");
    card.classList.remove("dragging");
    overlay.classList.remove("dragging");
    if (event && event.pointerId !== undefined) {
      header.releasePointerCapture(event.pointerId);
    }
  };

  header.addEventListener("pointerup", encerrarArrasto);
  header.addEventListener("pointercancel", encerrarArrasto);

  card.addEventListener(
    "wheel",
    (event) => {
      if (!modalComputadorState.aberto) {
        return;
      }
      event.preventDefault();

      const ajuste = event.deltaY * -0.0012;
      modalComputadorState.escala = Math.min(
        LIMITE_ESCALA_MAX,
        Math.max(LIMITE_ESCALA_MIN, modalComputadorState.escala + ajuste)
      );
      aplicarTransformModal();
    },
    { passive: false }
  );

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && modalComputadorState.aberto) {
      fecharModalComputador();
    }
  });
}

function setExpansaoPainel(painelId, botaoId, expandido) {
  const painel = document.getElementById(painelId);
  const botao = document.getElementById(botaoId);

  if (painel) {
    const concluirExpansao = () => {
      if (painel.classList.contains("is-open")) {
        painel.style.maxHeight = "none";
      }
    };

    if (expandido) {
      painel.classList.add("is-open");
      const alturaAlvo = painel.scrollHeight;
      painel.style.maxHeight = "0px";
      void painel.offsetHeight;
      requestAnimationFrame(() => {
        painel.style.maxHeight = `${alturaAlvo}px`;
      });

      const aoExpandir = (event) => {
        if (event.propertyName !== "max-height") {
          return;
        }
        concluirExpansao();
        painel.removeEventListener("transitionend", aoExpandir);
      };

      painel.addEventListener("transitionend", aoExpandir);
      setTimeout(concluirExpansao, 380);
    } else {
      if (painel.style.maxHeight === "none" || !painel.style.maxHeight) {
        painel.style.maxHeight = `${painel.scrollHeight}px`;
      }
      // Mantem o colapso suave mesmo apos mudancas dinamicas no conteudo.
      void painel.offsetHeight;
      requestAnimationFrame(() => {
        painel.style.maxHeight = "0px";
      });
      painel.classList.remove("is-open");
    }
  }
  if (botao) {
    botao.setAttribute("aria-expanded", expandido ? "true" : "false");
  }
}

function alternarPainelFiltros() {
  const botao = document.getElementById("filtroPainelBtn");
  const expandido = botao?.getAttribute("aria-expanded") === "true";
  setExpansaoPainel("filtrosPainel", "filtroPainelBtn", !expandido);
}

function alternarGrupoFiltro(tipo) {
  const mapa = {
    ram: { painelId: "filtroGrupo-ram", botaoId: "filtroRamBtn" },
    cpu: { painelId: "filtroGrupo-cpu", botaoId: "filtroCpuBtn" },
    windows: { painelId: "filtroGrupo-windows", botaoId: "filtroWindowsBtn" }
  };
  const alvo = mapa[tipo];
  if (!alvo) {
    return;
  }

  const botao = document.getElementById(alvo.botaoId);
  const expandido = botao?.getAttribute("aria-expanded") === "true";
  setExpansaoPainel(alvo.painelId, alvo.botaoId, !expandido);
}

function trocar(id, botao = null) {
  if (!usuarioLogado && id !== "login") {
    return;
  }
  if ((id === "aprovacoes" || id === "usuarios") && !adminLogado) {
    return;
  }

  document.querySelectorAll(".section").forEach((sec) => sec.classList.remove("active"));
  const section = document.getElementById(id);
  if (section) {
    section.classList.add("active");
  }

  document.querySelectorAll(".menu button").forEach((btn) => btn.classList.remove("active"));
  if (botao) {
    botao.classList.add("active");
  } else {
    const menu = document.querySelector(`.menu button[data-section='${id}']`);
    if (menu) {
      menu.classList.add("active");
    }
  }

  if (id === "relatorios") {
    carregarRelatorios();
  }
  if (id === "aprovacoes") {
    carregarAprovacoes();
  }
  if (id === "usuarios") {
    carregarUsuarios();
  }
}

function atualizarMenuAdmin(pendentes = 0) {
  const botaoAprovacoes = document.getElementById("aprovacoesBtn");
  const botaoUsuarios = document.getElementById("usuariosBtn");
  if (!botaoAprovacoes) {
    return;
  }

  if (!adminLogado) {
    botaoAprovacoes.classList.add("hidden");
    botaoAprovacoes.classList.remove("has-pending");
    botaoAprovacoes.textContent = "Aprovacoes (0)";
    if (botaoUsuarios) {
      botaoUsuarios.classList.add("hidden");
    }
    return;
  }

  botaoAprovacoes.classList.remove("hidden");
  botaoAprovacoes.classList.toggle("has-pending", pendentes > 0);
  botaoAprovacoes.textContent = `Aprovacoes (${pendentes})`;
  if (botaoUsuarios) {
    botaoUsuarios.classList.remove("hidden");
  }
}

function iniciarPollingSessao() {
  if (pollingSessaoId) {
    clearInterval(pollingSessaoId);
    pollingSessaoId = null;
  }

  if (!usuarioLogado) {
    return;
  }

  pollingSessaoId = setInterval(async () => {
    try {
      const data = await api("/session");
      const eraAdmin = adminLogado;
      const ehAdminAgora = Boolean(data.is_admin);

      adminLogado = ehAdminAgora;
      atualizarMenuAdmin(data.pendentes_aprovacao || 0);

      // Se perdeu admin enquanto estava em tela restrita, volta para dashboard.
      if (eraAdmin && !ehAdminAgora) {
        const secaoAtiva = document.querySelector(".section.active");
        const idAtivo = secaoAtiva ? secaoAtiva.id : "";
        if (idAtivo === "aprovacoes" || idAtivo === "usuarios") {
          trocar("dashboard");
          await carregarDashboard();
        }
        setStatus("filtroStatus", "Seu perfil foi atualizado: acesso administrativo removido.", true);
      }
    } catch (_err) {
      // Ignore intermittent polling errors.
    }
  }, 5000);
}

function setStatus(id, texto, erro = false) {
  const el = document.getElementById(id);
  if (!el) {
    return;
  }
  el.textContent = texto;
  el.classList.toggle("error", erro);
}

function escapeHtml(texto) {
  if (texto === null || texto === undefined) {
    return "-";
  }
  return String(texto)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  let payload = {};
  try {
    payload = await response.json();
  } catch (_err) {
    payload = {};
  }

  if (!response.ok || !payload.ok) {
    const message = payload.error || `Erro ${response.status}`;
    throw new Error(message);
  }

  return payload.data;
}

function renderCampos(registro) {
  const row = document.createElement("div");
  row.className = "row";

  Object.entries(registro).forEach(([campo, valor]) => {
    const field = document.createElement("div");
    field.className = "field";
    field.innerHTML = `<small>${escapeHtml(campo)}</small><strong>${escapeHtml(valor)}</strong>`;
    row.appendChild(field);
  });

  return row;
}

function montarCardsMaquinas(container, maquinas, options = {}) {
  const onCardClick = options.onCardClick;
  const cardHint = options.cardHint || "";
  container.innerHTML = "";
  const fragment = document.createDocumentFragment();

  maquinas.forEach((maq) => {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <h4>${escapeHtml(maq.computador || maq.usuario || "Maquina sem nome")}</h4>
      <div class="meta">Usuario: ${escapeHtml(maq.usuario)} | IP: ${escapeHtml(maq.ip)} | Serial: ${escapeHtml(maq.serial)}</div>
    `;

    if (typeof onCardClick === "function" && maq.computador) {
      card.classList.add("card-clickable");
      card.setAttribute("role", "button");
      card.setAttribute("tabindex", "0");
      if (cardHint) {
        const hint = document.createElement("div");
        hint.className = "meta card-hint";
        hint.textContent = cardHint;
        card.appendChild(hint);
      }

      const abrir = () => onCardClick(maq.computador);
      card.addEventListener("click", abrir);
      card.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          abrir();
        }
      });
    }

    card.appendChild(renderCampos(maq));
    fragment.appendChild(card);
  });

  container.appendChild(fragment);
}

function criarIdSeguro(texto) {
  return String(texto)
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-+|-+$/g, "") || "opcao";
}

function atualizarResumoFiltro() {
  const partes = [];
  if (filtrosDashboard.ram.size) {
    partes.push(`RAM: ${Array.from(filtrosDashboard.ram).join(", ")}`);
  }
  if (filtrosDashboard.cpu.size) {
    partes.push(`CPU: ${Array.from(filtrosDashboard.cpu).join(", ")}`);
  }
  if (filtrosDashboard.windows.size) {
    partes.push(`Windows: ${Array.from(filtrosDashboard.windows).join(", ")}`);
  }

  document.getElementById("filtroAtual").textContent =
    filtrosDashboard.mostrarTodos ? "Todos os computadores" : (partes.join(" | ") || "Nenhum");
}

function resetFiltrosDashboard() {
  filtrosDashboard.ram.clear();
  filtrosDashboard.cpu.clear();
  filtrosDashboard.windows.clear();
  filtrosDashboard.mostrarTodos = false;

  setExpansaoPainel("filtrosPainel", "filtroPainelBtn", false);
  setExpansaoPainel("filtroGrupo-ram", "filtroRamBtn", false);
  setExpansaoPainel("filtroGrupo-cpu", "filtroCpuBtn", false);
  setExpansaoPainel("filtroGrupo-windows", "filtroWindowsBtn", false);
}

function possuiFiltrosAtivos() {
  return filtrosDashboard.ram.size > 0 || filtrosDashboard.cpu.size > 0 || filtrosDashboard.windows.size > 0;
}

function limparResultadoDashboard() {
  document.getElementById("dashboardResultado").innerHTML = "";
  document.getElementById("detalheComputador").innerHTML = "";
  document.getElementById("totalCategoria").textContent = "0";
  document.getElementById("filtroAtual").textContent = "Nenhum";
}

function montarOpcoesFiltro(containerId, tipo, lista) {
  const div = document.getElementById(containerId);
  div.innerHTML = "";

  if (!Array.isArray(lista) || !lista.length) {
    div.innerHTML = '<div class="meta">Sem opcoes disponiveis.</div>';
    return;
  }

  const fragment = document.createDocumentFragment();
  lista.forEach((item, index) => {
    const categoria = item.categoria;
    const checkId = `${tipo}-${criarIdSeguro(categoria)}-${index}`;

    const label = document.createElement("label");
    label.className = "check-item";
    label.setAttribute("for", checkId);

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.id = checkId;
    checkbox.checked = filtrosDashboard[tipo].has(categoria);

    checkbox.addEventListener("change", async () => {
      if (checkbox.checked) {
        filtrosDashboard[tipo].add(categoria);
      } else {
        filtrosDashboard[tipo].delete(categoria);
      }

      if (filtrosDashboard.mostrarTodos) {
        filtrosDashboard.mostrarTodos = false;
        const mostrarTodos = document.getElementById("mostrarTodos");
        if (mostrarTodos) {
          mostrarTodos.checked = false;
        }
      }

      await aplicarFiltrosDashboard();
    });

    const texto = document.createElement("span");
    texto.textContent = `${categoria} (${item.total})`;

    label.appendChild(checkbox);
    label.appendChild(texto);
    fragment.appendChild(label);
  });

  div.appendChild(fragment);

  const painel = div.closest(".hidden-panel");
  if (painel && painel.classList.contains("is-open")) {
    painel.style.maxHeight = `${painel.scrollHeight}px`;
    requestAnimationFrame(() => {
      if (painel.classList.contains("is-open")) {
        painel.style.maxHeight = "none";
      }
    });
  }
}

function payloadFiltrosDashboard() {
  return {
    ram: Array.from(filtrosDashboard.ram),
    cpu: Array.from(filtrosDashboard.cpu),
    windows: Array.from(filtrosDashboard.windows),
    mostrar_todos: filtrosDashboard.mostrarTodos
  };
}

function descricaoFiltroAtual(data) {
  if (data.mostrar_todos) {
    return "Mostrando todos os computadores.";
  }

  const filtros = data.filtros || {};
  const totalFiltros = (filtros.ram || []).length + (filtros.cpu || []).length + (filtros.windows || []).length;
  if (!totalFiltros) {
    return "Sem filtros selecionados. Marque uma ou mais caixas para filtrar.";
  }

  return `Filtro aplicado: ${data.filtro}`;
}

async function aplicarFiltrosDashboard() {
  atualizarResumoFiltro();

  if (!filtrosDashboard.mostrarTodos && !possuiFiltrosAtivos()) {
    limparResultadoDashboard();
    setStatus("filtroStatus", "Sem filtros selecionados. Marque uma ou mais caixas para filtrar.");
    return;
  }

  setStatus("filtroStatus", "Aplicando filtros...");

  try {
    const data = await api("/dashboard/filtrar_multiplos", {
      method: "POST",
      body: JSON.stringify(payloadFiltrosDashboard())
    });

    document.getElementById("filtroAtual").textContent = data.filtro;
    document.getElementById("totalCategoria").textContent = data.total;
    setStatus("filtroStatus", descricaoFiltroAtual(data));
    document.getElementById("detalheComputador").innerHTML = "";

    const div = document.getElementById("dashboardResultado");
    div.innerHTML = "";
    if (!data.total) {
      div.innerHTML = '<div class="card"><h4>Nenhuma maquina encontrada</h4><p class="meta">Nao ha computadores com esta combinacao de filtros.</p></div>';
      return;
    }

    montarCardsMaquinas(div, data.maquinas, {
      onCardClick: carregarDetalheComputador,
      cardHint: "Clique para ver detalhes e historico"
    });
  } catch (err) {
    setStatus("filtroStatus", err.message, true);
    const div = document.getElementById("dashboardResultado");
    div.innerHTML = `<div class="card"><h4>Erro ao aplicar filtros</h4><p class="meta">${escapeHtml(err.message)}</p></div>`;
  }
}

function limparFiltrosDashboard() {
  resetFiltrosDashboard();

  document.querySelectorAll("#ramOpcoes input, #cpuOpcoes input, #windowsOpcoes input").forEach((el) => {
    el.checked = false;
  });

  const mostrarTodos = document.getElementById("mostrarTodos");
  if (mostrarTodos) {
    mostrarTodos.checked = false;
  }

  aplicarFiltrosDashboard();
}

async function logar() {
  const usuario = document.getElementById("usuario").value.trim();
  const senha = document.getElementById("senha").value.trim();
  if (!usuario || !senha) {
    setStatus("loginStatus", "Informe usuario e senha para entrar.", true);
    return;
  }

  try {
    const data = await api("/login", {
      method: "POST",
      body: JSON.stringify({ usuario, senha })
    });

    usuarioLogado = data.usuario;
    adminLogado = Boolean(data.is_admin);
    registrarUsuarioSalvo(data.usuario);

    const decisaoSenha = devePerguntarSalvarSenha(data.usuario, senha);
    if (decisaoSenha.perguntar) {
      mostrarPromptSalvarSenha(data.usuario, senha, decisaoSenha.motivo);
    } else {
      const preferenciaSalvar = obterPreferenciaSalvarSenha(data.usuario);
      if (preferenciaSalvar) {
        registrarSenhaSalva(data.usuario, senha);
      }
    }

    renderizarSugestoesUsuarios();
    renderizarSugestaoSenha();
    setStatus("loginStatus", `Bem-vindo, ${usuarioLogado}.`);
    document.getElementById("logoutBtn").classList.remove("hidden");
    atualizarMenuAdmin(data.pendentes_aprovacao || 0);
    iniciarPollingSessao();
    trocar("dashboard");
    await carregarDashboard();
  } catch (err) {
    setStatus("loginStatus", err.message, true);
  }
}

async function registrar() {
  const usuario = document.getElementById("usuario").value.trim();
  const senha = document.getElementById("senha").value.trim();

  if (!usuario || !senha) {
    setStatus("loginStatus", "Informe usuario e senha para registrar.", true);
    return;
  }

  try {
    const data = await api("/registrar", {
      method: "POST",
      body: JSON.stringify({ usuario, senha })
    });
    setStatus("loginStatus", data.mensagem || "Registro concluido, aguarde um Administrador aprovar seu acesso.");
  } catch (err) {
    setStatus("loginStatus", err.message, true);
  }
}

async function sair() {
  try {
    await api("/logout", { method: "POST", body: JSON.stringify({}) });
  } catch (_err) {
    // Ignore logout failures and continue with client cleanup.
  }

  usuarioLogado = "";
  adminLogado = false;
  if (pollingSessaoId) {
    clearInterval(pollingSessaoId);
    pollingSessaoId = null;
  }
  document.getElementById("logoutBtn").classList.add("hidden");
  atualizarMenuAdmin(0);
  setStatus("loginStatus", "Sessao encerrada.");
  trocar("login");
}

async function validarSessaoInicial() {
  try {
    const data = await api("/session");
    usuarioLogado = data.usuario;
    adminLogado = Boolean(data.is_admin);
    registrarUsuarioSalvo(data.usuario);
    renderizarSugestoesUsuarios();
    document.getElementById("logoutBtn").classList.remove("hidden");
    atualizarMenuAdmin(data.pendentes_aprovacao || 0);
    iniciarPollingSessao();
    trocar("dashboard");
    await carregarDashboard();
  } catch (_err) {
    adminLogado = false;
    if (pollingSessaoId) {
      clearInterval(pollingSessaoId);
      pollingSessaoId = null;
    }
    atualizarMenuAdmin(0);
    trocar("login");
  }
}

async function carregarAprovacoes() {
  if (!adminLogado) {
    return;
  }

  setStatus("aprovacaoStatus", "Carregando usuarios pendentes...");
  try {
    const data = await api("/admin/usuarios");
    const usuarios = data.usuarios || [];
    const pendentes = data.pendentes_aprovacao || 0;

    atualizarMenuAdmin(pendentes);
    document.getElementById("totalPendentes").textContent = String(pendentes);

    const lista = document.getElementById("listaAprovacoes");
    lista.innerHTML = "";

    // Filtrar apenas usuários NÃO aprovados
    const usuariosPendentes = usuarios.filter(u => !u.aprovado && !u.is_admin);

    if (!usuariosPendentes.length) {
      lista.innerHTML = '<div class="card"><h4>Nenhum usuario pendente</h4><p class="meta">Todos os usuarios foram aprovados ou sao administradores.</p></div>';
      setStatus("aprovacaoStatus", "Sem usuarios para revisar.");
      return;
    }

    const fragment = document.createDocumentFragment();
    usuariosPendentes.forEach((u) => {
      const card = document.createElement("div");
      card.className = "card";

      // Toggle de aprovação
      const label = document.createElement("label");
      label.className = "switch-inline approval-switch";
      label.setAttribute("for", `aprovado-${escapeHtml(u.usuario)}`);

      const input = document.createElement("input");
      input.id = `aprovado-${escapeHtml(u.usuario)}`;
      input.type = "checkbox";
      input.className = "switch-input";
      input.checked = Boolean(u.aprovado);
      input.addEventListener("change", async () => {
        await atualizarAprovacaoUsuario(u.usuario, input.checked);
      });

      const slider = document.createElement("span");
      slider.className = "switch-slider";
      slider.setAttribute("aria-hidden", "true");

      const text = document.createElement("span");
      text.className = "switch-text";
      text.textContent = input.checked ? "Acesso ativo" : "Pendente";

      input.addEventListener("change", () => {
        text.textContent = input.checked ? "Acesso ativo" : "Pendente";
      });

      label.appendChild(input);
      label.appendChild(slider);
      label.appendChild(text);

      card.innerHTML = `
        <div class="approval-row">
          <div class="approval-meta">
            <h4>${escapeHtml(u.usuario)}</h4>
            <div class="meta">Cadastro: ${escapeHtml(u.data_cadastro || "-")}</div>
            <div class="meta">Solicitado em: ${escapeHtml(u.data_cadastro || "-")}</div>
          </div>
        </div>
      `;

      card.querySelector(".approval-row").appendChild(label);
      fragment.appendChild(card);
    });

    lista.appendChild(fragment);
    setStatus("aprovacaoStatus", "Ative o acesso dos usuarios pendentes.");
  } catch (err) {
    setStatus("aprovacaoStatus", err.message, true);
  }
}

async function atualizarAprovacaoUsuario(nomeUsuario, aprovado) {
  try {
    const data = await api(`/admin/usuarios/${encodeURIComponent(nomeUsuario)}/aprovar`, {
      method: "PATCH",
      body: JSON.stringify({ aprovado })
    });
    atualizarMenuAdmin(data.pendentes_aprovacao || 0);
    document.getElementById("totalPendentes").textContent = String(data.pendentes_aprovacao || 0);
    setStatus("aprovacaoStatus", data.mensagem || "Acesso atualizado.");
    await carregarAprovacoes();
  } catch (err) {
    setStatus("aprovacaoStatus", err.message, true);
    await carregarAprovacoes();
  }
}

async function carregarUsuarios() {
  if (!adminLogado) {
    return;
  }

  setStatus("usuariosStatus", "Carregando usuarios...");
  try {
    const data = await api("/admin/usuarios");
    const usuarios = data.usuarios || [];

    const lista = document.getElementById("listaUsuarios");
    lista.innerHTML = "";

    if (!usuarios.length) {
      lista.innerHTML = '<div class="card"><h4>Nenhum usuario cadastrado</h4></div>';
      setStatus("usuariosStatus", "Nenhum usuario cadastrado.");
      return;
    }

    const fragment = document.createDocumentFragment();
    usuarios.forEach((u) => {
      const card = document.createElement("div");
      card.className = "card usuario-card";

      // Container para informações
      const infoContainer = document.createElement("div");
      infoContainer.className = "usuario-info";

      // Campo de username
      const usuarioLabel = document.createElement("label");
      usuarioLabel.textContent = "Usuario:";
      const usuarioInput = document.createElement("input");
      usuarioInput.type = "text";
      usuarioInput.value = escapeHtml(u.usuario);
      usuarioInput.placeholder = "Nome de usuario";
      usuarioInput.disabled = true;

      const usuarioDisplay = document.createElement("div");
      usuarioDisplay.className = "input-display";
      usuarioDisplay.appendChild(usuarioLabel);
      usuarioDisplay.appendChild(usuarioInput);

      // Campo de status
      const statusLabel = document.createElement("label");
      statusLabel.textContent = "Cargo:";
      const statusDisplay = document.createElement("div");
      statusDisplay.className = "status-badge";
      statusDisplay.textContent = u.is_admin ? "Administrador" : "Usuario";
      statusDisplay.classList.add(u.is_admin ? "badge-admin" : "badge-user");

      const statusContainer = document.createElement("div");
      statusContainer.className = "input-display";
      statusContainer.appendChild(statusLabel);
      statusContainer.appendChild(statusDisplay);

      infoContainer.appendChild(usuarioDisplay);
      infoContainer.appendChild(statusContainer);

      // Container de controles
      const controlsContainer = document.createElement("div");
      controlsContainer.className = "usuario-controls";

      // Botão para alterar senha
      const senhaBtn = document.createElement("button");
      senhaBtn.className = "btn small";
      senhaBtn.textContent = "Alterar Senha";
      senhaBtn.onclick = () => mostrarAlterarSenha(u.usuario);

      // Botão para renomear
      const renomearBtn = document.createElement("button");
      renomearBtn.className = "btn small";
      renomearBtn.textContent = "Renomear";
      renomearBtn.onclick = () => mostrarRenomear(u.usuario);

      // Toggle de admin
      const labelAdmin = document.createElement("label");
      labelAdmin.className = "switch-inline admin-switch";
      labelAdmin.setAttribute("for", `admin-${escapeHtml(u.usuario)}`);

      const inputAdmin = document.createElement("input");
      inputAdmin.id = `admin-${escapeHtml(u.usuario)}`;
      inputAdmin.type = "checkbox";
      inputAdmin.className = "switch-input";
      inputAdmin.checked = Boolean(u.is_admin);
      inputAdmin.addEventListener("change", async () => {
        await atualizarStatusAdmin(u.usuario, inputAdmin.checked);
      });

      const sliderAdmin = document.createElement("span");
      sliderAdmin.className = "switch-slider";
      const textAdmin = document.createElement("span");
      textAdmin.className = "switch-text";
      textAdmin.textContent = inputAdmin.checked ? "Admin" : "Usuario";

      inputAdmin.addEventListener("change", () => {
        textAdmin.textContent = inputAdmin.checked ? "Admin" : "Usuario";
      });

      labelAdmin.appendChild(inputAdmin);
      labelAdmin.appendChild(sliderAdmin);
      labelAdmin.appendChild(textAdmin);

      controlsContainer.appendChild(senhaBtn);
      controlsContainer.appendChild(renomearBtn);
      controlsContainer.appendChild(labelAdmin);

      card.appendChild(infoContainer);
      card.appendChild(controlsContainer);
      fragment.appendChild(card);
    });

    lista.appendChild(fragment);
    setStatus("usuariosStatus", "");
  } catch (err) {
    setStatus("usuariosStatus", err.message, true);
  }
}

async function atualizarStatusAdmin(nomeUsuario, ehAdmin) {
  try {
    const data = await api(`/admin/usuarios/${encodeURIComponent(nomeUsuario)}/admin`, {
      method: "PATCH",
      body: JSON.stringify({ eh_admin: ehAdmin })
    });
    setStatus("usuariosStatus", data.mensagem || "Status de admin atualizado.");
    await carregarUsuarios();
  } catch (err) {
    setStatus("usuariosStatus", err.message, true);
    await carregarUsuarios();
  }
}

async function mostrarAlterarSenha(nomeUsuario) {
  const senhaPrompt = prompt(`Digite a nova senha para ${nomeUsuario}:`, "");
  if (senhaPrompt === null) return;

  if (senhaPrompt.length < 3) {
    setStatus("usuariosStatus", "Senha precisa ter ao menos 3 caracteres", true);
    return;
  }

  try {
    const data = await api(`/admin/usuarios/${encodeURIComponent(nomeUsuario)}/senha`, {
      method: "PATCH",
      body: JSON.stringify({ senha: senhaPrompt })
    });
    setStatus("usuariosStatus", data.mensagem || "Senha alterada com sucesso.");
  } catch (err) {
    setStatus("usuariosStatus", err.message, true);
  }
}

async function mostrarRenomear(nomeAtual) {
  const nomeNovo = prompt(`Digite o novo nome de usuario (atual: ${nomeAtual}):`, nomeAtual);
  if (nomeNovo === null) return;

  if (nomeNovo === nomeAtual) {
    return;
  }

  try {
    const data = await api(`/admin/usuarios/${encodeURIComponent(nomeAtual)}/renomear`, {
      method: "PATCH",
      body: JSON.stringify({ nome_novo: nomeNovo })
    });
    setStatus("usuariosStatus", data.mensagem || "Usuario renomeado com sucesso.");
    await carregarUsuarios();
  } catch (err) {
    setStatus("usuariosStatus", err.message, true);
  }
}

async function carregarDashboard() {
  try {
    const data = await api("/dashboard");
    document.getElementById("totalMaquinas").textContent = data.totais.maquinas;
    resetFiltrosDashboard();
    montarOpcoesFiltro("ramOpcoes", "ram", data.ram || []);
    montarOpcoesFiltro("cpuOpcoes", "cpu", data.cpu || []);
    montarOpcoesFiltro("windowsOpcoes", "windows", data.windows || []);

    const mostrarTodos = document.getElementById("mostrarTodos");
    if (mostrarTodos) {
      mostrarTodos.checked = false;
      mostrarTodos.onchange = async () => {
        filtrosDashboard.mostrarTodos = mostrarTodos.checked;
        if (filtrosDashboard.mostrarTodos) {
          filtrosDashboard.ram.clear();
          filtrosDashboard.cpu.clear();
          filtrosDashboard.windows.clear();
          document.querySelectorAll("#ramOpcoes input, #cpuOpcoes input, #windowsOpcoes input").forEach((el) => {
            el.checked = false;
          });
        }
        await aplicarFiltrosDashboard();
      };
    }

    document.getElementById("dashboardResultado").innerHTML = "";
    document.getElementById("detalheComputador").innerHTML = "";
    document.getElementById("filtroAtual").textContent = "Nenhum";
    document.getElementById("totalCategoria").textContent = "0";
    setStatus("filtroStatus", "Marque uma ou mais caixas para filtrar.");
  } catch (err) {
    const div = document.getElementById("dashboardResultado");
    div.innerHTML = `<div class="card"><h4>Erro ao carregar dashboard</h4><p class="meta">${escapeHtml(err.message)}</p></div>`;
  }
}

async function carregarDetalheComputador(nomeComputador) {
  if (!nomeComputador) {
    return;
  }

  try {
    const data = await api(`/computadores/${encodeURIComponent(nomeComputador)}`);
    const registro = data.registro || {};
    const historico = data.historico || [];

    abrirModalComputador(registro, historico);
  } catch (err) {
    setStatus("filtroStatus", `Erro ao carregar detalhes: ${err.message}`, true);
  }
}

async function buscar() {
  const termo = document.getElementById("busca").value.trim();
  if (!termo) {
    setStatus("buscaStatus", "Digite um termo para pesquisar.", true);
    return;
  }

  setStatus("buscaStatus", "Buscando...");

  try {
    const data = await api("/buscar", {
      method: "POST",
      body: JSON.stringify({ termo })
    });

    setStatus("buscaStatus", `${data.total} resultado(s) encontrado(s).`);

    const div = document.getElementById("resultadoBusca");
    div.innerHTML = "";

    if (!data.total) {
      div.innerHTML = '<div class="card"><h4>Nada encontrado</h4><p class="meta">Tente pesquisar por usuario, IP, serial ou computador.</p></div>';
      return;
    }

    const fragment = document.createDocumentFragment();
    data.resultados.forEach((item) => {
      const r = item.registro;
      const historico = item.historico || [];
      const card = document.createElement("div");
      card.className = "card";
      card.innerHTML = `
        <h4>${escapeHtml(r.computador || "Computador sem nome")}</h4>
        <div class="meta">Usuario: ${escapeHtml(r.usuario)} | IP: ${escapeHtml(r.ip)} | RAM: ${escapeHtml(r.ram)} | CPU: ${escapeHtml(r.cpu)}</div>
      `;

      if (r.computador) {
        card.classList.add("card-clickable");
        card.setAttribute("role", "button");
        card.setAttribute("tabindex", "0");

        const abrirDetalhe = () => {
          trocar("dashboard");
          carregarDetalheComputador(r.computador);
        };
        card.addEventListener("click", abrirDetalhe);
        card.addEventListener("keydown", (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            abrirDetalhe();
          }
        });
      }

      card.appendChild(renderCampos(r));

      const timeline = document.createElement("div");
      timeline.className = "timeline";
      const title = document.createElement("strong");
      title.textContent = "Historico";
      timeline.appendChild(title);

      if (historico.length) {
        historico.forEach((h) => {
          const itemLinha = document.createElement("div");
          itemLinha.className = "timeline-item";
          itemLinha.textContent = `${h.data} - ${h.mudanca}`;
          timeline.appendChild(itemLinha);
        });
      } else {
        const vazio = document.createElement("div");
        vazio.className = "timeline-item";
        vazio.textContent = "Sem historico registrado.";
        timeline.appendChild(vazio);
      }

      card.appendChild(timeline);
      fragment.appendChild(card);
    });

    div.appendChild(fragment);
  } catch (err) {
    setStatus("buscaStatus", err.message, true);
  }
}

async function salvar() {
  const titulo = document.getElementById("titulo").value.trim();
  const conteudo = document.getElementById("conteudo").value.trim();

  if (!titulo || !conteudo) {
    setStatus("relatorioStatus", "Titulo e conteudo sao obrigatorios.", true);
    return;
  }

  try {
    await api("/salvar_relatorio", {
      method: "POST",
      body: JSON.stringify({ titulo, conteudo })
    });

    document.getElementById("titulo").value = "";
    document.getElementById("conteudo").value = "";
    setStatus("relatorioStatus", "Relatorio salvo com sucesso.");
    await carregarRelatorios();
  } catch (err) {
    setStatus("relatorioStatus", err.message, true);
  }
}

async function carregarRelatorios() {
  try {
    const data = await api("/listar_relatorios");
    const relatorios = data.relatorios || [];

    const div = document.getElementById("lista");
    div.innerHTML = "";

    if (!relatorios.length) {
      div.innerHTML = '<div class="card"><h4>Nenhum relatorio</h4><p class="meta">Salve o primeiro relatorio para aparecer aqui.</p></div>';
      return;
    }

    const fragment = document.createDocumentFragment();
    relatorios.forEach((r) => {
      const card = document.createElement("div");
      card.className = "card";
      card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: start; gap: 10px;">
          <div style="flex: 1; min-width: 0;">
            <h4>${escapeHtml(r.titulo)}</h4>
            <div class="meta">${escapeHtml(r.usuario)} - ${escapeHtml(r.data)}</div>
            <p>${escapeHtml(r.conteudo)}</p>
          </div>
          <button class="btn" style="margin-top: 0; padding: 8px 10px; font-size: 12px; white-space: nowrap;" onclick="deletarRelatorio(${r.id})">Deletar</button>
        </div>
      `;
      fragment.appendChild(card);
    });

    div.appendChild(fragment);
  } catch (err) {
    const div = document.getElementById("lista");
    div.innerHTML = `<div class="card"><h4>Erro ao listar relatorios</h4><p class="meta">${escapeHtml(err.message)}</p></div>`;
  }
}

async function exportarRelatoriosCsv() {
  try {
    const response = await fetch("/exportar_relatorios.csv");
    if (!response.ok) {
      throw new Error("Falha ao exportar CSV");
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "relatorios.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setStatus("relatorioStatus", "CSV exportado com sucesso.");
  } catch (err) {
    setStatus("relatorioStatus", err.message, true);
  }
}

async function deletarRelatorio(relatorioId) {
  const confirmacao = confirm("Tem certeza que deseja deletar este relatorio?");
  if (!confirmacao) {
    return;
  }

  const senha = prompt("Digite a senha para confirmar a delecao:");
  if (senha === null) {
    return;
  }

  try {
    await api(`/deletar_relatorio/${relatorioId}`, {
      method: "DELETE",
      body: JSON.stringify({ senha })
    });
    setStatus("relatorioStatus", "Relatorio deletado com sucesso.");
    await carregarRelatorios();
  } catch (err) {
    setStatus("relatorioStatus", err.message, true);
  }
}

function configurarAtalhosTeclado() {
  const inputUsuario = document.getElementById("usuario");
  const inputSenha = document.getElementById("senha");
  const inputBusca = document.getElementById("busca");

  const acionarLogin = (event) => {
    if (event.key !== "Enter") {
      return;
    }
    event.preventDefault();
    logar();
  };

  const acionarBusca = (event) => {
    if (event.key !== "Enter") {
      return;
    }
    event.preventDefault();
    buscar();
  };

  if (inputUsuario) {
    inputUsuario.addEventListener("keydown", acionarLogin);
  }
  if (inputSenha) {
    inputSenha.addEventListener("keydown", acionarLogin);
  }
  if (inputBusca) {
    inputBusca.addEventListener("keydown", acionarBusca);
  }
}

window.trocar = trocar;
window.logar = logar;
window.registrar = registrar;
window.sair = sair;
window.buscar = buscar;
window.salvar = salvar;
window.exportarRelatoriosCsv = exportarRelatoriosCsv;
window.deletarRelatorio = deletarRelatorio;
window.limparFiltrosDashboard = limparFiltrosDashboard;
window.alternarPainelFiltros = alternarPainelFiltros;
window.alternarGrupoFiltro = alternarGrupoFiltro;
window.fecharModalComputador = fecharModalComputador;

iniciarInteracoesModal();
configurarSugestoesUsuariosLogin();
configurarSugestaoSenhaLogin();
configurarAtalhosTeclado();
validarSessaoInicial();
