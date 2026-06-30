import { jobsRepository } from "../jobs/jobs.repository.js";
import { mediaRepository } from "../media/media.repository.js";
import { productsRepository } from "../products/products.repository.js";
import { aiService } from "../ai/ai.service.js";
import { env } from "../../config/env.js";
import { storageService } from "../../integrations/storage/storage.service.js";
import { AppError } from "../../shared/errors/AppError.js";
import type { GenerateVideoInput } from "./videos.schemas.js";
import { enqueueVideoGeneration, type VideoCostEstimate, type VideoRenderPlan, type VideoRenderScene } from "./video-generation.queue.js";
import { auditService } from "../audit/audit.service.js";

type AIVideoSceneType = VideoRenderScene["type"];

type AIVideoCreativeScene = {
  order: number;
  type: AIVideoSceneType;
  duration_seconds: number;
  scene_goal: string;
  headline: string;
  subheadline: string;
  instruction: string;
  visual_action: string;
  camera_direction: string;
  on_screen_text: string;
  voiceover: string;
  reference_asset_hint: string;
  visual_fidelity: string;
  plano_camera: string;
  movimento_camera: string;
  ambiente: string;
  iluminacao: string;
  restricoes_ia: string;
  prompt_video_ia: string;
  transition_to_next: string;
};

type AIVideoCreativePlan = {
  hook: string;
  promise: string;
  target_audience: string;
  tone: string;
  cta: string;
  caption: string;
  script: string;
  safety_notes: string[];
  scenes: AIVideoCreativeScene[];
};

type SceneTextDraft = Pick<VideoRenderScene, "type" | "headline" | "subheadline" | "instruction"> &
  Partial<Pick<
    VideoRenderScene,
    | "duration_seconds"
    | "scene_goal"
    | "visual_action"
    | "camera_direction"
    | "on_screen_text"
    | "voiceover"
    | "reference_asset_hint"
    | "visual_fidelity"
    | "transition_to_next"
    | "prompt_video_ia"
    | "plano_camera"
    | "movimento_camera"
    | "ambiente"
    | "iluminacao"
    | "restricoes_ia"
  >>;

const VIDEO_CREATIVE_PLAN_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["hook", "promise", "target_audience", "tone", "cta", "caption", "script", "safety_notes", "scenes"],
  properties: {
    hook: { type: "string" },
    promise: { type: "string" },
    target_audience: { type: "string" },
    tone: { type: "string" },
    cta: { type: "string" },
    caption: { type: "string" },
    script: { type: "string" },
    safety_notes: {
      type: "array",
      items: { type: "string" },
    },
    scenes: {
      type: "array",
      minItems: 4,
      maxItems: 6,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "order",
          "type",
          "duration_seconds",
          "scene_goal",
          "headline",
          "subheadline",
          "instruction",
          "visual_action",
          "camera_direction",
          "on_screen_text",
          "voiceover",
          "reference_asset_hint",
          "visual_fidelity",
          "plano_camera",
          "movimento_camera",
          "ambiente",
          "iluminacao",
          "restricoes_ia",
          "prompt_video_ia",
          "transition_to_next",
        ],
        properties: {
          order: { type: "integer" },
          type: { type: "string", enum: ["hook", "benefit", "proof", "detail", "cta"] },
          duration_seconds: { type: "integer", minimum: 3, maximum: 10 },
          scene_goal: { type: "string" },
          headline: { type: "string" },
          subheadline: { type: "string" },
          instruction: { type: "string" },
          visual_action: { type: "string" },
          camera_direction: { type: "string" },
          on_screen_text: { type: "string" },
          voiceover: { type: "string" },
          reference_asset_hint: { type: "string" },
          visual_fidelity: { type: "string" },
          plano_camera: { type: "string" },
          movimento_camera: { type: "string" },
          ambiente: { type: "string" },
          iluminacao: { type: "string" },
          restricoes_ia: { type: "string" },
          prompt_video_ia: { type: "string" },
          transition_to_next: { type: "string" },
        },
      },
    },
  },
};

