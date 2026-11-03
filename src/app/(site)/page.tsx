import Link from "next/link";
import { MapPin, MessageCircle, AtSign, ArrowUpRight } from "lucide-react";
import { Hero } from "@/components/home/hero";
import { ServicesMenu } from "@/components/home/services-menu";
import { ProfessionalsGrid } from "@/components/home/professionals";
import { Testimonials } from "@/components/home/testimonials";
import { Reveal } from "@/components/motion/primitives";
import { SwatchWord } from "@/components/site/swatch";
import { Photo } from "@/components/site/photo";
import { Marquee } from "@/components/ui/marquee";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { buttonVariants } from "@/components/ui/button";
import { getSettings } from "@/server/settings";
import { getPublicContent, getPublicProfessionals, getPublicServices } from "@/server/public-data";
import { instagramLink, mediaUrl, whatsappLink } from "@/lib/media-url";
import { cn } from "@/lib/utils";

export default async function HomePage() {
  const [s, services, pros, content] = await Promise.all([getSettings(), getPublicServices(), getPublicProfessionals(), getPublicContent()]);
  const wa = whatsappLink(s.whatsapp, `Olá! Vim pelo site do ${s.studioName}.`);
  const ig = instagramLink(s.instagram);
  const aboutParagraphs = s.aboutText.split(/\n{2,}/).filter(Boolean);

  return (
    <>
      <Hero
        eyebrow={s.heroEyebrow}
        title={s.heroTitle}
        subtitle={s.heroSubtitle}
        image={mediaUrl(s.heroImageId)}
        secondaryImage={mediaUrl(s.heroSecondaryImageId)}
        studioName={s.studioName}
      />

      {services.length > 0 && (
        <div className="border-b border-border bg-paper py-5" aria-hidden>
          <Marquee pauseOnHover className="mask-edges [--duration:48s] [--gap:3rem]" repeat={3}>
            {services.map((sv) => (
              <span key={sv.id} className="flex items-center gap-12 whitespace-nowrap font-display text-2xl italic text-teal-deep">
                {sv.name}
                <span className="size-1.5 rounded-full bg-cherry" />
              </span>
            ))}
          </Marquee>
        </div>
      )}

      {/* Serviços */}
      <section id="servicos" className="scroll-mt-24 bg-paper py-24 sm:py-32">
        <div className="mx-auto max-w-[1320px] px-4 sm:px-6 lg:px-10">
          <Reveal className="mb-16 grid gap-6 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <p className="eyebrow text-teal">Menu de serviços</p>
              <h2 className="display mt-4 text-[clamp(2.6rem,5.6vw,4.8rem)] text-petrol">
                Cada atendimento, <SwatchWord color="var(--brand-teal-haze)"><span className="italic">um ritual</span></SwatchWord>.
              </h2>
            </div>
            <p className="self-end text-[1.02rem] leading-relaxed text-muted-foreground lg:col-span-4 lg:col-start-9">
              Valores e durações atualizados pela nossa equipe. Escolha o serviço e veja na hora os horários livres de cada profissional.
            </p>
          </Reveal>
          {services.length ? (
            <ServicesMenu services={services} />
          ) : (
            <EmptyBlock text="Nosso menu de serviços está sendo preparado. Enquanto isso, fale com a gente para tirar dúvidas e reservar." wa={wa} />
          )}
        </div>
      </section>

      {/* Profissionais */}
      <section id="profissionais" className="scroll-mt-24 bg-blush-veil py-24 sm:py-32">
        <div className="mx-auto max-w-[1320px] px-4 sm:px-6 lg:px-10">
          <Reveal className="mb-14 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="eyebrow text-merlot">Quem cuida de você</p>
              <h2 className="display mt-4 text-[clamp(2.6rem,5.6vw,4.8rem)] text-petrol">
                Mãos que <span className="italic text-merlot">conhecem</span> o seu rosto.
              </h2>
            </div>
            <Link href="/agendar" className={cn(buttonVariants({ variant: "teal" }), "self-start lg:self-auto")}>Ver horários disponíveis</Link>
          </Reveal>
          {pros.length ? <ProfessionalsGrid pros={pros} /> : <EmptyBlock text="Em breve você vai conhecer nossa equipe por aqui." wa={wa} />}
        </div>
      </section>

      {/* Sobre */}
      <section id="sobre" data-nav="dark" className="scroll-mt-24 grain overflow-hidden bg-teal-deep py-24 text-white sm:py-32">
        <div className="mx-auto grid max-w-[1320px] gap-14 px-4 sm:px-6 lg:grid-cols-12 lg:px-10">
          <Reveal className="lg:col-span-5">
            <div className="relative aspect-[4/5] w-full max-w-md">
              <Photo src={mediaUrl(s.aboutImageId)} alt={`Interior do ${s.studioName}`} className="h-full w-full" sizes="(max-width: 1024px) 90vw, 35vw" fallbackVariant={2} />
              <div aria-hidden className="absolute -right-5 -top-5 h-full w-full border border-[#c45a68]/60" />
            </div>
          </Reveal>
          <div className="lg:col-span-6 lg:col-start-7 lg:pt-10">
            <Reveal>
              <p className="eyebrow text-teal-haze">Sobre nós</p>
              <h2 className="display mt-5 text-[clamp(2.2rem,4.4vw,3.8rem)] leading-[1.02]">{s.aboutTitle}</h2>
            </Reveal>
            <Reveal delay={0.1} className="mt-8 space-y-5 text-[1.05rem] leading-relaxed text-[#cfe0df]">
              {aboutParagraphs.length ? aboutParagraphs.map((p, i) => <p key={i}>{p}</p>) : <p>O {s.studioName} é um estúdio dedicado à beleza feita com tempo, técnica e escuta.</p>}
            </Reveal>
            {s.highlights.length > 0 && (
              <dl className="mt-12 grid gap-8 border-t border-white/15 pt-10 sm:grid-cols-2">
                {s.highlights.map((h) => (
                  <Reveal key={h.title}>
                    <dt className="font-display text-2xl italic text-[#f3b6c0]">{h.title}</dt>
                    <dd className="mt-2 text-[0.95rem] leading-relaxed text-[#b6cfcd]">{h.text}</dd>
                  </Reveal>
                ))}
              </dl>
            )}
          </div>
        </div>
      </section>

      {/* Galeria */}
      {content.gallery.length > 0 && (
        <section aria-labelledby="galeria-titulo" className="bg-paper py-24 sm:py-28">
          <div className="mx-auto mb-12 flex max-w-[1320px] items-end justify-between px-4 sm:px-6 lg:px-10">
            <div>
              <p className="eyebrow text-teal">Galeria</p>
              <h2 id="galeria-titulo" className="display mt-4 text-[clamp(2.4rem,5vw,4.2rem)] text-petrol">Trabalhos recentes</h2>
            </div>
            {ig && (
              <a href={ig.url} target="_blank" rel="noopener noreferrer" className="link-swipe hidden text-sm font-semibold text-merlot sm:inline">
                Mais no Instagram {ig.handle}
              </a>
            )}
          </div>
          <Marquee pauseOnHover className="[--duration:70s] [--gap:1.25rem]" repeat={2}>
            {content.gallery.map((g, i) => (
              <figure key={g.id} className={cn("relative w-[260px] shrink-0 sm:w-[300px]", i % 2 ? "mt-10" : "")}>
                <Photo src={g.src} alt={g.caption ?? "Trabalho do estúdio"} className="aspect-[3/4] w-full" sizes="300px" />
                {g.caption && <figcaption className="mt-3 text-sm text-muted-foreground">{g.caption}</figcaption>}
              </figure>
            ))}
          </Marquee>
        </section>
      )}

      {/* Depoimentos */}
      {content.testimonials.length > 0 && (
        <section aria-labelledby="depoimentos-titulo" className="border-t border-border bg-paper py-24 sm:py-32">
          <div className="mx-auto max-w-[1320px] px-4 sm:px-6 lg:px-10">
            <p id="depoimentos-titulo" className="eyebrow mb-10 text-merlot">O que dizem nossas clientes</p>
            <Testimonials items={content.testimonials} />
          </div>
        </section>
      )}

      {/* FAQ + Contato */}
      <section id="contato" className="scroll-mt-24 bg-card py-24 sm:py-32">
        <div className="mx-auto grid max-w-[1320px] gap-16 px-4 sm:px-6 lg:grid-cols-12 lg:px-10">
          <div className="lg:col-span-7">
            <p className="eyebrow text-teal">Perguntas frequentes</p>
            <h2 className="display mt-4 text-[clamp(2.2rem,4.4vw,3.6rem)] text-petrol">Antes de você chegar</h2>
            {content.faqs.length ? (
              <Accordion className="mt-10 border-t border-border">
                {content.faqs.map((f) => (
                  <AccordionItem key={f.id} value={f.id} className="border-b border-border">
                    <AccordionTrigger className="py-6 font-display text-[1.35rem] text-petrol hover:no-underline">{f.q}</AccordionTrigger>
                    <AccordionContent className="pb-6 text-[1rem] leading-relaxed text-muted-foreground whitespace-pre-line">{f.a}</AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            ) : (
              <p className="mt-8 text-muted-foreground">Ficou com alguma dúvida? Fale com a gente — respondemos rapidinho.</p>
            )}
          </div>

          <aside className="lg:col-span-4 lg:col-start-9">
            <div className="sticky top-28 rounded-[28px] bg-petrol p-8 text-white grain">
              <p className="eyebrow text-teal-haze">Contato</p>
              <p className="mt-4 font-display text-3xl leading-tight">Vamos conversar sobre o seu momento?</p>
              <ul className="mt-8 space-y-5 text-[0.95rem]">
                {s.address && (
                  <li className="flex gap-3">
                    <MapPin className="mt-0.5 size-5 shrink-0 text-[#f3b6c0]" aria-hidden />
                    <span className="whitespace-pre-line">
                      {s.address}
                      {s.mapsUrl && (
                        <a href={s.mapsUrl} target="_blank" rel="noopener noreferrer" className="mt-2 flex items-center gap-1 text-teal-haze underline underline-offset-4">
                          Abrir no mapa <ArrowUpRight className="size-3.5" />
                        </a>
                      )}
                    </span>
                  </li>
                )}
                {wa && (
                  <li>
                    <a href={wa} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 hover:text-teal-haze">
                      <MessageCircle className="size-5 text-[#f3b6c0]" aria-hidden /> WhatsApp
                    </a>
                  </li>
                )}
                {ig && (
                  <li>
                    <a href={ig.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 hover:text-teal-haze">
                      <AtSign className="size-5 text-[#f3b6c0]" aria-hidden /> {ig.handle}
                    </a>
                  </li>
                )}
              </ul>
              {s.openingHours.length > 0 && (
                <dl className="mt-8 space-y-2 border-t border-white/15 pt-6 text-sm">
                  {s.openingHours.map((h) => (
                    <div key={h.label} className="flex justify-between gap-4">
                      <dt className="text-[#b6cfcd]">{h.label}</dt>
                      <dd>{h.hours}</dd>
                    </div>
                  ))}
                </dl>
              )}
              <Link href="/agendar" className={cn(buttonVariants({ size: "lg" }), "mt-8 w-full bg-cherry hover:bg-merlot")}>Agendar horário</Link>
            </div>
          </aside>
        </div>
      </section>
    </>
  );
}

function EmptyBlock({ text, wa }: { text: string; wa: string | null }) {
  return (
    <div className="rounded-[24px] border border-dashed border-border bg-card p-10 text-center">
      <p className="mx-auto max-w-lg text-muted-foreground">{text}</p>
      {wa && (
        <a href={wa} target="_blank" rel="noopener noreferrer" className={cn(buttonVariants({ variant: "teal" }), "mt-6")}>
          Falar pelo WhatsApp
        </a>
      )}
    </div>
  );
}
