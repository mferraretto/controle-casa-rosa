
  import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
  import {
    getFirestore,
    collection,
    addDoc,
    onSnapshot,
    query,
    orderBy,
    updateDoc,
    deleteDoc,
    doc,
    getDoc,
    getDocs
  } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";
import {
    getAuth,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged
  } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";

  // Configuração do Firebase
  const firebaseConfig = {
    apiKey: "AIzaSyDanvDxs2RDaMNc7zARyyyUt0rLqes95H0",
    authDomain: "painelpedidos-v2.firebaseapp.com",
    projectId: "painelpedidos-v2",
    storageBucket: "painelpedidos-v2.firebasestorage.app",
    messagingSenderId: "135497440608",
    appId: "1:135497440608:web:093e8fc4264257d5065205"
  };

  // Inicializa o Firebase e Firestore
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);
const auth = getAuth(app);
  window.auth = auth;
  // 🔁 Sincroniza SKUs equivalentes em tempo real
window.skusEquivalentes = {};
onSnapshot(collection(db, "skus_equivalentes"), snap => {
  const equivalentes = {};
  snap.docs.forEach(doc => {
    const data = doc.data();
    equivalentes[data.base] = data.equivalentes || [];
  });
  window.skusEquivalentes = equivalentes;
  console.log("🟢 SKUs equivalentes atualizados:", window.skusEquivalentes);
});

window.fazerLogin = function () {
  const email = document.getElementById("emailLogin").value;
  const senha = document.getElementById("senhaLogin").value;

  signInWithEmailAndPassword(auth, email, senha)
    .then(userCredential => {
      console.log("Login realizado:", userCredential.user.email);
      document.getElementById("erroLogin").textContent = "";
    })
    .catch(error => {
      console.error("Erro de login:", error);
      document.getElementById("erroLogin").textContent = "Email ou senha inválidos.";
    });
};

onAuthStateChanged(auth, (user) => {
    if (user) {
      document.getElementById("login").style.display = "none";
      document.getElementById("sistema").style.display = "block";
      carregarSkusEquivalentes();
      carregarLojasRegistradas();
    } else {
      document.getElementById("login").style.display = "flex";
      document.getElementById("sistema").style.display = "none";
    }
  });

window.deslogarUsuario = function () {
  signOut(auth).then(() => location.reload());
};
  // Remover pendentes que já estão como enviados
  async function removerPendentesJaEnviados() {
    const pendentesSnap = await getDocs(collection(db, "pedidos_pendentes"));
    const enviadosSnap  = await getDocs(collection(db, "pedidos_enviados"));

    const enviadosIds = new Set();
    enviadosSnap.forEach(doc => {
      const id = doc.data().pedidoId || doc.data().Pedido || "";
      enviadosIds.add(id.toString().trim());
    });

    const promises = [];
    pendentesSnap.forEach(doc => {
      const id = doc.data().pedidoId || doc.data().Pedido || "";
      if (enviadosIds.has(id.toString().trim())) {
        promises.push(deleteDoc(doc.ref));
      }
    });

    await Promise.all(promises);
    alert("✅ Pedidos duplicados removidos da aba 'Novos a Enviar'.");
    location.reload();
  }

  // Expondo funções e objetos no escopo global
  window.removerPendentesJaEnviados = removerPendentesJaEnviados;
  window.db = db;
  window.collection = collection;
  window.addDoc = addDoc;
  window.onSnapshot = onSnapshot;
  window.doc = doc;
  window.updateDoc = updateDoc;
  window.deleteDoc = deleteDoc;
  window.getDoc = getDoc;
  window.getDocs = getDocs;

  // Estado global
  window.importadosList = [];
  window.enviadosList = [];
  window.canceladosList = [];
  window.pdfsList = [];
  window.historicoList = [];
// Informações dos produtos (nome -> dados)
  window.produtosMap = {};
  // Listener "Pedidos Importados"
  const pedidosRef = collection(db, "pedidos_pendentes");
  const pedidosQuery = query(pedidosRef, orderBy("dataPagamento"));
  onSnapshot(pedidosQuery, snapshot => {
    const lista = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    window.importadosList = lista;
    aplicarFiltroPedidos();
    preencherFiltroLojaDashboard();
    atualizarResumoPedidosAEviar();
  });

  // Listener "Pedidos Enviados"
  const enviadosRef = collection(db, "pedidos_enviados");
  onSnapshot(enviadosRef, snap => {
    window.enviadosList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderizarTabelaEnviados(window.enviadosList);
    preencherFiltroLojaDashboard();
    atualizarResumoPedidosAEviar();
    carregarPendentesFirebase();
  });

  // Listener "Pedidos Cancelados"
  const canceladosRef = collection(db, "pedidos_cancelados");
  onSnapshot(canceladosRef, snap => {
    const cancelados = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    window.canceladosList = cancelados;
    renderizarTabelaCancelados(cancelados);
    atualizarResumoPedidosAEviar();
  });

  // Listener "PDFs de Etiquetas"
  const pdfsRef = collection(db, "pdf_etiquetas");
  onSnapshot(pdfsRef, snap => {
    window.pdfsList = snap.docs.map(d => {
      const data = d.data();
      return { id: d.id, nome: data.nome, conteudo: data.base64, ...data };
    });
    atualizarListaPDFs();
    atualizarResumoPedidosAEviar();
  });

  // Atualizar pedido específico
  async function atualizarPedido(id, dados) {
    const ref = doc(db, "pedidos_pendentes", id);
    await updateDoc(ref, dados);
  }

  // Sincronizar pendentes automaticamente com enviados
  onSnapshot(collection(db, "pedidos_enviados"), async (snapshot) => {
    const enviados = [];
    snapshot.forEach(doc => enviados.push(doc.data()));

    const pendentesSnap = await getDocs(collection(db, "pedidos_pendentes"));
    const promises = [];

    pendentesSnap.forEach(docPendente => {
      const idPendente = (docPendente.data().Pedido || docPendente.data().pedidoId || "").toString().trim();

      const existeNosEnviados = enviados.some(env => {
        const idEnviado = (env.Pedido || env.pedidoId || "").toString().trim();
        return idEnviado === idPendente;
      });

      if (existeNosEnviados) {
        promises.push(deleteDoc(doc(db, "pedidos_pendentes", docPendente.id)));
      }
    });

    if (promises.length > 0) {
      await Promise.all(promises);
      console.log("✅ Pedidos removidos da aba 'Novos a Enviar' por estarem em 'Pedidos Enviados'");
      if (typeof carregarPendentesFirebase === "function") {
        carregarPendentesFirebase();
      }
    }
  });

  // Renderizar tabela de enviados
  onSnapshot(collection(db, "pedidos_enviados"), snapshot => {
    const container = document.getElementById("tabela-enviados");
    container.innerHTML = "";

    if (snapshot.empty) {
      container.innerHTML = "<p>Nenhum pedido enviado encontrado.</p>";
      return;
    }

    const table = document.createElement("table");
    table.innerHTML = `
      <thead>
        <tr>
          <th>Loja</th>
          <th>Pedido</th>
          <th>Produto (SKU)</th>
          <th>Rastreio</th>
          <th>Pagamento</th>
          <th>Envio</th>
        </tr>
      </thead>
      <tbody></tbody>
    `;

    const tbody = table.querySelector("tbody");

    snapshot.forEach(doc => {
      const p = doc.data();
      const tr = document.createElement("tr");

      tr.innerHTML = `
        <td>${p.Loja || "-"}</td>
        <td>${p.pedidoId || "-"}</td>
        <td>${p.SKU || "-"}</td>
        <td>${p.Rastreio || "-"}</td>
        <td>${p.dataPagamento ? new Date(p.dataPagamento).toLocaleDateString() : "-"}</td>
        <td>${p.dataEnvio ? new Date(p.dataEnvio).toLocaleDateString() : "-"}</td>
      `;

      tbody.appendChild(tr);
    });

    container.appendChild(table);
  });
  


  async function carregarPendentesFirebase() {
  const snapshot = await getDocs(collection(db, "pedidos_pendentes"));
  const pendentes = [];
  snapshot.forEach(doc => {
    pendentes.push({ id: doc.id, ...doc.data() });
  });

  // 🔁 Atualize esta parte abaixo
  const enviados = window.enviadosList || [];
  const idsEnviados = new Set(
    enviados.map(e =>
      (e.Pedido || e.pedidoId || "").toString().trim()
    )
  );
  const pendentesFiltrados = pendentes.filter(p =>
    !idsEnviados.has((p.Pedido || p.pedidoId || "").toString().trim())
  );

renderTabela("tabelaPendentes", pendentesFiltrados);

  if (document.getElementById("contadorPedidosPendentes")) {
    document.getElementById("contadorPedidosPendentes").textContent = pendentesFiltrados.length;
  }
}
  // 🔄 Carrega lista de lojas cadastradas no Firestore
async function carregarLojasRegistradas() {
  const snap = await getDocs(collection(db, "lojas"));
  window.lojasRegistradas = snap.docs.map(doc => doc.id);
}
function identificarLoja(texto) {
  const linhas = texto.split('\n');
  const indexRemetente = linhas.findIndex(l => l.trim().toUpperCase() === "REMETENTE");

  if (indexRemetente >= 0) {
    for (let i = indexRemetente + 1; i < linhas.length; i++) {
      const linha = linhas[i].trim();

      // Ignora linhas irrelevantes
      if (
        linha === "" ||
        linha.toUpperCase().startsWith("CEP") ||
        /^\d{5}-?\d{3}$/.test(linha) ||         // CEP
        /^\d{1,6}$/.test(linha) ||              // Número
        /^[\d,.:\/\-]+$/.test(linha) ||         // Endereços numéricos
        linha.toLowerCase().includes("avenida") ||
        linha.toLowerCase().includes("rua") ||
        linha.toLowerCase().includes("bairro") ||
        linha.toLowerCase().includes("bloco")
      ) continue;

      // Provável nome da loja
      if (
        linha.length > 3 &&
        !linha.match(/^\d/) && // não começa com número
        !linha.includes("@")   // ignora emails
      ) {
        return linha;
      }
    }
  }

  // 🔍 Tentativa baseada em Firestore
  if (window.lojasRegistradas && Array.isArray(window.lojasRegistradas)) {
    for (const loja of window.lojasRegistradas) {
      if (texto.toLowerCase().includes(loja.toLowerCase())) {
        return loja;
      }
    }
  }

  // Fallback manual
  const match = texto.match(/(Casa Rosa Decorações|Collore Na Web|DAC Store)/i);
  return match ? match[1] : "Loja Desconhecida";
}






  // Renderização da tabela de “Novos a Enviar”
  function renderizarTabelaPendentes(lista) {

    const container = document.getElementById("tabelaPendentes");
    if (!container) return;

    let html = `
      <div style="overflow-x:auto;"><table>
        <thead>
          <tr>
            <th>Pedido</th>
            <th>Loja</th>
            <th>Produto</th>
            <th>Pagamento</th>
            <th>Rastreio</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
    `;

    lista.forEach(p => {
      const pedido   = p.Pedido || p.pedidoId || "";
      const loja     = p.Loja || "";
      const produto  = p.SKU || "";
      const pagamento = p.dataPagamento
        ? new Date(p.dataPagamento).toLocaleString()
        : "";
      const rastreio = p.Rastreio || "";
      
      html += `
        <tr>
          <td>${pedido}</td>
          <td>${loja}</td>
          <td>${produto}</td>
          <td>${pagamento}</td>
          <td>${rastreio}</td>
          <td><button class="danger" onclick="cancelarPedido('${p.id}')">❌ Cancelar</button></td>
        </tr>
      `;
    });

    html += "</tbody></table></div>";
    container.innerHTML = html;

    // Remova esta linha se não houver a função:
    // atualizarTabelas();
  }
let metasPorLoja = JSON.parse(localStorage.getItem("metasPorLoja") || "{}");



function renderizarTabelaMetas() {
  const lojas = [...new Set((window.enviadosList || []).map(p => p.Loja).filter(Boolean))];
  const tbody = document.querySelector("#tabela-metas tbody");
  tbody.innerHTML = "";

  lojas.forEach(loja => {
    const meta = metasPorLoja[loja] || "";
    const linha = document.createElement("tr");
    linha.innerHTML = `
      <td style="padding:0.5rem;">${loja}</td>
      <td style="padding:0.5rem;">
        <input type="number" min="0" value="${meta}" data-loja="${loja}" style="width:100px;" />
      </td>
      <td style="padding:0.5rem;">
        <button onclick="removerMeta('${loja}')">❌ Remover</button>
      </td>
    `;
    tbody.appendChild(linha);
  });
}

function salvarMetas() {
  const inputs = document.querySelectorAll("#tabela-metas input[data-loja]");
  inputs.forEach(input => {
    const loja = input.dataset.loja;
    const valor = parseInt(input.value);
    if (!isNaN(valor)) {
      metasPorLoja[loja] = valor;
    }
  });
  localStorage.setItem("metasPorLoja", JSON.stringify(metasPorLoja));
  alert("🎯 Metas salvas com sucesso!");
}

