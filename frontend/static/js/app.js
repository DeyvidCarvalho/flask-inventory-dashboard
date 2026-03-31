let usuarioLogado = "";
const filtrosDashboard = {
  ram: new Set(),
  cpu: new Set(),
  windows: new Set(),
  mostrarTodos: false
};

function setExpansaoPainel(painelId, botaoId, expandido) {
  const painel = document.getElementById(painelId);
  const botao = document.getElementById(botaoId);

  if (painel) {
    if (expandido) {
      painel.classList.add("is-open");
      painel.style.maxHeight = "0px";
      requestAnimationFrame(() => {
        painel.style.maxHeight = `${painel.scrollHeight}px`;
      });

      const aoExpandir = (event) => {
        if (event.propertyName !== "max-height") {
          return;
        }
        if (painel.classList.contains("is-open")) {
          painel.style.maxHeight = "none";
        }
        painel.removeEventListener("transitionend", aoExpandir);
      };

      painel.addEventListener("transitionend", aoExpandir);
    } else {
      if (painel.style.maxHeight === "none" || !painel.style.maxHeight) {
        painel.style.maxHeight = `${painel.scrollHeight}px`;
      }
      void painel.offsetHeight;
      painel.style.maxHeight = "0px";
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
  if (!usuario) {
    setStatus("loginStatus", "Digite um nome para entrar.", true);
    return;
  }

  try {
    const data = await api("/login", {
      method: "POST",
      body: JSON.stringify({ usuario })
    });

    usuarioLogado = data.usuario;
    setStatus("loginStatus", `Bem-vindo, ${usuarioLogado}.`);
    document.getElementById("logoutBtn").classList.remove("hidden");
    trocar("dashboard");
    await carregarDashboard();
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
  document.getElementById("logoutBtn").classList.add("hidden");
  setStatus("loginStatus", "Sessao encerrada.");
  trocar("login");
}

async function validarSessaoInicial() {
  try {
    const data = await api("/session");
    usuarioLogado = data.usuario;
    document.getElementById("logoutBtn").classList.remove("hidden");
    trocar("dashboard");
    await carregarDashboard();
  } catch (_err) {
    trocar("login");
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

  const detalhe = document.getElementById("detalheComputador");
  detalhe.innerHTML = '<div class="card"><h4>Carregando detalhes...</h4></div>';

  try {
    const data = await api(`/computadores/${encodeURIComponent(nomeComputador)}`);
    const registro = data.registro || {};
    const historico = data.historico || [];

    const card = document.createElement("div");
    card.className = "card card-detalhe";
    card.innerHTML = `
      <h4>Detalhes: ${escapeHtml(registro.computador || nomeComputador)}</h4>
      <div class="meta">Usuario: ${escapeHtml(registro.usuario)} | IP: ${escapeHtml(registro.ip)} | Serial: ${escapeHtml(registro.serial)}</div>
    `;

    card.appendChild(renderCampos(registro));

    const timeline = document.createElement("div");
    timeline.className = "timeline";
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

    card.appendChild(timeline);
    detalhe.innerHTML = "";
    detalhe.appendChild(card);
  } catch (err) {
    detalhe.innerHTML = `<div class="card"><h4>Erro ao carregar detalhes</h4><p class="meta">${escapeHtml(err.message)}</p></div>`;
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

window.trocar = trocar;
window.logar = logar;
window.sair = sair;
window.buscar = buscar;
window.salvar = salvar;
window.exportarRelatoriosCsv = exportarRelatoriosCsv;
window.deletarRelatorio = deletarRelatorio;
window.limparFiltrosDashboard = limparFiltrosDashboard;
window.alternarPainelFiltros = alternarPainelFiltros;
window.alternarGrupoFiltro = alternarGrupoFiltro;

validarSessaoInicial();
