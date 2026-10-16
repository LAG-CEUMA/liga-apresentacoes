# Liga de Games Ceuma: portal de aulas

**Para quem:** monitor (aluno só usa o site). **Tipo:** código do site. **Leia em 1 minuto.**

Site: **https://lag-ceuma.vercel.app**

## O que ele faz
1. Mostra as aulas (slides) com **três níveis de acesso**, escolhidos aula por aula: **público** (sem login), **membros** (login com GitHub; alunos e monitores da lista) e **só owners** (padrão).
2. Quatro papéis:
   - **Owner:** vê tudo (slides e roteiros), libera e usa o painel `/admin`.
   - **Personalizar o site:** owners usam `/personalizar` para mudar cores, logo, papel de parede, anúncios, agenda e redes sociais (salvo em `site/` no `liga-curriculo`).
   - **Monitor:** começa com acesso de **aluno** e só vê a mais o que um owner marcar para ele (slides e roteiros, aula por aula).
   - **Aluno:** vê as aulas de nível membros e públicas.
   - **Visitante** (sem login): só as aulas públicas.
3. O conteúdo vem do `liga-curriculo` (privado). Nada de aula fica neste repositório.

## Configurar (uma vez)
Siga o **[COMO-USAR-PASSO-A-PASSO.md](COMO-USAR-PASSO-A-PASSO.md)**: criar o app de login no GitHub, um token de leitura e 5 variáveis na Vercel.

## Dica da Liga
Use os termos e programas **em inglês**.

## Pessoas, cargos e turmas (painel `/admin`)

- **Cargos** (`cargos` em `acesso/acesso.json`): modelos de permissão reutilizáveis. Uma pessoa da `equipe` pode ter vários cargos; as permissões somam (mais as extras dela).
- **Turmas** (`turmas`): `{nome, status: andamento|planejada|arquivada, inicio, alunos[]}`. Todo aluno pertence a pelo menos uma turma (migração automática para a turma `2026`). A chamada usa só os alunos da turma; monitores têm `turmas` (vazio = todas).
- Ações da API `/api/admin` (POST): `pessoa`, `adicionar`, `remover_pessoa`, `cargo`, `remover_cargo`, `turma`, `mover_turma` (além das antigas).
- O painel (`public/admin.html` + `public/admin.js`) tem abas Pessoas, Cargos, Turmas, Níveis das aulas e Guia, com ficha lateral, "Ver como" e "Adicionar várias".
- **Nível por turma:** `turmas.<id>.nivel` (pasta da aula, ex.: `nivel-00-tutorial`; vazio = todos), `fim`, `acessoApos` (turma arquivada mantém acesso aos slides do nível). O aluno só abre aulas Membros dos níveis das suas turmas; roteiros nunca. Ação `promover` copia alunos para a turma nova sem tirá-los da origem.
- Códigos de turma são salvos em MAIÚSCULAS. Arquivar define `acessoAte` (1 ano, editável). Ações `renomear_turma` (só sem chamadas) e `excluir_turma` (só vazia e sem chamadas).
- Acesso extra por pessoa: `acessos.<usuario>: [{nivel, ate, motivo}]` (slides do nível até a data; nunca roteiro). Editado na ficha (ação `pessoa`, campo `acessos`).
