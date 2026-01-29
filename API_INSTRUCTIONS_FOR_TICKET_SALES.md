# 📋 PROMPT PARA SITE DE VENDAS DE INGRESSOS

## Acessar informações de preços múltiplos do VN Ticket Guardian

---

## 1. ENDPOINT DA API

```
GET/POST: https://qqdtwekialqpakjgbonh.supabase.co/functions/v1/manage-events
Método: GET ou POST
Headers obrigatórios:
  - Authorization: Bearer {seu_token_supabase}
  - apikey: {sua_publishable_key}
```

**Supabase Project ID:** `qqdtwekialqpakjgbonh`

---

## 2. ESTRUTURA DE RESPOSTA DO EVENTO

Cada evento retornará uma estrutura como esta:

```json
{
  "id": "uuid-do-evento",
  "title": "Show XYZ",
  "description": "Descrição do show",
  "date": "2026-02-15T20:00:00Z",
  "location": "St Serp Juazeiro",
  "price": 30,
  "available_tickets": 200,
  "image_url": "https://...",
  "category": "Festas e Shows",
  "has_fee": true,
  "fee_amount": 5.50,
  "is_available": true,
  "unavailability_reason": null,
  "prices": [
    {
      "name": "Pista",
      "price": 30
    },
    {
      "name": "Camarote",
      "price": 60
    },
    {
      "name": "VIP",
      "price": 100
    }
  ]
}
```

---

## 3. LÓGICA PARA EXIBIR PREÇOS

### Verificar se há múltiplos preços:

```javascript
const event = await fetchEvent(eventId); // Sua requisição à API

if (event.prices && event.prices.length > 0) {
  // Há múltiplos tipos de ingressos cadastrados
  displayMultiplePrices(event.prices);
} else {
  // Usar o preço único padrão
  displaySinglePrice(event.price);
}
```

### Exemplo: Renderizar opções de preço

```javascript
function renderTicketOptions(prices) {
  const container = document.getElementById('ticket-options');
  container.innerHTML = '';

  prices.forEach((priceOption) => {
    const div = document.createElement('div');
    div.className = 'ticket-option';
    div.innerHTML = `
      <label>
        <input 
          type="radio" 
          name="ticket-type" 
          value="${priceOption.name}"
          data-price="${priceOption.price}"
        />
        <span>${priceOption.name}</span>
        <span class="price">R$ ${priceOption.price.toFixed(2)}</span>
      </label>
    `;
    container.appendChild(div);
  });
}

// Uso:
const event = { prices: [
  { name: "Pista", price: 30 },
  { name: "Camarote", price: 60 }
]};

renderTicketOptions(event.prices);
```

---

## 4. CÁLCULO DE TOTAL COM TAXA

```javascript
function calculateTotal(selectedPrice, feeAmount = 0) {
  const subtotal = selectedPrice;
  const fee = feeAmount;
  const total = subtotal + fee;
  
  return {
    subtotal: subtotal,
    fee: fee,
    total: total
  };
}

// Exemplo:
const event = {
  has_fee: true,
  fee_amount: 5.50,
  prices: [
    { name: "Pista", price: 30 },
    { name: "Camarote", price: 60 }
  ]
};

const selectedPrice = 60; // Camarote
const breakdown = calculateTotal(selectedPrice, event.has_fee ? event.fee_amount : 0);

console.log(breakdown);
// { subtotal: 60, fee: 5.50, total: 65.50 }
```

---

## 5. EXEMPLO COMPLETO - REACT

