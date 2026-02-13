import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    if (!supabaseUrl || !supabaseKey) {
      return new Response(JSON.stringify({ error: 'Configuração inválida' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Token inválido' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { purchase_id } = await req.json();
    if (!purchase_id) {
      return new Response(JSON.stringify({ error: 'purchase_id obrigatório' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .in('role', ['admin', 'producer'])
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: 'Acesso negado' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data: purchase, error: purchaseError } = await supabase
      .from('purchases')
      .select('*')
      .eq('id', purchase_id)
      .maybeSingle();

    if (purchaseError || !purchase) {
      return new Response(JSON.stringify({ error: 'Compra não encontrada' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // If producer, ensure purchase belongs to one of their events
    if (roleData.role === 'producer') {
      const { data: event } = await supabase
        .from('events')
        .select('producer_id')
        .eq('id', purchase.event_id)
        .maybeSingle();
      if (!event || event.producer_id !== user.id) {
        return new Response(JSON.stringify({ error: 'Acesso negado' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    const status = (purchase.status || '').toString().toLowerCase();
    if (status !== 'paid') {
      return new Response(JSON.stringify({ error: 'Compra não está paga' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (Array.isArray(purchase.qr_codes) && purchase.qr_codes.length > 0) {
      return new Response(JSON.stringify({ qr_codes: purchase.qr_codes }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const quantity = Math.max(1, Number(purchase.quantity || 1));
    const qrCodes: string[] = [];

    for (let i = 0; i < quantity; i += 1) {
      const id = crypto.randomUUID();
      const payload = {
        purchase_id: purchase.id,
        id_compra: id,
        id_evento: purchase.event_id,
        id_ingresso: id,
        email: purchase.buyer_email || purchase.email || '',
        buyer_name: purchase.buyer_name || '',
        ticket_index: i + 1
      };
      qrCodes.push(btoa(JSON.stringify(payload)));
    }

    const { error: updateError } = await supabase
      .from('purchases')
      .update({ qr_codes: qrCodes })
      .eq('id', purchase.id);

    if (updateError) {
      return new Response(JSON.stringify({ error: 'Falha ao salvar QR codes' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ qr_codes: qrCodes }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error?.message || 'Erro interno' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
