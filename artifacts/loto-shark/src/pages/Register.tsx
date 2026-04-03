import { useState } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { UserPlus, Zap } from 'lucide-react';

export default function Register() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, firstName }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Registration failed');
      }

      // Store token
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));

      toast({
        title: 'Success',
        description: 'Account created successfully!',
      });

      navigate('/');
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Registration failed',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-black/40 border-primary/30">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <Zap className="h-12 w-12 text-primary neon-glow" />
          </div>
          <CardTitle className="text-2xl neon-text text-primary">Shark Loterias</CardTitle>
          <CardDescription>Criar nova conta</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleRegister} className="space-y-4">
            <Input
              type="text"
              placeholder="Nome"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
              data-testid="input-firstName"
              className="bg-black/20"
            />
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              data-testid="input-email"
              className="bg-black/20"
            />
            <Input
              type="password"
              placeholder="Senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              data-testid="input-password"
              className="bg-black/20"
            />
            <Button
              type="submit"
              disabled={loading}
              className="w-full"
              data-testid="button-register"
            >
              <UserPlus className="h-4 w-4 mr-2" />
              {loading ? 'Criando...' : 'Criar Conta'}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            Já tem conta?{' '}
            <button
              onClick={() => navigate('/login')}
              className="text-primary hover:underline font-semibold"
              data-testid="link-login"
            >
              Entrar
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
