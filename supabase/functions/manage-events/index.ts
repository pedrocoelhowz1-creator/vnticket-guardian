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
    const action = url.searchParams.get('action');
    
    console.log('Action parameter:', action);
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
        if (action === 'list' || action === null || action === undefined) {
          // List events via POST
          console.log('=== LISTING EVENTS ===');
          console.log('Action:', action);
          console.log('VN Ticket URL:', vnTicketUrl);
          console.log('VN Ticket Key configured:', vnTicketKey ? 'Yes' : 'No');
          
          try {
            // Primeiro, testa se consegue acessar a tabela
            console.log('Attempting to query events table...');
            
            const { data, error } = await vnTicket
              .from('events')
              .select('*')
              .order('date', { ascending: true });

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
            if (data && data.length > 0) {
              console.log('First event sample:', JSON.stringify(data[0], null, 2));
            }
            
            return new Response(JSON.stringify({ 
              events: data || [] 
            }), {
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
          
          const { data, error } = await vnTicket
            .from('events')
            .update({
              ...updates,
              updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();

          if (error) throw error;

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

        return new Response(JSON.stringify({ error: 'Ação inválida' }), {
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