function buildVideoCreativeInstructions() {
  const systemInstructions = [
    "Voce e um diretor criativo senior, roteirista de performance e estrategista de videos curtos para venda de produtos. Sua unica funcao e transformar um briefing de produto em um plano de video completo, cena a cena, pronto para filmagem humana, edicao vertical curta e geracao por IA. Voce nao faz perguntas, nao pede esclarecimentos, nao apresenta opcoes e nao entrega rascunhos. Voce executa com base no briefing recebido e usa regras de fallback quando houver lacunas.",
    "Regra central: se nao esta literalmente declarado no briefing, nao existe como fato. Informacoes ausentes podem ser omitidas, ocultadas por enquadramento, substituidas por descricoes neutras ou registradas como lacunas, mas nunca inventadas. Transforme somente informacoes declaradas em acoes visuais observaveis, narracao segura, textos objetivos e instrucoes executaveis para video por IA.",
    "Responda exclusivamente com um unico objeto JSON valido e diretamente parseavel por JSON.parse(). Nao use markdown, crases, comentarios, texto antes ou depois do JSON, virgulas finais ou campos fora do schema solicitado. A resposta inteira e invalida se o JSON nao puder ser parseado.",
    "Obedeca exatamente ao schema fornecido pela API: hook, promise, target_audience, tone, cta, caption, script, safety_notes e scenes. Cada item de scenes deve conter exatamente os campos pedidos no schema: order, type, duration_seconds, scene_goal, headline, subheadline, instruction, visual_action, camera_direction, on_screen_text, voiceover, reference_asset_hint, visual_fidelity, plano_camera, movimento_camera, ambiente, iluminacao, restricoes_ia, prompt_video_ia e transition_to_next.",
    "Quando uma informacao nao estiver declarada, use fallback neutro: publico adulto generico, tom claro e direto, estetica limpa de produto, ritmo moderado, CTA de baixa friccao e ambiente neutro. Nao invente marca, preco, desconto, frete, garantia, estoque, especificacao tecnica, prazo, disponibilidade, marketplace, rede social, cupom, depoimento, avaliacao ou dado comercial nao declarado.",
    "Fidelidade visual absoluta: toda aparicao do produto deve preservar os atributos visuais declarados ou visiveis nas imagens do usuario: modelo, formato, proporcao, cor, acabamento, material, textura, logotipo, tela, display, embalagem, acessorios, botoes, conectores, partes moveis e componentes. Se algo nao estiver claro, use angulo lateral, fundo desfocado, recorte parcial, macro de area conhecida, silhueta, contraluz ou ausencia do elemento.",
    "E proibido usar superlativos absolutos e claims nao comprovados como melhor, unico, perfeito, revolucionario, imbativel, numero um, garantia de resultado, funciona para todos, zero falhas ou comparacao direta sem dados declarados. Quando houver risco de claim, substitua por descricao visual observavel: nao diga que e facil, mostre um gesto simples; nao diga que e resistente, mostre acabamento em close; nao diga que e silencioso, mostre uso sem afirmar silencio absoluto.",
    "Nao use urgencia artificial como so hoje, ultimas unidades, oferta relampago, por tempo limitado ou equivalente sem declaracao literal. O CTA deve nascer do beneficio demonstrado. Use CLICAR NO LINK apenas se houver destino declarado. Sem destino declarado, prefira SALVAR, COMENTAR ou pedir o link.",
    "Escolha uma palavra-chave central derivada literalmente do briefing ou da funcao principal declarada. Essa palavra-chave deve orientar hook, promise, headline, voiceover, caption e CTA. Nao alterne beneficios sem necessidade. Cada cena deve avancar a narrativa e nao repetir a mesma promessa da cena anterior.",
    "A progressao narrativa obrigatoria e: 1 gancho visual; 2 apresentacao contextual do produto; 3 exploracao de detalhe fisico ou unboxing se houver embalagem descrita; 4 demonstracao de uso ou interacao observavel; 5 prova ou resultado visual concreto; 6 CTA integrado. Para videos de 15 a 20 segundos, comprima em 4 ou 5 cenas mantendo a ordem: gancho, revelacao/detalhe, demonstracao/resultado, CTA.",
    "Cada cena deve ter exatamente um objetivo dominante no campo scene_goal: ATRAIR ATENCAO, REVELAR PRODUTO, EXPLORAR DETALHE, DEMONSTRAR USO, EXIBIR RESULTADO, REMOVER DUVIDA ou CHAMAR PARA ACAO. ATRAIR ATENCAO so na primeira cena; CHAMAR PARA ACAO so na ultima.",
    "O campo visual_action deve comecar com um verbo fisico e observavel em maiusculas: REVELA, APROXIMA, DESLIZA, PRESSIONA, GIRA, PROJETA, COMPARA, SEGURA, CONECTA, ABRE, APONTA, FINALIZA, POSICIONA, RETIRA, ENCAIXA, DESDOBRA, VESTE, APLICA ou ORGANIZA. Evite acoes vagas como mostrar, apresentar ou ver.",
    "Use apenas estes planos no campo camera_direction: GRANDE PLANO GERAL, PLANO GERAL, PLANO MEDIO, CLOSE, MACRO OU PLANO DETALHE, POV. Inclua tambem movimento principal simples: CAMERA ESTATICA, ZOOM IN PROGRESSIVO, ZOOM OUT PROGRESSIVO, PAN LATERAL, TILT, RACK FOCUS, DOLLY IN ou TRAVELLING LATERAL. Especifique ponto inicial, ponto final e velocidade relativa.",
    "Cada instruction precisa descrever ambiente, superficie de apoio, fundo, props ou ausencia de props, presenca humana ou ausencia de humanos, iluminacao e continuidade. Use iluminacao limpa e coerente: luz natural lateral, estudio frontal difuso, backlight, ring light, dramatica com sombra direcional ou neutra de produto.",
    "Preencha plano_camera com o enquadramento exato para 9:16, incluindo distancia do produto, area segura de texto e ponto de foco. Preencha movimento_camera com um unico movimento simples e executavel. Preencha ambiente com cenario realista e poucos elementos. Preencha iluminacao com uma fonte principal clara e continuidade entre cenas.",
    "Headlines devem ter no maximo 8 palavras. Subheadline deve ter no maximo 14 palavras. on_screen_text deve ser curto, legivel, sem informacao nova e posicionado fora do produto, logo, display ou area principal da acao. Prefira zona segura do terco inferior em formato vertical 9:16.",
    "Cada voiceover deve comecar com verbo de acao, caber em fala natural de 3 a 5 segundos, complementar a headline e nao repetir exatamente o texto em tela. Use portugues do Brasil, tom comercial natural, sem girias, sem emojis escritos, sem exagero e sem pressao emocional.",
    "Cada instruction deve funcionar tambem como prompt de video por IA: sujeito, acao, plano, movimento, ambiente, iluminacao, estilo visual, continuidade e restricoes. Evite multidoes, maos complexas, textos pequenos, reflexos intensos, interfaces inventadas, transformacoes impossiveis, muitos objetos simultaneos e acoes paralelas.",
    "O campo prompt_video_ia deve ser a versao final e autocontida da cena para o gerador de video. Ele deve combinar sujeito, acao, plano_camera, movimento_camera, ambiente, iluminacao, visual_fidelity, restricoes_ia e transicao. Escreva em portugues claro, sem lista, sem markdown, sem mencionar campos internos e sem pedir coisas impossiveis.",
    "Cada transition_to_next deve declarar uma tecnica simples e a logica narrativa: CORTE SECO, CORTE POR MOVIMENTO, ZOOM IN DE TRANSICAO, ZOOM OUT DE TRANSICAO, MATCH CUT, RACK FOCUS DE TRANSICAO ou FADE. A transicao precisa conectar a acao anterior com a proxima, evitando cortes aleatorios.",
    "safety_notes deve conter 3 a 5 notas especificas e acionaveis para prevenir problemas reais de geracao: continuidade de posicao, cor, luz, estado do produto, embalagem, maos, reflexos, logos, telas, acessorios, props, corte, velocidade, color grade e legibilidade. Nao escreva notas genericas.",
    "Antes de entregar, valide internamente: JSON parseavel, schema completo, duracao coerente, quantidade correta de cenas, ordem narrativa, objetivo unico por cena, visual_action com verbo permitido, camera_direction permitido, ausencia de informacoes inventadas, ausencia de claims proibidos, fidelidade ao produto, instrucoes executaveis e CTA contextual.",
    "A entrega so esta pronta quando servir simultaneamente como roteiro criativo, guia de filmagem, plano de edicao, prompt de geracao por IA e peca comercial segura. Entregue somente o JSON final.",
  ];

  return systemInstructions.join(" ");
}