function removerMeta(loja) {
  delete metasPorLoja[loja];
  localStorage.setItem("metasPorLoja", JSON.stringify(metasPorLoja));
  renderizarTabelaMetas();
}




  function renderizarTabelaEnviados(lista) {
  const container = document.getElementById("tabela-enviados");
  if (!container) return;

  let html = `
    <div style="overflow-x:auto;"><table>
      <thead>
        <tr>
          <th>Pedido</th>
          <th>Loja</th>
          <th>Produto</th>
          <th>Rastreio</th>
          <th>Pagamento</th>
          <th>Data Envio</th>
          <th>Ações</th>
        </tr>
      </thead>
      <tbody>
  `;

  lista.forEach(p => {
    const pedido   = p.pedidoId || "-";
    const loja     = p.Loja || "-";
    const produto  = p.SKU || "-";
    const rastreio = p.Rastreio || "-";
    const pag      = p.dataPagamento ? new Date(p.dataPagamento).toLocaleDateString() : "-";
    const envio    = p.dataEnvio ? new Date(p.dataEnvio).toLocaleDateString() : "-";

    html += `
      <tr>
        <td>${pedido}</td>
        <td>${loja}</td>
        <td>${produto}</td>
        <td>${rastreio}</td>
        <td>${pag}</td>
        <td>${envio}</td>
        <td><button class="danger" onclick="cancelarPedido('${p.id}')">❌ Cancelar</button></td>
      </tr>
    `;
  });

  html += `</tbody></table></div>`;
  container.innerHTML = html;
}


  // Renderização da tabela de “Cancelados”
  function renderizarTabelaCancelados(lista) {
    const tbody = document.querySelector("#tabela-cancelados tbody");
    tbody.innerHTML = "";
    lista.forEach(p => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${p.Loja || ""}</td>
        <td>${p.motivo || ""}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  // Marca um pedido como “enviado” no Firestore
  window.marcarEnviado = id => {
    atualizarPedido(id, {
      status: "enviado",
      dataEnvio: new Date().toISOString()
    });
  };

  // Cancela um pedido: atualiza status e registra em coleção “pedidos_cancelados”
  window.cancelarPedido = async id => {
    const motivo = prompt("Digite o motivo do cancelamento:");
    if (!motivo) return;
    // 1) Atualiza o próprio pedido
    await atualizarPedido(id, {
      status: "cancelado",
      motivo,
      dataCancelamento: new Date().toISOString()
    });
    // 2) Registra em coleção específica de cancelados
    await addDoc(
      collection(db, "pedidos_cancelados"),
      {
        pedidoId: id,
        motivo,
        dataCancelamento: new Date().toISOString()
      }
    );
  };


    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('service-worker.js').then(() => {
        console.log("✅ Service Worker registrado com sucesso");
      });
    }
  

  // Alterna abas do sistema
  function abrirAba(id) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelector('.tab[onclick*="' + id + '"]').classList.add('active');
    document.getElementById(id).classList.add('active');

    if (id === "dashboard") {
      atualizarDashboardPorDataLoja();
      atualizarResumoVendasMensal();
      preencherFiltroLojaDashboard();
      gerarResumoVendasPorProduto();
      preencherFiltroProdutosDashboard();
      renderizarGraficoVendasPorDia();
      renderizarGraficoTopComparativo();
      renderizarGraficoTempoEnvio();
      gerarRelatorioDetalhado();
    } else if (id === "aba-metas") {
      preencherFiltroLojaMetas();
      atualizarRelatorioMetas();
    } else if (id === "aba-produtos") {
      carregarProdutos();
       } else if (id === "aba-admin") {
      preencherFiltroLojaMetas();
      atualizarRelatorioMetas();
      carregarProdutos();
      atualizarCardsMetas();
    }
  }
  // Retorna o primeiro campo definido em obj dentre a lista de keys
  function normalizarCampo(obj, campos) {
    for (const campo of campos) {
      if (obj[campo]) return obj[campo];
    }
    return "";
  }
function atualizarResumoVendasMensal() {
  const enviados = window.enviadosList || [];
  const mesSelecionado  = document.getElementById("filtroMesDashboard")?.value;
  const lojaSelecionada = document.getElementById("filtroLojaDashboard")?.value;

  // ✅ Função para obter SKU base
  window.obterSkuBase = function(sku) {
 const equivalents = window.skusEquivalentes || {};
  for (const [base, aliases] of Object.entries(equivalents)) {
    if (base === sku || (Array.isArray(aliases) && aliases.includes(sku))) {
      return base;
    }
  }
  return sku;
};


  const resumo = {};

  enviados.forEach(p => {
    if (!p.dataEnvio) return;
    const dt = new Date(p.dataEnvio.split("T")[0]);
    if (!dt || isNaN(dt)) return;

    const dataStr = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
    if (mesSelecionado && dataStr !== mesSelecionado) return;

    const loja = p.Loja || "";
    if (lojaSelecionada && loja !== lojaSelecionada) return;

    const skuOriginal = p.SKU || "Desconhecido";
    const skuBase = window.obterSkuBase(p.SKU);


    resumo[skuBase] = (resumo[skuBase] || 0) + 1;
  });

  const saida = Object.entries(resumo)
    .sort((a, b) => b[1] - a[1])
    .map(
      ([produto, qtd]) =>
        `<div style="padding: 0.2rem 0;">• <strong>${produto}</strong>: ${qtd}</div>`
    )
    .join("");

  document.getElementById("vendas-por-produto").innerHTML =
    saida || "<i style='color:#888'>Nenhuma venda no período.</i>";
}

  // Lê um arquivo .xlsx e passa o JSON da primeira planilha ao callback
  function lerArquivo(input, callback) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(sheet);
      callback(json);
    };
    reader.readAsArrayBuffer(input.files[0]);
  }

async function processarArquivos() {
  const inputEnviar = document.getElementById('arquivoEnviar');
  const inputEnviados = document.getElementById('arquivoEnviados');

  const enviarTemArquivo = inputEnviar?.files.length > 0;
  const enviadosTemArquivo = inputEnviados?.files.length > 0;

  if (!enviarTemArquivo && !enviadosTemArquivo) {
    alert("Por favor, selecione pelo menos um arquivo para importar.");
    return;
  }

  // Carrega todos os pedidos existentes para evitar duplicidade
  const [pendentesSnap, enviadosSnap, canceladosSnap] = await Promise.all([
    getDocs(collection(db, "pedidos_pendentes")),
    getDocs(collection(db, "pedidos_enviados")),
    getDocs(collection(db, "pedidos_cancelados")),
  ]);

  const idsExistentes = new Set();
  [...pendentesSnap.docs, ...enviadosSnap.docs, ...canceladosSnap.docs].forEach(doc => {
    const id = doc.data().pedidoId || doc.data().Pedido || "";
    idsExistentes.add(id.toString().trim().toUpperCase());
  });

  // ─── IMPORTAR "A ENVIAR" ──────────────────────────────
  if (enviarTemArquivo) {
  await new Promise(resolve => {
    lerArquivo(inputEnviar, async dadosEnviar => {
      for (const p of dadosEnviar) {
        const pedidoId = normalizarCampo(p, ["Nº de Pedido da Plataforma"]).toString().trim().toUpperCase();
        if (!pedidoId || idsExistentes.has(pedidoId)) continue;

        const statusPosVenda = normalizarCampo(p, ["Pós-venda/Cancelado/Devolvido", "Pós-venda"]);
        const horaEnvio = normalizarCampo(p, ["Hora de Envio"]);

        const baseDoc = {
          pedidoId,
          Loja: normalizarCampo(p, ["Loja", "Nome da Loja no UpSeller"]),
          SKU: normalizarCampo(p, ["SKU"]),
          Rastreio: normalizarCampo(p, ["Nº de Rastreio", "Código de Rastreio"]),
          dataPagamento: p["Impressão da Etiqueta"]
            ? new Date(p["Impressão da Etiqueta"]).toISOString()
            : new Date().toISOString(),
          status: "novo"
        };

        try {
          if (statusPosVenda?.toLowerCase().includes("cancelado")) {
            await addDoc(collection(db, "pedidos_cancelados"), {
              ...baseDoc,
              motivo: "Cancelado automaticamente via planilha",
              dataCancelamento: new Date().toISOString()
            });
            console.log("📦 Pedido cancelado:", pedidoId);
          } else if (horaEnvio && !isNaN(new Date(horaEnvio))) {
  await addDoc(collection(db, "pedidos_enviados"), {
    ...baseDoc,
    dataEnvio: new Date(horaEnvio).toISOString()
  });

            console.log("✅ Pedido enviado:", pedidoId);
          } else {
            await addDoc(collection(db, "pedidos_pendentes"), baseDoc);
            console.log("🕒 Pedido pendente:", pedidoId);
          }
        } catch (erro) {
          console.error("❌ Erro ao salvar pedido:", pedidoId, erro);
        }
      }

      alert("✅ Pedidos 'a enviar' importados com sucesso!");
      resolve();
    });
  });
}


  // ─── IMPORTAR "ENVIADOS" ──────────────────────────────
if (enviadosTemArquivo) {
  await new Promise(resolve => {
    lerArquivo(inputEnviados, async dadosEnviados => {
      console.log("📦 Dados da planilha ENVIADOS:", dadosEnviados);

      for (const pedido of dadosEnviados) {
        const pedidoId = normalizarCampo(pedido, [
          "Nº de Pedido da Plataforma",
          "Número do Pedido",
          "Pedido",
          "ID do Pedido"
        ]).toString().trim().toUpperCase();

        if (!pedidoId) continue;

        const loja = normalizarCampo(pedido, ["Loja", "Nome da Loja no UpSeller"]);
        const sku = normalizarCampo(pedido, ["SKU", "Produto"]);
        const rastreio = normalizarCampo(pedido, ["Código de Rastreio", "Rastreio", "Nº de Rastreio"]);
        const pagRaw = normalizarCampo(pedido, ["Data de Pagamento", "Impressão da Etiqueta"]);
        const envioRaw = normalizarCampo(pedido, ["Hora de Envio"]);

        const dataPagamento = pagRaw && !isNaN(new Date(pagRaw)) ? new Date(pagRaw).toISOString() : null;
        const dataEnvio = envioRaw && !isNaN(new Date(envioRaw)) ? new Date(envioRaw).toISOString() : new Date().toISOString();

        try {
          // 1️⃣ Verifica se já está em pedidos_enviados ou pedidos_cancelados
          const enviadoJaExiste = enviadosSnap.docs.some(d => (d.data().pedidoId || "").toUpperCase() === pedidoId);
          const canceladoJaExiste = canceladosSnap.docs.some(d => (d.data().pedidoId || "").toUpperCase() === pedidoId);

          if (enviadoJaExiste || canceladoJaExiste) {
            console.warn("⏭️ Ignorado (já enviado ou cancelado):", pedidoId);
            continue;
          }

          // 2️⃣ Verifica se está nos pendentes → remove e move para enviados
          const pendenteDoc = pendentesSnap.docs.find(d => (d.data().pedidoId || "").toUpperCase() === pedidoId);
          if (pendenteDoc) {
            await deleteDoc(doc(db, "pedidos_pendentes", pendenteDoc.id));
            console.log("🧹 Removido de pendentes:", pedidoId);
          }

          // 3️⃣ Adiciona em pedidos_enviados
          await addDoc(collection(db, "pedidos_enviados"), {
            pedidoId,
            Loja: loja,
            SKU: sku,
            Rastreio: rastreio,
            dataPagamento,
            dataEnvio,
            status: "enviado"
          });

          console.log("✅ Pedido enviado salvo:", pedidoId);
        } catch (erro) {
          console.error("❌ Erro ao salvar pedido:", pedidoId, erro);
        }
      }

      alert("✅ Pedidos ENVIADOS importados com sucesso!");
      await carregarEnviadosFirebase();
      resolve();
    });
  });
}


}
async function carregarEnviadosFirebase() {
  const snap = await getDocs(collection(db, "pedidos_enviados"));
  const hoje = new Date();
  const tresDiasAtras = new Date();
  tresDiasAtras.setDate(hoje.getDate() - 3);

  const todos = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  const recentes = todos.filter(p => {
    if (!p.dataEnvio) return false;
    const dt = new Date(p.dataEnvio.split("T")[0]);
    return dt >= tresDiasAtras;
  });

  window.enviadosList = recentes;

  atualizarTabelas();
  gerarGraficoMediaVendas();
}

