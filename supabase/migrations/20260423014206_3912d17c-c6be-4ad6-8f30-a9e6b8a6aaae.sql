CREATE TABLE public.marketing_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid,
  nome text NOT NULL,
  plataforma text NOT NULL,
  categoria text NOT NULL,
  legenda text NOT NULL,
  hashtags text,
  dica text,
  is_padrao boolean NOT NULL DEFAULT false,
  favorito boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.marketing_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view_templates" ON public.marketing_templates
  FOR SELECT USING (is_padrao = true OR empresa_id = public.get_user_empresa_id());

CREATE POLICY "insert_own_templates" ON public.marketing_templates
  FOR INSERT WITH CHECK (
    empresa_id = public.get_user_empresa_id() AND is_padrao = false
  );

CREATE POLICY "update_own_templates" ON public.marketing_templates
  FOR UPDATE USING (
    empresa_id = public.get_user_empresa_id() AND is_padrao = false
  ) WITH CHECK (
    empresa_id = public.get_user_empresa_id() AND is_padrao = false
  );

CREATE POLICY "delete_own_templates" ON public.marketing_templates
  FOR DELETE USING (
    empresa_id = public.get_user_empresa_id() AND is_padrao = false
  );

CREATE TRIGGER update_marketing_templates_updated_at
  BEFORE UPDATE ON public.marketing_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_marketing_templates_empresa ON public.marketing_templates(empresa_id);
CREATE INDEX idx_marketing_templates_plataforma ON public.marketing_templates(plataforma);

-- Seed templates padrão
INSERT INTO public.marketing_templates (empresa_id, nome, plataforma, categoria, legenda, hashtags, dica, is_padrao) VALUES
(NULL, 'Promoção Relâmpago', 'instagram', 'promocao',
 E'🔥 PROMOÇÃO RELÂMPAGO! 🔥\n\n{{produto}} por apenas R$ {{preco}}!\n\n⏰ Só hoje ou enquanto durarem os estoques!\n📞 Peça já: {{telefone}}\n\nUse o cupom: {{cupom}}',
 '#promocao #ofertarelampago #gas #aguamineral #delivery #{{empresa}}',
 'Use imagem chamativa com o produto em destaque e cor vibrante.', true),

(NULL, 'Bom dia + produto', 'instagram', 'engajamento',
 E'☀️ Bom dia!\n\nComeçando o dia com energia aqui na {{empresa}} 💙\n\nJá garantiu seu {{produto}} hoje? A gente entrega rapidinho!\n\n📞 {{telefone}}',
 '#bomdia #motivacao #gas #agua #delivery',
 'Poste entre 6h e 9h para máximo alcance.', true),

(NULL, 'Antes/Depois', 'instagram', 'engajamento',
 E'Acabou o gás na hora do almoço? 😱\n\nRelaxa! A {{empresa}} resolve em minutos. ⚡\n\nPeça agora: {{telefone}}',
 '#gas #delivery #rapido #praticidade',
 'Use carrossel com 2 fotos: situação ruim → solução.', true),

(NULL, 'Carrossel educativo', 'instagram', 'institucional',
 E'📚 Você sabia?\n\n1️⃣ O botijão de gás dura em média 2 meses para uma família de 4 pessoas\n2️⃣ Sempre verifique a validade da mangueira (5 anos)\n3️⃣ Em caso de vazamento, não acenda nada e ligue {{telefone}}\n\nSegurança em primeiro lugar! 🔒',
 '#dicas #segurancagas #educacao #{{empresa}}',
 'Faça carrossel de 3-5 slides, um item por slide.', true),

(NULL, 'Reels — entrega rápida', 'reels', 'engajamento',
 E'⚡ Da sua casa pra mesa em 20 minutos!\n\nÁ {{empresa}} entrega gás e água com agilidade.\n\n📞 {{telefone}}',
 '#reels #delivery #rapido #gas #agua #viral',
 'Vídeo de 15-30s mostrando o trajeto do pedido até a entrega.', true),