function buildVideoPrompt(input: GenerateVideoInput, productName: string, productDescription?: string, mediaTitles: string[] = []) {
  const briefing = input.briefing_fields || {};
  const template = input.template || input.style || "product";
  const platforms = input.platforms?.length ? input.platforms.join(", ") : input.platform || "instagram";
  const durationSeconds = secondsFromDuration(input.duration);
  const sceneCount = Math.min(6, Math.max(4, Math.ceil(durationSeconds / 5)));
  const templateGuide: Record<string, string> = {
    unboxing:
      "Criar narrativa de descoberta: caixa ou embalagem em cena somente se existir nas imagens/briefing, maos abrindo ou revelando o produto, close em detalhes reais, demonstracao curta de uso e CTA natural. Nao inventar acessorios ou embalagem nao declarados.",
    demonstracao:
      "Mostrar o produto resolvendo uma situacao pratica: contexto inicial, aproximacao do produto, interacao real observavel, detalhe funcional visivel, resultado visual concreto e CTA. Nao afirmar desempenho tecnico sem dado declarado.",
    "antes-depois":
      "Construir comparacao visual segura: situacao inicial neutra, entrada do produto, uso/interacao observavel, mudanca visual permitida pelo briefing e fechamento com CTA. Nao inventar transformacao, resultado garantido ou comparacao com concorrente.",
    oferta:
      "Criar video direto de oportunidade sem urgencia falsa: produto em destaque, beneficio principal declarado, prova visual do produto, informacao comercial apenas se estiver no briefing e CTA claro. Nao criar desconto, preco, prazo ou escassez.",
    review:
      "Simular review de vendedor/creator: produto em maos, fala consultiva, close em acabamento e partes visiveis, demonstracao realista, objecao respondida se declarada e recomendacao final natural. Nao criar depoimento, nota ou avaliacao falsa.",
    marketplace:
      "Criar criativo para social commerce: produto centralizado, beneficio principal em texto curto, detalhes visuais confiaveis, uso pratico e CTA para pedir link quando nao houver loja declarada. Evitar poluicao visual e claims nao comprovados.",
    product:
      "Criar apresentacao limpa do produto: revelacao visual forte, detalhe fisico, uso ou contexto realista, beneficio declarado e CTA simples. Manter foco total na fidelidade visual das imagens enviadas.",
  };

  return [
    "BRIEFING OPERACIONAL PARA PLANO DE VIDEO COM IA",
    "",
    "Objetivo:",
    "Criar um pre-roteiro estruturado para video vertical de divulgacao, pronto para gerar cenas por IA e renderizar no AutoMedia.",
    "O resultado precisa funcionar para qualquer categoria de produto, mas sem ficar generico demais: use os dados do produto, midias e template para dar direcao real.",
    "",
    "Dados do anuncio:",
    `- Produto/anuncio: ${productName}`,
    `- Descricao cadastrada: ${productDescription || "Nao informada"}`,
    `- Template escolhido: ${template}`,
    `- Regra do template: ${templateGuide[String(template).toLowerCase()] || templateGuide.product}`,
    `- Formato: ${input.format || "reels"}`,
    `- Proporcao: ${input.ratio || "9:16"}`,
    `- Duracao desejada: ${durationSeconds}s`,
    `- Quantidade esperada de cenas: ${sceneCount}. Nao use menos que 4 cenas, exceto se a duracao for extremamente curta.`,
    `- Ritmo: ${input.rhythm || "Cortes dinamicos, leitura facil e transicoes limpas"}`,
    `- Audio: ${input.audio || "Trilha moderna sem narracao obrigatoria"}`,
    `- Plataformas: ${platforms}`,
    "",
    "Briefing comercial:",
    `- Publico-alvo: ${briefing.targetAudience || "pessoas interessadas no produto"}`,
    `- Tom de voz: ${briefing.tone || "natural, vendedor consultivo, direto e confiavel"}`,
    `- Objetivo: ${briefing.objective || "gerar interesse e pedido de link"}`,
    `- Promessa principal permitida: ${briefing.promise || firstSentence(productDescription) || "mostrar o beneficio principal do produto"}`,
    `- CTA permitido: ${briefing.cta || "Use CTA de baixa friccao: SALVAR, COMENTAR ou pedir o link, sem inventar canal de compra."}`,
    `- Restricoes: ${briefing.restrictions || "nao inventar informacoes, nao exagerar beneficios, nao usar tom apelativo"}`,
    `- Dor ou curiosidade inicial: ${briefing.painPoint || "mostrar por que o produto merece atencao nos primeiros segundos"}`,
    `- Objeção que o video deve reduzir: ${briefing.objection || "deixar claro como o produto e usado e qual valor ele entrega"}`,
    "",
    "Materiais visuais disponiveis:",
    `- Midias selecionadas: ${mediaTitles.length ? mediaTitles.join(" | ") : "imagem principal do anuncio ou imagem enviada pelo usuario"}`,
    "- Regra de fidelidade visual: as imagens do usuario sao referencia obrigatoria de identidade do produto. O gerador de video deve preservar aparencia, cor, proporcao, textura, embalagem, acessorios, controle, tela, botoes, logo aparente e qualquer detalhe visivel. Nao substituir por produto parecido ou versao generica.",
    `- Direcao visual adicional: ${input.visual_prompt || "produto em destaque, ambiente realista, texto legivel e composicao limpa"}`,
    `- Observacoes livres do usuario: ${input.briefing || briefing.extra || "sem observacoes extras"}`,
    "",
    "Regras obrigatorias de saida:",
    "- Responder somente no JSON do schema.",
    "- Criar cenas na ordem logica: gancho, revelacao do produto, demonstracao/beneficio, prova/detalhe, CTA.",
    "- Cada cena precisa conter: objetivo da cena, acao visual, instrucao fechada, camera_direction, texto na tela, narracao curta e transicao para a proxima.",
    "- Cada cena tambem precisa conter visual_fidelity explicando quais detalhes das imagens do usuario devem permanecer identicos.",
    "- Cada cena deve conter plano_camera, movimento_camera, ambiente, iluminacao, restricoes_ia e prompt_video_ia. O prompt_video_ia deve ser pronto para ser enviado ao gerador de video sem depender de contexto externo.",
    "- Todas as cenas devem ser pensadas para video vertical 9:16: produto central, area de texto segura, pouco texto, leitura rapida e composicao limpa.",
    "- A cena deve ser executavel por IA sem ambiguidade: descreva sujeito, acao, plano, movimento, ambiente, iluminacao, continuidade e restricoes visuais.",
    "- O video deve parecer uma unica historia curta, nao uma lista de takes desconectados.",
    "- Se o template for unboxing/review, use linguagem de vendedor demonstrando o produto de forma natural.",
    "- Se o video tiver 15 a 20 segundos, prefira 4 ou 5 cenas de 3 a 5 segundos com conexao clara entre elas.",
    "- Se alguma informacao nao existir, use uma formulacao neutra. Nao invente dado tecnico.",
    "- Nao incluir explicacoes fora do JSON.",
  ].join("\n");
}

