# Identidade visual

## Conceito

**Beleza editorial com assinatura de maquiadora.** O site se inspira em revista de moda (tipografia didone de alto contraste, composições assimétricas, muito respiro) e usa como assinatura um gesto do ofício: o **swatch**, o traço de batom que a maquiadora faz para testar a cor.

Onde o swatch aparece:
- sob as palavras-chave dos títulos ("*melhor versão*", "*um ritual*", o nome da cliente na confirmação), desenhando-se quando entra na tela;
- na **barra de progresso do agendamento**: cada etapa é um traço, cereja quando concluída, petróleo quando atual e névoa quando futura;
- como **arte de reserva** quando ainda não há foto: uma cartela de traços nas cores da marca, em vez de caixas cinza.

## Paleta (tokens em `src/app/globals.css`)

| Token | Hex | Uso |
| --- | --- | --- |
| `--brand-petrol` | `#052F32` | Superfícies profundas: hero, rodapé, painel lateral, resumo |
| `--brand-teal-deep` | `#0A4F53` | Seção "Sobre", destaques |
| `--brand-teal` | `#0F6B6E` | Elementos de marca, foco (`ring`), ações secundárias |
| `--brand-turquoise` | `#136F73` | Variação de apoio |
| `--brand-cherry` | `#8B1022` | CTA do hero, swatch, alertas de marca |
| `--brand-wine` | `#6E0D1B` | Hover de botões |
| `--brand-merlot` | `#701A2E` | **Botão principal** (`--primary`), seleção, horários escolhidos |
| `--brand-wine-deep` | `#340B17` | Overlays fotográficos, total do resumo |
| `--brand-paper` | `#F6F2F1` | Fundo de leitura |
| `--brand-graphite` | `#1F1F23` | Texto |

Os tokens semânticos do shadcn (`--primary`, `--secondary`, `--ring`, `--sidebar` etc.) apontam para os tokens de marca, então os componentes herdam a identidade sem cores fixas espalhadas pelo código. Não há rosa como cor principal.

## Tipografia

- **Bodoni Moda** (didone, com eixo óptico): títulos, nomes de serviços e números. O itálico é usado com parcimônia para a palavra de ênfase.
- **Instrument Sans**: interface, formulários e textos longos.
- **Rótulos** (`.eyebrow`): versaletes espaçados de 0,72 rem.

## Movimento

Movimentos curtos, com curva `cubic-bezier(0.22, 1, 0.36, 1)`, e **movimento reduzido respeitado** em todo o site (`MotionConfig reducedMotion="user"` e CSS `prefers-reduced-motion`).

## Bibliotecas de UI: o que foi pesquisado e usado

As 17 referências foram analisadas (relatório de pesquisa com comandos de instalação, licenças e dependências). O que entrou no projeto:

| Referência | Uso no projeto | Forma |
| --- | --- | --- |
| **shadcn/ui** | Base de componentes acessíveis: botão, campos, diálogo, accordion, calendário, switch, tabela, skeleton, toasts (Sonner) | Instalado (variante Base UI) e retematizado |
| **Magic UI** | `Marquee` (faixa de serviços e galeria), `NumberTicker` (KPIs do painel), `BlurFade` | Instalado via registry |
| **Cult UI** | `TextureCard` (moldura em camadas do card de confirmação) | Instalado via registry, adaptado à paleta |
| **Animata** | "Mask Reveal Up": revelação por linha do título do hero | Reimplementado com `motion` |
| **Aceternity UI** | "Focus Cards" (retratos das profissionais) e "Animated Testimonials" (palavras surgindo do desfoque) | Reimplementado (sem dependências extras) |
| **Kokonut UI** | "Slot Picker": seleção de horário com pílula animada (`layoutId`) e padrão ARIA de radiogroup | Reimplementado |
| **Skiper UI** | "CssLink": sublinhado que cresce no hover/foco da navegação (`.link-swipe`) | Inspiração, efeito em CSS próprio. Créditos: Skiper UI |
| **Hover.dev** | Ideia do traço desenhado sob a palavra, que originou o swatch | Inspiração (código não utilizado: licença proprietária) |
| **Motion Primitives / Animate UI** | Transições entre etapas com desfoque e deslocamento; padrões de reduced-motion | Inspiração (MIT + Commons Clause no Animate UI) |
| **Kibo UI / Origin (coss.com/ui)** | Referência de calendário e mini-calendário | Inspiração; calendário via shadcn |
| **Layers / Unicorn Studio** | Composição: cards em cascata (moldura deslocada da foto do hero), grão sutil em vez de shader WebGL | Inspiração. WebGL descartado por desempenho e acessibilidade |
| **React Bits** | Split Text avaliado | Descartado: depende de GSAP; substituído pelo Mask Reveal |
| **21st.dev** | Galeria de testimonials avaliada | Não instalado: exige API key e as licenças variam por autor |
| **Uiverse** | Site bloqueado durante a pesquisa | Sem uso |

## Acessibilidade

- Foco visível em petróleo, link "Pular para o conteúdo", rótulos ligados aos campos e erros com `role="alert"`.
- Seleções com semântica correta (`radiogroup`, `aria-pressed`, `aria-current="step"`).
- Alvos de toque de 44 px ou mais no agendamento (horários e dias do calendário).
- Contraste: texto claro sobre petróleo e merlot; texto grafite sobre off-white.