// ✅ Cole esta em seu lugar:
// Cancela um pedido: atualiza status no pedido original e registra em “pedidos_cancelados”
async function cancelarPedido(pedidoId) {
  const motivo = prompt("Digite o motivo do cancelamento:");
  if (!motivo) return;

  try {
    const pedidoRef = doc(db, "pedidos_pendentes", pedidoId);
    const snapshot = await getDoc(pedidoRef);

    if (!snapshot.exists()) {
      alert("Pedido não encontrado.");
      return;
    }

    const dadosPedido = snapshot.data();

    // Remove o pedido da coleção de pendentes
    await deleteDoc(pedidoRef);

    // Registra o pedido completo como cancelado
    await addDoc(collection(db, "pedidos_cancelados"), {
      ...dadosPedido,
      pedidoId,
      motivo,
      dataCancelamento: new Date().toISOString()
    });

    alert("Pedido cancelado com sucesso.");
  } catch (error) {
    console.error("Erro ao cancelar o pedido:", error);
    alert("Erro ao cancelar o pedido.");
  }
}
function atualizarDashboardPorDataLoja() {
  const enviados = window.enviadosList || [];
  const pendentes = window.importadosList || [];

  const dataSelecionadaStr = document.getElementById("filtroDataDashboard").value;
  const considerarMes = document.getElementById("filtroMesInteiroDashboard").checked;
  const lojaSelecionada = document.getElementById("filtroLojaDashboard").value;
 const mesSelecionadoStr = document.getElementById("filtroMesDashboard")?.value;
  const [anoDash, mesDash] = mesSelecionadoStr ? mesSelecionadoStr.split("-").map(Number) : [];
  const dataSelecionada = dataSelecionadaStr ? new Date(dataSelecionadaStr) : null;
  const ano = dataSelecionada ? dataSelecionada.getFullYear() : null;
  const mes = dataSelecionada ? dataSelecionada.getMonth() + 1 : null;

  let totalEnviar = 0, totalEnviados = 0, totalAtrasados = 0, totalRisco = 0, enviadosComAtraso = 0;

  // 👉 Cálculo para pendentes
 pendentes.forEach(e => {
    const loja = (e.Loja || "").trim();
    const pagStr = e.dataPagamento?.split("T")[0];
    if (!pagStr) return;

    const pag = new Date(pagStr);
    if (isNaN(pag)) return;

    if (lojaSelecionada && loja !== lojaSelecionada) return;
    if (mesSelecionadoStr) {
      if (pag.getFullYear() !== anoDash || (pag.getMonth() + 1) !== mesDash) return;
    } else if (dataSelecionada) {
      if (considerarMes) {
        if (pag.getFullYear() !== ano || (pag.getMonth() + 1) !== mes) return;
      } else {
        if (pag.toDateString() !== dataSelecionada.toDateString()) return;
      }
    }

    const uteis = calcularDiasUteis(pag, new Date());
    totalEnviar++;
    if (calcularHorasUteis(pag, new Date()) > 36) totalAtrasados++;
    else if (uteis === 1) totalRisco++;
  });

  // 👉 Cálculo para enviados
  enviados.forEach(p => {
    const loja = (p.Loja || "").trim();
    const envioStr = p.dataEnvio?.split("T")[0];
    const pagStr   = p.dataPagamento?.split("T")[0];
    if (!envioStr || !pagStr) return;

    const envio = new Date(envioStr);
    const pag   = new Date(pagStr);
    if (isNaN(envio) || isNaN(pag)) return;

    if (lojaSelecionada && loja !== lojaSelecionada) return;
    if (mesSelecionadoStr) {
      if (envio.getFullYear() !== anoDash || (envio.getMonth() + 1) !== mesDash) return;
    } else if (dataSelecionada) {
      if (considerarMes) {
        if (envio.getFullYear() !== ano || (envio.getMonth() + 1) !== mes) return;
      } else {
        if (envio.toDateString() !== dataSelecionada.toDateString()) return;
      }
    }

    totalEnviados++;
    const horasUteis = calcularHorasUteis(pag, envio);
    const atraso = horasUteis > 36;
    if (atraso) enviadosComAtraso++;
  });

  // 👉 Atualiza os cards no DOM
  document.getElementById("valor-a-enviar-dashboard").textContent         = totalEnviar;
  document.getElementById("valor-enviados-dashboard").textContent        = totalEnviados;
  document.getElementById("valor-atrasados-dashboard").textContent       = totalAtrasados;
  document.getElementById("valor-risco-dashboard").textContent           = totalRisco;
  document.getElementById("valor-enviados-atraso-dashboard").textContent = enviadosComAtraso;

  const percentual = totalEnviados > 0
  ? ((enviadosComAtraso / totalEnviados) * 100).toFixed(1) + "%"
  : "0%";

document.getElementById("percentual-atrasados").textContent = percentual;
atualizarResumoPedidosAEviar();
  atualizarResumoVendasMensal();
  gerarResumoVendasPorProduto();
preencherFiltroProdutosDashboard();
renderizarGraficoVendasPorDia();
renderizarGraficoTopComparativo();
renderizarGraficoTempoEnvio();
gerarRelatorioDetalhado();
}


    function atualizarTabelas() {
  // 1) Dados vindos do Firestore
  const importar    = window.importadosList  || [];
  const enviados    = window.enviadosList    || [];
  const cancelados  = window.canceladosList  || [];
  const historico   = window.historicoList   || [...importar, ...enviados];

  // 2) Filtros
  const filtroData    = document.getElementById("filtroData")?.value;
  const lojaFiltro    = document.getElementById("filtroLoja")?.value.toLowerCase()  || "";
  const produtoFiltro = document.getElementById("filtroProduto")?.value.toLowerCase() || "";

  // 3) Identifica pendentes: importados cujo pedido NÃO está em enviados
const enviadosSet = new Set(
  enviados.map(p =>
    normalizarCampo(p, ["pedidoId", "Pedido"])
      .toString().trim()
  )
);

const pendentes = importar.filter(p =>
  !enviadosSet.has(
    normalizarCampo(p, ["Nº de Pedido da Plataforma", ])
      .toString().trim()
  )
);

   

  // 4) Filtra enviados por data e loja
  const enviadosFiltrados = enviados.filter(p => {
    // Data
    if (filtroData) {
      const dataStr = p.dataEnvio?.split("T")[0];
      if (dataStr !== filtroData) return false;
    }
    // Loja
    const loja = (p.Loja || "").toLowerCase();
    if (lojaFiltro && loja !== lojaFiltro) return false;
    return true;
  });

  // 5) Filtra pendentes por loja e produto
  const pendentesFiltrados = pendentes.filter(p => {
    const loja    = normalizarCampo(p, ["Loja", "Nome da Loja no UpSeller"]).toLowerCase();
    const sku = obterSkuPrincipal(p.SKU || "Desconhecido");
    if (lojaFiltro && loja !== lojaFiltro) return false;
    if (produtoFiltro && produto !== produtoFiltro) return false;
    return true;
  });

  // 6) Renderiza tabelas
  renderTabela("tabelaPendentes",  pendentesFiltrados);
  renderTabela("tabelaEnviados",   enviadosFiltrados);
  renderTabela("tabelaHistorico",  historico);
  renderTabela("tabelaCancelados", cancelados);

  // 7) Atualiza resumos e gráficos
  atualizarResumoCancelados();
  gerarGraficoCancelados();
  atualizarDashboardPorDataLoja();
  atualizarResumoVendasMensal();
  gerarResumoVendasPorProduto();
preencherFiltroProdutosDashboard();
renderizarGraficoVendasPorDia();
renderizarGraficoTopComparativo();
renderizarGraficoTempoEnvio();
gerarRelatorioDetalhado();
}

// Preenche os filtros ao abrir a aba 'Novos a Enviar'
  document.querySelector("div.tab[onclick=\"abrirAba('a_enviar')\"]").addEventListener("click", () => {
    const pendentes = window.importadosList || [];

    const lojas = [...new Set(pendentes.map(p => p.Loja).filter(Boolean))].sort();
    const produtos = [...new Set(pendentes.map(p => obterSkuPrincipal(p.SKU)).filter(Boolean))].sort();


    const selectLoja = document.getElementById("filtroMultiloja");
    const selectProduto = document.getElementById("filtroMultiproduto");

    selectLoja.innerHTML = lojas.map(l => `<option value="${l}">${l}</option>`).join("");
    selectProduto.innerHTML = produtos.map(p => `<option value="${p}">${p}</option>`).join("");

    atualizarDashboardPendentes();
  });
function calcularHorasUteis(dataInicio, dataFim) {
  let totalHoras = 0;
  const inicio = new Date(dataInicio);
  const fim = new Date(dataFim);

  inicio.setMinutes(0, 0, 0); // zera minutos e segundos
  fim.setMinutes(0, 0, 0);

  const current = new Date(inicio);
  while (current <= fim) {
    const diaSemana = current.getDay();
    if (diaSemana !== 0 && diaSemana !== 6) {
      totalHoras++;
    }
    current.setHours(current.getHours() + 1);
  }

  return totalHoras;
}

 function aplicarFiltroPedidos() {
  const todosPedidos       = window.importadosList || [];
  const lojaSelecionada    = document.getElementById("filtroLoja")?.value || "";
  const produtoSelecionado = document.getElementById("filtroProduto")?.value || "";

  // Preenche os filtros com opções únicas
  const lojasUnicas = [...new Set(todosPedidos.map(p => p.Loja).filter(Boolean))];
  const produtosUnicos = [...new Set(todosPedidos.map(p => p.SKU).filter(Boolean))];

  const selectLoja = document.getElementById("filtroMultiloja");
  const selectProduto = document.getElementById("filtroMultiproduto");


  selectLoja.innerHTML = '<option value="">Todas</option>' +
    lojasUnicas.map(l => `<option value="${l}">${l}</option>`).join("");

  selectProduto.innerHTML = '<option value="">Todos</option>' +
    produtosUnicos.map(p => `<option value="${p}">${p}</option>`).join("");

  // Aplica o filtro
  const filtrados = todosPedidos.filter(p => {
    const loja    = p.Loja || "";
    const sku = obterSkuPrincipal(p.SKU || "Desconhecido");
    const lojaOk    = !lojaSelecionada    || loja    === lojaSelecionada;
    const produtoOk = !produtoSelecionado || produto === produtoSelecionado;
    return lojaOk && produtoOk;
  });

  // Atualiza a tabela
  renderTabela("tabelaPendentes", filtrados);

}


  // Atualiza a lista de PDFs mostrando botões de “Ver” e “Baixar”
  function atualizarListaPDFs() {
    const lista = document.getElementById("listaPDFs");
    const pdfs  = window.pdfsList || [];
    if (!lista) return;

    lista.innerHTML = "";
    pdfs.forEach((pdf, i) => {
      const li = document.createElement("li");
      li.innerHTML = `
        📎 ${pdf.nome}
        <button onclick="abrirPDF(${i})">🔍 Ver</button>
        <button onclick="baixarPDF(${i})">⬇️ Baixar</button>
      `;
      lista.appendChild(li);
    });
  }
      function renderTabela(destinoId, dados) {
  const container = document.getElementById(destinoId);
  if (!container) return;

  // helper para agrupar por data (campo ISO)
  function agruparPorData(lista, campo) {
    const grupos = {};
    lista.forEach(item => {
      const data = (item[campo] || item.dataEnvio || item.dataPagamento || "")
        .toString()
        .split("T")[0];
      if (!grupos[data]) grupos[data] = [];
      grupos[data].push(item);
    });
    return grupos;
  }

  // cabeçalhos e linhas por tipo de tabela
  let cols = [], rowsHtml = "";

  if (destinoId === "tabelaCancelados") {
    cols = ["Pedido", "Loja", "Produto", "Pagamento", "Rastreio", "Motivo"];
    dados.forEach(p => {
      const pedido   = normalizarCampo(p, ["pedidoId", "Pedido"]);
      const loja     = p.Loja || "";
      const produto  = p.SKU || "";
      const pag      = p.dataPagamento?.split("T")[0] || "";
      const rastreio = p.Rastreio || "";
      const motivo   = p.motivo || "-";
      rowsHtml += `<tr>
        <td>${pedido}</td>
        <td>${loja}</td>
        <td>${produto}</td>
        <td>${pag}</td>
        <td>${rastreio}</td>
        <td>${motivo}</td>
      </tr>`;
    });

    const thead = `<thead style="background:#dc3545;color:#fff;"><tr>${cols.map(h => `<th>${h}</th>`).join("")}</tr></thead>`;
    const tbody = `<tbody>${rowsHtml}</tbody>`;

    container.innerHTML = `
      <div style="overflow-x:auto; margin-top:1rem;">
        <div style="overflow-x:auto;"><table style="width:100%; border-collapse:collapse;">${thead}${tbody}</table></div>
      </div>
    `;
  }



  else if (destinoId === "tabelaEnviados") {
  cols = ["Pedido", "Loja", "Produto", "Rastreio", "Pagamento", "Data de Envio", "Ações"];
  const grupos = agruparPorData(dados, "dataEnvio");
  Object.keys(grupos).sort().forEach(data => {
    rowsHtml += `<tr style="background:#e9ecef;font-weight:bold;">
      <td colspan="${cols.length}">📦 ${data}</td>
    </tr>`;
    grupos[data].forEach(p => {
      const pedido   = normalizarCampo(p, ["pedidoId", "Pedido"]);
      const loja     = p.Loja || "";
      const produto  = p.SKU || "";
      const rastreio = p.Rastreio || "";
      const pag      = p.dataPagamento?.split("T")[0] || "-";
      const envio    = p.dataEnvio?.split("T")[0] || "-";
      rowsHtml += `<tr>
        <td>${pedido}</td>
        <td>${loja}</td>
        <td>${produto}</td>
        <td>${rastreio}</td>
        <td>${pag}</td>
        <td>${envio}</td>
        <td><button class="danger" onclick="cancelarPedido('${p.id}')">❌ Cancelar</button></td>
      </tr>`;
    });
  });
}


  else if (destinoId === "tabelaPendentes") {
  cols = ["Pedido", "Loja", "Produto", "Pagamento", "Rastreio", "Ações"];
  const grupos = agruparPorData(dados, "dataPagamento");
  Object.keys(grupos).sort().forEach(data => {
    rowsHtml += `<tr style="background:#e9ecef;font-weight:bold;">
      <td colspan="${cols.length}">📅 ${data}</td>
    </tr>`;
    grupos[data].forEach(p => {
      const pedido   = normalizarCampo(p, ["pedidoId", "Pedido"]);
      const loja     = p.Loja || "";
      const produto  = p.SKU || "";
      const pag      = p.dataPagamento?.split("T")[0] || "";
      const rastreio = p.Rastreio || "";
      const dias     = pag ? calcularDiasUteis(new Date(pag), new Date()) : 0;
      let style = "";
      if (dias >= 3) style = "background:#f8d7da;";
      else if (dias === 2) style = "background:#fff3cd;";
      rowsHtml += `<tr style="${style}">
        <td>${pedido}</td>
        <td>${loja}</td>
        <td>${produto}</td>
        <td>${pag}</td>
        <td>${rastreio}</td>
        <td><button class="danger" onclick="cancelarPedido('${p.id}')">❌ Cancelar</button></td>
      </tr>`;
    });
  });
}
  else if (destinoId === "tabelaHistorico") {
    cols = ["Pedido", "Loja", "Status", "Pagamento", "Envio"];
    dados.forEach(p => {
      const pedido = normalizarCampo(p, ["pedidoId", "Pedido"]);
      const loja   = p.Loja || "";
      const status = p.status || "";
      const pag    = p.dataPagamento?.split("T")[0] || "";
      const env    = p.dataEnvio?.split("T")[0] || "";
      rowsHtml += `<tr>
        <td>${pedido}</td>
        <td>${loja}</td>
        <td>${status}</td>
        <td>${pag}</td>
        <td>${env}</td>
      </tr>`;
    });
  }

  // monta o HTML completo
  const thead = `<thead><tr>${cols.map(h => `<th>${h}</th>`).join("")}</tr></thead>`;
  const tbody = `<tbody>${rowsHtml}</tbody>`;
  container.innerHTML = `
  <div style="overflow-x: auto; margin-top: 1rem;">
    <div style="overflow-x:auto;"><table style="width: 100%; border-collapse: collapse;">
      ${thead}
      ${tbody}
    </table></div>
  </div>`;


}