function compactText(value?: string, fallback = "") {
  return String(value || fallback)
    .replace(/\s+/g, " ")
    .trim();
}

function limitText(value: string, maxLength: number) {
  const clean = compactText(value);
  if (clean.length <= maxLength) return clean;
  return `${clean.slice(0, maxLength - 1).trim()}…`;
}

function firstSentence(value?: string) {
  return compactText(value).split(/[.!?]/)[0] || "";
}

function secondsFromDuration(duration?: string | number) {
  if (typeof duration === "number") return Math.max(12, duration);
  const match = String(duration || "30s").match(/\d+/);
  return Math.max(12, Number(match?.[0] || 30));
}

function sceneDurations(totalSeconds: number) {
  const base = Math.max(3, Math.floor(totalSeconds / 4));
  const remainder = totalSeconds - base * 4;
  return [base, base + Math.max(0, remainder), base, base];
}

function normalizeSceneType(value?: string): AIVideoSceneType {
  if (value === "hook" || value === "benefit" || value === "proof" || value === "detail" || value === "cta") return value;
  return "detail";
}

function buildSceneAiPrompt(input: {
  productName?: string;
  visualAction?: string;
  instruction?: string;
  planoCamera?: string;
  movimentoCamera?: string;
  ambiente?: string;
  iluminacao?: string;
  visualFidelity?: string;
  restricoesIa?: string;
  transition?: string;
}) {
  return compactText([
    `Video vertical 9:16 de demonstracao realista do produto ${input.productName || "do anuncio"}.`,
    input.visualAction,
    input.instruction,
    input.planoCamera ? `Enquadramento: ${input.planoCamera}.` : "",
    input.movimentoCamera ? `Movimento: ${input.movimentoCamera}.` : "",
    input.ambiente ? `Ambiente: ${input.ambiente}.` : "",
    input.iluminacao ? `Iluminacao: ${input.iluminacao}.` : "",
    input.visualFidelity ? `Fidelidade visual obrigatoria: ${input.visualFidelity}.` : "",
    input.restricoesIa ? `Restricoes: ${input.restricoesIa}.` : "",
    input.transition ? `Finalizar com ${input.transition}.` : "",
  ].filter(Boolean).join(" "));
}

