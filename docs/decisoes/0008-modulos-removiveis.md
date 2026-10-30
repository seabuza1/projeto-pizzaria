# 0008 Funcionalidades como módulos removíveis

- **Contexto:** o app do motoboy foi construído e precisou sair (0007). Tirar uma funcionalidade não pode quebrar o resto do sistema nem depender de caçar referências à mão.
- **Decisão:** cada funcionalidade é uma pasta com uma ficha (`index.ts`), registrada numa lista só. Uma funcionalidade não importa outra; um teste barra isso. `config` desliga uma funcionalidade sem deploy. A remoção segue a skill `/remover-funcionalidade` (PADROES, Módulos removíveis).
- **Consequência:** remover vira desligar, mover o que é compartilhado, apagar a pasta e contrair o banco numa versão seguinte, com `pnpm check` verde em cada passo.
