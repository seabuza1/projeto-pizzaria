// Cliente pelo telefone completo (F2, 2a). PED1: o código do pedido são os 4 últimos dígitos.
import { falha, type Resultado, sucesso } from './resultado';

/** "(64) 99999-3557", "+55 64 9 9999 3557" ou "064..." → "64999993557" (DDD e número, 10 ou 11 dígitos). */
export function lerTelefone(texto: string): Resultado<string> {
  let digitos = texto.replace(/\D/g, '');
  if (digitos.startsWith('55') && (digitos.length === 12 || digitos.length === 13)) digitos = digitos.slice(2);
  if (digitos.startsWith('0') && (digitos.length === 11 || digitos.length === 12)) digitos = digitos.slice(1);
  if (digitos.length !== 10 && digitos.length !== 11) {
    return falha('telefone_invalido', 'Digite o telefone com DDD, por exemplo (64) 99999-3557.');
  }
  return sucesso(digitos);
}

export const codigoDoTelefone = (telefone: string): string => telefone.slice(-4);

export function formatarTelefone(telefone: string): string {
  const ddd = telefone.slice(0, 2);
  const numero = telefone.slice(2);
  return `(${ddd}) ${numero.slice(0, -4)}-${numero.slice(-4)}`;
}
