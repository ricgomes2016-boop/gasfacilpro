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
          created_at: string
          id: string
          titulo: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          titulo?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          titulo?: string
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
          id: string
          metadata: Json | null
          role: string
        }
        Insert: {
          content: string
          conversa_id: string
          created_at?: string
          id?: string
          metadata?: Json | null
          role: string
        }
        Update: {
          content?: string
          conversa_id?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          role?: string
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
          quantidade_vendida: number | null
        }
        Insert: {
          carregamento_id: string
          created_at?: string
          id?: string
          produto_id: string
          quantidade_retorno?: number | null
          quantidade_saida?: number
          quantidade_vendida?: number | null
        }
        Update: {
          carregamento_id?: string
          created_at?: string
          id?: string
          produto_id?: string
          quantidade_retorno?: number | null
          quantidade_saida?: number
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
      chamadas_recebidas: {
        Row: {
          atendente_id: string | null
          cliente_id: string | null
          cliente_nome: string | null
          created_at: string
          duracao_segundos: number | null
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
          duracao_segundos?: number | null
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
          duracao_segundos?: number | null
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
          cpf: string | null
          created_at: string
          data_ultimo_pagamento: string | null
          email: string | null
          empresa_id: string | null
          endereco: string | null
          id: string
          latitude: number | null
          limite_credito: number | null
          longitude: number | null
          motivo_bloqueio: string | null
          nome: string
          numero: string | null
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
          cpf?: string | null
          created_at?: string
          data_ultimo_pagamento?: string | null
          email?: string | null
          empresa_id?: string | null
          endereco?: string | null
          id?: string
          latitude?: number | null
          limite_credito?: number | null
          longitude?: number | null
          motivo_bloqueio?: string | null
          nome: string
          numero?: string | null
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
          cpf?: string | null
          created_at?: string
          data_ultimo_pagamento?: string | null
          email?: string | null
          empresa_id?: string | null
          endereco?: string | null
          id?: string
          latitude?: number | null
          limite_credito?: number | null
          longitude?: number | null
          motivo_bloqueio?: string | null
          nome?: string
          numero?: string | null
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
        ]
      }
      comissao_config: {
        Row: {
          canal_venda: string
          created_at: string
          id: string
          produto_id: string
          unidade_id: string | null
          updated_at: string
          valor: number
        }
        Insert: {
          canal_venda: string
          created_at?: string
          id?: string
          produto_id: string
          unidade_id?: string | null
          updated_at?: string
          valor?: number
        }
        Update: {
          canal_venda?: string
          created_at?: string
          id?: string
          produto_id?: string
          unidade_id?: string | null
          updated_at?: string
          valor?: number
        }
        Relationships: [
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
          compra_id: string
          created_at: string
          id: string
          preco_unitario: number
          produto_id: string | null
          quantidade: number
        }
        Insert: {
          compra_id: string
          created_at?: string
          id?: string
          preco_unitario: number
          produto_id?: string | null
          quantidade?: number
        }
        Update: {
          compra_id?: string
          created_at?: string
          id?: string
          preco_unitario?: number
          produto_id?: string | null
          quantidade?: number
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
          chave_nfe: string | null
          created_at: string
          data_compra: string | null
          data_pagamento: string | null
          data_prevista: string | null
          data_recebimento: string | null
          fornecedor_id: string | null
          id: string
          numero_nota_fiscal: string | null
          observacoes: string | null
          status: string | null
          unidade_id: string | null
          updated_at: string
          valor_frete: number | null
          valor_total: number | null
        }
        Insert: {
          chave_nfe?: string | null
          created_at?: string
          data_compra?: string | null
          data_pagamento?: string | null
          data_prevista?: string | null
          data_recebimento?: string | null
          fornecedor_id?: string | null
          id?: string
          numero_nota_fiscal?: string | null
          observacoes?: string | null
          status?: string | null
          unidade_id?: string | null
          updated_at?: string
          valor_frete?: number | null
          valor_total?: number | null
        }
        Update: {
          chave_nfe?: string | null
          created_at?: string
          data_compra?: string | null
          data_pagamento?: string | null
          data_prevista?: string | null
          data_recebimento?: string | null
          fornecedor_id?: string | null
          id?: string
          numero_nota_fiscal?: string | null
          observacoes?: string | null
          status?: string | null
          unidade_id?: string | null
          updated_at?: string
          valor_frete?: number | null
          valor_total?: number | null
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
          cnpj: string | null
          created_at: string
          empresa_id: string | null
          endereco: string | null
          id: string
          mensagem_cupom: string | null
          nome_empresa: string
          regras_cadastro: Json
          telefone: string | null
          updated_at: string
        }
        Insert: {
          asaas_api_key?: string | null
          asaas_sandbox?: boolean | null
          cnpj?: string | null
          created_at?: string
          empresa_id?: string | null
          endereco?: string | null
          id?: string
          mensagem_cupom?: string | null
          nome_empresa?: string
          regras_cadastro?: Json
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          asaas_api_key?: string | null
          asaas_sandbox?: boolean | null
          cnpj?: string | null
          created_at?: string
          empresa_id?: string | null
          endereco?: string | null
          id?: string
          mensagem_cupom?: string | null
          nome_empresa?: string
          regras_cadastro?: Json
          telefone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "configuracoes_empresa_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
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
          cliente: string
          cliente_id: string | null
          created_at: string
          descricao: string
          forma_pagamento: string | null
          id: string
          observacoes: string | null
          operadora_id: string | null
          parcela_atual: number | null
          pedido_id: string | null
          plano_contas_id: string | null
          status: string
          taxa_percentual: number | null
          total_parcelas: number | null
          unidade_id: string | null
          updated_at: string
          valor: number
          valor_liquido: number | null
          valor_taxa: number | null
          vencimento: string
        }
        Insert: {
          cliente: string
          cliente_id?: string | null
          created_at?: string
          descricao: string
          forma_pagamento?: string | null
          id?: string
          observacoes?: string | null
          operadora_id?: string | null
          parcela_atual?: number | null
          pedido_id?: string | null
          plano_contas_id?: string | null
          status?: string
          taxa_percentual?: number | null
          total_parcelas?: number | null
          unidade_id?: string | null
          updated_at?: string
          valor?: number
          valor_liquido?: number | null
          valor_taxa?: number | null
          vencimento: string
        }
        Update: {
          cliente?: string
          cliente_id?: string | null
          created_at?: string
          descricao?: string
          forma_pagamento?: string | null
          id?: string
          observacoes?: string | null
          operadora_id?: string | null
          parcela_atual?: number | null
          pedido_id?: string | null
          plano_contas_id?: string | null
          status?: string
          taxa_percentual?: number | null
          total_parcelas?: number | null
          unidade_id?: string | null
          updated_at?: string
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
          cnpj: string | null
          created_at: string
          email: string | null
          id: string
          logo_url: string | null
          nome: string
          plano: string
          plano_max_unidades: number
          plano_max_usuarios: number
          slug: string
          telefone: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cnpj?: string | null
          created_at?: string
          email?: string | null
          id?: string
          logo_url?: string | null
          nome: string
          plano?: string
          plano_max_unidades?: number
          plano_max_usuarios?: number
          slug: string
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cnpj?: string | null
          created_at?: string
          email?: string | null
          id?: string
          logo_url?: string | null
          nome?: string
          plano?: string
          plano_max_unidades?: number
          plano_max_usuarios?: number
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
          created_at: string
          data: string
          entregador_id: string
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
          created_at?: string
          data?: string
          entregador_id: string
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
          created_at?: string
          data?: string
          entregador_id?: string
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
      funcionarios: {
        Row: {
          ativo: boolean | null
          cargo: string | null
          cpf: string | null
          created_at: string
          data_admissao: string | null
          email: string | null
          endereco: string | null
          id: string
          nome: string
          salario: number | null
          setor: string | null
          status: string | null
          telefone: string | null
          unidade_id: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean | null
          cargo?: string | null
          cpf?: string | null
          created_at?: string
          data_admissao?: string | null
          email?: string | null
          endereco?: string | null
          id?: string
          nome: string
          salario?: number | null
          setor?: string | null
          status?: string | null
          telefone?: string | null
          unidade_id?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean | null
          cargo?: string | null
          cpf?: string | null
          created_at?: string
          data_admissao?: string | null
          email?: string | null
          endereco?: string | null
          id?: string
          nome?: string
          salario?: number | null
          setor?: string | null
          status?: string | null
          telefone?: string | null
          unidade_id?: string | null
          updated_at?: string
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
      integracoes_whatsapp: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          id: string
          instance_id: string
          nome_bot: string | null
          security_token: string | null
          token: string
          unidade_id: string
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          id?: string
          instance_id: string
          nome_bot?: string | null
          security_token?: string | null
          token: string
          unidade_id: string
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          id?: string
          instance_id?: string
          nome_bot?: string | null
          security_token?: string | null
          token?: string
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
          created_at: string
          created_by: string | null
          data_emissao: string
          desconto: number | null
          id: string
          numero: number
          observacoes: string | null
          status: string
          unidade_id: string | null
          updated_at: string
          validade: string
          valor_total: number
        }
        Insert: {
          cliente_id?: string | null
          cliente_nome: string
          created_at?: string
          created_by?: string | null
          data_emissao?: string
          desconto?: number | null
          id?: string
          numero?: number
          observacoes?: string | null
          status?: string
          unidade_id?: string | null
          updated_at?: string
          validade?: string
          valor_total?: number
        }
        Update: {
          cliente_id?: string | null
          cliente_nome?: string
          created_at?: string
          created_by?: string | null
          data_emissao?: string
          desconto?: number | null
          id?: string
          numero?: number
          observacoes?: string | null
          status?: string
          unidade_id?: string | null
          updated_at?: string
          validade?: string
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
          data_agendamento: string | null
          data_vencimento_fiado: string | null
          endereco_entrega: string | null
          entregador_id: string | null
          forma_pagamento: string | null
          id: string
          latitude: number | null
          longitude: number | null
          numero_entrega: string | null
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
          data_agendamento?: string | null
          data_vencimento_fiado?: string | null
          endereco_entrega?: string | null
          entregador_id?: string | null
          forma_pagamento?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          numero_entrega?: string | null
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
          data_agendamento?: string | null
          data_vencimento_fiado?: string | null
          endereco_entrega?: string | null
          entregador_id?: string | null
          forma_pagamento?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          numero_entrega?: string | null
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
          ativo: boolean | null
          botijao_par_id: string | null
          categoria: string | null
          codigo_barras: string | null
          created_at: string
          descricao: string | null
          estoque: number | null
          id: string
          image_url: string | null
          nome: string
          preco: number
          preco_custo: number | null
          tipo_botijao: string | null
          unidade_id: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean | null
          botijao_par_id?: string | null
          categoria?: string | null
          codigo_barras?: string | null
          created_at?: string
          descricao?: string | null
          estoque?: number | null
          id?: string
          image_url?: string | null
          nome: string
          preco: number
          preco_custo?: number | null
          tipo_botijao?: string | null
          unidade_id?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean | null
          botijao_par_id?: string | null
          categoria?: string | null
          codigo_barras?: string | null
          created_at?: string
          descricao?: string | null
          estoque?: number | null
          id?: string
          image_url?: string | null
          nome?: string
          preco?: number
          preco_custo?: number | null
          tipo_botijao?: string | null
          unidade_id?: string | null
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
          created_at: string
          distancia_km: number | null
          id: string
          nome: string
          tempo_estimado: string | null
          unidade_id: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean | null
          bairros?: string[]
          created_at?: string
          distancia_km?: number | null
          id?: string
          nome: string
          tempo_estimado?: string | null
          unidade_id?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean | null
          bairros?: string[]
          created_at?: string
          distancia_km?: number | null
          id?: string
          nome?: string
          tempo_estimado?: string | null
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
      unidades: {
        Row: {
          ativo: boolean | null
          bairro: string | null
          cep: string | null
          chave_pix: string | null
          cidade: string | null
          cnpj: string | null
          created_at: string
          email: string | null
          empresa_id: string | null
          endereco: string | null
          estado: string | null
          id: string
          latitude: number | null
          longitude: number | null
          nome: string
          telefone: string | null
          tipo: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean | null
          bairro?: string | null
          cep?: string | null
          chave_pix?: string | null
          cidade?: string | null
          cnpj?: string | null
          created_at?: string
          email?: string | null
          empresa_id?: string | null
          endereco?: string | null
          estado?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          nome: string
          telefone?: string | null
          tipo?: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean | null
          bairro?: string | null
          cep?: string | null
          chave_pix?: string | null
          cidade?: string | null
          cnpj?: string | null
          created_at?: string
          email?: string | null
          empresa_id?: string | null
          endereco?: string | null
          estado?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          nome?: string
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      caixa_dia_bloqueado: {
        Args: { _data: string; _unidade_id: string }
        Returns: boolean
      }
      execute_readonly_query: { Args: { query_text: string }; Returns: Json }
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
      unidade_belongs_to_user_empresa: {
        Args: { _unidade_id: string }
        Returns: boolean
      }
      user_belongs_to_empresa: {
        Args: { _empresa_id: string; _user_id: string }
        Returns: boolean
      }
      user_has_unidade: {
        Args: { _unidade_id: string; _user_id: string }
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
      ],
    },
  },
} as const
