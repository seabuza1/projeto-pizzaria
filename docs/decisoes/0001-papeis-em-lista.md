# 0001 Papéis em lista no perfil

- **Contexto:** o Felipe é `admin` e `motoboy` (PROJETO, seção 3). Com um papel só por pessoa, ele não teria caixa na noite ou não administraria.
- **Decisão:** `perfis.papeis` é uma lista (`papel[]`). As políticas usam `interno.tem_papel(...)`, que confere se a lista tem algum dos papéis pedidos.
- **Consequência:** abrir caixa exige o papel `motoboy` na lista; o admin que também é motoboy aparece na escolha dos motoboys da noite.
- **Atualização (31/10):** a 0007 substitui a parte do Felipe ser `motoboy`: o motoboy não usa o sistema e virou cadastro. A lista de papéis continua (uma pessoa pode ser, por exemplo, `expedicao` e `atendente`).
