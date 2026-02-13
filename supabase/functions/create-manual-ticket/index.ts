import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

Deno.serve(async (req) => {
  console.log('=== CREATE MANUAL TICKET FUNCTION CALLED ===');
  console.log('Method:', req.method);
  console.log('URL:', req.url);

  if (req.method === 'OPTIONS') {
    console.log('OPTIONS request - returning CORS headers');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get('Authorization');
    console.log('Auth header present:', !!authHeader);

    if (!authHeader) {
      console.error('No authorization header');
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

    console.log('Supabase URL configured:', !!supabaseUrl);
    console.log('Supabase Key configured:', !!supabaseKey);

    if (!supabaseUrl || !supabaseKey) {
      console.error('Missing Supabase configuration');
      return new Response(JSON.stringify({ error: 'Configuração inválida' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    console.log('Supabase client created');

    // Verify user
    const token = authHeader.replace('Bearer ', '');
    console.log('Verifying user token...');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error('Auth error:', authError);
      console.error('User:', user);
      return new Response(JSON.stringify({ error: 'Token inválido' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('User authenticated:', user.id);

    // Verificar se o usuário tem role de admin ou producer
    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .in('role', ['admin', 'producer'])
      .maybeSingle();

    if (roleError || !roleData) {
      console.error('User is not admin/producer:', user.id);
      return new Response(JSON.stringify({
        error: 'Acesso negado. Apenas administradores ou produtores podem criar ingressos manuais.'
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('User is admin, proceeding with manual ticket creation...');

    // Parse request body
    const {
      event_uuid,
      buyer_name,
      buyer_phone,
      buyer_cpf,
      sale_type,
      ticket_type_name,
      ticket_type_price
    } = await req.json();

    if (!event_uuid || !buyer_name || !buyer_phone || !buyer_cpf || !sale_type) {
      return new Response(JSON.stringify({
        error: 'Todos os campos são obrigatórios'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('Creating manual ticket for event:', event_uuid);
    console.log('Sale type:', sale_type);

    // Get event details to calculate fees
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('*')
      .eq('id', event_uuid)
      .single();

    if (eventError || !event) {
      console.error('Event not found:', eventError);
      return new Response(JSON.stringify({
        error: 'Evento não encontrado'
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('Event found:', event.title);

    // Base ticket price (by type, if provided)
    const basePrice = typeof ticket_type_price === 'number' && !isNaN(ticket_type_price)
      ? ticket_type_price
      : (event.price || 0);

    // Calculate fee based on sale type
    let feeValue = 0;
    let qrCode = null;
    let saleTypeDb = '';
    let paymentStatus = '';

    // Single ticket id used across QR payload and venda ids
    const ticketId = crypto.randomUUID();

    if (sale_type === 'online_whatsapp') {
      // Apply standard fee
      feeValue = event.has_fee ? event.fee_amount : 0;
      saleTypeDb = 'manual_online';

      // Generate QR Code
      const qrPayload = {
        id_compra: ticketId,
        id_evento: event_uuid,
        id_ingresso: ticketId,
        email: `${buyer_name.replace(/\s+/g, '').toLowerCase()}@manual.com`,
        buyer_name: buyer_name,
        ticket_type: ticket_type_name || null,
        ticket_price: basePrice
      };
      qrCode = btoa(JSON.stringify(qrPayload));

      paymentStatus = 'pago';
      console.log('Online/WhatsApp sale - QR generated, fee applied:', feeValue);
    } else if (sale_type === 'presencial') {
      // Apply reduced fee (half of standard fee)
      feeValue = event.has_fee ? event.fee_amount * 0.5 : 0;
      saleTypeDb = 'manual_presencial';
      // No QR code for presencial
      qrCode = null;
      paymentStatus = 'pago_presencial';
      console.log('Presencial sale - no QR, reduced fee applied:', feeValue);
    } else {
      return new Response(JSON.stringify({
        error: 'Tipo de venda inválido'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Generate unique IDs (use same id to keep QR and venda aligned)
    const idCompra = ticketId;
    const idIngresso = ticketId;

    // Insert into vendas table
    const buyerEmail = `${buyer_name.replace(/\s+/g, '').toLowerCase()}@manual.com`;

    const vendaData = {
      id_compra: idCompra,
      id_evento: event_uuid,
      id_ingresso: idIngresso,
      buyer_name: buyer_name,
      buyer_phone: buyer_phone,
      buyer_cpf: buyer_cpf,
      buyer_email: buyerEmail,
      // Campos legados/português (alguns bancos usam estes nomes)
      nome_comprador: buyer_name,
      telefone_comprador: buyer_phone,
      cpf_comprador: buyer_cpf,
      email_comprador: buyerEmail,
      status: 'confirmado',
      payment_status: paymentStatus,
      fee_value: feeValue,
      qr_code: qrCode,
      sale_type: saleTypeDb,
      created_at: new Date().toISOString(),
      quantity: 1,
      total_amount: basePrice + feeValue
    };

    console.log('Inserting venda:', vendaData);

    const { data: venda, error: vendaError } = await supabase
      .from('vendas')
      .insert([vendaData])
      .select()
      .single();

    if (vendaError) {
      console.error('Error inserting venda:', vendaError);
      return new Response(JSON.stringify({
        error: `Erro ao criar ingresso: ${vendaError.message}`
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('✅ Manual ticket created successfully:', venda.id);

    return new Response(JSON.stringify({
      success: true,
      ticket: venda,
      message: 'Ingresso manual criado com sucesso'
    }), {
      status: 201,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    console.error('Unexpected error in create-manual-ticket:', error);

    let message = 'Erro interno do servidor';
    if (error instanceof Error) {
      message = error.message;
    }

    return new Response(JSON.stringify({
      error: message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
