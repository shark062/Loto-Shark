
import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Send, Bot, User, Sparkles, TrendingUp, Award } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  tickets?: number[][];
  trace?: any;
  timestamp: Date;
}

export default function AIChat({ lotteryId, context }: { lotteryId: string; context?: any }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [persona, setPersona] = useState<'analista' | 'lek' | 'coach'>('analista');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      role: 'user',
      content: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: 'guest-user',
          message: input,
          context: { lotteryId, ...context },
          persona
        })
      });

      const data = await response.json();

      const assistantMessage: Message = {
        role: 'assistant',
        content: data.reply,
        tickets: data.tickets,
        trace: data.trace,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Erro no chat:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '❌ Erro ao processar mensagem. Tente novamente.',
        timestamp: new Date()
      }]);
    } finally {
      setLoading(false);
    }
  };

  const quickActions = [
    { label: 'Gerar 3 jogos', action: 'Gerar 3 jogos balanceados' },
    { label: 'Análise profunda', action: 'Fazer análise profunda dos padrões' },
    { label: 'Comparar IAs', action: 'Comparar previsões das IAs' },
    { label: 'Melhor estratégia', action: 'Qual a melhor estratégia agora?' }
  ];

  return (
    <Card className="w-full h-[600px] flex flex-col">
      <CardHeader className="border-b">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            Assistente IA Híbrida
          </CardTitle>
          <Tabs value={persona} onValueChange={(v: any) => setPersona(v)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="analista">
                <TrendingUp className="h-4 w-4 mr-1" />
                Analista
              </TabsTrigger>
              <TabsTrigger value="lek">
                <Sparkles className="h-4 w-4 mr-1" />
                Lek
              </TabsTrigger>
              <TabsTrigger value="coach">
                <Award className="h-4 w-4 mr-1" />
                Coach
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-4 gap-4 overflow-hidden">
        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-4">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg p-3 ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-800'
                  }`}
                >
                  <div className="flex items-start gap-2 mb-2">
                    {msg.role === 'assistant' ? (
                      <Bot className="h-4 w-4 mt-1" />
                    ) : (
                      <User className="h-4 w-4 mt-1" />
                    )}
                    <div className="flex-1">
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                      
                      {msg.tickets && msg.tickets.length > 0 && (
                        <div className="mt-3 space-y-2">
                          {msg.tickets.map((ticket, i) => (
                            <Badge key={i} variant="outline" className="mr-2">
                              [{ticket.join(', ')}]
                            </Badge>
                          ))}
                        </div>
                      )}

                      {msg.trace && (
                        <details className="mt-2 text-xs opacity-70">
                          <summary className="cursor-pointer">Ver detalhes técnicos</summary>
                          <pre className="mt-2 p-2 bg-black/20 rounded overflow-x-auto">
                            {JSON.stringify(msg.trace, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  </div>
                  <span className="text-xs opacity-50">
                    {msg.timestamp.toLocaleTimeString()}
                  </span>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <Bot className="h-4 w-4 animate-pulse" />
                    <span className="text-sm">Pensando...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={scrollRef} />
          </div>
        </ScrollArea>

        <div className="space-y-2">
          <div className="flex gap-2 flex-wrap">
            {quickActions.map((qa, idx) => (
              <Button
                key={idx}
                variant="outline"
                size="sm"
                onClick={() => {
                  setInput(qa.action);
                  setTimeout(() => sendMessage(), 100);
                }}
              >
                {qa.label}
              </Button>
            ))}
          </div>

          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
              placeholder="Digite sua mensagem..."
              disabled={loading}
            />
            <Button onClick={sendMessage} disabled={loading || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
