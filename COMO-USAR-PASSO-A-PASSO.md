# Como usar o site de apresentações, passo a passo

**Para quem:** aluno e monitor. **Tipo:** guia. **Tempo:** 5 minutos.

## 1. Ver uma aula (aluno ou monitor)
1. Abra o endereço do site no navegador, no computador ou no celular.
2. Clique na aula desejada.
3. **Seta direita**, **espaço** ou **clique** avançam. Cada avanço mostra o próximo texto.
4. **Seta esquerda** volta. **F** abre a tela cheia.
5. No celular, toque na tela para avançar e use o aparelho na horizontal.

## 2. Apresentar em outro lugar (monitor)
1. Abra o site no navegador do computador da sala.
2. Aperte **F** para tela cheia.
3. O **roteiro** não está no site. Abra-o no seu notebook ou celular, a partir do `liga-curriculo`.

## 3. Publicar uma aula nova (monitor)
1. No `liga-curriculo`, edite `site-config.json` e inclua a aula em `liberadas`.
2. Rode: `python ferramentas\montar-site.py`. Isso cria a pasta `site/`.
3. Copie o conteúdo da pasta `site/` para este repositório (`liga-apresentacoes`).
4. No GitHub Desktop: Summary `Publica aula NN`, **Commit to main** e **Push origin**.
5. Em cerca de 1 minuto a aula aparece no site.

## 4. Erros comuns
| N | Erro | O que fazer |
| --- | --- | --- |
| 1 | A aula não aparece | Espere 1 minuto e recarregue com **Ctrl+F5** |
| 2 | Fonte diferente da esperada | O site precisa de internet para as fontes; sem elas usa fonte comum |
| 3 | Página 404 | Confira se a pasta `aula-NN` foi copiada com o arquivo `index.html` dentro |

## 5. Dica da Liga
Use sempre os nomes e programas em inglês. Tutoriais, pesquisas e IA falam de código em inglês.