function extractJsonText(value?: string) {
  const text = compactText(value);
  if (!text) return "";
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  if (fenced) return fenced.trim();
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first >= 0 && last > first) return text.slice(first, last + 1);
  return text;
}

function parseCreativePlan(value?: string): AIVideoCreativePlan | undefined {
  try {
    const parsed = JSON.parse(extractJsonText(value)) as Partial<AIVideoCreativePlan>;
    if (!Array.isArray(parsed.scenes) || !parsed.scenes.length) return undefined;

    return {
      hook: compactText(parsed.hook, "Gancho do produto"),
      promise: compactText(parsed.promise, "Beneficio principal"),
      target_audience: compactText(parsed.target_audience, "Publico interessado"),
      tone: compactText(parsed.tone, "Natural e direto"),
      cta: compactText(parsed.cta, "Comente EU QUERO"),
      caption: compactText(parsed.caption, ""),
      script: compactText(parsed.script, ""),
      safety_notes: Array.isArray(parsed.safety_notes) ? parsed.safety_notes.map((note) => compactText(note)).filter(Boolean) : [],
      scenes: parsed.scenes.slice(0, 6).map((scene, index) => {
        const visualAction = compactText(scene.visual_action, "REVELA o produto em contexto real e com poucos elementos.");
        const instruction = compactText(scene.instruction, "Mostrar o produto com clareza em composicao vertical limpa.");
        const planoCamera = compactText(scene.plano_camera, scene.camera_direction || "CLOSE vertical 9:16, produto centralizado, texto fora da area principal e foco no detalhe mais reconhecivel.");
        const movimentoCamera = compactText(scene.movimento_camera, "ZOOM IN PROGRESSIVO lento, sem cortes bruscos e mantendo o produto no centro.");
        const ambiente = compactText(scene.ambiente, "Ambiente realista, fundo limpo, superficie neutra e poucos props para nao competir com o produto.");
        const iluminacao = compactText(scene.iluminacao, "Luz principal difusa, contraste moderado, reflexos controlados e continuidade de cor entre cenas.");
        const visualFidelity = compactText(scene.visual_fidelity, "Manter o produto extremamente fiel as imagens do usuario: mesma cor, formato, proporcao, textura, embalagem, acessorios e detalhes fisicos.");
        const restricoesIa = compactText(scene.restricoes_ia, "Nao alterar modelo, cor, proporcao, logo, botoes, tela, acessorios ou embalagem; nao inventar texto pequeno, pessoas extras ou objetos nao declarados.");
        const transition = compactText(scene.transition_to_next, "CORTE POR MOVIMENTO mantendo continuidade do produto.");

        return {
          order: Number(scene.order || index + 1),
          type: normalizeSceneType(scene.type),
          duration_seconds: Math.min(10, Math.max(3, Number(scene.duration_seconds || 5))),
          scene_goal: compactText(scene.scene_goal, "Conduzir a narrativa do produto."),
          headline: limitText(scene.headline || `Cena ${index + 1}`, 48),
          subheadline: limitText(scene.subheadline || "", 76),
          instruction,
          visual_action: visualAction,
          camera_direction: compactText(scene.camera_direction, planoCamera),
          on_screen_text: limitText(scene.on_screen_text || scene.headline || "", 72),
          voiceover: compactText(scene.voiceover, ""),
          reference_asset_hint: compactText(scene.reference_asset_hint, "Usar a imagem mais proxima do produto."),
          visual_fidelity: visualFidelity,
          plano_camera: planoCamera,
          movimento_camera: movimentoCamera,
          ambiente,
          iluminacao,
          restricoes_ia: restricoesIa,
          prompt_video_ia: compactText(scene.prompt_video_ia, buildSceneAiPrompt({
            visualAction,
            instruction,
            planoCamera,
            movimentoCamera,
            ambiente,
            iluminacao,
            visualFidelity,
            restricoesIa,
            transition,
          })),
          transition_to_next: transition,
        };
      }),
    };
  } catch {
    return undefined;
  }
}

function buildScriptFromCreativePlan(plan?: AIVideoCreativePlan) {
  if (!plan) return "";

  return [
    plan.hook ? `Gancho: ${plan.hook}` : "",
    plan.promise ? `Promessa: ${plan.promise}` : "",
    ...plan.scenes.map((scene) => `Cena ${scene.order}: ${scene.voiceover || scene.on_screen_text || scene.headline}`),
    plan.cta ? `CTA: ${plan.cta}` : "",
    plan.caption ? `Legenda: ${plan.caption}` : "",
  ].filter(Boolean).join("\n");
}

