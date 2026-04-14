
/**
 * 🎛️ CONTROLES DO ALGORITMO GENÉTICO
 * 
 * Interface para ajustar parâmetros do GA em tempo real
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Slider } from './ui/slider';
import { Button } from './ui/button';
import { useMutation } from '@tanstack/react-query';

interface GAParams {
  populationSize: number;
  generations: number;
  mutationRate: number;
  elitePercent: number;
}

interface GAControlsProps {
  lotteryId: string;
  numbersCount: number;
  onGamesGenerated: (games: any[]) => void;
}

export function GAControls({ lotteryId, numbersCount, onGamesGenerated }: GAControlsProps) {
  const [params, setParams] = useState<GAParams>({
    populationSize: 200,
    generations: 100,
    mutationRate: 0.15,
    elitePercent: 0.1
  });

  const [gamesCount, setGamesCount] = useState(5);

  const generateMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/games/generate-ga', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lotteryId,
          numbersCount,
          gamesCount,
          gaParams: params
        })
      });

      if (!response.ok) throw new Error('Falha ao gerar jogos');
      return response.json();
    },
    onSuccess: (data) => {
      onGamesGenerated(data.games);
    }
  });

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="text-2xl">🧬</span>
          Algoritmo Genético - Parâmetros
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Tamanho da População */}
        <div className="space-y-2">
          <label className="text-sm font-medium flex justify-between">
            <span>População</span>
            <span className="text-primary">{params.populationSize}</span>
          </label>
          <Slider
            value={[params.populationSize]}
            onValueChange={([value]) => setParams({ ...params, populationSize: value })}
            min={50}
            max={500}
            step={50}
            className="w-full"
          />
          <p className="text-xs text-muted-foreground">
            Número de jogos em cada geração (maior = melhor qualidade, mas mais lento)
          </p>
        </div>

        {/* Gerações */}
        <div className="space-y-2">
          <label className="text-sm font-medium flex justify-between">
            <span>Gerações</span>
            <span className="text-primary">{params.generations}</span>
          </label>
          <Slider
            value={[params.generations]}
            onValueChange={([value]) => setParams({ ...params, generations: value })}
            min={20}
            max={200}
            step={20}
            className="w-full"
          />
          <p className="text-xs text-muted-foreground">
            Ciclos de evolução (mais gerações = convergência melhor)
          </p>
        </div>

        {/* Taxa de Mutação */}
        <div className="space-y-2">
          <label className="text-sm font-medium flex justify-between">
            <span>Taxa de Mutação</span>
            <span className="text-primary">{(params.mutationRate * 100).toFixed(0)}%</span>
          </label>
          <Slider
            value={[params.mutationRate * 100]}
            onValueChange={([value]) => setParams({ ...params, mutationRate: value / 100 })}
            min={5}
            max={30}
            step={5}
            className="w-full"
          />
          <p className="text-xs text-muted-foreground">
            Probabilidade de alteração aleatória (diversidade vs estabilidade)
          </p>
        </div>

        {/* Elite */}
        <div className="space-y-2">
          <label className="text-sm font-medium flex justify-between">
            <span>Elite Preservada</span>
            <span className="text-primary">{(params.elitePercent * 100).toFixed(0)}%</span>
          </label>
          <Slider
            value={[params.elitePercent * 100]}
            onValueChange={([value]) => setParams({ ...params, elitePercent: value / 100 })}
            min={5}
            max={20}
            step={5}
            className="w-full"
          />
          <p className="text-xs text-muted-foreground">
            Percentual dos melhores jogos mantidos intactos
          </p>
        </div>

        {/* Número de Jogos */}
        <div className="space-y-2">
          <label className="text-sm font-medium flex justify-between">
            <span>Jogos a Gerar</span>
            <span className="text-primary">{gamesCount}</span>
          </label>
          <Slider
            value={[gamesCount]}
            onValueChange={([value]) => setGamesCount(value)}
            min={1}
            max={20}
            step={1}
            className="w-full"
          />
        </div>

        {/* Botão Gerar */}
        <Button
          onClick={() => generateMutation.mutate()}
          disabled={generateMutation.isPending}
          className="w-full"
          size="lg"
        >
          {generateMutation.isPending ? (
            <>
              <span className="animate-spin mr-2">⚙️</span>
              Gerando...
            </>
          ) : (
            <>
              <span className="mr-2">🎲</span>
              Gerar Jogos com GA
            </>
          )}
        </Button>

        {generateMutation.isError && (
          <p className="text-sm text-destructive">
            Erro ao gerar jogos. Tente novamente.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
