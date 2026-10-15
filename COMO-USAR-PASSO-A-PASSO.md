# Portal de aulas, passo a passo

**Para quem:** monitor. **Tipo:** guia. **Tempo:** 20 minutos para configurar, 1 minuto por liberação.

## Como funciona (3 frases)
O site (Vercel) busca as aulas no repositório privado `liga-curriculo` usando um **token** que só ele conhece. Quem entra com o GitHub é reconhecido pelo **usuário**; as listas `monitores` e `alunos` ficam em `liga-curriculo/acesso/acesso.json`. Cada aula tem um nível: `monitores`, `membros` ou `publico`.

## Parte A: configurar uma vez
### 1. Criar o app de login no GitHub
1. Abra github.com/organizations/LAG-CEUMA/settings/applications (ou, na sua conta, **Settings > Developer settings > OAuth Apps**).
2. Clique em **New OAuth App**.
3. **Application name:** `Liga de Games Ceuma`.
4. **Homepage URL:** `https://liga-apresentacoes.vercel.app`.
5. **Authorization callback URL:** `https://liga-apresentacoes.vercel.app/api/callback` (exatamente assim).
6. Clique em **Register application**.
7. Copie o **Client ID**. Clique em **Generate a new client secret** e copie o **Client secret** (aparece uma vez só).

### 2. Criar o token de leitura e escrita do conteúdo
1. Abra github.com/settings/personal-access-tokens e clique em **Generate new token**.
2. **Resource owner:** LAG-CEUMA. **Repository access:** *Only select repositories* > `liga-curriculo`.
3. **Permissions > Repository permissions > Contents:** *Read and write*.
4. Gere e copie o token (`github_pat_...`). Ele precisa de leitura para mostrar as aulas e de escrita para gravar as liberações.
5. Se a organização exigir aprovação de tokens, aprove em *Organization settings > Personal access tokens*.

### 3. Variáveis na Vercel
1. Vercel > projeto `liga-apresentacoes` > **Settings > Environment Variables**.
2. Crie estas variáveis (marque Production):

| N | Nome | Valor |
| --- | --- | --- |
| 1 | `GITHUB_CLIENT_ID` | Client ID do passo 1 |
| 2 | `GITHUB_CLIENT_SECRET` | Client secret do passo 1 |
| 3 | `GH_TOKEN` | Token do passo 2 |
| 4 | `SESSION_SECRET` | Texto longo e aleatório (mínimo 16 caracteres; pode gerar em um gerador de senhas) |
| 5 | `ADMIN_USERS` | Seu usuário do GitHub (ex.: `afonsofarias`). Esse usuário é sempre monitor, mesmo se a lista for apagada |

3. Vá em **Deployments**, abra o último e clique em **Redeploy** para valer as variáveis.

### 4. Testar
1. Abra o site: a aula 1 deve aparecer (pública).
2. Clique em **Entrar com GitHub** e depois em **Painel**.

## Parte B: liberar aulas
1. Abra `https://liga-apresentacoes.vercel.app/admin` e entre.
2. Em cada aula, escolha **Só monitores**, **Membros** ou **Público**. Salva sozinho.
3. Em **Pessoas**, escreva o usuário do GitHub de cada aluno (um por linha) e clique em **Salvar listas**.
4. Cada mudança vira um commit em `liga-curriculo/acesso/`: o histórico mostra quem liberou o quê.

## Parte C: aula nova
Nada a fazer no site. Quando o `liga-curriculo` ganha `slides/aula-NN.html`, ela aparece no painel como **Só monitores**. Libere quando quiser.

## Erros comuns
| N | Erro | O que fazer |
| --- | --- | --- |
| 1 | "Login não configurado" | Falta `GITHUB_CLIENT_ID` ou faltou o Redeploy |
| 2 | Volta do GitHub com erro de callback | A *callback URL* do app não é exatamente `.../api/callback` |
| 3 | Painel diz "Não consegui salvar" | O token não tem *Contents: Read and write* no `liga-curriculo`, ou venceu |
| 4 | Aluno entra e vê "Sem acesso" | O usuário não está na lista de alunos (confira a grafia) ou a aula está como Só monitores |
| 5 | Mudança demora | Pode levar até 1 minuto para valer em todos os servidores |

## Segurança, em resumo
1. O aluno não tem acesso ao `liga-curriculo`: só o servidor lê, com o token.
2. A sessão é um cookie assinado, válido por 7 dias. **Sair** apaga.
3. O login pede ao GitHub só o usuário público (nenhuma permissão).
4. O roteiro só abre para monitores, mesmo em aula pública.
5. Quem tiver o token pode editar `liga-curriculo`: guarde só na Vercel e renove se vazar.

## Testes
`npm test` roda testes locais que simulam o GitHub (permissões, painel e login).

## Dica da Liga
Use os termos e programas **em inglês**.