function buildSceneTexts(input: GenerateVideoInput, productName: string, productDescription?: string, creativePlan?: AIVideoCreativePlan) {
  if (creativePlan?.scenes?.length) {
    return creativePlan.scenes.map((scene) => ({
      type: scene.type,
      headline: limitText(scene.headline, 48),
      subheadline: limitText(scene.subheadline || scene.on_screen_text, 76),
      instruction: [
        scene.scene_goal ? `Objetivo da cena: ${scene.scene_goal}` : "",
        scene.visual_action ? `Acao visual: ${scene.visual_action}` : "",
        scene.instruction,
        scene.camera_direction ? `Camera: ${scene.camera_direction}` : "",
        scene.plano_camera ? `Plano 9:16: ${scene.plano_camera}` : "",
        scene.movimento_camera ? `Movimento: ${scene.movimento_camera}` : "",
        scene.ambiente ? `Ambiente: ${scene.ambiente}` : "",
        scene.iluminacao ? `Iluminacao: ${scene.iluminacao}` : "",
        scene.on_screen_text ? `Texto na tela: ${scene.on_screen_text}` : "",
        scene.voiceover ? `Narracao: ${scene.voiceover}` : "",
        scene.reference_asset_hint ? `Referencia visual: ${scene.reference_asset_hint}` : "",
        scene.visual_fidelity ? `Fidelidade ao produto: ${scene.visual_fidelity}` : "",
        scene.restricoes_ia ? `Restricoes IA: ${scene.restricoes_ia}` : "",
        scene.prompt_video_ia ? `Prompt IA da cena: ${scene.prompt_video_ia}` : "",
        scene.transition_to_next ? `Transicao: ${scene.transition_to_next}` : "",
      ].filter(Boolean).join(" "),
      duration_seconds: scene.duration_seconds,
      scene_goal: scene.scene_goal,
      visual_action: scene.visual_action,
      camera_direction: scene.camera_direction,
      on_screen_text: scene.on_screen_text,
      voiceover: scene.voiceover,
      reference_asset_hint: scene.reference_asset_hint,
      visual_fidelity: scene.visual_fidelity,
      transition_to_next: scene.transition_to_next,
      prompt_video_ia: scene.prompt_video_ia,
      plano_camera: scene.plano_camera,
      movimento_camera: scene.movimento_camera,
      ambiente: scene.ambiente,
      iluminacao: scene.iluminacao,
      restricoes_ia: scene.restricoes_ia,
    })) as SceneTextDraft[];
  }

  const briefing = input.briefing_fields || {};
  const benefit = briefing.promise || firstSentence(productDescription) || "Mais praticidade no dia a dia";
  const target = briefing.targetAudience || "sua rotina";
  const cta = briefing.cta || "Comente EU QUERO";

  return [
    {
      type: "hook",
      headline: limitText(`Olha esse ${productName}`, 46),
      subheadline: limitText(briefing.objective || "Criativo pronto para chamar atenção", 64),
      instruction: "Abrir com movimento leve, texto grande e leitura rápida.",
    },
    {
      type: "benefit",
      headline: limitText(benefit, 48),
      subheadline: limitText(`Ideal para ${target}`, 64),
      instruction: "Destacar o principal benefício com zoom no produto.",
    },
    {
      type: "proof",
      headline: limitText("Visual de anúncio pronto", 42),
      subheadline: limitText(briefing.tone || "Mensagem direta, natural e sem exagero", 64),
      instruction: "Reforçar confiança e clareza antes do CTA.",
    },
    {
      type: "cta",
      headline: limitText(cta, 42),
      subheadline: limitText("Receba o link e veja os detalhes", 64),
      instruction: "Fechar com chamada forte e barra visual completa.",
    },
  ] as SceneTextDraft[];
}

function buildRenderPlan(
  input: GenerateVideoInput,
  mediaUrls: string[],
  script: string,
  productName: string,
  productDescription?: string,
  creativePlan?: AIVideoCreativePlan,
): VideoRenderPlan {
  const totalSeconds = secondsFromDuration(input.duration);
  const durations = sceneDurations(totalSeconds);
  const sceneTexts = buildSceneTexts(input, productName, productDescription, creativePlan);
  const fallbackSource = mediaUrls[0] || "product_image";

  return {
    engine: "ffmpeg-scene-composer",
    format: input.format || "reels",
    ratio: input.ratio || "9:16",
    duration: input.duration,
    rhythm: input.rhythm || "Cortes dinâmicos",
    audio: input.audio || "Música tendência",
    brand: "AutoMedia",
    scenes: sceneTexts.map((scene, index) => ({
      id: `scene_${index + 1}`,
      ...scene,
      order: index + 1,
      duration_seconds: scene.duration_seconds || durations[index] || 4,
      source: mediaUrls[index] || fallbackSource,
    })),
    script,
  };
}

