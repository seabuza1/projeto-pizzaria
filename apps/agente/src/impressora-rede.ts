// Impressora térmica de 80 mm na rede (Wi-Fi da loja, IP fixo, TCP 9100). A marcação ReceiptLine vira ESC/POS
// em cp860 (português); o layout fica no domínio, o envio fica aqui.
import { connect } from 'node:net';
import type { Impressora, Resultado, TrabalhoImpressao } from '@mel/dominio';
import { transform } from 'receiptline';

export function escposDe(conteudo: string): Buffer {
  return Buffer.from(transform(conteudo, { cpl: 48, encoding: 'cp860', command: 'escpos', cutting: true }), 'binary');
}

const falhou = (codigo: string, mensagem: string): Resultado<void> => ({ ok: false, erro: { codigo, mensagem } });

/** Manda os bytes e espera a impressora fechar o recebimento. */
export function enviar(host: string, porta: number, bytes: Buffer, timeoutMs = 5000): Promise<Resultado<void>> {
  return new Promise((resolver) => {
    const socket = connect({ host, port: porta });
    let fim = false;
    const terminar = (r: Resultado<void>) => {
      if (fim) return;
      fim = true;
      socket.destroy();
      resolver(r);
    };
    socket.setTimeout(timeoutMs, () => terminar(falhou('impressora_sem_resposta', 'Impressora sem resposta.')));
    socket.on('error', () => terminar(falhou('impressora_sem_resposta', 'Impressora sem resposta.')));
    socket.on('connect', () => socket.end(bytes, () => terminar({ ok: true, valor: undefined })));
  });
}

/** Só confere se a impressora atende (o batimento do agente). */
export function testar(host: string, porta: number, timeoutMs = 2000): Promise<boolean> {
  return enviar(host, porta, Buffer.alloc(0), timeoutMs).then((r) => r.ok);
}

export class ImpressoraDeRede implements Impressora {
  readonly nome: string;
  private readonly host: string;
  private readonly porta: number;

  constructor(nome: string, host: string, porta: number) {
    this.nome = nome;
    this.host = host;
    this.porta = porta;
  }

  imprimir(trabalho: TrabalhoImpressao): Promise<Resultado<void>> {
    let bytes: Buffer;
    try {
      bytes = escposDe(trabalho.conteudo);
    } catch {
      return Promise.resolve(falhou('conteudo_invalido', 'Não deu para montar a impressão.'));
    }
    return enviar(this.host, this.porta, bytes);
  }

  testar(): Promise<boolean> {
    return testar(this.host, this.porta);
  }
}
