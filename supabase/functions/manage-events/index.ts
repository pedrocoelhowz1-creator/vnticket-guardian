import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

Deno.serve(async (req) => {
  console.log('=== EDGE FUNCTION CALLED ===');
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  console.log('Headers:', Object.fromEntries(req.headers.entries()));
  
  if (req.method === 'OPTIONS') {
    console.log('OPTIONS request - returning CORS headers');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Processing request...');
    
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
    console.log('Supabase URL value:', supabaseUrl ? supabaseUrl.substring(0, 30) + '...' : 'NOT SET');
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
      console.error('User is not admin or producer:', user.id);
      return new Response(JSON.stringify({
        error: 'Acesso negado. Apenas administradores e produtores podem acessar este sistema.',
        events: []
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const isAdmin = roleData.role === 'admin';
    const isProducer = roleData.role === 'producer';
    console.log('User role:', roleData.role, 'isAdmin:', isAdmin, 'isProducer:', isProducer);

    // Usa o mesmo Supabase (Guardian e VN Ticket são o mesmo projeto)
    // Não precisa conectar a outro banco, usa o mesmo cliente
    const vnTicket = supabase;
    console.log('Using same Supabase client (Guardian = VN Ticket)');
    console.log('Supabase URL:', supabaseUrl);

    const url = new URL(req.url);
    let action = url.searchParams.get('action');
    
    // Normaliza a action (remove espaços, converte para lowercase)
    if (action) {
      action = action.trim().toLowerCase();
    }
    
    console.log('URL completa:', req.url);
    console.log('Action parameter (raw):', url.searchParams.get('action'));
    console.log('Action parameter (normalized):', action);
    console.log('Request method:', req.method);

    switch (req.method) {
      case 'GET': {
        // List events
        console.log('Fetching events from Supabase...');
        console.log('Using same Supabase client (Guardian = VN Ticket)');
        console.log('User role - isAdmin:', isAdmin, 'isProducer:', isProducer);

        let query = vnTicket
          .from('events')
          .select('*');

        // Se for producer, filtrar apenas seus eventos
        if (isProducer) {
          query = query.eq('producer_id', user.id);
          console.log('Filtering events for producer:', user.id);
        }

        const { data, error } = await query.order('date', { ascending: true });

        if (error) {
          console.error('Error fetching events:', error);
          console.error('Error details:', JSON.stringify(error, null, 2));
          throw new Error(`Erro ao buscar eventos: ${error.message || JSON.stringify(error)}`);
        }

        console.log(`Found ${data?.length || 0} events`);
        
        return new Response(JSON.stringify({ events: data || [] }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'POST': {
        // Lê o body primeiro
        let body: any = {};
        try {
          const bodyText = await req.text();
          if (bodyText && bodyText.trim()) {
            body = JSON.parse(bodyText);
          }
        } catch (e) {
          // Body vazio ou inválido, continua com objeto vazio
          console.log('No body or invalid JSON, using empty object');
        }
        
        // Re-lê a action da URL para garantir (pode ter mudado)
        const actionFromUrl = url.searchParams.get('action');
        let normalizedAction = actionFromUrl ? String(actionFromUrl).trim().toLowerCase() : null;
        
        // Se action não foi lida, tenta usar a variável action
        if (!normalizedAction && action) {
          normalizedAction = String(action).trim().toLowerCase();
        }
        
        console.log('=== POST REQUEST ===');
        console.log('Original action variable:', action);
        console.log('Action from URL (re-read):', actionFromUrl);
        console.log('Normalized action:', normalizedAction);
        console.log('All URL params:', Object.fromEntries(url.searchParams.entries()));
        console.log('URL search:', url.search);
        
        // Define ações explícitas
        const explicitActions = ['create', 'update', 'delete'];
        const isExplicitAction = normalizedAction && explicitActions.includes(normalizedAction);
        
        console.log('isExplicitAction:', isExplicitAction);
        console.log('normalizedAction:', normalizedAction);
        
        // Se NÃO for uma ação explícita, assume que é LIST
        // Isso inclui: 'list', null, undefined, '', ou qualquer outro valor
        if (!isExplicitAction) {
          // List events via POST
          console.log('=== LISTING EVENTS (POST) ===');
          console.log('Action (original):', action);
          console.log('Action (normalized):', normalizedAction);
          console.log('isExplicitAction:', isExplicitAction);
          console.log('Using same Supabase client (Guardian = VN Ticket)');
          
          try {
            // Primeiro, testa se consegue acessar a tabela
            console.log('Attempting to query events table...');
            console.log('Supabase URL:', supabaseUrl);
            
            // Testa uma query simples primeiro
            console.log('Testing simple query...');
            const { data: testData, error: testError } = await vnTicket
              .from('events')
              .select('id')
              .limit(1);
            
            console.log('Test query result:', { data: testData, error: testError });
            
            if (testError) {
              console.error('Test query failed:', testError);
              // Tenta sem limit
              const { data: testData2, error: testError2 } = await vnTicket
                .from('events')
                .select('id');
              console.log('Test query 2 result:', { data: testData2, error: testError2 });
            }
            
            // Agora faz a query completa
            console.log('Executing full query...');
            let data, error;
            
            // Tenta com order by primeiro, mas trata campos nulos
            try {
              const queryResult = await vnTicket
                .from('events')
                .select('*')
                .order('date', { ascending: true }, { nullsFirst: false });
              
              data = queryResult.data;
              error = queryResult.error;
            } catch (orderError: any) {
              console.log('Error with order by, trying without...', orderError);
              // Se der erro com order by, tenta sem
              const queryResult2 = await vnTicket
                .from('events')
                .select('*');
              
              data = queryResult2.data;
              error = queryResult2.error;
            }
            
            // Se ainda der erro, tenta sem order by
            if (error && (error.message?.includes('column') || error.code === 'PGRST116' || error.message?.includes('null'))) {
              console.log('Error with date column, trying without order...');
              const queryResult3 = await vnTicket
                .from('events')
                .select('*');
              
              data = queryResult3.data;
              error = queryResult3.error;
            }

            console.log('Query result - Error:', error);
            console.log('Query result - Data length:', data?.length || 0);
            
            if (error) {
              console.error('Error fetching events:', error);
              console.error('Error code:', error.code);
              console.error('Error message:', error.message);
              console.error('Error details:', JSON.stringify(error, null, 2));
              
              // Se for erro de tabela não encontrada, tenta sem order
              if (error.code === 'PGRST116' || error.message?.includes('relation') || error.message?.includes('does not exist')) {
                console.log('Trying without order by...');
                let queryNoOrder = vnTicket
                  .from('events')
                  .select('*');

                if (isProducer) {
                  queryNoOrder = queryNoOrder.eq('producer_id', user.id);
                }

                const { data: dataNoOrder, error: errorNoOrder } = await queryNoOrder;

                if (errorNoOrder) {
                  return new Response(JSON.stringify({
                    error: `Tabela 'events' não encontrada no banco VN Ticket. Verifique se a tabela existe.`,
                    events: []
                  }), {
                    status: 500,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                  });
                }

                console.log(`Found ${dataNoOrder?.length || 0} events (without order)`);
                return new Response(JSON.stringify({
                  events: dataNoOrder || []
                }), {
                  status: 200,
                  headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
              }
              
              return new Response(JSON.stringify({ 
                error: `Erro ao buscar eventos: ${error.message || JSON.stringify(error)}`,
                errorCode: error.code,
                events: []
              }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
              });
            }

            console.log(`✅ Successfully found ${data?.length || 0} events`);
            
            if (!data || data.length === 0) {
              console.warn('⚠️ Nenhum evento encontrado no banco de dados');
              console.log('Isso pode significar que:');
              console.log('1. Não há eventos cadastrados no banco VN Ticket');
              console.log('2. A tabela events está vazia');
              console.log('3. Há um problema de permissões na tabela');
            } else {
              // Limpa os dados para garantir que não há problemas com campos nulos
              const cleanedData = data.map((event: any) => ({
                id: event.id || null,
                title: event.title || '',
                description: event.description || null,
                date: event.date || null,
                location: event.location || '',
                price: event.price || 0,
                available_tickets: event.available_tickets || 0,
                image_url: event.image_url || null,
                image_fit: event.image_fit || 'contain',
                category: event.category || null,
                has_fee: event.has_fee || false,
                fee_amount: event.fee_amount || 0,
                is_available: event.is_available !== undefined ? event.is_available : true,
                unavailability_reason: event.unavailability_reason || null,
                ticket_types: Array.isArray(event.ticket_types) ? event.ticket_types : [],
                producer_id: event.producer_id || null,
                created_at: event.created_at || null,
                updated_at: event.updated_at || null
              }));
              
              console.log('First event sample:', JSON.stringify(cleanedData[0], null, 2));
              console.log('All events IDs:', cleanedData.map((e: any) => e.id));
              
              const responseData = { 
                events: cleanedData,
                count: cleanedData.length
              };
              
              console.log('Returning response with', responseData.count, 'events');
              
              return new Response(JSON.stringify(responseData), {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
              });
            }
            
            const responseData = { 
              events: data || [],
              count: data?.length || 0
            };
            
            console.log('Returning response with', responseData.count, 'events');
            
            return new Response(JSON.stringify(responseData), {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          } catch (dbError: any) {
            console.error('Database error (catch):', dbError);
            console.error('Database error type:', typeof dbError);
            console.error('Database error message:', dbError?.message);
            return new Response(JSON.stringify({ 
              error: `Erro ao conectar com o banco: ${dbError.message || 'Erro desconhecido'}`,
              events: []
            }), {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
        }
        
        if (normalizedAction === 'create' || action === 'create') {
          // Apenas admins podem criar eventos
          if (!isAdmin) {
            return new Response(JSON.stringify({
              error: 'Acesso negado. Apenas administradores podem criar eventos.'
            }), {
              status: 403,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          console.log('🆕 CREATE iniciando');
          console.log('Body.ticket_types para CREATE:', body.ticket_types);
          console.log('JSON.stringify(body.ticket_types):', JSON.stringify(body.ticket_types, null, 2));

          // Calcula fee_amount como 10% do preço principal
          const mainPrice = parseFloat(String(body.price)) || 0;
          const calculatedFee = body.has_fee ? (mainPrice * 0.10) : 0;

          const { data, error } = await vnTicket
            .from('events')
            .insert([{
              title: body.title,
              description: body.description,
              date: body.date,
              location: body.location,
              price: mainPrice,
              available_tickets: parseInt(String(body.available_tickets)) || 0,
              image_url: body.image_url,
              category: body.category,
              producer_id: body.producer_id || null,
              has_fee: body.has_fee || false,
              fee_amount: calculatedFee,
              is_available: body.is_available !== undefined ? body.is_available : true,
              unavailability_reason: body.unavailability_reason || null,
              ticket_types: Array.isArray(body.ticket_types) ? body.ticket_types : [],
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }])
            .select('*')
            .single();

          if (error) {
            console.error('❌ CREATE error:', error);
            throw error;
          }
          
          console.log('✅ Event created successfully with ticket_types:', data?.ticket_types);


          return new Response(JSON.stringify({ event: data }), {
            status: 201,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        if (normalizedAction === 'update' || action === 'update') {
          const { id, ...updates } = body;
          
          console.log('🔄 UPDATE iniciando');
          console.log('Body recebido:', body);
          console.log('Body.ticket_types recebido:', body.ticket_types);
          console.log('Type de body.ticket_types:', typeof body.ticket_types);
          console.log('Is Array body.ticket_types:', Array.isArray(body.ticket_types));
          console.log('JSON.stringify(body.ticket_types):', JSON.stringify(body.ticket_types, null, 2));
          console.log('Updates após destructuring:', updates);
          console.log('Updates.ticket_types:', updates.ticket_types);
          console.log('ID extraído:', id);
          
          // Limpa campos vazios e converte para null quando apropriado
          const cleanedUpdates: any = {
            updated_at: new Date().toISOString()
          };

          if (updates.title !== undefined) cleanedUpdates.title = updates.title || '';
          if (updates.description !== undefined) cleanedUpdates.description = updates.description || null;
          if (updates.date !== undefined) cleanedUpdates.date = updates.date || null;
          if (updates.location !== undefined) cleanedUpdates.location = updates.location || '';
          if (updates.price !== undefined) cleanedUpdates.price = parseFloat(String(updates.price)) || 0;
          if (updates.available_tickets !== undefined) cleanedUpdates.available_tickets = parseInt(String(updates.available_tickets)) || 0;
          if (updates.image_url !== undefined) cleanedUpdates.image_url = updates.image_url || null;
          if (updates.category !== undefined) cleanedUpdates.category = updates.category || null;
          if (updates.has_fee !== undefined) cleanedUpdates.has_fee = updates.has_fee || false;
          // Calcula fee_amount como 10% do preço se has_fee é true
          if (updates.has_fee !== undefined || updates.price !== undefined) {
            const priceToUse = updates.price !== undefined ? parseFloat(String(updates.price)) || 0 : (body.price ? parseFloat(String(body.price)) : 0);
            cleanedUpdates.fee_amount = cleanedUpdates.has_fee ? (priceToUse * 0.10) : 0;
          }
          if (updates.is_available !== undefined) cleanedUpdates.is_available = updates.is_available;
          if (updates.unavailability_reason !== undefined) cleanedUpdates.unavailability_reason = updates.unavailability_reason || null;
          if (updates.ticket_types !== undefined) {
            console.log('🛠️ Processando ticket_types:', updates.ticket_types);
            cleanedUpdates.ticket_types = Array.isArray(updates.ticket_types) ? updates.ticket_types : [];
            console.log('🛠️ Tipos de ingresso após limpeza:', cleanedUpdates.ticket_types);
          }
          
          console.log('📝 cleanedUpdates final:', cleanedUpdates);
          console.log('📝 cleanedUpdates.ticket_types:', cleanedUpdates.ticket_types);
          
          console.log('Updating event:', id);
          console.log('Updates:', cleanedUpdates);
          
          const { data, error } = await vnTicket
            .from('events')
            .update(cleanedUpdates)
            .eq('id', id)
            .select('*')
            .single();

          console.log('🔴 Query result:', { data, error });
          console.log('🔴 Data após update:', data);
          console.log('🔴 Data.ticket_types após update:', data?.ticket_types);

          if (error) {
            console.error('❌ Update error:', error);
            console.error('❌ Error code:', (error as any).code);
            console.error('❌ Error message:', error.message);
            console.error('❌ Full error:', JSON.stringify(error));
            throw error;
          }

          console.log('✅ Event updated successfully:', data?.id);
          console.log('✅ Tipos de ingresso salvos:', data?.ticket_types);
          return new Response(JSON.stringify({ event: data }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        if (normalizedAction === 'delete' || action === 'delete') {
          // Apenas admins podem excluir eventos
          if (!isAdmin) {
            return new Response(JSON.stringify({
              error: 'Acesso negado. Apenas administradores podem excluir eventos.'
            }), {
              status: 403,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          const { id } = body;

          const { error } = await vnTicket
            .from('events')
            .delete()
            .eq('id', id);

          if (error) throw error;

          return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        console.error('=== AÇÃO INVÁLIDA ===');
        console.error('Action recebida:', action);
        console.error('Tipo da action:', typeof action);
        console.error('Action === "list":', action === 'list');
        console.error('Action é null/undefined:', action === null || action === undefined);
        console.error('URL completa:', req.url);
        console.error('Search params:', url.searchParams.toString());
        console.error('Body recebido:', body);
        console.error('Todas as search params:', Object.fromEntries(url.searchParams.entries()));
        
        // Última tentativa: se action não foi reconhecida mas é POST, tenta listar mesmo assim
        if (req.method === 'POST' && !action) {
          console.log('Action vazia em POST, tratando como list...');
          // Chama a lógica de listagem diretamente
          try {
            const { data, error } = await vnTicket
              .from('events')
              .select('*');
            
            if (error) {
              return new Response(JSON.stringify({ 
                error: `Erro ao buscar eventos: ${error.message}`,
                events: []
              }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
              });
            }
            
            return new Response(JSON.stringify({ 
              events: data || [] 
            }), {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          } catch (e: any) {
            return new Response(JSON.stringify({ 
              error: `Erro: ${e.message}`,
              events: []
            }), {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
        }
        
        return new Response(JSON.stringify({ 
          error: `Ação inválida: "${action}". Ações válidas: list, create, update, delete`,
          receivedAction: action,
          url: req.url,
          searchParams: Object.fromEntries(url.searchParams.entries()),
          events: []
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      default:
        return new Response(JSON.stringify({ error: 'Método não permitido' }), {
          status: 405,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
  } catch (error: unknown) {
    console.error('Error in manage-events function:', error);
    
    let message = 'Erro interno do servidor';
    let details: string | undefined = undefined;
    
    if (error instanceof Error) {
      message = error.message || 'Erro desconhecido';
      details = error.stack || undefined;
    } else if (typeof error === 'object' && error !== null) {
      try {
        const errorObj = error as any;
        message = errorObj.message || errorObj.error || JSON.stringify(error);
        details = errorObj.details || errorObj.stack;
      } catch {
        message = String(error);
      }
    } else {
      message = String(error);
    }
    
    console.error('Error message:', message);
    if (details) {
      console.error('Error details:', details);
    }
    
    return new Response(JSON.stringify({ 
      error: message,
      events: []
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