function buildScenePlan(renderPlan: VideoRenderPlan, mediaTitles: string[]) {
  return {
    ...renderPlan,
    scenes: renderPlan.scenes.map((scene, index) => ({
      ...scene,
      reference_asset_title: mediaTitles[index] || mediaTitles[0] || "Imagem principal do anúncio",
      locked_instruction: [
        `Cena ${scene.order}: ${scene.headline}.`,
        scene.subheadline ? `Subtexto: ${scene.subheadline}.` : "",
        scene.instruction ? `Direção: ${scene.instruction}` : "",
        scene.prompt_video_ia ? `Prompt final da cena para IA: ${scene.prompt_video_ia}` : "",
        scene.plano_camera ? `Plano de camera: ${scene.plano_camera}.` : "",
        scene.movimento_camera ? `Movimento de camera: ${scene.movimento_camera}.` : "",
        scene.ambiente ? `Ambiente: ${scene.ambiente}.` : "",
        scene.iluminacao ? `Iluminacao: ${scene.iluminacao}.` : "",
        scene.visual_fidelity ? `Fidelidade visual: ${scene.visual_fidelity}.` : "",
        scene.restricoes_ia ? `Restricoes IA: ${scene.restricoes_ia}.` : "",
        "Fidelidade obrigatoria: preservar o produto real das imagens do usuario, mantendo cor, formato, proporcao, textura, embalagem, acessorios, tela, controle, logo aparente e detalhes fisicos. Nao substituir por produto parecido ou generico.",
        "Manter o mesmo produto, iluminação, cenário e identidade visual do início ao fim.",
      ].filter(Boolean).join(" "),
    })),
  };
}

function estimateVideoCost(duration: string | number | undefined): VideoCostEstimate {
  const durationSeconds = secondsFromDuration(duration);
  const segments = Math.max(1, Math.ceil(durationSeconds / 10));
  const perSegment = env.AI_VIDEO_PROVIDER === "replicate_kling" ? env.AI_VIDEO_SEGMENT_ESTIMATED_COST_USD : 0;
  const ffmpegCost = env.AI_VIDEO_FFMPEG_ESTIMATED_COST_USD;
  const estimated = env.AI_VIDEO_PROVIDER === "replicate_kling"
    ? Number((segments * perSegment).toFixed(4))
    : Number(ffmpegCost.toFixed(4));

  return {
    provider: env.AI_VIDEO_PROVIDER,
    model: env.AI_VIDEO_PROVIDER === "replicate_kling" ? env.REPLICATE_KLING_MODEL : "ffmpeg",
    currency: "USD",
    estimated_cost_usd: estimated,
    estimated_cost_per_segment_usd: perSegment,
    ffmpeg_cost_usd: ffmpegCost,
    duration_seconds: durationSeconds,
    segments,
    source: estimated > 0 ? "configured_estimate" : "not_configured",
  };
}

function isHttpUrl(value?: string) {
  return /^https?:\/\//i.test(String(value || ""));
}

function isInternalStorageUrl(value: string) {
  const candidates = [
    env.API_PUBLIC_URL,
    env.S3_PUBLIC_URL,
    env.S3_ENDPOINT,
    env.SUPABASE_URL,
  ].filter(Boolean) as string[];

  return candidates.some((candidate) => value.startsWith(candidate.replace(/\/$/, "")));
}

function isExternalPublicHttpUrl(value?: string) {
  return typeof value === "string" && isHttpUrl(value) && !isInternalStorageUrl(value);
}

function shouldUseExternalAiVideoUrl() {
  return env.AI_VIDEO_PROVIDER === "replicate_kling";
}

async function cacheRenderMediaUrls(urls: string[], workspaceId: string | undefined, productId: string) {
  const cachedUrls: string[] = [];
  const cacheMetadata = [];

  for (const [index, url] of urls.entries()) {
    if (!isHttpUrl(url) || isInternalStorageUrl(url)) {
      cachedUrls.push(url);
      continue;
    }

    try {
      const cached = await storageService.cacheRemoteMedia({
        url,
        keyPrefix: `source-media/${workspaceId || "global"}/${productId}`,
        fallbackName: `media-${index}`,
      });

      cachedUrls.push(cached.url);
      cacheMetadata.push({
        original_url: url,
        cached_url: cached.url,
        storage_key: cached.storage_key,
        content_type: cached.content_type,
        size: cached.size,
      });
    } catch {
      cachedUrls.push(url);
    }
  }

  return { urls: cachedUrls, cacheMetadata };
}