// Atualiza o card “✅ Enviados hoje”
function calcularDashboard() {
  const pendentesBase = window.importadosList || [];
  const enviados      = window.enviadosList   || [];
  const hoje          = new Date();
  hoje.setHours(0, 0, 0, 0);
  
// Filtros selecionados
  const mesSelecionado  = document.getElementById("filtroMesDashboard")?.value;
  const lojaSelecionada = document.getElementById("filtroLojaDashboard")?.value;
  const [anoSel, mesSel] = mesSelecionado?.split("-").map(Number) || [];
  
  function diasUteisEntre(dataInicial, dataFinal) {
    let count = 0;
    const current = new Date(dataInicial);
    while (current <= dataFinal) {
      const dia = current.getDay();
      if (dia !== 0 && dia !== 6) count++;
      current.setDate(current.getDate() + 1);
    }
    return count - 1;
  }

  const enviadosSet = new Set(enviados.map(p => (p.id || p.pedidoId || "").toString().trim()));

const pendentes = pendentesBase.filter(p => {
  const id = (p.id || p.pedidoId || "").toString().trim();
  const loja = (p.Loja || "").trim();

  if (enviadosSet.has(id)) return false;
  if (lojaSelecionada && loja !== lojaSelecionada) return false;
  return true;
});



  const totalAEnviar = pendentes.length;
  let atrasados = 0, quaseAtrasando = 0;

// Calcula atrasos considerando apenas os pendentes filtrados
  pendentes.forEach(p => {
    const pagStr = p.dataPagamento?.split("T")[0];
    if (!pagStr) return;
    const dataPag = new Date(pagStr);
    const uteis   = diasUteisEntre(dataPag, hoje);
    if (uteis >= 2) atrasados++;
    else if (uteis === 1) quaseAtrasando++;
  });

  const hojeStr = hoje.toISOString().split("T")[0];
  const enviadosHoje = enviados.filter(p => {
    const envStr = p.dataEnvio?.split("T")[0];
    const dataSelecionadaStr = document.getElementById("filtroDataDashboard")?.value;

  }).length;

  // Aplica filtros de mês e loja (se houver)
 

  const enviadosFiltradosNoMes = enviados.filter(p => {
    if (!p.dataEnvio) return false;
    const [ano, mes] = p.dataEnvio.split("T")[0].split("-").map(Number);
    if (ano !== anoSel || mes !== mesSel) return false;
    if (lojaSelecionada && p.Loja !== lojaSelecionada) return false;
    return true;
  });

  // Atualiza cards no DOM
document.getElementById("valor-a-enviar-dashboard").textContent    = totalAEnviar;
document.getElementById("valor-atrasados-dashboard").textContent   = atrasados;
document.getElementById("valor-risco-dashboard").textContent       = quaseAtrasando;
document.getElementById("valor-enviados-dashboard").textContent    = enviadosFiltradosNoMes.length;

const percentual = totalAEnviar > 0
  ? ((atrasados / totalAEnviar) * 100).toFixed(1) + "%"
  : "0%";

document.getElementById("percentual-atrasados").textContent = percentual;

}

function gerarResumoVendasPorProduto() {
  const enviados = window.enviadosList || [];

  const dataSelecionada = document.getElementById("filtroDataDashboard")?.value;
  const considerarMesInteiro = document.getElementById("filtroMesInteiroDashboard")?.checked;
  const lojaSelecionada = document.getElementById("filtroLojaDashboard")?.value;
  const produtosSelecionados = $('#filtroProdutoDashboard').val() || [];

  const resumo = {};

  enviados.forEach(p => {
    if (!p.dataEnvio) return;

    const dataEnvioStr = p.dataEnvio.split("T")[0];
    const [ano, mes, dia] = dataEnvioStr.split("-").map(Number);

    if (dataSelecionada) {
      const [anoSel, mesSel, diaSel] = dataSelecionada.split("-").map(Number);

      if (!considerarMesInteiro && dataEnvioStr !== dataSelecionada) return;
      if (considerarMesInteiro && (ano !== anoSel || mes !== mesSel)) return;
    }

    if (lojaSelecionada && p.Loja !== lojaSelecionada) return;

    // Usa os SKUs equivalentes em memória, atualizados em tempo real
    const agrupamentos = window.skusEquivalentes || {};
let skuOriginal = p.SKU || "Produto desconhecido";

// Aplica agrupamento: transforma para SKU base se existir
const sku = Object.entries(agrupamentos).find(([, lista]) => lista.includes(skuOriginal))?.[0] || skuOriginal;

// Aplica filtro, se houver
if (produtosSelecionados.length > 0 && !produtosSelecionados.includes(sku)) return;

resumo[sku] = (resumo[sku] || 0) + 1;

  });

  const container = document.getElementById("vendas-por-produto");
  container.innerHTML = "";

  if (!Object.keys(resumo).length) {
    container.innerHTML = "<div style='color:#6c757d;'>Nenhuma venda registrada.</div>";
    return;
  }

  Object.entries(resumo)
    .sort((a, b) => b[1] - a[1])
    .forEach(([produto, qtd]) => {
      const card = document.createElement("div");
      Object.assign(card.style, {
        background: "#ffffff",
        border: "1px solid #dee2e6",
        borderRadius: "0.5rem",
        padding: "1rem",
        boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
        textAlign: "center",
        flex: "1 1 200px"
      });
      card.innerHTML = `
        <div style="font-weight:bold;font-size:1.1rem;color:#212529;">${produto}</div>
        <div style="font-size:1.25rem;color:#dc3545;margin-top:0.5rem;">${qtd}</div>
        <div style="font-size:0.8rem;color:#6c757d;">vendidos</div>
      `;
      container.appendChild(card);
    });
}
// 1) Dias úteis entre duas datas (exclui início ou fim conforme necessidade)
function calcularDiasUteis(dataInicial, dataFinal) {
  let d1 = new Date(dataInicial);
  let d2 = new Date(dataFinal);
  d1.setHours(0, 0, 0, 0);
  d2.setHours(0, 0, 0, 0);
  if (d1 > d2) return 0;
  let count = 0;
  while (d1 <= d2) {
    const dia = d1.getDay();
    if (dia !== 0 && dia !== 6) count++;
    d1.setDate(d1.getDate() + 1);
  }
  return Math.max(0, count - 1);
}
function atualizarResumoPedidosAEviar() {
  const pendentes = window.importadosList || [];
  const enviados  = window.enviadosList   || [];

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const hojeStr = hoje.toISOString().split("T")[0];

  let total = 0;
  let atrasados = 0;
  let risco = 0;
  let enviadosHoje = 0;

  const enviadosHojeSet = new Set(
    enviados
      .filter(p => (p.dataEnvio || "").split("T")[0] === hojeStr)
      .map(p => (p.pedidoId || p.Pedido || "").toString().trim())
  );

const enviadosSet = new Set(
    enviados.map(p => (p.id || p.pedidoId || p.Pedido || "").toString().trim())
  );

  pendentes.forEach(p => {
    const id = (p.id || p.pedidoId || p.Pedido || "").toString().trim();
    if (enviadosSet.has(id)) return;

    const dataPag = p.dataPagamento ? new Date(p.dataPagamento) : null;
    if (!dataPag) return;

    const diasUteis = calcularDiasUteis(dataPag, hoje);
    total++;
    if (diasUteis >= 2) atrasados++;
    else if (diasUteis === 1) risco++;
  });

  enviadosHoje = enviadosHojeSet.size;

// Atualiza os cards no DOM
  document.getElementById("resumo-total-enviar").textContent = total;
  document.getElementById("resumo-atrasados").textContent = atrasados;
  document.getElementById("resumo-risco").textContent = risco;
  document.getElementById("resumo-enviados-hoje").textContent = enviadosHoje;
}

