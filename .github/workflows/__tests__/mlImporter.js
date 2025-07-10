function importarPlanilhaMercadoLivre(rows, options = {}) {
  const {
    pendentes = [],
    enviados = [],
    cancelados = [],
    reclamacoes = [],
    addDoc = async () => {},
    deleteDoc = async () => {}
  } = options;

  const idsExistentes = new Set();
  [...pendentes, ...enviados, ...cancelados, ...reclamacoes].forEach(doc => {
    const id = (doc.pedidoId || doc.Pedido || '').toString().trim().toUpperCase();
    if (id) idsExistentes.add(id);
  });

  const estadosReclamacao = [
    'Reclama\u00e7\u00e3o encerrada com reembolso para o comprador',
    'Reclama\u00e7\u00e3o aberta para resolver at\u00e9 sexta-feira',
    'Reclama\u00e7\u00e3o encerrada com reembolso parcial',
    'Devolu\u00e7\u00e3o em prepara\u00e7\u00e3o',
    'Reclama\u00e7\u00e3o aberta para resolver hoje',
    'Reclama\u00e7\u00e3o aberta',
    'Reclama\u00e7\u00e3o encerrada'
  ];

  async function processRow(linha) {
    const pedidoId = (linha['N.º de venda'] || '').toString().trim().toUpperCase();
    if (!pedidoId) return;

    const estado = (linha['Estado'] || '').trim();
    const sku = linha['SKU'] || '';
    const rastreio = linha['Número de rastreamento'] || '';
    const formaEntrega = linha['Forma de entrega'] || '';
    const lojaML = (linha['Canal de venda'] || 'ML').trim();
    const dataPagamento = new Date().toISOString();

    const reclamacao = estadosReclamacao.some(e =>
      estado.toLowerCase().includes(e.toLowerCase())
    ) ? estado : '';
    if (!reclamacao && idsExistentes.has(pedidoId)) return;

    const base = {
      pedidoId,
      Loja: lojaML,
      SKU: sku,
      Rastreio: rastreio,
      FormaEntrega: formaEntrega,
      dataPagamento,
      Vendedor: 'Fabrica ML',
      status: 'novo',
      Reclamacao: reclamacao
    };

    if (reclamacao) {
      await addDoc('pedidos_reclamacoes', { ...base, status: 'reclamacao' });
      const pendenteDoc = pendentes.find(
        d => (d.pedidoId || d.Pedido || '').toString().trim().toUpperCase() === pedidoId
      );
      if (pendenteDoc) {
        await deleteDoc('pedidos_pendentes', pendenteDoc.id || pendenteDoc.pedidoId || pedidoId);
      }
    }

    if (/Venda cancelada|Reclama\u00e7\u00e3o encerrada com reembolso parcial|Reclama\u00e7\u00e3o encerrada com reembolso para o comprador|Cancelada pelo comprador|Cancelada/i.test(estado)) {
      await addDoc('pedidos_cancelados', {
        ...base,
        status: 'cancelado',
        motivo: 'Cancelado automaticamente via planilha ML',
        dataCancelamento: new Date().toISOString()
      });
    } else if (/A caminho|Entregue|Devolu\u00e7\u00e3o em prepara\u00e7\u00e3o/i.test(estado)) {
      await addDoc('pedidos_enviados', {
        ...base,
        dataEnvio: new Date().toISOString(),
        status: 'enviado'
      });
    } else {
      await addDoc('pedidos_pendentes', base);
    }
  }

  return Promise.all(rows.map(processRow));
}

module.exports = importarPlanilhaMercadoLivre;

// Jest's default configuration treats files inside `__tests__` as test files. This
// minimal test prevents Jest from failing when executing this helper module.
test('mlImporter module loads', () => {});
