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
    // Auth check
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

    // Verify user
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Token inválido' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Connect to VN Ticket Supabase
    // Keys do VN Ticket já configuradas
    const vnTicketUrl = 'https://qqdtwekialqpakjgbonh.supabase.co';
    const vnTicketKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFxZHR3ZWtpYWxxcGFramdib25oIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzA2MjI5OCwiZXhwIjoyMDc4NjM4Mjk4fQ.L2HzDsxcXHjS0RQQmvhD7nFn7v5KigkHWJqsbyoxPv4';

    const vnTicket = createClient(vnTicketUrl, vnTicketKey);
    console.log('VN Ticket client created successfully');

    const url = new URL(req.url);
    const action = url.searchParams.get('action');

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
          if (bodyText) {
            body = JSON.parse(bodyText);
          }
        } catch (e) {
          // Body vazio ou inválido, continua com objeto vazio
          console.log('No body or invalid JSON, using empty object');
        }
        
        if (action === 'list' || !action) {
          // List events via POST
          console.log('Fetching events from VN Ticket (POST)...');
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
    
    let message = 'Erro interno';
    if (error instanceof Error) {
      message = error.message;
    } else if (typeof error === 'object' && error !== null) {
      try {
        message = JSON.stringify(error);
      } catch {
        message = String(error);
      }
    } else {
      message = String(error);
    }
    
    console.error('Error message:', message);
    
    return new Response(JSON.stringify({ 
      error: message,
      details: error instanceof Error ? error.stack : undefined
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