function exportarPedidosAEnviar() {
  const pendentes = window.importadosList || [];
  const enviados  = window.enviadosList   || [];
  const enviadosSet = new Set(enviados.map(p => (p.id || p.pedidoId || "").toString().trim()));

  const pedidosAEnviar = pendentes.filter(p => {
    const id = (p.id || p.pedidoId || "").toString().trim();
    return !enviadosSet.has(id);
  });

  if (pedidosAEnviar.length === 0) {
    alert("Nenhum pedido a enviar encontrado.");
    return;
  }

  // Seleciona os campos principais para exportar
  const dados = pedidosAEnviar.map(p => ({
    Pedido: p.pedidoId || p.Pedido || "",
    Loja: p.Loja || "",
    SKU: p.SKU || "",
    DataPagamento: p.dataPagamento || "",
    Rastreio: p.rastreio || p.Rastreio || p.codigoRastreio || "",
  }));

  const ws = XLSX.utils.json_to_sheet(dados);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Pedidos A Enviar");
  XLSX.writeFile(wb, "pedidos_a_enviar.xlsx");
}
// 2) Exporta os pedidos cancelados para CSV usando os campos do Firestore
function exportarCanceladosCSV() {
  const dados = window.canceladosList || [];
  if (!dados.length) {
    alert("Nenhum pedido cancelado para exportar.");
    return;
  }

  // Cabeçalho CSV
  const linhas = [
    ["Pedido", "Loja", "Produto", "Data Pagamento", "Rastreio", "Motivo"]
  ];

  // Monta cada linha a partir das propriedades corretas
  dados.forEach(p => {
    linhas.push([
      p.pedidoId || "",                              // ID do pedido
      p.Loja     || "",                              // Nome da loja
      p.SKU      || "",                              // SKU do produto
      p.dataPagamento ? p.dataPagamento.split("T")[0] : "", // Data pagamento
      p.Rastreio || "",                              // Código de rastreio
      p.motivo   || "-"                              // Motivo do cancelamento
    ]);
  });

  // Gera CSV e dispara download
  const csv = linhas.map(row => row.map(c => `"${c}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "pedidos_cancelados.csv";
  link.click();
}
// Substitua sua versão antiga por esta:


  // Preenche o <select> de lojas no Dashboard usando dados em memória
  function preencherFiltroLojaDashboard() {
    const enviados  = window.enviadosList   || [];
    const pendentes = window.importadosList  || [];
    const lojas = [...enviados, ...pendentes]
      .map(p => p.Loja)
      .filter(Boolean);
    const lojasUnicas = [...new Set(lojas)].sort();
    const select = document.getElementById("filtroLojaDashboard");
    if (!select) return;
    select.innerHTML =
      '<option value="">Todas</option>' +
      lojasUnicas.map(loja => `<option value="${loja}">${loja}</option>`).join('');
  }

  // Dispara ao carregar a página
  document.addEventListener("DOMContentLoaded", () => {
    atualizarResumoVendasMensal();
atualizarDashboardPorDataLoja();
    preencherFiltroLojaDashboard();
preencherFiltroLojaMetas();
    carregarProdutos();
    atualizarRelatorioMetas();
    // Ajusta o filtro de data da aba “Importados” para hoje
    const hoje = new Date().toISOString().split("T")[0];
    const inputFiltroData = document.getElementById("filtroData");
    if (inputFiltroData) inputFiltroData.value = hoje;
const tabEnviar = document.querySelector("div.tab[onclick=\"abrirAba('a_enviar')\"]");
if (tabEnviar) {
  tabEnviar.addEventListener("click", () => {
    const pendentes = window.importadosList || [];
    const lojas = [...new Set(pendentes.map(p => p.Loja).filter(Boolean))].sort();
    const select = document.getElementById("filtroMultiloja");
    select.innerHTML = lojas.map(l => `<option value="${l}">${l}</option>`).join("");
    atualizarDashboardPendentes();
  });
}
document.getElementById("filtroLojaDashboard").addEventListener("change", atualizarDashboardPorData);
  document.getElementById("filtroDataDashboard").addEventListener("change", atualizarDashboardPorData);
  document.getElementById("filtroMesInteiroDashboard").addEventListener("change", atualizarResumoPedidosAEviar);
  document.getElementById("filtroDataDashboard").addEventListener("change", atualizarDashboardPorDataLoja);
  document.getElementById("filtroMesInteiroDashboard").addEventListener("change", atualizarDashboardPorDataLoja);
   const mesDash = document.getElementById("filtroMesDashboard");
  if (mesDash) mesDash.addEventListener("change", atualizarDashboardPorDataLoja); 
  });
function preencherFiltroProdutosDashboard() {
  const enviados = window.enviadosList || [];
  const produtos = new Set();

  enviados.forEach(p => {
    if (p.SKU) produtos.add(p.SKU);
  });

  const select = document.getElementById("filtroProdutoDashboard");
  select.innerHTML = "";

  Array.from(produtos)
    .sort()
    .forEach(sku => {
      const option = document.createElement("option");
      option.value = sku;
      option.textContent = sku;
      select.appendChild(option);
    });

  // Atualizar Select2
  $('#filtroProdutoDashboard').trigger('change.select2');
}

  // Exporta relatório mensal de “Pedidos Enviados” para CSV
  function exportarRelatorioMensal() {
    const enviados = window.enviadosList || [];
    const mesSelecionado = document.getElementById("filtroMesRelatorio")?.value;
    if (!mesSelecionado) {
      alert("Selecione um mês para gerar o relatório.");
      return;
    }

    const [ano, mes] = mesSelecionado.split("-").map(Number);
    const resumo = {};

    enviados.forEach(p => {
      if (!p.dataEnvio) return;
      const [y, m] = p.dataEnvio.split("T")[0].split("-").map(Number);
      if (y !== ano || m !== mes) return;
      const chave = `${p.SKU || "Produto desconhecido"} | ${p.Loja || "Loja desconhecida"}`;
      resumo[chave] = (resumo[chave] || 0) + 1;
    });

    const linhas = [["Produto | Loja", "Quantidade Vendida"]];
    Object.entries(resumo).forEach(([chave, qtd]) => linhas.push([chave, qtd]));

    if (linhas.length === 1) {
      alert("Nenhum produto vendido nesse mês.");
      return;
    }

    const csv = linhas.map(row => row.map(c => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `relatorio_vendas_${mesSelecionado}.csv`;
    link.click();
  }

async function exportarRelatorioPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  // 1) Pega os dados em memória e o mês selecionado
  const enviados = window.enviadosList || [];
  const mesSelecionado = document.getElementById("filtroMesRelatorio")?.value;
  if (!mesSelecionado) {
    alert("Selecione um mês para gerar o relatório.");
    return;
  }

  const [anoSel, mesSel] = mesSelecionado.split("-").map(Number);
  const resumo = {};

  // 2) Agrupa por “Produto | Loja” apenas no mês/ano escolhidos
  enviados.forEach(p => {
    if (!p.dataEnvio) return;
    const [y, m] = p.dataEnvio.split("T")[0].split("-").map(Number);
    if (y !== anoSel || m !== mesSel) return;
    const produto = p.SKU || "Produto desconhecido";
    const loja    = p.Loja || "Loja desconhecida";
    const chave   = `${produto} | ${loja}`;
    resumo[chave] = (resumo[chave] || 0) + 1;
  });

  if (Object.keys(resumo).length === 0) {
    alert("Nenhum produto vendido nesse mês.");
    return;
  }

  // 3) Cabeçalho e logo (opcional)
  const nomeLoja     = "Casa Rosa Bela";
  const mesFormatado = `${String(mesSel).padStart(2, "0")}/${anoSel}`;
  const logoUrl      = "https://i.imgur.com/y3c6tLx.png";
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = logoUrl;
  await new Promise(resolve => {
    img.onload = () => {
      doc.addImage(img, "PNG", 10, 10, 30, 30);
      resolve();
    };
  });

  doc.setFontSize(16);
  doc.text("Relatório de Produtos Vendidos", 50, 20);
  doc.setFontSize(12);
  doc.text(`Loja: ${nomeLoja}`, 50, 28);
  doc.text(`Período: ${mesFormatado}`, 50, 35);

  // 4) Monta a tabela no PDF
  let y = 50;
  doc.setFontSize(11);
  doc.text("Produto | Loja", 14, y);
  doc.text("Qtd", 180, y, { align: "right" });
  y += 6;

  Object.entries(resumo).forEach(([linha, qtd]) => {
    doc.text(linha, 14, y);
    doc.text(String(qtd), 180, y, { align: "right" });
    y += 6;
    if (y > 280) {
      doc.addPage();
      y = 20;
    }
  });

  // 5) Gera o download
  doc.save(`relatorio_vendas_${mesSelecionado}.pdf`);
}


// Atualiza os cards de cancelamentos (hoje e no mês)
function atualizarResumoCancelados() {
  const cancelados = window.canceladosList || [];

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const hojeStr  = hoje.toISOString().split("T")[0];
  const mesAtual = hoje.getMonth();
  const anoAtual = hoje.getFullYear();

  let totalHoje = 0;
  let totalMes  = 0;

  cancelados.forEach(p => {
    const dtStr = p.dataCancelamento?.split("T")[0];
    if (!dtStr) return;
    if (dtStr === hojeStr) totalHoje++;
    const dt = new Date(dtStr);
    if (dt.getFullYear() === anoAtual && dt.getMonth() === mesAtual) {
      totalMes++;
    }
  });

  document.getElementById("cancelados-hoje").textContent = totalHoje;
  document.getElementById("cancelados-mes").textContent  = totalMes;
}

// Gera o gráfico de cancelamentos por dia do mês atual
function gerarGraficoCancelados() {
  const cancelados = window.canceladosList || [];
  const hoje = new Date();
  const ano  = hoje.getFullYear();
  const mes  = hoje.getMonth();

  // Inicializa contador para cada dia do mês
  const diasDoMes = {};
  for (let d = 1; d <= 31; d++) {
    const data = new Date(ano, mes, d);
    if (data.getMonth() !== mes) break;
    const diaStr = data.toISOString().split("T")[0];
    diasDoMes[diaStr] = 0;
  }

  // Conta cancelamentos por dataCancelamento
  cancelados.forEach(p => {
    const dtStr = p.dataCancelamento?.split("T")[0];
    if (dtStr in diasDoMes) diasDoMes[dtStr]++;
  });

  const labels  = Object.keys(diasDoMes).map(d => d.split("-")[2]);
  const valores = Object.values(diasDoMes);

  const ctx = document.getElementById("graficoCanceladosDia").getContext("2d");
  if (window.graficoCancelados) window.graficoCancelados.destroy();
  window.graficoCancelados = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{ label: "Cancelamentos", data: valores }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { title: { display: true, text: "Dia do Mês" } },
        y: { beginAtZero: true, title: { display: true, text: "Qtd Cancelamentos" } }
      }
    }
  });
}

function atualizarResumoCancelados() {
  // 1) Use o array em memória preenchido pelo onSnapshot
  const cancelados = window.canceladosList || [];

  // 2) Prepara datas para comparação
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const hojeStr = hoje.toISOString().split("T")[0];
  const mesAtual = hoje.getMonth();
  const anoAtual = hoje.getFullYear();

  let totalHoje = 0;
  let totalMes  = 0;

  // 3) Conta cancelamentos de hoje e do mês
  cancelados.forEach(p => {
    // use o campo dataCancelamento gravado no Firestore
    const dtStr = p.dataCancelamento?.split("T")[0];
    if (!dtStr) return;

    if (dtStr === hojeStr) {
      totalHoje++;
    }
    const dt = new Date(dtStr);
    if (dt.getFullYear() === anoAtual && dt.getMonth() === mesAtual) {
      totalMes++;
    }
  });

  // 4) Atualiza o DOM
  document.getElementById("cancelados-hoje").textContent = totalHoje;
  document.getElementById("cancelados-mes").textContent  = totalMes;
}
  



function atualizarFiltroLoja() {
  // 1) Reúna todos os pedidos em memória (importados + enviados , se houver)
  const importados = window.importadosList || [];
  const enviados   = window.enviadosList   || [];
  const historico  = window.historicoList  || [];  // defina historicoList via onSnapshot, se usar
  const todas = [...importados, ...enviados, ...historico];

  // 2) Extrai e ordena as lojas únicas
  const lojas = [...new Set(
    todas.map(p =>
      p.Loja ||
      p["Nome da Loja no UpSeller"] ||
      p["Nome da Loja"] ||
      ""
    ).filter(Boolean)
  )].sort();

  // 3) Extrai e ordena os SKUs únicos
  const produtos = [...new Set(
    todas.map(p => p.SKU || "").filter(Boolean)
  )].sort();

  // 4) Atualiza os <select> de loja e produto
  const selectLoja    = document.getElementById("filtroLoja");
  const selectProduto = document.getElementById("filtroMultiproduto");

  if (selectLoja) {
    selectLoja.innerHTML =
      '<option value="">Todas</option>' +
      lojas.map(l => `<option value="${l}">${l}</option>`).join('');
  }
  if (selectProduto) {
    selectProduto.innerHTML =
      '<option value="">Todos</option>' +
      produtos.map(p => `<option value="${p}">${p}</option>`).join('');
  }
}


function gerarGraficoStatus(pendentes, enviados) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  let risco = 0;
  let atrasados = 0;
  let enviadosHoje = 0;

  // Processa pendentes
 pendentes.forEach(p => {
    const pagamento = normalizarCampo(p, ["Pagamento", "Impressão da Etiqueta"]).split(" ")[0];
    if (!pagamento) return;
    const dataPag = new Date(pagamento.split("T")[0] || pagamento);
    const uteis = calcularDiasUteis(dataPag, hoje);
    if (uteis === 1) risco++;
    else if (uteis >= 2) atrasados++;
  });

  // Processa enviados hoje
  enviados.forEach(p => {
    const envio = normalizarCampo(p, ["Hora de Envio"]);
    if (!envio) return;
    const dataEnvio = new Date(envio.split("T")[0] || envio.split(" ")[0]);
    dataEnvio.setHours(0, 0, 0, 0);
    if (dataEnvio.getTime() === hoje.getTime()) {
      enviadosHoje++;
    }
  });

  const ctx = document.getElementById('graficoStatus').getContext('2d');
  if (window.statusChart) window.statusChart.destroy();

  window.statusChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: [
        `⚠️ Em Risco (${risco})`,
        `⏰ Atrasados (${atrasados})`,
        `✅ Enviados Hoje (${enviadosHoje})`
      ],
      datasets: [{
        data: [risco, atrasados, enviadosHoje],
        backgroundColor: ['#ffc107', '#dc3545', '#198754'],
        borderColor: ['#ffc107', '#dc3545', '#198754'],
        borderWidth: 1
      }]
    },
    options: {
      plugins: {
        legend: {
          position: 'bottom'
        }
      }
    }
  });
}


  // 1) Função de dias úteis permanece igual
function diasUteisEntre(dataInicial, dataFinal) {
  let count = 0;
  let currentDate = new Date(dataInicial);
  while (currentDate <= dataFinal) {
    const diaSemana = currentDate.getDay();
    if (diaSemana !== 0 && diaSemana !== 6) count++;
    currentDate.setDate(currentDate.getDate() + 1);
  }
  return count - 1;
}


// 2) Nova função gerarLembrete usando os arrays em memória
// 3) Atualiza a chamada para incluir gerarLembrete (e usar os estados em memória)
const originalAtualizar = atualizarTabelas;
atualizarTabelas = function() {
  originalAtualizar();
  preencherFiltroLojaDashboard();
  gerarGraficoStatus(window.importadosList, window.enviadosList);
  
};


const originalRenderTabela = renderTabela;
renderTabela = function(destinoId, dados) {
  if (destinoId === "tabelaPendentes") {
    const lojaSelecionada = document.getElementById("filtroLoja")?.value || "";
    const produtoSelecionado = document.getElementById("filtroProduto")?.value || "";

    const filtrado = dados.filter(p => {
      const loja = p["Nome da Loja no UpSeLLer"] || p["Nome da Loja no UpSeller"] || p["Loja"] || p["Nome da Loja"] || p[Object.keys(p)[1]] || "";
      const produto = p["SKU"] || "";

      const lojaOk = lojaSelecionada === "" || loja === lojaSelecionada;
      const produtoOk = produtoSelecionado === "" || produto === produtoSelecionado;

      return lojaOk && produtoOk;
    });

    originalRenderTabela(destinoId, filtrado);
  } else {
    originalRenderTabela(destinoId, dados);
  }
};


  function considerar(loja) {
 const lojasSelecionadas = Array.from(
      document.getElementById('filtroMultiloja').selectedOptions
    ).map(opt => opt.value);
    return lojasSelecionadas.length === 0 || lojasSelecionadas.includes(loja);
  }
    

  

function atualizarDashboardPorData() {
  // 1) Obtenha os pedidos enviados do estado em memória (atualizado pelo onSnapshot)
  const enviados = window.enviadosList || [];

  // 2) Data de hoje zerada para comparação
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  // 3) Formate a data de hoje para exibição
  const hojeFormatado = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric"
  }).format(hoje);
  document.getElementById("data-hoje-formatada").textContent = hojeFormatado;

  // 4) Filtra os pedidos enviados na data selecionada
const dataSelecionada = document.getElementById("filtroDataDashboard")?.value;

const enviadosNoDia = enviados.filter(p => {
  if (!p.dataEnvio || !dataSelecionada) return false;

  const [dataStr] = p.dataEnvio.split("T"); // "2025-05-21"
  return dataStr === dataSelecionada; // compara com valor do input "yyyy-mm-dd"
});

// 5) Atualiza o card 📦
document.getElementById("enviadosHoje").textContent = enviadosHoje;



  // 5) Atualiza o elemento com o total de hoje
  document.getElementById("total-hoje").textContent = enviadosHoje.length;
}


function atualizarDashboardHoje() {
  let totalHoje = 0;
  let atrasados = 0;
  let emRisco = 0;
  let enviadosHoje = 0;

  const hoje = new Date();
  const hojeStr = hoje.toISOString().split("T")[0];

 (window.importadosList || []).forEach(p => {
    if (p.status !== "novo") return;

    const loja = p.Loja || "";
    const dataPag = (p.dataPagamento || "").split("T")[0];
    if (!dataPag || !considerar(loja)) return;

    const dataPagObj = new Date(dataPag);
    const diasUteis = calcularDiasUteis(dataPagObj, hoje);

    if (dataPag === hojeStr) totalHoje++;
    if (diasUteis >= 3) atrasados++;
    else if (diasUteis === 2) emRisco++;
  });

  enviados.forEach(e => {
    const loja = e.Loja || "";
    const dataEnvio = (e.dataEnvio || "").split("T")[0];
    if (dataEnvio === hojeStr && considerar(loja)) enviadosHoje++;
  });

  const elTotal = document.getElementById("totalEnviarHoje");
  if (elTotal) elTotal.textContent = totalHoje;

  const elAtrasados = document.getElementById("atrasadosHoje");
  if (elAtrasados) elAtrasados.textContent = atrasados;

  const elRisco = document.getElementById("emRiscoHoje");
  if (elRisco) elRisco.textContent = emRisco;

  const elEnviados = document.getElementById("enviadosHoje");
  if (elEnviados) elEnviados.textContent = enviadosHoje;
}



async function processarPDF() {
  const input = document.getElementById('inputPDF');
  if (!input.files.length) {
    alert("Selecione um arquivo PDF.");
    return;
  }

  const file = input.files[0];
  const reader = new FileReader();

  reader.onload = async function (e) {
    const typedArray = new Uint8Array(e.target.result);
    const pdf = await pdfjsLib.getDocument({ data: typedArray }).promise;

    let fullText = "";
    for (let i = 0; i < pdf.numPages; i++) {
      const page = await pdf.getPage(i + 1);
      const content = await page.getTextContent();
      fullText += content.items.map(item => item.str).join("\n") + "\n";
    }

    console.log("🔍 TEXTO LIDO:", fullText);
    const pedidosExtraidos = [];

  const multiRegex = /\*\d+\s*NF[: ]/i;
  if (multiRegex.test(fullText)) {
    const blocos = fullText
      .split(/\*\d+\s*NF[: ]/i)
      .filter(b => /Pedido/i.test(b));
    blocos.forEach(bloco => {
     // Ancorado na palavra-chave "Pedido" para evitar falsos positivos
      const pedidoMatch = bloco.match(/Pedido[:\s]*([A-Z0-9]{10,})/i);
      const pedido = pedidoMatch ? pedidoMatch[1] : "";

   const rastreio = bloco.match(/(BR\d{12,}[A-Z]?)/)?.[1] || "";
      const loja = identificarLoja(bloco);
      const pagamentoMatch = bloco.match(/(\d{2}\/\d{2}\/\d{4})/);
      const pagamento = pagamentoMatch
        ? `${pagamentoMatch[1].split("/").reverse().join("-")}T00:00:00.000Z`
        : "";
       // SKU informado após o texto "SKU:" ou semelhante
      const skuMatch = bloco.match(/SKU[:\s]*#?([A-Z0-9\-+]+)/i);
      const sku = skuMatch ? skuMatch[1].trim() : "";

    if (pedido && sku && pagamento) {
      pedidosExtraidos.push({
        Pedido: pedido,
        Loja: loja,
        SKU: sku,
        Rastreio: rastreio,
        dataPagamento: pagamento,
        status: "pendente"
      });
    }
  });

  } else {
   // Procura a informação de pedido precedida da palavra "Pedido"
    const pedidoMatch = fullText.match(/Pedido[:\s]*([A-Z0-9]{10,})/i);
    const pedido = pedidoMatch ? pedidoMatch[1] : "";
  const rastreio = fullText.match(/(BR\d{12,}[A-Z]?)/)?.[1] || "";

  const pagamentoMatch = fullText.match(/(\d{2}\/\d{2}\/\d{4})/);
  const pagamento = pagamentoMatch
    ? `${pagamentoMatch[1].split("/").reverse().join("-")}T00:00:00.000Z`
    : "";

  const skuMatch = fullText.match(/SKU[:\s]*#?([A-Z0-9\-+]+)/i);
  const sku = skuMatch ? skuMatch[1].trim() : "";

  const loja = identificarLoja(fullText);

  if (pedido && sku && pagamento) {
    pedidosExtraidos.push({
      Pedido: pedido,
      Loja: loja,
      SKU: sku,
      Rastreio: rastreio,
      dataPagamento: pagamento,
      status: "pendente"
    });
  }
}


if (!pedidosExtraidos.length) {
  alert("❌ Nenhum pedido válido foi encontrado no PDF.");
  return;
}



    // 💾 Verifica se já existem pedidos iguais no Firestore
    const existentesSnap = await getDocs(collection(db, "pedidos_pendentes"));
    const pedidosExistentes = new Set(existentesSnap.docs.map(d => (d.data().Pedido || "").trim()));

    // 📦 Filtra apenas os pedidos novos
    const novosFiltrados = pedidosExtraidos.filter(p => !pedidosExistentes.has((p.Pedido || "").trim()));

    if (!novosFiltrados.length) {
      alert("⚠️ Todos os pedidos deste PDF já foram importados.");
      return;
    }

    // 💾 Salva apenas os pedidos novos
    await Promise.all(novosFiltrados.map(p => adicionarPedido(p)));

    await addDoc(collection(db, "pdf_etiquetas"), {
      nome: file.name,
      dataImportacao: new Date().toISOString()
    });

    alert(`✅ ${novosFiltrados.length} etiqueta(s) importada(s) com sucesso.`);
  };

  reader.readAsArrayBuffer(file);
}





function abrirPDF(index) {
  const pdfs = window.pdfsList || [];
  const pdf = pdfs[index];
  if (!pdf) return;
  const blob = dataURLToBlob(pdf.conteudo);
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
}

function baixarPDF(index) {
  // Use o array em memória carregado pelo onSnapshot
  const pdfs = window.pdfsList || [];
  const item = pdfs[index];
  if (!item) return;

  // item.conteudo é a string base64 do PDF
  const link = document.createElement("a");
  link.href = "data:application/pdf;base64," + item.conteudo;
  link.download = item.nome;
  link.click();
}


// Converte um Blob (ou ArrayBuffer) em string base64
function blobToBase64(blob) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result.split(",")[1]);
    reader.readAsDataURL(blob);
  });
}

// Converte dataURL (base64) em Blob
function dataURLToBlob(dataURL) {
  const [header, base64] = dataURL.split(",");
  const mime = header.match(/:(.*?);/)[1];
  const bytes = atob(base64);
  const buf = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) buf[i] = bytes.charCodeAt(i);
  return new Blob([buf], { type: mime });
}

function exportarVendasCSV() {
  const enviados = window.enviadosList || [];
  const dataSelecionada = document.getElementById("filtroDataDashboard")?.value;
  const considerarMesInteiro = document.getElementById("filtroMesInteiroDashboard")?.checked;
  const lojaSelecionada = document.getElementById("filtroLojaDashboard")?.value;

  if (!dataSelecionada) {
    alert("Selecione uma data para exportar.");
    return;
  }

  const [anoSel, mesSel, diaSel] = dataSelecionada.split("-").map(Number);

  const resumo = {};

  enviados.forEach(p => {
    const dt = new Date(p.dataEnvio);
    if (isNaN(dt)) return;

    const ano = dt.getFullYear();
    const mes = dt.getMonth() + 1;
    const dia = dt.getDate();

    if (
      (!considerarMesInteiro && dt.toISOString().split("T")[0] !== dataSelecionada) ||
      (considerarMesInteiro && (ano !== anoSel || mes !== mesSel))
    ) {
      return;
    }

    const loja = p.Loja || "Loja desconhecida";
    if (lojaSelecionada && loja !== lojaSelecionada) return;

const skuBase = window.obterSkuBase(p.SKU);
resumo[skuBase] = (resumo[skuBase] || 0) + 1;

  });

  const linhas = [["Produto", "Quantidade"]];
  Object.entries(resumo).forEach(([produto, qtd]) => {
    linhas.push([produto, qtd]);
  });

  const csv = linhas.map(l => l.join(";")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "vendas_filtradas.csv";
  link.click();
}
async function exportarVendasPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  const enviados = window.enviadosList || [];
  const dataSelecionada = document.getElementById("filtroDataDashboard")?.value;
  const considerarMesInteiro = document.getElementById("filtroMesInteiroDashboard")?.checked;
  const lojaSelecionada = document.getElementById("filtroLojaDashboard")?.value;

  if (!dataSelecionada) {
    alert("Selecione uma data para gerar o relatório.");
    return;
  }

  const [anoSel, mesSel, diaSel] = dataSelecionada.split("-").map(Number);

  const resumo = {};
  enviados.forEach(p => {
    const dt = new Date(p.dataEnvio);
    if (isNaN(dt)) return;

    const ano = dt.getFullYear();
    const mes = dt.getMonth() + 1;
    const dia = dt.getDate();

    if (
      (!considerarMesInteiro && dt.toISOString().split("T")[0] !== dataSelecionada) ||
      (considerarMesInteiro && (ano !== anoSel || mes !== mesSel))
    ) {
      return;
    }

    const loja = p.Loja || "Loja desconhecida";
    if (lojaSelecionada && loja !== lojaSelecionada) return;

    const skuBase = window.obterSkuBase(p.SKU);
resumo[skuBase] = (resumo[skuBase] || 0) + 1;

  });

  // Cabeçalho do PDF
  doc.setFontSize(16);
  doc.text("Relatório de Peças Vendidas", 14, 20);
  doc.setFontSize(12);

  if (considerarMesInteiro) {
    doc.text(`Período: ${String(mesSel).padStart(2, "0")}/${anoSel}`, 14, 28);
  } else {
    doc.text(`Data: ${diaSel}/${mesSel}/${anoSel}`, 14, 28);
  }

  if (lojaSelecionada) {
    doc.text(`Loja: ${lojaSelecionada}`, 14, 35);
  }

  // Tabela
  let y = 45;
  doc.setFontSize(11);
  doc.text("Produto", 14, y);
  doc.text("Qtd", 180, y, { align: "right" });
  y += 6;

  Object.entries(resumo).forEach(([produto, qtd]) => {
    doc.text(produto, 14, y);
    doc.text(`${qtd}`, 180, y, { align: "right" });
    y += 6;
    if (y > 280) {
      doc.addPage();
      y = 20;
    }
  });

  doc.save("vendas_filtradas.pdf");
}
function exportarDashboardExcel() {
  const aenviar = document.getElementById("valor-a-enviar-dashboard").textContent;
  const enviados = document.getElementById("valor-enviados-dashboard").textContent;
  const enviadosAtraso = document.getElementById("valor-enviados-atraso-dashboard")?.textContent || 0;
  const atrasados = document.getElementById("valor-atrasados-dashboard").textContent;
  const risco = document.getElementById("valor-risco-dashboard").textContent;

  const dados = [
    ["Indicador", "Quantidade"],
    ["📦 A Enviar", aEnviar],
    ["✅ Enviados no mês", enviados],
    ["🚨 Enviados com Atraso", enviadosAtraso],
    ["⏰ Atrasados", atrasados],
    ["⚠️ Em risco", risco]
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(dados);
  XLSX.utils.book_append_sheet(wb, ws, "Resumo Dashboard");
  XLSX.writeFile(wb, `resumo_dashboard.xlsx`);
}
async function exportarDashboardPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  const loja = document.getElementById("filtroLojaDashboard")?.value || "Todas";
  const mes = document.getElementById("filtroMesDashboard")?.value || "Não selecionado";

  const aEnviar = document.getElementById("valor-a-enviar-dashboard").textContent;
  const enviados = document.getElementById("valor-enviados-dashboard").textContent;
  const enviadosAtraso = document.getElementById("valor-enviados-atrasados-dashboard")?.textContent || "0";
  const atrasados = document.getElementById("valor-atrasados-dashboard").textContent;
  const risco = document.getElementById("valor-risco-dashboard").textContent;

  // Cabeçalho
  doc.setFontSize(16);
  doc.text("Relatório do Dashboard", 14, 20);
  doc.setFontSize(12);
  doc.text(`Loja: ${loja}`, 14, 28);
  doc.text(`Mês: ${mes}`, 14, 34);

  // Tabela de resumo
  const col1 = 14;
  const col2 = 100;
  let y = 50;

  doc.setFontSize(12);
  doc.text("Indicador", col1, y);
  doc.text("Quantidade", col2, y);
  y += 8;

  const dados = [
    ["A Enviar", aEnviar],
    ["Enviados no mês", enviados],
    ["Enviados com Atraso", enviadosAtraso],
    ["Atrasados", atrasados],
    ["Em risco", risco]
  ];

  dados.forEach(([titulo, valor]) => {
    doc.text(titulo, col1, y);
    doc.text(String(valor), col2, y);
    y += 8;
  });

  doc.save("resumo_dashboard.pdf");
}
async function adicionarPedido(pedido) {
  try {
    await addDoc(collection(db, "pedidos_pendentes"), pedido);
  } catch (erro) {
    console.error("Erro ao adicionar pedido:", erro);
  }
}

 const abaEnviar = document.querySelector("div.tab[onclick=\"abrirAba('a_enviar')\"]");
if (abaEnviar) {
  abaEnviar.addEventListener("click", () => {
    carregarPendentesFirebase();
  });
}

async function apagarTudo() {
  if (!confirm("⚠️ Tem certeza que deseja apagar TODOS os dados do sistema? Isso não pode ser desfeito.")) return;

  const colecoes = [
    "pedidos_pendentes",
    "pedidos_enviados",
    "pedidos_cancelados",
    "pdf_etiquetas",
    "historico_pedidos"
  ];

  for (const nome of colecoes) {
    const ref = collection(db, nome);
    const snap = await getDocs(ref);
    const promises = snap.docs.map(doc => deleteDoc(doc.ref));
    await Promise.all(promises);
    console.log(`Coleção ${nome} apagada.`);
  }

  alert("✅ Todos os dados foram apagados!");
  location.reload(); // Atualiza a página para limpar os dados carregados
}
function atualizarDashboardPendentes() {
  const pendentes = window.importadosList || [];
  const enviados  = window.enviadosList   || [];
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const lojasSelecionadas = Array.from(
    document.getElementById("filtroMultiloja").selectedOptions
  ).map(opt => opt.value);

  const produtosSelecionados = Array.from(
    document.getElementById("filtroMultiproduto").selectedOptions
  ).map(opt => opt.value);

  const enviadosSet = new Set(enviados.map(p => p.pedidoId || p.Pedido));

  let total = 0, risco = 0, atraso = 0, enviadosHoje = 0;

  const pendentesFiltrados = pendentes.filter(p => {
    const idPedido = p.pedidoId || p.Pedido;
    if (enviadosSet.has(idPedido)) return false;

    const loja = p.Loja || "";
    const produto = p.SKU || "";

    const lojaOk = !lojasSelecionadas.length || lojasSelecionadas.includes(loja);
    const produtoOk = !produtosSelecionados.length || produtosSelecionados.includes(produto);
    if (!lojaOk || !produtoOk) return false;

    const dataPag = new Date(p.dataPagamento);
    if (isNaN(dataPag)) return false;

    const uteis = calcularDiasUteis(dataPag, hoje);

    total++;
    if (uteis >= 2) atraso++;
    else if (uteis === 1) risco++;

    return true;
  });

  // Enviados hoje (filtrados)
  enviados.forEach(p => {
    const loja = p.Loja || "";
    const produto = p.SKU || "";

    const lojaOk = !lojasSelecionadas.length || lojasSelecionadas.includes(loja);
    const produtoOk = !produtosSelecionados.length || produtosSelecionados.includes(produto);
    if (!lojaOk || !produtoOk) return;

    const dt = new Date(p.dataEnvio?.split("T")[0]);
    dt.setHours(0, 0, 0, 0);
    if (dt.getTime() === hoje.getTime()) enviadosHoje++;
  });

  // Atualiza os cards
  document.getElementById("resumo-total-enviar").textContent = total;
  document.getElementById("resumo-atrasados").textContent = atraso;
  document.getElementById("resumo-risco").textContent = risco;
  document.getElementById("resumo-enviados-hoje").textContent = enviadosHoje;

  // Atualiza a tabela
  renderTabela("tabelaPendentes", pendentesFiltrados);
}
// Preenche o filtro múltiplo ao abrir a aba
document.querySelector("div.tab[onclick=\"abrirAba('a_enviar')\"]").addEventListener("click", () => {
  const pendentes = window.importadosList || [];
  const lojas = [...new Set(pendentes.map(p => p.Loja).filter(Boolean))].sort();

  const select = document.getElementById("filtroMultiloja");
  select.innerHTML = lojas.map(l => `<option value="${l}">${l}</option>`).join("");

  atualizarDashboardPendentes();
});



  $(document).ready(function() {
    $('#filtroMultiloja').select2({
      placeholder: 'Selecione lojas',
      width: '100%'
    });
    $('#filtroMultiproduto').select2({
      placeholder: 'Selecione produtos',
      width: '100%'
    });
  });
async function verificarEDeduplicarPedidos() {
  const colecoes = [
    { nome: "pedidos_enviados", label: "enviados" },
    { nome: "pedidos_pendentes", label: "pendentes" },
    { nome: "pedidos_cancelados", label: "cancelados" },
  ];

  const vistosGlobais = new Set();
  const aExcluir = [];

  for (const { nome, label } of colecoes) {
    const snap = await getDocs(collection(db, nome));
    const vistosLocais = new Set();

    snap.forEach(doc => {
      const pedidoId = (doc.data().pedidoId || doc.data().Pedido || "").toString().trim().toUpperCase();
      if (!pedidoId) return;

      const key = `${label}-${pedidoId}`;     // chave única por coleção
      const keyGlobal = pedidoId;             // usada para identificar duplicidade entre abas

      if (vistosLocais.has(pedidoId)) {
        // 🧹 Duplicado dentro da mesma aba
        aExcluir.push({ ref: doc.ref, motivo: `Duplicado interno em ${label}` });
      } else if (vistosGlobais.has(keyGlobal)) {
        // 🧹 Duplicado entre coleções (já visto antes em outra aba)
        aExcluir.push({ ref: doc.ref, motivo: `Duplicado entre coleções (em ${label})` });
      } else {
        vistosLocais.add(pedidoId);
        vistosGlobais.add(keyGlobal);
      }
    });
  }

  if (aExcluir.length === 0) {
    alert("✅ Nenhum pedido duplicado encontrado.");
    return;
  }

  for (const { ref } of aExcluir) {
    await deleteDoc(ref);
  }

  alert(`✅ ${aExcluir.length} pedidos duplicados foram removidos (internos e entre abas).`);
  location.reload();

}
$(document).ready(function () {
  $('#filtroProdutoDashboard').select2({
    placeholder: "Escolha os produtos",
    allowClear: true,
    width: 'resolve'
  });

  $('#filtroProdutoDashboard').on('change', gerarResumoVendasPorProduto);
});
let graficoVendasPorDia; // manter referência global

function renderizarGraficoVendasPorDia() {
  const enviados = window.enviadosList || [];
  const dataSelecionada = document.getElementById("filtroDataDashboard")?.value;
  const considerarMesInteiro = document.getElementById("filtroMesInteiroDashboard")?.checked;
  const lojaSelecionada = document.getElementById("filtroLojaDashboard")?.value;

  if (!dataSelecionada || !considerarMesInteiro) return;

  const [anoSel, mesSel] = dataSelecionada.split("-").map(Number);
  const diasDoMes = new Array(31).fill(0);

  enviados.forEach(p => {
    if (!p.dataEnvio) return;

    const dt = new Date(p.dataEnvio);
    if (isNaN(dt)) return;
    if (dt.getFullYear() !== anoSel || dt.getMonth() + 1 !== mesSel) return;

    if (lojaSelecionada && p.Loja !== lojaSelecionada) return;

    const dia = dt.getDate();
    diasDoMes[dia - 1] += 1;
  });

  const labels = diasDoMes.map((_, i) => `${String(i + 1).padStart(2, "0")}/${String(mesSel).padStart(2, "0")}`);
  const data = diasDoMes.slice(0, 31); // remove dias a mais

  const ctx = document.getElementById("graficoVendasPorDia").getContext("2d");

  if (graficoVendasPorDia) graficoVendasPorDia.destroy();

  graficoVendasPorDia = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: "Pedidos Enviados",
        data,
        fill: false,
        borderColor: "#EF5DA8",
        tension: 0.2,
        pointRadius: 3
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          display: true,
          position: "top"
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { precision: 0 }
        }
      }
    }
  });
}
let graficoTopProdutos;

function renderizarGraficoTopComparativo() {
  const enviados = window.enviadosList || [];
  const tipo = document.getElementById("tipoComparativo")?.value || "produtos";
  const dataSelecionada = document.getElementById("filtroDataDashboard")?.value;
  const considerarMesInteiro = document.getElementById("filtroMesInteiroDashboard")?.checked;
  const lojaSelecionada = document.getElementById("filtroLojaDashboard")?.value;

  if (!dataSelecionada || !considerarMesInteiro) return;

  const [anoSel, mesSel] = dataSelecionada.split("-").map(Number);
  const contagem = {};

  enviados.forEach(p => {
    if (!p.dataEnvio) return;
    const dt = new Date(p.dataEnvio);
    if (isNaN(dt)) return;
    if (dt.getFullYear() !== anoSel || dt.getMonth() + 1 !== mesSel) return;

    if (lojaSelecionada && p.Loja !== lojaSelecionada) return;

    const chave = tipo === "lojas" ? (p.Loja || "Loja desconhecida") : (p.SKU || "Produto desconhecido");
    contagem[chave] = (contagem[chave] || 0) + 1;
  });

  const ordenado = Object.entries(contagem)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10); // top 10

  const labels = ordenado.map(([nome]) => nome);
  const data = ordenado.map(([_, qtd]) => qtd);

  const ctx = document.getElementById("graficoTopProdutos").getContext("2d");

  if (graficoTopProdutos) graficoTopProdutos.destroy();

  graficoTopProdutos = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: tipo === "lojas" ? "Pedidos por Loja" : "Vendas por Produto",
        data,
        backgroundColor: "#D99074"
      }]
    },
    options: {
      indexAxis: "y",
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: context => `${context.parsed.x} pedidos`
          }
        }
      },
      scales: {
        x: {
          beginAtZero: true,
          ticks: { precision: 0 }
        }
      }
    }
  });
}
let graficoTempoEnvio;

function renderizarGraficoTempoEnvio() {
  const enviados = window.enviadosList || [];
  const dataSelecionada = document.getElementById("filtroDataDashboard")?.value;
  const considerarMesInteiro = document.getElementById("filtroMesInteiroDashboard")?.checked;
  const lojaSelecionada = document.getElementById("filtroLojaDashboard")?.value;

  if (!dataSelecionada || !considerarMesInteiro) return;

  const [anoSel, mesSel] = dataSelecionada.split("-").map(Number);
  const tempos = {};

  enviados.forEach(p => {
    if (!p.dataEnvio || !p.dataPagamento) return;

    const dataPag = new Date(p.dataPagamento);
    const dataEnvio = new Date(p.dataEnvio);
    if (isNaN(dataPag) || isNaN(dataEnvio)) return;

    if (dataEnvio.getFullYear() !== anoSel || dataEnvio.getMonth() + 1 !== mesSel) return;

    const loja = p.Loja || "Loja desconhecida";
    if (lojaSelecionada && loja !== lojaSelecionada) return;

    const dias = calcularDiasUteis(dataPag, dataEnvio);
    if (!tempos[loja]) tempos[loja] = [];

    tempos[loja].push(dias);
  });

  const medias = Object.entries(tempos).map(([loja, dias]) => {
    const total = dias.reduce((acc, d) => acc + d, 0);
    return [loja, total / dias.length];
  }).sort((a, b) => b[1] - a[1]);

  const labels = medias.map(([loja]) => loja);
  const data = medias.map(([_, media]) => Number(media.toFixed(2)));

  const ctx = document.getElementById("graficoTempoEnvio").getContext("2d");

  if (graficoTempoEnvio) graficoTempoEnvio.destroy();

  graficoTempoEnvio = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Dias úteis (média)",
        data,
        backgroundColor: "#EF5DA8"
      }]
    },
    options: {
      indexAxis: "y",
      responsive: true,
      scales: {
        x: {
          beginAtZero: true,
          title: { display: true, text: "Dias úteis" },
          ticks: { precision: 0 }
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: context => `${context.parsed.x} dias úteis`
          }
        }
      }
    }
  });
}
function alternarTema() {
  const body = document.body;
  const botao = document.getElementById("btnTema");

  body.classList.toggle("dark-mode");

  if (body.classList.contains("dark-mode")) {
    botao.textContent = "🌞 Modo Claro";
    localStorage.setItem("tema", "escuro");
  } else {
    botao.textContent = "🌙 Modo Escuro";
    localStorage.setItem("tema", "claro");
  }
}

// Ao carregar, aplica o tema salvo
document.addEventListener("DOMContentLoaded", () => {
  const temaSalvo = localStorage.getItem("tema");
  const body = document.body;
  const botao = document.getElementById("btnTema");

  if (temaSalvo === "escuro") {
    body.classList.add("dark-mode");
    if (botao) botao.textContent = "🌞 Modo Claro";
  }
});
function gerarRelatorioDetalhado() {
  const enviados = window.enviadosList || [];
  const dataSelecionada = document.getElementById("filtroDataDashboard")?.value;
  const considerarMesInteiro = document.getElementById("filtroMesInteiroDashboard")?.checked;
  const lojaSelecionada = document.getElementById("filtroLojaDashboard")?.value;

  const resumo = {};

  enviados.forEach(p => {
    if (!p.dataEnvio) return;

    const dataEnvioStr = p.dataEnvio.split("T")[0];
    const [ano, mes] = dataEnvioStr.split("-").map(Number);
    const dataPedido = new Date(ano, mes - 1);

    if (dataSelecionada) {
      const [anoSel, mesSel] = dataSelecionada.split("-").map(Number);
      if (considerarMesInteiro && (ano !== anoSel || mes !== mesSel)) return;
      if (!considerarMesInteiro && dataEnvioStr !== dataSelecionada) return;
    }

    const loja = p.Loja || "Loja desconhecida";
    const produto = p.SKU || "Produto desconhecido";

    if (lojaSelecionada && loja !== lojaSelecionada) return;

    if (!resumo[loja]) resumo[loja] = {};
    if (!resumo[loja][produto]) resumo[loja][produto] = 0;

    resumo[loja][produto]++;
  });

  const container = document.getElementById("tabela-detalhada-vendas");
  container.innerHTML = "";

  if (!Object.keys(resumo).length) {
    container.innerHTML = "<div style='color:#6c757d;'>Nenhuma venda encontrada.</div>";
    return;
  }

  // Monta HTML da tabela
  let html = `<div style="overflow-x:auto;"><table border="1" cellspacing="0" cellpadding="5" style="width:100%; border-collapse:collapse;">
                <thead><tr><th>Loja</th><th>Produto</th><th>Quantidade</th></tr></thead><tbody>`;

  Object.entries(resumo).forEach(([loja, produtos]) => {
    Object.entries(produtos).forEach(([produto, qtd]) => {
      html += `<tr>
                 <td>${loja}</td>
                 <td>${produto}</td>
                 <td style="text-align:right;">${qtd}</td>
               </tr>`;
    });
  });

  html += `</tbody></table></div>`;
  container.innerHTML = html;
}

async function adicionarMetaManual(event) {
  event.preventDefault();
  const lojasSelecionadas = Array.from(document.getElementById('inputLojasMeta').selectedOptions).map(opt => opt.value);
  const produto = document.getElementById('inputProdutoMeta').value.trim();
  const valor = parseInt(document.getElementById('inputValorMeta').value);
  const mes = document.getElementById('inputMesMeta').value;

  if (!produto || !valor || !mes || lojasSelecionadas.length === 0) {
    alert("Preencha todos os campos corretamente.");
    return;
  }

  await addDoc(collection(db, "metas_mensais"), {
    produto,
    valor,
    mes,
    lojas: lojasSelecionadas,
    dataCadastro: new Date().toISOString()
  });

  alert("✅ Meta adicionada com sucesso!");
  document.getElementById('inputProdutoMeta').value = "";
  document.getElementById('inputValorMeta').value = "";
  renderizarMetasManuais();
}

async function renderizarMetasManuais() {
  const container = document.getElementById("containerMetasCards");
  container.innerHTML = "<p style='color:#888;'>Carregando metas...</p>";

  try {
    const snap = await getDocs(collection(db, "metas_mensais"));
    const metas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const vendidos = window.enviadosList || [];

    const agrupado = {};
    metas.forEach(meta => {
      const chave = `${meta.mes}|${meta.lojas.sort().join(",")}`;
      if (!agrupado[chave]) agrupado[chave] = { lojas: meta.lojas, mes: meta.mes, produtos: [] };
      agrupado[chave].produtos.push({ id: meta.id, produto: meta.produto, valor: meta.valor });
    });

    container.innerHTML = "";
    const hoje = new Date();

    Object.entries(agrupado).forEach(([chave, grupo]) => {
      const card = document.createElement("div");
      card.style = "background:white; border:1px solid #ccc; border-radius:8px; padding:1rem; box-shadow:0 1px 4px rgba(0,0,0,0.05); margin-bottom:1rem;";

      const diasDoMes = new Date(grupo.mes.split("-")[0], grupo.mes.split("-")[1], 0).getDate();
      const diaHoje = hoje.getDate();

      const produtosHtml = grupo.produtos.map(meta => {
        const vendidosTotal = vendidos.filter(e => {
          const lojaOk = grupo.lojas.includes(e.Loja);
          const equivalents = window.skusEquivalentes || {};
          const grupoEquivalente = Object.entries(equivalents).find(([base, aliases]) => {
            return base === meta.produto || aliases.includes(meta.produto);
          });
          const todosRelacionados = grupoEquivalente ? [grupoEquivalente[0], ...grupoEquivalente[1]] : [meta.produto];
          const produtoOk = todosRelacionados.includes(e.SKU);
          const dataOk = e.dataEnvio && e.dataEnvio.startsWith(grupo.mes);
          return lojaOk && produtoOk && dataOk;
        }).length;

        const metaDiaria = Math.ceil(meta.valor / diasDoMes);
        const projecao = Math.round((vendidosTotal / diaHoje) * diasDoMes);
        const percentual = Math.round((vendidosTotal / meta.valor) * 100);
        const cor = percentual >= 66 ? '#198754' : percentual >= 33 ? '#ffc107' : '#dc3545';

        return `
          <tr>
            <td>${meta.produto}</td>
            <td>${meta.valor}</td>
            <td>${metaDiaria}/dia</td>
            <td>${vendidosTotal}</td>
            <td style="min-width:120px;">
              <div style="background:#e9ecef; border-radius:6px; height:20px; overflow:hidden;">
                <div style="
                  width:${Math.min(percentual, 100)}%;
                  background:${cor};
                  color:white;
                  height:100%;
                  display:flex;
                  align-items:center;
                  justify-content:center;
                  font-size:0.85rem;
                  font-weight:bold;
                  transition: width 0.3s;
                ">
                  ${percentual}%
                </div>
              </div>
            </td>
            <td style="color:#555; font-size:0.85rem;">🔮 ${projecao} estimado</td>
            <td style="text-align:center;">
              <button onclick="editarMeta('${meta.id}', ${meta.valor})">✏️</button>
              <button onclick="excluirMeta('${meta.id}')">🗑️</button>
            </td>
          </tr>
        `;
      }).join("");

      card.innerHTML = `
        <div style="margin-bottom:0.5rem;font-weight:bold;color:#333;">
          📅 Mês: ${grupo.mes}<br />
          🏪 Lojas: ${grupo.lojas.join(", ")}
        </div>
        <div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr style="background:#eee;">
              <th style="padding:4px;">Produto</th>
              <th style="padding:4px;">Meta</th>
              <th style="padding:4px;">Meta Diária</th>
              <th style="padding:4px;">Alcançado</th>
              <th style="padding:4px;">%</th>
              <th style="padding:4px;">Projeção</th>
              <th style="padding:4px;">Ações</th>
            </tr>
          </thead>
          <tbody>${produtosHtml}</tbody>
        </table></div>
      `;

      container.appendChild(card);
    });

  } catch (e) {
    container.innerHTML = "<p style='color:red;'>Erro ao carregar metas.</p>";
    console.error(e);
  }
}
async function removerMetaManual(id) {
  if (!confirm("Deseja remover esta meta?")) return;
  await deleteDoc(doc(db, "metas_mensais", id));
  renderizarMetasManuais();
}

function preencherLojasInputMeta() {
  const lojas = [...new Set((window.enviadosList || []).map(p => p.Loja).filter(Boolean))].sort();
  const select = document.getElementById("inputLojasMeta");
  select.innerHTML = lojas.map(l => `<option value="${l}">${l}</option>`).join("");
}
  function preencherFiltroLojaMetas() {
  const lojas = [...new Set((window.enviadosList || []).map(p => p.Loja).filter(Boolean))].sort();
  const select = document.getElementById("filtroLojaMetas");
  if (!select) return;
  select.innerHTML = '<option value="">Todas</option>' + lojas.map(l => `<option value="${l}">${l}</option>`).join('');
}

function atualizarRelatorioMetas() {
  const enviados = window.enviadosList || [];
  const dataSel = document.getElementById('filtroDataMetas')?.value;
  const considerarMes = document.getElementById('filtroMesInteiroMetas')?.checked;
  const lojaSel = document.getElementById('filtroLojaMetas')?.value;

  const resumo = {};
  enviados.forEach(p => {
    if (!p.dataEnvio) return;
    const envioStr = p.dataEnvio.split('T')[0];
    if (dataSel) {
      if (considerarMes) {
        const [anoSel, mesSel] = dataSel.split('-').map(Number);
        const [ano, mes] = envioStr.split('-').map(Number);
        if (ano !== anoSel || mes !== mesSel) return;
      } else if (envioStr !== dataSel) {
        return;
      }
    }
    const loja = p.Loja || 'Loja desconhecida';
    if (lojaSel && loja !== lojaSel) return;
    const produto = window.obterSkuBase ? window.obterSkuBase(p.SKU) : (p.SKU || 'Produto desconhecido');
    if (!resumo[loja]) resumo[loja] = {};
    resumo[loja][produto] = (resumo[loja][produto] || 0) + 1;
  });

  const container = document.getElementById('tabela-vendas-metas');
  container.innerHTML = '';
  if (!Object.keys(resumo).length) {
    container.innerHTML = "<div style='color:#888;'>Nenhuma venda encontrada.</div>";
    return;
  }

  let html = `<div style="overflow-x:auto;"><table border="1" cellspacing="0" cellpadding="5" style="width:100%; border-collapse:collapse;">`;
  html += '<thead><tr><th>Loja</th><th>Produto</th><th>Quantidade</th><th>Valor Esperado</th></tr></thead><tbody>';
  Object.entries(resumo).forEach(([loja, produtos]) => {
    Object.entries(produtos).forEach(([produto, qtd]) => {
       const sobra = window.produtosMap && window.produtosMap[produto] ? parseFloat(window.produtosMap[produto].sobraIdeal) : 0;
      const valorEsperado = sobra * qtd;
const valorFormatado = valorEsperado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      html += `<tr><td>${loja}</td><td>${produto}</td><td style="text-align:right;">${qtd}</td><td style="text-align:right;">${valorFormatado}</td></tr>`;
    });
  });
  html += '</tbody></table></div>';
  container.innerHTML = html;
}
function calcularProjecaoMeta(valorMeta, vendidos, diasDoMes, hoje) {
  const mediaDiaria = vendidos / hoje;
  const estimadoFinal = Math.round(mediaDiaria * diasDoMes);
  return estimadoFinal;
}

function calcularAtrasoMeta(metaDiaria, vendidos, diaHoje) {
  const idealHoje = metaDiaria * diaHoje;
  const atraso = idealHoje - vendidos;
  return atraso > 0 ? atraso : 0;
}
async function atualizarCardsMetas() {
  const container = document.getElementById("container-cards-metas");
  container.innerHTML = "<div>Carregando...</div>";

  const snap = await getDocs(collection(db, "metas_mensais"));
  const metas = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  const hoje = new Date();
  const diaAtual = hoje.getDate();
  const diasNoMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();

  const enviados = window.enviadosList || [];
  const progresso = {};

  enviados.forEach(p => {
    const dt = new Date(p.dataEnvio);
    if (isNaN(dt)) return;
    const mes = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
    const loja = p.Loja || p.loja || "";
    const sku = obterSkuPrincipal(p.SKU || "Desconhecido");
    const chave = `${mes}__${loja}__${sku}`;
    progresso[chave] = (progresso[chave] || 0) + 1;
  });

  container.innerHTML = "";

  metas.forEach(meta => {
    const metaMensal = meta.valor;
    const metaDiaria = Math.ceil(metaMensal / diasNoMes);
    const metaAteHoje = metaDiaria * diaAtual;

    const vendido = meta.lojas.reduce((total, loja) => {
      const chave = `${meta.mes}__${loja}__${meta.produto}`;
      return total + (progresso[chave] || 0);
    }, 0);

    const percentual = Math.round((vendido / metaMensal) * 100);
    const atraso = metaAteHoje - vendido;

    const cor = percentual >= 100 ? '#198754' :
                percentual >= 50  ? '#0d6efd' :
                '#dc3545';

    const card = document.createElement("div");
    card.style = `
      background:white;
      border:1px solid #ccc;
      border-radius:8px;
      padding:1rem;
      box-shadow:0 2px 4px rgba(0,0,0,0.05);
      margin-bottom:1rem;
    `;

    card.innerHTML = `
      <h4 style="margin:0 0 0.5rem 0;">📦 ${meta.produto}</h4>
      <div style="font-size:0.9rem;color:#555;">🗓️ Mês: ${meta.mes}</div>
      <div style="font-size:0.9rem;color:#555;">🏪 ${meta.lojas.join(", ")}</div>
      <div style="margin:0.5rem 0;">🎯 Meta Mensal: <strong>${metaMensal}</strong></div>
      <div style="margin:0.25rem 0;">📈 Meta Diária: ${metaDiaria}</div>
      <div style="margin:0.25rem 0;">✅ Vendido até hoje: ${vendido}</div>
      <div style="margin:0.25rem 0;">📊 Progresso:</div>
      <div style="height:22px; background:#e9ecef; border-radius:6px; overflow:hidden; font-size:0.85rem; font-weight:bold;">
        <div style="
          height:100%;
          width:${Math.min(percentual, 100)}%;
          background:${cor};
          color:white;
          text-align:center;
          display:flex;
          align-items:center;
          justify-content:center;
          transition: width 0.3s;
        ">
          ${percentual}%
        </div>
      </div>
      ${atraso > 0 ? `<div style="color:#dc3545; font-weight:bold; margin-top:0.5rem;">🚨 Atraso de ${atraso} unidades</div>` : ""}
      <div style="margin-top:0.75rem;">
        <button onclick="editarMeta('${meta.id}', ${meta.valor})" style="margin-right: 0.5rem;">✏️ Editar</button>
        <button onclick="excluirMeta('${meta.id}')">🗑️ Excluir</button>
      </div>
</div>
    `;

    container.appendChild(card);
  });
}


// Atualiza automaticamente
setTimeout(atualizarCardsMetas, 1000);
window.salvarSkuEquivalente = async function (event) {
  event.preventDefault();

  const base = document.getElementById("skuBase").value.trim().toUpperCase();
  const equivalentes = document.getElementById("skusEquivalentes").value
    .split(",")
    .map(s => s.trim().toUpperCase())
    .filter(Boolean);

  if (!base || equivalentes.length === 0) return;

  // 🔍 Verifica se já existe esse agrupamento no Firebase
  const snap = await getDocs(collection(db, "skus_equivalentes"));
  const existente = snap.docs.find(doc => doc.data().base === base);

  if (existente) {
    // Atualiza se já existir
    await updateDoc(doc(db, "skus_equivalentes", existente.id), { equivalentes });
  } else {
    // Cria novo agrupamento
    await addDoc(collection(db, "skus_equivalentes"), { base, equivalentes });
  }

  document.getElementById("formSkus").reset();
  carregarSkusEquivalentes(); // Recarrega e sincroniza
};

function listarSkusEquivalentes() {
  const tbody = document.querySelector("#tabelaSkus tbody");
  tbody.innerHTML = "";

  const dados = window.skusEquivalentes || {};
  Object.entries(dados).forEach(([base, equivalentes]) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${base}</td>
      <td>${equivalentes.join(", ")}</td>
      <td><button onclick="excluirSkuEquivalente('${base}')">🗑️ Excluir</button></td>
    `;
    tbody.appendChild(tr);
  });
}
async function excluirSkuEquivalente(base) {
  try {
    const snap = await getDocs(collection(db, "skus_equivalentes"));
    snap.forEach(docItem => {
      if (docItem.data().base === base) {
        deleteDoc(doc(db, "skus_equivalentes", docItem.id));
      }
    });

    await registrarLog("Excluiu agrupamento de SKU", { skuBase: base });

    await carregarSkusEquivalentes(); // Recarrega os dados sincronizados
  } catch (e) {
    console.error("Erro ao excluir SKU:", e);
    alert("Erro ao excluir agrupamento.");
  }
}