export const videosService = {
  async generate(payload: GenerateVideoInput, workspaceId?: string, actorId?: string) {
    const product = await productsRepository.findById(payload.product_id);
    if (!product) throw new AppError("Anúncio base não encontrado para geração de vídeo", 404, "AD_NOT_FOUND");

    const selectedMedia = await Promise.all((payload.media_asset_ids || []).map((id) => mediaRepository.findById(id)));
    const usableMedia = selectedMedia.filter(Boolean);
    const mediaUrls = usableMedia.map((asset) => asset?.url || asset?.thumbnail_url).filter(Boolean) as string[];
    const mediaTitles = usableMedia.map((asset) => asset?.title || asset?.source || asset?.url).filter(Boolean) as string[];
    const prompt = buildVideoPrompt(payload, product.name, product.description, mediaTitles);
    const aiResult = payload.script
      ? { text: payload.script, provider: "provided-script" }
      : await aiService.generateText(prompt, {
          instructions: buildVideoCreativeInstructions(),
          jsonSchema: {
            name: "automedia_video_creative_plan",
            schema: VIDEO_CREATIVE_PLAN_SCHEMA,
            strict: true,
          },
        });
    const creativePlan = payload.script ? undefined : parseCreativePlan(aiResult.text);
    const script = payload.script || buildScriptFromCreativePlan(creativePlan) || aiResult.text || prompt;
    const productImageUrl = product.image_url || product.uploaded_image_url || "";
    const rawRenderMediaUrls = [...mediaUrls, productImageUrl].filter(Boolean);
    const mediaCache = await cacheRenderMediaUrls(rawRenderMediaUrls, workspaceId || product.workspace_id, product.id);
    const renderMediaUrls = mediaCache.urls;
    const renderPlan = buildRenderPlan(payload, renderMediaUrls, script, product.name, product.description, creativePlan);
    const scenePlan = buildScenePlan(renderPlan, mediaTitles);
    const costEstimate = estimateVideoCost(payload.duration);
    const platforms = payload.platforms?.length ? payload.platforms : payload.platform ? [payload.platform] : [];
    const previewUrl = renderMediaUrls[0] || "";
    const externalAiStartUrl = rawRenderMediaUrls.find(isExternalPublicHttpUrl);
    const queueSourceUrl = shouldUseExternalAiVideoUrl() ? externalAiStartUrl || previewUrl : previewUrl;

    const job = await jobsRepository.create({
      type: "video_generation",
      status: "queued",
      title: `Gerar vídeo de divulgação ${payload.template || payload.style} - ${product.name}`,
      workspace_id: workspaceId || product.workspace_id,
      product_id: product.id,
      progress: 0,
      payload: {
        product_id: product.id,
        product_name: product.name,
        requested_by_user_id: actorId,
        ai_video_stage: "queued",
        template: payload.template || payload.style,
        format: payload.format || "reels",
        ratio: payload.ratio || "9:16",
        duration: payload.duration,
        platform: payload.platform,
        platforms,
        media_asset_ids: payload.media_asset_ids || [],
        reference_image_urls: renderMediaUrls,
        scene_plan: scenePlan,
        creative_plan: creativePlan,
        cost_estimate: costEstimate,
      },
    });

    const asset = await mediaRepository.create({
      product_id: product.id,
      workspace_id: workspaceId || product.workspace_id,
      product_name: product.name,
      type: "generated_video",
      title: `Vídeo de divulgação ${payload.template || payload.style} - ${product.name}`,
      status: "generating",
      source: "Automedia Video Orchestrator",
      url: previewUrl,
      thumbnail_url: previewUrl,
      caption: script,
      platforms,
      quality_score: previewUrl ? 82 : 64,
      duration: payload.duration,
      metadata: {
        ai_provider: aiResult.provider,
        ai_video_provider: env.AI_VIDEO_PROVIDER,
        generation_version: 1,
        render_plan: renderPlan,
        scene_plan: scenePlan,
        creative_plan: creativePlan,
        cost_estimate: costEstimate,
        prompt,
        media_asset_ids: payload.media_asset_ids || [],
        cached_media: mediaCache.cacheMetadata,
        external_ai_start_url: externalAiStartUrl,
        visual_prompt: payload.visual_prompt,
      },
    });

    await auditService.log({
      actor_id: actorId,
      action: "video.generate.requested",
      entity_type: "job",
      entity_id: job.id,
      metadata: {
        product_id: product.id,
        asset_id: asset.id,
        provider: env.AI_VIDEO_PROVIDER,
        duration: payload.duration,
        segments: costEstimate.segments,
        estimated_cost_usd: costEstimate.estimated_cost_usd,
      },
    });

    await productsRepository.update(product.id, {
      status: "review",
      videos_generated: (product.videos_generated || 0) + 1,
    });

    try {
      await enqueueVideoGeneration({
        job_id: job.id,
        asset_id: asset.id,
        requested_by_user_id: actorId,
        product_name: product.name,
        source_url: queueSourceUrl,
        media_urls: renderMediaUrls,
        render_plan: renderPlan,
        scene_plan: scenePlan,
        creative_plan: creativePlan,
        cost_estimate: costEstimate,
        script,
        ai_prompt: prompt,
        duration: payload.duration,
        ratio: payload.ratio || "9:16",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Fila de renderizacao indisponivel";

      await jobsRepository.update(job.id, {
        status: "failed",
        progress: 100,
        media_asset_id: asset.id,
        error_message: message,
      });

      await mediaRepository.update(asset.id, {
        status: "failed",
        review_notes: message,
      });

      throw new AppError(
        "Nao foi possivel enviar o video para a fila de renderizacao. Verifique o REDIS_URL e o worker de video.",
        503,
        "VIDEO_QUEUE_UNAVAILABLE",
      );
    }

    const queuedJob = await jobsRepository.update(job.id, {
      status: "processing",
      progress: 15,
      media_asset_id: asset.id,
      payload: {
        asset_id: asset.id,
        requested_by_user_id: actorId,
        product_name: product.name,
        ai_video_stage: "queued",
        ai_provider: aiResult.provider,
        ai_video_provider: env.AI_VIDEO_PROVIDER,
        prompt,
        render_plan: renderPlan,
        scene_plan: scenePlan,
        cost_estimate: costEstimate,
        cached_media: mediaCache.cacheMetadata,
        external_ai_start_url: externalAiStartUrl,
        media_asset_ids: payload.media_asset_ids || [],
      },
      result: {
        asset_id: asset.id,
        queue: "video_generation",
        cost_estimate: costEstimate,
      },
    });

    return {
      job: queuedJob,
      asset,
      script,
      render_plan: renderPlan,
      creative_plan: creativePlan,
      provider: aiResult.provider,
    };
  },
};
