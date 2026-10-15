# Liga de Games Ceuma: portal de aulas

**Para quem:** monitor (aluno só usa o site). **Tipo:** código do site. **Leia em 1 minuto.**

Site: **https://lag-ceuma.vercel.app**

## O que ele faz
1. Mostra as aulas (slides) com **três níveis de acesso**, escolhidos aula por aula: **público** (sem login), **membros** (login com GitHub; alunos e monitores da lista) e **só owners** (padrão).
2. Quatro papéis:
   - **Owner:** vê tudo (slides e roteiros), libera e usa o painel `/admin`.
   - **Monitor:** começa com acesso de **aluno** e só vê a mais o que um owner marcar para ele (slides e roteiros, aula por aula).
   - **Aluno:** vê as aulas de nível membros e públicas.
   - **Visitante** (sem login): só as aulas públicas.
3. O conteúdo vem do `liga-curriculo` (privado). Nada de aula fica neste repositório.

## Configurar (uma vez)
Siga o **[COMO-USAR-PASSO-A-PASSO.md](COMO-USAR-PASSO-A-PASSO.md)**: criar o app de login no GitHub, um token de leitura e 5 variáveis na Vercel.

## Dica da Liga
Use os termos e programas **em inglês**.
