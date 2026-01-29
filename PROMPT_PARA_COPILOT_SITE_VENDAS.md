# PROMPT PARA GITHUB COPILOT - INTEGRAÇÃO COM VN TICKET GUARDIAN

## Copie este prompt e use no seu projeto de vendas de ingressos:

---

Preciso integrar meu site de vendas de ingressos com a API do VN Ticket Guardian para receber informações de preços múltiplos.

**Informações da API:**
- Endpoint: `https://qqdtwekialqpakjgbonh.supabase.co/functions/v1/manage-events?action=list`
- Método: POST
- Headers necessários:
  - Authorization: Bearer {token_supabase}
  - Content-Type: application/json
  - apikey: {publishable_key}

**Estrutura de resposta esperada para cada evento:**
```json
{
  "id": "uuid-do-evento",
  "title": "Nome do Evento",
  "date": "2026-02-15T20:00:00Z",
  "location": "Local do Evento",
  "price": 30,
  "available_tickets": 200,
  "image_url": "https://...",
  "has_fee": true,
  "fee_amount": 5.50,
  "is_available": true,
  "unavailability_reason": null,
  "ticket_types": [
    {"name": "Pista", "price": 30},
    {"name": "Camarote", "price": 60},
    {"name": "VIP", "price": 100}
  ]
}
```

**O que preciso fazer:**

1. Criar uma função que faz requisição para essa API e retorna a lista de eventos
2. Se o evento tiver `ticket_types` array com múltiplos itens, exibir essas opções em radio buttons
3. Se não tiver `ticket_types` ou array vazio, usar o `price` único como fallback
4. Quando o usuário seleciona um tipo de ingresso:
   - Mostrar o nome do tipo (ex: "Pista", "Camarote")
   - Mostrar o preço selecionado
   - Se `has_fee` for true, adicionar `fee_amount` ao total
5. Incluir seletor de quantidade (1-10)
6. Exibir cálculo: subtotal + taxa = total
7. Se `is_available` for false, desabilitar a compra e mostrar `unavailability_reason`

**Quero que você:**
- Gere o código necessário para fazer essa integração
- Crie componentes/funções reutilizáveis
- Implemente tratamento de erros
- Adicione loading states

---

## FIM DO PROMPT

Copie e cole tudo acima no chat do GitHub Copilot do seu outro projeto! 🚀
