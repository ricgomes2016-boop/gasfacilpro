import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Send,
  LogOut,
  Settings,
  Search,
  MessageCircle,
  Clock,
  CheckCircle2,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useAuth } from "@/contexts/AuthContext";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Message {
  id: string;
  from: string;
  body: string;
  timestamp: Date;
  isFromMe: boolean;
  status: "sent" | "delivered" | "read";
}

interface Contact {
  id: string;
  name: string;
  number: string;
  lastMessage?: string;
  lastMessageTime?: Date;
  unreadCount: number;
  avatar?: string;
}

export default function WhatsAppWebDashboard() {
  const { empresaSelecionada } = useEmpresa();
  const { user } = useAuth();

  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState<string>("");

  // Verificar conexão e carregar dados
  useEffect(() => {
    if (!empresaSelecionada?.id) return;

    const sessionId = localStorage.getItem(`whatsapp_session_${empresaSelecionada.id}`);
    const savedPhone = localStorage.getItem(`whatsapp_phone_${empresaSelecionada.id}`);

    if (!sessionId) {
      // Redirecionar para login se não houver sessão
      window.location.href = "/whatsapp/web/login";
      return;
    }

    setPhoneNumber(savedPhone || "");
    setIsConnected(true);

    // Simular carregamento de contatos
    setTimeout(() => {
      const mockContacts: Contact[] = [
        {
          id: "1",
          name: "João Silva",
          number: "5511987654321",
          lastMessage: "Olá, tudo bem?",
          lastMessageTime: new Date(),
          unreadCount: 2,
        },
        {
          id: "2",
          name: "Maria Santos",
          number: "5511912345678",
          lastMessage: "Qual é o preço?",
          lastMessageTime: new Date(Date.now() - 3600000),
          unreadCount: 0,
        },
        {
          id: "3",
          name: "Pedro Oliveira",
          number: "5521998765432",
          lastMessage: "Obrigada pela resposta!",
          lastMessageTime: new Date(Date.now() - 7200000),
          unreadCount: 1,
        },
      ];

      setContacts(mockContacts);
      setSelectedContact(mockContacts[0]);
      setPageLoading(false);
    }, 1000);
  }, [empresaSelecionada?.id]);

  // Simular carregamento de mensagens
  useEffect(() => {
    if (selectedContact) {
      setMessages([
        {
          id: "1",
          from: selectedContact.number,
          body: "Olá! Gostaria de fazer um pedido",
          timestamp: new Date(Date.now() - 600000),
          isFromMe: false,
          status: "read",
        },
        {
          id: "2",
          from: "Você",
          body: "Claro! Qual é o seu pedido?",
          timestamp: new Date(Date.now() - 300000),
          isFromMe: true,
          status: "read",
        },
        {
          id: "3",
          from: selectedContact.number,
          body: "Gostaria de 5 botijões de gás",
          timestamp: new Date(Date.now() - 60000),
          isFromMe: false,
          status: "read",
        },
      ]);
    }
  }, [selectedContact]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedContact) return;

    setLoading(true);
    try {
      // Simular envio
      await new Promise((resolve) => setTimeout(resolve, 500));

      const message: Message = {
        id: `msg_${Date.now()}`,
        from: "Você",
        body: newMessage,
        timestamp: new Date(),
        isFromMe: true,
        status: "sent",
      };

      setMessages([...messages, message]);
      setNewMessage("");

      // Simular resposta automática da BIA
      setTimeout(() => {
        const autoReply: Message = {
          id: `msg_${Date.now() + 1}`,
          from: selectedContact.number,
          body: "Obrigado! Vou processar seu pedido. Qual é o seu endereço?",
          timestamp: new Date(),
          isFromMe: false,
          status: "delivered",
        };
        setMessages((prev) => [...prev, autoReply]);
      }, 2000);
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = () => {
    if (confirm("Tem certeza que deseja desconectar o WhatsApp?")) {
      if (empresaSelecionada?.id) {
        localStorage.removeItem(`whatsapp_session_${empresaSelecionada.id}`);
        localStorage.removeItem(`whatsapp_phone_${empresaSelecionada.id}`);
      }
      window.location.href = "/whatsapp/web/login";
    }
  };

  const filteredContacts = contacts.filter(
    (c) =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.number.includes(searchTerm)
  );

  if (pageLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-12 h-12 animate-spin text-green-600" />
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="flex items-center justify-center h-screen p-4">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Sessão expirada. Por favor, conecte novamente.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-green-600 text-white p-4 shadow-lg">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <MessageCircle className="w-6 h-6" />
            <div>
              <h1 className="text-xl font-bold">WhatsApp Web - GasFácil</h1>
              <p className="text-xs text-green-100">
                {phoneNumber} • Empresa: {empresaSelecionada?.nome}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-white hover:bg-green-700"
              onClick={() => (window.location.href = "/whatsapp/web/settings")}
            >
              <Settings className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-white hover:bg-green-700"
              onClick={handleDisconnect}
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex gap-4 p-4 max-w-7xl mx-auto w-full">
        {/* Contacts Sidebar */}
        <Card className="w-80 flex flex-col">
          <div className="p-4 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Buscar contatos..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {filteredContacts.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>Nenhum contato encontrado</p>
              </div>
            ) : (
              filteredContacts.map((contact) => (
                <div
                  key={contact.id}
                  onClick={() => setSelectedContact(contact)}
                  className={`p-4 border-b cursor-pointer hover:bg-gray-50 transition ${
                    selectedContact?.id === contact.id ? "bg-green-50 border-l-4 border-l-green-600" : ""
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 truncate">{contact.name}</h3>
                      <p className="text-sm text-gray-500 truncate">{contact.number}</p>
                      {contact.lastMessage && (
                        <p className="text-sm text-gray-600 truncate mt-1">{contact.lastMessage}</p>
                      )}
                    </div>
                    {contact.unreadCount > 0 && (
                      <div className="ml-2 bg-green-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
                        {contact.unreadCount}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Chat Area */}
        <Card className="flex-1 flex flex-col">
          {selectedContact ? (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-gray-900">{selectedContact.name}</h2>
                  <p className="text-sm text-gray-500">{selectedContact.number}</p>
                </div>
                <Button variant="ghost" size="sm">
                  <Settings className="w-4 h-4" />
                </Button>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-white">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.isFromMe ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-xs px-4 py-2 rounded-lg ${
                        msg.isFromMe
                          ? "bg-green-600 text-white rounded-br-none"
                          : "bg-gray-200 text-gray-900 rounded-bl-none"
                      }`}
                    >
                      <p className="text-sm">{msg.body}</p>
                      <div className="flex items-center justify-end gap-1 mt-1 text-xs opacity-70">
                        <span>{msg.timestamp.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                        {msg.isFromMe && (
                          <>
                            {msg.status === "sent" && <Clock className="w-3 h-3" />}
                            {msg.status === "delivered" && <CheckCircle2 className="w-3 h-3" />}
                            {msg.status === "read" && <CheckCircle2 className="w-3 h-3" />}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Input Area */}
              <div className="p-4 border-t bg-gray-50 flex gap-2">
                <Input
                  placeholder="Digite uma mensagem..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  disabled={loading}
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={loading || !newMessage.trim()}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <MessageCircle className="w-16 h-16 mx-auto mb-4 opacity-20" />
                <p>Selecione um contato para começar a conversar</p>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
