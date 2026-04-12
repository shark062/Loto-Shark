import { useState, useEffect, useRef } from 'react';
import Navigation from '@/components/Navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, Bot, User, Mic, MicOff, Volume2, VolumeX, Copy, Flame, Sun, Snowflake } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useVoice } from '@/hooks/useVoice';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  visualizations?: any[];
  suggestions?: string[];
  persona?: string;
  timestamp: Date;
}

export default function AIAssistant() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: '👋 Olá! Sou o assistente inteligente da **Shark Loterias**!\n\nPosso te ajudar a:\n\n🎲 Gerar jogos inteligentes\n🔥 Mostrar mapas de calor\n📊 Fazer análises completas\n🔮 Ver predições\n📈 Conferir resultados\n\nComo posso te ajudar hoje?',
      suggestions: ['Gerar 3 jogos para mega-sena', 'Mostrar mapa de calor', 'Ver predições', 'Analisar quina'],
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [currentPersona, setCurrentPersona] = useState<'normal' | 'lek_do_black'>('normal');
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const { startListening, stopListening, speak, stopSpeaking, isListening, isSpeaking } = useVoice();

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (voiceEnabled && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.role === 'assistant') {
        speak(lastMessage.content);
      }
    }
  }, [voiceEnabled, messages]);

  const sendMessage = async (text?: string) => {
    const messageText = text || input;
    if (!messageText.trim()) return;

    const userMessage: Message = {
      role: 'user',
      content: messageText,
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
          message: messageText,
          context: {}
        })
      });

      if (!response.ok) {
        throw new Error('Falha na comunicação');
      }

      const reader = response.body?.getReader();
      let fullReply = '';
      let accumulatedContent = '';

      while (true) {
        const { done, value } = await reader!.read();
        if (done) break;

        const chunk = new TextDecoder().decode(value);
        fullReply += chunk;
        accumulatedContent += chunk;

        setMessages(prev => {
          const lastMessageIndex = prev.length - 1;
          if (lastMessageIndex >= 0 && prev[lastMessageIndex].role === 'assistant') {
            const updatedMessages = [...prev];
            updatedMessages[lastMessageIndex] = {
              ...updatedMessages[lastMessageIndex],
              content: accumulatedContent
            };
            return updatedMessages;
          }
          return [...prev, { role: 'assistant', content: accumulatedContent, timestamp: new Date() }];
        });
      }

      const data = JSON.parse(fullReply); // Assuming the final response is JSON with other fields

      const assistantMessage: Message = {
        role: 'assistant',
        content: data.reply || accumulatedContent, // Use reply if available, otherwise use accumulated content
        visualizations: data.visualizations,
        suggestions: data.suggestions,
        persona: data.persona,
        timestamp: new Date()
      };

      setMessages(prev => {
        const updatedMessages = [...prev];
        // Replace the streaming message with the final structured message
        if (updatedMessages.length > 0 && updatedMessages[updatedMessages.length - 1].role === 'assistant') {
          updatedMessages[updatedMessages.length - 1] = assistantMessage;
        } else {
          updatedMessages.push(assistantMessage);
        }
        return updatedMessages;
      });


      // Detectar mudança automática de persona
      if (data.persona && data.persona !== currentPersona) {
        setCurrentPersona(data.persona);
        toast({
          title: data.persona === 'lek_do_black' ? '💸 Modo Lek do Black ativado!' : '🧠 Modo Normal ativado',
          description: data.persona === 'lek_do_black'
            ? 'Agora tô falando na linguagem da quebrada!'
            : 'Voltando ao modo técnico e educado.'
        });
      }
    } catch (error) {
      console.error('Erro no chat:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '❌ Erro ao processar mensagem. Tente novamente!',
        timestamp: new Date()
      }]);
      toast({
        title: 'Erro',
        description: 'Não foi possível processar sua mensagem.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVoiceInput = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening(
        (text) => {
          setInput(text);
          toast({
            title: '🎤 Capturado',
            description: text
          });
        },
        (error) => {
          toast({
            title: 'Erro de Voz',
            description: error,
            variant: 'destructive'
          });
        }
      );
    }
  };

  const toggleVoiceOutput = () => {
    if (isSpeaking) {
      stopSpeaking();
    }
    setVoiceEnabled(!voiceEnabled);
    toast({
      title: voiceEnabled ? '🔇 Voz desativada' : '🔊 Voz ativada',
      description: voiceEnabled ? 'As respostas não serão faladas' : 'As respostas serão faladas em voz alta'
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copiado!',
      description: 'Texto copiado para área de transferência'
    });
  };

  const renderVisualization = (viz: any) => {
    switch (viz.type) {
      case 'games':
        return (
          <div className="bg-black/20 rounded-lg p-4 my-3">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-white">🎲 {viz.content.lottery}</h4>
              <Badge variant="secondary">{viz.content.strategy}</Badge>
            </div>
            <div className="space-y-2">
              {viz.content.games.map((game: number[], idx: number) => (
                <div key={idx} className="flex items-center justify-between bg-black/30 rounded p-3">
                  <div className="flex gap-2 flex-wrap">
                    {game.map((num: number) => (
                      <Badge
                        key={num}
                        className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold bg-gradient-to-r from-cyan-500 to-purple-500 text-white"
                      >
                        {num.toString().padStart(2, '0')}
                      </Badge>
                    ))}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copyToClipboard(game.join(' - '))}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        );

      case 'heatmap':
        return (
          <div className="bg-black/20 rounded-lg p-4 my-3">
            <h4 className="font-semibold text-white mb-3">🔥 Mapa de Calor - {viz.content.lottery}</h4>
            <div className="grid grid-cols-10 gap-1 mb-4">
              {Array.from({ length: viz.content.maxNumbers }, (_, i) => {
                const number = i + 1;
                const freq = viz.content.frequencies.find((f: any) => f.number === number);
                const temp = freq?.temperature || 'cold';

                const colors = {
                  hot: 'bg-red-500',
                  warm: 'bg-yellow-500',
                  cold: 'bg-blue-500'
                };

                return (
                  <div
                    key={number}
                    className={`aspect-square ${colors[temp as keyof typeof colors]} rounded-lg flex items-center justify-center text-white text-xs font-bold`}
                    title={`${number} - ${temp}`}
                  >
                    {number}
                  </div>
                );
              })}
            </div>
            <div className="flex justify-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Flame className="h-4 w-4 text-red-500" />
                <span>Quentes: {viz.content.stats.hot}</span>
              </div>
              <div className="flex items-center gap-2">
                <Sun className="h-4 w-4 text-yellow-500" />
                <span>Mornos: {viz.content.stats.warm}</span>
              </div>
              <div className="flex items-center gap-2">
                <Snowflake className="h-4 w-4 text-blue-500" />
                <span>Frios: {viz.content.stats.cold}</span>
              </div>
            </div>
          </div>
        );

      case 'analysis':
        return (
          <div className="bg-black/20 rounded-lg p-4 my-3">
            <h4 className="font-semibold text-white mb-3">📊 Análise - {viz.content.lottery}</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h5 className="text-sm font-medium text-gray-400 mb-2">Mais Frequentes</h5>
                <div className="flex flex-wrap gap-1">
                  {viz.content.mostFrequent.slice(0, 5).map((f: any) => (
                    <Badge key={f.number} className="bg-red-500 text-white">
                      {f.number}
                    </Badge>
                  ))}
                </div>
              </div>
              <div>
                <h5 className="text-sm font-medium text-gray-400 mb-2">Menos Frequentes</h5>
                <div className="flex flex-wrap gap-1">
                  {viz.content.leastFrequent.slice(0, 5).map((f: any) => (
                    <Badge key={f.number} className="bg-blue-500 text-white">
                      {f.number}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-4 text-sm text-gray-300">
              {viz.content.sequences.length > 0 && (
                <p>🔗 Sequências detectadas: {viz.content.sequences.length}</p>
              )}
              <p>📈 Sorteios analisados: {viz.content.totalAnalyzed}</p>
            </div>
          </div>
        );

      case 'comparison':
        return (
          <div className="bg-black/20 rounded-lg p-4 my-3">
            <h4 className="font-semibold text-white mb-3">📊 Comparação de Modalidades</h4>
            <div className="space-y-2">
              {viz.content.comparison.map((c: any) => (
                <div key={c.id} className="bg-black/30 rounded p-3">
                  <div className="flex items-center justify-between mb-2">
                    <h5 className="font-medium">{c.name}</h5>
                    <Badge variant="outline">{c.hotNumbers} quentes</Badge>
                  </div>
                  <p className="text-xs text-gray-400">
                    {c.minNumbers}-{c.maxNumbers} números de {c.totalNumbers}
                  </p>
                </div>
              ))}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900">
      <Navigation />

      <div className="container mx-auto px-4 py-8">
        <Card className="max-w-4xl mx-auto h-[calc(100vh-12rem)] flex flex-col bg-gray-800/50 backdrop-blur border-cyan-500/30">
          <CardHeader className="border-b border-cyan-500/30">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <CardTitle className="flex items-center gap-2 text-2xl">
                  <Bot className="h-6 w-6 text-cyan-400" />
                  {currentPersona === 'lek_do_black' ? (
                    <span className="text-yellow-400">💸 Lek do Black</span>
                  ) : (
                    <span className="text-cyan-400">🧠 Shark Assistant</span>
                  )}
                </CardTitle>
                <CardDescription className="text-gray-300 flex items-center gap-2">
                  {currentPersona === 'lek_do_black'
                    ? 'Modo agressivo detectado automaticamente - Bora ganhar grana!'
                    : 'Assistente IA com análise avançada de loterias'}
                  <Badge variant="outline" className={currentPersona === 'lek_do_black' ? 'border-yellow-500 text-yellow-400' : 'border-cyan-500 text-cyan-400'}>
                    Auto
                  </Badge>
                </CardDescription>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleVoiceInput}
                  className={isListening ? 'bg-red-500/20 border-red-500 animate-pulse' : ''}
                >
                  {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </Button>

                <Button
                  variant="outline"
                  size="icon"
                  onClick={toggleVoiceOutput}
                  className={voiceEnabled ? 'bg-green-500/20 border-green-500' : ''}
                >
                  {voiceEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                </Button>
              </div>
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
                      className={`max-w-[80%] rounded-lg p-4 ${
                        msg.role === 'user'
                          ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white'
                          : msg.persona === 'lek_do_black'
                          ? 'bg-gradient-to-r from-yellow-600 to-orange-600 text-white'
                          : 'bg-gray-700/50 text-gray-100'
                      }`}
                    >
                      <div className="flex items-start gap-2 mb-2">
                        {msg.role === 'assistant' ? (
                          <Bot className="h-5 w-5 mt-1" />
                        ) : (
                          <User className="h-5 w-5 mt-1" />
                        )}
                        <div className="flex-1 prose prose-invert max-w-none">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            rehypePlugins={[rehypeHighlight]}
                          >
                            {msg.content}
                          </ReactMarkdown>

                          {msg.suggestions && msg.suggestions.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {msg.suggestions.map((suggestion, i) => (
                                <Badge
                                  key={i}
                                  variant="outline"
                                  className="cursor-pointer hover:bg-white/10"
                                  onClick={() => {
                                    setInput(suggestion);
                                    setTimeout(() => sendMessage(suggestion), 100);
                                  }}
                                >
                                  {suggestion}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      <span className="text-xs opacity-50">
                        {msg.timestamp.toLocaleTimeString('pt-BR')}
                      </span>
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex justify-start">
                    <div className="bg-gray-700/50 rounded-lg p-4">
                      <div className="flex items-center gap-2">
                        <Bot className="h-5 w-5 animate-pulse text-cyan-400" />
                        <span className="text-sm text-gray-300">
                          {currentPersona === 'lek_do_black' ? 'Processando mano...' : 'Pensando...'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={scrollRef} />
              </div>
            </ScrollArea>

            <div className="flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && !loading && sendMessage()}
                placeholder={
                  currentPersona === 'lek_do_black'
                    ? 'Manda a braba aí mano...'
                    : 'Digite sua mensagem...'
                }
                disabled={loading}
                className="bg-gray-700/50 border-cyan-500/30 text-white placeholder:text-gray-400"
              />
              <Button
                onClick={() => sendMessage()}
                disabled={loading || !input.trim()}
                className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}