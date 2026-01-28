# Multiple Ticket Prices Feature

## Implementado com sucesso ✅

### O que foi adicionado:

#### 1. **Database Schema** (`20260128000000_add_multiple_prices_to_events.sql`)
```sql
ALTER TABLE public.events ADD COLUMN prices JSONB DEFAULT '[]'::jsonb;
CREATE INDEX idx_events_prices ON public.events USING GIN(prices);
```
- Novo campo `prices` que armazena array JSON de tipos de ingressos
- Cada tipo tem: `{ name: string, price: number }`
- Exemplo: `[{ "name": "Pista", "price": 30 }, { "name": "Camarote", "price": 60 }]`

#### 2. **React Frontend** (`src/pages/Events.tsx`)
- Nova interface `PriceOption` com fields `name` e `price`
- Campo `prices: PriceOption[]` adicionado ao `Event` e `EventFormData`
- **Três novas funções:**
  - `handleAddPrice()` - Adiciona novo tipo de ingresso
  - `handleRemovePrice()` - Remove um tipo de ingresso
  - `handleUpdatePrice()` - Atualiza nome ou preço de um tipo

- **UI Nova:**
  - Seção "Tipos de Ingressos (Opcional)" no formulário
  - Botão "+ Adicionar" para adicionar novo tipo
  - Para cada tipo: campos de Nome e Preço + botão Remover
  - Aviso amigável: "💡 Adicione diferentes categorias de ingressos..."

#### 3. **Backend Edge Function** (`supabase/functions/manage-events/index.ts`)
- **CREATE Action:** 
  - Novo campo: `prices: Array.isArray(body.prices) ? body.prices : []`
  
- **UPDATE Action:**
  - Novo campo: `if (updates.prices !== undefined) cleanedUpdates.prices = Array.isArray(updates.prices) ? updates.prices : []`

### Como Funciona:

1. **Usuário edita um evento** → Clica em "Editar"
2. **Preços existentes carregam** automaticamente (se houver)
3. **Adiciona novos preços** → Clica "+ Adicionar" na seção de tipos de ingressos
4. **Preenche nome e preço** → Ex: "Pista" = R$ 30
5. **Salva o evento** → Os preços são enviados junto com os outros dados
6. **Backend salva** na tabela `events` coluna `prices` como JSON
7. **Site de vendas acessa** os múltiplos preços via API

### Exemplo de Estrutura Salva:

```json
{
  "id": "123",
  "title": "Show XYZ",
  "price": 30,
  "available_tickets": 200,
  "prices": [
    { "name": "Pista", "price": 30 },
    { "name": "Camarote", "price": 60 },
    { "name": "VIP", "price": 100 }
  ]
}
```

### Próximos Passos (para site de vendas):

1. Consultar endpoint da API
2. Se `prices` array não está vazio → Mostrar múltiplas opções
3. Se está vazio → Usar o `price` padrão do evento
4. Cada tipo de ingresso pode ter sua própria quantidade controlada

### Status: ✅ Pronto para Produção

Todas as mudanças foram commitadas ao GitHub em: `866490e`
