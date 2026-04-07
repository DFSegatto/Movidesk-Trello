# Movidesk → Trello Webhook

Serverless function (Vercel + Node.js) que escuta webhooks do **Movidesk** e move automaticamente o card correspondente no **Trello** quando um ticket recebe uma nova resposta.

---

## Como funciona

```
Movidesk (nova resposta) → POST /api/webhook → busca card pelo ID do ticket → move card para coluna destino
```

O card é encontrado pelo **ID do ticket presente no nome do card** (ex: `"[#1042] Problema com login"`).

---

## Pré-requisitos

- Conta na [Vercel](https://vercel.com) (gratuita)
- [Vercel CLI](https://vercel.com/docs/cli): `npm i -g vercel`
- Conta no Trello com acesso ao board desejado

---

## 1. Configurar credenciais do Trello

### API Key
1. Acesse https://trello.com/power-ups/admin
2. Clique em **"New"** e crie um Power-Up (pode ser privado)
3. Copie a **API Key**

### Token
Acesse essa URL no browser (substitua `SUA_API_KEY`):
```
https://trello.com/1/authorize?expiration=never&scope=read,write&response_type=token&key=SUA_API_KEY
```
Copie o **Token** gerado.

### Board ID
1. Abra seu board no Trello
2. Adicione `.json` no final da URL: `https://trello.com/b/xxxxxx/nome-do-board.json`
3. Copie o campo `"id"`

### List ID (coluna de destino)
```bash
curl "https://api.trello.com/1/boards/SEU_BOARD_ID/lists?key=SUA_API_KEY&token=SEU_TOKEN"
```
Copie o `"id"` da lista para onde os cards devem ser movidos.

---

## 2. Padrão do nome dos cards

O card no Trello **deve conter o ID do ticket** em algum lugar do nome. Exemplos aceitos:

| Nome do card | Ticket ID detectado |
|---|---|
| `[#1042] Problema com login` | `1042` ✅ |
| `Ticket 1042 - Cliente X` | `1042` ✅ |
| `1042 - Erro no sistema` | `1042` ✅ |

---

## 3. Deploy na Vercel

```bash
# Clone ou copie os arquivos do projeto
cd movidesk-trello

# Instale dependências de dev
npm install

# Login na Vercel
vercel login

# Deploy (primeira vez — vai perguntar configurações do projeto)
vercel

# Configurar variáveis de ambiente
vercel env add TRELLO_API_KEY
vercel env add TRELLO_TOKEN
vercel env add TRELLO_BOARD_ID
vercel env add TRELLO_TARGET_LIST_ID
vercel env add MOVIDESK_WEBHOOK_SECRET   # opcional

# Deploy em produção
vercel --prod
```

Sua URL ficará no formato:
```
https://seu-projeto.vercel.app/api/webhook
```

---

## 4. Configurar Webhook no Movidesk

1. Acesse **Movidesk → Configurações → Webhooks**
2. Clique em **Novo webhook**
3. Preencha:
   - **URL**: `https://seu-projeto.vercel.app/api/webhook`
   - **Evento**: `Ticket respondido` (ou equivalente)
   - **Método**: `POST`
   - **Content-Type**: `application/json`
   - **Secret** *(opcional)*: mesmo valor configurado em `MOVIDESK_WEBHOOK_SECRET`
4. Salve e ative

---

## 5. Testar localmente

```bash
# Copie o arquivo de exemplo
cp .env.example .env.local

# Preencha os valores no .env.local

# Inicie o servidor de dev da Vercel
vercel dev
```

Simule um webhook:
```bash
curl -X POST http://localhost:3000/api/webhook \
  -H "Content-Type: application/json" \
  -d '{"type": "TicketAnswered", "id": 1042}'
```

---

## Estrutura do payload Movidesk

O handler aceita as seguintes variações de payload (Movidesk pode variar):

```json
{ "type": "TicketAnswered", "id": 1042 }
{ "action": "TicketAnswered", "ticket": { "id": 1042 } }
{ "event": "ticketAnswered", "ticketId": 1042 }
```

Se o payload do seu Movidesk for diferente, ajuste a seção **"Detecta se é uma resposta nova"** em `api/webhook.js`.

---

## Variáveis de ambiente

| Variável | Obrigatória | Descrição |
|---|---|---|
| `TRELLO_API_KEY` | ✅ | API Key do Trello |
| `TRELLO_TOKEN` | ✅ | Token de acesso do Trello |
| `TRELLO_BOARD_ID` | ✅ | ID do board |
| `TRELLO_TARGET_LIST_ID` | ✅ | ID da coluna de destino |
| `MOVIDESK_WEBHOOK_SECRET` | ❌ | Secret para validar origem do webhook |

---

## Logs

Acesse os logs em tempo real pelo painel da Vercel:
**Vercel Dashboard → Seu projeto → Functions → Logs**
