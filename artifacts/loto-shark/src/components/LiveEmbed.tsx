
interface LiveEmbedProps {
  channelId: string;
}

export default function LiveEmbed({ channelId }: LiveEmbedProps) {
  const url = `https://www.youtube.com/embed/live_stream?channel=${channelId}`;

  return (
    <div className="w-full h-full min-h-[300px] rounded-lg overflow-hidden border border-border/20 bg-black/40 backdrop-blur-sm">
      <iframe
        className="w-full h-full min-h-[300px]"
        src={url}
        frameBorder="0"
        allow="autoplay; encrypted-media"
        allowFullScreen
        title="Sorteio ao Vivo"
      ></iframe>
    </div>
  );
}
