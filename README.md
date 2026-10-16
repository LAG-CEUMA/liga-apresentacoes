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
- **Pontuação** (`lib/pontos.js`): presença + participação + exercícios − penalidades; pesos em `pontuacao` (padrão) e `turmas.<id>.pesos`; entregas em `s.entregas` de cada sessão; Top 5 congelado em `turmas.<id>.rankingFinal` ao arquivar.
- **Eventos** (`api/eventos.js`, `public/eventos.html`): `dados/eventos/<ID>/evento.json` e `inscricoes/<usuario>.json`. **Certificado** em `/certificado/<código>` (código = ID.usuario.HMAC); modelo opcional em `modelos/certificado.html` no repositório de conteúdo.

## Vitrine
`site.vitrine` (até 24 destaques) aparece na tela inicial. Cada item tem modo `cartao`, `clique` ou `direto`. Embeds só de sites da lista em `public/vitrine.js` (YouTube, Vimeo, itch.io, Instagram, Spotify, Discord, Google Slides/Drive, TikTok), sempre em iframe com sandbox. Edição em Personalizar → 9. Vitrine.

## Ordem da tela inicial
`site.ordem` (blocos) e `peso` (anúncios, agenda, vitrine): inteiros de 1 a 99, obrigatórios (o servidor recusa o salvamento sem eles). Menor primeiro; mesmo número = colunas (até 3). Dados antigos sem peso são migrados pela ordem atual (10, 20, 30…).

## Editor de slides
`/editor` (api/slides.js, lib/slides.js, public/editor.js). Fonte da verdade: `niveis/<nivel>/editor/<aula>.json`; a cada salvamento o portal gera `slides/<aula>.html`, `slides/<aula>-roteiro.html` e atualiza `slides/indice.json`. O HTML dos slides passa por uma lista de tags/estilos permitidos (sanitize-html). Permissão: owner, escopo por pessoa (`editores` no acesso.json: nível ou nível/aula) ou permissão `slides` + vínculo com o nível pela turma. Aulas antigas (geradas pelo script do Nível 0) são importadas para o editor sob confirmação de um owner. Imagens: `site/imagens/modulos.json` guarda onde cada imagem aparece (`site`, `slides`); sem registro = só `site`; uploads do editor nascem só em `slides`. O editor também tem guias de alinhamento, cópia de slides entre aulas e histórico de versões (commits do JSON).

Nota: o `sanitize-html` está fixado em 2.17.0 porque as versões 2.18+ puxam dependências só-ESM que a Vercel não empacotou (a função caía). O aviso do `npm audit` não se aplica: o editor não permite os atributos/tags citados (action, formaction, poster, SMIL, textarea).
