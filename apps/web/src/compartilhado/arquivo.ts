// Baixar um arquivo gerado no aparelho (funciona sem internet).
export function baixarArquivo(nome: string, conteudo: string, tipo = 'text/csv;charset=utf-8') {
  // BOM para o Excel abrir os acentos certos.
  const url = URL.createObjectURL(new Blob([`﻿${conteudo}`], { type: tipo }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  a.click();
  URL.revokeObjectURL(url);
}
