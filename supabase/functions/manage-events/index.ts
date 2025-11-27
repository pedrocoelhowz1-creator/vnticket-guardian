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

    // Connect to VN Ticket Supabase
    // Keys do VN Ticket já configuradas
    const vnTicketUrl = 'https://qqdtwekialqpakjgbonh.supabase.co';
    const vnTicketKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFxZHR3ZWtpYWxxcGFramdib25oIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzA2MjI5OCwiZXhwIjoyMDc4NjM4Mjk4fQ.L2HzDsxcXHjS0RQQmvhD7nFn7v5KigkHWJqsbyoxPv4';

    const vnTicket = createClient(vnTicketUrl, vnTicketKey, {
      auth: {
        persistSession: false
      }
    });
    console.log('VN Ticket client created successfully');
    console.log('VN Ticket URL:', vnTicketUrl);

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
        console.log('Fetching events from VN Ticket...');
        console.log('VN Ticket URL:', vnTicketUrl ? 'configured' : 'missing');
        
        const { data, error } = await vnTicket
          .from('events')
          .select('*')
          .order('date', { ascending: true });

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
        
        // Se action for 'list' ou não houver action, lista eventos
        // Action já foi normalizada acima
        console.log('Checking action in POST:', action);
        console.log('Action type:', typeof action);
        console.log('Action === "list":', action === 'list');
        console.log('Action is falsy:', !action);
        
        if (action === 'list' || !action) {
          // List events via POST
          console.log('=== LISTING EVENTS ===');
          console.log('Action:', action);
          console.log('VN Ticket URL:', vnTicketUrl);
          console.log('VN Ticket Key configured:', vnTicketKey ? 'Yes' : 'No');
          
          try {
            // Primeiro, testa se consegue acessar a tabela
            console.log('Attempting to query events table...');
            console.log('VN Ticket URL:', vnTicketUrl);
            console.log('VN Ticket Key (first 20 chars):', vnTicketKey.substring(0, 20) + '...');
            
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
                const { data: dataNoOrder, error: errorNoOrder } = await vnTicket
                  .from('events')
                  .select('*');
                
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
                category: event.category || null,
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
        
        if (action === 'create') {
          const { data, error } = await vnTicket
            .from('events')
            .insert([{
              title: body.title,
              description: body.description,
              date: body.date,
              location: body.location,
              price: body.price,
              available_tickets: body.available_tickets,
              image_url: body.image_url,
              category: body.category,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }])
            .select()
            .single();

          if (error) throw error;

          return new Response(JSON.stringify({ event: data }), {
            status: 201,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        if (action === 'update') {
          const { id, ...updates } = body;
          
          // Limpa campos vazios e converte para null quando apropriado
          const cleanedUpdates: any = {
            updated_at: new Date().toISOString()
          };
          
          if (updates.title !== undefined) cleanedUpdates.title = updates.title || '';
          if (updates.description !== undefined) cleanedUpdates.description = updates.description || null;
          if (updates.date !== undefined) cleanedUpdates.date = updates.date || null;
          if (updates.location !== undefined) cleanedUpdates.location = updates.location || '';
          if (updates.price !== undefined) cleanedUpdates.price = updates.price || 0;
          if (updates.available_tickets !== undefined) cleanedUpdates.available_tickets = updates.available_tickets || 0;
          if (updates.image_url !== undefined) cleanedUpdates.image_url = updates.image_url || null;
          if (updates.category !== undefined) cleanedUpdates.category = updates.category || null;
          
          console.log('Updating event:', id);
          console.log('Updates:', cleanedUpdates);
          
          const { data, error } = await vnTicket
            .from('events')
            .update(cleanedUpdates)
            .eq('id', id)
            .select()
            .single();

          if (error) {
            console.error('Update error:', error);
            throw error;
          }

          console.log('Event updated successfully:', data?.id);
          return new Response(JSON.stringify({ event: data }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        if (action === 'delete') {
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

        console.error('Ação inválida recebida:', action);
        console.error('Tipo da action:', typeof action);
        console.error('Body recebido:', body);
        return new Response(JSON.stringify({ 
          error: `Ação inválida: "${action}". Ações válidas: list, create, update, delete`,
          receivedAction: action,
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
    let details = undefined;
    
    if (error instanceof Error) {
      message = error.message || 'Erro desconhecido';
      details = error.stack;
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
