export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      abastecimentos: {
        Row: {
          acerto_data: string | null
          created_at: string
          data: string
          entregador_id: string | null
          id: string
          km: number
          litros: number
          motorista: string
          nota_fiscal: string | null
          posto: string | null
          sem_saida_caixa: boolean
          status: string
          tipo: string
          unidade_id: string | null
          updated_at: string
          valor: number
          veiculo_id: string
        }
        Insert: {
          acerto_data?: string | null
          created_at?: string
          data?: string
          entregador_id?: string | null
          id?: string
          km: number
          litros: number
          motorista: string
          nota_fiscal?: string | null
          posto?: string | null
          sem_saida_caixa?: boolean
          status?: string
          tipo?: string
          unidade_id?: string | null
          updated_at?: string
          valor: number
          veiculo_id: string
        }
        Update: {
          acerto_data?: string | null
          created_at?: string
          data?: string
          entregador_id?: string | null
          id?: string
          km?: number
          litros?: number
          motorista?: string
          nota_fiscal?: string | null
          posto?: string | null
          sem_saida_caixa?: boolean
          status?: string
          tipo?: string
          unidade_id?: string | null
          updated_at?: string
          valor?: number
          veiculo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "abastecimentos_entregador_id_fkey"
            columns: ["entregador_id"]
            isOneToOne: false
            referencedRelation: "entregadores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "abastecimentos_entregador_id_fkey"
            columns: ["entregador_id"]
            isOneToOne: false
            referencedRelation: "vw_alertas_cnh"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "abastecimentos_entregador_id_fkey"
            columns: ["entregador_id"]
            isOneToOne: false
            referencedRelation: "vw_comissao_entregador"
            referencedColumns: ["entregador_id"]
          },
          {
            foreignKeyName: "abastecimentos_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "abastecimentos_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "veiculos"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_conversas: {
        Row: {
          archived_at: string | null
          assigned_to_user_id: string | null
          closed_at: string | null
          created_at: string
          empresa_id: string | null
          foto_atualizada_em: string | null
          foto_url: string | null
          id: string
          pedido_id: string | null
          status: string
          subject: string | null
          telefone: string | null
          titulo: string
          transferred_at: string | null
          transferred_to_user_id: string | null
          unidade_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          assigned_to_user_id?: string | null
          closed_at?: string | null
          created_at?: string
          empresa_id?: string | null
          foto_atualizada_em?: string | null
          foto_url?: string | null
          id?: string
          pedido_id?: string | null
          status?: string
          subject?: string | null
          telefone?: string | null
          titulo?: string
          transferred_at?: string | null
          transferred_to_user_id?: string | null
          unidade_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          archived_at?: string | null
          assigned_to_user_id?: string | null
          closed_at?: string | null
          created_at?: string
          empresa_id?: string | null
          foto_atualizada_em?: string | null
          foto_url?: string | null
          id?: string
          pedido_id?: string | null
          status?: string
          subject?: string | null
          telefone?: string | null
          titulo?: string
          transferred_at?: string | null
          transferred_to_user_id?: string | null
          unidade_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_mensagens: {
        Row: {
          content: string
          conversa_id: string
          created_at: string
          delivered_at: string | null
          direction: string | null
          error_message: string | null
          id: string
          metadata: Json | null
          read_at: string | null
          role: string
          sent_at: string | null
          status: string | null
          wa_message_id: string | null
        }
        Insert: {
          content: string
          conversa_id: string
          created_at?: string
          delivered_at?: string | null
          direction?: string | null
          error_message?: string | null
          id?: string
          metadata?: Json | null
          read_at?: string | null
          role: string
          sent_at?: string | null
          status?: string | null
          wa_message_id?: string | null
        }
        Update: {
          content?: string
          conversa_id?: string
          created_at?: string
          delivered_at?: string | null
          direction?: string | null
          error_message?: string | null
          id?: string
          metadata?: Json | null
          read_at?: string | null
          role?: string
          sent_at?: string | null
          status?: string | null
          wa_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_mensagens_conversa_id_fkey"
            columns: ["conversa_id"]
            isOneToOne: false
            referencedRelation: "ai_conversas"
            referencedColumns: ["id"]
          },
        ]
      }
      alcadas_aprovacao: {
        Row: {
          cargo_aprovador: string
          created_at: string
          empresa_id: string
          id: string
          nivel: number
          tipo: string
          unidade_id: string | null
          updated_at: string
          valor_maximo: number | null
          valor_minimo: number | null
        }
        Insert: {
          cargo_aprovador: string
          created_at?: string
          empresa_id: string
          id?: string
          nivel?: number
          tipo: string
          unidade_id?: string | null
          updated_at?: string
          valor_maximo?: number | null
          valor_minimo?: number | null
        }
        Update: {
          cargo_aprovador?: string
          created_at?: string
          empresa_id?: string
          id?: string
          nivel?: number
          tipo?: string
          unidade_id?: string | null
          updated_at?: string
          valor_maximo?: number | null
          valor_minimo?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "alcadas_aprovacao_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alcadas_aprovacao_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      alertas_jornada: {
        Row: {
          created_at: string
          data: string
          descricao: string
          funcionario_id: string
          id: string
          nivel: string
          resolvido: boolean
          tipo: string
          unidade_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          data?: string
          descricao: string
          funcionario_id: string
          id?: string
          nivel?: string
          resolvido?: boolean
          tipo: string
          unidade_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          data?: string
          descricao?: string
          funcionario_id?: string
          id?: string
          nivel?: string
          resolvido?: boolean
          tipo?: string
          unidade_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "alertas_jornada_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alertas_jornada_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      anotacoes: {
        Row: {
          concluido: boolean
          conteudo: string | null
          cor: string
          created_at: string
          fixado: boolean
          id: string
          lembrete_data: string | null
          titulo: string
          updated_at: string
          user_id: string
        }
        Insert: {
          concluido?: boolean
          conteudo?: string | null
          cor?: string
          created_at?: string
          fixado?: boolean
          id?: string
          lembrete_data?: string | null
          titulo: string
          updated_at?: string
          user_id: string
        }
        Update: {
          concluido?: boolean
          conteudo?: string | null
          cor?: string
          created_at?: string
          fixado?: boolean
          id?: string
          lembrete_data?: string | null
          titulo?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      aprovacoes: {
        Row: {
          aprovador_id: string | null
          created_at: string
          data_decisao: string | null
          descricao: string
          empresa_id: string
          id: string
          nivel_atual: number
          observacoes: string | null
          registro_id: string | null
          solicitante_id: string
          status: string
          tabela_origem: string | null
          tipo: string
          unidade_id: string | null
          updated_at: string
          valor: number | null
        }
        Insert: {
          aprovador_id?: string | null
          created_at?: string
          data_decisao?: string | null
          descricao: string
          empresa_id: string
          id?: string
          nivel_atual?: number
          observacoes?: string | null
          registro_id?: string | null
          solicitante_id: string
          status?: string
          tabela_origem?: string | null
          tipo: string
          unidade_id?: string | null
          updated_at?: string
          valor?: number | null
        }
        Update: {
          aprovador_id?: string | null
          created_at?: string
          data_decisao?: string | null
          descricao?: string
          empresa_id?: string
          id?: string
          nivel_atual?: number
          observacoes?: string | null
          registro_id?: string | null
          solicitante_id?: string
          status?: string
          tabela_origem?: string | null
          tipo?: string
          unidade_id?: string | null
          updated_at?: string
          valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "aprovacoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aprovacoes_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      atestados_faltas: {
        Row: {
          abona: boolean
          created_at: string
          data_fim: string
          data_inicio: string
          dias: number
          documento_url: string | null
          funcionario_id: string
          id: string
          motivo: string | null
          tipo: string
          unidade_id: string | null
          updated_at: string
        }
        Insert: {
          abona?: boolean
          created_at?: string
          data_fim?: string
          data_inicio?: string
          dias?: number
          documento_url?: string | null
          funcionario_id: string
          id?: string
          motivo?: string | null
          tipo?: string
          unidade_id?: string | null
          updated_at?: string
        }
        Update: {
          abona?: boolean
          created_at?: string
          data_fim?: string
          data_inicio?: string
          dias?: number
          documento_url?: string | null
          funcionario_id?: string
          id?: string
          motivo?: string | null
          tipo?: string
          unidade_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "atestados_faltas_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atestados_faltas_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          created_at: string
          dados_antigos: Json | null
          dados_novos: Json | null
          empresa_id: string | null
          id: string
          ip_address: string | null
          operacao: string
          registro_id: string | null
          tabela: string
          unidade_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          dados_antigos?: Json | null
          dados_novos?: Json | null
          empresa_id?: string | null
          id?: string
          ip_address?: string | null
          operacao: string
          registro_id?: string | null
          tabela: string
          unidade_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          dados_antigos?: Json | null
          dados_novos?: Json | null
          empresa_id?: string | null
          id?: string
          ip_address?: string | null
          operacao?: string
          registro_id?: string | null
          tabela?: string
          unidade_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      avaliacoes_desempenho: {
        Row: {
          avaliador_id: string | null
          comunicacao: number | null
          created_at: string
          data_avaliacao: string
          funcionario_id: string
          id: string
          iniciativa: number | null
          metas_proximas: string | null
          nota_geral: number
          observacoes: string | null
          periodo_referencia: string
          pontos_fortes: string | null
          pontos_melhorar: string | null
          pontualidade: number | null
          produtividade: number | null
          status: string
          trabalho_equipe: number | null
          unidade_id: string | null
          updated_at: string
        }
        Insert: {
          avaliador_id?: string | null
          comunicacao?: number | null
          created_at?: string
          data_avaliacao?: string
          funcionario_id: string
          id?: string
          iniciativa?: number | null
          metas_proximas?: string | null
          nota_geral?: number
          observacoes?: string | null
          periodo_referencia: string
          pontos_fortes?: string | null
          pontos_melhorar?: string | null
          pontualidade?: number | null
          produtividade?: number | null
          status?: string
          trabalho_equipe?: number | null
          unidade_id?: string | null
          updated_at?: string
        }
        Update: {
          avaliador_id?: string | null
          comunicacao?: number | null
          created_at?: string
          data_avaliacao?: string
          funcionario_id?: string
          id?: string
          iniciativa?: number | null
          metas_proximas?: string | null
          nota_geral?: number
          observacoes?: string | null
          periodo_referencia?: string
          pontos_fortes?: string | null
          pontos_melhorar?: string | null
          pontualidade?: number | null
          produtividade?: number | null
          status?: string
          trabalho_equipe?: number | null
          unidade_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "avaliacoes_desempenho_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avaliacoes_desempenho_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      avaliacoes_entrega: {
        Row: {
          comentario: string | null
          created_at: string
          entregador_id: string | null
          id: string
          nota_entregador: number | null
          nota_produto: number | null
          pedido_id: string | null
          user_id: string
        }
        Insert: {
          comentario?: string | null
          created_at?: string
          entregador_id?: string | null
          id?: string
          nota_entregador?: number | null
          nota_produto?: number | null
          pedido_id?: string | null
          user_id: string
        }
        Update: {
          comentario?: string | null
          created_at?: string
          entregador_id?: string | null
          id?: string
          nota_entregador?: number | null
          nota_produto?: number | null
          pedido_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "avaliacoes_entrega_entregador_id_fkey"
            columns: ["entregador_id"]
            isOneToOne: false
            referencedRelation: "entregadores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avaliacoes_entrega_entregador_id_fkey"
            columns: ["entregador_id"]
            isOneToOne: false
            referencedRelation: "vw_alertas_cnh"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avaliacoes_entrega_entregador_id_fkey"
            columns: ["entregador_id"]
            isOneToOne: false
            referencedRelation: "vw_comissao_entregador"
            referencedColumns: ["entregador_id"]
          },
          {
            foreignKeyName: "avaliacoes_entrega_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
        ]
      }
      banco_horas: {
        Row: {
          created_at: string
          funcionario_id: string
          id: string
          observacoes: string | null
          saldo_negativo: number
          saldo_positivo: number
          ultima_atualizacao: string
          unidade_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          funcionario_id: string
          id?: string
          observacoes?: string | null
          saldo_negativo?: number
          saldo_positivo?: number
          ultima_atualizacao?: string
          unidade_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          funcionario_id?: string
          id?: string
          observacoes?: string | null
          saldo_negativo?: number
          saldo_positivo?: number
          ultima_atualizacao?: string
          unidade_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "banco_horas_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "banco_horas_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      boletos_emitidos: {
        Row: {
          conta_receber_id: string | null
          cpf_cnpj: string
          created_at: string
          descricao: string | null
          emissao: string
          endereco: string | null
          id: string
          instrucoes: string | null
          juros_mes: number | null
          linha_digitavel: string | null
          multa: number | null
          numero: number
          observacoes: string | null
          sacado: string
          status: string
          unidade_id: string | null
          updated_at: string
          valor: number
          vencimento: string
        }
        Insert: {
          conta_receber_id?: string | null
          cpf_cnpj: string
          created_at?: string
          descricao?: string | null
          emissao?: string
          endereco?: string | null
          id?: string
          instrucoes?: string | null
          juros_mes?: number | null
          linha_digitavel?: string | null
          multa?: number | null
          numero?: number
          observacoes?: string | null
          sacado: string
          status?: string
          unidade_id?: string | null
          updated_at?: string
          valor?: number
          vencimento: string
        }
        Update: {
          conta_receber_id?: string | null
          cpf_cnpj?: string
          created_at?: string
          descricao?: string | null
          emissao?: string
          endereco?: string | null
          id?: string
          instrucoes?: string | null
          juros_mes?: number | null
          linha_digitavel?: string | null
          multa?: number | null
          numero?: number
          observacoes?: string | null
          sacado?: string
          status?: string
          unidade_id?: string | null
          updated_at?: string
          valor?: number
          vencimento?: string
        }
        Relationships: [
          {
            foreignKeyName: "boletos_emitidos_conta_receber_id_fkey"
            columns: ["conta_receber_id"]
            isOneToOne: false
            referencedRelation: "contas_receber"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boletos_emitidos_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      bonus: {
        Row: {
          created_at: string
          funcionario_id: string
          id: string
          mes_referencia: string | null
          observacoes: string | null
          status: string
          tipo: string
          unidade_id: string | null
          updated_at: string
          valor: number
        }
        Insert: {
          created_at?: string
          funcionario_id: string
          id?: string
          mes_referencia?: string | null
          observacoes?: string | null
          status?: string
          tipo?: string
          unidade_id?: string | null
          updated_at?: string
          valor?: number
        }
        Update: {
          created_at?: string
          funcionario_id?: string
          id?: string
          mes_referencia?: string | null
          observacoes?: string | null
          status?: string
          tipo?: string
          unidade_id?: string | null
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "bonus_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bonus_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      caixa_sessoes: {
        Row: {
          aberto_em: string
          bloqueado: boolean
          created_at: string
          data: string
          desbloqueado_em: string | null
          desbloqueado_por: string | null
          diferenca: number | null
          fechado_em: string | null
          id: string
          observacoes_abertura: string | null
          observacoes_fechamento: string | null
          status: string
          unidade_id: string | null
          updated_at: string
          usuario_abertura_id: string
          usuario_fechamento_id: string | null
          valor_abertura: number
          valor_fechamento: number | null
        }
        Insert: {
          aberto_em?: string
          bloqueado?: boolean
          created_at?: string
          data?: string
          desbloqueado_em?: string | null
          desbloqueado_por?: string | null
          diferenca?: number | null
          fechado_em?: string | null
          id?: string
          observacoes_abertura?: string | null
          observacoes_fechamento?: string | null
          status?: string
          unidade_id?: string | null
          updated_at?: string
          usuario_abertura_id: string
          usuario_fechamento_id?: string | null
          valor_abertura?: number
          valor_fechamento?: number | null
        }
        Update: {
          aberto_em?: string
          bloqueado?: boolean
          created_at?: string
          data?: string
          desbloqueado_em?: string | null
          desbloqueado_por?: string | null
          diferenca?: number | null
          fechado_em?: string | null
          id?: string
          observacoes_abertura?: string | null
          observacoes_fechamento?: string | null
          status?: string
          unidade_id?: string | null
          updated_at?: string
          usuario_abertura_id?: string
          usuario_fechamento_id?: string | null
          valor_abertura?: number
          valor_fechamento?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "caixa_sessoes_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      campanhas: {
        Row: {
          alcance: number
          created_at: string
          data_criacao: string
          enviados: number
          id: string
          nome: string
          status: string
          tipo: string
          unidade_id: string | null
          updated_at: string
        }
        Insert: {
          alcance?: number
          created_at?: string
          data_criacao?: string
          enviados?: number
          id?: string
          nome: string
          status?: string
          tipo: string
          unidade_id?: string | null
          updated_at?: string
        }
        Update: {
          alcance?: number
          created_at?: string
          data_criacao?: string
          enviados?: number
          id?: string
          nome?: string
          status?: string
          tipo?: string
          unidade_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campanhas_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      canais_venda: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string | null
          id: string
          nome: string
          parceiro_id: string | null
          tipo: string
          unidade_id: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
          parceiro_id?: string | null
          tipo?: string
          unidade_id?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
          parceiro_id?: string | null
          tipo?: string
          unidade_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "canais_venda_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      carregamento_rota_itens: {
        Row: {
          carregamento_id: string
          created_at: string
          id: string
          produto_id: string
          quantidade_retorno: number | null
          quantidade_saida: number
          quantidade_transferida: number | null
          quantidade_vendida: number | null
        }
        Insert: {
          carregamento_id: string
          created_at?: string
          id?: string
          produto_id: string
          quantidade_retorno?: number | null
          quantidade_saida?: number
          quantidade_transferida?: number | null
          quantidade_vendida?: number | null
        }
        Update: {
          carregamento_id?: string
          created_at?: string
          id?: string
          produto_id?: string
          quantidade_retorno?: number | null
          quantidade_saida?: number
          quantidade_transferida?: number | null
          quantidade_vendida?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "carregamento_rota_itens_carregamento_id_fkey"
            columns: ["carregamento_id"]
            isOneToOne: false
            referencedRelation: "carregamentos_rota"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "carregamento_rota_itens_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      carregamentos_rota: {
        Row: {
          created_at: string
          data_retorno: string | null
          data_saida: string
          entregador_id: string
          id: string
          observacoes: string | null
          rota_definida_id: string | null
          status: string
          unidade_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          data_retorno?: string | null
          data_saida?: string
          entregador_id: string
          id?: string
          observacoes?: string | null
          rota_definida_id?: string | null
          status?: string
          unidade_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          data_retorno?: string | null
          data_saida?: string
          entregador_id?: string
          id?: string
          observacoes?: string | null
          rota_definida_id?: string | null
          status?: string
          unidade_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "carregamentos_rota_entregador_id_fkey"
            columns: ["entregador_id"]
            isOneToOne: false
            referencedRelation: "entregadores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "carregamentos_rota_entregador_id_fkey"
            columns: ["entregador_id"]
            isOneToOne: false
            referencedRelation: "vw_alertas_cnh"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "carregamentos_rota_entregador_id_fkey"
            columns: ["entregador_id"]
            isOneToOne: false
            referencedRelation: "vw_comissao_entregador"
            referencedColumns: ["entregador_id"]
          },
          {
            foreignKeyName: "carregamentos_rota_rota_definida_id_fkey"
            columns: ["rota_definida_id"]
            isOneToOne: false
            referencedRelation: "rotas_definidas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "carregamentos_rota_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      categorias_despesa: {
        Row: {
          ativo: boolean
          codigo_contabil: string | null
          created_at: string
          descricao: string | null
          grupo: string
          id: string
          nome: string
          ordem: number
          tipo: string
          unidade_id: string | null
          updated_at: string
          valor_padrao: number | null
        }
        Insert: {
          ativo?: boolean
          codigo_contabil?: string | null
          created_at?: string
          descricao?: string | null
          grupo?: string
          id?: string
          nome: string
          ordem?: number
          tipo?: string
          unidade_id?: string | null
          updated_at?: string
          valor_padrao?: number | null
        }
        Update: {
          ativo?: boolean
          codigo_contabil?: string | null
          created_at?: string
          descricao?: string | null
          grupo?: string
          id?: string
          nome?: string
          ordem?: number
          tipo?: string
          unidade_id?: string | null
          updated_at?: string
          valor_padrao?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "categorias_despesa_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      certidoes_empresa: {
        Row: {
          arquivo_nome: string | null
          arquivo_url: string | null
          created_at: string
          created_by: string | null
          dados_json: Json | null
          data_emissao: string | null
          data_vencimento: string | null
          empresa_id: string
          id: string
          numero: string | null
          origem: string
          proxima_consulta_at: string | null
          status: string
          tipo: string
          ultima_consulta_at: string | null
          ultimo_erro: string | null
          unidade_id: string
          updated_at: string
        }
        Insert: {
          arquivo_nome?: string | null
          arquivo_url?: string | null
          created_at?: string
          created_by?: string | null
          dados_json?: Json | null
          data_emissao?: string | null
          data_vencimento?: string | null
          empresa_id: string
          id?: string
          numero?: string | null
          origem?: string
          proxima_consulta_at?: string | null
          status?: string
          tipo: string
          ultima_consulta_at?: string | null
          ultimo_erro?: string | null
          unidade_id: string
          updated_at?: string
        }
        Update: {
          arquivo_nome?: string | null
          arquivo_url?: string | null
          created_at?: string
          created_by?: string | null
          dados_json?: Json | null
          data_emissao?: string | null
          data_vencimento?: string | null
          empresa_id?: string
          id?: string
          numero?: string | null
          origem?: string
          proxima_consulta_at?: string | null
          status?: string
          tipo?: string
          ultima_consulta_at?: string | null
          ultimo_erro?: string | null
          unidade_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "certidoes_empresa_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      chamadas_recebidas: {
        Row: {
          atendente_id: string | null
          cliente_id: string | null
          cliente_nome: string | null
          created_at: string
          did: string | null
          duracao_segundos: number | null
          empresa_id: string | null
          id: string
          observacoes: string | null
          pedido_gerado_id: string | null
          status: string
          telefone: string
          tipo: string
          unidade_id: string | null
          updated_at: string
        }
        Insert: {
          atendente_id?: string | null
          cliente_id?: string | null
          cliente_nome?: string | null
          created_at?: string
          did?: string | null
          duracao_segundos?: number | null
          empresa_id?: string | null
          id?: string
          observacoes?: string | null
          pedido_gerado_id?: string | null
          status?: string
          telefone: string
          tipo?: string
          unidade_id?: string | null
          updated_at?: string
        }
        Update: {
          atendente_id?: string | null
          cliente_id?: string | null
          cliente_nome?: string | null
          created_at?: string
          did?: string | null
          duracao_segundos?: number | null
          empresa_id?: string | null
          id?: string
          observacoes?: string | null
          pedido_gerado_id?: string | null
          status?: string
          telefone?: string
          tipo?: string
          unidade_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chamadas_recebidas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chamadas_recebidas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chamadas_recebidas_pedido_gerado_id_fkey"
            columns: ["pedido_gerado_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chamadas_recebidas_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_mensagens: {
        Row: {
          created_at: string
          destinatario_id: string | null
          destinatario_tipo: string
          id: string
          lida: boolean
          mensagem: string
          pedido_id: string | null
          remetente_id: string
          remetente_nome: string | null
          remetente_tipo: string
        }
        Insert: {
          created_at?: string
          destinatario_id?: string | null
          destinatario_tipo?: string
          id?: string
          lida?: boolean
          mensagem: string
          pedido_id?: string | null
          remetente_id: string
          remetente_nome?: string | null
          remetente_tipo?: string
        }
        Update: {
          created_at?: string
          destinatario_id?: string | null
          destinatario_tipo?: string
          id?: string
          lida?: boolean
          mensagem?: string
          pedido_id?: string | null
          remetente_id?: string
          remetente_nome?: string | null
          remetente_tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_mensagens_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_saida_veiculo: {
        Row: {
          agua: boolean
          aprovado: boolean
          avarias: boolean
          created_at: string
          data: string
          documentos: boolean
          entregador_id: string
          freios: boolean
          id: string
          limpeza: boolean
          luzes: boolean
          observacoes: string | null
          oleo: boolean
          pneus: boolean
          unidade_id: string | null
          veiculo_id: string
        }
        Insert: {
          agua?: boolean
          aprovado?: boolean
          avarias?: boolean
          created_at?: string
          data?: string
          documentos?: boolean
          entregador_id: string
          freios?: boolean
          id?: string
          limpeza?: boolean
          luzes?: boolean
          observacoes?: string | null
          oleo?: boolean
          pneus?: boolean
          unidade_id?: string | null
          veiculo_id: string
        }
        Update: {
          agua?: boolean
          aprovado?: boolean
          avarias?: boolean
          created_at?: string
          data?: string
          documentos?: boolean
          entregador_id?: string
          freios?: boolean
          id?: string
          limpeza?: boolean
          luzes?: boolean
          observacoes?: string | null
          oleo?: boolean
          pneus?: boolean
          unidade_id?: string | null
          veiculo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_saida_veiculo_entregador_id_fkey"
            columns: ["entregador_id"]
            isOneToOne: false
            referencedRelation: "entregadores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_saida_veiculo_entregador_id_fkey"
            columns: ["entregador_id"]
            isOneToOne: false
            referencedRelation: "vw_alertas_cnh"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_saida_veiculo_entregador_id_fkey"
            columns: ["entregador_id"]
            isOneToOne: false
            referencedRelation: "vw_comissao_entregador"
            referencedColumns: ["entregador_id"]
          },
          {
            foreignKeyName: "checklist_saida_veiculo_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_saida_veiculo_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "veiculos"
            referencedColumns: ["id"]
          },
        ]
      }
      cheques: {
        Row: {
          agencia: string | null
          banco_emitente: string
          cliente_id: string | null
          conta: string | null
          created_at: string
          data_compensacao: string | null
          data_emissao: string
          data_vencimento: string
          depositado_em_conta_id: string | null
          foto_url: string | null
          id: string
          motivo_devolucao: string | null
          numero_cheque: string
          observacoes: string | null
          pedido_id: string | null
          status: string
          unidade_id: string | null
          updated_at: string
          user_id: string
          valor: number
        }
        Insert: {
          agencia?: string | null
          banco_emitente: string
          cliente_id?: string | null
          conta?: string | null
          created_at?: string
          data_compensacao?: string | null
          data_emissao?: string
          data_vencimento: string
          depositado_em_conta_id?: string | null
          foto_url?: string | null
          id?: string
          motivo_devolucao?: string | null
          numero_cheque: string
          observacoes?: string | null
          pedido_id?: string | null
          status?: string
          unidade_id?: string | null
          updated_at?: string
          user_id: string
          valor: number
        }
        Update: {
          agencia?: string | null
          banco_emitente?: string
          cliente_id?: string | null
          conta?: string | null
          created_at?: string
          data_compensacao?: string | null
          data_emissao?: string
          data_vencimento?: string
          depositado_em_conta_id?: string | null
          foto_url?: string | null
          id?: string
          motivo_devolucao?: string | null
          numero_cheque?: string
          observacoes?: string | null
          pedido_id?: string | null
          status?: string
          unidade_id?: string | null
          updated_at?: string
          user_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "cheques_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cheques_depositado_em_conta_id_fkey"
            columns: ["depositado_em_conta_id"]
            isOneToOne: false
            referencedRelation: "contas_bancarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cheques_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cheques_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      cliente_creditos: {
        Row: {
          cliente_id: string
          created_at: string
          descricao: string
          empresa_id: string
          expira_em: string | null
          id: string
          indicacao_id: string | null
          natureza: string
          pedido_id: string | null
          status: string
          tipo: string
          updated_at: string
          valor: number
        }
        Insert: {
          cliente_id: string
          created_at?: string
          descricao: string
          empresa_id: string
          expira_em?: string | null
          id?: string
          indicacao_id?: string | null
          natureza?: string
          pedido_id?: string | null
          status?: string
          tipo?: string
          updated_at?: string
          valor: number
        }
        Update: {
          cliente_id?: string
          created_at?: string
          descricao?: string
          empresa_id?: string
          expira_em?: string | null
          id?: string
          indicacao_id?: string | null
          natureza?: string
          pedido_id?: string | null
          status?: string
          tipo?: string
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "cliente_creditos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cliente_creditos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cliente_creditos_indicacao_id_fkey"
            columns: ["indicacao_id"]
            isOneToOne: false
            referencedRelation: "cliente_indicacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cliente_creditos_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
        ]
      }
      cliente_enderecos: {
        Row: {
          apelido: string
          bairro: string
          cep: string | null
          cidade: string | null
          cliente_id: string | null
          complemento: string | null
          created_at: string
          id: string
          latitude: number | null
          longitude: number | null
          numero: string
          principal: boolean | null
          referencia: string | null
          rua: string
          updated_at: string
          user_id: string
        }
        Insert: {
          apelido?: string
          bairro: string
          cep?: string | null
          cidade?: string | null
          cliente_id?: string | null
          complemento?: string | null
          created_at?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          numero: string
          principal?: boolean | null
          referencia?: string | null
          rua: string
          updated_at?: string
          user_id: string
        }
        Update: {
          apelido?: string
          bairro?: string
          cep?: string | null
          cidade?: string | null
          cliente_id?: string | null
          complemento?: string | null
          created_at?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          numero?: string
          principal?: boolean | null
          referencia?: string | null
          rua?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cliente_enderecos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      cliente_indicacoes: {
        Row: {
          codigo_indicacao: string
          convertido_em: string | null
          created_at: string
          empresa_id: string
          id: string
          indicado_cliente_id: string
          indicador_cliente_id: string
          primeiro_pedido_id: string | null
          status: string
          updated_at: string
          valor_credito_indicado: number
          valor_credito_indicador: number
        }
        Insert: {
          codigo_indicacao: string
          convertido_em?: string | null
          created_at?: string
          empresa_id: string
          id?: string
          indicado_cliente_id: string
          indicador_cliente_id: string
          primeiro_pedido_id?: string | null
          status?: string
          updated_at?: string
          valor_credito_indicado?: number
          valor_credito_indicador?: number
        }
        Update: {
          codigo_indicacao?: string
          convertido_em?: string | null
          created_at?: string
          empresa_id?: string
          id?: string
          indicado_cliente_id?: string
          indicador_cliente_id?: string
          primeiro_pedido_id?: string | null
          status?: string
          updated_at?: string
          valor_credito_indicado?: number
          valor_credito_indicador?: number
        }
        Relationships: [
          {
            foreignKeyName: "cliente_indicacoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cliente_indicacoes_indicado_cliente_id_fkey"
            columns: ["indicado_cliente_id"]
            isOneToOne: true
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cliente_indicacoes_indicador_cliente_id_fkey"
            columns: ["indicador_cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cliente_indicacoes_primeiro_pedido_id_fkey"
            columns: ["primeiro_pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
        ]
      }
      cliente_observacoes: {
        Row: {
          autor_id: string | null
          cliente_id: string
          created_at: string
          id: string
          texto: string
          updated_at: string
        }
        Insert: {
          autor_id?: string | null
          cliente_id: string
          created_at?: string
          id?: string
          texto: string
          updated_at?: string
        }
        Update: {
          autor_id?: string | null
          cliente_id?: string
          created_at?: string
          id?: string
          texto?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cliente_observacoes_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      cliente_precos_negociados: {
        Row: {
          ativo: boolean
          cliente_id: string
          created_at: string
          empresa_id: string
          id: string
          observacao: string | null
          preco_negociado: number
          produto_id: string
          unidade_id: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cliente_id: string
          created_at?: string
          empresa_id: string
          id?: string
          observacao?: string | null
          preco_negociado: number
          produto_id: string
          unidade_id?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cliente_id?: string
          created_at?: string
          empresa_id?: string
          id?: string
          observacao?: string | null
          preco_negociado?: number
          produto_id?: string
          unidade_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cliente_precos_negociados_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cliente_precos_negociados_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cliente_precos_negociados_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cliente_precos_negociados_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      cliente_tag_associacoes: {
        Row: {
          cliente_id: string
          created_at: string
          id: string
          tag_id: string
        }
        Insert: {
          cliente_id: string
          created_at?: string
          id?: string
          tag_id: string
        }
        Update: {
          cliente_id?: string
          created_at?: string
          id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cliente_tag_associacoes_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cliente_tag_associacoes_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "cliente_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      cliente_tags: {
        Row: {
          cor: string
          created_at: string
          empresa_id: string | null
          id: string
          nome: string
        }
        Insert: {
          cor?: string
          created_at?: string
          empresa_id?: string | null
          id?: string
          nome: string
        }
        Update: {
          cor?: string
          created_at?: string
          empresa_id?: string | null
          id?: string
          nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "cliente_tags_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      cliente_unidades: {
        Row: {
          cliente_id: string
          created_at: string
          id: string
          unidade_id: string
        }
        Insert: {
          cliente_id: string
          created_at?: string
          id?: string
          unidade_id: string
        }
        Update: {
          cliente_id?: string
          created_at?: string
          id?: string
          unidade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cliente_unidades_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cliente_unidades_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      clientes: {
        Row: {
          ativo: boolean | null
          bairro: string | null
          bloqueio_credito: boolean | null
          cep: string | null
          cidade: string | null
          cnpj: string | null
          codigo_cliente: number | null
          codigo_indicacao: string | null
          codigo_indicacao_usado: string | null
          codigo_municipio: string | null
          cpf: string | null
          created_at: string
          data_ultimo_pagamento: string | null
          email: string | null
          empresa_id: string | null
          endereco: string | null
          estado: string | null
          id: string
          indicado_por_cliente_id: string | null
          inscricao_estadual: string | null
          latitude: number | null
          limite_credito: number | null
          longitude: number | null
          motivo_bloqueio: string | null
          nome: string
          nome_fantasia: string | null
          numero: string | null
          razao_social: string | null
          saldo_devedor: number | null
          score_risco: string | null
          telefone: string | null
          tipo: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean | null
          bairro?: string | null
          bloqueio_credito?: boolean | null
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          codigo_cliente?: number | null
          codigo_indicacao?: string | null
          codigo_indicacao_usado?: string | null
          codigo_municipio?: string | null
          cpf?: string | null
          created_at?: string
          data_ultimo_pagamento?: string | null
          email?: string | null
          empresa_id?: string | null
          endereco?: string | null
          estado?: string | null
          id?: string
          indicado_por_cliente_id?: string | null
          inscricao_estadual?: string | null
          latitude?: number | null
          limite_credito?: number | null
          longitude?: number | null
          motivo_bloqueio?: string | null
          nome: string
          nome_fantasia?: string | null
          numero?: string | null
          razao_social?: string | null
          saldo_devedor?: number | null
          score_risco?: string | null
          telefone?: string | null
          tipo?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean | null
          bairro?: string | null
          bloqueio_credito?: boolean | null
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          codigo_cliente?: number | null
          codigo_indicacao?: string | null
          codigo_indicacao_usado?: string | null
          codigo_municipio?: string | null
          cpf?: string | null
          created_at?: string
          data_ultimo_pagamento?: string | null
          email?: string | null
          empresa_id?: string | null
          endereco?: string | null
          estado?: string | null
          id?: string
          indicado_por_cliente_id?: string | null
          inscricao_estadual?: string | null
          latitude?: number | null
          limite_credito?: number | null
          longitude?: number | null
          motivo_bloqueio?: string | null
          nome?: string
          nome_fantasia?: string | null
          numero?: string | null
          razao_social?: string | null
          saldo_devedor?: number | null
          score_risco?: string | null
          telefone?: string | null
          tipo?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clientes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clientes_indicado_por_cliente_id_fkey"
            columns: ["indicado_por_cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      comissao_config: {
        Row: {
          canal_venda: string
          created_at: string
          funcionario_id: string | null
          id: string
          produto_id: string
          unidade_id: string | null
          updated_at: string
          valor: number
        }
        Insert: {
          canal_venda: string
          created_at?: string
          funcionario_id?: string | null
          id?: string
          produto_id: string
          unidade_id?: string | null
          updated_at?: string
          valor?: number
        }
        Update: {
          canal_venda?: string
          created_at?: string
          funcionario_id?: string | null
          id?: string
          produto_id?: string
          unidade_id?: string | null
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "comissao_config_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comissao_config_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comissao_config_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      comodatos: {
        Row: {
          cliente_id: string
          created_at: string
          data_devolucao: string | null
          data_emprestimo: string
          deposito: number
          id: string
          observacoes: string | null
          prazo_devolucao: string | null
          produto_id: string
          quantidade: number
          status: string
          unidade_id: string | null
          updated_at: string
        }
        Insert: {
          cliente_id: string
          created_at?: string
          data_devolucao?: string | null
          data_emprestimo?: string
          deposito?: number
          id?: string
          observacoes?: string | null
          prazo_devolucao?: string | null
          produto_id: string
          quantidade?: number
          status?: string
          unidade_id?: string | null
          updated_at?: string
        }
        Update: {
          cliente_id?: string
          created_at?: string
          data_devolucao?: string | null
          data_emprestimo?: string
          deposito?: number
          id?: string
          observacoes?: string | null
          prazo_devolucao?: string | null
          produto_id?: string
          quantidade?: number
          status?: string
          unidade_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "comodatos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comodatos_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comodatos_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      compra_itens: {
        Row: {
          aliquota_cofins: number | null
          aliquota_icms: number | null
          aliquota_pis: number | null
          cest: string | null
          cfop: string | null
          codigo_anp: string | null
          codigo_produto_fornecedor: string | null
          compra_id: string
          created_at: string
          csosn_icms: string | null
          cst_cofins: string | null
          cst_icms: string | null
          cst_pis: string | null
          descricao_xml: string | null
          id: string
          ncm: string | null
          preco_unitario: number
          produto_id: string | null
          quantidade: number
          unidade_xml: string | null
          valor_cofins: number | null
          valor_desconto: number | null
          valor_icms: number | null
          valor_pis: number | null
        }
        Insert: {
          aliquota_cofins?: number | null
          aliquota_icms?: number | null
          aliquota_pis?: number | null
          cest?: string | null
          cfop?: string | null
          codigo_anp?: string | null
          codigo_produto_fornecedor?: string | null
          compra_id: string
          created_at?: string
          csosn_icms?: string | null
          cst_cofins?: string | null
          cst_icms?: string | null
          cst_pis?: string | null
          descricao_xml?: string | null
          id?: string
          ncm?: string | null
          preco_unitario: number
          produto_id?: string | null
          quantidade?: number
          unidade_xml?: string | null
          valor_cofins?: number | null
          valor_desconto?: number | null
          valor_icms?: number | null
          valor_pis?: number | null
        }
        Update: {
          aliquota_cofins?: number | null
          aliquota_icms?: number | null
          aliquota_pis?: number | null
          cest?: string | null
          cfop?: string | null
          codigo_anp?: string | null
          codigo_produto_fornecedor?: string | null
          compra_id?: string
          created_at?: string
          csosn_icms?: string | null
          cst_cofins?: string | null
          cst_icms?: string | null
          cst_pis?: string | null
          descricao_xml?: string | null
          id?: string
          ncm?: string | null
          preco_unitario?: number
          produto_id?: string | null
          quantidade?: number
          unidade_xml?: string | null
          valor_cofins?: number | null
          valor_desconto?: number | null
          valor_icms?: number | null
          valor_pis?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "compra_itens_compra_id_fkey"
            columns: ["compra_id"]
            isOneToOne: false
            referencedRelation: "compras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compra_itens_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      compras: {
        Row: {
          base_icms: number | null
          base_icms_st: number | null
          cfop_predominante: string | null
          chave_nfe: string | null
          created_at: string
          data_compra: string | null
          data_pagamento: string | null
          data_prevista: string | null
          data_recebimento: string | null
          fornecedor_id: string | null
          id: string
          modalidade_frete: string | null
          modelo: string | null
          natureza_operacao: string | null
          numero_nota_fiscal: string | null
          observacoes: string | null
          placa_veiculo: string | null
          serie: string | null
          status: string | null
          transportadora_cnpj: string | null
          transportadora_nome: string | null
          unidade_id: string | null
          updated_at: string
          valor_cofins: number | null
          valor_desconto: number | null
          valor_frete: number | null
          valor_icms: number | null
          valor_icms_st: number | null
          valor_ipi: number | null
          valor_outros: number | null
          valor_pis: number | null
          valor_produtos: number | null
          valor_seguro: number | null
          valor_total: number | null
          xml_content: string | null
        }
        Insert: {
          base_icms?: number | null
          base_icms_st?: number | null
          cfop_predominante?: string | null
          chave_nfe?: string | null
          created_at?: string
          data_compra?: string | null
          data_pagamento?: string | null
          data_prevista?: string | null
          data_recebimento?: string | null
          fornecedor_id?: string | null
          id?: string
          modalidade_frete?: string | null
          modelo?: string | null
          natureza_operacao?: string | null
          numero_nota_fiscal?: string | null
          observacoes?: string | null
          placa_veiculo?: string | null
          serie?: string | null
          status?: string | null
          transportadora_cnpj?: string | null
          transportadora_nome?: string | null
          unidade_id?: string | null
          updated_at?: string
          valor_cofins?: number | null
          valor_desconto?: number | null
          valor_frete?: number | null
          valor_icms?: number | null
          valor_icms_st?: number | null
          valor_ipi?: number | null
          valor_outros?: number | null
          valor_pis?: number | null
          valor_produtos?: number | null
          valor_seguro?: number | null
          valor_total?: number | null
          xml_content?: string | null
        }
        Update: {
          base_icms?: number | null
          base_icms_st?: number | null
          cfop_predominante?: string | null
          chave_nfe?: string | null
          created_at?: string
          data_compra?: string | null
          data_pagamento?: string | null
          data_prevista?: string | null
          data_recebimento?: string | null
          fornecedor_id?: string | null
          id?: string
          modalidade_frete?: string | null
          modelo?: string | null
          natureza_operacao?: string | null
          numero_nota_fiscal?: string | null
          observacoes?: string | null
          placa_veiculo?: string | null
          serie?: string | null
          status?: string | null
          transportadora_cnpj?: string | null
          transportadora_nome?: string | null
          unidade_id?: string | null
          updated_at?: string
          valor_cofins?: number | null
          valor_desconto?: number | null
          valor_frete?: number | null
          valor_icms?: number | null
          valor_icms_st?: number | null
          valor_ipi?: number | null
          valor_outros?: number | null
          valor_pis?: number | null
          valor_produtos?: number | null
          valor_seguro?: number | null
          valor_total?: number | null
          xml_content?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "compras_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compras_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      comprovantes_entrega: {
        Row: {
          assinado_em: string
          assinatura_url: string | null
          cliente_id: string | null
          created_at: string
          documento_recebedor: string | null
          empresa_id: string | null
          entregador_id: string | null
          foto_url: string | null
          id: string
          latitude: number | null
          longitude: number | null
          nome_recebedor: string | null
          observacao: string | null
          pedido_id: string
          unidade_id: string | null
          user_agent: string | null
        }
        Insert: {
          assinado_em?: string
          assinatura_url?: string | null
          cliente_id?: string | null
          created_at?: string
          documento_recebedor?: string | null
          empresa_id?: string | null
          entregador_id?: string | null
          foto_url?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          nome_recebedor?: string | null
          observacao?: string | null
          pedido_id: string
          unidade_id?: string | null
          user_agent?: string | null
        }
        Update: {
          assinado_em?: string
          assinatura_url?: string | null
          cliente_id?: string | null
          created_at?: string
          documento_recebedor?: string | null
          empresa_id?: string | null
          entregador_id?: string | null
          foto_url?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          nome_recebedor?: string | null
          observacao?: string | null
          pedido_id?: string
          unidade_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "comprovantes_entrega_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comprovantes_entrega_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comprovantes_entrega_entregador_id_fkey"
            columns: ["entregador_id"]
            isOneToOne: false
            referencedRelation: "entregadores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comprovantes_entrega_entregador_id_fkey"
            columns: ["entregador_id"]
            isOneToOne: false
            referencedRelation: "vw_alertas_cnh"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comprovantes_entrega_entregador_id_fkey"
            columns: ["entregador_id"]
            isOneToOne: false
            referencedRelation: "vw_comissao_entregador"
            referencedColumns: ["entregador_id"]
          },
          {
            foreignKeyName: "comprovantes_entrega_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comprovantes_entrega_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      comunicados_contador: {
        Row: {
          autor_id: string
          autor_nome: string | null
          conteudo: string
          created_at: string
          id: string
          importante: boolean
          lido: boolean
          tipo: string
          titulo: string
          unidade_id: string | null
          updated_at: string
        }
        Insert: {
          autor_id: string
          autor_nome?: string | null
          conteudo: string
          created_at?: string
          id?: string
          importante?: boolean
          lido?: boolean
          tipo?: string
          titulo: string
          unidade_id?: string | null
          updated_at?: string
        }
        Update: {
          autor_id?: string
          autor_nome?: string | null
          conteudo?: string
          created_at?: string
          id?: string
          importante?: boolean
          lido?: boolean
          tipo?: string
          titulo?: string
          unidade_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "comunicados_contador_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      concorrente_precos: {
        Row: {
          concorrente_id: string | null
          concorrente_nome: string
          created_at: string
          data: string
          empresa_id: string
          fonte: string
          id: string
          preco: number
          produto: string
          tipo_preco: string
          unidade_id: string | null
          updated_at: string
        }
        Insert: {
          concorrente_id?: string | null
          concorrente_nome: string
          created_at?: string
          data?: string
          empresa_id: string
          fonte?: string
          id?: string
          preco: number
          produto: string
          tipo_preco?: string
          unidade_id?: string | null
          updated_at?: string
        }
        Update: {
          concorrente_id?: string | null
          concorrente_nome?: string
          created_at?: string
          data?: string
          empresa_id?: string
          fonte?: string
          id?: string
          preco?: number
          produto?: string
          tipo_preco?: string
          unidade_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "concorrente_precos_concorrente_id_fkey"
            columns: ["concorrente_id"]
            isOneToOne: false
            referencedRelation: "concorrentes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "concorrente_precos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "concorrente_precos_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      concorrentes: {
        Row: {
          created_at: string
          empresa_id: string | null
          endereco: string | null
          id: string
          latitude: number
          longitude: number
          nivel_ameaca: string
          nome: string
          observacoes: string | null
          produtos_precos: Json | null
          telefone: string | null
          unidade_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          empresa_id?: string | null
          endereco?: string | null
          id?: string
          latitude: number
          longitude: number
          nivel_ameaca?: string
          nome: string
          observacoes?: string | null
          produtos_precos?: Json | null
          telefone?: string | null
          unidade_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          empresa_id?: string | null
          endereco?: string | null
          id?: string
          latitude?: number
          longitude?: number
          nivel_ameaca?: string
          nome?: string
          observacoes?: string | null
          produtos_precos?: Json | null
          telefone?: string | null
          unidade_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "concorrentes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "concorrentes_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      conferencia_cartao: {
        Row: {
          autorizacao: string | null
          bandeira: string | null
          created_at: string
          data_deposito_real: string | null
          data_prevista_deposito: string | null
          data_venda: string
          id: string
          nsu: string | null
          observacoes: string | null
          operadora_id: string | null
          parcelas: number
          pedido_id: string | null
          status: string
          taxa_percentual: number
          terminal_id: string | null
          tipo: string
          unidade_id: string | null
          updated_at: string
          valor_bruto: number
          valor_liquido_esperado: number
          valor_liquido_recebido: number | null
          valor_taxa: number
        }
        Insert: {
          autorizacao?: string | null
          bandeira?: string | null
          created_at?: string
          data_deposito_real?: string | null
          data_prevista_deposito?: string | null
          data_venda?: string
          id?: string
          nsu?: string | null
          observacoes?: string | null
          operadora_id?: string | null
          parcelas?: number
          pedido_id?: string | null
          status?: string
          taxa_percentual?: number
          terminal_id?: string | null
          tipo?: string
          unidade_id?: string | null
          updated_at?: string
          valor_bruto?: number
          valor_liquido_esperado?: number
          valor_liquido_recebido?: number | null
          valor_taxa?: number
        }
        Update: {
          autorizacao?: string | null
          bandeira?: string | null
          created_at?: string
          data_deposito_real?: string | null
          data_prevista_deposito?: string | null
          data_venda?: string
          id?: string
          nsu?: string | null
          observacoes?: string | null
          operadora_id?: string | null
          parcelas?: number
          pedido_id?: string | null
          status?: string
          taxa_percentual?: number
          terminal_id?: string | null
          tipo?: string
          unidade_id?: string | null
          updated_at?: string
          valor_bruto?: number
          valor_liquido_esperado?: number
          valor_liquido_recebido?: number | null
          valor_taxa?: number
        }
        Relationships: [
          {
            foreignKeyName: "conferencia_cartao_operadora_id_fkey"
            columns: ["operadora_id"]
            isOneToOne: false
            referencedRelation: "operadoras_cartao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conferencia_cartao_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conferencia_cartao_terminal_id_fkey"
            columns: ["terminal_id"]
            isOneToOne: false
            referencedRelation: "terminais_cartao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conferencia_cartao_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      config_destino_pagamento: {
        Row: {
          ativo: boolean
          conta_bancaria_id: string | null
          created_at: string
          forma_pagamento: string
          id: string
          unidade_id: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          conta_bancaria_id?: string | null
          created_at?: string
          forma_pagamento: string
          id?: string
          unidade_id?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          conta_bancaria_id?: string | null
          created_at?: string
          forma_pagamento?: string
          id?: string
          unidade_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "config_destino_pagamento_conta_bancaria_id_fkey"
            columns: ["conta_bancaria_id"]
            isOneToOne: false
            referencedRelation: "contas_bancarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "config_destino_pagamento_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      configuracoes_empresa: {
        Row: {
          asaas_api_key: string | null
          asaas_sandbox: boolean | null
          asaas_webhook_token: string | null
          cnpj: string | null
          created_at: string
          empresa_id: string | null
          endereco: string | null
          id: string
          mensagem_cupom: string | null
          nome_empresa: string
          regras_bia: Json | null
          regras_cadastro: Json
          telefone: string | null
          updated_at: string
        }
        Insert: {
          asaas_api_key?: string | null
          asaas_sandbox?: boolean | null
          asaas_webhook_token?: string | null
          cnpj?: string | null
          created_at?: string
          empresa_id?: string | null
          endereco?: string | null
          id?: string
          mensagem_cupom?: string | null
          nome_empresa?: string
          regras_bia?: Json | null
          regras_cadastro?: Json
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          asaas_api_key?: string | null
          asaas_sandbox?: boolean | null
          asaas_webhook_token?: string | null
          cnpj?: string | null
          created_at?: string
          empresa_id?: string | null
          endereco?: string | null
          id?: string
          mensagem_cupom?: string | null
          nome_empresa?: string
          regras_bia?: Json | null
          regras_cadastro?: Json
          telefone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "configuracoes_empresa_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: true
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      configuracoes_globais: {
        Row: {
          chave: string
          descricao: string | null
          updated_at: string
          updated_by: string | null
          valor: Json
        }
        Insert: {
          chave: string
          descricao?: string | null
          updated_at?: string
          updated_by?: string | null
          valor: Json
        }
        Update: {
          chave?: string
          descricao?: string | null
          updated_at?: string
          updated_by?: string | null
          valor?: Json
        }
        Relationships: []
      }
      configuracoes_visuais: {
        Row: {
          comprovante: Json | null
          cor_primaria: string | null
          created_at: string | null
          dark_mode: boolean | null
          id: string
          logo_url: string | null
          nome_empresa: string | null
          unidade_id: string
          updated_at: string | null
        }
        Insert: {
          comprovante?: Json | null
          cor_primaria?: string | null
          created_at?: string | null
          dark_mode?: boolean | null
          id?: string
          logo_url?: string | null
          nome_empresa?: string | null
          unidade_id: string
          updated_at?: string | null
        }
        Update: {
          comprovante?: Json | null
          cor_primaria?: string | null
          created_at?: string | null
          dark_mode?: boolean | null
          id?: string
          logo_url?: string | null
          nome_empresa?: string | null
          unidade_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "configuracoes_visuais_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: true
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      conquistas: {
        Row: {
          created_at: string
          descricao: string | null
          empresa_id: string | null
          icone: string | null
          id: string
          meta_valor: number
          nome: string
          pontos: number
          tipo: string
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          empresa_id?: string | null
          icone?: string | null
          id?: string
          meta_valor?: number
          nome: string
          pontos?: number
          tipo?: string
        }
        Update: {
          created_at?: string
          descricao?: string | null
          empresa_id?: string | null
          icone?: string | null
          id?: string
          meta_valor?: number
          nome?: string
          pontos?: number
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "conquistas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      contador_empresas: {
        Row: {
          ativo: boolean
          contador_user_id: string
          created_at: string
          empresa_id: string
          id: string
          observacoes: string | null
          permissoes: Json
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          contador_user_id: string
          created_at?: string
          empresa_id: string
          id?: string
          observacoes?: string | null
          permissoes?: Json
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          contador_user_id?: string
          created_at?: string
          empresa_id?: string
          id?: string
          observacoes?: string | null
          permissoes?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contador_empresas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      contas_bancarias: {
        Row: {
          agencia: string | null
          ativo: boolean
          banco: string
          chave_pix: string | null
          conta: string | null
          created_at: string
          id: string
          nome: string
          saldo_atual: number
          saldo_inicial: number
          tipo: string
          unidade_id: string | null
          updated_at: string
        }
        Insert: {
          agencia?: string | null
          ativo?: boolean
          banco: string
          chave_pix?: string | null
          conta?: string | null
          created_at?: string
          id?: string
          nome: string
          saldo_atual?: number
          saldo_inicial?: number
          tipo?: string
          unidade_id?: string | null
          updated_at?: string
        }
        Update: {
          agencia?: string | null
          ativo?: boolean
          banco?: string
          chave_pix?: string | null
          conta?: string | null
          created_at?: string
          id?: string
          nome?: string
          saldo_atual?: number
          saldo_inicial?: number
          tipo?: string
          unidade_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contas_bancarias_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      contas_pagar: {
        Row: {
          boleto_codigo_barras: string | null
          boleto_linha_digitavel: string | null
          boleto_url: string | null
          categoria: string | null
          created_at: string
          descricao: string
          fornecedor: string
          grupo_parcela_id: string | null
          id: string
          observacoes: string | null
          origem: string | null
          parcela_numero: number | null
          parcela_total: number | null
          plano_contas_id: string | null
          status: string
          unidade_id: string | null
          updated_at: string
          valor: number
          vencimento: string
        }
        Insert: {
          boleto_codigo_barras?: string | null
          boleto_linha_digitavel?: string | null
          boleto_url?: string | null
          categoria?: string | null
          created_at?: string
          descricao: string
          fornecedor: string
          grupo_parcela_id?: string | null
          id?: string
          observacoes?: string | null
          origem?: string | null
          parcela_numero?: number | null
          parcela_total?: number | null
          plano_contas_id?: string | null
          status?: string
          unidade_id?: string | null
          updated_at?: string
          valor?: number
          vencimento: string
        }
        Update: {
          boleto_codigo_barras?: string | null
          boleto_linha_digitavel?: string | null
          boleto_url?: string | null
          categoria?: string | null
          created_at?: string
          descricao?: string
          fornecedor?: string
          grupo_parcela_id?: string | null
          id?: string
          observacoes?: string | null
          origem?: string | null
          parcela_numero?: number | null
          parcela_total?: number | null
          plano_contas_id?: string | null
          status?: string
          unidade_id?: string | null
          updated_at?: string
          valor?: number
          vencimento?: string
        }
        Relationships: [
          {
            foreignKeyName: "contas_pagar_plano_contas_id_fkey"
            columns: ["plano_contas_id"]
            isOneToOne: false
            referencedRelation: "plano_contas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contas_pagar_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      contas_receber: {
        Row: {
          asaas_charge_id: string | null
          asaas_customer_id: string | null
          boleto_url: string | null
          cliente: string
          cliente_id: string | null
          created_at: string
          data_recebimento: string | null
          descricao: string
          forma_pagamento: string | null
          id: string
          linha_digitavel: string | null
          nosso_numero: string | null
          observacoes: string | null
          operadora_id: string | null
          origem: string | null
          parcela_atual: number | null
          pedido_id: string | null
          pix_copia_cola: string | null
          pix_qrcode: string | null
          plano_contas_id: string | null
          status: string
          taxa_percentual: number | null
          total_parcelas: number | null
          unidade_id: string | null
          updated_at: string
          vale_gas_id: string | null
          vale_gas_parceiro_id: string | null
          valor: number
          valor_liquido: number | null
          valor_taxa: number | null
          vencimento: string
        }
        Insert: {
          asaas_charge_id?: string | null
          asaas_customer_id?: string | null
          boleto_url?: string | null
          cliente: string
          cliente_id?: string | null
          created_at?: string
          data_recebimento?: string | null
          descricao: string
          forma_pagamento?: string | null
          id?: string
          linha_digitavel?: string | null
          nosso_numero?: string | null
          observacoes?: string | null
          operadora_id?: string | null
          origem?: string | null
          parcela_atual?: number | null
          pedido_id?: string | null
          pix_copia_cola?: string | null
          pix_qrcode?: string | null
          plano_contas_id?: string | null
          status?: string
          taxa_percentual?: number | null
          total_parcelas?: number | null
          unidade_id?: string | null
          updated_at?: string
          vale_gas_id?: string | null
          vale_gas_parceiro_id?: string | null
          valor?: number
          valor_liquido?: number | null
          valor_taxa?: number | null
          vencimento: string
        }
        Update: {
          asaas_charge_id?: string | null
          asaas_customer_id?: string | null
          boleto_url?: string | null
          cliente?: string
          cliente_id?: string | null
          created_at?: string
          data_recebimento?: string | null
          descricao?: string
          forma_pagamento?: string | null
          id?: string
          linha_digitavel?: string | null
          nosso_numero?: string | null
          observacoes?: string | null
          operadora_id?: string | null
          origem?: string | null
          parcela_atual?: number | null
          pedido_id?: string | null
          pix_copia_cola?: string | null
          pix_qrcode?: string | null
          plano_contas_id?: string | null
          status?: string
          taxa_percentual?: number | null
          total_parcelas?: number | null
          unidade_id?: string | null
          updated_at?: string
          vale_gas_id?: string | null
          vale_gas_parceiro_id?: string | null
          valor?: number
          valor_liquido?: number | null
          valor_taxa?: number | null
          vencimento?: string
        }
        Relationships: [
          {
            foreignKeyName: "contas_receber_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contas_receber_operadora_id_fkey"
            columns: ["operadora_id"]
            isOneToOne: false
            referencedRelation: "operadoras_cartao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contas_receber_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contas_receber_plano_contas_id_fkey"
            columns: ["plano_contas_id"]
            isOneToOne: false
            referencedRelation: "plano_contas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contas_receber_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contas_receber_vale_gas_id_fkey"
            columns: ["vale_gas_id"]
            isOneToOne: false
            referencedRelation: "vale_gas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contas_receber_vale_gas_parceiro_id_fkey"
            columns: ["vale_gas_parceiro_id"]
            isOneToOne: false
            referencedRelation: "vale_gas_parceiros"
            referencedColumns: ["id"]
          },
        ]
      }
      contratos_recorrentes: {
        Row: {
          cliente_id: string
          cliente_nome: string
          created_at: string
          data_fim: string | null
          data_inicio: string
          dia_preferencial: number | null
          entregas_realizadas: number
          frequencia: string
          id: string
          observacoes: string | null
          produto_id: string | null
          produto_nome: string
          proxima_entrega: string | null
          quantidade: number
          status: string
          turno_preferencial: string | null
          unidade_id: string | null
          updated_at: string
          valor_unitario: number
        }
        Insert: {
          cliente_id: string
          cliente_nome: string
          created_at?: string
          data_fim?: string | null
          data_inicio?: string
          dia_preferencial?: number | null
          entregas_realizadas?: number
          frequencia?: string
          id?: string
          observacoes?: string | null
          produto_id?: string | null
          produto_nome: string
          proxima_entrega?: string | null
          quantidade?: number
          status?: string
          turno_preferencial?: string | null
          unidade_id?: string | null
          updated_at?: string
          valor_unitario?: number
        }
        Update: {
          cliente_id?: string
          cliente_nome?: string
          created_at?: string
          data_fim?: string | null
          data_inicio?: string
          dia_preferencial?: number | null
          entregas_realizadas?: number
          frequencia?: string
          id?: string
          observacoes?: string | null
          produto_id?: string | null
          produto_nome?: string
          proxima_entrega?: string | null
          quantidade?: number
          status?: string
          turno_preferencial?: string | null
          unidade_id?: string | null
          updated_at?: string
          valor_unitario?: number
        }
        Relationships: [
          {
            foreignKeyName: "contratos_recorrentes_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratos_recorrentes_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratos_recorrentes_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      cupons_desconto: {
        Row: {
          ativo: boolean
          codigo: string
          created_at: string
          descricao: string | null
          id: string
          limite_uso: number | null
          tipo: string
          unidade_id: string | null
          updated_at: string
          usos: number
          validade: string | null
          valor: number
          valor_minimo: number
        }
        Insert: {
          ativo?: boolean
          codigo: string
          created_at?: string
          descricao?: string | null
          id?: string
          limite_uso?: number | null
          tipo?: string
          unidade_id?: string | null
          updated_at?: string
          usos?: number
          validade?: string | null
          valor?: number
          valor_minimo?: number
        }
        Update: {
          ativo?: boolean
          codigo?: string
          created_at?: string
          descricao?: string | null
          id?: string
          limite_uso?: number | null
          tipo?: string
          unidade_id?: string | null
          updated_at?: string
          usos?: number
          validade?: string | null
          valor?: number
          valor_minimo?: number
        }
        Relationships: [
          {
            foreignKeyName: "cupons_desconto_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      despesas_contabeis: {
        Row: {
          arquivo_mime: string | null
          arquivo_nome: string | null
          arquivo_url: string | null
          categoria: string | null
          cnpj_fornecedor: string | null
          contador_baixou_em: string | null
          contador_user_id: string | null
          created_at: string
          data_despesa: string
          descricao: string
          empresa_id: string
          forma_pagamento: string | null
          fornecedor: string | null
          id: string
          observacoes: string | null
          ocr_metadata: Json | null
          ocr_texto: string | null
          plano_conta_id: string | null
          status: string
          unidade_id: string | null
          updated_at: string
          uploaded_by: string | null
          valor: number
        }
        Insert: {
          arquivo_mime?: string | null
          arquivo_nome?: string | null
          arquivo_url?: string | null
          categoria?: string | null
          cnpj_fornecedor?: string | null
          contador_baixou_em?: string | null
          contador_user_id?: string | null
          created_at?: string
          data_despesa?: string
          descricao: string
          empresa_id: string
          forma_pagamento?: string | null
          fornecedor?: string | null
          id?: string
          observacoes?: string | null
          ocr_metadata?: Json | null
          ocr_texto?: string | null
          plano_conta_id?: string | null
          status?: string
          unidade_id?: string | null
          updated_at?: string
          uploaded_by?: string | null
          valor?: number
        }
        Update: {
          arquivo_mime?: string | null
          arquivo_nome?: string | null
          arquivo_url?: string | null
          categoria?: string | null
          cnpj_fornecedor?: string | null
          contador_baixou_em?: string | null
          contador_user_id?: string | null
          created_at?: string
          data_despesa?: string
          descricao?: string
          empresa_id?: string
          forma_pagamento?: string | null
          fornecedor?: string | null
          id?: string
          observacoes?: string | null
          ocr_metadata?: Json | null
          ocr_texto?: string | null
          plano_conta_id?: string | null
          status?: string
          unidade_id?: string | null
          updated_at?: string
          uploaded_by?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "despesas_contabeis_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "despesas_contabeis_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_despesas_plano_conta"
            columns: ["plano_conta_id"]
            isOneToOne: false
            referencedRelation: "plano_contas"
            referencedColumns: ["id"]
          },
        ]
      }
      devolucao_itens: {
        Row: {
          created_at: string
          devolucao_id: string
          id: string
          motivo_item: string | null
          produto_id: string | null
          produto_nome: string
          quantidade: number
          valor_unitario: number
        }
        Insert: {
          created_at?: string
          devolucao_id: string
          id?: string
          motivo_item?: string | null
          produto_id?: string | null
          produto_nome: string
          quantidade?: number
          valor_unitario?: number
        }
        Update: {
          created_at?: string
          devolucao_id?: string
          id?: string
          motivo_item?: string | null
          produto_id?: string | null
          produto_nome?: string
          quantidade?: number
          valor_unitario?: number
        }
        Relationships: [
          {
            foreignKeyName: "devolucao_itens_devolucao_id_fkey"
            columns: ["devolucao_id"]
            isOneToOne: false
            referencedRelation: "devolucoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devolucao_itens_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      devolucoes: {
        Row: {
          aprovado_por: string | null
          cliente_id: string | null
          cliente_nome: string
          created_at: string
          data_aprovacao: string | null
          id: string
          motivo: string
          observacoes: string | null
          pedido_id: string | null
          status: string
          tipo: string
          unidade_id: string | null
          updated_at: string
          valor_total: number
        }
        Insert: {
          aprovado_por?: string | null
          cliente_id?: string | null
          cliente_nome: string
          created_at?: string
          data_aprovacao?: string | null
          id?: string
          motivo: string
          observacoes?: string | null
          pedido_id?: string | null
          status?: string
          tipo?: string
          unidade_id?: string | null
          updated_at?: string
          valor_total?: number
        }
        Update: {
          aprovado_por?: string | null
          cliente_id?: string | null
          cliente_nome?: string
          created_at?: string
          data_aprovacao?: string | null
          id?: string
          motivo?: string
          observacoes?: string | null
          pedido_id?: string | null
          status?: string
          tipo?: string
          unidade_id?: string | null
          updated_at?: string
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "devolucoes_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devolucoes_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devolucoes_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      did_empresa_routing: {
        Row: {
          ativo: boolean
          created_at: string
          did: string
          empresa_id: string
          id: string
          observacao: string | null
          provedor: string
          unidade_id: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          did: string
          empresa_id: string
          id?: string
          observacao?: string | null
          provedor?: string
          unidade_id?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          did?: string
          empresa_id?: string
          id?: string
          observacao?: string | null
          provedor?: string
          unidade_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "did_empresa_routing_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "did_empresa_routing_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      documentos_contabeis: {
        Row: {
          arquivo_nome: string | null
          arquivo_tamanho: number | null
          arquivo_url: string | null
          categoria: string
          competencia: string | null
          created_at: string
          gerado_em: string | null
          id: string
          nome: string
          observacoes: string | null
          periodo: string | null
          prazo_entrega: string | null
          status: string
          tags: string[] | null
          tipo: string
          unidade_id: string | null
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          arquivo_nome?: string | null
          arquivo_tamanho?: number | null
          arquivo_url?: string | null
          categoria?: string
          competencia?: string | null
          created_at?: string
          gerado_em?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          periodo?: string | null
          prazo_entrega?: string | null
          status?: string
          tags?: string[] | null
          tipo: string
          unidade_id?: string | null
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          arquivo_nome?: string | null
          arquivo_tamanho?: number | null
          arquivo_url?: string | null
          categoria?: string
          competencia?: string | null
          created_at?: string
          gerado_em?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          periodo?: string | null
          prazo_entrega?: string | null
          status?: string
          tags?: string[] | null
          tipo?: string
          unidade_id?: string | null
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documentos_contabeis_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      documentos_empresa: {
        Row: {
          arquivo_nome: string
          arquivo_tamanho: number | null
          arquivo_url: string
          categoria: string
          created_at: string
          descricao: string | null
          id: string
          nome: string
          unidade_id: string | null
          updated_at: string
          uploaded_by: string
        }
        Insert: {
          arquivo_nome: string
          arquivo_tamanho?: number | null
          arquivo_url: string
          categoria?: string
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
          unidade_id?: string | null
          updated_at?: string
          uploaded_by: string
        }
        Update: {
          arquivo_nome?: string
          arquivo_tamanho?: number | null
          arquivo_url?: string
          categoria?: string
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
          unidade_id?: string | null
          updated_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "documentos_empresa_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      email_log: {
        Row: {
          assunto: string
          corpo: string | null
          created_at: string
          destinatario_email: string
          destinatario_nome: string | null
          empresa_id: string | null
          erro: string | null
          id: string
          provedor: string | null
          referencia_id: string | null
          referencia_tipo: string | null
          status: string
          tipo: string
          user_id: string
        }
        Insert: {
          assunto: string
          corpo?: string | null
          created_at?: string
          destinatario_email: string
          destinatario_nome?: string | null
          empresa_id?: string | null
          erro?: string | null
          id?: string
          provedor?: string | null
          referencia_id?: string | null
          referencia_tipo?: string | null
          status?: string
          tipo?: string
          user_id: string
        }
        Update: {
          assunto?: string
          corpo?: string | null
          created_at?: string
          destinatario_email?: string
          destinatario_nome?: string | null
          empresa_id?: string | null
          erro?: string | null
          id?: string
          provedor?: string | null
          referencia_id?: string | null
          referencia_tipo?: string | null
          status?: string
          tipo?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_log_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      empresas: {
        Row: {
          ativo: boolean
          bairro: string | null
          cep: string | null
          cidade: string | null
          cnpj: string | null
          complemento: string | null
          created_at: string
          email: string | null
          endereco: string | null
          estado: string | null
          id: string
          inscricao_estadual: string | null
          logo_url: string | null
          nome: string
          nome_fantasia: string | null
          numero: string | null
          plano: string
          plano_max_unidades: number
          plano_max_usuarios: number
          razao_social: string | null
          regime_tributacao: string | null
          slug: string
          telefone: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          complemento?: string | null
          created_at?: string
          email?: string | null
          endereco?: string | null
          estado?: string | null
          id?: string
          inscricao_estadual?: string | null
          logo_url?: string | null
          nome: string
          nome_fantasia?: string | null
          numero?: string | null
          plano?: string
          plano_max_unidades?: number
          plano_max_usuarios?: number
          razao_social?: string | null
          regime_tributacao?: string | null
          slug: string
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          complemento?: string | null
          created_at?: string
          email?: string | null
          endereco?: string | null
          estado?: string | null
          id?: string
          inscricao_estadual?: string | null
          logo_url?: string | null
          nome?: string
          nome_fantasia?: string | null
          numero?: string | null
          plano?: string
          plano_max_unidades?: number
          plano_max_usuarios?: number
          razao_social?: string | null
          regime_tributacao?: string | null
          slug?: string
          telefone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      emprestimos: {
        Row: {
          created_at: string
          data_inicio: string
          descricao: string
          id: string
          instituicao: string
          num_parcelas: number
          observacoes: string | null
          status: string
          taxa_juros: number
          tipo_amortizacao: string
          unidade_id: string | null
          updated_at: string
          user_id: string | null
          valor_total: number
        }
        Insert: {
          created_at?: string
          data_inicio?: string
          descricao: string
          id?: string
          instituicao: string
          num_parcelas?: number
          observacoes?: string | null
          status?: string
          taxa_juros?: number
          tipo_amortizacao?: string
          unidade_id?: string | null
          updated_at?: string
          user_id?: string | null
          valor_total: number
        }
        Update: {
          created_at?: string
          data_inicio?: string
          descricao?: string
          id?: string
          instituicao?: string
          num_parcelas?: number
          observacoes?: string | null
          status?: string
          taxa_juros?: number
          tipo_amortizacao?: string
          unidade_id?: string | null
          updated_at?: string
          user_id?: string | null
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "emprestimos_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      entregador_conquistas: {
        Row: {
          conquista_id: string
          desbloqueada_em: string
          entregador_id: string
          id: string
        }
        Insert: {
          conquista_id: string
          desbloqueada_em?: string
          entregador_id: string
          id?: string
        }
        Update: {
          conquista_id?: string
          desbloqueada_em?: string
          entregador_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "entregador_conquistas_conquista_id_fkey"
            columns: ["conquista_id"]
            isOneToOne: false
            referencedRelation: "conquistas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entregador_conquistas_entregador_id_fkey"
            columns: ["entregador_id"]
            isOneToOne: false
            referencedRelation: "entregadores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entregador_conquistas_entregador_id_fkey"
            columns: ["entregador_id"]
            isOneToOne: false
            referencedRelation: "vw_alertas_cnh"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entregador_conquistas_entregador_id_fkey"
            columns: ["entregador_id"]
            isOneToOne: false
            referencedRelation: "vw_comissao_entregador"
            referencedColumns: ["entregador_id"]
          },
        ]
      }
      entregadores: {
        Row: {
          ativo: boolean | null
          cnh: string | null
          cnh_vencimento: string | null
          cpf: string | null
          created_at: string
          email: string | null
          foto_url: string | null
          funcionario_id: string | null
          id: string
          latitude: number | null
          longitude: number | null
          nome: string
          status: string | null
          telefone: string | null
          terminal_ativo_id: string | null
          terminal_id: string | null
          unidade_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          ativo?: boolean | null
          cnh?: string | null
          cnh_vencimento?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          foto_url?: string | null
          funcionario_id?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          nome: string
          status?: string | null
          telefone?: string | null
          terminal_ativo_id?: string | null
          terminal_id?: string | null
          unidade_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          ativo?: boolean | null
          cnh?: string | null
          cnh_vencimento?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          foto_url?: string | null
          funcionario_id?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          nome?: string
          status?: string | null
          telefone?: string | null
          terminal_ativo_id?: string | null
          terminal_id?: string | null
          unidade_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "entregadores_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entregadores_terminal_ativo_id_fkey"
            columns: ["terminal_ativo_id"]
            isOneToOne: false
            referencedRelation: "terminais_cartao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entregadores_terminal_id_fkey"
            columns: ["terminal_id"]
            isOneToOne: false
            referencedRelation: "terminais_cartao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entregadores_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      escalas_entregador: {
        Row: {
          almoco_fim: string | null
          almoco_inicio: string | null
          created_at: string
          data: string
          entregador_id: string
          funcionario_id: string | null
          id: string
          observacoes: string | null
          rota_definida_id: string | null
          status: string
          turno_fim: string
          turno_inicio: string
          unidade_id: string | null
          updated_at: string
        }
        Insert: {
          almoco_fim?: string | null
          almoco_inicio?: string | null
          created_at?: string
          data?: string
          entregador_id: string
          funcionario_id?: string | null
          id?: string
          observacoes?: string | null
          rota_definida_id?: string | null
          status?: string
          turno_fim?: string
          turno_inicio?: string
          unidade_id?: string | null
          updated_at?: string
        }
        Update: {
          almoco_fim?: string | null
          almoco_inicio?: string | null
          created_at?: string
          data?: string
          entregador_id?: string
          funcionario_id?: string | null
          id?: string
          observacoes?: string | null
          rota_definida_id?: string | null
          status?: string
          turno_fim?: string
          turno_inicio?: string
          unidade_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "escalas_entregador_entregador_id_fkey"
            columns: ["entregador_id"]
            isOneToOne: false
            referencedRelation: "entregadores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escalas_entregador_entregador_id_fkey"
            columns: ["entregador_id"]
            isOneToOne: false
            referencedRelation: "vw_alertas_cnh"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escalas_entregador_entregador_id_fkey"
            columns: ["entregador_id"]
            isOneToOne: false
            referencedRelation: "vw_comissao_entregador"
            referencedColumns: ["entregador_id"]
          },
          {
            foreignKeyName: "escalas_entregador_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escalas_entregador_rota_definida_id_fkey"
            columns: ["rota_definida_id"]
            isOneToOne: false
            referencedRelation: "rotas_definidas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escalas_entregador_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      extrato_bancario: {
        Row: {
          categoria: string | null
          conciliado: boolean
          conta_bancaria_id: string | null
          created_at: string
          data: string
          descricao: string
          id: string
          pedido_id: string | null
          tipo: string
          unidade_id: string | null
          updated_at: string
          valor: number
        }
        Insert: {
          categoria?: string | null
          conciliado?: boolean
          conta_bancaria_id?: string | null
          created_at?: string
          data?: string
          descricao: string
          id?: string
          pedido_id?: string | null
          tipo?: string
          unidade_id?: string | null
          updated_at?: string
          valor?: number
        }
        Update: {
          categoria?: string | null
          conciliado?: boolean
          conta_bancaria_id?: string | null
          created_at?: string
          data?: string
          descricao?: string
          id?: string
          pedido_id?: string | null
          tipo?: string
          unidade_id?: string | null
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "extrato_bancario_conta_bancaria_id_fkey"
            columns: ["conta_bancaria_id"]
            isOneToOne: false
            referencedRelation: "contas_bancarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "extrato_bancario_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "extrato_bancario_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      fatura_cartao_itens: {
        Row: {
          categoria: string | null
          created_at: string
          data_compra: string
          descricao: string
          fatura_id: string
          id: string
          parcela_atual: number | null
          parcela_total: number | null
          valor: number
        }
        Insert: {
          categoria?: string | null
          created_at?: string
          data_compra?: string
          descricao: string
          fatura_id: string
          id?: string
          parcela_atual?: number | null
          parcela_total?: number | null
          valor: number
        }
        Update: {
          categoria?: string | null
          created_at?: string
          data_compra?: string
          descricao?: string
          fatura_id?: string
          id?: string
          parcela_atual?: number | null
          parcela_total?: number | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "fatura_cartao_itens_fatura_id_fkey"
            columns: ["fatura_id"]
            isOneToOne: false
            referencedRelation: "faturas_cartao"
            referencedColumns: ["id"]
          },
        ]
      }
      faturas_cartao: {
        Row: {
          bandeira: string | null
          cartao_nome: string
          created_at: string
          id: string
          mes_referencia: string
          observacoes: string | null
          status: string
          ultimos_digitos: string | null
          unidade_id: string | null
          updated_at: string
          user_id: string | null
          valor_total: number
          vencimento: string
        }
        Insert: {
          bandeira?: string | null
          cartao_nome: string
          created_at?: string
          id?: string
          mes_referencia: string
          observacoes?: string | null
          status?: string
          ultimos_digitos?: string | null
          unidade_id?: string | null
          updated_at?: string
          user_id?: string | null
          valor_total?: number
          vencimento: string
        }
        Update: {
          bandeira?: string | null
          cartao_nome?: string
          created_at?: string
          id?: string
          mes_referencia?: string
          observacoes?: string | null
          status?: string
          ultimos_digitos?: string | null
          unidade_id?: string | null
          updated_at?: string
          user_id?: string | null
          valor_total?: number
          vencimento?: string
        }
        Relationships: [
          {
            foreignKeyName: "faturas_cartao_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      fechamento_checklist: {
        Row: {
          categoria: string
          concluido: boolean | null
          concluido_em: string | null
          concluido_por: string | null
          created_at: string
          fechamento_id: string
          id: string
          item: string
          observacoes: string | null
        }
        Insert: {
          categoria: string
          concluido?: boolean | null
          concluido_em?: string | null
          concluido_por?: string | null
          created_at?: string
          fechamento_id: string
          id?: string
          item: string
          observacoes?: string | null
        }
        Update: {
          categoria?: string
          concluido?: boolean | null
          concluido_em?: string | null
          concluido_por?: string | null
          created_at?: string
          fechamento_id?: string
          id?: string
          item?: string
          observacoes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fechamento_checklist_fechamento_id_fkey"
            columns: ["fechamento_id"]
            isOneToOne: false
            referencedRelation: "fechamentos_mensais"
            referencedColumns: ["id"]
          },
        ]
      }
      fechamentos_mensais: {
        Row: {
          created_at: string
          data_fechamento: string | null
          empresa_id: string
          id: string
          mes_referencia: string
          observacoes: string | null
          responsavel_id: string | null
          status: string
          unidade_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          data_fechamento?: string | null
          empresa_id: string
          id?: string
          mes_referencia: string
          observacoes?: string | null
          responsavel_id?: string | null
          status?: string
          unidade_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          data_fechamento?: string | null
          empresa_id?: string
          id?: string
          mes_referencia?: string
          observacoes?: string | null
          responsavel_id?: string | null
          status?: string
          unidade_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fechamentos_mensais_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fechamentos_mensais_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      ferias: {
        Row: {
          created_at: string
          data_fim: string | null
          data_inicio: string | null
          dias_direito: number
          dias_gozados: number
          dias_vendidos: number
          funcionario_id: string
          id: string
          observacoes: string | null
          periodo_aquisitivo_fim: string
          periodo_aquisitivo_inicio: string
          status: string
          unidade_id: string | null
          updated_at: string
          valor_abono: number | null
          valor_ferias: number | null
        }
        Insert: {
          created_at?: string
          data_fim?: string | null
          data_inicio?: string | null
          dias_direito?: number
          dias_gozados?: number
          dias_vendidos?: number
          funcionario_id: string
          id?: string
          observacoes?: string | null
          periodo_aquisitivo_fim: string
          periodo_aquisitivo_inicio: string
          status?: string
          unidade_id?: string | null
          updated_at?: string
          valor_abono?: number | null
          valor_ferias?: number | null
        }
        Update: {
          created_at?: string
          data_fim?: string | null
          data_inicio?: string | null
          dias_direito?: number
          dias_gozados?: number
          dias_vendidos?: number
          funcionario_id?: string
          id?: string
          observacoes?: string | null
          periodo_aquisitivo_fim?: string
          periodo_aquisitivo_inicio?: string
          status?: string
          unidade_id?: string | null
          updated_at?: string
          valor_abono?: number | null
          valor_ferias?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ferias_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ferias_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      fidelidade_clientes: {
        Row: {
          cliente_id: string
          created_at: string
          id: string
          indicacoes_realizadas: number
          nivel: string
          pontos: number
          ultima_atualizacao: string
          unidade_id: string | null
          updated_at: string
        }
        Insert: {
          cliente_id: string
          created_at?: string
          id?: string
          indicacoes_realizadas?: number
          nivel?: string
          pontos?: number
          ultima_atualizacao?: string
          unidade_id?: string | null
          updated_at?: string
        }
        Update: {
          cliente_id?: string
          created_at?: string
          id?: string
          indicacoes_realizadas?: number
          nivel?: string
          pontos?: number
          ultima_atualizacao?: string
          unidade_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fidelidade_clientes_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: true
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fidelidade_clientes_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      folha_pagamento_itens: {
        Row: {
          bonus: number
          bruto: number
          cargo: string | null
          comissao: number
          created_at: string
          folha_id: string
          funcionario_id: string
          funcionario_nome: string
          horas_extras: number
          id: string
          inss: number
          ir: number
          liquido: number
          outros_descontos: number
          salario_base: number
          total_descontos: number
          vales_desconto: number
        }
        Insert: {
          bonus?: number
          bruto?: number
          cargo?: string | null
          comissao?: number
          created_at?: string
          folha_id: string
          funcionario_id: string
          funcionario_nome: string
          horas_extras?: number
          id?: string
          inss?: number
          ir?: number
          liquido?: number
          outros_descontos?: number
          salario_base?: number
          total_descontos?: number
          vales_desconto?: number
        }
        Update: {
          bonus?: number
          bruto?: number
          cargo?: string | null
          comissao?: number
          created_at?: string
          folha_id?: string
          funcionario_id?: string
          funcionario_nome?: string
          horas_extras?: number
          id?: string
          inss?: number
          ir?: number
          liquido?: number
          outros_descontos?: number
          salario_base?: number
          total_descontos?: number
          vales_desconto?: number
        }
        Relationships: [
          {
            foreignKeyName: "folha_pagamento_itens_folha_id_fkey"
            columns: ["folha_id"]
            isOneToOne: false
            referencedRelation: "folhas_pagamento"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "folha_pagamento_itens_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
        ]
      }
      folhas_pagamento: {
        Row: {
          created_at: string
          data_fechamento: string
          id: string
          mes_referencia: string
          observacoes: string | null
          status: string
          total_bruto: number
          total_comissoes: number
          total_descontos: number
          total_funcionarios: number
          total_liquido: number
          unidade_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          data_fechamento?: string
          id?: string
          mes_referencia: string
          observacoes?: string | null
          status?: string
          total_bruto?: number
          total_comissoes?: number
          total_descontos?: number
          total_funcionarios?: number
          total_liquido?: number
          unidade_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          data_fechamento?: string
          id?: string
          mes_referencia?: string
          observacoes?: string | null
          status?: string
          total_bruto?: number
          total_comissoes?: number
          total_descontos?: number
          total_funcionarios?: number
          total_liquido?: number
          unidade_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "folhas_pagamento_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      fornecedores: {
        Row: {
          ativo: boolean | null
          cep: string | null
          cidade: string | null
          cnpj: string | null
          contato_cargo: string | null
          contato_nome: string | null
          created_at: string
          email: string | null
          empresa_id: string | null
          endereco: string | null
          estado: string | null
          id: string
          inscricao_estadual: string | null
          nome_fantasia: string | null
          razao_social: string
          telefone: string | null
          tipo: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean | null
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          contato_cargo?: string | null
          contato_nome?: string | null
          created_at?: string
          email?: string | null
          empresa_id?: string | null
          endereco?: string | null
          estado?: string | null
          id?: string
          inscricao_estadual?: string | null
          nome_fantasia?: string | null
          razao_social: string
          telefone?: string | null
          tipo?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean | null
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          contato_cargo?: string | null
          contato_nome?: string | null
          created_at?: string
          email?: string | null
          empresa_id?: string | null
          endereco?: string | null
          estado?: string | null
          id?: string
          inscricao_estadual?: string | null
          nome_fantasia?: string | null
          razao_social?: string
          telefone?: string | null
          tipo?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fornecedores_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      funcionario_diarias: {
        Row: {
          created_at: string
          data: string
          funcionario_id: string
          id: string
          observacoes: string | null
          status: string
          unidade_id: string | null
          updated_at: string
          valor: number
        }
        Insert: {
          created_at?: string
          data: string
          funcionario_id: string
          id?: string
          observacoes?: string | null
          status?: string
          unidade_id?: string | null
          updated_at?: string
          valor?: number
        }
        Update: {
          created_at?: string
          data?: string
          funcionario_id?: string
          id?: string
          observacoes?: string | null
          status?: string
          unidade_id?: string | null
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "funcionario_diarias_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funcionario_diarias_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      funcionarios: {
        Row: {
          ativo: boolean | null
          cargo: string | null
          cpf: string | null
          created_at: string
          data_admissao: string | null
          data_vencimento_ferias_override: string | null
          email: string | null
          endereco: string | null
          entra_na_escala: boolean
          id: string
          is_transporte: boolean
          nome: string
          regime_pagamento: string
          salario: number | null
          setor: string | null
          status: string | null
          telefone: string | null
          tipo_vinculo: string
          unidade_id: string | null
          updated_at: string
          valor_diaria: number
          valor_por_produto: Json
        }
        Insert: {
          ativo?: boolean | null
          cargo?: string | null
          cpf?: string | null
          created_at?: string
          data_admissao?: string | null
          data_vencimento_ferias_override?: string | null
          email?: string | null
          endereco?: string | null
          entra_na_escala?: boolean
          id?: string
          is_transporte?: boolean
          nome: string
          regime_pagamento?: string
          salario?: number | null
          setor?: string | null
          status?: string | null
          telefone?: string | null
          tipo_vinculo?: string
          unidade_id?: string | null
          updated_at?: string
          valor_diaria?: number
          valor_por_produto?: Json
        }
        Update: {
          ativo?: boolean | null
          cargo?: string | null
          cpf?: string | null
          created_at?: string
          data_admissao?: string | null
          data_vencimento_ferias_override?: string | null
          email?: string | null
          endereco?: string | null
          entra_na_escala?: boolean
          id?: string
          is_transporte?: boolean
          nome?: string
          regime_pagamento?: string
          salario?: number | null
          setor?: string | null
          status?: string | null
          telefone?: string | null
          tipo_vinculo?: string
          unidade_id?: string | null
          updated_at?: string
          valor_diaria?: number
          valor_por_produto?: Json
        }
        Relationships: [
          {
            foreignKeyName: "funcionarios_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      gamificacao_ranking: {
        Row: {
          avaliacao_media: number
          conquistas_desbloqueadas: number
          created_at: string
          entregador_id: string
          entregas_realizadas: number
          id: string
          mes_referencia: string
          pontos: number
          unidade_id: string | null
          updated_at: string
        }
        Insert: {
          avaliacao_media?: number
          conquistas_desbloqueadas?: number
          created_at?: string
          entregador_id: string
          entregas_realizadas?: number
          id?: string
          mes_referencia: string
          pontos?: number
          unidade_id?: string | null
          updated_at?: string
        }
        Update: {
          avaliacao_media?: number
          conquistas_desbloqueadas?: number
          created_at?: string
          entregador_id?: string
          entregas_realizadas?: number
          id?: string
          mes_referencia?: string
          pontos?: number
          unidade_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gamificacao_ranking_entregador_id_fkey"
            columns: ["entregador_id"]
            isOneToOne: false
            referencedRelation: "entregadores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gamificacao_ranking_entregador_id_fkey"
            columns: ["entregador_id"]
            isOneToOne: false
            referencedRelation: "vw_alertas_cnh"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gamificacao_ranking_entregador_id_fkey"
            columns: ["entregador_id"]
            isOneToOne: false
            referencedRelation: "vw_comissao_entregador"
            referencedColumns: ["entregador_id"]
          },
          {
            foreignKeyName: "gamificacao_ranking_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      horarios_funcionario: {
        Row: {
          created_at: string
          dias_semana: string | null
          entrada: string
          entregador_id: string | null
          funcionario_id: string | null
          id: string
          intervalo: string | null
          saida: string
          turno: string
          unidade_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          dias_semana?: string | null
          entrada?: string
          entregador_id?: string | null
          funcionario_id?: string | null
          id?: string
          intervalo?: string | null
          saida?: string
          turno?: string
          unidade_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          dias_semana?: string | null
          entrada?: string
          entregador_id?: string | null
          funcionario_id?: string | null
          id?: string
          intervalo?: string | null
          saida?: string
          turno?: string
          unidade_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "horarios_funcionario_entregador_id_fkey"
            columns: ["entregador_id"]
            isOneToOne: false
            referencedRelation: "entregadores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "horarios_funcionario_entregador_id_fkey"
            columns: ["entregador_id"]
            isOneToOne: false
            referencedRelation: "vw_alertas_cnh"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "horarios_funcionario_entregador_id_fkey"
            columns: ["entregador_id"]
            isOneToOne: false
            referencedRelation: "vw_comissao_entregador"
            referencedColumns: ["entregador_id"]
          },
          {
            foreignKeyName: "horarios_funcionario_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "horarios_funcionario_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      importacoes_inteligentes: {
        Row: {
          arquivo_mime: string | null
          arquivo_nome: string
          arquivo_path: string | null
          arquivo_tamanho: number | null
          cnpj_detectado: string | null
          confianca: number | null
          created_at: string
          dados_extraidos: Json | null
          destino: string
          empresa_id: string
          id: string
          mensagem_erro: string | null
          origem: string
          processado_em: string | null
          registros_criados: number | null
          registros_duplicados: number | null
          registros_erro: number | null
          registros_processados: number | null
          status: string
          tipo_detectado: string | null
          unidade_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          arquivo_mime?: string | null
          arquivo_nome: string
          arquivo_path?: string | null
          arquivo_tamanho?: number | null
          cnpj_detectado?: string | null
          confianca?: number | null
          created_at?: string
          dados_extraidos?: Json | null
          destino?: string
          empresa_id: string
          id?: string
          mensagem_erro?: string | null
          origem?: string
          processado_em?: string | null
          registros_criados?: number | null
          registros_duplicados?: number | null
          registros_erro?: number | null
          registros_processados?: number | null
          status?: string
          tipo_detectado?: string | null
          unidade_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          arquivo_mime?: string | null
          arquivo_nome?: string
          arquivo_path?: string | null
          arquivo_tamanho?: number | null
          cnpj_detectado?: string | null
          confianca?: number | null
          created_at?: string
          dados_extraidos?: Json | null
          destino?: string
          empresa_id?: string
          id?: string
          mensagem_erro?: string | null
          origem?: string
          processado_em?: string | null
          registros_criados?: number | null
          registros_duplicados?: number | null
          registros_erro?: number | null
          registros_processados?: number | null
          status?: string
          tipo_detectado?: string | null
          unidade_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "importacoes_inteligentes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "importacoes_inteligentes_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      integracoes_config: {
        Row: {
          ativo: boolean
          config: Json
          created_at: string
          id: string
          integracao_id: string
          unidade_id: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          config?: Json
          created_at?: string
          id?: string
          integracao_id: string
          unidade_id: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          config?: Json
          created_at?: string
          id?: string
          integracao_id?: string
          unidade_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "integracoes_config_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      integracoes_whatsapp: {
        Row: {
          ativo: boolean | null
          base_url: string | null
          created_at: string | null
          desconto_etapa1: number | null
          desconto_etapa2: number | null
          id: string
          instance_id: string
          instancia_nome: string | null
          instancia_token: string | null
          instancia_url: string | null
          loja_foto_atualizada_em: string | null
          loja_foto_url: string | null
          meta_access_token: string | null
          meta_phone_number_id: string | null
          meta_verify_token: string | null
          meta_waba_id: string | null
          nome_bot: string | null
          numero_telefone: string | null
          preco_minimo_p13: number | null
          preco_minimo_p20: number | null
          provedor: string
          provedor_tipo: string | null
          qr_code_base64: string | null
          qr_code_expira_em: string | null
          security_token: string | null
          status_conexao: string | null
          token: string
          ultima_verificacao: string | null
          unidade_id: string
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          base_url?: string | null
          created_at?: string | null
          desconto_etapa1?: number | null
          desconto_etapa2?: number | null
          id?: string
          instance_id: string
          instancia_nome?: string | null
          instancia_token?: string | null
          instancia_url?: string | null
          loja_foto_atualizada_em?: string | null
          loja_foto_url?: string | null
          meta_access_token?: string | null
          meta_phone_number_id?: string | null
          meta_verify_token?: string | null
          meta_waba_id?: string | null
          nome_bot?: string | null
          numero_telefone?: string | null
          preco_minimo_p13?: number | null
          preco_minimo_p20?: number | null
          provedor?: string
          provedor_tipo?: string | null
          qr_code_base64?: string | null
          qr_code_expira_em?: string | null
          security_token?: string | null
          status_conexao?: string | null
          token: string
          ultima_verificacao?: string | null
          unidade_id: string
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          base_url?: string | null
          created_at?: string | null
          desconto_etapa1?: number | null
          desconto_etapa2?: number | null
          id?: string
          instance_id?: string
          instancia_nome?: string | null
          instancia_token?: string | null
          instancia_url?: string | null
          loja_foto_atualizada_em?: string | null
          loja_foto_url?: string | null
          meta_access_token?: string | null
          meta_phone_number_id?: string | null
          meta_verify_token?: string | null
          meta_waba_id?: string | null
          nome_bot?: string | null
          numero_telefone?: string | null
          preco_minimo_p13?: number | null
          preco_minimo_p20?: number | null
          provedor?: string
          provedor_tipo?: string | null
          qr_code_base64?: string | null
          qr_code_expira_em?: string | null
          security_token?: string | null
          status_conexao?: string | null
          token?: string
          ultima_verificacao?: string | null
          unidade_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "integracoes_whatsapp_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: true
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      licitacao_documentos: {
        Row: {
          created_at: string
          id: string
          licitacao_id: string
          nome: string
          tipo: string
          url: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          licitacao_id: string
          nome: string
          tipo?: string
          url?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          licitacao_id?: string
          nome?: string
          tipo?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "licitacao_documentos_licitacao_id_fkey"
            columns: ["licitacao_id"]
            isOneToOne: false
            referencedRelation: "licitacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      licitacao_ocorrencias: {
        Row: {
          autor_id: string | null
          created_at: string
          descricao: string
          id: string
          licitacao_id: string
          tipo: string
        }
        Insert: {
          autor_id?: string | null
          created_at?: string
          descricao: string
          id?: string
          licitacao_id: string
          tipo?: string
        }
        Update: {
          autor_id?: string | null
          created_at?: string
          descricao?: string
          id?: string
          licitacao_id?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "licitacao_ocorrencias_licitacao_id_fkey"
            columns: ["licitacao_id"]
            isOneToOne: false
            referencedRelation: "licitacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      licitacoes: {
        Row: {
          cnpj_orgao: string | null
          created_at: string
          dados_anexos: Json
          data_abertura: string | null
          data_publicacao: string | null
          data_resultado: string | null
          data_vigencia_fim: string | null
          data_vigencia_inicio: string | null
          id: string
          link_edital: string | null
          local_entrega: string | null
          modalidade: string
          numero: string
          numero_processo: string | null
          objeto: string
          observacoes: string | null
          orgao: string
          prazo_entrega: string | null
          produtos: string | null
          responsavel_id: string | null
          status: string
          unidade_id: string | null
          updated_at: string
          valor_adjudicado: number | null
          valor_estimado: number | null
          valor_proposta: number | null
        }
        Insert: {
          cnpj_orgao?: string | null
          created_at?: string
          dados_anexos?: Json
          data_abertura?: string | null
          data_publicacao?: string | null
          data_resultado?: string | null
          data_vigencia_fim?: string | null
          data_vigencia_inicio?: string | null
          id?: string
          link_edital?: string | null
          local_entrega?: string | null
          modalidade?: string
          numero: string
          numero_processo?: string | null
          objeto: string
          observacoes?: string | null
          orgao: string
          prazo_entrega?: string | null
          produtos?: string | null
          responsavel_id?: string | null
          status?: string
          unidade_id?: string | null
          updated_at?: string
          valor_adjudicado?: number | null
          valor_estimado?: number | null
          valor_proposta?: number | null
        }
        Update: {
          cnpj_orgao?: string | null
          created_at?: string
          dados_anexos?: Json
          data_abertura?: string | null
          data_publicacao?: string | null
          data_resultado?: string | null
          data_vigencia_fim?: string | null
          data_vigencia_inicio?: string | null
          id?: string
          link_edital?: string | null
          local_entrega?: string | null
          modalidade?: string
          numero?: string
          numero_processo?: string | null
          objeto?: string
          observacoes?: string | null
          orgao?: string
          prazo_entrega?: string | null
          produtos?: string | null
          responsavel_id?: string | null
          status?: string
          unidade_id?: string | null
          updated_at?: string
          valor_adjudicado?: number | null
          valor_estimado?: number | null
          valor_proposta?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "licitacoes_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      lotes_produto: {
        Row: {
          certificado_url: string | null
          created_at: string
          data_fabricacao: string | null
          data_validade: string | null
          empresa_id: string
          fornecedor_id: string | null
          id: string
          numero_lote: string
          observacoes: string | null
          produto_id: string
          quantidade_atual: number
          quantidade_inicial: number
          status: string | null
          unidade_id: string | null
          updated_at: string
        }
        Insert: {
          certificado_url?: string | null
          created_at?: string
          data_fabricacao?: string | null
          data_validade?: string | null
          empresa_id: string
          fornecedor_id?: string | null
          id?: string
          numero_lote: string
          observacoes?: string | null
          produto_id: string
          quantidade_atual?: number
          quantidade_inicial?: number
          status?: string | null
          unidade_id?: string | null
          updated_at?: string
        }
        Update: {
          certificado_url?: string | null
          created_at?: string
          data_fabricacao?: string | null
          data_validade?: string | null
          empresa_id?: string
          fornecedor_id?: string | null
          id?: string
          numero_lote?: string
          observacoes?: string | null
          produto_id?: string
          quantidade_atual?: number
          quantidade_inicial?: number
          status?: string | null
          unidade_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lotes_produto_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lotes_produto_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lotes_produto_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lotes_produto_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      manutencoes: {
        Row: {
          created_at: string
          data: string
          descricao: string
          id: string
          oficina: string
          status: string
          tipo: string
          unidade_id: string | null
          updated_at: string
          valor: number
          veiculo_id: string
        }
        Insert: {
          created_at?: string
          data?: string
          descricao: string
          id?: string
          oficina: string
          status?: string
          tipo: string
          unidade_id?: string | null
          updated_at?: string
          valor: number
          veiculo_id: string
        }
        Update: {
          created_at?: string
          data?: string
          descricao?: string
          id?: string
          oficina?: string
          status?: string
          tipo?: string
          unidade_id?: string | null
          updated_at?: string
          valor?: number
          veiculo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "manutencoes_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manutencoes_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "veiculos"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_agendamentos: {
        Row: {
          conteudo_id: string | null
          created_at: string
          criado_por: string | null
          data_agendamento: string
          empresa_id: string
          hashtags: string | null
          id: string
          midia_url: string | null
          plataforma: string
          resultado_publicacao: Json | null
          social_account_id: string | null
          status: string
          texto: string | null
          unidade_id: string | null
          updated_at: string
        }
        Insert: {
          conteudo_id?: string | null
          created_at?: string
          criado_por?: string | null
          data_agendamento: string
          empresa_id: string
          hashtags?: string | null
          id?: string
          midia_url?: string | null
          plataforma: string
          resultado_publicacao?: Json | null
          social_account_id?: string | null
          status?: string
          texto?: string | null
          unidade_id?: string | null
          updated_at?: string
        }
        Update: {
          conteudo_id?: string | null
          created_at?: string
          criado_por?: string | null
          data_agendamento?: string
          empresa_id?: string
          hashtags?: string | null
          id?: string
          midia_url?: string | null
          plataforma?: string
          resultado_publicacao?: Json | null
          social_account_id?: string | null
          status?: string
          texto?: string | null
          unidade_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_agendamentos_conteudo_id_fkey"
            columns: ["conteudo_id"]
            isOneToOne: false
            referencedRelation: "marketing_conteudos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_agendamentos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_agendamentos_social_account_id_fkey"
            columns: ["social_account_id"]
            isOneToOne: false
            referencedRelation: "social_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_agendamentos_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_conteudos: {
        Row: {
          conteudo: string | null
          created_at: string
          criado_por: string | null
          empresa_id: string
          favorito: boolean
          hashtags: string | null
          id: string
          midia_url: string | null
          plataforma: string | null
          tipo: string
          titulo: string | null
          tom: string | null
          unidade_id: string | null
          updated_at: string
        }
        Insert: {
          conteudo?: string | null
          created_at?: string
          criado_por?: string | null
          empresa_id: string
          favorito?: boolean
          hashtags?: string | null
          id?: string
          midia_url?: string | null
          plataforma?: string | null
          tipo?: string
          titulo?: string | null
          tom?: string | null
          unidade_id?: string | null
          updated_at?: string
        }
        Update: {
          conteudo?: string | null
          created_at?: string
          criado_por?: string | null
          empresa_id?: string
          favorito?: boolean
          hashtags?: string | null
          id?: string
          midia_url?: string | null
          plataforma?: string | null
          tipo?: string
          titulo?: string | null
          tom?: string | null
          unidade_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_conteudos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_conteudos_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_conversas: {
        Row: {
          cliente_id: string | null
          created_at: string
          empresa_id: string
          fluxo_id: string | null
          id: string
          intencao_detectada: string | null
          mensagens: Json | null
          metadata: Json | null
          nome_contato: string | null
          plataforma: string
          status: string
          telefone: string | null
          unidade_id: string | null
          updated_at: string
        }
        Insert: {
          cliente_id?: string | null
          created_at?: string
          empresa_id: string
          fluxo_id?: string | null
          id?: string
          intencao_detectada?: string | null
          mensagens?: Json | null
          metadata?: Json | null
          nome_contato?: string | null
          plataforma?: string
          status?: string
          telefone?: string | null
          unidade_id?: string | null
          updated_at?: string
        }
        Update: {
          cliente_id?: string | null
          created_at?: string
          empresa_id?: string
          fluxo_id?: string | null
          id?: string
          intencao_detectada?: string | null
          mensagens?: Json | null
          metadata?: Json | null
          nome_contato?: string | null
          plataforma?: string
          status?: string
          telefone?: string | null
          unidade_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_conversas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_conversas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_conversas_fluxo_id_fkey"
            columns: ["fluxo_id"]
            isOneToOne: false
            referencedRelation: "marketing_fluxos_atendimento"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_conversas_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_fluxos_atendimento: {
        Row: {
          ativo: boolean
          created_at: string
          empresa_id: string
          id: string
          intencao: string
          mensagem_inicial: string | null
          nome: string
          passos: Json | null
          transferir_humano: boolean
          unidade_id: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          empresa_id: string
          id?: string
          intencao: string
          mensagem_inicial?: string | null
          nome: string
          passos?: Json | null
          transferir_humano?: boolean
          unidade_id?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          empresa_id?: string
          id?: string
          intencao?: string
          mensagem_inicial?: string | null
          nome?: string
          passos?: Json | null
          transferir_humano?: boolean
          unidade_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_fluxos_atendimento_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_fluxos_atendimento_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_imagens: {
        Row: {
          created_at: string
          created_by: string | null
          empresa_id: string
          favorito: boolean
          id: string
          origem: string
          prompt: string | null
          tags: string | null
          titulo: string | null
          unidade_id: string | null
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          empresa_id: string
          favorito?: boolean
          id?: string
          origem: string
          prompt?: string | null
          tags?: string | null
          titulo?: string | null
          unidade_id?: string | null
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          empresa_id?: string
          favorito?: boolean
          id?: string
          origem?: string
          prompt?: string | null
          tags?: string | null
          titulo?: string | null
          unidade_id?: string | null
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      marketing_metricas: {
        Row: {
          agendamento_id: string | null
          alcance: number | null
          cliques: number | null
          comentarios: number | null
          compartilhamentos: number | null
          conversoes: number | null
          created_at: string
          curtidas: number | null
          data_metrica: string
          empresa_id: string
          id: string
          impressoes: number | null
          pedidos_gerados: number | null
          plataforma: string
          social_account_id: string | null
          unidade_id: string | null
        }
        Insert: {
          agendamento_id?: string | null
          alcance?: number | null
          cliques?: number | null
          comentarios?: number | null
          compartilhamentos?: number | null
          conversoes?: number | null
          created_at?: string
          curtidas?: number | null
          data_metrica?: string
          empresa_id: string
          id?: string
          impressoes?: number | null
          pedidos_gerados?: number | null
          plataforma: string
          social_account_id?: string | null
          unidade_id?: string | null
        }
        Update: {
          agendamento_id?: string | null
          alcance?: number | null
          cliques?: number | null
          comentarios?: number | null
          compartilhamentos?: number | null
          conversoes?: number | null
          created_at?: string
          curtidas?: number | null
          data_metrica?: string
          empresa_id?: string
          id?: string
          impressoes?: number | null
          pedidos_gerados?: number | null
          plataforma?: string
          social_account_id?: string | null
          unidade_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketing_metricas_agendamento_id_fkey"
            columns: ["agendamento_id"]
            isOneToOne: false
            referencedRelation: "marketing_agendamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_metricas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_metricas_social_account_id_fkey"
            columns: ["social_account_id"]
            isOneToOne: false
            referencedRelation: "social_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_metricas_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_templates: {
        Row: {
          categoria: string
          created_at: string
          created_by: string | null
          dica: string | null
          empresa_id: string | null
          favorito: boolean
          hashtags: string | null
          id: string
          is_padrao: boolean
          legenda: string
          nome: string
          plataforma: string
          updated_at: string
        }
        Insert: {
          categoria: string
          created_at?: string
          created_by?: string | null
          dica?: string | null
          empresa_id?: string | null
          favorito?: boolean
          hashtags?: string | null
          id?: string
          is_padrao?: boolean
          legenda: string
          nome: string
          plataforma: string
          updated_at?: string
        }
        Update: {
          categoria?: string
          created_at?: string
          created_by?: string | null
          dica?: string | null
          empresa_id?: string | null
          favorito?: boolean
          hashtags?: string | null
          id?: string
          is_padrao?: boolean
          legenda?: string
          nome?: string
          plataforma?: string
          updated_at?: string
        }
        Relationships: []
      }
      mdfe_nfes_vinculadas: {
        Row: {
          chave_acesso: string
          created_at: string
          destinatario: string | null
          id: string
          mdfe_id: string
          nfe_id: string | null
          valor: number | null
        }
        Insert: {
          chave_acesso: string
          created_at?: string
          destinatario?: string | null
          id?: string
          mdfe_id: string
          nfe_id?: string | null
          valor?: number | null
        }
        Update: {
          chave_acesso?: string
          created_at?: string
          destinatario?: string | null
          id?: string
          mdfe_id?: string
          nfe_id?: string | null
          valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "mdfe_nfes_vinculadas_mdfe_id_fkey"
            columns: ["mdfe_id"]
            isOneToOne: false
            referencedRelation: "notas_fiscais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mdfe_nfes_vinculadas_nfe_id_fkey"
            columns: ["nfe_id"]
            isOneToOne: false
            referencedRelation: "notas_fiscais"
            referencedColumns: ["id"]
          },
        ]
      }
      metas: {
        Row: {
          created_at: string
          descricao: string | null
          id: string
          prazo: string
          status: string
          tipo: string
          titulo: string
          unidade_id: string | null
          updated_at: string
          valor_atual: number
          valor_objetivo: number
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          id?: string
          prazo: string
          status?: string
          tipo: string
          titulo: string
          unidade_id?: string | null
          updated_at?: string
          valor_atual?: number
          valor_objetivo: number
        }
        Update: {
          created_at?: string
          descricao?: string | null
          id?: string
          prazo?: string
          status?: string
          tipo?: string
          titulo?: string
          unidade_id?: string | null
          updated_at?: string
          valor_atual?: number
          valor_objetivo?: number
        }
        Relationships: [
          {
            foreignKeyName: "metas_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      movimentacoes_bancarias: {
        Row: {
          categoria: string
          conta_bancaria_id: string
          created_at: string
          data: string
          descricao: string
          id: string
          observacoes: string | null
          plano_contas_id: string | null
          referencia_id: string | null
          referencia_tipo: string | null
          saldo_apos: number | null
          tipo: string
          unidade_id: string | null
          updated_at: string
          user_id: string | null
          valor: number
        }
        Insert: {
          categoria?: string
          conta_bancaria_id: string
          created_at?: string
          data?: string
          descricao: string
          id?: string
          observacoes?: string | null
          plano_contas_id?: string | null
          referencia_id?: string | null
          referencia_tipo?: string | null
          saldo_apos?: number | null
          tipo: string
          unidade_id?: string | null
          updated_at?: string
          user_id?: string | null
          valor?: number
        }
        Update: {
          categoria?: string
          conta_bancaria_id?: string
          created_at?: string
          data?: string
          descricao?: string
          id?: string
          observacoes?: string | null
          plano_contas_id?: string | null
          referencia_id?: string | null
          referencia_tipo?: string | null
          saldo_apos?: number | null
          tipo?: string
          unidade_id?: string | null
          updated_at?: string
          user_id?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "movimentacoes_bancarias_conta_bancaria_id_fkey"
            columns: ["conta_bancaria_id"]
            isOneToOne: false
            referencedRelation: "contas_bancarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimentacoes_bancarias_plano_contas_id_fkey"
            columns: ["plano_contas_id"]
            isOneToOne: false
            referencedRelation: "plano_contas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimentacoes_bancarias_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      movimentacoes_caixa: {
        Row: {
          categoria: string | null
          created_at: string
          descricao: string
          entregador_id: string | null
          id: string
          observacoes: string | null
          pedido_id: string | null
          plano_contas_id: string | null
          responsavel: string | null
          solicitante: string | null
          status: string
          tipo: string
          unidade_id: string | null
          updated_at: string
          urgencia: string | null
          valor: number
        }
        Insert: {
          categoria?: string | null
          created_at?: string
          descricao: string
          entregador_id?: string | null
          id?: string
          observacoes?: string | null
          pedido_id?: string | null
          plano_contas_id?: string | null
          responsavel?: string | null
          solicitante?: string | null
          status?: string
          tipo: string
          unidade_id?: string | null
          updated_at?: string
          urgencia?: string | null
          valor?: number
        }
        Update: {
          categoria?: string | null
          created_at?: string
          descricao?: string
          entregador_id?: string | null
          id?: string
          observacoes?: string | null
          pedido_id?: string | null
          plano_contas_id?: string | null
          responsavel?: string | null
          solicitante?: string | null
          status?: string
          tipo?: string
          unidade_id?: string | null
          updated_at?: string
          urgencia?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "movimentacoes_caixa_entregador_id_fkey"
            columns: ["entregador_id"]
            isOneToOne: false
            referencedRelation: "entregadores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimentacoes_caixa_entregador_id_fkey"
            columns: ["entregador_id"]
            isOneToOne: false
            referencedRelation: "vw_alertas_cnh"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimentacoes_caixa_entregador_id_fkey"
            columns: ["entregador_id"]
            isOneToOne: false
            referencedRelation: "vw_comissao_entregador"
            referencedColumns: ["entregador_id"]
          },
          {
            foreignKeyName: "movimentacoes_caixa_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimentacoes_caixa_plano_contas_id_fkey"
            columns: ["plano_contas_id"]
            isOneToOne: false
            referencedRelation: "plano_contas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimentacoes_caixa_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      movimentacoes_estoque: {
        Row: {
          created_at: string
          id: string
          observacoes: string | null
          produto_id: string
          quantidade: number
          tipo: string
          unidade_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          observacoes?: string | null
          produto_id: string
          quantidade?: number
          tipo: string
          unidade_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          observacoes?: string | null
          produto_id?: string
          quantidade?: number
          tipo?: string
          unidade_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "movimentacoes_estoque_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimentacoes_estoque_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      multas_frota: {
        Row: {
          created_at: string
          data_infracao: string
          data_vencimento: string | null
          descricao: string
          entregador_id: string | null
          id: string
          observacoes: string | null
          pontos: number
          responsavel: string
          status: string
          unidade_id: string | null
          updated_at: string
          valor: number
          veiculo_id: string
        }
        Insert: {
          created_at?: string
          data_infracao?: string
          data_vencimento?: string | null
          descricao: string
          entregador_id?: string | null
          id?: string
          observacoes?: string | null
          pontos?: number
          responsavel?: string
          status?: string
          unidade_id?: string | null
          updated_at?: string
          valor?: number
          veiculo_id: string
        }
        Update: {
          created_at?: string
          data_infracao?: string
          data_vencimento?: string | null
          descricao?: string
          entregador_id?: string | null
          id?: string
          observacoes?: string | null
          pontos?: number
          responsavel?: string
          status?: string
          unidade_id?: string | null
          updated_at?: string
          valor?: number
          veiculo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "multas_frota_entregador_id_fkey"
            columns: ["entregador_id"]
            isOneToOne: false
            referencedRelation: "entregadores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "multas_frota_entregador_id_fkey"
            columns: ["entregador_id"]
            isOneToOne: false
            referencedRelation: "vw_alertas_cnh"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "multas_frota_entregador_id_fkey"
            columns: ["entregador_id"]
            isOneToOne: false
            referencedRelation: "vw_comissao_entregador"
            referencedColumns: ["entregador_id"]
          },
          {
            foreignKeyName: "multas_frota_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "multas_frota_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "veiculos"
            referencedColumns: ["id"]
          },
        ]
      }
      nota_fiscal_itens: {
        Row: {
          cfop: string | null
          created_at: string
          descricao: string
          id: string
          ncm: string | null
          nota_fiscal_id: string
          produto_id: string | null
          quantidade: number
          unidade: string | null
          valor_total: number
          valor_unitario: number
        }
        Insert: {
          cfop?: string | null
          created_at?: string
          descricao: string
          id?: string
          ncm?: string | null
          nota_fiscal_id: string
          produto_id?: string | null
          quantidade?: number
          unidade?: string | null
          valor_total?: number
          valor_unitario?: number
        }
        Update: {
          cfop?: string | null
          created_at?: string
          descricao?: string
          id?: string
          ncm?: string | null
          nota_fiscal_id?: string
          produto_id?: string | null
          quantidade?: number
          unidade?: string | null
          valor_total?: number
          valor_unitario?: number
        }
        Relationships: [
          {
            foreignKeyName: "nota_fiscal_itens_nota_fiscal_id_fkey"
            columns: ["nota_fiscal_id"]
            isOneToOne: false
            referencedRelation: "notas_fiscais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nota_fiscal_itens_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      notas_fiscais: {
        Row: {
          carta_correcao: string | null
          chave_acesso: string | null
          created_at: string
          created_by: string | null
          danfe_url: string | null
          data_cancelamento: string | null
          data_emissao: string
          destinatario_cep: string | null
          destinatario_cidade_uf: string | null
          destinatario_cpf_cnpj: string | null
          destinatario_endereco: string | null
          destinatario_ie: string | null
          destinatario_nome: string | null
          destinatario_telefone: string | null
          especie_volumes: string | null
          focus_id: string | null
          focus_ref: string | null
          forma_pagamento: string | null
          id: string
          info_complementares: string | null
          info_fisco: string | null
          marca_volumes: string | null
          modal: string | null
          modalidade_frete: string | null
          motivo_cancelamento: string | null
          motivo_rejeicao: string | null
          motorista_cpf: string | null
          motorista_nome: string | null
          natureza_operacao: string | null
          numeracao_volumes: string | null
          numero: string | null
          observacoes: string | null
          peso_bruto: number | null
          peso_liquido: number | null
          placa: string | null
          protocolo: string | null
          protocolo_cancelamento: string | null
          protocolo_carta_correcao: string | null
          quantidade_volumes: number | null
          remetente_cpf_cnpj: string | null
          remetente_endereco: string | null
          remetente_nome: string | null
          rntrc: string | null
          serie: string | null
          status: string
          tipo: string
          transportadora_cidade_uf: string | null
          transportadora_cnpj: string | null
          transportadora_endereco: string | null
          transportadora_ie: string | null
          transportadora_nome: string | null
          uf_carregamento: string | null
          uf_descarregamento: string | null
          uf_placa: string | null
          unidade_id: string | null
          updated_at: string
          valor_desconto: number | null
          valor_frete: number | null
          valor_icms: number | null
          valor_mercadoria: number | null
          valor_total: number
          xml_conteudo: string | null
          xml_importado: boolean | null
          xml_url: string | null
        }
        Insert: {
          carta_correcao?: string | null
          chave_acesso?: string | null
          created_at?: string
          created_by?: string | null
          danfe_url?: string | null
          data_cancelamento?: string | null
          data_emissao?: string
          destinatario_cep?: string | null
          destinatario_cidade_uf?: string | null
          destinatario_cpf_cnpj?: string | null
          destinatario_endereco?: string | null
          destinatario_ie?: string | null
          destinatario_nome?: string | null
          destinatario_telefone?: string | null
          especie_volumes?: string | null
          focus_id?: string | null
          focus_ref?: string | null
          forma_pagamento?: string | null
          id?: string
          info_complementares?: string | null
          info_fisco?: string | null
          marca_volumes?: string | null
          modal?: string | null
          modalidade_frete?: string | null
          motivo_cancelamento?: string | null
          motivo_rejeicao?: string | null
          motorista_cpf?: string | null
          motorista_nome?: string | null
          natureza_operacao?: string | null
          numeracao_volumes?: string | null
          numero?: string | null
          observacoes?: string | null
          peso_bruto?: number | null
          peso_liquido?: number | null
          placa?: string | null
          protocolo?: string | null
          protocolo_cancelamento?: string | null
          protocolo_carta_correcao?: string | null
          quantidade_volumes?: number | null
          remetente_cpf_cnpj?: string | null
          remetente_endereco?: string | null
          remetente_nome?: string | null
          rntrc?: string | null
          serie?: string | null
          status?: string
          tipo?: string
          transportadora_cidade_uf?: string | null
          transportadora_cnpj?: string | null
          transportadora_endereco?: string | null
          transportadora_ie?: string | null
          transportadora_nome?: string | null
          uf_carregamento?: string | null
          uf_descarregamento?: string | null
          uf_placa?: string | null
          unidade_id?: string | null
          updated_at?: string
          valor_desconto?: number | null
          valor_frete?: number | null
          valor_icms?: number | null
          valor_mercadoria?: number | null
          valor_total?: number
          xml_conteudo?: string | null
          xml_importado?: boolean | null
          xml_url?: string | null
        }
        Update: {
          carta_correcao?: string | null
          chave_acesso?: string | null
          created_at?: string
          created_by?: string | null
          danfe_url?: string | null
          data_cancelamento?: string | null
          data_emissao?: string
          destinatario_cep?: string | null
          destinatario_cidade_uf?: string | null
          destinatario_cpf_cnpj?: string | null
          destinatario_endereco?: string | null
          destinatario_ie?: string | null
          destinatario_nome?: string | null
          destinatario_telefone?: string | null
          especie_volumes?: string | null
          focus_id?: string | null
          focus_ref?: string | null
          forma_pagamento?: string | null
          id?: string
          info_complementares?: string | null
          info_fisco?: string | null
          marca_volumes?: string | null
          modal?: string | null
          modalidade_frete?: string | null
          motivo_cancelamento?: string | null
          motivo_rejeicao?: string | null
          motorista_cpf?: string | null
          motorista_nome?: string | null
          natureza_operacao?: string | null
          numeracao_volumes?: string | null
          numero?: string | null
          observacoes?: string | null
          peso_bruto?: number | null
          peso_liquido?: number | null
          placa?: string | null
          protocolo?: string | null
          protocolo_cancelamento?: string | null
          protocolo_carta_correcao?: string | null
          quantidade_volumes?: number | null
          remetente_cpf_cnpj?: string | null
          remetente_endereco?: string | null
          remetente_nome?: string | null
          rntrc?: string | null
          serie?: string | null
          status?: string
          tipo?: string
          transportadora_cidade_uf?: string | null
          transportadora_cnpj?: string | null
          transportadora_endereco?: string | null
          transportadora_ie?: string | null
          transportadora_nome?: string | null
          uf_carregamento?: string | null
          uf_descarregamento?: string | null
          uf_placa?: string | null
          unidade_id?: string | null
          updated_at?: string
          valor_desconto?: number | null
          valor_frete?: number | null
          valor_icms?: number | null
          valor_mercadoria?: number | null
          valor_total?: number
          xml_conteudo?: string | null
          xml_importado?: boolean | null
          xml_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notas_fiscais_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      notificacoes: {
        Row: {
          created_at: string
          id: string
          lida: boolean
          link: string | null
          mensagem: string
          tipo: string
          titulo: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          lida?: boolean
          link?: string | null
          mensagem: string
          tipo?: string
          titulo: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          lida?: boolean
          link?: string | null
          mensagem?: string
          tipo?: string
          titulo?: string
          user_id?: string
        }
        Relationships: []
      }
      notificacoes_status_pedido: {
        Row: {
          cliente_id: string | null
          created_at: string | null
          enviado: boolean | null
          id: string
          mensagem: string | null
          pedido_id: string
          status_anterior: string | null
          status_novo: string
          telefone: string | null
        }
        Insert: {
          cliente_id?: string | null
          created_at?: string | null
          enviado?: boolean | null
          id?: string
          mensagem?: string | null
          pedido_id: string
          status_anterior?: string | null
          status_novo: string
          telefone?: string | null
        }
        Update: {
          cliente_id?: string | null
          created_at?: string | null
          enviado?: boolean | null
          id?: string
          mensagem?: string | null
          pedido_id?: string
          status_anterior?: string | null
          status_novo?: string
          telefone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notificacoes_status_pedido_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificacoes_status_pedido_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
        ]
      }
      oauth_states: {
        Row: {
          created_at: string
          empresa_id: string
          expires_at: string
          nonce: string
          return_url: string | null
          unidade_id: string | null
          used_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          empresa_id: string
          expires_at?: string
          nonce?: string
          return_url?: string | null
          unidade_id?: string | null
          used_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          empresa_id?: string
          expires_at?: string
          nonce?: string
          return_url?: string | null
          unidade_id?: string | null
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      onboarding_checklists: {
        Row: {
          created_at: string
          data_conclusao: string | null
          data_inicio: string
          funcionario_id: string
          id: string
          observacoes: string | null
          responsavel_id: string | null
          status: string
          tipo: string
          unidade_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          data_conclusao?: string | null
          data_inicio?: string
          funcionario_id: string
          id?: string
          observacoes?: string | null
          responsavel_id?: string | null
          status?: string
          tipo?: string
          unidade_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          data_conclusao?: string | null
          data_inicio?: string
          funcionario_id?: string
          id?: string
          observacoes?: string | null
          responsavel_id?: string | null
          status?: string
          tipo?: string
          unidade_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_checklists_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_checklists_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_itens: {
        Row: {
          checklist_id: string
          concluido: boolean
          created_at: string
          data_conclusao: string | null
          descricao: string
          id: string
          ordem: number
          responsavel: string | null
        }
        Insert: {
          checklist_id: string
          concluido?: boolean
          created_at?: string
          data_conclusao?: string | null
          descricao: string
          id?: string
          ordem?: number
          responsavel?: string | null
        }
        Update: {
          checklist_id?: string
          concluido?: boolean
          created_at?: string
          data_conclusao?: string | null
          descricao?: string
          id?: string
          ordem?: number
          responsavel?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_itens_checklist_id_fkey"
            columns: ["checklist_id"]
            isOneToOne: false
            referencedRelation: "onboarding_checklists"
            referencedColumns: ["id"]
          },
        ]
      }
      operadoras_cartao: {
        Row: {
          ativo: boolean
          bandeira: string | null
          created_at: string
          id: string
          nome: string
          prazo_credito: number
          prazo_debito: number
          prazo_pix: number | null
          taxa_credito_parcelado: number
          taxa_credito_vista: number
          taxa_debito: number
          taxa_pix: number | null
          unidade_id: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          bandeira?: string | null
          created_at?: string
          id?: string
          nome: string
          prazo_credito?: number
          prazo_debito?: number
          prazo_pix?: number | null
          taxa_credito_parcelado?: number
          taxa_credito_vista?: number
          taxa_debito?: number
          taxa_pix?: number | null
          unidade_id?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          bandeira?: string | null
          created_at?: string
          id?: string
          nome?: string
          prazo_credito?: number
          prazo_debito?: number
          prazo_pix?: number | null
          taxa_credito_parcelado?: number
          taxa_credito_vista?: number
          taxa_debito?: number
          taxa_pix?: number | null
          unidade_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "operadoras_cartao_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      orcamento_itens: {
        Row: {
          created_at: string
          descricao: string
          id: string
          orcamento_id: string
          preco_unitario: number
          produto_id: string | null
          quantidade: number
          subtotal: number
        }
        Insert: {
          created_at?: string
          descricao: string
          id?: string
          orcamento_id: string
          preco_unitario?: number
          produto_id?: string | null
          quantidade?: number
          subtotal?: number
        }
        Update: {
          created_at?: string
          descricao?: string
          id?: string
          orcamento_id?: string
          preco_unitario?: number
          produto_id?: string | null
          quantidade?: number
          subtotal?: number
        }
        Relationships: [
          {
            foreignKeyName: "orcamento_itens_orcamento_id_fkey"
            columns: ["orcamento_id"]
            isOneToOne: false
            referencedRelation: "orcamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamento_itens_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      orcamentos: {
        Row: {
          cliente_id: string | null
          cliente_nome: string
          cnpj_escola: string | null
          created_at: string
          created_by: string | null
          data_emissao: string
          desconto: number | null
          estabelecimento: string | null
          forma_pagamento: string | null
          id: string
          municipio: string | null
          nre: string | null
          numero: number
          observacoes: string | null
          status: string
          tipo: string
          unidade_id: string | null
          updated_at: string
          validade: string
          validade_inicio: string | null
          valor_total: number
        }
        Insert: {
          cliente_id?: string | null
          cliente_nome: string
          cnpj_escola?: string | null
          created_at?: string
          created_by?: string | null
          data_emissao?: string
          desconto?: number | null
          estabelecimento?: string | null
          forma_pagamento?: string | null
          id?: string
          municipio?: string | null
          nre?: string | null
          numero?: number
          observacoes?: string | null
          status?: string
          tipo?: string
          unidade_id?: string | null
          updated_at?: string
          validade?: string
          validade_inicio?: string | null
          valor_total?: number
        }
        Update: {
          cliente_id?: string | null
          cliente_nome?: string
          cnpj_escola?: string | null
          created_at?: string
          created_by?: string | null
          data_emissao?: string
          desconto?: number | null
          estabelecimento?: string | null
          forma_pagamento?: string | null
          id?: string
          municipio?: string | null
          nre?: string | null
          numero?: number
          observacoes?: string | null
          status?: string
          tipo?: string
          unidade_id?: string | null
          updated_at?: string
          validade?: string
          validade_inicio?: string | null
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "orcamentos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamentos_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      pagamentos_cartao: {
        Row: {
          autorizacao: string | null
          bandeira: string | null
          conta_receber_id: string | null
          created_at: string
          data_liquidacao: string | null
          data_prevista_liquidacao: string | null
          empresa_id: string | null
          entregador_id: string | null
          id: string
          liquidado: boolean
          loja_id: string | null
          maquininha_serial: string | null
          nsu: string | null
          parcelas: number
          pedido_id: string | null
          status: string
          tipo: string
          transaction_id: string
          unidade_id: string | null
          updated_at: string
          valor_bruto: number
          valor_liquido: number | null
          valor_taxa: number | null
        }
        Insert: {
          autorizacao?: string | null
          bandeira?: string | null
          conta_receber_id?: string | null
          created_at?: string
          data_liquidacao?: string | null
          data_prevista_liquidacao?: string | null
          empresa_id?: string | null
          entregador_id?: string | null
          id?: string
          liquidado?: boolean
          loja_id?: string | null
          maquininha_serial?: string | null
          nsu?: string | null
          parcelas?: number
          pedido_id?: string | null
          status?: string
          tipo: string
          transaction_id: string
          unidade_id?: string | null
          updated_at?: string
          valor_bruto: number
          valor_liquido?: number | null
          valor_taxa?: number | null
        }
        Update: {
          autorizacao?: string | null
          bandeira?: string | null
          conta_receber_id?: string | null
          created_at?: string
          data_liquidacao?: string | null
          data_prevista_liquidacao?: string | null
          empresa_id?: string | null
          entregador_id?: string | null
          id?: string
          liquidado?: boolean
          loja_id?: string | null
          maquininha_serial?: string | null
          nsu?: string | null
          parcelas?: number
          pedido_id?: string | null
          status?: string
          tipo?: string
          transaction_id?: string
          unidade_id?: string | null
          updated_at?: string
          valor_bruto?: number
          valor_liquido?: number | null
          valor_taxa?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pagamentos_cartao_conta_receber_id_fkey"
            columns: ["conta_receber_id"]
            isOneToOne: false
            referencedRelation: "contas_receber"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagamentos_cartao_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagamentos_cartao_entregador_id_fkey"
            columns: ["entregador_id"]
            isOneToOne: false
            referencedRelation: "entregadores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagamentos_cartao_entregador_id_fkey"
            columns: ["entregador_id"]
            isOneToOne: false
            referencedRelation: "vw_alertas_cnh"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagamentos_cartao_entregador_id_fkey"
            columns: ["entregador_id"]
            isOneToOne: false
            referencedRelation: "vw_comissao_entregador"
            referencedColumns: ["entregador_id"]
          },
          {
            foreignKeyName: "pagamentos_cartao_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagamentos_cartao_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagamentos_cartao_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      pedido_itens: {
        Row: {
          created_at: string
          id: string
          pedido_id: string
          preco_unitario: number
          produto_id: string | null
          quantidade: number
        }
        Insert: {
          created_at?: string
          id?: string
          pedido_id: string
          preco_unitario: number
          produto_id?: string | null
          quantidade?: number
        }
        Update: {
          created_at?: string
          id?: string
          pedido_id?: string
          preco_unitario?: number
          produto_id?: string | null
          quantidade?: number
        }
        Relationships: [
          {
            foreignKeyName: "pedido_itens_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedido_itens_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      pedidos: {
        Row: {
          agendado: boolean
          bairro_entrega: string | null
          canal_venda: string | null
          cep_entrega: string | null
          cheque_banco: string | null
          cheque_foto_url: string | null
          cheque_numero: string | null
          cidade_entrega: string | null
          cliente_id: string | null
          codigo_voucher: string | null
          complemento_entrega: string | null
          comprovante_cartao_url: string | null
          created_at: string
          created_minute: number | null
          data_agendamento: string | null
          data_entrega: string | null
          data_vencimento_fiado: string | null
          endereco_entrega: string | null
          entregador_id: string | null
          escalado_em: string | null
          escalado_para: string | null
          forma_pagamento: string | null
          id: string
          latitude: number | null
          longitude: number | null
          numero_entrega: string | null
          numero_sequencial: number | null
          observacoes: string | null
          responsavel_acerto: string | null
          sla_cumprido: boolean | null
          sla_minutos: number | null
          status: string | null
          tempo_entrega_minutos: number | null
          troco_para: number | null
          unidade_id: string | null
          updated_at: string
          valor_total: number | null
        }
        Insert: {
          agendado?: boolean
          bairro_entrega?: string | null
          canal_venda?: string | null
          cep_entrega?: string | null
          cheque_banco?: string | null
          cheque_foto_url?: string | null
          cheque_numero?: string | null
          cidade_entrega?: string | null
          cliente_id?: string | null
          codigo_voucher?: string | null
          complemento_entrega?: string | null
          comprovante_cartao_url?: string | null
          created_at?: string
          created_minute?: number | null
          data_agendamento?: string | null
          data_entrega?: string | null
          data_vencimento_fiado?: string | null
          endereco_entrega?: string | null
          entregador_id?: string | null
          escalado_em?: string | null
          escalado_para?: string | null
          forma_pagamento?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          numero_entrega?: string | null
          numero_sequencial?: number | null
          observacoes?: string | null
          responsavel_acerto?: string | null
          sla_cumprido?: boolean | null
          sla_minutos?: number | null
          status?: string | null
          tempo_entrega_minutos?: number | null
          troco_para?: number | null
          unidade_id?: string | null
          updated_at?: string
          valor_total?: number | null
        }
        Update: {
          agendado?: boolean
          bairro_entrega?: string | null
          canal_venda?: string | null
          cep_entrega?: string | null
          cheque_banco?: string | null
          cheque_foto_url?: string | null
          cheque_numero?: string | null
          cidade_entrega?: string | null
          cliente_id?: string | null
          codigo_voucher?: string | null
          complemento_entrega?: string | null
          comprovante_cartao_url?: string | null
          created_at?: string
          created_minute?: number | null
          data_agendamento?: string | null
          data_entrega?: string | null
          data_vencimento_fiado?: string | null
          endereco_entrega?: string | null
          entregador_id?: string | null
          escalado_em?: string | null
          escalado_para?: string | null
          forma_pagamento?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          numero_entrega?: string | null
          numero_sequencial?: number | null
          observacoes?: string | null
          responsavel_acerto?: string | null
          sla_cumprido?: boolean | null
          sla_minutos?: number | null
          status?: string | null
          tempo_entrega_minutos?: number | null
          troco_para?: number | null
          unidade_id?: string | null
          updated_at?: string
          valor_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pedidos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_entregador_id_fkey"
            columns: ["entregador_id"]
            isOneToOne: false
            referencedRelation: "entregadores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_entregador_id_fkey"
            columns: ["entregador_id"]
            isOneToOne: false
            referencedRelation: "vw_alertas_cnh"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_entregador_id_fkey"
            columns: ["entregador_id"]
            isOneToOne: false
            referencedRelation: "vw_comissao_entregador"
            referencedColumns: ["entregador_id"]
          },
          {
            foreignKeyName: "pedidos_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      plano_contas: {
        Row: {
          ativo: boolean
          codigo: string
          created_at: string
          descricao: string | null
          empresa_id: string | null
          grupo: string
          id: string
          nome: string
          tipo: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          codigo: string
          created_at?: string
          descricao?: string | null
          empresa_id?: string | null
          grupo?: string
          id?: string
          nome: string
          tipo?: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          codigo?: string
          created_at?: string
          descricao?: string | null
          empresa_id?: string | null
          grupo?: string
          id?: string
          nome?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plano_contas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      politicas_cobranca: {
        Row: {
          ativo: boolean | null
          created_at: string
          dias_atraso_alerta: number | null
          dias_atraso_bloqueio: number | null
          dias_atraso_negativacao: number | null
          empresa_id: string
          id: string
          mensagem_alerta: string | null
          mensagem_bloqueio: string | null
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string
          dias_atraso_alerta?: number | null
          dias_atraso_bloqueio?: number | null
          dias_atraso_negativacao?: number | null
          empresa_id: string
          id?: string
          mensagem_alerta?: string | null
          mensagem_bloqueio?: string | null
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean | null
          created_at?: string
          dias_atraso_alerta?: number | null
          dias_atraso_bloqueio?: number | null
          dias_atraso_negativacao?: number | null
          empresa_id?: string
          id?: string
          mensagem_alerta?: string | null
          mensagem_bloqueio?: string | null
          nome?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "politicas_cobranca_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      ponto_eletronico: {
        Row: {
          created_at: string
          data: string
          entrada: string | null
          funcionario_id: string
          horas_extras: number | null
          horas_trabalhadas: number | null
          id: string
          observacoes: string | null
          retorno_almoco: string | null
          saida: string | null
          saida_almoco: string | null
          status: string
          unidade_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          data?: string
          entrada?: string | null
          funcionario_id: string
          horas_extras?: number | null
          horas_trabalhadas?: number | null
          id?: string
          observacoes?: string | null
          retorno_almoco?: string | null
          saida?: string | null
          saida_almoco?: string | null
          status?: string
          unidade_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          data?: string
          entrada?: string | null
          funcionario_id?: string
          horas_extras?: number | null
          horas_trabalhadas?: number | null
          id?: string
          observacoes?: string | null
          retorno_almoco?: string | null
          saida?: string | null
          saida_almoco?: string | null
          status?: string
          unidade_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ponto_eletronico_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ponto_eletronico_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      premiacoes: {
        Row: {
          created_at: string
          ganhador_id: string | null
          id: string
          mes_referencia: string | null
          meta_descricao: string | null
          nome: string
          premio: string | null
          status: string
          unidade_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          ganhador_id?: string | null
          id?: string
          mes_referencia?: string | null
          meta_descricao?: string | null
          nome: string
          premio?: string | null
          status?: string
          unidade_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          ganhador_id?: string | null
          id?: string
          mes_referencia?: string | null
          meta_descricao?: string | null
          nome?: string
          premio?: string | null
          status?: string
          unidade_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "premiacoes_ganhador_id_fkey"
            columns: ["ganhador_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "premiacoes_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      produtos: {
        Row: {
          aliquota_cofins: number | null
          aliquota_icms: number | null
          aliquota_pis: number | null
          ativo: boolean | null
          botijao_par_id: string | null
          categoria: string | null
          cest: string | null
          cfop_entrada_padrao: string | null
          cfop_saida_padrao: string | null
          codigo_anp: string | null
          codigo_barras: string | null
          created_at: string
          csosn_icms: string | null
          cst_cofins: string | null
          cst_icms: string | null
          cst_pis: string | null
          descricao: string | null
          estoque: number | null
          estoque_unico: boolean
          id: string
          image_url: string | null
          monofasico: boolean | null
          ncm: string | null
          nome: string
          preco: number
          preco_custo: number | null
          preco_portaria: number | null
          preco_telefone: number | null
          tipo_botijao: string | null
          unidade_id: string | null
          unidade_tributavel: string | null
          updated_at: string
        }
        Insert: {
          aliquota_cofins?: number | null
          aliquota_icms?: number | null
          aliquota_pis?: number | null
          ativo?: boolean | null
          botijao_par_id?: string | null
          categoria?: string | null
          cest?: string | null
          cfop_entrada_padrao?: string | null
          cfop_saida_padrao?: string | null
          codigo_anp?: string | null
          codigo_barras?: string | null
          created_at?: string
          csosn_icms?: string | null
          cst_cofins?: string | null
          cst_icms?: string | null
          cst_pis?: string | null
          descricao?: string | null
          estoque?: number | null
          estoque_unico?: boolean
          id?: string
          image_url?: string | null
          monofasico?: boolean | null
          ncm?: string | null
          nome: string
          preco: number
          preco_custo?: number | null
          preco_portaria?: number | null
          preco_telefone?: number | null
          tipo_botijao?: string | null
          unidade_id?: string | null
          unidade_tributavel?: string | null
          updated_at?: string
        }
        Update: {
          aliquota_cofins?: number | null
          aliquota_icms?: number | null
          aliquota_pis?: number | null
          ativo?: boolean | null
          botijao_par_id?: string | null
          categoria?: string | null
          cest?: string | null
          cfop_entrada_padrao?: string | null
          cfop_saida_padrao?: string | null
          codigo_anp?: string | null
          codigo_barras?: string | null
          created_at?: string
          csosn_icms?: string | null
          cst_cofins?: string | null
          cst_icms?: string | null
          cst_pis?: string | null
          descricao?: string | null
          estoque?: number | null
          estoque_unico?: boolean
          id?: string
          image_url?: string | null
          monofasico?: boolean | null
          ncm?: string | null
          nome?: string
          preco?: number
          preco_custo?: number | null
          preco_portaria?: number | null
          preco_telefone?: number | null
          tipo_botijao?: string | null
          unidade_id?: string | null
          unidade_tributavel?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "produtos_botijao_par_id_fkey"
            columns: ["botijao_par_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "produtos_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          empresa_id: string | null
          full_name: string
          id: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          empresa_id?: string | null
          full_name: string
          id?: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          empresa_id?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      programa_indicacao_config: {
        Row: {
          ativo: boolean
          created_at: string
          empresa_id: string
          id: string
          updated_at: string
          validade_credito_dias: number
          valor_indicado: number
          valor_indicador: number
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          empresa_id: string
          id?: string
          updated_at?: string
          validade_credito_dias?: number
          valor_indicado?: number
          valor_indicador?: number
        }
        Update: {
          ativo?: boolean
          created_at?: string
          empresa_id?: string
          id?: string
          updated_at?: string
          validade_credito_dias?: number
          valor_indicado?: number
          valor_indicador?: number
        }
        Relationships: [
          {
            foreignKeyName: "programa_indicacao_config_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: true
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      promocoes: {
        Row: {
          created_at: string
          data_fim: string | null
          data_inicio: string | null
          descricao: string | null
          id: string
          nome: string
          status: string
          tipo: string
          unidade_id: string | null
          updated_at: string
          valor: number
        }
        Insert: {
          created_at?: string
          data_fim?: string | null
          data_inicio?: string | null
          descricao?: string | null
          id?: string
          nome: string
          status?: string
          tipo?: string
          unidade_id?: string | null
          updated_at?: string
          valor?: number
        }
        Update: {
          created_at?: string
          data_fim?: string | null
          data_inicio?: string | null
          descricao?: string | null
          id?: string
          nome?: string
          status?: string
          tipo?: string
          unidade_id?: string | null
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "promocoes_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      rastreio_lote: {
        Row: {
          cliente_id: string | null
          created_at: string
          data: string
          id: string
          lote_id: string
          pedido_id: string | null
          quantidade: number
          tipo: string
        }
        Insert: {
          cliente_id?: string | null
          created_at?: string
          data?: string
          id?: string
          lote_id: string
          pedido_id?: string | null
          quantidade?: number
          tipo?: string
        }
        Update: {
          cliente_id?: string | null
          created_at?: string
          data?: string
          id?: string
          lote_id?: string
          pedido_id?: string | null
          quantidade?: number
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "rastreio_lote_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rastreio_lote_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "lotes_produto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rastreio_lote_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
        ]
      }
      recompra_dispatches: {
        Row: {
          cliente_id: string
          created_at: string
          id: string
          mensagem: string
          telefone: string | null
          unidade_id: string | null
        }
        Insert: {
          cliente_id: string
          created_at?: string
          id?: string
          mensagem: string
          telefone?: string | null
          unidade_id?: string | null
        }
        Update: {
          cliente_id?: string
          created_at?: string
          id?: string
          mensagem?: string
          telefone?: string | null
          unidade_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recompra_dispatches_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recompra_dispatches_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      rh_avisos_entregador: {
        Row: {
          ativo: boolean
          created_at: string
          created_by: string | null
          empresa_id: string
          exibir_ate: string | null
          exibir_de: string
          fixado: boolean
          id: string
          mensagem: string
          prioridade: string
          titulo: string
          unidade_id: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          created_by?: string | null
          empresa_id: string
          exibir_ate?: string | null
          exibir_de?: string
          fixado?: boolean
          id?: string
          mensagem: string
          prioridade?: string
          titulo: string
          unidade_id?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          created_by?: string | null
          empresa_id?: string
          exibir_ate?: string | null
          exibir_de?: string
          fixado?: boolean
          id?: string
          mensagem?: string
          prioridade?: string
          titulo?: string
          unidade_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rh_avisos_entregador_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rh_avisos_entregador_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      rh_avisos_entregador_leituras: {
        Row: {
          aviso_id: string
          created_at: string
          entregador_id: string
          id: string
          lido_em: string
        }
        Insert: {
          aviso_id: string
          created_at?: string
          entregador_id: string
          id?: string
          lido_em?: string
        }
        Update: {
          aviso_id?: string
          created_at?: string
          entregador_id?: string
          id?: string
          lido_em?: string
        }
        Relationships: [
          {
            foreignKeyName: "rh_avisos_entregador_leituras_aviso_id_fkey"
            columns: ["aviso_id"]
            isOneToOne: false
            referencedRelation: "rh_avisos_entregador"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rh_avisos_entregador_leituras_entregador_id_fkey"
            columns: ["entregador_id"]
            isOneToOne: false
            referencedRelation: "entregadores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rh_avisos_entregador_leituras_entregador_id_fkey"
            columns: ["entregador_id"]
            isOneToOne: false
            referencedRelation: "vw_alertas_cnh"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rh_avisos_entregador_leituras_entregador_id_fkey"
            columns: ["entregador_id"]
            isOneToOne: false
            referencedRelation: "vw_comissao_entregador"
            referencedColumns: ["entregador_id"]
          },
        ]
      }
      rota_historico: {
        Row: {
          id: string
          latitude: number
          longitude: number
          rota_id: string
          timestamp: string
        }
        Insert: {
          id?: string
          latitude: number
          longitude: number
          rota_id: string
          timestamp?: string
        }
        Update: {
          id?: string
          latitude?: number
          longitude?: number
          rota_id?: string
          timestamp?: string
        }
        Relationships: [
          {
            foreignKeyName: "rota_historico_rota_id_fkey"
            columns: ["rota_id"]
            isOneToOne: false
            referencedRelation: "rotas"
            referencedColumns: ["id"]
          },
        ]
      }
      rotas: {
        Row: {
          created_at: string
          data_fim: string | null
          data_inicio: string
          entregador_id: string
          id: string
          km_final: number | null
          km_inicial: number
          observacoes: string | null
          status: string | null
          veiculo_id: string | null
        }
        Insert: {
          created_at?: string
          data_fim?: string | null
          data_inicio?: string
          entregador_id: string
          id?: string
          km_final?: number | null
          km_inicial: number
          observacoes?: string | null
          status?: string | null
          veiculo_id?: string | null
        }
        Update: {
          created_at?: string
          data_fim?: string | null
          data_inicio?: string
          entregador_id?: string
          id?: string
          km_final?: number | null
          km_inicial?: number
          observacoes?: string | null
          status?: string | null
          veiculo_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rotas_entregador_id_fkey"
            columns: ["entregador_id"]
            isOneToOne: false
            referencedRelation: "entregadores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rotas_entregador_id_fkey"
            columns: ["entregador_id"]
            isOneToOne: false
            referencedRelation: "vw_alertas_cnh"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rotas_entregador_id_fkey"
            columns: ["entregador_id"]
            isOneToOne: false
            referencedRelation: "vw_comissao_entregador"
            referencedColumns: ["entregador_id"]
          },
          {
            foreignKeyName: "rotas_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "veiculos"
            referencedColumns: ["id"]
          },
        ]
      }
      rotas_definidas: {
        Row: {
          ativo: boolean | null
          bairros: string[]
          cidades: Json | null
          created_at: string
          distancia_km: number | null
          id: string
          nome: string
          tempo_estimado: string | null
          tipo: string
          unidade_id: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean | null
          bairros?: string[]
          cidades?: Json | null
          created_at?: string
          distancia_km?: number | null
          id?: string
          nome: string
          tempo_estimado?: string | null
          tipo?: string
          unidade_id?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean | null
          bairros?: string[]
          cidades?: Json | null
          created_at?: string
          distancia_km?: number | null
          id?: string
          nome?: string
          tempo_estimado?: string | null
          tipo?: string
          unidade_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rotas_definidas_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      sla_config: {
        Row: {
          ativo: boolean | null
          created_at: string
          empresa_id: string
          id: string
          nome: string
          penalidade_descricao: string | null
          tempo_maximo_minutos: number
          unidade_id: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string
          empresa_id: string
          id?: string
          nome?: string
          penalidade_descricao?: string | null
          tempo_maximo_minutos?: number
          unidade_id?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean | null
          created_at?: string
          empresa_id?: string
          id?: string
          nome?: string
          penalidade_descricao?: string | null
          tempo_maximo_minutos?: number
          unidade_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sla_config_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sla_config_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      social_accounts: {
        Row: {
          access_token: string | null
          ativo: boolean
          avatar_url: string | null
          conectado_via: string
          created_at: string
          empresa_id: string
          external_id: string | null
          id: string
          ig_business_id: string | null
          nome_conta: string
          page_id: string | null
          plataforma: string
          profile_picture_url: string | null
          refresh_token: string | null
          scopes: string[] | null
          token: string | null
          token_expires_at: string | null
          unidade_id: string | null
          updated_at: string
          username: string | null
        }
        Insert: {
          access_token?: string | null
          ativo?: boolean
          avatar_url?: string | null
          conectado_via?: string
          created_at?: string
          empresa_id: string
          external_id?: string | null
          id?: string
          ig_business_id?: string | null
          nome_conta: string
          page_id?: string | null
          plataforma: string
          profile_picture_url?: string | null
          refresh_token?: string | null
          scopes?: string[] | null
          token?: string | null
          token_expires_at?: string | null
          unidade_id?: string | null
          updated_at?: string
          username?: string | null
        }
        Update: {
          access_token?: string | null
          ativo?: boolean
          avatar_url?: string | null
          conectado_via?: string
          created_at?: string
          empresa_id?: string
          external_id?: string | null
          id?: string
          ig_business_id?: string | null
          nome_conta?: string
          page_id?: string | null
          plataforma?: string
          profile_picture_url?: string | null
          refresh_token?: string | null
          scopes?: string[] | null
          token?: string | null
          token_expires_at?: string | null
          unidade_id?: string | null
          updated_at?: string
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "social_accounts_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_accounts_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      solicitacoes_contador: {
        Row: {
          created_at: string
          descricao: string | null
          id: string
          prazo: string | null
          prioridade: string
          respondido_em: string | null
          respondido_por: string | null
          resposta: string | null
          solicitante_id: string
          solicitante_tipo: string
          status: string
          tipo: string
          titulo: string
          unidade_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          id?: string
          prazo?: string | null
          prioridade?: string
          respondido_em?: string | null
          respondido_por?: string | null
          resposta?: string | null
          solicitante_id: string
          solicitante_tipo?: string
          status?: string
          tipo?: string
          titulo: string
          unidade_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          descricao?: string | null
          id?: string
          prazo?: string | null
          prioridade?: string
          respondido_em?: string | null
          respondido_por?: string | null
          resposta?: string | null
          solicitante_id?: string
          solicitante_tipo?: string
          status?: string
          tipo?: string
          titulo?: string
          unidade_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "solicitacoes_contador_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      terminais_cartao: {
        Row: {
          created_at: string
          entregador_id: string | null
          id: string
          modelo: string | null
          nome: string
          numero_serie: string | null
          observacoes: string | null
          operadora: string
          operadora_id: string | null
          status: string
          unidade_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          entregador_id?: string | null
          id?: string
          modelo?: string | null
          nome: string
          numero_serie?: string | null
          observacoes?: string | null
          operadora?: string
          operadora_id?: string | null
          status?: string
          unidade_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          entregador_id?: string | null
          id?: string
          modelo?: string | null
          nome?: string
          numero_serie?: string | null
          observacoes?: string | null
          operadora?: string
          operadora_id?: string | null
          status?: string
          unidade_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "terminais_cartao_entregador_id_fkey"
            columns: ["entregador_id"]
            isOneToOne: false
            referencedRelation: "entregadores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "terminais_cartao_entregador_id_fkey"
            columns: ["entregador_id"]
            isOneToOne: false
            referencedRelation: "vw_alertas_cnh"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "terminais_cartao_entregador_id_fkey"
            columns: ["entregador_id"]
            isOneToOne: false
            referencedRelation: "vw_comissao_entregador"
            referencedColumns: ["entregador_id"]
          },
          {
            foreignKeyName: "terminais_cartao_operadora_id_fkey"
            columns: ["operadora_id"]
            isOneToOne: false
            referencedRelation: "operadoras_cartao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "terminais_cartao_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      transferencia_estoque_itens: {
        Row: {
          created_at: string
          id: string
          preco_compra: number
          produto_id: string
          quantidade: number
          transferencia_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          preco_compra?: number
          produto_id: string
          quantidade?: number
          transferencia_id: string
        }
        Update: {
          created_at?: string
          id?: string
          preco_compra?: number
          produto_id?: string
          quantidade?: number
          transferencia_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transferencia_estoque_itens_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transferencia_estoque_itens_transferencia_id_fkey"
            columns: ["transferencia_id"]
            isOneToOne: false
            referencedRelation: "transferencias_estoque"
            referencedColumns: ["id"]
          },
        ]
      }
      transferencias_bancarias: {
        Row: {
          conta_destino_id: string
          conta_origem_id: string
          created_at: string
          data_transferencia: string
          descricao: string | null
          id: string
          status: string
          updated_at: string
          user_id: string
          valor: number
        }
        Insert: {
          conta_destino_id: string
          conta_origem_id: string
          created_at?: string
          data_transferencia?: string
          descricao?: string | null
          id?: string
          status?: string
          updated_at?: string
          user_id: string
          valor: number
        }
        Update: {
          conta_destino_id?: string
          conta_origem_id?: string
          created_at?: string
          data_transferencia?: string
          descricao?: string | null
          id?: string
          status?: string
          updated_at?: string
          user_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "transferencias_bancarias_conta_destino_id_fkey"
            columns: ["conta_destino_id"]
            isOneToOne: false
            referencedRelation: "contas_bancarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transferencias_bancarias_conta_origem_id_fkey"
            columns: ["conta_origem_id"]
            isOneToOne: false
            referencedRelation: "contas_bancarias"
            referencedColumns: ["id"]
          },
        ]
      }
      transferencias_estoque: {
        Row: {
          compra_gerada_id: string | null
          created_at: string
          data_envio: string | null
          data_recebimento: string | null
          data_transferencia: string | null
          entregador_id: string | null
          id: string
          observacoes: string | null
          solicitante_id: string
          status: string
          unidade_destino_id: string
          unidade_origem_id: string
          updated_at: string
          valor_total: number
        }
        Insert: {
          compra_gerada_id?: string | null
          created_at?: string
          data_envio?: string | null
          data_recebimento?: string | null
          data_transferencia?: string | null
          entregador_id?: string | null
          id?: string
          observacoes?: string | null
          solicitante_id: string
          status?: string
          unidade_destino_id: string
          unidade_origem_id: string
          updated_at?: string
          valor_total?: number
        }
        Update: {
          compra_gerada_id?: string | null
          created_at?: string
          data_envio?: string | null
          data_recebimento?: string | null
          data_transferencia?: string | null
          entregador_id?: string | null
          id?: string
          observacoes?: string | null
          solicitante_id?: string
          status?: string
          unidade_destino_id?: string
          unidade_origem_id?: string
          updated_at?: string
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "transferencias_estoque_compra_gerada_id_fkey"
            columns: ["compra_gerada_id"]
            isOneToOne: false
            referencedRelation: "compras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transferencias_estoque_entregador_id_fkey"
            columns: ["entregador_id"]
            isOneToOne: false
            referencedRelation: "entregadores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transferencias_estoque_entregador_id_fkey"
            columns: ["entregador_id"]
            isOneToOne: false
            referencedRelation: "vw_alertas_cnh"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transferencias_estoque_entregador_id_fkey"
            columns: ["entregador_id"]
            isOneToOne: false
            referencedRelation: "vw_comissao_entregador"
            referencedColumns: ["entregador_id"]
          },
          {
            foreignKeyName: "transferencias_estoque_unidade_destino_id_fkey"
            columns: ["unidade_destino_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transferencias_estoque_unidade_origem_id_fkey"
            columns: ["unidade_origem_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      transp_abastecimentos: {
        Row: {
          created_at: string
          custo_logistico: number
          custo_por_unidade: number
          data: string
          destino_unidade_id: string
          empresa_id: string
          id: string
          observacoes: string | null
          origem_unidade_id: string
          p13_equivalente: number
          qtd_p13: number
          qtd_p20: number
          qtd_p45: number
          simulacao_id: string | null
          updated_at: string
          veiculo_id: string | null
        }
        Insert: {
          created_at?: string
          custo_logistico?: number
          custo_por_unidade?: number
          data?: string
          destino_unidade_id: string
          empresa_id: string
          id?: string
          observacoes?: string | null
          origem_unidade_id: string
          p13_equivalente?: number
          qtd_p13?: number
          qtd_p20?: number
          qtd_p45?: number
          simulacao_id?: string | null
          updated_at?: string
          veiculo_id?: string | null
        }
        Update: {
          created_at?: string
          custo_logistico?: number
          custo_por_unidade?: number
          data?: string
          destino_unidade_id?: string
          empresa_id?: string
          id?: string
          observacoes?: string | null
          origem_unidade_id?: string
          p13_equivalente?: number
          qtd_p13?: number
          qtd_p20?: number
          qtd_p45?: number
          simulacao_id?: string | null
          updated_at?: string
          veiculo_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transp_abastecimentos_destino_unidade_id_fkey"
            columns: ["destino_unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transp_abastecimentos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transp_abastecimentos_origem_unidade_id_fkey"
            columns: ["origem_unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transp_abastecimentos_simulacao_id_fkey"
            columns: ["simulacao_id"]
            isOneToOne: false
            referencedRelation: "transp_simulacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transp_abastecimentos_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "transp_veiculos"
            referencedColumns: ["id"]
          },
        ]
      }
      transp_compras: {
        Row: {
          cfop: string | null
          chave_nfe: string | null
          cidade_fornecedor: string | null
          cnpj_destinatario: string | null
          conferida: boolean
          conferida_em: string | null
          conferida_por: string | null
          created_at: string | null
          custo_combustivel: number | null
          custo_logistico_total: number | null
          custo_outros: number | null
          custo_pedagio: number | null
          custo_refeicao: number | null
          custo_total: number | null
          custo_unit_agua: number | null
          custo_unit_p13: number | null
          custo_unit_p20: number | null
          custo_unit_p45: number | null
          data: string
          data_pagamento: string | null
          data_vencimento: string | null
          desconto: number
          distancia_ida_km: number | null
          empresa_id: string
          fornecedor: string
          id: string
          mes_referencia: string | null
          numero_nf: string | null
          observacoes: string | null
          outlook_message_id: string | null
          pago: boolean
          preco_unitario: number | null
          produto_descricao: string | null
          qtd_agua: number | null
          qtd_p13: number | null
          qtd_p20: number | null
          qtd_p45: number | null
          quantidade: number | null
          tipo_produto: string | null
          unidade_id: string | null
          updated_at: string | null
          valor_compra: number | null
          veiculo_id: string | null
        }
        Insert: {
          cfop?: string | null
          chave_nfe?: string | null
          cidade_fornecedor?: string | null
          cnpj_destinatario?: string | null
          conferida?: boolean
          conferida_em?: string | null
          conferida_por?: string | null
          created_at?: string | null
          custo_combustivel?: number | null
          custo_logistico_total?: number | null
          custo_outros?: number | null
          custo_pedagio?: number | null
          custo_refeicao?: number | null
          custo_total?: number | null
          custo_unit_agua?: number | null
          custo_unit_p13?: number | null
          custo_unit_p20?: number | null
          custo_unit_p45?: number | null
          data: string
          data_pagamento?: string | null
          data_vencimento?: string | null
          desconto?: number
          distancia_ida_km?: number | null
          empresa_id: string
          fornecedor: string
          id?: string
          mes_referencia?: string | null
          numero_nf?: string | null
          observacoes?: string | null
          outlook_message_id?: string | null
          pago?: boolean
          preco_unitario?: number | null
          produto_descricao?: string | null
          qtd_agua?: number | null
          qtd_p13?: number | null
          qtd_p20?: number | null
          qtd_p45?: number | null
          quantidade?: number | null
          tipo_produto?: string | null
          unidade_id?: string | null
          updated_at?: string | null
          valor_compra?: number | null
          veiculo_id?: string | null
        }
        Update: {
          cfop?: string | null
          chave_nfe?: string | null
          cidade_fornecedor?: string | null
          cnpj_destinatario?: string | null
          conferida?: boolean
          conferida_em?: string | null
          conferida_por?: string | null
          created_at?: string | null
          custo_combustivel?: number | null
          custo_logistico_total?: number | null
          custo_outros?: number | null
          custo_pedagio?: number | null
          custo_refeicao?: number | null
          custo_total?: number | null
          custo_unit_agua?: number | null
          custo_unit_p13?: number | null
          custo_unit_p20?: number | null
          custo_unit_p45?: number | null
          data?: string
          data_pagamento?: string | null
          data_vencimento?: string | null
          desconto?: number
          distancia_ida_km?: number | null
          empresa_id?: string
          fornecedor?: string
          id?: string
          mes_referencia?: string | null
          numero_nf?: string | null
          observacoes?: string | null
          outlook_message_id?: string | null
          pago?: boolean
          preco_unitario?: number | null
          produto_descricao?: string | null
          qtd_agua?: number | null
          qtd_p13?: number | null
          qtd_p20?: number | null
          qtd_p45?: number | null
          quantidade?: number | null
          tipo_produto?: string | null
          unidade_id?: string | null
          updated_at?: string | null
          valor_compra?: number | null
          veiculo_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transp_compras_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transp_compras_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transp_compras_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "transp_veiculos"
            referencedColumns: ["id"]
          },
        ]
      }
      transp_despesas: {
        Row: {
          comprovante_url: string | null
          created_at: string
          data: string
          descricao: string | null
          empresa_id: string
          id: string
          mes_referencia: string | null
          tipo: string
          updated_at: string
          valor: number
          veiculo_id: string | null
        }
        Insert: {
          comprovante_url?: string | null
          created_at?: string
          data?: string
          descricao?: string | null
          empresa_id: string
          id?: string
          mes_referencia?: string | null
          tipo?: string
          updated_at?: string
          valor?: number
          veiculo_id?: string | null
        }
        Update: {
          comprovante_url?: string | null
          created_at?: string
          data?: string
          descricao?: string | null
          empresa_id?: string
          id?: string
          mes_referencia?: string | null
          tipo?: string
          updated_at?: string
          valor?: number
          veiculo_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transp_despesas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transp_despesas_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "transp_veiculos"
            referencedColumns: ["id"]
          },
        ]
      }
      transp_entregas: {
        Row: {
          created_at: string
          custo_total: number
          data: string
          destino_unidade_id: string | null
          empresa_id: string
          id: string
          km: number
          margem: number
          motorista_id: string | null
          observacoes: string | null
          p13_equivalente: number
          qtd_p13: number
          qtd_p20: number
          qtd_p45: number
          tipo: string
          updated_at: string
          valor_venda: number
          veiculo_id: string | null
        }
        Insert: {
          created_at?: string
          custo_total?: number
          data?: string
          destino_unidade_id?: string | null
          empresa_id: string
          id?: string
          km?: number
          margem?: number
          motorista_id?: string | null
          observacoes?: string | null
          p13_equivalente?: number
          qtd_p13?: number
          qtd_p20?: number
          qtd_p45?: number
          tipo?: string
          updated_at?: string
          valor_venda?: number
          veiculo_id?: string | null
        }
        Update: {
          created_at?: string
          custo_total?: number
          data?: string
          destino_unidade_id?: string | null
          empresa_id?: string
          id?: string
          km?: number
          margem?: number
          motorista_id?: string | null
          observacoes?: string | null
          p13_equivalente?: number
          qtd_p13?: number
          qtd_p20?: number
          qtd_p45?: number
          tipo?: string
          updated_at?: string
          valor_venda?: number
          veiculo_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transp_entregas_destino_unidade_id_fkey"
            columns: ["destino_unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transp_entregas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transp_entregas_motorista_id_fkey"
            columns: ["motorista_id"]
            isOneToOne: false
            referencedRelation: "transp_funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transp_entregas_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "transp_veiculos"
            referencedColumns: ["id"]
          },
        ]
      }
      transp_fechamentos: {
        Row: {
          created_at: string
          custo_real_por_unidade: number
          empresa_id: string
          id: string
          mes_referencia: string
          observacoes: string | null
          total_despesas: number
          total_p13_equivalente: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          custo_real_por_unidade?: number
          empresa_id: string
          id?: string
          mes_referencia: string
          observacoes?: string | null
          total_despesas?: number
          total_p13_equivalente?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          custo_real_por_unidade?: number
          empresa_id?: string
          id?: string
          mes_referencia?: string
          observacoes?: string | null
          total_despesas?: number
          total_p13_equivalente?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transp_fechamentos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      transp_funcionarios: {
        Row: {
          ativo: boolean
          cargo: string
          created_at: string
          empresa_id: string
          id: string
          nome: string
          salario_mensal: number
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cargo?: string
          created_at?: string
          empresa_id: string
          id?: string
          nome: string
          salario_mensal?: number
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cargo?: string
          created_at?: string
          empresa_id?: string
          id?: string
          nome?: string
          salario_mensal?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transp_funcionarios_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      transp_outlook_config: {
        Row: {
          created_at: string
          empresa_id: string
          filtro_remetente: string | null
          id: string
          microsoft_refresh_token: string | null
          microsoft_user_email: string | null
          ultima_importacao: string | null
          ultimo_status: string | null
          ultimo_total_importados: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          empresa_id: string
          filtro_remetente?: string | null
          id?: string
          microsoft_refresh_token?: string | null
          microsoft_user_email?: string | null
          ultima_importacao?: string | null
          ultimo_status?: string | null
          ultimo_total_importados?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          empresa_id?: string
          filtro_remetente?: string | null
          id?: string
          microsoft_refresh_token?: string | null
          microsoft_user_email?: string | null
          ultima_importacao?: string | null
          ultimo_status?: string | null
          ultimo_total_importados?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transp_outlook_config_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: true
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      transp_rota_paradas: {
        Row: {
          cidade: string | null
          concluida: boolean | null
          concluida_em: string | null
          created_at: string | null
          endereco: string | null
          entidade_id: string | null
          entidade_nome: string | null
          entidade_tipo: string | null
          id: string
          impacto_estoque: string
          impacto_financeiro: boolean
          lat: number | null
          lng: number | null
          observacoes: string | null
          operacao: string | null
          ordem: number
          qtd_p13: number | null
          qtd_p20: number | null
          qtd_p45: number | null
          rota_id: string
          tipo_parada: string
        }
        Insert: {
          cidade?: string | null
          concluida?: boolean | null
          concluida_em?: string | null
          created_at?: string | null
          endereco?: string | null
          entidade_id?: string | null
          entidade_nome?: string | null
          entidade_tipo?: string | null
          id?: string
          impacto_estoque?: string
          impacto_financeiro?: boolean
          lat?: number | null
          lng?: number | null
          observacoes?: string | null
          operacao?: string | null
          ordem?: number
          qtd_p13?: number | null
          qtd_p20?: number | null
          qtd_p45?: number | null
          rota_id: string
          tipo_parada?: string
        }
        Update: {
          cidade?: string | null
          concluida?: boolean | null
          concluida_em?: string | null
          created_at?: string | null
          endereco?: string | null
          entidade_id?: string | null
          entidade_nome?: string | null
          entidade_tipo?: string | null
          id?: string
          impacto_estoque?: string
          impacto_financeiro?: boolean
          lat?: number | null
          lng?: number | null
          observacoes?: string | null
          operacao?: string | null
          ordem?: number
          qtd_p13?: number | null
          qtd_p20?: number | null
          qtd_p45?: number | null
          rota_id?: string
          tipo_parada?: string
        }
        Relationships: [
          {
            foreignKeyName: "transp_rota_paradas_rota_id_fkey"
            columns: ["rota_id"]
            isOneToOne: false
            referencedRelation: "transp_rotas_atacado"
            referencedColumns: ["id"]
          },
        ]
      }
      transp_rotas_atacado: {
        Row: {
          ajudante_id: string | null
          carga_inicial_p13: number | null
          carga_inicial_p20: number | null
          carga_inicial_p45: number | null
          consumo_km_litro: number | null
          created_at: string | null
          custo_pedagio: number | null
          custo_refeicao: number | null
          custo_total: number | null
          data_prevista: string | null
          empresa_id: string
          id: string
          km_total: number | null
          motorista_id: string | null
          nome: string
          observacoes: string | null
          preco_combustivel: number | null
          status: string
          tempo_total_min: number | null
          tipo: string
          updated_at: string | null
          veiculo_id: string | null
        }
        Insert: {
          ajudante_id?: string | null
          carga_inicial_p13?: number | null
          carga_inicial_p20?: number | null
          carga_inicial_p45?: number | null
          consumo_km_litro?: number | null
          created_at?: string | null
          custo_pedagio?: number | null
          custo_refeicao?: number | null
          custo_total?: number | null
          data_prevista?: string | null
          empresa_id: string
          id?: string
          km_total?: number | null
          motorista_id?: string | null
          nome: string
          observacoes?: string | null
          preco_combustivel?: number | null
          status?: string
          tempo_total_min?: number | null
          tipo?: string
          updated_at?: string | null
          veiculo_id?: string | null
        }
        Update: {
          ajudante_id?: string | null
          carga_inicial_p13?: number | null
          carga_inicial_p20?: number | null
          carga_inicial_p45?: number | null
          consumo_km_litro?: number | null
          created_at?: string | null
          custo_pedagio?: number | null
          custo_refeicao?: number | null
          custo_total?: number | null
          data_prevista?: string | null
          empresa_id?: string
          id?: string
          km_total?: number | null
          motorista_id?: string | null
          nome?: string
          observacoes?: string | null
          preco_combustivel?: number | null
          status?: string
          tempo_total_min?: number | null
          tipo?: string
          updated_at?: string | null
          veiculo_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transp_rotas_atacado_ajudante_id_fkey"
            columns: ["ajudante_id"]
            isOneToOne: false
            referencedRelation: "transp_funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transp_rotas_atacado_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transp_rotas_atacado_motorista_id_fkey"
            columns: ["motorista_id"]
            isOneToOne: false
            referencedRelation: "transp_funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transp_rotas_atacado_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "transp_veiculos"
            referencedColumns: ["id"]
          },
        ]
      }
      transp_simulacoes: {
        Row: {
          ajudante_id: string | null
          created_at: string
          custo_ajudante: number
          custo_combustivel: number
          custo_motorista: number
          custo_p13_equiv: number
          custo_pedagio: number
          custo_refeicao: number
          custo_total: number
          destino: string
          destino_unidade_id: string | null
          empresa_id: string
          id: string
          ida_volta: boolean
          km: number
          motorista_id: string | null
          origem: string
          origem_unidade_id: string | null
          preco_combustivel_litro: number
          qtd_p13: number
          qtd_p20: number
          qtd_p45: number
          tipo: string
          updated_at: string
          veiculo_id: string | null
        }
        Insert: {
          ajudante_id?: string | null
          created_at?: string
          custo_ajudante?: number
          custo_combustivel?: number
          custo_motorista?: number
          custo_p13_equiv?: number
          custo_pedagio?: number
          custo_refeicao?: number
          custo_total?: number
          destino: string
          destino_unidade_id?: string | null
          empresa_id: string
          id?: string
          ida_volta?: boolean
          km?: number
          motorista_id?: string | null
          origem: string
          origem_unidade_id?: string | null
          preco_combustivel_litro?: number
          qtd_p13?: number
          qtd_p20?: number
          qtd_p45?: number
          tipo?: string
          updated_at?: string
          veiculo_id?: string | null
        }
        Update: {
          ajudante_id?: string | null
          created_at?: string
          custo_ajudante?: number
          custo_combustivel?: number
          custo_motorista?: number
          custo_p13_equiv?: number
          custo_pedagio?: number
          custo_refeicao?: number
          custo_total?: number
          destino?: string
          destino_unidade_id?: string | null
          empresa_id?: string
          id?: string
          ida_volta?: boolean
          km?: number
          motorista_id?: string | null
          origem?: string
          origem_unidade_id?: string | null
          preco_combustivel_litro?: number
          qtd_p13?: number
          qtd_p20?: number
          qtd_p45?: number
          tipo?: string
          updated_at?: string
          veiculo_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transp_simulacoes_ajudante_id_fkey"
            columns: ["ajudante_id"]
            isOneToOne: false
            referencedRelation: "transp_funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transp_simulacoes_destino_unidade_id_fkey"
            columns: ["destino_unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transp_simulacoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transp_simulacoes_motorista_id_fkey"
            columns: ["motorista_id"]
            isOneToOne: false
            referencedRelation: "transp_funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transp_simulacoes_origem_unidade_id_fkey"
            columns: ["origem_unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transp_simulacoes_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "transp_veiculos"
            referencedColumns: ["id"]
          },
        ]
      }
      transp_veiculos: {
        Row: {
          ativo: boolean
          capacidade_p13: number
          capacidade_p20: number
          capacidade_p45: number
          consumo_km_litro: number
          created_at: string
          empresa_id: string
          id: string
          placa: string
          tipo: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          capacidade_p13?: number
          capacidade_p20?: number
          capacidade_p45?: number
          consumo_km_litro?: number
          created_at?: string
          empresa_id: string
          id?: string
          placa: string
          tipo?: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          capacidade_p13?: number
          capacidade_p20?: number
          capacidade_p45?: number
          consumo_km_litro?: number
          created_at?: string
          empresa_id?: string
          id?: string
          placa?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transp_veiculos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      unidades: {
        Row: {
          aliquota_cofins_padrao: number | null
          aliquota_icms_padrao: number | null
          aliquota_pis_padrao: number | null
          ativo: boolean | null
          bairro: string | null
          bairros_atendidos: string | null
          cep: string | null
          certificado_a1_path: string | null
          certificado_a1_senha: string | null
          certificado_a1_titular: string | null
          certificado_a1_validade: string | null
          cfop_padrao_devolucao: string | null
          cfop_padrao_venda: string | null
          chave_pix: string | null
          cidade: string | null
          cnae_principal: string | null
          cnpj: string | null
          contador_cpf_cnpj: string | null
          contador_crc: string | null
          contador_email: string | null
          contador_nome: string | null
          contador_telefone: string | null
          created_at: string
          cst_csosn_padrao: string | null
          cte_proximo_numero: number | null
          cte_serie: number | null
          email: string | null
          empresa_id: string | null
          endereco: string | null
          estado: string | null
          horario_abertura: string | null
          horario_fechamento: string | null
          id: string
          inscricao_estadual: string | null
          inscricao_estadual_st: string | null
          inscricao_municipal: string | null
          latitude: number | null
          longitude: number | null
          natureza_operacao_padrao: string | null
          nfce_csc_id: string | null
          nfce_csc_token: string | null
          nfce_proximo_numero: number | null
          nfce_serie: number | null
          nfe_ambiente: string | null
          nfe_proximo_numero: number | null
          nfe_serie: number | null
          nome: string
          nome_fantasia: string | null
          provedor_nfe: string | null
          provedor_nfe_token: string | null
          provedor_nfe_url: string | null
          razao_social: string | null
          regime_tributario: string | null
          telefone: string | null
          tipo: string
          updated_at: string
        }
        Insert: {
          aliquota_cofins_padrao?: number | null
          aliquota_icms_padrao?: number | null
          aliquota_pis_padrao?: number | null
          ativo?: boolean | null
          bairro?: string | null
          bairros_atendidos?: string | null
          cep?: string | null
          certificado_a1_path?: string | null
          certificado_a1_senha?: string | null
          certificado_a1_titular?: string | null
          certificado_a1_validade?: string | null
          cfop_padrao_devolucao?: string | null
          cfop_padrao_venda?: string | null
          chave_pix?: string | null
          cidade?: string | null
          cnae_principal?: string | null
          cnpj?: string | null
          contador_cpf_cnpj?: string | null
          contador_crc?: string | null
          contador_email?: string | null
          contador_nome?: string | null
          contador_telefone?: string | null
          created_at?: string
          cst_csosn_padrao?: string | null
          cte_proximo_numero?: number | null
          cte_serie?: number | null
          email?: string | null
          empresa_id?: string | null
          endereco?: string | null
          estado?: string | null
          horario_abertura?: string | null
          horario_fechamento?: string | null
          id?: string
          inscricao_estadual?: string | null
          inscricao_estadual_st?: string | null
          inscricao_municipal?: string | null
          latitude?: number | null
          longitude?: number | null
          natureza_operacao_padrao?: string | null
          nfce_csc_id?: string | null
          nfce_csc_token?: string | null
          nfce_proximo_numero?: number | null
          nfce_serie?: number | null
          nfe_ambiente?: string | null
          nfe_proximo_numero?: number | null
          nfe_serie?: number | null
          nome: string
          nome_fantasia?: string | null
          provedor_nfe?: string | null
          provedor_nfe_token?: string | null
          provedor_nfe_url?: string | null
          razao_social?: string | null
          regime_tributario?: string | null
          telefone?: string | null
          tipo?: string
          updated_at?: string
        }
        Update: {
          aliquota_cofins_padrao?: number | null
          aliquota_icms_padrao?: number | null
          aliquota_pis_padrao?: number | null
          ativo?: boolean | null
          bairro?: string | null
          bairros_atendidos?: string | null
          cep?: string | null
          certificado_a1_path?: string | null
          certificado_a1_senha?: string | null
          certificado_a1_titular?: string | null
          certificado_a1_validade?: string | null
          cfop_padrao_devolucao?: string | null
          cfop_padrao_venda?: string | null
          chave_pix?: string | null
          cidade?: string | null
          cnae_principal?: string | null
          cnpj?: string | null
          contador_cpf_cnpj?: string | null
          contador_crc?: string | null
          contador_email?: string | null
          contador_nome?: string | null
          contador_telefone?: string | null
          created_at?: string
          cst_csosn_padrao?: string | null
          cte_proximo_numero?: number | null
          cte_serie?: number | null
          email?: string | null
          empresa_id?: string | null
          endereco?: string | null
          estado?: string | null
          horario_abertura?: string | null
          horario_fechamento?: string | null
          id?: string
          inscricao_estadual?: string | null
          inscricao_estadual_st?: string | null
          inscricao_municipal?: string | null
          latitude?: number | null
          longitude?: number | null
          natureza_operacao_padrao?: string | null
          nfce_csc_id?: string | null
          nfce_csc_token?: string | null
          nfce_proximo_numero?: number | null
          nfce_serie?: number | null
          nfe_ambiente?: string | null
          nfe_proximo_numero?: number | null
          nfe_serie?: number | null
          nome?: string
          nome_fantasia?: string | null
          provedor_nfe?: string | null
          provedor_nfe_token?: string | null
          provedor_nfe_url?: string | null
          razao_social?: string | null
          regime_tributario?: string | null
          telefone?: string | null
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "unidades_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_unidades: {
        Row: {
          created_at: string
          id: string
          unidade_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          unidade_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          unidade_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_unidades_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      vale_gas: {
        Row: {
          cliente_id: string | null
          cliente_nome: string | null
          codigo: string
          consumidor_cpf: string | null
          consumidor_endereco: string | null
          consumidor_nome: string | null
          consumidor_telefone: string | null
          created_at: string
          data_utilizacao: string | null
          descricao: string | null
          entregador_id: string | null
          entregador_nome: string | null
          id: string
          lote_id: string
          numero: number
          parceiro_id: string
          produto_id: string | null
          produto_nome: string | null
          status: string
          unidade_id: string | null
          updated_at: string
          valor: number
          valor_venda: number | null
          venda_id: string | null
        }
        Insert: {
          cliente_id?: string | null
          cliente_nome?: string | null
          codigo: string
          consumidor_cpf?: string | null
          consumidor_endereco?: string | null
          consumidor_nome?: string | null
          consumidor_telefone?: string | null
          created_at?: string
          data_utilizacao?: string | null
          descricao?: string | null
          entregador_id?: string | null
          entregador_nome?: string | null
          id?: string
          lote_id: string
          numero: number
          parceiro_id: string
          produto_id?: string | null
          produto_nome?: string | null
          status?: string
          unidade_id?: string | null
          updated_at?: string
          valor: number
          valor_venda?: number | null
          venda_id?: string | null
        }
        Update: {
          cliente_id?: string | null
          cliente_nome?: string | null
          codigo?: string
          consumidor_cpf?: string | null
          consumidor_endereco?: string | null
          consumidor_nome?: string | null
          consumidor_telefone?: string | null
          created_at?: string
          data_utilizacao?: string | null
          descricao?: string | null
          entregador_id?: string | null
          entregador_nome?: string | null
          id?: string
          lote_id?: string
          numero?: number
          parceiro_id?: string
          produto_id?: string | null
          produto_nome?: string | null
          status?: string
          unidade_id?: string | null
          updated_at?: string
          valor?: number
          valor_venda?: number | null
          venda_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vale_gas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vale_gas_entregador_id_fkey"
            columns: ["entregador_id"]
            isOneToOne: false
            referencedRelation: "entregadores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vale_gas_entregador_id_fkey"
            columns: ["entregador_id"]
            isOneToOne: false
            referencedRelation: "vw_alertas_cnh"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vale_gas_entregador_id_fkey"
            columns: ["entregador_id"]
            isOneToOne: false
            referencedRelation: "vw_comissao_entregador"
            referencedColumns: ["entregador_id"]
          },
          {
            foreignKeyName: "vale_gas_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "vale_gas_lotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vale_gas_parceiro_id_fkey"
            columns: ["parceiro_id"]
            isOneToOne: false
            referencedRelation: "vale_gas_parceiros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vale_gas_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vale_gas_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vale_gas_venda_id_fkey"
            columns: ["venda_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
        ]
      }
      vale_gas_acerto_vales: {
        Row: {
          acerto_id: string
          created_at: string
          id: string
          vale_id: string
        }
        Insert: {
          acerto_id: string
          created_at?: string
          id?: string
          vale_id: string
        }
        Update: {
          acerto_id?: string
          created_at?: string
          id?: string
          vale_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vale_gas_acerto_vales_acerto_id_fkey"
            columns: ["acerto_id"]
            isOneToOne: false
            referencedRelation: "vale_gas_acertos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vale_gas_acerto_vales_vale_id_fkey"
            columns: ["vale_id"]
            isOneToOne: false
            referencedRelation: "vale_gas"
            referencedColumns: ["id"]
          },
        ]
      }
      vale_gas_acertos: {
        Row: {
          created_at: string
          data_acerto: string
          data_pagamento: string | null
          forma_pagamento: string | null
          id: string
          observacao: string | null
          parceiro_id: string
          parceiro_nome: string
          quantidade: number
          status_pagamento: string
          unidade_id: string | null
          updated_at: string
          valor_total: number
        }
        Insert: {
          created_at?: string
          data_acerto?: string
          data_pagamento?: string | null
          forma_pagamento?: string | null
          id?: string
          observacao?: string | null
          parceiro_id: string
          parceiro_nome: string
          quantidade: number
          status_pagamento?: string
          unidade_id?: string | null
          updated_at?: string
          valor_total: number
        }
        Update: {
          created_at?: string
          data_acerto?: string
          data_pagamento?: string | null
          forma_pagamento?: string | null
          id?: string
          observacao?: string | null
          parceiro_id?: string
          parceiro_nome?: string
          quantidade?: number
          status_pagamento?: string
          unidade_id?: string | null
          updated_at?: string
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "vale_gas_acertos_parceiro_id_fkey"
            columns: ["parceiro_id"]
            isOneToOne: false
            referencedRelation: "vale_gas_parceiros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vale_gas_acertos_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      vale_gas_lotes: {
        Row: {
          cancelado: boolean
          cliente_id: string | null
          cliente_nome: string | null
          created_at: string
          data_vencimento_pagamento: string | null
          descricao: string | null
          gerar_conta_receber: boolean | null
          id: string
          numero_final: number
          numero_inicial: number
          observacao: string | null
          parceiro_id: string
          produto_id: string | null
          produto_nome: string | null
          quantidade: number
          status_pagamento: string
          unidade_id: string | null
          updated_at: string
          valor_pago: number
          valor_total: number
          valor_unitario: number
        }
        Insert: {
          cancelado?: boolean
          cliente_id?: string | null
          cliente_nome?: string | null
          created_at?: string
          data_vencimento_pagamento?: string | null
          descricao?: string | null
          gerar_conta_receber?: boolean | null
          id?: string
          numero_final: number
          numero_inicial: number
          observacao?: string | null
          parceiro_id: string
          produto_id?: string | null
          produto_nome?: string | null
          quantidade: number
          status_pagamento?: string
          unidade_id?: string | null
          updated_at?: string
          valor_pago?: number
          valor_total: number
          valor_unitario: number
        }
        Update: {
          cancelado?: boolean
          cliente_id?: string | null
          cliente_nome?: string | null
          created_at?: string
          data_vencimento_pagamento?: string | null
          descricao?: string | null
          gerar_conta_receber?: boolean | null
          id?: string
          numero_final?: number
          numero_inicial?: number
          observacao?: string | null
          parceiro_id?: string
          produto_id?: string | null
          produto_nome?: string | null
          quantidade?: number
          status_pagamento?: string
          unidade_id?: string | null
          updated_at?: string
          valor_pago?: number
          valor_total?: number
          valor_unitario?: number
        }
        Relationships: [
          {
            foreignKeyName: "vale_gas_lotes_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vale_gas_lotes_parceiro_id_fkey"
            columns: ["parceiro_id"]
            isOneToOne: false
            referencedRelation: "vale_gas_parceiros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vale_gas_lotes_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vale_gas_lotes_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      vale_gas_parceiros: {
        Row: {
          ativo: boolean
          cnpj: string | null
          created_at: string
          email: string | null
          endereco: string | null
          id: string
          latitude: number | null
          longitude: number | null
          nome: string
          telefone: string | null
          tipo: string
          unidade_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          ativo?: boolean
          cnpj?: string | null
          created_at?: string
          email?: string | null
          endereco?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          nome: string
          telefone?: string | null
          tipo?: string
          unidade_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          ativo?: boolean
          cnpj?: string | null
          created_at?: string
          email?: string | null
          endereco?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          nome?: string
          telefone?: string | null
          tipo?: string
          unidade_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vale_gas_parceiros_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      vales_funcionario: {
        Row: {
          created_at: string
          data: string
          desconto_referencia: string | null
          funcionario_id: string
          id: string
          observacoes: string | null
          status: string
          tipo: string
          unidade_id: string | null
          updated_at: string
          valor: number
        }
        Insert: {
          created_at?: string
          data?: string
          desconto_referencia?: string | null
          funcionario_id: string
          id?: string
          observacoes?: string | null
          status?: string
          tipo?: string
          unidade_id?: string | null
          updated_at?: string
          valor?: number
        }
        Update: {
          created_at?: string
          data?: string
          desconto_referencia?: string | null
          funcionario_id?: string
          id?: string
          observacoes?: string | null
          status?: string
          tipo?: string
          unidade_id?: string | null
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "vales_funcionario_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vales_funcionario_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      veiculos: {
        Row: {
          ano: number | null
          ativo: boolean | null
          created_at: string
          crlv_vencimento: string | null
          entregador_id: string | null
          foto_url: string | null
          id: string
          km_atual: number | null
          marca: string | null
          modelo: string
          placa: string
          seguro_empresa: string | null
          seguro_vencimento: string | null
          status: string | null
          tipo: string | null
          unidade_id: string | null
          updated_at: string
          valor_fipe: number | null
        }
        Insert: {
          ano?: number | null
          ativo?: boolean | null
          created_at?: string
          crlv_vencimento?: string | null
          entregador_id?: string | null
          foto_url?: string | null
          id?: string
          km_atual?: number | null
          marca?: string | null
          modelo: string
          placa: string
          seguro_empresa?: string | null
          seguro_vencimento?: string | null
          status?: string | null
          tipo?: string | null
          unidade_id?: string | null
          updated_at?: string
          valor_fipe?: number | null
        }
        Update: {
          ano?: number | null
          ativo?: boolean | null
          created_at?: string
          crlv_vencimento?: string | null
          entregador_id?: string | null
          foto_url?: string | null
          id?: string
          km_atual?: number | null
          marca?: string | null
          modelo?: string
          placa?: string
          seguro_empresa?: string | null
          seguro_vencimento?: string | null
          status?: string | null
          tipo?: string | null
          unidade_id?: string | null
          updated_at?: string
          valor_fipe?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "veiculos_entregador_id_fkey"
            columns: ["entregador_id"]
            isOneToOne: false
            referencedRelation: "entregadores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "veiculos_entregador_id_fkey"
            columns: ["entregador_id"]
            isOneToOne: false
            referencedRelation: "vw_alertas_cnh"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "veiculos_entregador_id_fkey"
            columns: ["entregador_id"]
            isOneToOne: false
            referencedRelation: "vw_comissao_entregador"
            referencedColumns: ["entregador_id"]
          },
          {
            foreignKeyName: "veiculos_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      vendas_antecipadas: {
        Row: {
          cliente_id: string | null
          cliente_nome: string
          created_at: string
          data_validade: string | null
          data_venda: string
          forma_pagamento: string
          id: string
          observacoes: string | null
          pedido_utilizacao_id: string | null
          saldo_restante: number | null
          status: string
          unidade_id: string | null
          updated_at: string
          user_id: string
          valor_pago: number
          valor_utilizado: number
        }
        Insert: {
          cliente_id?: string | null
          cliente_nome: string
          created_at?: string
          data_validade?: string | null
          data_venda?: string
          forma_pagamento: string
          id?: string
          observacoes?: string | null
          pedido_utilizacao_id?: string | null
          saldo_restante?: number | null
          status?: string
          unidade_id?: string | null
          updated_at?: string
          user_id: string
          valor_pago: number
          valor_utilizado?: number
        }
        Update: {
          cliente_id?: string | null
          cliente_nome?: string
          created_at?: string
          data_validade?: string | null
          data_venda?: string
          forma_pagamento?: string
          id?: string
          observacoes?: string | null
          pedido_utilizacao_id?: string | null
          saldo_restante?: number | null
          status?: string
          unidade_id?: string | null
          updated_at?: string
          user_id?: string
          valor_pago?: number
          valor_utilizado?: number
        }
        Relationships: [
          {
            foreignKeyName: "vendas_antecipadas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendas_antecipadas_pedido_utilizacao_id_fkey"
            columns: ["pedido_utilizacao_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendas_antecipadas_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      vendas_historicas_manuais: {
        Row: {
          ano: number
          created_at: string
          created_by: string | null
          empresa_id: string
          faturamento: number
          id: string
          mes: number
          observacao: string | null
          produto_id: string
          quantidade: number
          unidade_id: string
          updated_at: string
        }
        Insert: {
          ano: number
          created_at?: string
          created_by?: string | null
          empresa_id: string
          faturamento?: number
          id?: string
          mes: number
          observacao?: string | null
          produto_id: string
          quantidade?: number
          unidade_id: string
          updated_at?: string
        }
        Update: {
          ano?: number
          created_at?: string
          created_by?: string | null
          empresa_id?: string
          faturamento?: number
          id?: string
          mes?: number
          observacao?: string | null
          produto_id?: string
          quantidade?: number
          unidade_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendas_historicas_manuais_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_eventos: {
        Row: {
          contato_wa_id: string | null
          conversa_id: string | null
          created_at: string
          empresa_id: string | null
          event_data: Json
          event_type: string
          id: string
          mensagem_id: string | null
          unidade_id: string | null
          wa_message_id: string | null
        }
        Insert: {
          contato_wa_id?: string | null
          conversa_id?: string | null
          created_at?: string
          empresa_id?: string | null
          event_data?: Json
          event_type: string
          id?: string
          mensagem_id?: string | null
          unidade_id?: string | null
          wa_message_id?: string | null
        }
        Update: {
          contato_wa_id?: string | null
          conversa_id?: string | null
          created_at?: string
          empresa_id?: string | null
          event_data?: Json
          event_type?: string
          id?: string
          mensagem_id?: string | null
          unidade_id?: string | null
          wa_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_eventos_conversa_id_fkey"
            columns: ["conversa_id"]
            isOneToOne: false
            referencedRelation: "ai_conversas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_eventos_mensagem_id_fkey"
            columns: ["mensagem_id"]
            isOneToOne: false
            referencedRelation: "ai_mensagens"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_gateway_instances: {
        Row: {
          api_key: string | null
          auto_reconnect: boolean | null
          created_at: string
          empresa_id: string
          engine_url: string
          id: string
          instance_name: string
          phone: string | null
          qr_code: string | null
          session_data: Json | null
          status: string
          unidade_id: string
          updated_at: string
          webhook_secret: string | null
          webhook_url: string | null
        }
        Insert: {
          api_key?: string | null
          auto_reconnect?: boolean | null
          created_at?: string
          empresa_id: string
          engine_url: string
          id?: string
          instance_name: string
          phone?: string | null
          qr_code?: string | null
          session_data?: Json | null
          status?: string
          unidade_id: string
          updated_at?: string
          webhook_secret?: string | null
          webhook_url?: string | null
        }
        Update: {
          api_key?: string | null
          auto_reconnect?: boolean | null
          created_at?: string
          empresa_id?: string
          engine_url?: string
          id?: string
          instance_name?: string
          phone?: string | null
          qr_code?: string | null
          session_data?: Json | null
          status?: string
          unidade_id?: string
          updated_at?: string
          webhook_secret?: string | null
          webhook_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_gateway_instances_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_gateway_instances_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_gateway_messages: {
        Row: {
          created_at: string
          direction: string
          external_id: string | null
          id: string
          instance_id: string
          media_url: string | null
          message: string | null
          message_type: string
          metadata: Json | null
          phone: string
          status: string | null
        }
        Insert: {
          created_at?: string
          direction?: string
          external_id?: string | null
          id?: string
          instance_id: string
          media_url?: string | null
          message?: string | null
          message_type?: string
          metadata?: Json | null
          phone: string
          status?: string | null
        }
        Update: {
          created_at?: string
          direction?: string
          external_id?: string | null
          id?: string
          instance_id?: string
          media_url?: string | null
          message?: string | null
          message_type?: string
          metadata?: Json | null
          phone?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_gateway_messages_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_gateway_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_test_envios: {
        Row: {
          created_at: string
          empresa_id: string
          error: string | null
          id: string
          message: string
          status: string
          status_history: Json
          to_number: string
          unidade_id: string
          updated_at: string
          user_id: string | null
          wamid: string | null
          webhook_received_at: string | null
        }
        Insert: {
          created_at?: string
          empresa_id: string
          error?: string | null
          id?: string
          message: string
          status?: string
          status_history?: Json
          to_number: string
          unidade_id: string
          updated_at?: string
          user_id?: string | null
          wamid?: string | null
          webhook_received_at?: string | null
        }
        Update: {
          created_at?: string
          empresa_id?: string
          error?: string | null
          id?: string
          message?: string
          status?: string
          status_history?: Json
          to_number?: string
          unidade_id?: string
          updated_at?: string
          user_id?: string | null
          wamid?: string | null
          webhook_received_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_test_envios_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      vw_alertas_cnh: {
        Row: {
          cnh: string | null
          cnh_vencimento: string | null
          dias_restantes: number | null
          id: string | null
          nome: string | null
          situacao: string | null
          telefone: string | null
          unidade_id: string | null
        }
        Insert: {
          cnh?: string | null
          cnh_vencimento?: string | null
          dias_restantes?: never
          id?: string | null
          nome?: string | null
          situacao?: never
          telefone?: string | null
          unidade_id?: string | null
        }
        Update: {
          cnh?: string | null
          cnh_vencimento?: string | null
          dias_restantes?: never
          id?: string | null
          nome?: string | null
          situacao?: never
          telefone?: string | null
          unidade_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "entregadores_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_comissao_entregador: {
        Row: {
          comissao_calculada: number | null
          entregador_id: string | null
          entregador_nome: string | null
          mes: string | null
          total_entregas: number | null
          unidade_id: string | null
          valor_total_entregas: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pedidos_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_conferencia_caixa: {
        Row: {
          data: string | null
          diferenca_calculada: number | null
          sessao_id: string | null
          sessao_status: string | null
          total_entradas_caixa: number | null
          total_saidas_caixa: number | null
          total_vendas: number | null
          unidade_id: string | null
          valor_abertura: number | null
          valor_fechamento: number | null
        }
        Insert: {
          data?: string | null
          diferenca_calculada?: never
          sessao_id?: string | null
          sessao_status?: string | null
          total_entradas_caixa?: never
          total_saidas_caixa?: never
          total_vendas?: never
          unidade_id?: string | null
          valor_abertura?: number | null
          valor_fechamento?: number | null
        }
        Update: {
          data?: string | null
          diferenca_calculada?: never
          sessao_id?: string | null
          sessao_status?: string | null
          total_entradas_caixa?: never
          total_saidas_caixa?: never
          total_vendas?: never
          unidade_id?: string | null
          valor_abertura?: number | null
          valor_fechamento?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "caixa_sessoes_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      autocomplete_clientes: {
        Args: {
          _empresa_id: string
          _limite?: number
          _termo?: string
          _unidade_id?: string
        }
        Returns: {
          bairro: string
          endereco: string
          id: string
          nome: string
          numero: string
          telefone: string
        }[]
      }
      autocomplete_clientes_v2: {
        Args: {
          _empresa_id: string
          _limite?: number
          _termo?: string
          _unidade_id?: string
        }
        Returns: {
          bairro: string
          cep: string
          cidade: string
          endereco: string
          id: string
          nome: string
          numero: string
          telefone: string
        }[]
      }
      buscar_clientes_paginado: {
        Args: {
          _apenas_ativos?: boolean
          _empresa_id: string
          _limite?: number
          _offset?: number
          _termo?: string
          _unidade_id?: string
        }
        Returns: {
          ativo: boolean
          bairro: string
          bloqueio_credito: boolean
          cep: string
          cidade: string
          codigo_cliente: number
          cpf: string
          created_at: string
          email: string
          endereco: string
          id: string
          latitude: number
          longitude: number
          nome: string
          numero: string
          saldo_devedor: number
          telefone: string
          tipo: string
          total_count: number
        }[]
      }
      buscar_clientes_para_ia: {
        Args: {
          _bairro?: string
          _empresa_id: string
          _endereco_rua?: string
          _limite?: number
          _nome?: string
          _numero?: string
          _telefone?: string
          _unidade_id?: string
        }
        Returns: {
          bairro: string
          cep: string
          cidade: string
          codigo_cliente: number
          complemento: string
          endereco: string
          id: string
          nome: string
          numero: string
          score: number
          telefone: string
        }[]
      }
      caixa_dia_bloqueado: {
        Args: { _data: string; _unidade_id: string }
        Returns: boolean
      }
      contador_has_empresa: {
        Args: { _empresa_id: string; _user_id: string }
        Returns: boolean
      }
      execute_readonly_query: { Args: { query_text: string }; Returns: Json }
      gerar_codigo_indicacao_cliente: {
        Args: { _cliente_id: string; _nome: string }
        Returns: string
      }
      get_cliente_indicacao_resumo: { Args: never; Returns: Json }
      get_contador_empresas: {
        Args: { _user_id?: string }
        Returns: {
          empresa_id: string
          empresa_logo_url: string
          empresa_nome: string
          empresa_slug: string
          permissoes: Json
          total_unidades: number
        }[]
      }
      get_empresa_by_slug: {
        Args: { _slug: string }
        Returns: {
          id: string
          logo_url: string
          nome: string
          slug: string
        }[]
      }
      get_user_empresa_id: { Args: never; Returns: string }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      get_user_unidade_ids: { Args: { _user_id: string }; Returns: string[] }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      marcar_chat_lido_base: {
        Args: { _destinatario_id: string; _remetente_id: string }
        Returns: undefined
      }
      marcar_chat_lido_entregador: {
        Args: {
          _entregador_id: string
          _remetente_id: string
          _remetente_tipo: string
        }
        Returns: undefined
      }
      marcar_msg_lida: { Args: { _msg_id: string }; Returns: undefined }
      notify_base_chat: {
        Args: {
          _entregador_nome: string
          _mensagem: string
          _unidade_id: string
        }
        Returns: undefined
      }
      proximo_numero_pedido: { Args: { _empresa_id: string }; Returns: number }
      resolver_empresa_por_did: {
        Args: { _did: string }
        Returns: {
          empresa_id: string
          empresa_nome: string
          unidade_id: string
        }[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      unaccent: { Args: { "": string }; Returns: string }
      unidade_belongs_to_user_empresa: {
        Args: { _unidade_id: string }
        Returns: boolean
      }
      user_belongs_to_empresa: {
        Args: { _empresa_id: string; _user_id: string }
        Returns: boolean
      }
      user_can_access_contabil_path: {
        Args: { _path: string }
        Returns: boolean
      }
      user_has_unidade: {
        Args: { _unidade_id: string; _user_id: string }
        Returns: boolean
      }
      user_in_same_empresa: {
        Args: { _target_user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "gestor"
        | "financeiro"
        | "operacional"
        | "entregador"
        | "cliente"
        | "parceiro"
        | "contador"
        | "super_admin"
        | "transportadora"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "admin",
        "gestor",
        "financeiro",
        "operacional",
        "entregador",
        "cliente",
        "parceiro",
        "contador",
        "super_admin",
        "transportadora",
      ],
    },
  },
} as const
