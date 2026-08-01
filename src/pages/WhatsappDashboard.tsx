import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { MessageCircle, Phone, Clock, CheckCircle2, AlertCircle } from "lucide-react";

interface Conversation {
  id: number;
  contactName: string;
  phoneNumber: string;
  lastMessage: string;
  lastMessageTime: string;
  status: "active" | "closed" | "transferred";
  messageCount: number;
  unreadCount: number;
  orderId?: number;
}

interface Message {
  id: number;
  sender: "user" | "bot" | "agent";
  content: string;
  timestamp: string;
  type: "text" | "media" | "order";
}

export default function WhatsappDashboard() {
  const [selectedConversation, setSelectedConversation] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [newMessage, setNewMessage] = useState("");

  // Mock data - em produção, vir do backend
  const conversations: Conversation[] = [
    {
      id: 1,
      contactName: "João Silva",
      phoneNumber: "5511987654321",
      lastMessage: "Quero fazer um pedido de 2 botijões de gás 13kg",
      lastMessageTime: "2 min atrás",
      status: "active",
      messageCount: 5,
      unreadCount: 1,
    },
    {
      id: 2,
      contactName: "Maria Santos",
      phoneNumber: "5511912345678",
      lastMessage: "Qual é o preço do gás 45kg?",
      lastMessageTime: "15 min atrás",
      status: "active",
      messageCount: 3,
      unreadCount: 0,
    },
    {
      id: 3,
      contactName: "Pedro Oliveira",
      phoneNumber: "5511998765432",
      lastMessage: "Obrigado pela entrega!",
      lastMessageTime: "1 hora atrás",
      status: "closed",
      messageCount: 12,
      unreadCount: 0,
      orderId: 123,
    },
  ];

  const messages: Message[] = [
    {
      id: 1,
      sender: "user",
      content: "Olá, gostaria de fazer um pedido",
      timestamp: "10:30",
      type: "text",
    },
    {
      id: 2,
      sender: "bot",
      content: "Olá! 👋 Bem-vindo à GásFácil. Como posso ajudá-lo?",
      timestamp: "10:31",
      type: "text",
    },
    {
      id: 3,
      sender: "user",
      content: "Quero 2 botijões de gás 13kg",
      timestamp: "10:32",
      type: "text",
    },
    {
      id: 4,
      sender: "bot",
      content:
        "Perfeito! Recebi seu pedido:\n📦 Quantidade: 2\n🛢️ Produto: Gás 13kg\n\nVou processar seu pedido agora. Você receberá uma confirmação em breve! ✅",
      timestamp: "10:33",
      type: "order",
    },
  ];

  const selectedConv = conversations.find((c) => c.id === selectedConversation);
  const filteredConversations = conversations.filter((c) =>
    c.contactName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.phoneNumber.includes(searchTerm)
  );

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "active":
        return <CheckCircle2 className="w-4 h-4 text-success" />;
      case "transferred":
        return <Phone className="w-4 h-4 text-info" />;
      case "closed":
        return <AlertCircle className="w-4 h-4 text-gray-500" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge variant="default">Ativa</Badge>;
      case "transferred":
        return <Badge variant="secondary">Transferida</Badge>;
      case "closed":
        return <Badge variant="outline">Fechada</Badge>;
      default:
        return null;
    }
  };

  return (
    <MainLayout>
      <Header title="WhatsApp" subtitle="Atendimento, conversas e conexao Z-API" />
      <div className="flex h-[calc(100vh-8rem)] min-h-[640px] bg-gray-50">
      {/* Lista de Conversas */}
      <div className="w-96 border-r bg-white flex flex-col">
        <div className="p-4 border-b">
          <h1 className="text-2xl font-bold mb-4">WhatsApp</h1>
          <Input
            placeholder="Buscar conversa..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full"
          />
        </div>

        <div className="flex-1 overflow-y-auto">
          {filteredConversations.map((conv) => (
            <div
              key={conv.id}
              onClick={() => setSelectedConversation(conv.id)}
              className={`p-4 border-b cursor-pointer transition-colors ${
                selectedConversation === conv.id
                  ? "bg-info/10 border-l-4 border-l-info"
                  : "hover:bg-gray-50"
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-full bg-info/10 flex items-center justify-center">
                    <MessageCircle className="w-5 h-5 text-info" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{conv.contactName}</p>
                    <p className="text-xs text-gray-500">{conv.phoneNumber}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusIcon(conv.status)}
                  {conv.unreadCount > 0 && (
                    <Badge className="bg-destructive">{conv.unreadCount}</Badge>
                  )}
                </div>
              </div>
              <p className="text-sm text-gray-600 truncate mb-1">{conv.lastMessage}</p>
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-400 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {conv.lastMessageTime}
                </p>
                <p className="text-xs text-gray-400">{conv.messageCount} msgs</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Área de Conversa */}
      {selectedConv ? (
        <div className="flex-1 flex flex-col bg-white">
          {/* Header */}
          <div className="p-4 border-b bg-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-info/10 flex items-center justify-center">
                <MessageCircle className="w-6 h-6 text-info" />
              </div>
              <div>
                <h2 className="font-semibold">{selectedConv.contactName}</h2>
                <p className="text-sm text-gray-500">{selectedConv.phoneNumber}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {getStatusBadge(selectedConv.status)}
              <Button variant="outline" size="sm">
                <Phone className="w-4 h-4 mr-2" />
                Transferir
              </Button>
            </div>
          </div>

          {/* Mensagens */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-xs px-4 py-2 rounded-lg ${
                    msg.sender === "user"
                      ? "bg-info text-white rounded-br-none"
                      : msg.sender === "bot"
                        ? "bg-gray-200 text-gray-900 rounded-bl-none"
                        : "bg-success/10 text-success rounded-bl-none"
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  <p className="text-xs mt-1 opacity-70">{msg.timestamp}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Input de Mensagem */}
          {selectedConv.status === "active" && (
            <div className="p-4 border-t bg-white">
              <div className="flex gap-2">
                <Input
                  placeholder="Digite sua mensagem..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === "Enter" && newMessage.trim()) {
                      // TODO: Enviar mensagem
                      setNewMessage("");
                    }
                  }}
                  className="flex-1"
                />
                <Button
                  onClick={() => {
                    if (newMessage.trim()) {
                      // TODO: Enviar mensagem
                      setNewMessage("");
                    }
                  }}
                  disabled={!newMessage.trim()}
                >
                  Enviar
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <MessageCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">Selecione uma conversa para começar</p>
          </div>
        </div>
      )}
      </div>
    </MainLayout>
  );
}
