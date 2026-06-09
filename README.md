# Visual Training Performance

Aplicação p5.js para treino visual com persistência local, fila offline e sincronização opcional/segura para Google Sheets.

## O que foi alterado

- Estado inicial: o jogo abre com formas geométricas visíveis e paradas. A tecla `M` continua a alternar o movimento sem alterar a lógica original de movimento.
- Resultados: no fim de cada tentativa é obrigatória uma avaliação pessoal de 0 a 10 e podem ser adicionadas observações.
- Persistência local: cada tentativa fica guardada em IndexedDB com `attemptId` único, mesmo sem internet.
- Sincronização: a app tenta enviar resultados para a API configurada; se falhar, mantém a fila local e sincroniza quando voltar a ligação.
- Google Sheets: em GitHub Pages a opção segura é Google Apps Script publicado como Web App. Não há credenciais no frontend.
- Análise: painel com resultado atual, últimas tentativas, médias, melhor nível, evolução recente, estado de sincronização e gráfico.
- PWA: favicon, manifest e service worker para abrir em browser e suportar cache local.
- Publicação: preparada para GitHub Pages com caminhos relativos e build estático em `dist/`.

## Publicação online

Depois do deploy via GitHub Pages, a app fica disponível em:

```text
https://kevinxlucas.github.io/visual-training-performance/
```

## Configuração Google Sheets via Google Apps Script

Esta é a melhor autenticação para GitHub Pages porque o GitHub Pages não tem servidor privado. O Apps Script corre na conta Google autorizada e escreve na folha sem expor `client_secret`, `refresh_token`, passwords ou chaves no browser.

1. Criar/abrir a folha **Visual Training Performance Database** no Google Drive.
2. Criar uma aba chamada **Resultados**.
3. Abrir https://script.google.com/ e criar um projeto.
4. Copiar o conteúdo de `google-apps-script/Code.gs` para `Code.gs`.
5. No Apps Script, substituir:

```js
const SHEET_ID = 'PASTE_GOOGLE_SHEET_ID_HERE';
```

pelo ID da folha.

6. Fazer deploy:
   - **Deploy > New deployment**
   - Type: **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
7. Copiar o URL terminado em `/exec`.
8. Editar `config.js` e definir:

```js
window.VisualTrainingConfig = {
  apiUrl: 'https://script.google.com/macros/s/SEU_DEPLOYMENT_ID/exec'
};
```

9. Fazer novo build/deploy.

## Correr localmente

```bash
npm install
npm run build
npm run start -- --port 5175
```

Para testar a API Node local com OAuth Google guardado no servidor local:

```bash
PORT=5175 npm run serve:local
```

## Build para GitHub Pages

```bash
npm run build
```

O output estático fica em `dist/`.

## Confirmações funcionais

- Os dados ficam persistentes localmente via IndexedDB.
- A app funciona sem internet e guarda resultados pendentes localmente.
- Quando `config.js` contém o URL do Google Apps Script, os dados são enviados para Google Sheets sem credenciais no frontend.
- O gráfico usa os dados guardados localmente e os dados sincronizados recebidos da Google Sheet quando a API está configurada.
