
## Objetivo
Substituir o gerador round-robin atual por uma lista fixa com a tabela oficial extraída da imagem (12 grupos × 6 jogos = 72 jogos da fase de grupos), com datas/horários e confrontos corretos.

## Tabela oficial (lida da foto)

**Grupo A**
- 11/06 16:00 México × África do Sul
- 11/06 23:00 Coréia do Sul × República Tcheca
- 18/06 13:00 República Tcheca × África do Sul
- 18/06 22:00 México × Coréia do Sul
- 24/06 22:00 República Tcheca × México
- 24/06 22:00 África do Sul × Coréia do Sul

**Grupo B**
- 12/06 16:00 Canadá × Bósnia e Herzegovina
- 13/06 16:00 Catar × Suíça
- 18/06 16:00 Suíça × Bósnia e Herzegovina
- 18/06 19:00 Canadá × Catar
- 24/06 16:00 Suíça × Canadá
- 24/06 16:00 Bósnia e Herzegovina × Catar

**Grupo C**
- 13/06 19:00 Brasil × Marrocos
- 13/06 22:00 Haiti × Escócia
- 19/06 19:00 Escócia × Marrocos
- 19/06 21:30 Brasil × Haiti
- 24/06 19:00 Escócia × Brasil
- 24/06 19:00 Marrocos × Haiti

**Grupo D**
- 12/06 22:00 Estados Unidos × Paraguai
- 14/06 01:00 Austrália × Turquia
- 19/06 16:00 Estados Unidos × Austrália
- 20/06 01:00 Turquia × Paraguai
- 25/06 23:00 Turquia × Estados Unidos
- 25/06 23:00 Paraguai × Austrália

**Grupo E**
- 14/06 14:00 Alemanha × Curaçao
- 14/06 20:00 Costa do Marfim × Equador
- 20/06 17:00 Alemanha × Costa do Marfim
- 20/06 21:00 Equador × Curaçao
- 25/06 17:00 Equador × Alemanha
- 25/06 17:00 Curaçao × Costa do Marfim

**Grupo F**
- 14/06 17:00 Holanda × Japão
- 14/06 23:00 Suécia × Tunísia
- 20/06 14:00 Holanda × Suécia
- 20/06 23:00 Tunísia × Japão
- 25/06 20:00 Japão × Suécia
- 25/06 20:00 Tunísia × Holanda

**Grupo G**
- 15/06 16:00 Bélgica × Egito
- 15/06 22:00 Irã × Nova Zelândia
- 21/06 16:00 Bélgica × Irã
- 21/06 22:00 Nova Zelândia × Egito
- 27/06 00:00 Egito × Irã
- 27/06 00:00 Nova Zelândia × Bélgica

**Grupo H**
- 15/06 13:00 Espanha × Cabo Verde
- 15/06 19:00 Arábia Saudita × Uruguai
- 21/06 13:00 Espanha × Arábia Saudita
- 21/06 19:00 Uruguai × Cabo Verde
- 26/06 21:00 Cabo Verde × Arábia Saudita
- 26/06 21:00 Uruguai × Espanha

**Grupo I**
- 16/06 16:00 França × Senegal
- 16/06 19:00 Iraque × Noruega
- 22/06 18:00 França × Iraque
- 22/06 21:00 Noruega × Senegal
- 26/06 16:00 Noruega × França
- 26/06 16:00 Senegal × Iraque

**Grupo J**
- 16/06 22:00 Argentina × Argélia
- 17/06 01:00 Áustria × Jordânia
- 22/06 14:00 Argentina × Áustria
- 23/06 00:00 Jordânia × Argélia
- 27/06 23:00 Argélia × Áustria
- 27/06 23:00 Jordânia × Argentina

**Grupo K**
- 17/06 14:00 Portugal × RD do Congo
- 17/06 21:00 Uzbequistão × Colômbia
- 23/06 14:00 Portugal × Uzbequistão
- 23/06 23:00 Colômbia × RD do Congo
- 27/06 20:30 Colômbia × Portugal
- 27/06 20:30 RD do Congo × Uzbequistão

**Grupo L**
- 17/06 17:00 Inglaterra × Croácia
- 17/06 20:00 Gana × Panamá
- 23/06 17:00 Inglaterra × Gana
- 23/06 20:00 Panamá × Croácia
- 27/06 18:00 Panamá × Inglaterra
- 27/06 18:00 Croácia × Gana

## Implementação

1. **`src/lib/bolao/fixture2026.ts`**
   - Remover o gerador round-robin automático.
   - Definir array fixo `OFFICIAL_GROUP_MATCHES` com os 72 jogos acima (campos: grupo, fase='grupos', mandante, visitante, data_hora ISO em horário de Brasília `-03:00`).
   - Manter a exportação que `useBolao` usa para reimportação.

2. **Reimportação**
   - Nenhum schema novo. Após o deploy, o usuário clica **"Reimportar tabela oficial"** em `BolaoAdmin` para apagar jogos antigos e inserir a tabela correta.

## Fora de escopo
- Mata-mata (16-avos em diante) — segue como está; pode ser adicionado depois com base na classificação.
- UI do admin e do seletor — sem mudanças.
