import { AdminRoute } from "@/components/AdminRoute";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Heart, Shield, Zap, Users } from "lucide-react";

const About = () => {
  const navigate = useNavigate();

  return (
    <AdminRoute>
      <div className="min-h-screen bg-background">
        <header className="border-b bg-card shadow-soft">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              VN TICKET Admin
            </h1>
            <Button variant="outline" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>
          </div>
        </header>

        <main className="container mx-auto px-4 py-12 max-w-4xl">
          <div className="mb-8 text-center">
            <h2 className="text-4xl font-bold mb-4 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Quem Somos Nós
            </h2>
            <p className="text-lg text-muted-foreground">
              Conheça a história e a missão da Ticket
            </p>
          </div>

          <Card className="shadow-strong mb-8">
            <CardHeader>
              <CardTitle className="text-2xl">Nossa História</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 text-lg leading-relaxed">
              <p className="text-foreground">
                A história da Ticket é feita de evolução.
              </p>
              
              <p className="text-foreground">
                Criada em 2023 com outro nome e formada inicialmente por três sócios, a empresa passou por mudanças importantes até encontrar seu verdadeiro caminho. A sociedade foi encerrada, mas isso abriu espaço para algo maior: o renascimento de uma plataforma mais forte, mais estratégica e conduzida por uma única visão.
              </p>
              
              <p className="text-foreground">
                Hoje, a Ticket é liderada por uma pessoa que reuniu uma equipe com uma grande missão: entregar segurança, qualidade e tecnologia que conectam você aos melhores momentos.
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-strong mb-8">
            <CardHeader>
              <CardTitle className="text-2xl">Nossa Missão</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 text-lg leading-relaxed">
              <p className="text-foreground">
                Aqui, cada detalhe importa.
              </p>
              
              <p className="text-foreground">
                Cada ingresso vendido, cada experiência vivida, cada evento que você decide fazer parte.
              </p>
              
              <p className="text-foreground font-semibold text-primary">
                Somos a ponte entre o seu desejo e a sua melhor memória.
              </p>
              
              <p className="text-foreground text-xl font-bold mt-6">
                Ticket — mais do que vender ingressos, criamos conexões que ficam para sempre.
              </p>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
            <Card className="shadow-medium text-center">
              <CardHeader>
                <Shield className="h-12 w-12 text-primary mx-auto mb-4" />
                <CardTitle>Segurança</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Garantimos a segurança em cada transação e validação
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="shadow-medium text-center">
              <CardHeader>
                <Zap className="h-12 w-12 text-primary mx-auto mb-4" />
                <CardTitle>Tecnologia</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Utilizamos as melhores tecnologias para sua experiência
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="shadow-medium text-center">
              <CardHeader>
                <Heart className="h-12 w-12 text-primary mx-auto mb-4" />
                <CardTitle>Qualidade</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Comprometidos com a excelência em cada detalhe
                </CardDescription>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </AdminRoute>
  );
};

export default About;