async function excluirMeta(id) {
  if (!confirm("Deseja realmente excluir esta meta?")) return;

  try {
    await deleteDoc(doc(db, "metas_mensais", id));
await registrarLog("Excluiu Meta", { metaId: id });

    alert("Meta excluída com sucesso.");
    atualizarCardsMetas();
  } catch (e) {
    console.error("Erro ao excluir meta:", e);
    alert("Erro ao excluir meta.");
  }
}
async function editarMeta(id, valorAtual) {
  const novoValorStr = prompt("Novo valor da meta:", valorAtual);
  if (novoValorStr === null) return;

  const novoValor = parseInt(novoValorStr);
  if (isNaN(novoValor) || novoValor <= 0) {
    alert("Valor inválido.");
    return;
  }

  try {
    await updateDoc(doc(db, "metas_mensais", id), { valor: novoValor });
    await registrarLog("Editou Meta", { metaId: id, valor: novoValor });
    renderizarMetasManuais();
    atualizarCardsMetas();
    alert("Meta atualizada com sucesso.");
  } catch (e) {
    console.error("Erro ao editar meta:", e);
    alert("Erro ao editar meta.");
  }
}


async function registrarLog(acao, detalhes = {}) {
  const user = auth.currentUser;
  if (!user) return;

  const log = {
    usuario: user.email,
    acao: acao,
    detalhes: detalhes,
    timestamp: new Date().toISOString()
  };

  try {
    await addDoc(collection(db, "logs"), log);
    console.log("🔎 Log registrado:", log);
  } catch (e) {
    console.error("Erro ao registrar log:", e);
  }
}
async function carregarLogs() {
  const snap = await getDocs(query(collection(db, "logs"), orderBy("timestamp", "desc")));
  const logs = snap.docs.map(doc => doc.data());

  const container = document.getElementById("tabelaLogs");
  container.innerHTML = logs.slice(0, 100).map(log => `
    <div style="border-bottom:1px solid #ddd; padding:0.5rem 0;">
      <strong>${log.usuario}</strong> – ${log.acao}<br>
      <small>${new Date(log.timestamp).toLocaleString()}</small><br>
      <pre style="background:#f8f8f8;padding:0.5rem;border-radius:5px;">${JSON.stringify(log.detalhes, null, 2)}</pre>
    </div>
  `).join("");
}
// 🔁 Carrega os SKUs equivalentes do Firebase e salva globalmente
window.skusEquivalentes = {};

