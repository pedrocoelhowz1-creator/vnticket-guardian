import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface QRPayload {
  id_compra: string;
  id_evento: string;
  id_ingresso: string;
  email: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get auth token from request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ status: 'error', reason: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create client for THIS Supabase (for auth check)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify the user is authenticated
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ status: 'error', reason: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const { qrPayload, eventId } = await req.json();
    
    if (!qrPayload || !eventId) {
      return new Response(
        JSON.stringify({ status: 'invalid', reason: 'QR Code ou evento não fornecido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Validating ticket for event:', eventId);

    // Decode base64 QR payload
    let decodedPayload: QRPayload;
    try {
      const decoded = atob(qrPayload);
      decodedPayload = JSON.parse(decoded);
      console.log('Decoded payload:', decodedPayload);
    } catch (e) {
      console.error('Failed to decode QR:', e);
      return new Response(
        JSON.stringify({ status: 'invalid', reason: 'QR Code inválido ou corrompido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Usar o MESMO projeto Supabase para validar os dados (mesmas tabelas)
    // Reutilizamos o client `supabase` já criado com a SERVICE_ROLE_KEY

    // Validate event ID matches
    if (decodedPayload.id_evento !== eventId) {
      console.error('Event mismatch:', decodedPayload.id_evento, 'vs', eventId);
      
      // Log failed check-in
      await supabase.from('checkins').insert({
        id_compra: decodedPayload.id_compra,
        id_evento: eventId,
        id_ingresso: decodedPayload.id_ingresso,
        buyer_email: decodedPayload.email,
        validated_by: user.id,
        status: 'invalid',
        reason: 'Ingresso não pertence a este evento',
        qr_payload: qrPayload,
      });

      return new Response(
        JSON.stringify({ 
          status: 'invalid', 
          reason: 'Ingresso não pertence a este evento',
          data: decodedPayload 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check vendas table no mesmo banco
    const { data: venda, error: vendaError } = await supabase
      .from('vendas')
      .select('*')
      .eq('id_compra', decodedPayload.id_compra)
      .single();

    if (vendaError || !venda) {
      console.error('Venda not found:', vendaError);
      
      await supabase.from('checkins').insert({
        id_compra: decodedPayload.id_compra,
        id_evento: eventId,
        id_ingresso: decodedPayload.id_ingresso,
        buyer_email: decodedPayload.email,
        validated_by: user.id,
        status: 'invalid',
        reason: 'Ingresso não encontrado no sistema',
        qr_payload: qrPayload,
      });

      return new Response(
        JSON.stringify({ 
          status: 'invalid', 
          reason: 'Ingresso não encontrado no sistema',
          data: decodedPayload 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if already used
    if (venda.status === 'utilizado') {
      console.log('Ticket already used');
      
      await supabase.from('checkins').insert({
        id_compra: decodedPayload.id_compra,
        id_evento: eventId,
        id_ingresso: decodedPayload.id_ingresso,
        buyer_email: decodedPayload.email,
        validated_by: user.id,
        status: 'invalid',
        reason: 'Ingresso já foi utilizado',
        qr_payload: qrPayload,
      });

      return new Response(
        JSON.stringify({ 
          status: 'invalid', 
          reason: 'Ingresso já foi utilizado',
          data: { ...decodedPayload, used_at: venda.used_at } 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if cancelled
    if (venda.status === 'cancelado') {
      console.log('Ticket cancelled');
      
      await supabase.from('checkins').insert({
        id_compra: decodedPayload.id_compra,
        id_evento: eventId,
        id_ingresso: decodedPayload.id_ingresso,
        buyer_email: decodedPayload.email,
        validated_by: user.id,
        status: 'invalid',
        reason: 'Ingresso cancelado',
        qr_payload: qrPayload,
      });

      return new Response(
        JSON.stringify({ 
          status: 'invalid', 
          reason: 'Ingresso cancelado',
          data: decodedPayload 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if status is confirmado
    if (venda.status !== 'confirmado') {
      console.log('Invalid status:', venda.status);
      
      await supabase.from('checkins').insert({
        id_compra: decodedPayload.id_compra,
        id_evento: eventId,
        id_ingresso: decodedPayload.id_ingresso,
        buyer_email: decodedPayload.email,
        validated_by: user.id,
        status: 'invalid',
        reason: `Status inválido: ${venda.status}`,
        qr_payload: qrPayload,
      });

      return new Response(
        JSON.stringify({ 
          status: 'invalid', 
          reason: `Status inválido: ${venda.status}`,
          data: decodedPayload 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Cross-check with purchases table no mesmo banco
    const { data: purchase, error: purchaseError } = await supabase
      .from('purchases')
      .select('*')
      .eq('id', decodedPayload.id_ingresso)
      .single();

    if (purchaseError || !purchase) {
      console.error('Purchase not found:', purchaseError);
      
      await supabase.from('checkins').insert({
        id_compra: decodedPayload.id_compra,
        id_evento: eventId,
        id_ingresso: decodedPayload.id_ingresso,
        buyer_email: decodedPayload.email,
        validated_by: user.id,
        status: 'invalid',
        reason: 'Compra não encontrada',
        qr_payload: qrPayload,
      });

      return new Response(
        JSON.stringify({ 
          status: 'invalid', 
          reason: 'Compra não encontrada',
          data: decodedPayload 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify purchase is paid
    if (purchase.status !== 'paid') {
      console.log('Purchase not paid:', purchase.status);
      
      await supabase.from('checkins').insert({
        id_compra: decodedPayload.id_compra,
        id_evento: eventId,
        id_ingresso: decodedPayload.id_ingresso,
        buyer_email: decodedPayload.email,
        validated_by: user.id,
        status: 'invalid',
        reason: 'Pagamento não confirmado',
        qr_payload: qrPayload,
      });

      return new Response(
        JSON.stringify({ 
          status: 'invalid', 
          reason: 'Pagamento não confirmado',
          data: decodedPayload 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // All validations passed! Mark as used no mesmo banco
    const { error: updateError } = await supabase
      .from('vendas')
      .update({ 
        status: 'utilizado',
        used_at: new Date().toISOString()
      })
      .eq('id_compra', decodedPayload.id_compra);

    if (updateError) {
      console.error('Failed to mark as used:', updateError);
      // Continue anyway - ticket is valid
    }

    // Log successful check-in
    await supabase.from('checkins').insert({
      id_compra: decodedPayload.id_compra,
      id_evento: eventId,
      id_ingresso: decodedPayload.id_ingresso,
      buyer_email: decodedPayload.email,
      validated_by: user.id,
      status: 'valid',
      reason: null,
      qr_payload: qrPayload,
    });

    console.log('Ticket validated successfully');

    return new Response(
      JSON.stringify({ 
        status: 'valid',
        data: {
          ...decodedPayload,
          buyer_name: venda.buyer_name,
          quantity: purchase.quantity,
          event_name: purchase.event_name,
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ status: 'error', reason: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
