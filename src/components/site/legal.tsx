/** Página de texto legal: parágrafos separados por linha em branco; linhas curtas sem ponto viram subtítulos. */
export function LegalPage({ title, text, isDefault }: { title: string; text: string; isDefault?: boolean }) {
  const blocks = text.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  return (
    <div className="bg-paper pb-24 pt-32 sm:pt-40">
      <article className="mx-auto max-w-[720px] px-4 sm:px-6">
        <h1 className="display text-[clamp(2.6rem,6vw,4.2rem)] text-petrol">{title}</h1>
        {isDefault && <p className="mt-4 text-sm text-muted-foreground">Texto padrão. O estúdio pode personalizá-lo no painel administrativo.</p>}
        <div className="mt-10 space-y-6 text-[1.02rem] leading-relaxed text-graphite">
          {blocks.map((b, i) => {
            const [first, ...rest] = b.split("\n");
            const heading = first.length < 60 && !/[.:]$/.test(first) && rest.length > 0;
            return heading ? (
              <section key={i}>
                <h2 className="font-display text-2xl text-merlot">{first}</h2>
                <p className="mt-2 whitespace-pre-line text-muted-foreground">{rest.join("\n")}</p>
              </section>
            ) : (
              <p key={i} className="whitespace-pre-line text-muted-foreground">{b}</p>
            );
          })}
        </div>
      </article>
    </div>
  );
}
