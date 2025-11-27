import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get auth token from request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({
        status: 'error',
        reason: 'Não autorizado (sem token)'
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Create client for THIS Supabase (for auth check)
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    
    if (!supabaseUrl || !supabaseKey) {
      return new Response(JSON.stringify({
        status: 'error',
        reason: 'Configuração do servidor inválida'
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify the user is authenticated
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(JSON.stringify({
        status: 'error',
        reason: 'Não autorizado (token inválido)'
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Parse request body
    const { qrPayload, eventId } = await req.json();

    if (!qrPayload || !eventId) {
      return new Response(JSON.stringify({
        status: 'invalid',
        reason: 'QR Code ou evento não fornecido'
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('Validating ticket for event:', eventId);
    console.log('QR Payload recebido:', qrPayload);

    // Tentar decodificar como Base64 JSON (formato novo) ou tratar como ID direto (formato antigo)
    let decodedPayload: any = null;
    let isLegacyFormat = false;
    let foundRecord: any = null;
    let foundInTable = '';

    try {
      // Tenta decodificar como Base64 JSON primeiro
      const decoded = atob(qrPayload);
      decodedPayload = JSON.parse(decoded);
      console.log('Decoded payload (formato novo):', decodedPayload);
    } catch (e) {
      // Se falhar, trata como formato antigo (só um ID)
      console.log('QR não é Base64 JSON, tentando como ID direto (formato antigo)');
      isLegacyFormat = true;

      // 1. Tenta em purchases por id
      const { data: purchaseById, error: purchaseError } = await supabase
        .from('purchases')
        .select('*')
        .eq('id', qrPayload)
        .maybeSingle();

      if (!purchaseError && purchaseById) {
        foundRecord = purchaseById;
        foundInTable = 'purchases';
        console.log('Encontrado em purchases por id:', purchaseById);
      } else {
        // 2. Tenta em vendas por id_compra
        const { data: vendaByCompra, error: vendaByCompraError } = await supabase
          .from('vendas')
          .select('*')
          .eq('id_compra', qrPayload)
          .maybeSingle();

        if (!vendaByCompraError && vendaByCompra) {
          foundRecord = vendaByCompra;
          foundInTable = 'vendas';
          console.log('Encontrado em vendas por id_compra:', vendaByCompra);
        } else {
          // 3. Tenta em vendas por id_ingresso
          const { data: vendaByIngresso, error: vendaByIngressoError } = await supabase
            .from('vendas')
            .select('*')
            .eq('id_ingresso', qrPayload)
            .maybeSingle();

          if (!vendaByIngressoError && vendaByIngresso) {
            foundRecord = vendaByIngresso;
            foundInTable = 'vendas';
            console.log('Encontrado em vendas por id_ingresso:', vendaByIngresso);
          } else {
            // 4. Tenta em purchases por id_compra
            const { data: purchaseByCompra, error: purchaseByCompraError } = await supabase
              .from('purchases')
              .select('*')
              .eq('id_compra', qrPayload)
              .maybeSingle();

            if (!purchaseByCompraError && purchaseByCompra) {
              foundRecord = purchaseByCompra;
              foundInTable = 'purchases';
              console.log('Encontrado em purchases por id_compra:', purchaseByCompra);
            }
          }
        }
      }

      if (!foundRecord) {
        console.error('Ingresso não encontrado com ID:', qrPayload);
        return new Response(JSON.stringify({
          status: 'invalid',
          reason: `Ingresso não encontrado no sistema. ID procurado: ${qrPayload}.`,
          data: { id: qrPayload, eventId }
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Monta o payload baseado no que foi encontrado
      if (foundInTable === 'vendas') {
        decodedPayload = {
          id_compra: foundRecord.id_compra || qrPayload,
          id_evento: foundRecord.id_evento || eventId,
          id_ingresso: foundRecord.id_ingresso || foundRecord.id || qrPayload,
          email: foundRecord.buyer_email || foundRecord.email || ''
        };
        console.log('Decoded payload (formato antigo, encontrado em vendas):', decodedPayload);
      } else {
        decodedPayload = {
          id_compra: foundRecord.id_compra || foundRecord.id || qrPayload,
          id_evento: foundRecord.id_evento || foundRecord.event_id || eventId,
          id_ingresso: foundRecord.id || qrPayload,
          email: foundRecord.email || foundRecord.buyer_email || ''
        };
        console.log('Decoded payload (formato antigo, encontrado em purchases):', decodedPayload);
      }
    }

    if (!decodedPayload) {
      return new Response(JSON.stringify({
        status: 'invalid',
        reason: 'QR Code inválido ou corrompido'
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Validate event ID matches (só se ambos estiverem preenchidos e diferentes)
    if (decodedPayload.id_evento && eventId && decodedPayload.id_evento !== eventId) {
      console.error('Event mismatch:', decodedPayload.id_evento, 'vs', eventId);
      await supabase.from('checkins').insert({
        id_compra: decodedPayload.id_compra,
        id_evento: eventId,
        id_ingresso: decodedPayload.id_ingresso,
        buyer_email: decodedPayload.email,
        validated_by: user.id,
        status: 'invalid',
        reason: 'Ingresso não pertence a este evento',
        qr_payload: qrPayload
      });

      return new Response(JSON.stringify({
        status: 'invalid',
        reason: 'Ingresso não pertence a este evento',
        data: decodedPayload
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check vendas table no mesmo banco
    let venda: any = null;

    if (isLegacyFormat && foundRecord) {
      if (foundInTable === 'vendas') {
        venda = foundRecord;
        console.log('✅ Usando registro encontrado em vendas (formato antigo):', venda);
      } else if (foundInTable === 'purchases') {
        const purchaseIdCompra = foundRecord.id_compra || foundRecord.id;
        if (purchaseIdCompra) {
          const { data: vendaFromPurchase, error: vendaFromPurchaseError } = await supabase
            .from('vendas')
            .select('*')
            .eq('id_compra', purchaseIdCompra)
            .maybeSingle();

          if (!vendaFromPurchaseError && vendaFromPurchase) {
            venda = vendaFromPurchase;
            console.log('✅ Venda encontrada a partir do purchase:', venda);
          } else {
            venda = foundRecord;
            console.log('⚠️ Usando purchase como venda (estrutura alternativa):', venda);
          }
        } else {
          venda = foundRecord;
          console.log('⚠️ Usando purchase diretamente (sem id_compra):', venda);
        }
      }
    } else {
      // Busca em vendas usando id_compra
      const { data: vendaData, error: vendaError } = await supabase
        .from('vendas')
        .select('*')
        .eq('id_compra', decodedPayload.id_compra)
        .maybeSingle();

      if (!vendaError && vendaData) {
        venda = vendaData;
        console.log('Venda encontrada por id_compra:', venda);
      } else {
        // Tenta buscar por id_ingresso
        const { data: vendaByIngresso, error: vendaByIngressoError } = await supabase
          .from('vendas')
          .select('*')
          .eq('id_ingresso', decodedPayload.id_ingresso)
          .maybeSingle();

        if (!vendaByIngressoError && vendaByIngresso) {
          venda = vendaByIngresso;
          decodedPayload.id_compra = venda.id_compra || decodedPayload.id_compra;
          decodedPayload.id_evento = venda.id_evento || decodedPayload.id_evento;
          decodedPayload.email = venda.buyer_email || venda.email || decodedPayload.email;
          console.log('Venda encontrada por id_ingresso:', venda);
        } else {
          // Se ainda não encontrou, tenta buscar pelo ID original (qrPayload)
          const { data: vendaById, error: vendaByIdError } = await supabase
            .from('vendas')
            .select('*')
            .or(`id_compra.eq.${qrPayload},id_ingresso.eq.${qrPayload},id.eq.${qrPayload}`)
            .maybeSingle();

          if (!vendaByIdError && vendaById) {
            venda = vendaById;
            decodedPayload.id_compra = venda.id_compra || decodedPayload.id_compra;
            decodedPayload.id_evento = venda.id_evento || decodedPayload.id_evento;
            decodedPayload.id_ingresso = venda.id_ingresso || venda.id || decodedPayload.id_ingresso;
            decodedPayload.email = venda.buyer_email || venda.email || decodedPayload.email;
            console.log('Venda encontrada por busca alternativa:', venda);
          }
        }
      }
    }

    // Se o id_evento não estava no payload mas está na venda, atualiza
    if (!decodedPayload.id_evento && venda?.id_evento) {
      decodedPayload.id_evento = venda.id_evento;
    }

    // Se ainda não tem id_evento, usa o eventId fornecido
    if (!decodedPayload.id_evento) {
      decodedPayload.id_evento = eventId;
    }

    // Log detalhado do que foi encontrado
    if (venda) {
      console.log('✅ Venda encontrada:', {
        id: venda.id,
        id_compra: venda.id_compra,
        id_evento: venda.id_evento,
        id_ingresso: venda.id_ingresso,
        status: venda.status,
        buyer_email: venda.buyer_email || venda.email,
        buyer_name: venda.buyer_name || venda.name,
        todas_colunas: Object.keys(venda)
      });
    }

    if (!venda) {
      console.error('Venda não encontrada após todas as tentativas');
      console.error('Dados procurados:', {
        id_compra: decodedPayload.id_compra,
        id_ingresso: decodedPayload.id_ingresso,
        qrPayload: qrPayload,
        eventId: eventId,
        decodedPayload: decodedPayload,
        isLegacyFormat: isLegacyFormat,
        foundInTable: isLegacyFormat ? foundInTable : 'n/a'
      });

      await supabase.from('checkins').insert({
        id_compra: decodedPayload.id_compra || qrPayload,
        id_evento: eventId,
        id_ingresso: decodedPayload.id_ingresso || qrPayload,
        buyer_email: decodedPayload.email,
        validated_by: user.id,
        status: 'invalid',
        reason: 'Ingresso não encontrado na tabela vendas',
        qr_payload: qrPayload
      });

      return new Response(JSON.stringify({
        status: 'invalid',
        reason: 'Ingresso não encontrado na tabela vendas. Verifique se o ID existe e se o evento está correto.',
        data: decodedPayload
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // VERIFICAR SE O INGRESSO JÁ FOI ESCANEADO (CHECK-IN JÁ REALIZADO)
    // Busca na tabela checkins por id_compra ou id_ingresso com status 'valid'
    const { data: existingCheckin, error: checkinError } = await supabase
      .from('checkins')
      .select('*')
      .or(`id_compra.eq.${decodedPayload.id_compra},id_ingresso.eq.${decodedPayload.id_ingresso}`)
      .eq('status', 'valid')
      .maybeSingle();

    if (!checkinError && existingCheckin) {
      console.log('⚠️ Ingresso já foi escaneado anteriormente:', existingCheckin);
      
      // Registra tentativa de re-escaneio
      await supabase.from('checkins').insert({
        id_compra: decodedPayload.id_compra,
        id_evento: eventId,
        id_ingresso: decodedPayload.id_ingresso,
        buyer_email: decodedPayload.email,
        validated_by: user.id,
        status: 'invalid',
        reason: 'Ingresso já foi bipado anteriormente',
        qr_payload: qrPayload
      });

      return new Response(JSON.stringify({
        status: 'invalid',
        reason: 'Ingresso já foi bipado',
        data: {
          ...decodedPayload,
          first_scanned_at: existingCheckin.created_at || existingCheckin.validated_at,
          buyer_name: venda.buyer_name || venda.name
        }
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Verifica status do ingresso (se existir o campo)
    const vendaStatus = venda.status || venda.estado || venda.situacao || '';
    const statusLower = vendaStatus.toLowerCase().trim();

    // Status que indicam que o ingresso já foi usado
    const usedStatuses = ['utilizado', 'used', 'usado', 'check-in', 'checkin'];
    if (usedStatuses.includes(statusLower)) {
      console.log('Ticket already used, status:', vendaStatus);
      await supabase.from('checkins').insert({
        id_compra: decodedPayload.id_compra,
        id_evento: eventId,
        id_ingresso: decodedPayload.id_ingresso,
        buyer_email: decodedPayload.email,
        validated_by: user.id,
        status: 'invalid',
        reason: 'Ingresso já foi utilizado',
        qr_payload: qrPayload
      });

      return new Response(JSON.stringify({
        status: 'invalid',
        reason: 'Ingresso já foi utilizado',
        data: { ...decodedPayload, used_at: venda.used_at || venda.usedAt }
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Status que indicam que o ingresso foi cancelado
    const cancelledStatuses = ['cancelado', 'cancelled', 'cancel'];
    if (cancelledStatuses.includes(statusLower)) {
      console.log('Ticket cancelled, status:', vendaStatus);
      await supabase.from('checkins').insert({
        id_compra: decodedPayload.id_compra,
        id_evento: eventId,
        id_ingresso: decodedPayload.id_ingresso,
        buyer_email: decodedPayload.email,
        validated_by: user.id,
        status: 'invalid',
        reason: 'Ingresso cancelado',
        qr_payload: qrPayload
      });

      return new Response(JSON.stringify({
        status: 'invalid',
        reason: 'Ingresso cancelado',
        data: decodedPayload
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Status válidos
    const validStatuses = ['confirmado', 'pago', 'paid', 'ativo', 'active', 'valid', 'válido', 'aprovado', 'approved'];

    if (!vendaStatus) {
      console.log('⚠️ Venda sem campo status, aceitando como válido');
    } else if (!validStatuses.includes(statusLower)) {
      console.log('❌ Invalid status:', vendaStatus, 'Status completo da venda:', venda);
      await supabase.from('checkins').insert({
        id_compra: decodedPayload.id_compra,
        id_evento: eventId,
        id_ingresso: decodedPayload.id_ingresso,
        buyer_email: decodedPayload.email,
        validated_by: user.id,
        status: 'invalid',
        reason: `Status inválido: ${vendaStatus}. Status válidos: ${validStatuses.join(', ')}`,
        qr_payload: qrPayload
      });

      return new Response(JSON.stringify({
        status: 'invalid',
        reason: `Status inválido: ${vendaStatus}. Status válidos: ${validStatuses.join(', ')}`,
        data: { ...decodedPayload, venda_status: vendaStatus, todas_colunas: Object.keys(venda) }
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Cross-check with purchases table (opcional)
    let purchase: any = null;
    const { data: purchaseData, error: purchaseError } = await supabase
      .from('purchases')
      .select('*')
      .eq('id', decodedPayload.id_ingresso)
      .maybeSingle();

    if (!purchaseError && purchaseData) {
      purchase = purchaseData;
    } else {
      const { data: purchaseByCompra, error: purchaseByCompraError } = await supabase
        .from('purchases')
        .select('*')
        .eq('id_compra', decodedPayload.id_compra)
        .maybeSingle();

      if (!purchaseByCompraError && purchaseByCompra) {
        purchase = purchaseByCompra;
      }
    }

    // Verify purchase is paid (só se purchase existir)
    if (purchase && purchase.status !== 'paid') {
      console.log('Purchase not paid:', purchase.status);
      await supabase.from('checkins').insert({
        id_compra: decodedPayload.id_compra,
        id_evento: eventId,
        id_ingresso: decodedPayload.id_ingresso,
        buyer_email: decodedPayload.email,
        validated_by: user.id,
        status: 'invalid',
        reason: 'Pagamento não confirmado',
        qr_payload: qrPayload
      });

      return new Response(JSON.stringify({
        status: 'invalid',
        reason: 'Pagamento não confirmado',
        data: decodedPayload
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Update venda status to 'utilizado'
    const updateResult = await supabase
      .from('vendas')
      .update({
        status: 'utilizado',
        used_at: new Date().toISOString()
      })
      .eq('id_compra', decodedPayload.id_compra);

    if (updateResult.error) {
      console.error('Error updating venda status:', updateResult.error);
    } else {
      console.log('✅ Status da venda atualizado para "utilizado"');
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
      qr_payload: qrPayload
    });

    console.log('✅ Check-in realizado com sucesso');

    return new Response(JSON.stringify({
      status: 'valid',
      reason: 'Ingresso válido',
      data: {
        ...decodedPayload,
        buyer_name: venda.buyer_name || venda.name || purchase?.buyer_name || purchase?.name,
        buyer_email: decodedPayload.email || venda.buyer_email || venda.email
      }
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(JSON.stringify({
      status: 'error',
      reason: 'Erro interno do servidor'
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