async function carregarSkusEquivalentes() {
  const snap = await getDocs(collection(db, "skus_equivalentes"));
  window.skusEquivalentes = {};
  snap.forEach(doc => {
    const data = doc.data();
    window.skusEquivalentes[data.base] = data.equivalentes;
  });
  renderizarTabelaSkus(); // Atualiza tabela na tela
}

// ➕ Salva novo agrupamento
window.salvarSkuEquivalente = async function (event) {
  event.preventDefault();
  const base = document.getElementById("skuBase").value.trim().toUpperCase();
  const lista = document.getElementById("skusEquivalentes").value
    .split(",")
    .map(x => x.trim().toUpperCase());

  await addDoc(collection(db, "skus_equivalentes"), { base, equivalentes: lista });
  document.getElementById("formSkus").reset();
  carregarSkusEquivalentes();
};

// 🗑️ Deleta agrupamento
window.excluirSkuEquivalente = async function (base) {
  const snap = await getDocs(query(collection(db, "skus_equivalentes")));
  snap.forEach(doc => {
    if (doc.data().base === base) deleteDoc(doc.ref);
  });
  carregarSkusEquivalentes();
};

// 📋 Renderiza na tabela
function renderizarTabelaSkus() {
  const tabela = document.querySelector("#tabelaSkus tbody");
  tabela.innerHTML = "";

  const equivalentes = window.skusEquivalentes || {};
  Object.entries(equivalentes).forEach(([base, aliases]) => {
    const linha = document.createElement("tr");
    linha.innerHTML = `
      <td>${base}</td>
      <td>${aliases.join(", ")}</td>
      <td>
        <button onclick="excluirSkuEquivalente('${base}')">🗑️</button>
      </td>
    `;
    tabela.appendChild(linha);
  });
}
  async function carregarProdutos() {
    const snap = await getDocs(collection(db, "produtos"));
    const tbody = document.querySelector("#tabelaProdutos tbody");
   window.produtosMap = {};
    if (tbody) tbody.innerHTML = "";
    snap.forEach(docItem => {
      const data = docItem.data();
      window.produtosMap[data.nome] = data;
      if (tbody) {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${data.nome}</td>
          <td>${data.sobraIdeal}</td>
          <td>${data.valor ?? ''}</td>
          <td><button onclick="excluirProduto('${docItem.id}')">🗑️</button></td>
        `;
        tbody.appendChild(tr);
      }
    });
  }
  window.carregarProdutos = carregarProdutos;


async function salvarProduto(event) {
  event.preventDefault();
  const nome = document.getElementById("nomeProduto").value.trim();
  const sobra = parseInt(document.getElementById("sobraIdeal").value);
  const valor = parseFloat(document.getElementById("valorProduto").value);
  if (!nome || isNaN(sobra) || isNaN(valor)) return;
  await addDoc(collection(db, "produtos"), { nome, sobraIdeal: sobra, valor });
  await registrarLog("Adicionou Produto", { nome, valor });
  document.getElementById("formProduto").reset();
  carregarProdutos();
}
window.salvarProduto = salvarProduto;

async function excluirProduto(id) {
  if (!confirm("Excluir produto?")) return;
  await deleteDoc(doc(db, "produtos", id));
  await registrarLog("Excluiu Produto", { id });
  carregarProdutos();
}
window.excluirProduto = excluirProduto;

function obterSkuPrincipal(sku) {
  const equivalentes = window.skusEquivalentes || {};
  for (const base in equivalentes) {
    const aliases = equivalentes[base];
    if (sku === base || (Array.isArray(aliases) && aliases.includes(sku))) {
      return base;
    }
  }
  return sku;
}


