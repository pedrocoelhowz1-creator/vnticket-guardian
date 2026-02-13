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
    const mpAccessToken =
      Deno.env.get('MERCADOPAGO_ACCESS_TOKEN') ||
      Deno.env.get('MP_ACCESS_TOKEN') ||
      Deno.env.get('MP_TOKEN') ||
      '';

    if (!mpAccessToken) {
      return new Response('Missing MP token', { status: 500 });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    if (!supabaseUrl || !supabaseKey) {
      return new Response('Missing Supabase config', { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const paymentId = body?.data?.id || body?.id || null;

    if (!paymentId) {
      return new Response('No payment id', { status: 200 });
    }

    const paymentRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: {
        Authorization: `Bearer ${mpAccessToken}`
      }
    });
    const payment = await paymentRes.json();

    if (!paymentRes.ok) {
      console.error('MP payment fetch error:', payment);
      return new Response('MP error', { status: 200 });
    }

    const status = (payment.status || '').toString().toLowerCase();
    const externalRef = payment.external_reference;
    const metadata = payment.metadata || {};
    const purchaseId = metadata.purchase_id || externalRef;

    if (!purchaseId) {
      return new Response('No purchase id', { status: 200 });
    }

    if (status !== 'approved') {
      return new Response('Not approved', { status: 200 });
    }

    const { data: purchase } = await supabase
      .from('purchases')
      .select('*')
      .eq('id', purchaseId)
      .maybeSingle();

    if (!purchase) {
      return new Response('Purchase not found', { status: 200 });
    }

    const quantity = Math.max(1, Number(purchase.quantity || 1));
    const existing = Array.isArray(purchase.qr_codes) ? purchase.qr_codes.filter((v: any) => typeof v === 'string') : [];

    const qrCodes: string[] = [...existing];
    for (let i = existing.length; i < quantity; i += 1) {
      const id = crypto.randomUUID();
      const payload = {
        purchase_id: purchase.id,
        id_compra: id,
        id_evento: purchase.event_id,
        id_ingresso: id,
        email: purchase.buyer_email || purchase.email || '',
        buyer_name: purchase.buyer_name || '',
        ticket_type: purchase.ticket_type || metadata.ticket_type || null,
        ticket_index: i + 1
      };
      qrCodes.push(btoa(JSON.stringify(payload)));
    }

    await supabase.from('purchases').update({
      status: 'paid',
      mp_payment_id: paymentId,
      updated_at: new Date().toISOString(),
      qr_codes: qrCodes
    }).eq('id', purchase.id);

    // Update vendas if exists
    await supabase.from('vendas').update({
      status: 'confirmado',
      payment_status: 'pago',
      qr_code: qrCodes[0] || null
    }).eq('id_compra', purchase.id);

    return new Response('OK', { status: 200 });
  } catch (error: any) {
    console.error('MP webhook error:', error);
    return new Response('Error', { status: 200 });
  }
});