(NULL, 'Post institucional', 'facebook', 'institucional',
 E'Há anos atendendo nossa cidade com qualidade e confiança 💙\n\nA {{empresa}} é referência em entrega de gás e água mineral. Atendimento humanizado, preço justo e entrega rápida.\n\n📞 {{telefone}}\n📍 Atendemos toda a região',
 '#tradicao #qualidade #atendimento #{{empresa}}',
 'Use foto da equipe ou da fachada do estabelecimento.', true),

(NULL, 'Promoção semanal', 'facebook', 'promocao',
 E'🎉 OFERTA DA SEMANA!\n\n{{produto}} por R$ {{preco}}\n\nVálido até domingo! Aproveite e peça já.\n\n📞 {{telefone}}\n💳 Aceitamos cartão, PIX e dinheiro',
 '#ofertadasemana #promocao #gas #agua',
 'Boost o post para alcançar mais pessoas da região.', true),

(NULL, 'Depoimento de cliente', 'facebook', 'engajamento',
 E'💬 "Sempre que preciso, peço na {{empresa}}. Chega rapidinho e o atendimento é excelente!"\n\nObrigado pela confiança! ❤️\n\nQuer fazer parte da nossa família de clientes satisfeitos?\n📞 {{telefone}}',
 '#depoimento #clientesatisfeito #qualidade',
 'Use foto real do cliente (com autorização) ou ilustração.', true),

(NULL, 'Status promo', 'whatsapp', 'promocao',
 E'🔥 SÓ HOJE!\n\n{{produto}} por R$ {{preco}}\n\nResponda essa mensagem para pedir! ⚡',
 NULL,
 'Status do WhatsApp: imagem com texto grande e legível.', true),

(NULL, 'Aviso de horário', 'whatsapp', 'institucional',
 E'⏰ HORÁRIO DE FUNCIONAMENTO\n\nSeg a Sex: 7h às 20h\nSábado: 7h às 18h\nDomingo: 8h às 14h\n\n📞 {{telefone}}\n\nA {{empresa}} agradece a preferência! 💙',
 NULL,
 'Envie no início do mês ou em véspera de feriado.', true),

(NULL, 'Lista de transmissão', 'whatsapp', 'engajamento',
 E'Olá! 👋\n\nAqui é da {{empresa}}. Tudo bem?\n\nPassando para avisar que estamos com {{produto}} em promoção essa semana: R$ {{preco}}\n\nQuer aproveitar? Só responder essa mensagem! 😉',
 NULL,
 'Use lista de transmissão (não grupo) para evitar spam.', true),

(NULL, 'Cupom de desconto', 'whatsapp', 'promocao',
 E'🎁 PRESENTE PRA VOCÊ!\n\nUse o cupom *{{cupom}}* e ganhe desconto no seu próximo pedido.\n\nPeça agora: {{telefone}}\n\nVálido até o fim do mês! ⏰',
 NULL,
 'Personalize cupons curtos e fáceis de digitar.', true),

(NULL, 'Dia das Mães', 'instagram', 'data',
 E'💐 Feliz Dia das Mães!\n\nA {{empresa}} deseja a todas as mães um dia repleto de carinho e gratidão. ❤️\n\nObrigado por confiarem em nós para abastecer suas casas!\n\n📞 {{telefone}}',
 '#diadasmaes #gratidao #amor #familia',
 'Poste no domingo de manhã. Use cores quentes (rosa/dourado).', true),

(NULL, 'Natal', 'facebook', 'data',
 E'🎄 Feliz Natal!\n\nA equipe da {{empresa}} deseja a você e sua família muita paz, amor e união neste Natal. ✨\n\nObrigado por mais um ano de parceria!\n\n📞 {{telefone}}',
 '#natal #felicidades #gratidao #{{empresa}}',
 'Agende para 24/12 às 18h.', true),

(NULL, 'Black Friday', 'instagram', 'data',
 E'🖤 BLACK FRIDAY {{empresa}}! 🖤\n\n{{produto}} com desconto IMPERDÍVEL: R$ {{preco}}\n\n⚠️ Só na sexta-feira ou enquanto durar o estoque!\n\nUse o cupom: {{cupom}}\n📞 {{telefone}}',
 '#blackfriday #promocao #desconto #ofertaimperdivel',
 'Imagem com fundo preto e texto em amarelo/dourado.', true);