```jsx
import { useEffect, useState } from 'react';

export function TicketSelector({ eventId }) {
  const [event, setEvent] = useState(null);
  const [selectedPrice, setSelectedPrice] = useState(null);

  useEffect(() => {
    fetchEvent(eventId);
  }, [eventId]);

  const fetchEvent = async (id) => {
    try {
      const token = localStorage.getItem('supabase_token');
      const response = await fetch(
        `https://qqdtwekialqpakjgbonh.supabase.co/functions/v1/manage-events?action=list`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      const data = await response.json();
      const foundEvent = data.events.find(e => e.id === id);
      
      if (foundEvent) {
        setEvent(foundEvent);
        // Define o primeiro preço como padrão
        if (foundEvent.prices && foundEvent.prices.length > 0) {
          setSelectedPrice(foundEvent.prices[0]);
        }
      }
    } catch (error) {
      console.error('Erro ao buscar evento:', error);
    }
  };

  if (!event) return <div>Carregando...</div>;

  const priceOptions = event.prices?.length > 0 
    ? event.prices 
    : [{ name: 'Inteira', price: event.price }];

  return (
    <div className="ticket-selector">
      <h2>{event.title}</h2>
      <img src={event.image_url} alt={event.title} />
      
      <div className="price-options">
        {priceOptions.map((option) => (
          <label key={option.name}>
            <input
              type="radio"
              name="price"
              value={option.name}
              checked={selectedPrice?.name === option.name}
              onChange={() => setSelectedPrice(option)}
            />
            {option.name} - R$ {option.price.toFixed(2)}
          </label>
        ))}
      </div>

      {selectedPrice && (
        <div className="checkout">
          <p>Subtotal: R$ {selectedPrice.price.toFixed(2)}</p>
          {event.has_fee && (
            <p>Taxa: R$ {event.fee_amount.toFixed(2)}</p>
          )}
          <p className="total">
            Total: R$ {(selectedPrice.price + (event.has_fee ? event.fee_amount : 0)).toFixed(2)}
          </p>
          <button onClick={() => checkout(event.id, selectedPrice)}>
            Comprar Ingresso
          </button>
        </div>
      )}
    </div>
  );
}
```

---

## 6. FILTROS E QUERIES (OPCIONAL)

Se você precisar filtrar eventos por disponibilidade:

```javascript
// Buscar apenas eventos disponíveis
const availableEvents = event.filter(e => e.is_available === true);

// Se um evento não está disponível, mostrar o motivo
if (!event.is_available) {
  console.log(`Evento indisponível: ${event.unavailability_reason}`);
}
```

---

## 7. CAMPOS IMPORTANTES PARA A VENDA

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | string | ID único do evento |
| `title` | string | Nome do evento |
| `price` | number | Preço único (fallback) |
| `prices` | array | Array com múltiplos tipos: `[{name, price}, ...]` |
| `has_fee` | boolean | Se tem taxa de serviço |
| `fee_amount` | number | Valor da taxa |
| `available_tickets` | number | Quantidade total de ingressos |
| `is_available` | boolean | Se está aberto para vendas |
| `unavailability_reason` | string | Motivo se indisponível |
| `date` | ISO string | Data e hora do evento |

---

## 8. TRATAMENTO DE ERROS

```javascript
try {
  const response = await fetch(apiUrl, {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (!response.ok) {
    if (response.status === 401) {
      console.error('Token inválido - faça login novamente');
    } else if (response.status === 403) {
      console.error('Acesso negado');
    } else {
      console.error(`Erro ${response.status}`);
    }
    return;
  }

  const data = await response.json();
  console.log('Eventos carregados:', data.events);
} catch (error) {
  console.error('Erro na requisição:', error);
}
```

---

## ✅ CHECKLIST PARA IMPLEMENTAÇÃO

- [ ] Solicitar token de acesso ao Supabase
- [ ] Usar endpoint correto: `/functions/v1/manage-events?action=list`
- [ ] Verificar se `event.prices` é um array e não vazio
- [ ] Exibir múltiplas opções quando `prices.length > 0`
- [ ] Fallback para `event.price` quando não há múltiplos preços
- [ ] Mostrar `unavailability_reason` quando `is_available = false`
- [ ] Incluir `fee_amount` no total quando `has_fee = true`
- [ ] Testar com diferentes combinações de preços

---

## 📞 SUPORTE

Se precisar de ajuda:
1. Verifique os logs no console (F12)
2. Confira se o token está sendo enviado corretamente
3. Teste a API com Postman/Insomnia primeiro
4. Valide a estrutura de resposta com JSON Formatter
