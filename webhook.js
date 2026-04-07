// api/webhook.js
// Vercel Serverless Function — recebe o webhook do Movidesk e move o card no Trello

const TRELLO_API_KEY = process.env.TRELLO_API_KEY;
const TRELLO_TOKEN = process.env.TRELLO_TOKEN;
const TRELLO_TARGET_LIST_ID = process.env.TRELLO_TARGET_LIST_ID; // ID da coluna de destino
const TRELLO_BOARD_ID = process.env.TRELLO_BOARD_ID;            // ID do board

// Movidesk envia um secret opcional para validar a origem
const MOVIDESK_WEBHOOK_SECRET = process.env.MOVIDESK_WEBHOOK_SECRET;

// ─── Helpers Trello ───────────────────────────────────────────────────────────

/**
 * Busca todos os cards de um board e retorna o que contém o ticketId no nome.
 */
async function findCardByTicketId(ticketId) {
  const url = `https://api.trello.com/1/boards/${TRELLO_BOARD_ID}/cards?key=${TRELLO_API_KEY}&token=${TRELLO_TOKEN}&fields=id,name,idList`;
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`Trello GET cards falhou: ${res.status} ${await res.text()}`);
  }

  const cards = await res.json();

  // Busca card cujo nome contenha o ID do ticket (ex: "[#12345]" ou "Ticket 12345")
  return cards.find((card) =>
    card.name.includes(String(ticketId))
  ) || null;
}

/**
 * Move um card para a lista de destino configurada.
 */
async function moveCardToList(cardId) {
  const url = `https://api.trello.com/1/cards/${cardId}?key=${TRELLO_API_KEY}&token=${TRELLO_TOKEN}`;
  const res = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idList: TRELLO_TARGET_LIST_ID }),
  });

  if (!res.ok) {
    throw new Error(`Trello PUT card falhou: ${res.status} ${await res.text()}`);
  }

  return res.json();
}

// ─── Handler principal ────────────────────────────────────────────────────────

export default async function handler(req, res) {
  // Apenas POST é aceito
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Valida secret do Movidesk (se configurado)
  if (MOVIDESK_WEBHOOK_SECRET) {
    const secret = req.headers["x-movidesk-secret"] || req.headers["authorization"];
    if (secret !== MOVIDESK_WEBHOOK_SECRET) {
      console.warn("Webhook recebido com secret inválido");
      return res.status(401).json({ error: "Unauthorized" });
    }
  }

  const body = req.body;

  // Log para debug — remova em produção se quiser
  console.log("Payload Movidesk recebido:", JSON.stringify(body, null, 2));

  // ── Detecta se é uma resposta nova num ticket ──
  // O Movidesk envia 'action' com valor 'TicketAnswered' (ou similar).
  // Ajuste o campo/valor conforme o evento configurado no painel do Movidesk.
  const isTicketAnswered =
    body?.type === "TicketAnswered" ||          // campo "type"
    body?.action === "TicketAnswered" ||         // campo "action"
    body?.event === "ticketAnswered";            // campo "event"

  if (!isTicketAnswered) {
    console.log(`Evento ignorado: ${body?.type || body?.action || body?.event}`);
    return res.status(200).json({ message: "Evento ignorado" });
  }

  // Extrai o ID do ticket — o Movidesk geralmente envia em body.id ou body.ticket.id
  const ticketId = body?.id ?? body?.ticket?.id ?? body?.ticketId;

  if (!ticketId) {
    console.error("ID do ticket não encontrado no payload:", body);
    return res.status(400).json({ error: "ticketId ausente no payload" });
  }

  try {
    // 1. Encontra o card no Trello pelo ID do ticket
    const card = await findCardByTicketId(ticketId);

    if (!card) {
      console.warn(`Nenhum card encontrado para o ticket #${ticketId}`);
      return res.status(404).json({ message: `Card não encontrado para ticket #${ticketId}` });
    }

    // 2. Verifica se o card já está na coluna de destino
    if (card.idList === TRELLO_TARGET_LIST_ID) {
      return res.status(200).json({ message: "Card já está na coluna correta", cardId: card.id });
    }

    // 3. Move o card
    const updated = await moveCardToList(card.id);
    console.log(`Card "${card.name}" movido com sucesso para a lista ${TRELLO_TARGET_LIST_ID}`);

    return res.status(200).json({
      message: "Card movido com sucesso",
      cardId: updated.id,
      cardName: updated.name,
      newList: TRELLO_TARGET_LIST_ID,
    });
  } catch (err) {
    console.error("Erro ao processar webhook:", err.message);
    return res.status(500).json({ error: err.message });
  }
}
