const importar = require('./mlImporter');

test('adds complaint orders to pedidos_reclamacoes', async () => {
  const addDoc = jest.fn(async () => {});
  const rows = [
    {
      'N.º de venda': '123',
      'Estado': 'Reclamação aberta',
      'SKU': 'sku1'
    }
  ];
  await importar(rows, { addDoc });
  const calls = addDoc.mock.calls.filter(c => c[0] === 'pedidos_reclamacoes');
  expect(calls.length).toBe(1);
  expect(calls[0][1]).toHaveProperty('pedidoId', '123');
  expect(calls[0][1]).toHaveProperty('status', 'reclamacao');
});

test('does not add non-complaint orders to pedidos_reclamacoes', async () => {
  const addDoc = jest.fn(async () => {});
  const rows = [
    {
      'N.º de venda': '124',
      'Estado': 'A caminho',
      'SKU': 'sku2'
    }
  ];
  await importar(rows, { addDoc });
  const calls = addDoc.mock.calls.filter(c => c[0] === 'pedidos_reclamacoes');
  expect(calls.length).toBe(0);
});

test('deletes pending order when complaint already exists in pendentes', async () => {
  const addDoc = jest.fn(async () => {});
  const deleteDoc = jest.fn(async () => {});
  const pendentes = [{ id: 'p1', pedidoId: '125' }];
  const rows = [
    {
      'N.º de venda': '125',
      'Estado': 'Reclamação aberta',
      'SKU': 'sku3'
    }
  ];
  await importar(rows, { addDoc, deleteDoc, pendentes });
  expect(deleteDoc).toHaveBeenCalledWith('pedidos_pendentes', 'p1');
});
